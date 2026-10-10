import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-literal-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-literal-tracer-'
let directory: string
let server: ReturnType<typeof createApp>

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

function request(path: string, method = 'GET', body?: unknown) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        authorization: 'Bearer ' + owner,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function audit() {
  const response = await request('/api/audit')
  expect(response.status).toBe(200)

  // Owner bearer previews compare every audit event; no cookie session is used.
  return response.json()
}

test('owner previews literal version-one paragraphs without converting saved content', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Literal articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private literal articles',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  expect(collection.version).toBe(1)
  expect(collection.struct).toEqual({
    id: model.id,
    version: 1,
    name: model.name,
    fields,
  })

  const document = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '  <strong>literal</strong> & ไทย "quoted"  ' },
          { type: 'text', text: '' },
          { type: 'text', text: '\r\n  ' },
        ],
      },
      { type: 'paragraph', children: [] },
      { type: 'paragraph', children: [{ type: 'text', text: '' }] },
    ],
  }
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', {
    data: { body: document },
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.collectionId).toBe(collection.id)
  expect(created.version).toBe(1)
  expect(created.data).toEqual({ body: document })

  const entryPath = entries + '/' + created.id
  const beforeResponse = await request(entryPath)
  expect(beforeResponse.status).toBe(200)
  expect(await beforeResponse.json()).toEqual(created)

  const beforeAudit = await audit()
  const renderer = {
    schemaVersion: 1,
    elements: {
      p: {
        classes: ['content-copy'],
        attributes: { title: 'Reader "guide" & <notes> ไทย' },
      },
    },
  }

  // Omitted consumer contracts normalize to null in canonical renderer identity.
  const canonicalRenderer =
    '{"consumerContract":null,"elements":{"p":{"attributes":{"title":"Reader \\"guide\\" & <notes> ไทย"},"classes":["content-copy"]}},"schemaVersion":1}'
  const rendererSha256 = createHash('sha256')
    .update(canonicalRenderer, 'utf8')
    .digest('hex')
  const opening =
    '<p class="content-copy" title="Reader &quot;guide&quot; &amp; &lt;notes&gt; ไทย">'
  const expectedHtml =
    opening +
    '  &lt;strong&gt;literal&lt;/strong&gt; &amp; ไทย "quoted"  \r\n  </p>' +
    opening +
    '</p>' +
    opening +
    '</p>'

  const renderedResponse = await request(
    entryPath + '/render-preview',
    'POST',
    {
      entryVersion: 1,
      fieldKey: 'body',
      renderer,
    },
  )
  expect(renderedResponse.status).toBe(200)
  expect(await renderedResponse.json()).toEqual({
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    entryId: created.id,
    entryVersion: 1,
    fieldKey: 'body',
    schemaVersion: 1,
    astVersion: 1,
    rendererSchemaVersion: 1,
    rendererSha256,
    consumerContract: null,
    html: expectedHtml,
  })

  const afterResponse = await request(entryPath)
  expect(afterResponse.status).toBe(200)
  expect(await afterResponse.json()).toEqual(created)

  const afterCollectionResponse = await request(
    '/api/collections/' + collection.id,
  )
  expect(afterCollectionResponse.status).toBe(200)
  expect(await afterCollectionResponse.json()).toEqual(collection)
  expect(await audit()).toEqual(beforeAudit)
})
