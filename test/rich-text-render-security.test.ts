import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-security-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-security-'
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

test('owner renders transient defaults and quoted attributes while rejecting caller AST without saved effects', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Literal preview articles',
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
    name: 'Private literal preview articles',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: '  Saved <script>literal</script> & ไทย  ',
            marks: [],
          },
        ],
      },
    ],
  }
  const collectionPath = '/api/collections/' + collection.id
  const createdResponse = await request(collectionPath + '/entries', 'POST', {
    data: { body: document },
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.data).toEqual({ body: document })

  const entryPath = collectionPath + '/entries/' + created.id
  const savedEntry = await get(entryPath)
  const savedCollection = await get(collectionPath)
  const savedAudit = await get('/api/audit')

  async function expectSavedState() {
    expect(await get(entryPath)).toEqual(savedEntry)
    expect(await get(collectionPath)).toEqual(savedCollection)

    // Owner bearer requests compare the complete audit, without action filters.
    expect(await get('/api/audit')).toEqual(savedAudit)
  }

  const identities = {
    collectionId: collection.id,
    collectionVersion: savedCollection.version,
    structId: savedCollection.struct.id,
    structVersion: savedCollection.struct.version,
    entryId: created.id,
    entryVersion: savedEntry.version,
    fieldKey: 'body',
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
    consumerContract: null,
  }
  const previewPath = entryPath + '/render-preview'
  const defaultRenderer = { schemaVersion: 1, elements: {} }
  const defaultHtml =
    '<p>  Saved &lt;script&gt;literal&lt;/script&gt; &amp; ไทย  </p>'
  const defaultResponse = await request(previewPath, 'POST', {
    entryVersion: savedEntry.version,
    fieldKey: 'body',
    renderer: defaultRenderer,
  })
  expect(defaultResponse.status).toBe(200)
  expect(await defaultResponse.json()).toMatchObject({
    ...identities,
    html: defaultHtml,
  })
  await expectSavedState()

  const mappedResponse = await request(previewPath, 'POST', {
    entryVersion: savedEntry.version,
    fieldKey: 'body',
    renderer: {
      schemaVersion: 1,
      elements: {
        p: {
          attributes: {
            title: "\"><img src=x onerror=alert(1)> & '<saved>'",
            'aria-label': 'Body "ไทย" & <saved>',
          },
        },
      },
    },
  })
  expect(mappedResponse.status).toBe(200)
  expect(await mappedResponse.json()).toMatchObject({
    ...identities,
    html: '<p aria-label="Body &quot;ไทย&quot; &amp; &lt;saved&gt;" title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &amp; &#39;&lt;saved&gt;&#39;">  Saved &lt;script&gt;literal&lt;/script&gt; &amp; ไทย  </p>',
  })
  await expectSavedState()

  const rejectedResponse = await request(previewPath, 'POST', {
    entryVersion: savedEntry.version,
    fieldKey: 'body',
    renderer: defaultRenderer,
    ast: {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Caller replacement', marks: [] }],
        },
      ],
    },
  })
  expect(rejectedResponse.status).toBe(400)

  const rejected = await rejectedResponse.json()
  expect(rejected.error).toEqual(expect.any(String))
  expect(rejected.html).toBeUndefined()
  await expectSavedState()

  const restoredDefaultResponse = await request(previewPath, 'POST', {
    entryVersion: savedEntry.version,
    fieldKey: 'body',
    renderer: defaultRenderer,
  })
  expect(restoredDefaultResponse.status).toBe(200)
  expect(await restoredDefaultResponse.json()).toMatchObject({
    ...identities,
    html: defaultHtml,
  })
  await expectSavedState()
})
