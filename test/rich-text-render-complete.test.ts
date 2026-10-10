import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-render-complete-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-rich-text-render-complete-tracer-'
let directory: string
let server: ReturnType<typeof createApp>

function text(text: string, marks: string[] = []) {
  return { type: 'text', text, marks }
}

function paragraph(value: string) {
  return { type: 'paragraph', children: [text(value)] }
}

export const formattedDocument = {
  type: 'document',
  astVersion: 2,
  children: [
    { type: 'heading', level: 1, children: [text('Complete & literal')] },
    { type: 'heading', level: 2, children: [text('Section two')] },
    { type: 'heading', level: 3, children: [text('Section three')] },
    { type: 'heading', level: 4, children: [text('Section four')] },
    { type: 'heading', level: 5, children: [text('Section five')] },
    { type: 'heading', level: 6, children: [text('Section six')] },
    {
      type: 'paragraph',
      children: [
        text('Authored <order> & ไทย', [
          'underline',
          'bold',
          'code',
          'italic',
          'strikethrough',
        ]),
        { type: 'lineBreak' },
        {
          type: 'link',
          url: 'https://example.com/docs?left=1&right=%22literal%22#section',
          children: [text('Read <guide> & ไทย'), text(' now', ['bold'])],
        },
      ],
    },
    {
      type: 'list',
      ordered: true,
      start: 3,
      children: [
        {
          type: 'listItem',
          children: [
            paragraph('First & <one>'),
            {
              type: 'list',
              ordered: false,
              start: 1,
              children: [
                {
                  type: 'listItem',
                  children: [paragraph('Nested bullet')],
                },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          children: [paragraph('Second'), paragraph('Same item continuation')],
        },
      ],
    },
    {
      type: 'list',
      ordered: false,
      start: 1,
      children: [
        {
          type: 'listItem',
          children: [
            paragraph('Bullet parent'),
            {
              type: 'list',
              ordered: true,
              start: 7,
              children: [
                {
                  type: 'listItem',
                  children: [paragraph('Nested ordered')],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'table',
      children: [
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              header: true,
              children: [paragraph('Name')],
            },
            {
              type: 'tableCell',
              header: true,
              children: [paragraph('Value & units')],
            },
          ],
        },
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              header: false,
              children: [paragraph('Ada')],
            },
            {
              type: 'tableCell',
              header: false,
              children: [paragraph('0 < 1')],
            },
          ],
        },
      ],
    },
    {
      type: 'quote',
      children: [
        {
          type: 'paragraph',
          children: [
            text('Quoted <truth>'),
            { type: 'lineBreak' },
            text('Second & line'),
          ],
        },
      ],
    },
    {
      type: 'code',
      language: 'plaintext',
      text: '  <script>literal</script>\r\n\r\n$input.body & $data $auth  ',
    },
    {
      type: 'code',
      language: 'javascript',
      text: 'throw 73\r\n<script>never run</script> & ไทย',
    },
    { type: 'horizontalRule' },
    paragraph(''),
  ],
}

// Literal output contract, authored independently of any renderer implementation.
export const expectedHtml = [
  '<h1 class="text-heading-1" x-data="h1">Complete &amp; literal</h1>',
  '<h2>Section two</h2><h3>Section three</h3><h4>Section four</h4>',
  '<h5>Section five</h5><h6>Section six</h6>',
  '<p><u><strong><code><em><s>Authored &lt;order&gt; &amp; ไทย</s></em></code></strong></u><br>',
  '<a href="https://example.com/docs?left=1&amp;right=%22literal%22#section">Read &lt;guide&gt; &amp; ไทย<strong> now</strong></a></p>',
  '<ol start="3"><li><p>First &amp; &lt;one&gt;</p><ul><li><p>Nested bullet</p></li></ul></li>',
  '<li><p>Second</p><p>Same item continuation</p></li></ol>',
  '<ul><li><p>Bullet parent</p><ol start="7"><li><p>Nested ordered</p></li></ol></li></ul>',
  '<table><tbody><tr><th><p>Name</p></th><th><p>Value &amp; units</p></th></tr>',
  '<tr><td><p>Ada</p></td><td><p>0 &lt; 1</p></td></tr></tbody></table>',
  '<blockquote><p>Quoted &lt;truth&gt;<br>Second &amp; line</p></blockquote>',
  '<pre><code>  &lt;script&gt;literal&lt;/script&gt;\r\n\r\n$input.body &amp; $data $auth  </code></pre>',
  '<pre><code>throw 73\r\n&lt;script&gt;never run&lt;/script&gt; &amp; ไทย</code></pre>',
  '<hr><p></p>',
].join('')

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

async function contentAudit() {
  const response = await request('/api/audit')
  expect(response.status).toBe(200)

  const events: { action: string }[] = await response.json()

  // Existing authentication metadata effects remain outside this content check.
  return events.filter(
    (event) =>
      event.action.startsWith('entry.') ||
      event.action.startsWith('collection.') ||
      event.action.startsWith('struct.'),
  )
}

test('owner previews the complete saved formatted document without content effects', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Complete formatted articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.fields).toEqual(fields)
  expect(model.version).toBe(1)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private complete articles',
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

  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', {
    data: { body: formattedDocument },
  })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.collectionId).toBe(collection.id)
  expect(created.version).toBe(1)
  expect(created.data).toEqual({ body: formattedDocument })

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

  const canonicalRenderer =
    '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"x-data":"h1"},"classes":["text-heading-1"]}},"schemaVersion":1}'
  const rendererSha256 = createHash('sha256')
    .update(canonicalRenderer, 'utf8')
    .digest('hex')

  const renderedResponse = await request(
    entryPath + '/render-preview',
    'POST',
    { entryVersion: 1, fieldKey: 'body', renderer },
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
  expect(await contentAudit()).toEqual(beforeAudit)
})
