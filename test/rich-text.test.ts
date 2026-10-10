import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'rich-text-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-rich-text-tracer-'))
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
  expect(basename(target).startsWith('besh-rich-text-tracer-')).toBe(true)

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

test('private content preserves versioned rich-text objects under its frozen model', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Article body',
      required: true,
      schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const body = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '  <script>alert(1)</script> & ไทย  ' },
          { type: 'text', text: '' },
        ],
      },
    ],
  }
  const createdResponse = await request(
    '/api/collections/' + collection.id + '/entries',
    'POST',
    {
      data: { body },
    },
  )
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })
  expect(created.version).toBe(1)

  const changedResponse = await request('/api/structs/' + model.id, 'PUT', {
    name: 'Changed articles',
    version: 1,
    fields: [
      {
        key: 'title',
        label: 'Title',
        required: true,
        schema: { type: 'text' },
      },
    ],
  })
  expect(changedResponse.status).toBe(200)

  const detailResponse = await request(
    '/api/collections/' + collection.id + '/entries/' + created.id,
  )
  expect(detailResponse.status).toBe(200)
  expect(await detailResponse.json()).toEqual(created)

  const frozenResponse = await request('/api/collections/' + collection.id)
  expect(frozenResponse.status).toBe(200)
  expect((await frozenResponse.json()).struct.fields).toEqual(fields)
})

test('paragraph rich text rejects unknown content without changing the saved entry', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Articles',
    fields: [
      {
        key: 'body',
        label: 'Article body',
        required: true,
        schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const entries = '/api/collections/' + collection.id + '/entries'
  const body = { type: 'document', astVersion: 1, children: [] }
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)

  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })
  const detail = entries + '/' + created.id
  const invalid = [
    null,
    '',
    { type: 'document', children: [] },
    { type: 'document', astVersion: 2, children: [] },
    {
      type: 'document',
      astVersion: 1,
      children: [],
      html: '<h1>Injected</h1>',
    },
    {
      type: 'document',
      astVersion: 1,
      children: [{ type: 'heading', children: [] }],
    },
    {
      type: 'document',
      astVersion: 1,
      children: [{ type: 'text', text: 'Wrong placement' }],
    },
    {
      type: 'document',
      astVersion: 1,
      children: [
        {
          type: 'paragraph',
          children: [],
          attributes: { onclick: 'alert(1)' },
        },
      ],
    },
    {
      type: 'document',
      astVersion: 1,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Literal', marks: ['bold'] }],
        },
      ],
    },
    {
      type: 'document',
      astVersion: 1,
      children: [{ type: 'paragraph', children: [{ type: 'text', text: 0 }] }],
    },
  ]

  for (const value of invalid) {
    const response = await request(detail, 'PUT', {
      version: 1,
      data: { body: value },
    })
    expect(response.status).toBe(400)

    const saved = await request(detail)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual(created)
  }

  const missing = await request(detail, 'PUT', { version: 1, data: {} })
  expect(missing.status).toBe(400)

  const emptyParagraph = await request(detail, 'PUT', {
    version: 1,
    data: {
      body: {
        type: 'document',
        astVersion: 1,
        children: [{ type: 'paragraph', children: [] }],
      },
    },
  })
  expect(emptyParagraph.status).toBe(200)
  const savedParagraph = await emptyParagraph.json()
  expect(savedParagraph.version).toBe(2)
  expect(savedParagraph.data).toEqual({
    body: {
      type: 'document',
      astVersion: 1,
      children: [{ type: 'paragraph', children: [] }],
    },
  })
})

