import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

// Unused proposal. Imports target test/ when root adopts the first public RED.
const owner = 'cms-graphql-tracer-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-cms-graphql-tracer-'
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
  if (server.app.server) await server.app.stop(true)
  await server.close()

  const target = resolve(directory)
  const parent = resolve(tmpdir())

  expect(target.toLowerCase().startsWith((parent + sep).toLowerCase())).toBe(
    true,
  )
  expect(basename(target).startsWith(temporaryPrefix)).toBe(true)

  rmSync(target, { recursive: true, force: true })
})

function request(path: string, method = 'GET', body?: unknown, token = owner) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function saved(path: string) {
  const response = await request(path)
  expect(response.status).toBe(200)

  return response.json()
}

async function publishDocument(
  document: unknown,
  astVersion: 1 | 2,
  path: string,
  transport: 'rest' | 'graphql' = 'graphql',
) {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Typed projection model',
    fields: [
      {
        key: astVersion === 1 ? 'body' : 'sections',
        label: astVersion === 1 ? 'Body' : 'Sections',
        required: true,
        schema:
          astVersion === 1
            ? { type: 'richText', schemaVersion: 1, astVersion: 1 }
            : {
                type: 'array',
                items: {
                  type: 'richText',
                  schemaVersion: astVersion,
                  astVersion,
                },
              },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Typed projection collection',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const collectionPath = '/api/collections/' + collection.id
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data: astVersion === 1 ? { body: document } : { sections: [document] },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  const entryPath = collectionPath + '/entries/' + entry.id
  const creation = await request(
    entryPath + '/snapshot-flow' + (transport === 'graphql' ? '/graphql' : ''),
    'POST',
    {
      name: 'Typed projection snapshot',
      path,
      collectionVersion: 1,
      entryVersion: 1,
      rendererVersion: 0,
      fieldPath: astVersion === 1 ? ['body'] : ['sections', 0],
    },
  )
  expect(creation.status).toBe(200)

  const flow = await creation.json()
  expect(
    (
      await request('/api/flows/' + flow.id + '/publish', 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)

  const keyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Typed projection query',
    flowId: flow.id,
    permissions: [transport === 'graphql' ? 'query' : 'rest'],
    releaseRevision: 1,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(keyResponse.status).toBe(200)

  const key = await keyResponse.json()

  async function query(query: string, variables?: Record<string, unknown>) {
    const response = await request(
      '/graphql' + path,
      'POST',
      {
        query,
        ...(variables ? { variables } : {}),
      },
      key.token,
    )
    expect(response.status).toBe(200)

    return response.json()
  }

  return { flow, key, query, collectionPath, entryPath }
}

test('owner publishes a sealed typed GraphQL snapshot of reviewed saved content', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Article body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'GraphQL snapshot articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private GraphQL articles',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  expect(collection.struct).toEqual({
    id: model.id,
    version: model.version,
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
            text: '  <script>literal</script> & ไทย $input.body.secret  ',
            marks: ['italic', 'bold'],
          },
        ],
      },
    ],
  }
  const collectionPath = '/api/collections/' + collection.id
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data: { body: document },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.data).toEqual({ body: document })

  const renderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['article-heading'],
        attributes: { title: 'Reviewed <heading> & ไทย' },
      },
    },
  }
  const rendererResponse = await request(collectionPath + '/renderer', 'PUT', {
    version: 0,
    renderer,
  })
  expect(rendererResponse.status).toBe(200)

  const savedRenderer = await rendererResponse.json()
  expect(savedRenderer.version).toBe(1)
  expect(savedRenderer.renderer).toEqual(renderer)

  // Protocol selection belongs to the route; no caller SDL, AST or HTML is sent.
  const response = await request(
    collectionPath + '/entries/' + entry.id + '/snapshot-flow/graphql',
    'POST',
    {
      name: 'Reviewed GraphQL article',
      path: '/reviewed-graphql-article',
      collectionVersion: collection.version,
      entryVersion: entry.version,
      rendererVersion: savedRenderer.version,
      fieldPath: ['body'],
    },
  )
  expect(response.status).toBe(200)

  const draft = await response.json()
  expect(draft.id).toEqual(expect.any(String))
  expect(draft.revision).toBe(1)
  expect(draft.publishedRevision).toBeNull()
  expect(draft.publishedEndpoint).toBeNull()
  expect(draft.name).toBe('Reviewed GraphQL article')
  expect(draft.method).toBe('POST')
  expect(draft.path).toBe('/reviewed-graphql-article')
  expect(draft.graphql.schema).toEqual(expect.any(String))
  expect(draft.nodes.map((node: { type: string }) => node.type)).toEqual([
    'request',
    'cmsSnapshotResponse',
  ])

  const terminal = draft.nodes[1]
  expect(Object.keys(terminal.config).sort()).toEqual([
    'snapshotId',
    'snapshotSha256',
  ])
  expect(terminal.config.snapshotId).toMatch(/^[A-Za-z0-9_-]{1,80}$/)
  expect(terminal.config.snapshotSha256).toMatch(/^[a-f0-9]{64}$/)

  const flowPath = '/api/flows/' + draft.id
  const publication = await request(flowPath + '/publish', 'POST', {
    revision: 1,
  })
  expect(publication.status).toBe(200)
  expect(await publication.json()).toEqual({
    ...draft,
    publishedRevision: 1,
    publishedEndpoint: {
      method: 'POST',
      path: '/reviewed-graphql-article',
      graphql: true,
      transport: 'graphql',
    },
  })

  const keyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Reviewed article query',
    flowId: draft.id,
    permissions: ['query'],
    releaseRevision: 1,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(keyResponse.status).toBe(200)

  const key = await keyResponse.json()
  expect(key.releaseRevision).toBe(1)
  expect(key.issuerBinding).toEqual({
    memberId: 'owner',
    action: 'runtime-keys.manage',
  })

  const query = `query ReviewedArticle($withHtml: Boolean!) {
    article: contentSnapshot {
      document {
        type
        astVersion
        children {
          __typename
          ...HeadingFields
        }
      }
      html @include(if: $withHtml)
      provenance {
        collectionId
        entryId
        entryVersion
        rendererVersion
        snapshotSha256
        releaseRevision
      }
    }
  }

  fragment HeadingFields on CmsHeading {
    type
    level
    children {
      ... on CmsText { type text marks }
    }
  }`
  const operation = {
    query,
    operationName: 'ReviewedArticle',
    variables: { withHtml: true },
  }
  const endpoint = '/graphql/reviewed-graphql-article'
  const reply = await request(endpoint, 'POST', operation, key.token)
  expect(reply.status).toBe(200)
  expect(reply.headers.get('content-type')).toBe(
    'application/graphql-response+json',
  )
  expect(await reply.json()).toEqual({
    data: {
      article: {
        document: {
          type: 'document',
          astVersion: 2,
          children: [
            {
              __typename: 'CmsHeading',
              type: 'heading',
              level: 1,
              children: [
                {
                  type: 'text',
                  text: '  <script>literal</script> & ไทย $input.body.secret  ',
                  marks: ['italic', 'bold'],
                },
              ],
            },
          ],
        },
        html: '<h1 class="article-heading" title="Reviewed &lt;heading&gt; &amp; ไทย"><em><strong>  &lt;script&gt;literal&lt;/script&gt; &amp; ไทย $input.body.secret  </strong></em></h1>',
        provenance: {
          collectionId: collection.id,
          entryId: entry.id,
          entryVersion: '1',
          rendererVersion: '1',
          snapshotSha256: terminal.config.snapshotSha256,
          releaseRevision: '1',
        },
      },
    },
  })

  const withoutHtml = await request(
    endpoint,
    'POST',
    { ...operation, variables: { withHtml: false } },
    key.token,
  )
  expect(withoutHtml.status).toBe(200)
  const selected = await withoutHtml.json()
  expect(Object.keys(selected.data.article).sort()).toEqual([
    'document',
    'provenance',
  ])
  expect(selected.data.article.document.children[0].children[0].text).toBe(
    '  <script>literal</script> & ไทย $input.body.secret  ',
  )

  expect((await request(endpoint, 'POST', operation)).status).toBe(401)
  expect((await request(endpoint, 'POST', operation, '')).status).toBe(401)
  expect(
    await (await request(collectionPath + '/entries/' + entry.id)).json(),
  ).toEqual(entry)
  expect(await (await request(collectionPath + '/renderer')).json()).toEqual(
    savedRenderer,
  )

  const auditResponse = await request('/api/audit')
  expect(auditResponse.status).toBe(200)
  const audit = await auditResponse.json()
  const flowEvents = audit.filter(
    (event: { resource: string }) => event.resource === draft.id,
  )
  expect(
    flowEvents.map((event: { action: string }) => event.action).sort(),
  ).toEqual([
    'flow.created',
    'flow.published',
    'graphql.executed',
    'graphql.executed',
  ])
  const metadata = JSON.stringify(flowEvents)
  expect(metadata).not.toContain('<script>')
  expect(metadata).not.toContain('article-heading')
  expect(metadata).not.toContain(key.token)
})

