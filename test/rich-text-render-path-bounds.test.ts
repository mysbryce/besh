import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-path-bounds-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-path-bounds-'
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

test('owner previews direct array items and six saved field segments without content effects', async () => {
  const fields = [
    {
      key: 'notes',
      label: 'Notes',
      required: true,
      schema: {
        type: 'array',
        items: { type: 'richText', schemaVersion: 2, astVersion: 2 },
      },
    },
    {
      key: 'one',
      label: 'One',
      required: true,
      schema: {
        type: 'object',
        fields: [
          {
            key: 'two',
            label: 'Two',
            required: true,
            schema: {
              type: 'object',
              fields: [
                {
                  key: 'three',
                  label: 'Three',
                  required: true,
                  schema: {
                    type: 'object',
                    fields: [
                      {
                        key: 'four',
                        label: 'Four',
                        required: true,
                        schema: {
                          type: 'object',
                          fields: [
                            {
                              key: 'five',
                              label: 'Five',
                              required: true,
                              schema: {
                                type: 'object',
                                fields: [
                                  {
                                    key: 'body',
                                    label: 'Body',
                                    required: true,
                                    schema: {
                                      type: 'richText',
                                      schemaVersion: 2,
                                      astVersion: 2,
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Saved path boundaries',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)
  expect(await get('/api/structs/' + model.id)).toEqual(model)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private path boundaries',
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
    notes: [document('  Direct <note> & ไทย  ')],
    one: {
      two: {
        three: {
          four: {
            five: { body: document('  Deep <body> & ไทย  ') },
          },
        },
      },
    },
  }
  const collectionPath = '/api/collections/' + collection.id
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data,
  })
  expect(entryResponse.status).toBe(200)

  const created = await entryResponse.json()
  expect(created.version).toBe(1)
  expect(created.data).toEqual(data)

  const entryPath = collectionPath + '/entries/' + created.id
  expect(await get(entryPath)).toEqual(created)
  expect(await get(collectionPath)).toEqual(collection)

  const beforeAudit = await get('/api/audit')
  const renderer = { schemaVersion: 1, elements: {} }
  const previewPath = entryPath + '/render-preview'
  const rendererSha256 = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')
  const deepestPath = ['one', 'two', 'three', 'four', 'five', 'body']
  const validSelections = [
    {
      fieldPath: ['notes', 0],
      fieldKey: 'notes',
      html: '<p>  Direct &lt;note&gt; &amp; ไทย  </p>',
    },
    {
      fieldPath: deepestPath,
      fieldKey: 'body',
      html: '<p>  Deep &lt;body&gt; &amp; ไทย  </p>',
    },
  ]

  for (const selection of validSelections) {
    const response = await request(previewPath, 'POST', {
      entryVersion: 1,
      fieldPath: selection.fieldPath,
      renderer,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      collectionId: collection.id,
      collectionVersion: 1,
      structId: model.id,
      structVersion: 1,
      entryId: created.id,
      entryVersion: 1,
      fieldKey: selection.fieldKey,
      fieldPath: selection.fieldPath,
      schemaVersion: 2,
      astVersion: 2,
      rendererSchemaVersion: 1,
      rendererSha256,
      consumerContract: null,
      html: selection.html,
    })

    expect(await get(entryPath)).toEqual(created)
    expect(await get(collectionPath)).toEqual(collection)
    expect(await get('/api/audit')).toEqual(beforeAudit)
  }

  // JSON encodes a sparse selector slot as null; this proves rejection at the wire boundary.
  const sparsePath: unknown[] = ['notes']
  sparsePath.length = 2
  expect(JSON.stringify(sparsePath)).toBe('["notes",null]')

  const invalidPaths = [
    [],
    [...deepestPath, 'children'],
    ['notes', 1],
    ['notes', -1],
    ['notes', 0.5],
    ['notes', '0'],
    sparsePath,
  ]

  for (const fieldPath of invalidPaths) {
    const response = await request(previewPath, 'POST', {
      entryVersion: 1,
      fieldPath,
      renderer,
    })
    expect(response.status).toBe(400)
    expect((await response.json()).html).toBeUndefined()

    expect(await get(entryPath)).toEqual(created)
    expect(await get(collectionPath)).toEqual(collection)
    expect(await get('/api/audit')).toEqual(beforeAudit)
  }
})
