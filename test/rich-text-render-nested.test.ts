import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-nested-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-nested-'
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

async function get(path: string) {
  const response = await request(path)
  expect(response.status).toBe(200)

  return response.json()
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

test('owner previews an exact nested saved field under its frozen collection model', async () => {
  const richText = { type: 'richText', schemaVersion: 2, astVersion: 2 }
  const fields = [
    {
      key: 'details',
      label: 'Details',
      required: true,
      schema: {
        type: 'object',
        fields: [
          {
            key: 'sections',
            label: 'Sections',
            required: true,
            schema: {
              type: 'array',
              items: {
                type: 'object',
                fields: [
                  {
                    key: 'body',
                    label: 'Body',
                    required: true,
                    schema: richText,
                  },
                  {
                    key: 'summary',
                    label: 'Summary',
                    required: false,
                    schema: richText,
                  },
                ],
              },
            },
          },
        ],
      },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Nested articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private nested articles',
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

  const data = {
    details: {
      sections: [
        { body: document('First <section> & ไทย') },
        { body: document('  Second <section> & ไทย  ') },
      ],
    },
  }
  const collectionPath = '/api/collections/' + collection.id
  const createdResponse = await request(collectionPath + '/entries', 'POST', {
    data,
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.version).toBe(1)
  expect(created.data).toEqual(data)

  const replacementFields = [
    {
      key: 'headline',
      label: 'Later headline',
      required: true,
      schema: { type: 'text' },
    },
  ]
  const changedResponse = await request('/api/structs/' + model.id, 'PUT', {
    version: 1,
    name: 'Later flat article model',
    fields: replacementFields,
  })
  expect(changedResponse.status).toBe(200)

  const changedModel = await changedResponse.json()
  expect(changedModel.version).toBe(2)
  expect(changedModel.fields).toEqual(replacementFields)
  expect(await get('/api/structs/' + model.id)).toEqual(changedModel)

  const entryPath = collectionPath + '/entries/' + created.id
  expect(await get(entryPath)).toEqual(created)
  expect(await get(collectionPath)).toEqual(collection)
  const beforeAudit = await get('/api/audit')
  const renderer = { schemaVersion: 1, elements: {} }
  const fieldPath = ['details', 'sections', 1, 'body']
  const input = { entryVersion: 1, fieldPath, renderer }
  const previewPath = entryPath + '/render-preview'
  const rendererSha256 = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')

  const renderedResponse = await request(previewPath, 'POST', input)
  expect(renderedResponse.status).toBe(200)
  expect(await renderedResponse.json()).toEqual({
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    entryId: created.id,
    entryVersion: 1,
    fieldKey: 'body',
    fieldPath,
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
    rendererSha256,
    consumerContract: null,
    html: '<p>  Second &lt;section&gt; &amp; ไทย  </p>',
  })
  expect(await get('/api/audit')).toEqual(beforeAudit)
  expect(await get(entryPath)).toEqual(created)
  expect(await get(collectionPath)).toEqual(collection)

  const invalidInputs = [
    { ...input, fieldKey: 'body' },
    { ...input, fieldPath: ['details', 'missing'] },
    { ...input, fieldPath: ['details', 'sections', 1, 'summary'] },
    { ...input, fieldPath: ['details', 'sections', '1', 'body'] },
    { ...input, fieldPath: ['details', 'sections', 2, 'body'] },
    { ...input, fieldPath: ['details', 'sections', -1, 'body'] },
    { ...input, fieldPath: ['details', 'sections', 1.5, 'body'] },
    {
      ...input,
      fieldPath: ['details', 'sections', 1, 'body', 'children', 0],
    },
  ]

  for (const invalid of invalidInputs) {
    const response = await request(previewPath, 'POST', invalid)
    expect(response.status).toBe(400)
    expect((await response.json()).html).toBeUndefined()
    expect(await get('/api/audit')).toEqual(beforeAudit)
    expect(await get(entryPath)).toEqual(created)
    expect(await get(collectionPath)).toEqual(collection)
  }
})
