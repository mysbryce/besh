import { afterEach, beforeEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'cms-client-code-tracer-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-cms-client-code-tracer-'
const privateText =
  'PRIVATE-SNAPSHOT-BODY-NOT-IN-EXAMPLE-METADATA <literal> & ไทย $input.body.secret'
const query = `query ContentExample($includeHtml: Boolean!) {
  contentSnapshot {
    document {
      type
      astVersion
      children {
        ... on CmsHeading { level children { ...TextFields } }
        ... on CmsParagraph { children { ...TextFields } }
      }
    }
    html @include(if: $includeHtml)
    provenance { entryVersion rendererVersion releaseRevision }
  }
}
fragment TextFields on CmsText { text marks }`

let directory: string | undefined
let server: ReturnType<typeof createApp> | undefined

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), temporaryPrefix))

  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
})

afterEach(async () => {
  if (server?.app.server) await server.app.stop(true)
  await server?.close()

  if (!directory) return

  const target = resolve(directory)
  const parent = resolve(tmpdir())
  expect(target.toLowerCase().startsWith((parent + sep).toLowerCase())).toBe(
    true,
  )
  expect(basename(target).startsWith(temporaryPrefix)).toBe(true)

  rmSync(target, { recursive: true, force: true })
  directory = undefined
  server = undefined
})

