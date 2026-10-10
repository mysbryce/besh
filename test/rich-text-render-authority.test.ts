import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-authority-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-authority-'
let directory: string
let server: ReturnType<typeof createApp>

type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), temporaryPrefix))
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
})

afterEach(async () => {
  await server.close()

  const target = resolve(directory)
  const parent = resolve(tmpdir())
  expect(target.toLowerCase().startsWith((parent + sep).toLowerCase())).toBe(
    true,
  )
  expect(basename(target).startsWith(temporaryPrefix)).toBe(true)

  rmSync(target, { recursive: true, force: true })
})

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  token: string | null = owner,
) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        ...(token === null ? {} : { authorization: 'Bearer ' + token }),
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function get(path: string) {
  const response = await request(path)
  expect(response.status).toBe(200)

  return response.json()
}

async function audit(): Promise<AuditEvent[]> {
  return get('/api/audit')
}

function expectOnlyDenial(
  before: AuditEvent[],
  after: AuditEvent[],
  actor: string,
  resource: string,
) {
  const priorIds = new Set(before.map((event) => event.id))
  const additions = after.filter((event) => !priorIds.has(event.id))
  expect(additions).toEqual([
    {
      id: expect.any(Number),
      actor,
      action: 'access.denied',
      resource,
      created_at: expect.any(String),
    },
  ])

  // Exclude only this exact newly asserted denial, never all denial events.
  const expectedIds = new Set(additions.map((event) => event.id))
  expect(after.filter((event) => !expectedIds.has(event.id))).toEqual(before)
}

function document(text: string) {
  return {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, marks: [] }],
      },
    ],
  }
}

test('previews require current owner authority and retain exact entry and frozen model revisions', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Reviewed articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private reviewed articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  expect(collection.struct).toEqual({
    id: model.id,
    version: 1,
    name: model.name,
    fields,
  })

  const collectionPath = '/api/collections/' + collection.id
  const createdResponse = await request(collectionPath + '/entries', 'POST', {
    data: { body: document('Reviewed <first> & ไทย') },
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.version).toBe(1)

  const editorResponse = await request('/api/members', 'POST', {
    name: 'Preview editor',
    role: 'editor',
  })
  expect(editorResponse.status).toBe(200)

  const editor = await editorResponse.json()
  const editorToken: unknown = editor.token
  if (typeof editorToken !== 'string' || !editorToken)
    throw new Error('Public member creation did not return a credential')

  const entryPath = collectionPath + '/entries/' + created.id
  const previewPath = entryPath + '/render-preview'
  const renderer = { schemaVersion: 1, elements: {} }
  const input = { entryVersion: 1, fieldKey: 'body', renderer }
  const beforeAnonymous = await audit()

  const anonymousResponse = await request(previewPath, 'POST', input, null)
  expect(anonymousResponse.status).toBe(401)
  expect((await anonymousResponse.json()).html).toBeUndefined()

  const afterAnonymous = await audit()
  expectOnlyDenial(beforeAnonymous, afterAnonymous, 'anonymous', 'management')

  const deniedEditorResponse = await request(
    previewPath,
    'POST',
    input,
    editorToken,
  )
  expect(deniedEditorResponse.status).toBe(403)
  expect((await deniedEditorResponse.json()).html).toBeUndefined()

  const afterEditor = await audit()
  expectOnlyDenial(afterAnonymous, afterEditor, editor.id, 'api')
  expect(await get(entryPath)).toEqual(created)
  expect(await get(collectionPath)).toEqual(collection)

  const ownerResponse = await request(previewPath, 'POST', input)
  expect(ownerResponse.status).toBe(200)
  expect(await ownerResponse.json()).toMatchObject({
    entryId: created.id,
    entryVersion: 1,
    structId: model.id,
    structVersion: 1,
    html: '<p>Reviewed &lt;first&gt; &amp; ไทย</p>',
  })
  expect(await audit()).toEqual(afterEditor)

  const invalidResponse = await request(previewPath, 'POST', {
    ...input,
    renderer: {
      schemaVersion: 1,
      elements: { p: { attributes: { onclick: 'alert(1)' } } },
    },
  })
  expect(invalidResponse.status).toBe(400)
  expect((await invalidResponse.json()).html).toBeUndefined()
  expect(await audit()).toEqual(afterEditor)
  expect(await get(entryPath)).toEqual(created)
  expect(await get(collectionPath)).toEqual(collection)

  const updatedData = { body: document('  Updated <second> & ไทย  ') }
  const updateResponse = await request(entryPath, 'PUT', {
    version: 1,
    data: updatedData,
  })
  expect(updateResponse.status).toBe(200)

  const updated = await updateResponse.json()
  expect(updated.version).toBe(2)
  expect(updated.data).toEqual(updatedData)

  const replacementFields = [
    {
      key: 'headline',
      label: 'Later headline',
      required: true,
      schema: { type: 'text' },
    },
  ]
  const changedModelResponse = await request(
    '/api/structs/' + model.id,
    'PUT',
    {
      version: 1,
      name: 'Later article model',
      fields: replacementFields,
    },
  )
  expect(changedModelResponse.status).toBe(200)

  const changedModel = await changedModelResponse.json()
  expect(changedModel.version).toBe(2)
  expect(changedModel.fields).toEqual(replacementFields)
  expect(await get('/api/structs/' + model.id)).toEqual(changedModel)
  expect(await get(collectionPath)).toEqual(collection)
  const beforeVersionedPreview = await audit()

  const staleResponse = await request(previewPath, 'POST', input)
  expect(staleResponse.status).toBe(409)
  expect((await staleResponse.json()).html).toBeUndefined()
  expect(await audit()).toEqual(beforeVersionedPreview)
  expect(await get(entryPath)).toEqual(updated)
  expect(await get(collectionPath)).toEqual(collection)

  const rendererSha256 = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')
  const currentResponse = await request(previewPath, 'POST', {
    ...input,
    entryVersion: 2,
  })
  expect(currentResponse.status).toBe(200)
  expect(await currentResponse.json()).toEqual({
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    entryId: created.id,
    entryVersion: 2,
    fieldKey: 'body',
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
    rendererSha256,
    consumerContract: null,
    html: '<p>  Updated &lt;second&gt; &amp; ไทย  </p>',
  })
  expect(await audit()).toEqual(beforeVersionedPreview)
  expect(await get(entryPath)).toEqual(updated)
  expect(await get(collectionPath)).toEqual(collection)
})