test('paragraph models and documents keep explicit placement and work limits', async () => {
  const richText = { type: 'richText', schemaVersion: 1, astVersion: 1 }
  const field = {
    key: 'body',
    label: 'Article body',
    required: true,
    schema: richText,
  }
  const invalidFields = [
    { ...field, schema: { type: 'richText', schemaVersion: 1 } },
    { ...field, schema: { type: 'richText', schemaVersion: 2, astVersion: 1 } },
    { ...field, schema: { ...richText, renderer: 'html' } },
    {
      key: 'group',
      label: 'Group',
      required: true,
      schema: { type: 'object', fields: [field] },
    },
    {
      key: 'list',
      label: 'List',
      required: true,
      schema: { type: 'array', items: richText },
    },
  ]

  for (const value of invalidFields) {
    const response = await request('/api/structs', 'POST', {
      name: 'Rejected model',
      fields: [value],
    })
    expect(response.status).toBe(400)
  }

  const emptyCatalog = await request('/api/structs')
  expect(emptyCatalog.status).toBe(200)
  expect(await emptyCatalog.json()).toEqual([])

  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Articles',
    fields: [field],
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const entries = '/api/collections/' + collection.id + '/entries'

  const exactNodeLimit = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: 126 }, () => ({
          type: 'text',
          text: '',
        })),
      },
    ],
  }
  const accepted = await request(entries, 'POST', {
    data: { body: exactNodeLimit },
  })
  expect(accepted.status).toBe(200)
  expect((await accepted.json()).data).toEqual({ body: exactNodeLimit })

  const excessNode = await request(entries, 'POST', {
    data: {
      body: {
        type: 'document',
        astVersion: 1,
        children: [
          {
            type: 'paragraph',
            children: Array.from({ length: 127 }, () => ({
              type: 'text',
              text: '',
            })),
          },
        ],
      },
    },
  })
  expect(excessNode.status).toBe(400)

  const unicodeLimit = 'ก'.repeat(1365) + 'a'
  const exactText = {
    type: 'document',
    astVersion: 1,
    children: [
      { type: 'paragraph', children: [{ type: 'text', text: unicodeLimit }] },
    ],
  }
  const textAccepted = await request(entries, 'POST', {
    data: { body: exactText },
  })
  expect(textAccepted.status).toBe(200)
  expect((await textAccepted.json()).data).toEqual({ body: exactText })

  const textRejected = await request(entries, 'POST', {
    data: {
      body: {
        type: 'document',
        astVersion: 1,
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: unicodeLimit + 'b' }],
          },
        ],
      },
    },
  })
  expect(textRejected.status).toBe(400)

  const catalog = await request(entries)
  expect(catalog.status).toBe(200)
  expect((await catalog.json()).total).toBe(2)
})

test('versioned paragraph content survives restart and a downloaded workspace backup', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Articles',
    fields: [
      {
        key: 'body',
        label: 'Article body',
        required: true,
        schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', {
    data: { body: { type: 'document', astVersion: 1, children: [] } },
  })
  expect(createdResponse.status).toBe(200)
  const initial = await createdResponse.json()

  const body = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '  Saved <script>literal</script> & ไทย  ' },
          { type: 'text', text: '' },
        ],
      },
    ],
  }
  const detail = entries + '/' + initial.id
  const editedResponse = await request(detail, 'PUT', {
    version: 1,
    data: { body },
  })
  expect(editedResponse.status).toBe(200)
  const saved = await editedResponse.json()
  expect(saved.version).toBe(2)
  expect(saved.data).toEqual({ body })

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  const restarted = await request(detail)
  expect(restarted.status).toBe(200)
  expect(await restarted.json()).toEqual(saved)

  const restoredDirectory = join(directory, 'restored')
  mkdirSync(restoredDirectory)
  writeFileSync(join(restoredDirectory, 'control.sqlite'), bytes)
  const restored = createApp({
    databasePath: join(restoredDirectory, 'control.sqlite'),
    backupDir: join(restoredDirectory, 'backups'),
    adminToken: owner,
  })

  try {
    for (const [route, expected] of [
      ['/api/structs/' + model.id, model],
      ['/api/collections/' + collection.id, collection],
      [detail, saved],
    ] as const) {
      const response = await restored.app.handle(
        new Request(origin + route, {
          headers: { authorization: 'Bearer ' + owner },
        }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  } finally {
    await restored.close()
  }
})

test('nested formatted content preserves reviewed headings and text marks as objects', async () => {
  const fields = [
    {
      key: 'article',
      label: 'Article',
      required: true,
      schema: {
        type: 'object',
        fields: [
          {
            key: 'body',
            label: 'Body',
            required: true,
            schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
          },
        ],
      },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Formatted articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Formatted private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const body = {
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
            marks: ['bold', 'italic'],
          },
          { type: 'text', text: 'Underline', marks: ['underline'] },
          { type: 'text', text: 'Crossed out', marks: ['strikethrough'] },
          { type: 'text', text: 'Inline code', marks: ['code'] },
          { type: 'text', text: '', marks: [] },
        ],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Plain paragraph', marks: [] }],
      },
    ],
  }
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', {
    data: { article: { body } },
  })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(created.data).toEqual({ article: { body } })
  expect(created.version).toBe(1)

  const detail = await request(entries + '/' + created.id)
  expect(detail.status).toBe(200)
  expect(await detail.json()).toEqual(created)
})