function request(path: string, method = 'GET', body?: unknown, token = owner) {
  const current = server
  if (!current) throw new Error('Fixture was not initialized')

  return current.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function contentFixture() {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Content client-example model',
    fields: [
      {
        key: 'body',
        label: 'Article body',
        required: true,
        schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Content client-example collection',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  const collectionPath = '/api/collections/' + collection.id
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data: {
      body: {
        type: 'document',
        astVersion: 2,
        children: [
          {
            type: 'heading',
            level: 1,
            children: [
              { type: 'text', text: privateText, marks: ['italic', 'bold'] },
            ],
          },
        ],
      },
    },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  const rendererResponse = await request(collectionPath + '/renderer', 'PUT', {
    version: 0,
    renderer: {
      schemaVersion: 1,
      elements: { h1: { classes: ['private-client-example-heading'] } },
    },
  })
  expect(rendererResponse.status).toBe(200)

  const renderer = await rendererResponse.json()

  return { collectionPath, collection, entry, renderer }
}

type ContentFixture = Awaited<ReturnType<typeof contentFixture>>
type Transport = 'graphql' | 'rest'

async function createSnapshot(
  resources: ContentFixture,
  transport: Transport,
  publish = true,
) {
  const { collectionPath, collection, entry, renderer } = resources
  const creation = await request(
    collectionPath +
      '/entries/' +
      entry.id +
      '/snapshot-flow' +
      (transport === 'graphql' ? '/graphql' : ''),
    'POST',
    {
      name:
        transport === 'graphql'
          ? 'Reviewed Content client example'
          : 'Reviewed REST Content client example',
      path:
        transport === 'graphql'
          ? '/reviewed-content-client-example'
          : '/reviewed-content-rest-client-example',
      collectionVersion: collection.version,
      entryVersion: entry.version,
      rendererVersion: renderer.version,
      fieldPath: ['body'],
    },
  )
  expect(creation.status).toBe(200)

  const draft = await creation.json()
  const flowPath = '/api/flows/' + draft.id
  if (publish) {
    const publication = await request(flowPath + '/publish', 'POST', {
      revision: 1,
    })
    expect(publication.status).toBe(200)
  }

  return { ...draft, flowPath }
}

async function publicState(
  { collectionPath, entry }: ContentFixture,
  flowPath: string,
  entryStatus: 200 | 404 = 200,
) {
  const paths = [
    collectionPath,
    collectionPath + '/entries/' + entry.id,
    collectionPath + '/renderer',
    flowPath,
    '/api/flows',
    '/api/runtime-keys',
    '/api/audit',
  ]
  const values: unknown[] = []

  for (const path of paths) {
    const saved = await request(path)
    expect(saved.status).toBe(
      path === collectionPath + '/entries/' + entry.id ? entryStatus : 200,
    )

    values.push(await saved.json())
  }

  return values
}

function exampleInput(transport: Transport, target = 'javascript-fetch') {
  return {
    target,
    revision: 1,
    baseUrl: 'https://content.example.test/prefix',
    ...(transport === 'graphql'
      ? {
          request: {
            graphql: {
              query,
              operationName: 'ContentExample',
              variables: { includeHtml: true },
            },
          },
        }
      : {}),
  }
}

test('owner generates published Content client text without exporting sealed content or executing it', async () => {
  const resources = await contentFixture()
  const { flowPath } = await createSnapshot(resources, 'graphql')

  // First new behavior: omitted source must select the current publication.
  const response = await request(flowPath + '/client-code')
  expect(response.status).toBe(200)

  const metadata = await response.json()
  const exported = JSON.stringify(metadata)
  expect(metadata.graphql.schema).toContain(
    'contentSnapshot: CmsContentSnapshot!',
  )

  expect(metadata).toMatchObject({
    source: 'published',
    revision: 1,
    name: 'Reviewed Content client example',
    method: 'POST',
    path: '/reviewed-content-client-example',
    graphql: { schema: expect.any(String) },
    contract: null,
  })
  expect(metadata.targets).toContainEqual(
    expect.objectContaining({
      id: 'javascript-fetch',
      filename: 'request.mjs',
    }),
  )

  expect(exported).not.toContain(
    'PRIVATE-SNAPSHOT-BODY-NOT-IN-EXAMPLE-METADATA',
  )
  expect(exported).not.toContain('private-client-example-heading')
  expect(exported).not.toContain(owner)

  const before = await publicState(resources, flowPath)
  const generatedResponse = await request(
    flowPath + '/client-code',
    'POST',
    exampleInput('graphql'),
  )
  expect(generatedResponse.status).toBe(200)

  const generated = await generatedResponse.json()
  expect(generated).toMatchObject({
    target: 'javascript-fetch',
    source: 'published',
    revision: 1,
    method: 'POST',
    url: 'https://content.example.test/prefix/graphql/reviewed-content-client-example',
    filename: 'request.mjs',
    contentType: 'text/plain',
  })
  expect(generated.code).toContain('BESH_RUNTIME_API_KEY')
  expect(generated.code).toContain('ContentExample')
  expect(generated.code).toContain('CmsHeading')
  expect(generated.code).toContain('CmsParagraph')
  expect(generated.code).toContain('TextFields on CmsText')
  expect(generated.code).toContain('html @include(if: $includeHtml)')
  expect(generated.code).toContain('provenance')
  expect(generated.code).not.toContain(privateText)
  expect(generated.code).not.toContain('private-client-example-heading')
  expect(generated.code).not.toContain(owner)
  expect(generated.warnings).toContain(
    'Content calls require an owner-issued query runtime key for this API pinned to its current release.',
  )
  expect(await publicState(resources, flowPath)).toEqual(before)

  const { flowPath: restFlowPath } = await createSnapshot(resources, 'rest')

  const restMetadataResponse = await request(restFlowPath + '/client-code')
  expect(restMetadataResponse.status).toBe(200)
  const restMetadata = await restMetadataResponse.json()
  expect(restMetadata).toMatchObject({
    source: 'published',
    revision: 1,
    method: 'GET',
    path: '/reviewed-content-rest-client-example',
    graphql: null,
    contract: null,
  })
  expect(JSON.stringify(restMetadata)).not.toContain(privateText)
  expect(JSON.stringify(restMetadata)).not.toContain(
    'private-client-example-heading',
  )
  expect(JSON.stringify(restMetadata)).not.toContain(owner)

  const restBefore = await publicState(resources, restFlowPath)
  const restGeneratedResponse = await request(
    restFlowPath + '/client-code',
    'POST',
    exampleInput('rest'),
  )
  expect(restGeneratedResponse.status).toBe(200)

  const restGenerated = await restGeneratedResponse.json()
  expect(restGenerated).toMatchObject({
    target: 'javascript-fetch',
    source: 'published',
    revision: 1,
    method: 'GET',
    url: 'https://content.example.test/prefix/run/reviewed-content-rest-client-example',
    filename: 'request.mjs',
    contentType: 'text/plain',
  })
  expect(restGenerated.code).toContain('BESH_RUNTIME_API_KEY')
  expect(restGenerated.code).not.toContain(privateText)
  expect(restGenerated.code).not.toContain('private-client-example-heading')
  expect(restGenerated.code).not.toContain(owner)
  expect(restGenerated.warnings).toContain(
    'Content calls require an owner-issued rest runtime key for this API pinned to its current release.',
  )
  expect(await publicState(resources, restFlowPath)).toEqual(restBefore)
})

test('owner renders all eight Content HTTP targets from the exact saved publication without effects', async () => {
  const resources = await contentFixture()
  const targets = [
    ['javascript-axios', 'request.mjs'],
    ['javascript-fetch', 'request.mjs'],
    ['php-curl', 'request.php'],
    ['curl', 'request.sh'],
    ['rust-reqwest', 'main.rs'],
    ['go-net-http', 'main.go'],
    ['java-http-client', 'Main.java'],
    ['cpp-libcurl', 'main.cpp'],
  ] as const

  for (const transport of ['graphql', 'rest'] as const) {
    const { flowPath } = await createSnapshot(resources, transport)
    const metadataResponse = await request(flowPath + '/client-code')
    expect(metadataResponse.status).toBe(200)

    const metadata = await metadataResponse.json()
    expect(metadata.targets.map((target: { id: string }) => target.id)).toEqual(
      targets.map(([id]) => id),
    )
    const before = await publicState(resources, flowPath)

    for (const [target, filename] of targets) {
      const generatedResponse = await request(
        flowPath + '/client-code',
        'POST',
        exampleInput(transport, target),
      )
      expect(generatedResponse.status).toBe(200)

      const generated = await generatedResponse.json()
      expect(generated).toMatchObject({
        target,
        filename,
        source: 'published',
        revision: 1,
        method: transport === 'graphql' ? 'POST' : 'GET',
        url:
          transport === 'graphql'
            ? 'https://content.example.test/prefix/graphql/reviewed-content-client-example'
            : 'https://content.example.test/prefix/run/reviewed-content-rest-client-example',
        contentType: 'text/plain',
      })
      expect(generated.code.length).toBeGreaterThan(0)
      expect(generated.dependencies.length).toBeGreaterThan(0)
      expect(generated.code).toContain('BESH_RUNTIME_API_KEY')
      expect(generated.code).not.toContain(privateText)
      expect(generated.code).not.toContain('private-client-example-heading')
      expect(generated.code).not.toContain(owner)
    }

    expect(await publicState(resources, flowPath)).toEqual(before)
  }
})

test('Content client rendering rejects invalid typed selections, operations, variables and bounds without effects', async () => {
  const resources = await contentFixture()
  const { flowPath } = await createSnapshot(resources, 'graphql')
  const { flowPath: restFlowPath } = await createSnapshot(resources, 'rest')
  const before = await publicState(resources, flowPath)
  const fields =
    '{ contentSnapshot { ' +
    Array.from({ length: 201 }, (_, index) => `field${index}: html`).join(' ') +
    ' } }'
  const roots =
    '{ ' +
    Array.from(
      { length: 17 },
      (_, index) => `root${index}: contentSnapshot { html }`,
    ).join(' ') +
    ' }'
  const invalidOperations = [
    { query: '{ contentSnapshot { missing } }' },
    { query: '{ contentSnapshot { document { children { text } } } }' },
    { query: 'mutation { contentSnapshot { html } }' },
    { query: 'subscription { contentSnapshot { html } }' },
    {
      query,
      operationName: 'ContentExample',
      variables: { includeHtml: 'true' },
    },
    { query, operationName: 'ContentExample', variables: {} },
    { query: fields },
    { query: roots },
    { query: ' '.repeat(16_385) },
    { query: '{ __schema { types { name } } }' },
  ]

  for (const graphql of invalidOperations) {
    const rejected = await request(flowPath + '/client-code', 'POST', {
      ...exampleInput('graphql'),
      request: { graphql },
    })
    expect(rejected.status).toBe(400)
    expect(JSON.stringify(await rejected.json())).not.toContain(privateText)
  }

  for (const invalidRequest of [
    { body: false },
    { graphql: { query: '{ contentSnapshot { html } }' } },
  ]) {
    const rejected = await request(restFlowPath + '/client-code', 'POST', {
      ...exampleInput('rest'),
      request: invalidRequest,
    })
    expect(rejected.status).toBe(400)
  }

  expect(await publicState(resources, flowPath)).toEqual(before)
})

test('Content client examples require exact source revisions and explicit unpublished draft selection', async () => {
  const resources = await contentFixture()

  for (const transport of ['graphql', 'rest'] as const) {
    const { flowPath } = await createSnapshot(resources, transport, false)
    const before = await publicState(resources, flowPath)
    expect((await request(flowPath + '/client-code')).status).toBe(404)
    expect(
      (
        await request(
          flowPath + '/client-code',
          'POST',
          exampleInput(transport),
        )
      ).status,
    ).toBe(404)

    const draftMetadataResponse = await request(
      flowPath + '/client-code?source=draft',
    )
    expect(draftMetadataResponse.status).toBe(200)
    expect(await draftMetadataResponse.json()).toMatchObject({
      source: 'draft',
      revision: 1,
      method: transport === 'graphql' ? 'POST' : 'GET',
    })

    const draftResponse = await request(flowPath + '/client-code', 'POST', {
      ...exampleInput(transport),
      source: 'draft',
    })
    expect(draftResponse.status).toBe(200)
    const draft = await draftResponse.json()
    expect(draft).toMatchObject({ source: 'draft', revision: 1 })
    expect(draft.warnings).toContain(
      'Publish this saved revision first. The current live release may differ.',
    )
    expect(draft.warnings).toContain(
      `Content calls require an owner-issued ${transport === 'graphql' ? 'query' : 'rest'} runtime key for this API pinned to its current release.`,
    )
    expect(draft.code).not.toContain(privateText)
    expect(
      (
        await request(flowPath + '/client-code', 'POST', {
          ...exampleInput(transport),
          source: 'draft',
          revision: 2,
        })
      ).status,
    ).toBe(409)
    expect(
      (await request(flowPath + '/client-code?source=archived')).status,
    ).toBe(400)
    expect(
      (await request(flowPath + '/client-code?source=draft&source=published'))
        .status,
    ).toBe(400)
    expect(await publicState(resources, flowPath)).toEqual(before)

    expect(
      (await request(flowPath + '/publish', 'POST', { revision: 1 })).status,
    ).toBe(200)
    const publishedBefore = await publicState(resources, flowPath)
    expect(
      (
        await request(flowPath + '/client-code', 'POST', {
          ...exampleInput(transport),
          revision: 2,
        })
      ).status,
    ).toBe(409)
    const publishedResponse = await request(
      flowPath + '/client-code',
      'POST',
      exampleInput(transport),
    )
    expect(publishedResponse.status).toBe(200)
    expect(await publishedResponse.json()).toMatchObject({
      source: 'published',
      revision: 1,
    })
    expect(await publicState(resources, flowPath)).toEqual(publishedBefore)
  }
})

test('Content client examples deny anonymous, non-owner readers and runtime-key management proofs', async () => {
  const resources = await contentFixture()
  const memberResponse = await request('/api/members', 'POST', {
    name: 'Content example non-owner reader',
    role: 'viewer',
  })
  expect(memberResponse.status).toBe(200)
  const member = await memberResponse.json()

  for (const transport of ['graphql', 'rest'] as const) {
    const flow = await createSnapshot(resources, transport)
    const keyResponse = await request('/api/runtime-keys', 'POST', {
      name: 'Content example runtime proof',
      flowId: flow.id,
      permissions: [transport === 'graphql' ? 'query' : 'rest'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(keyResponse.status).toBe(200)
    const key = await keyResponse.json()
    const before = await publicState(resources, flow.flowPath)

    for (const [token, status] of [
      ['', 401],
      [member.token, 404],
      [key.token, 401],
    ] as const) {
      for (const source of ['published', 'draft']) {
        expect(
          (
            await request(
              flow.flowPath + '/client-code?source=' + source,
              'GET',
              undefined,
              token,
            )
          ).status,
        ).toBe(status)
        expect(
          (
            await request(
              flow.flowPath + '/client-code',
              'POST',
              { ...exampleInput(transport), source },
              token,
            )
          ).status,
        ).toBe(status)
      }
    }

    expect((await request(flow.flowPath + '/openapi')).status).toBe(503)
    expect(
      (
        await request(flow.flowPath + '/rollback', 'POST', {
          revision: 1,
          publishedRevision: 1,
        })
      ).status,
    ).toBe(503)
    expect(
      (
        await request(
          flow.flowPath + (transport === 'graphql' ? '/graphql/test' : '/test'),
          'POST',
          transport === 'graphql'
            ? { query: '{ contentSnapshot { html } }' }
            : { body: {}, query: {} },
        )
      ).status,
    ).toBe(503)
    const after = await publicState(resources, flow.flowPath)
    expect(after.slice(0, 6)).toEqual(before.slice(0, 6))

    const audit = after[6] as {
      actor: string
      action: string
      resource: string
    }[]
    const denied = audit.slice(0, 8)
    expect<unknown>(audit.slice(8)).toEqual(before[6])
    expect(denied).toHaveLength(8)
    expect(denied.filter((event) => event.actor === 'anonymous')).toHaveLength(
      4,
    )
    expect(
      denied.filter((event) => event.actor === 'runtime:' + key.id),
    ).toHaveLength(4)
    for (const event of denied)
      expect(event).toMatchObject({
        action: 'access.denied',
        resource: 'management',
      })

    expect(JSON.stringify(audit)).not.toContain(key.token)
    expect(JSON.stringify(audit)).not.toContain(member.token)
  }
})

test('Content client examples retain sealed revisions after source deletion and renderer replacement', async () => {
  const resources = await contentFixture()
  const examples = []

  for (const transport of ['graphql', 'rest'] as const) {
    const flow = await createSnapshot(resources, transport)
    const metadata = await request(flow.flowPath + '/client-code')
    expect(metadata.status).toBe(200)
    const generated = await request(
      flow.flowPath + '/client-code',
      'POST',
      exampleInput(transport),
    )
    expect(generated.status).toBe(200)

    examples.push({
      transport,
      flow,
      metadata: await metadata.json(),
      generated: await generated.json(),
    })
  }

  expect(
    (
      await request(
        resources.collectionPath + '/entries/' + resources.entry.id,
        'DELETE',
        { version: resources.entry.version },
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(resources.collectionPath + '/renderer', 'PUT', {
        version: resources.renderer.version,
        renderer: {
          schemaVersion: 1,
          elements: { h1: { classes: ['later-private-renderer'] } },
        },
      })
    ).status,
  ).toBe(200)

  for (const example of examples) {
    const before = await publicState(resources, example.flow.flowPath, 404)

    const metadata = await request(example.flow.flowPath + '/client-code')
    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toEqual(example.metadata)
    const generated = await request(
      example.flow.flowPath + '/client-code',
      'POST',
      exampleInput(example.transport),
    )
    expect(generated.status).toBe(200)
    expect(await generated.json()).toEqual(example.generated)
    expect(await publicState(resources, example.flow.flowPath, 404)).toEqual(
      before,
    )
  }
})

test('Content client examples reject malformed seals in a disposable downloaded backup without effects', async () => {
  const resources = await contentFixture()
  const flows = []

  for (const transport of ['graphql', 'rest'] as const)
    flows.push({ transport, ...(await createSnapshot(resources, transport)) })

  const created = await request('/api/backups', 'POST', {})
  expect(created.status).toBe(200)
  const backup = await created.json()
  const downloaded = await request('/api/backups/' + backup.id)
  expect(downloaded.status).toBe(200)
  const archive = new Uint8Array(await downloaded.arrayBuffer())
  expect(archive.byteLength).toBe(backup.bytes)
  if (!directory || !server) throw new Error('Fixture was not initialized')

  const copiedPath = join(directory, 'disposable-seal-copy.sqlite')
  writeFileSync(copiedPath, archive)
  await server.close()
  server = createApp({
    databasePath: copiedPath,
    backupDir: join(directory, 'copied-backups'),
    runtimeCodeDir: join(directory, 'copied-runtime'),
    adminToken: owner,
  })

  const before = await publicState(resources, flows[0]!.flowPath)

  const corrupt = new Database(copiedPath)
  try {
    for (const flow of flows)
      expect(
        corrupt
          .query('UPDATE cms_snapshots SET payload = ? WHERE flow_id = ?')
          .run('{"schemaVersion":1}', flow.id).changes,
      ).toBe(1)
  } finally {
    corrupt.close()
  }

  for (const flow of flows) {
    for (const source of ['published', 'draft']) {
      const metadata = await request(
        flow.flowPath + '/client-code?source=' + source,
      )
      expect(metadata.status).toBe(503)
      expect(await metadata.text()).not.toContain(privateText)
      const generated = await request(flow.flowPath + '/client-code', 'POST', {
        ...exampleInput(flow.transport),
        source,
      })
      expect(generated.status).toBe(503)
      expect(await generated.text()).not.toContain(privateText)
    }
  }
  expect(await publicState(resources, flows[0]!.flowPath)).toEqual(before)

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })

  for (const flow of flows) {
    expect((await request(flow.flowPath + '/client-code')).status).toBe(200)
    expect(
      (
        await request(
          flow.flowPath + '/client-code',
          'POST',
          exampleInput(flow.transport),
        )
      ).status,
    ).toBe(200)
  }
})