test('typed selection preserves every rich-text family and mixed field paths', async () => {
  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '', marks: [] },
          {
            type: 'link',
            url: 'https://example.invalid/a',
            children: [{ type: 'text', text: 'a', marks: ['italic', 'code'] }],
          },
          { type: 'lineBreak' },
        ],
      },
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: 'h', marks: ['bold'] }],
      },
      {
        type: 'list',
        ordered: true,
        start: 3,
        children: [
          {
            type: 'listItem',
            children: [
              { type: 'paragraph', children: [] },
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
                        children: [{ type: 'text', text: 'l', marks: [] }],
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
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              {
                type: 'tableCell',
                header: true,
                children: [{ type: 'paragraph', children: [] }],
              },
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'T', marks: [] }],
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
            children: [{ type: 'text', text: 'q', marks: [] }],
          },
        ],
      },
      { type: 'code', language: 'plaintext', text: 'x' },
      { type: 'code', language: 'javascript', text: '$data' },
      { type: 'horizontalRule' },
    ],
  }
  const snapshot = await publishDocument(document, 2, '/typed-families')
  const inline = `fragment Inline on CmsInline {
    __typename
    ... on CmsText { type text marks }
    ... on CmsLink { type url children { type text marks } }
    ... on CmsLineBreak { type }
  }`
  const reply = await snapshot.query(`{
    contentSnapshot {
      document { type astVersion children {
        __typename
        ... on CmsParagraph { type children { ...Inline } }
        ... on CmsHeading { type level children { ...Inline } }
        ... on CmsList { type ordered start children {
          type children {
            __typename
            ... on CmsParagraph { type children { ...Inline } }
            ... on CmsList { type ordered start children {
              type children { ... on CmsParagraph { type children { ...Inline } } }
            } }
          }
        } }
      } }
      provenance { fieldPath {
        __typename
        ... on CmsFieldKey { key }
        ... on CmsFieldIndex { index }
      } }
    }
  } ${inline}`)
  expect(reply).toEqual({
    data: {
      contentSnapshot: {
        document: {
          type: 'document',
          astVersion: 2,
          children: [
            {
              __typename: 'CmsParagraph',
              type: 'paragraph',
              children: [
                { __typename: 'CmsText', type: 'text', text: '', marks: [] },
                {
                  __typename: 'CmsLink',
                  type: 'link',
                  url: 'https://example.invalid/a',
                  children: [
                    { type: 'text', text: 'a', marks: ['italic', 'code'] },
                  ],
                },
                { __typename: 'CmsLineBreak', type: 'lineBreak' },
              ],
            },
            {
              __typename: 'CmsHeading',
              type: 'heading',
              level: 2,
              children: [
                {
                  __typename: 'CmsText',
                  type: 'text',
                  text: 'h',
                  marks: ['bold'],
                },
              ],
            },
            {
              __typename: 'CmsList',
              type: 'list',
              ordered: true,
              start: 3,
              children: [
                {
                  type: 'listItem',
                  children: [
                    {
                      __typename: 'CmsParagraph',
                      type: 'paragraph',
                      children: [],
                    },
                    {
                      __typename: 'CmsList',
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
                                {
                                  __typename: 'CmsText',
                                  type: 'text',
                                  text: 'l',
                                  marks: [],
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
            { __typename: 'CmsTable' },
            { __typename: 'CmsQuote' },
            { __typename: 'CmsCode' },
            { __typename: 'CmsCode' },
            { __typename: 'CmsHorizontalRule' },
          ],
        },
        provenance: {
          fieldPath: [
            { __typename: 'CmsFieldKey', key: 'sections' },
            { __typename: 'CmsFieldIndex', index: '0' },
          ],
        },
      },
    },
  })

  const otherFamilies = await snapshot.query(`{
    contentSnapshot { document { children {
      __typename
      ... on CmsTable { type children { type children {
        type header children { type children { ... on CmsText { type text marks } } }
      } } }
      ... on CmsQuote { type children { type children { ... on CmsText { type text marks } } } }
      ... on CmsCode { type language text }
      ... on CmsHorizontalRule { type }
    } } }
  }`)
  expect(otherFamilies).toEqual({
    data: {
      contentSnapshot: {
        document: {
          children: [
            { __typename: 'CmsParagraph' },
            { __typename: 'CmsHeading' },
            { __typename: 'CmsList' },
            {
              __typename: 'CmsTable',
              type: 'table',
              children: [
                {
                  type: 'tableRow',
                  children: [
                    {
                      type: 'tableCell',
                      header: true,
                      children: [{ type: 'paragraph', children: [] }],
                    },
                    {
                      type: 'tableCell',
                      header: false,
                      children: [
                        {
                          type: 'paragraph',
                          children: [{ type: 'text', text: 'T', marks: [] }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              __typename: 'CmsQuote',
              type: 'quote',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'q', marks: [] }],
                },
              ],
            },
            {
              __typename: 'CmsCode',
              type: 'code',
              language: 'plaintext',
              text: 'x',
            },
            {
              __typename: 'CmsCode',
              type: 'code',
              language: 'javascript',
              text: '$data',
            },
            { __typename: 'CmsHorizontalRule', type: 'horizontalRule' },
          ],
        },
      },
    },
  })
})

test('version-one GraphQL stays sealed through source deletion, restart and downloaded backup with REST', async () => {
  const document = {
    type: 'document',
    astVersion: 1,
    children: [
      { type: 'paragraph', children: [] },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '  $auth <b>ไทย</b>  ' }],
      },
    ],
  }
  const rest = await publishDocument(
    document,
    1,
    '/legacy-rest-snapshot',
    'rest',
  )
  const restCode = await saved('/api/flows/' + rest.flow.id + '/backend-code')
  expect(restCode.compilerVersion).toBe(3)

  const graphql = await publishDocument(document, 1, '/literal-one-graphql')
  const graphqlCode = await saved(
    '/api/flows/' + graphql.flow.id + '/backend-code',
  )
  expect(graphqlCode.compilerVersion).toBe(4)
  expect(graphqlCode.endpoint).toEqual({
    method: 'POST',
    path: '/graphql/literal-one-graphql',
    graphql: true,
    transport: 'graphql',
  })
  expect(graphqlCode.code).toContain(
    "app.route('POST', '/graphql/literal-one-graphql'",
  )
  expect(graphqlCode.code).not.toContain('$auth <b>ไทย</b>')
  expect(graphqlCode.code).not.toContain(graphql.key.token)

  const query = `{
    contentSnapshot {
      document { type astVersion children {
        ... on CmsParagraph { type children { ... on CmsText { type text marks } } }
      } }
      html
      provenance { schemaVersion astVersion fieldPath {
        ... on CmsFieldKey { key }
        ... on CmsFieldIndex { index }
      } }
    }
  }`
  const expected = {
    data: {
      contentSnapshot: {
        document: {
          type: 'document',
          astVersion: 1,
          children: [
            { type: 'paragraph', children: [] },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: '  $auth <b>ไทย</b>  ', marks: null },
              ],
            },
          ],
        },
        html: '<p></p><p>  $auth &lt;b&gt;ไทย&lt;/b&gt;  </p>',
        provenance: {
          schemaVersion: 1,
          astVersion: 1,
          fieldPath: [{ key: 'body' }],
        },
      },
    },
  }
  expect(await graphql.query(query)).toEqual(expected)
  const restReply = await request(
    '/run/legacy-rest-snapshot',
    'GET',
    undefined,
    rest.key.token,
  )
  expect(restReply.status).toBe(200)
  const expectedRest = await restReply.json()
  expect(expectedRest.document).toEqual(document)

  expect(
    (await request(graphql.entryPath, 'DELETE', { version: 1 })).status,
  ).toBe(200)
  expect(
    (
      await request(graphql.collectionPath + '/renderer', 'PUT', {
        version: 0,
        renderer: {
          schemaVersion: 1,
          elements: { p: { classes: ['later-settings'] } },
        },
      })
    ).status,
  ).toBe(200)
  expect(await graphql.query(query)).toEqual(expected)

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  expect(await graphql.query(query)).toEqual(expected)
  expect(await saved('/api/flows/' + rest.flow.id + '/backend-code')).toEqual(
    restCode,
  )
  expect(
    await saved('/api/flows/' + graphql.flow.id + '/backend-code'),
  ).toEqual(graphqlCode)

  const backupResponse = await request('/api/backups', 'POST', {})
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const archive = new Uint8Array(await download.arrayBuffer())
  expect(archive.byteLength).toBe(backup.bytes)
  const restoredPath = join(directory, 'downloaded-graphql-restore.sqlite')
  writeFileSync(restoredPath, archive)

  for (let attempt = 0; attempt < 2; attempt++) {
    await server.close()
    server = createApp({
      databasePath: restoredPath,
      backupDir: join(directory, 'restored-backups'),
      runtimeCodeDir: join(directory, 'restored-runtime-' + attempt),
      adminToken: owner,
    })
    expect(await graphql.query(query)).toEqual(expected)
    const restoredRest = await request(
      '/run/legacy-rest-snapshot',
      'GET',
      undefined,
      rest.key.token,
    )
    expect(restoredRest.status).toBe(200)
    expect(await restoredRest.json()).toEqual(expectedRest)
    expect(await saved('/api/flows/' + rest.flow.id + '/backend-code')).toEqual(
      restCode,
    )
    expect(
      await saved('/api/flows/' + graphql.flow.id + '/backend-code'),
    ).toEqual(graphqlCode)
  }

  for (const tamper of ['compiler', 'schema'] as const) {
    const corruptPath = join(directory, 'corrupt-' + tamper + '.sqlite')
    writeFileSync(corruptPath, archive)
    const corrupt = new Database(corruptPath)
    try {
      const changed =
        tamper === 'compiler'
          ? corrupt
              .query(
                'UPDATE backend_artifacts SET compiler_version = 3 WHERE flow_id = ?',
              )
              .run(graphql.flow.id)
          : corrupt
              .query(
                "UPDATE flows SET published = json_set(published, '$.graphql.schema', ?) WHERE id = ?",
              )
              .run('type Query { contentSnapshot: String! }', graphql.flow.id)
      expect(changed.changes).toBe(1)
    } finally {
      corrupt.close()
    }

    let failedRestore: unknown
    let unexpected: ReturnType<typeof createApp> | undefined
    try {
      unexpected = createApp({
        databasePath: corruptPath,
        backupDir: join(directory, 'corrupt-backups-' + tamper),
        runtimeCodeDir: join(directory, 'corrupt-runtime-' + tamper),
        adminToken: owner,
      })
    } catch (error) {
      failedRestore = error
    } finally {
      await unexpected?.close()
    }
    expect(failedRestore).toMatchObject({ status: 503 })
    expect(await graphql.query(query)).toEqual(expected)
  }
})

test('GraphQL snapshots reject forged reviews, non-owner access, invalid operations and retired original keys', async () => {
  const snapshot = await publishDocument(
    {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Private $data ไทย', marks: [] }],
        },
      ],
    },
    2,
    '/protected-graphql-snapshot',
  )
  const endpoint = '/graphql/protected-graphql-snapshot'
  const query = '{ contentSnapshot { html } }'
  const operation = { query }
  const flowsBefore = await saved('/api/flows')
  const auditBefore = await saved('/api/audit')
  const review = {
    name: 'Rejected review',
    path: '/must-not-exist',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 0,
    fieldPath: ['sections', 0],
  }
  for (const [body, status] of [
    [{ ...review, schema: 'type Query { text: String }' }, 400],
    [
      {
        ...review,
        document: { type: 'document', astVersion: 2, children: [] },
      },
      400,
    ],
    [{ ...review, collectionVersion: 2 }, 409],
    [{ ...review, entryVersion: 2 }, 409],
    [{ ...review, rendererVersion: 1 }, 409],
  ] as const) {
    expect(
      (
        await request(
          snapshot.entryPath + '/snapshot-flow/graphql',
          'POST',
          body,
        )
      ).status,
    ).toBe(status)
  }
  expect(await saved('/api/flows')).toEqual(flowsBefore)
  expect(await saved('/api/audit')).toEqual(auditBefore)

  const editorResponse = await request('/api/members', 'POST', {
    name: 'Ordinary editor',
    role: 'editor',
  })
  expect(editorResponse.status).toBe(200)
  const editor = await editorResponse.json()
  expect(
    (
      await request(
        snapshot.entryPath + '/snapshot-flow/graphql',
        'POST',
        review,
        editor.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/api/flows/' + snapshot.flow.id,
        'GET',
        undefined,
        editor.token,
      )
    ).status,
  ).toBe(404)
  const editorCatalog = await request(
    '/api/flows',
    'GET',
    undefined,
    editor.token,
  )
  expect(editorCatalog.status).toBe(200)
  expect(
    (await editorCatalog.json()).map((flow: { id: string }) => flow.id),
  ).not.toContain(snapshot.flow.id)

  const keysBefore = await saved('/api/runtime-keys')
  for (const [keyBody, status] of [
    [{ permissions: ['query'] }, 400],
    [{ permissions: ['query'], releaseRevision: 2 }, 409],
    [{ permissions: ['rest'], releaseRevision: 1 }, 400],
    [{ permissions: ['ws'], releaseRevision: 1 }, 400],
  ] as const) {
    expect(
      (
        await request('/api/runtime-keys', 'POST', {
          name: 'Rejected runtime scope',
          flowId: snapshot.flow.id,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          ...keyBody,
        })
      ).status,
    ).toBe(status)
  }
  expect(await saved('/api/runtime-keys')).toEqual(keysBefore)

  for (const input of [
    { query: 'mutation { contentSnapshot { html } }' },
    { query: 'subscription { contentSnapshot { html } }' },
    { query: '{ __schema { queryType { name } } }' },
    { query: '{ contentSnapshot { secret } }' },
    { query: '{ contentSnapshot(secret: "caller") { html } }' },
    {
      query:
        'query($show: Boolean!) { contentSnapshot { html @include(if: $show) } }',
    },
    {
      query:
        'query($show: Boolean!) { contentSnapshot { html @include(if: $show) } }',
      variables: { show: 'yes' },
    },
    {
      query:
        'query First { contentSnapshot { html } } query Second { contentSnapshot { html } }',
    },
    { query: '{ ...Cycle } fragment Cycle on Query { ...Cycle }' },
    {
      query:
        '{ ' +
        Array.from(
          { length: 17 },
          (_, index) => `a${index}:contentSnapshot { html }`,
        ).join(' ') +
        ' }',
    },
    {
      query:
        '{ contentSnapshot { ' +
        Array.from({ length: 201 }, (_, index) => `a${index}:html`).join(' ') +
        ' } }',
    },
  ]) {
    const denied = await request(endpoint, 'POST', input, snapshot.key.token)
    expect(denied.status).toBe(400)
    const body = await denied.json()
    expect(body.errors.length).toBeGreaterThan(0)
    expect(body.errors.length).toBeLessThanOrEqual(10)
    expect(JSON.stringify(body)).not.toContain('Private $data ไทย')
  }
  expect(
    (await request(endpoint, 'GET', undefined, snapshot.key.token)).status,
  ).toBe(405)
  expect(
    (
      await request(
        '/run/protected-graphql-snapshot',
        'POST',
        {},
        snapshot.key.token,
      )
    ).status,
  ).toBe(404)

  const replacementResponse = await request(
    '/api/runtime-keys/' + snapshot.key.id + '/rotate',
    'POST',
    {},
  )
  expect(replacementResponse.status).toBe(200)
  const replacement = await replacementResponse.json()
  expect(replacement.permissions).toEqual(['query'])
  expect(replacement.releaseRevision).toBe(1)
  expect(replacement.issuerBinding).toEqual(snapshot.key.issuerBinding)
  expect(
    (await request(endpoint, 'POST', operation, snapshot.key.token)).status,
  ).toBe(401)
  const reply = await request(endpoint, 'POST', operation, replacement.token)
  expect(reply.status).toBe(200)
  expect(await reply.json()).toEqual({
    data: { contentSnapshot: { html: '<p>Private $data ไทย</p>' } },
  })
  expect(
    (await request('/api/runtime-keys/' + replacement.id, 'DELETE')).status,
  ).toBe(200)
  expect(
    (await request(endpoint, 'POST', operation, replacement.token)).status,
  ).toBe(401)
})