test('formatted articles preserve safe links and ordered or nested bullet lists', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Linked articles',
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
    name: 'Linked private articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Read ', marks: [] },
          {
            type: 'link',
            url: 'https://example.com/articles?topic=api#intro',
            children: [{ type: 'text', text: 'our guide', marks: ['bold'] }],
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
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Create an API', marks: [] }],
              },
              {
                type: 'list',
                ordered: false,
                start: 1,
                children: [
                  {
                    type: 'listItem',
                    children: [
                      {
                        type: 'paragraph',
                        children: [
                          { type: 'text', text: 'Test first', marks: [] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })

  const detail = await request(entries + '/' + created.id)
  expect(detail.status).toBe(200)
  expect((await detail.json()).data).toEqual({ body })
})

test('formatted articles store rectangular comparison tables as typed content', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Comparison articles',
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
    name: 'Private comparisons',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                header: true,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Plan', marks: ['bold'] }],
                  },
                ],
              },
              {
                type: 'tableCell',
                header: true,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Price', marks: [] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Local', marks: [] }],
                  },
                ],
              },
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: '<free>', marks: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })
  const detail = await request(entries + '/' + created.id)
  expect(detail.status).toBe(200)
  expect((await detail.json()).data).toEqual({ body })
})

async function formattedEntries(name: string) {
  const modelResponse = await request('/api/structs', 'POST', {
    name,
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
    name,
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  return '/api/collections/' + collection.id + '/entries'
}

test('formatted articles preserve quoted author notes and explicit line breaks', async () => {
  const entries = await formattedEntries('Quoted articles')
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'quote',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'First line', marks: ['italic'] },
              { type: 'lineBreak' },
              { type: 'text', text: 'Second line', marks: [] },
            ],
          },
        ],
      },
    ],
  }
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })
  const detail = await request(entries + '/' + created.id)
  expect(detail.status).toBe(200)
  expect((await detail.json()).data).toEqual({ body })
})

test('formatted articles retain literal code examples and section separators', async () => {
  const entries = await formattedEntries('Code articles')
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      { type: 'horizontalRule' },
      {
        type: 'code',
        language: 'javascript',
        text: 'const example = "<script>literal</script>"\n\nconsole.log(example)',
      },
      { type: 'code', language: 'plaintext', text: '' },
    ],
  }
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(created.data).toEqual({ body })
  const detail = await request(entries + '/' + created.id)
  expect(detail.status).toBe(200)
  expect((await detail.json()).data).toEqual({ body })
})

