import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-boundaries-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-boundaries-'
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

test('owner respects renderer boundaries and rejects oversized HTML from genuinely saved content', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Bounded preview articles',
    fields: [
      {
        key: 'body',
        label: 'Body',
        required: true,
        schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private bounded preview articles',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const collectionPath = '/api/collections/' + collection.id
  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Bounded & literal', marks: [] }],
      },
    ],
  }
  const createdResponse = await request(collectionPath + '/entries', 'POST', {
    data: { body: document },
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  const entryPath = collectionPath + '/entries/' + created.id
  const savedEntry = await get(entryPath)
  expect(savedEntry).toEqual(created)
  expect(savedEntry.data).toEqual({ body: document })

  const savedCollection = await get(collectionPath)
  const savedAudit = await get('/api/audit')

  async function expectSavedState() {
    expect(await get(entryPath)).toEqual(savedEntry)
    expect(await get(collectionPath)).toEqual(savedCollection)
    expect(await get('/api/audit')).toEqual(savedAudit)
  }

  function preview(renderer: unknown) {
    return request(entryPath + '/render-preview', 'POST', {
      entryVersion: savedEntry.version,
      fieldKey: 'body',
      renderer,
    })
  }

  const classes = Array.from(
    { length: 8 },
    (_, index) => 'token' + index + '_' + 'a'.repeat(57),
  )
  const title = 't'.repeat(160)
  const label = 'a'.repeat(160)
  const boundedRenderer = {
    schemaVersion: 1,
    elements: {
      p: { classes, attributes: { title, 'aria-label': label } },
      hr: { attributes: { title: 'x'.repeat(43) } },
    },
  }
  expect(Buffer.byteLength(JSON.stringify(boundedRenderer), 'utf8')).toBe(1024)

  const boundedResponse = await preview(boundedRenderer)
  expect(boundedResponse.status).toBe(200)
  expect((await boundedResponse.json()).html).toBe(
    '<p class="' +
      classes.join(' ') +
      '" aria-label="' +
      label +
      '" title="' +
      title +
      '">Bounded &amp; literal</p>',
  )
  await expectSavedState()

  const invalidRenderers = [
    {
      label: 'framework identifier without consumer review',
      renderer: {
        schemaVersion: 1,
        elements: { h1: { attributes: { 'x-data': 'h1' } } },
      },
    },
    {
      label: 'unknown consumer contract',
      renderer: {
        schemaVersion: 1,
        elements: { h1: { attributes: { 'x-data': 'h1' } } },
        consumerContract: 'unreviewed.consumer.v1',
      },
    },
    {
      label: 'framework expression instead of fixed identifier',
      renderer: {
        schemaVersion: 1,
        elements: {
          h1: { attributes: { 'x-data': '{ init() { alert(1) } }' } },
        },
        consumerContract: 'besh.fixed-heading-id.v1',
      },
    },
    {
      label: 'fixed consumer mapping on another element',
      renderer: {
        schemaVersion: 1,
        elements: { p: { attributes: { 'x-data': 'h1' } } },
        consumerContract: 'besh.fixed-heading-id.v1',
      },
    },
    {
      label: 'overriding a saved validated link destination',
      renderer: {
        schemaVersion: 1,
        elements: { a: { attributes: { href: 'javascript:alert(1)' } } },
      },
    },
    {
      label: 'unsupported element',
      renderer: { schemaVersion: 1, elements: { script: {} } },
    },
    {
      label: 'executable attribute',
      renderer: {
        schemaVersion: 1,
        elements: { p: { attributes: { onclick: 'alert(1)' } } },
      },
    },
    {
      label: 'class token containing whitespace',
      renderer: {
        schemaVersion: 1,
        elements: { p: { classes: ['article extra'] } },
      },
    },
    {
      label: 'ninth class token',
      renderer: {
        schemaVersion: 1,
        elements: { p: { classes: [...classes, 'extra'] } },
      },
    },
    {
      label: '65-byte class token',
      renderer: {
        schemaVersion: 1,
        elements: { p: { classes: ['a'.repeat(65)] } },
      },
    },
    {
      label: '161-byte attribute value',
      renderer: {
        schemaVersion: 1,
        elements: { p: { attributes: { title: 't'.repeat(161) } } },
      },
    },
    {
      label: 'attribute exceeding UTF-8 bound with fewer than 160 characters',
      renderer: {
        schemaVersion: 1,
        elements: { p: { attributes: { title: 'ก'.repeat(54) } } },
      },
    },
    {
      label: '1025-byte reviewed configuration',
      renderer: {
        ...boundedRenderer,
        elements: {
          ...boundedRenderer.elements,
          hr: { attributes: { title: 'x'.repeat(44) } },
        },
      },
    },
  ]

  for (const { label, renderer } of invalidRenderers) {
    const response = await preview(renderer)
    expect({ label, status: response.status }).toEqual({ label, status: 400 })

    const rejected = await response.json()
    expect(rejected.error).toEqual(expect.any(String))
    expect(rejected.html).toBeUndefined()
    await expectSavedState()
  }

  const overflowDocument = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: 126 }, () => ({
          type: 'text',
          text: '&1234567',
          marks: ['bold', 'italic', 'underline', 'strikethrough'],
        })),
      },
    ],
  }
  expect(
    Buffer.byteLength(JSON.stringify({ body: overflowDocument }), 'utf8'),
  ).toBe(11178)

  const overflowCreatedResponse = await request(
    collectionPath + '/entries',
    'POST',
    { data: { body: overflowDocument } },
  )
  expect(overflowCreatedResponse.status).toBe(200)

  const overflowCreated = await overflowCreatedResponse.json()
  const overflowPath = collectionPath + '/entries/' + overflowCreated.id
  const savedOverflow = await get(overflowPath)
  expect(savedOverflow).toEqual(overflowCreated)
  expect(savedOverflow.data).toEqual({ body: overflowDocument })

  const beforeOverflowAudit = await get('/api/audit')
  const overflowRenderer = {
    schemaVersion: 1,
    elements: {
      strong: { attributes: { title: '&'.repeat(160) } },
      em: { attributes: { title: '&'.repeat(160) } },
      u: { attributes: { title: '&'.repeat(160) } },
      s: { attributes: { title: '&'.repeat(160) } },
    },
  }
  expect(Buffer.byteLength(JSON.stringify(overflowRenderer), 'utf8')).toBe(806)

  const smallResponse = await preview(overflowRenderer)
  expect(smallResponse.status).toBe(200)
  expect((await smallResponse.json()).html).toBe('<p>Bounded &amp; literal</p>')

  // Independent count: 126 leaves * 3288 HTML bytes + seven paragraph bytes.
  // The public save above establishes this valid input before checking overflow.
  const overflowResponse = await request(
    overflowPath + '/render-preview',
    'POST',
    {
      entryVersion: savedOverflow.version,
      fieldKey: 'body',
      renderer: overflowRenderer,
    },
  )
  expect(overflowResponse.status).toBe(400)
  expect(await overflowResponse.json()).toEqual({
    error: 'Rendered HTML exceeds its preview limit',
  })

  expect(await get(overflowPath)).toEqual(savedOverflow)
  expect(await get(entryPath)).toEqual(savedEntry)
  expect(await get(collectionPath)).toEqual(savedCollection)
  expect(await get('/api/audit')).toEqual(beforeOverflowAudit)
})