test('GraphQL snapshot bounds reject deep work and repeated large outputs without exposing literal content', async () => {
  const literal = 'PRIVATE-LITERAL-'.repeat(200)
  const snapshot = await publishDocument(
    {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: literal, marks: [] }],
        },
      ],
    },
    2,
    '/bounded-content-graphql',
  )
  const endpoint = '/graphql/bounded-content-graphql'
  const single = await snapshot.query('{ contentSnapshot { html } }')
  expect(single).toEqual({
    data: { contentSnapshot: { html: '<p>' + literal + '</p>' } },
  })

  let nested = '__typename'
  for (let index = 0; index < 5; index++) {
    nested = `... on CmsList { children { children { ${nested} } } }`
  }
  const deep = await request(
    endpoint,
    'POST',
    {
      query: `{ contentSnapshot { document { children { ${nested} } } } }`,
    },
    snapshot.key.token,
  )
  expect(deep.status).toBe(400)
  expect(await deep.json()).toEqual({
    errors: [{ message: 'GraphQL depth limit exceeded (12)' }],
  })

  const tokens = await request(
    endpoint,
    'POST',
    {
      query:
        '{ contentSnapshot { ' +
        Array.from({ length: 800 }, (_, index) => `a${index}:html`).join(' ') +
        ' } }',
    },
    snapshot.key.token,
  )
  expect(tokens.status).toBe(400)
  const tokenErrors = await tokens.json()
  expect(tokenErrors.errors[0].message).toContain('tokens')
  expect(JSON.stringify(tokenErrors)).not.toContain('PRIVATE-LITERAL-')

  const amplified = await request(
    endpoint,
    'POST',
    {
      query:
        '{ ' +
        Array.from(
          { length: 16 },
          (_, index) => `a${index}:contentSnapshot { html }`,
        ).join(' ') +
        ' }',
    },
    snapshot.key.token,
  )
  expect(amplified.status).toBe(200)
  const body = await amplified.json()
  expect(body.data).toBeNull()
  expect(body.errors[0].message).toBe('GraphQL response budget exceeded')
  expect(JSON.stringify(body)).not.toContain('PRIVATE-LITERAL-')
  expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(262_144)
})