test('invalid formatted content cannot change the saved article or its audit history', async () => {
  const entries = await formattedEntries('Strict formatted articles')
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Saved', marks: [] }],
      },
    ],
  }
  const createdResponse = await request(entries, 'POST', { data: { body } })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  const detail = entries + '/' + created.id
  const beforeAudit = await (await request('/api/audit')).json()
  const text = { type: 'text', text: 'Literal', marks: [] }
  const paragraph = { type: 'paragraph', children: [text] }
  const cell = { type: 'tableCell', header: false, children: [paragraph] }
  const invalidBlocks: unknown[] = [
    { type: 'html', html: '<script>alert(1)</script>' },
    { type: 'heading', level: 7, children: [text] },
    {
      type: 'heading',
      level: 1,
      children: [text],
      attributes: { 'x-data': 'h1' },
    },
    { type: 'paragraph', children: [{ type: 'text', text: 'Missing marks' }] },
    { type: 'paragraph', children: [{ ...text, marks: ['bold', 'bold'] }] },
    { type: 'paragraph', children: [{ ...text, marks: ['superscript'] }] },
    { type: 'paragraph', children: [{ ...text, style: 'color:red' }] },
    { type: 'list', ordered: false, start: 3, children: [] },
    { type: 'list', ordered: true, start: 0, children: [] },
    { type: 'listItem', children: [paragraph] },
    { type: 'quote', children: [{ type: 'quote', children: [paragraph] }] },
    { type: 'quote', children: [] },
    { type: 'table', children: [] },
    {
      type: 'table',
      children: [
        { type: 'tableRow', children: [cell] },
        { type: 'tableRow', children: [cell, cell] },
      ],
    },
    {
      type: 'table',
      children: [{ type: 'tableRow', children: [{ ...cell, colspan: 2 }] }],
    },
    { type: 'code', language: 'unreviewed', text: 'Saved' },
    { type: 'code', language: 'javascript', text: 'a'.repeat(4097) },
    { type: 'horizontalRule', attributes: { onclick: 'alert(1)' } },
    { type: 'lineBreak' },
  ]
  const unsafeUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.com/',
    '//example.com/',
    '/articles',
    'https://user:password@example.com/',
    'https://example.com/%00',
    'https://example.com/%5cattack',
    'https://example.com/\\attack',
    'https://example.com/\nattack',
    'https://example.com/' + 'a'.repeat(2048),
  ]
  for (const url of unsafeUrls)
    invalidBlocks.push({
      type: 'paragraph',
      children: [{ type: 'link', url, children: [text] }],
    })

  const invalidDocuments = [
    { ...body, astVersion: 1 },
    { ...body, astVersion: '2' },
    { ...body, html: '<h1>Saved</h1>' },
    ...invalidBlocks.map((block) => ({ ...body, children: [block] })),
    {
      ...body,
      children: [
        {
          type: 'paragraph',
          children: Array.from({ length: 127 }, () => text),
        },
      ],
    },
    {
      ...body,
      children: [
        {
          type: 'paragraph',
          children: Array.from({ length: 126 }, () => ({
            ...text,
            marks: ['bold', 'italic', 'underline', 'strikethrough', 'code'],
          })),
        },
      ],
    },
    {
      ...body,
      children: [
        {
          type: 'paragraph',
          children: Array.from({ length: 4 }, () => ({
            ...text,
            text: 'a'.repeat(4096),
          })),
        },
      ],
    },
  ]

  for (const invalid of invalidDocuments) {
    const response = await request(detail, 'PUT', {
      version: 1,
      data: { body: invalid },
    })
    expect(response.status).toBe(400)
  }

  const read = await request(detail)
  expect(read.status).toBe(200)
  expect(await read.json()).toEqual(created)
  expect(await (await request('/api/audit')).json()).toEqual(beforeAudit)
})

