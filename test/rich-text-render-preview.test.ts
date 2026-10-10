import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-rich-text-render-tracer-'))
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
  expect(basename(target).startsWith('besh-rich-text-render-tracer-')).toBe(
    true,
  )

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

async function contentAudit() {
  const response = await request('/api/audit')
  expect(response.status).toBe(200)

  const events: { action: string }[] = await response.json()

  // Authentication metadata may advance; rendering must not mutate content.
  return events.filter(
    (event) =>
      event.action.startsWith('entry.') ||
      event.action.startsWith('collection.') ||
      event.action.startsWith('struct.'),
  )
}

test('owner previews escaped heading HTML with a transient reviewed renderer', async () => {
  const schema = { type: 'richText', schemaVersion: 2, astVersion: 2 }
  const fields = [{ key: 'body', label: 'Body', required: true, schema }]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Formatted articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.fields).toEqual(fields)
  expect(model.version).toBe(1)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private formatted articles',
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
    astVersion: 2,
    children: [
      {
        type: 'heading',
        level: 1,
        children: [
          {
            type: 'text',
            text: '  <script>literal</script> & ไทย  ',
            marks: [],
          },
        ],
      },
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

  const beforeAudit = await contentAudit()
  const renderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['text-heading-1'],
        attributes: { 'x-data': 'h1' },
      },
    },
    consumerContract: 'besh.fixed-heading-id.v1',
  }

  // Independent sorted-key contract bytes; no production canonicalizer import.
  const canonicalRenderer =
    '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"x-data":"h1"},"classes":["text-heading-1"]}},"schemaVersion":1}'
  const rendererSha256 = createHash('sha256')
    .update(canonicalRenderer, 'utf8')
    .digest('hex')

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
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
    rendererSha256,
    consumerContract: 'besh.fixed-heading-id.v1',
    html: '<h1 class="text-heading-1" x-data="h1">  &lt;script&gt;literal&lt;/script&gt; &amp; ไทย  </h1>',
  })

  const afterResponse = await request(entryPath)
  expect(afterResponse.status).toBe(200)
  expect(await afterResponse.json()).toEqual(created)

  const afterCollectionResponse = await request(
    '/api/collections/' + collection.id,
  )
  expect(afterCollectionResponse.status).toBe(200)
  expect(await afterCollectionResponse.json()).toEqual(collection)
  expect(await contentAudit()).toEqual(beforeAudit)
})