test('nested formatted articles survive restart and actual downloaded backup restoration', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Nested formatted backup',
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
                schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
              },
            ],
          },
        },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Nested formatted backup',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                header: true,
                children: [
                  {
                    type: 'paragraph',
                    children: [
                      {
                        type: 'link',
                        url: 'https://example.com/guide',
                        children: [
                          {
                            type: 'text',
                            text: '  Guide & ไทย  ',
                            marks: ['italic', 'bold'],
                          },
                        ],
                      },
                    ],
                  },
                ],
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
              { type: 'lineBreak' },
              { type: 'text', text: '', marks: [] },
            ],
          },
        ],
      },
      { type: 'code', language: 'plaintext', text: '  <h1>Literal</h1>\n\n  ' },
      { type: 'horizontalRule' },
    ],
  }
  const createdResponse = await request(
    '/api/collections/' + collection.id + '/entries',
    'POST',
    {
      data: { sections: [{ body }] },
    },
  )
  expect(createdResponse.status).toBe(200)
  const saved = await createdResponse.json()
  expect(saved.data).toEqual({ sections: [{ body }] })
  const detail = '/api/collections/' + collection.id + '/entries/' + saved.id

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  expect(await (await request(detail)).json()).toEqual(saved)

  const restoredDirectory = join(directory, 'formatted-restored')
  mkdirSync(restoredDirectory)
  writeFileSync(join(restoredDirectory, 'control.sqlite'), bytes)
  const restored = createApp({
    databasePath: join(restoredDirectory, 'control.sqlite'),
    backupDir: join(restoredDirectory, 'backups'),
    adminToken: owner,
  })

  try {
    for (const [route, expected] of [
      ['/api/structs/' + model.id, model],
      ['/api/collections/' + collection.id, collection],
      [detail, saved],
    ] as const) {
      const response = await restored.app.handle(
        new Request(origin + route, {
          headers: { authorization: 'Bearer ' + owner },
        }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  } finally {
    await restored.close()
  }
})

test('formatted content keeps exact work limits at the deepest allowed model field', async () => {
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: 126 }, () => ({
          type: 'text',
          text: '',
          marks: [],
        })),
      },
    ],
  }
  let schema: unknown = { type: 'richText', schemaVersion: 2, astVersion: 2 }
  let value: unknown = body
  for (let index = 4; index >= 0; index--) {
    const key = 'level' + index
    schema = {
      type: 'object',
      fields: [{ key, label: key, required: true, schema }],
    }
    value = { [key]: value }
  }
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Maximum formatted nesting',
    fields: [{ key: 'body', label: 'Body', required: true, schema }],
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Maximum formatted nesting',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const entries = '/api/collections/' + collection.id + '/entries'
  const createdResponse = await request(entries, 'POST', {
    data: { body: value },
  })
  expect(createdResponse.status).toBe(200)
  expect((await createdResponse.json()).data).toEqual({ body: value })

  const overdeepModel = await request('/api/structs', 'POST', {
    name: 'Excess nesting',
    fields: [
      {
        key: 'body',
        label: 'Body',
        required: true,
        schema: {
          type: 'object',
          fields: [{ key: 'extra', label: 'Extra', required: true, schema }],
        },
      },
    ],
  })
  expect(overdeepModel.status).toBe(400)

  let deepList: unknown = {
    type: 'paragraph',
    children: [{ type: 'text', text: 'Too deep', marks: [] }],
  }
  for (let index = 0; index < 3; index++)
    deepList = {
      type: 'list',
      ordered: false,
      start: 1,
      children: [
        {
          type: 'listItem',
          children: [{ type: 'paragraph', children: [] }, deepList],
        },
      ],
    }
  let invalidValue: unknown = {
    type: 'document',
    astVersion: 2,
    children: [deepList],
  }
  for (let index = 4; index >= 0; index--)
    invalidValue = { ['level' + index]: invalidValue }
  const overdeepContent = await request(entries, 'POST', {
    data: { body: invalidValue },
  })
  expect(overdeepContent.status).toBe(400)

  const unchanged = await request(entries)
  expect(unchanged.status).toBe(200)
  expect((await unchanged.json()).total).toBe(1)
})
