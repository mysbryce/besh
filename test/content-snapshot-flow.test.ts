import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow } from './fixtures'

const owner = 'cms-snapshot-test-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-cms-snapshot-test-'
let directory: string
let server: ReturnType<typeof createApp>
let loadReplies: unknown[]

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), temporaryPrefix))
  loadReplies = []
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    k6Runner: async (input, signal) => {
      const response = await fetch(input.url, {
        method: input.method,
        headers: { authorization: 'Bearer ' + input.token },
        redirect: 'error',
        signal,
      })
      expect(response.status).toBe(200)
      loadReplies.push(await response.json())

      // Controlled metrics exercise orchestration, not native k6 performance.
      return {
        requests: 1,
        requestsPerSecond: 1,
        failedRequests: 0,
        checkRate: 1,
        avgMs: 1,
        p95Ms: 1,
        maxMs: 1,
        thresholdsPassed: true,
      }
    },
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

async function get(path: string, token = owner) {
  const response = await request(path, 'GET', undefined, token)
  expect(response.status).toBe(200)

  return response.json()
}

test('owner publishes and restores a sealed literal Content API hidden from other members', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Literal body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Snapshot articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private snapshot articles',
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

  // Separate leaves exercise resolver-looking literals without caller expressions.
  const literalText = [
    '$input.body.secret',
    '$input.query.secret',
    '$data',
    '$auth',
    '  <script>alert("literal")</script> & ไทย  ',
  ]
  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'heading',
        level: 1,
        children: literalText.map((text) => ({
          type: 'text',
          text,
          marks: [],
        })),
      },
    ],
  }
  const modelPath = '/api/structs/' + model.id
  const collectionPath = '/api/collections/' + collection.id
  const entriesPath = collectionPath + '/entries'
  const rendererPath = collectionPath + '/renderer'
  const entryResponse = await request(entriesPath, 'POST', {
    data: { body: document },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.version).toBe(1)
  expect(entry.data).toEqual({ body: document })

  const entryPath = entriesPath + '/' + entry.id
  const renderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['article-heading'],
        attributes: { title: 'Literal <heading> & ไทย' },
      },
    },
  }
  const rendererResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer,
  })
  expect(rendererResponse.status).toBe(200)

  const savedRenderer = await rendererResponse.json()
  const rendererHash = createHash('sha256')
    .update(
      '{"consumerContract":null,"elements":{"h1":{"attributes":{"title":"Literal <heading> & ไทย"},"classes":["article-heading"]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')
  expect(savedRenderer.version).toBe(1)
  expect(savedRenderer.renderer).toEqual(renderer)
  expect(savedRenderer.rendererSha256).toBe(rendererHash)

  const editorResponse = await request('/api/members', 'POST', {
    name: 'Ordinary all-access editor',
    role: 'editor',
  })
  expect(editorResponse.status).toBe(200)

  const editor = await editorResponse.json()
  expect(editor.flowAccess.mode).toBe('all')

  async function contentSnapshot() {
    return {
      model: await get(modelPath),
      collection: await get(collectionPath),
      entry: await get(entryPath),
      entries: await get(entriesPath),
      renderer: await get(rendererPath),
    }
  }

  const contentBefore = await contentSnapshot()
  const auditBefore = await get('/api/audit')
  const auditIds = new Set(auditBefore.map((event: { id: number }) => event.id))

  // Content and renderer values come from the reviewed saved versions.
  const createdResponse = await request(entryPath + '/snapshot-flow', 'POST', {
    name: 'Literal article snapshot',
    path: '/literal-article-snapshot',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 1,
    fieldPath: ['body'],
  })
  expect(createdResponse.status).toBe(200)

  // Keep sealed content outside editable graph JSON.
  const created = await createdResponse.json()
  const reviewedInput = {
    name: 'Rejected review must not create another flow',
    path: '/rejected-content-review',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 1,
    fieldPath: ['body'],
  }
  const reviewedFlowsBefore = await get('/api/flows')
  const reviewedAuditBefore = await get('/api/audit')
  for (const [input, status] of [
    [{ ...reviewedInput, html: '<script>caller</script>' }, 400],
    [{ ...reviewedInput, collectionVersion: 2 }, 409],
    [{ ...reviewedInput, entryVersion: 2 }, 409],
    [{ ...reviewedInput, rendererVersion: 0 }, 409],
  ] as const) {
    expect(
      (await request(entryPath + '/snapshot-flow', 'POST', input)).status,
    ).toBe(status)
  }
  expect(await get('/api/flows')).toEqual(reviewedFlowsBefore)
  expect(await get('/api/audit')).toEqual(reviewedAuditBefore)
  expect(created.id).toEqual(expect.any(String))
  expect(created.revision).toBe(1)
  expect(created.publishedRevision).toBeNull()
  expect(created.publishedEndpoint).toBeNull()
  expect(created.name).toBe('Literal article snapshot')
  expect(created.method).toBe('GET')
  expect(created.path).toBe('/literal-article-snapshot')
  expect(created.graphql).toBeUndefined()
  expect(created.websocket).toBeUndefined()
  expect(created.nodes).toHaveLength(2)
  expect(created.nodes.map((node: { type: string }) => node.type)).toEqual([
    'request',
    'cmsSnapshotResponse',
  ])

  const terminal = created.nodes[1]
  expect(created.nodes[0].config).toEqual({})
  expect(Object.keys(terminal.config).sort()).toEqual([
    'snapshotId',
    'snapshotSha256',
  ])
  expect(terminal.config.snapshotId).toMatch(/^[A-Za-z0-9_-]{1,80}$/)
  expect(terminal.config.snapshotSha256).toMatch(/^[a-f0-9]{64}$/)
  expect(created.edges).toHaveLength(1)
  expect(created.edges[0].source).toBe(created.nodes[0].id)
  expect(created.edges[0].target).toBe(terminal.id)

  const graph = JSON.stringify({ nodes: created.nodes, edges: created.edges })
  for (const text of literalText) expect(graph).not.toContain(text)
  expect(graph).not.toContain('article-heading')
  expect(graph).not.toContain('Literal <heading>')
  expect(graph).not.toContain('"children"')
  expect(graph).not.toContain('"html"')
  expect(graph).not.toContain('"code"')

  const flowPath = '/api/flows/' + created.id
  expect(await get(flowPath)).toEqual(created)
  const ownerCatalog = await get('/api/flows')
  expect(ownerCatalog.map((flow: { id: string }) => flow.id)).toContain(
    created.id,
  )

  // Creation deliberately audits metadata. Reads and denial effects are checked separately.
  const auditAfterCreate = await get('/api/audit')
  const acceptedEvents = auditAfterCreate.filter(
    (event: { id: number; action: string }) =>
      !auditIds.has(event.id) && event.action !== 'access.denied',
  )
  expect(acceptedEvents).toHaveLength(1)
  expect(
    acceptedEvents.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'flow.created' && event.resource === created.id,
    ),
  ).toHaveLength(1)

  const auditText = JSON.stringify(acceptedEvents)
  for (const text of literalText) expect(auditText).not.toContain(text)
  expect(auditText).not.toContain('article-heading')
  expect(auditText).not.toContain('Literal <heading>')
  expect(auditText).not.toContain(owner)
  expect(auditText).not.toContain(editor.token)

  const editorDetail = await request(flowPath, 'GET', undefined, editor.token)
  expect(editorDetail.status).toBe(404)
  const missingDetail = await request(
    '/api/flows/missing-snapshot-flow',
    'GET',
    undefined,
    editor.token,
  )
  expect(missingDetail.status).toBe(404)
  expect(await editorDetail.json()).toEqual(await missingDetail.json())

  const editorCatalog = await get('/api/flows', editor.token)
  expect(editorCatalog.map((flow: { id: string }) => flow.id)).not.toContain(
    created.id,
  )
  expect(await contentSnapshot()).toEqual(contentBefore)

  const finalAudit = await get('/api/audit')
  expect(
    finalAudit.filter(
      (event: { action: string }) => event.action !== 'access.denied',
    ),
  ).toEqual(
    auditAfterCreate.filter(
      (event: { action: string }) => event.action !== 'access.denied',
    ),
  )

  const viewerResponse = await request('/api/members', 'POST', {
    name: 'Content cannot be shared',
    role: 'viewer',
  })
  expect(viewerResponse.status).toBe(200)

  const viewer = await viewerResponse.json()
  const memberBefore = await get('/api/me', viewer.token)
  const assignmentAuditBefore = await get('/api/audit')
  const assignment = await request(
    '/api/members/' + viewer.id + '/flow-access',
    'PUT',
    { mode: 'selected', flowIds: [created.id], version: 1 },
  )
  expect(assignment.status).toBe(404)
  expect(await assignment.json()).toEqual({ error: 'Flow not found' })
  expect(await get('/api/me', viewer.token)).toEqual(memberBefore)
  expect(await get('/api/audit')).toEqual(assignmentAuditBefore)

  const editorTest = await request(
    flowPath + '/test',
    'POST',
    { body: {}, query: {} },
    editor.token,
  )
  expect(editorTest.status).toBe(404)
  expect(await editorTest.json()).toEqual({ error: 'Flow not found' })

  const publishedResponse = await request(flowPath + '/publish', 'POST', {
    revision: 1,
  })
  expect(publishedResponse.status).toBe(200)

  const published = await publishedResponse.json()
  expect(published).toEqual({
    ...created,
    publishedRevision: 1,
    publishedEndpoint: {
      method: 'GET',
      path: '/literal-article-snapshot',
      graphql: false,
      transport: 'rest',
    },
  })
  expect(await contentSnapshot()).toEqual(contentBefore)

  const keysBefore = await get('/api/runtime-keys')
  const keyAuditBefore = await get('/api/audit')
  const unpinnedResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Unpinned article reader',
    flowId: created.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  expect(unpinnedResponse.status).toBe(400)
  expect(await get('/api/runtime-keys')).toEqual(keysBefore)
  expect(await get('/api/audit')).toEqual(keyAuditBefore)

  const keyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Article reader',
    flowId: created.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    releaseRevision: 1,
  })
  expect(keyResponse.status).toBe(200)

  const key = await keyResponse.json()
  expect(key.releaseRevision).toBe(1)
  expect(key.issuerBinding).toEqual({
    memberId: 'owner',
    action: 'runtime-keys.manage',
  })

  const operatorRoleResponse = await request('/api/roles', 'POST', {
    name: 'API operator',
    permissions: ['flows.read', 'runtime-keys.manage', 'load-tests.run'],
  })
  expect(operatorRoleResponse.status).toBe(200)

  const operatorRole = await operatorRoleResponse.json()
  const operatorResponse = await request('/api/members', 'POST', {
    name: 'All-access API operator',
    role: 'custom',
    roleId: operatorRole.id,
  })
  expect(operatorResponse.status).toBe(200)

  const operator = await operatorResponse.json()
  expect(operator.access.mode).toBe('all')
  expect(await get('/api/runtime-keys', operator.token)).toEqual([])
  const callerBoundaryBefore = await get('/api/runtime-keys')
  const callerAuditBefore = await get('/api/audit')
  const unauthorizedIssue = await request(
    '/api/runtime-keys',
    'POST',
    {
      name: 'Guessed private Content API',
      flowId: created.id,
      permissions: ['rest'],
      expiresAt: key.expiresAt,
      releaseRevision: 1,
    },
    operator.token,
  )
  expect(unauthorizedIssue.status).toBe(404)
  expect(
    (
      await request(
        '/api/runtime-keys/' + key.id + '/rotate',
        'POST',
        {},
        operator.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/api/runtime-keys/' + key.id,
        'DELETE',
        undefined,
        operator.token,
      )
    ).status,
  ).toBe(404)
  expect(await get('/api/runtime-keys')).toEqual(callerBoundaryBefore)
  expect(await get('/api/audit')).toEqual(callerAuditBefore)

  const ordinaryResponse = await request('/api/flows', 'POST', {
    ...helloFlow,
    name: 'Ordinary pin control',
    path: '/ordinary-pin-control',
  })
  expect(ordinaryResponse.status).toBe(200)

  const ordinary = await ordinaryResponse.json()
  const boundaryFlowsBefore = await get('/api/flows')
  const boundaryAuditBefore = await get('/api/audit')
  const copiedSeal = {
    ...helloFlow,
    name: 'Copied seal is not a Content API',
    path: '/copied-content-seal',
    nodes: created.nodes,
    edges: created.edges,
  }
  expect((await request('/api/flows', 'POST', copiedSeal)).status).toBe(400)
  expect(
    (
      await request('/api/flows/' + ordinary.id, 'PUT', {
        ...copiedSeal,
        revision: 1,
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(flowPath, 'PUT', {
        ...helloFlow,
        path: created.path,
        revision: 1,
      })
    ).status,
  ).toBe(503)
  expect(await get('/api/flows')).toEqual(boundaryFlowsBefore)
  expect(await get('/api/audit')).toEqual(boundaryAuditBefore)
  expect(await contentSnapshot()).toEqual(contentBefore)
  expect(
    (
      await request('/api/flows/' + ordinary.id + '/publish', 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const ordinaryKeyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Ordinary unpinned caller',
    flowId: ordinary.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  expect(ordinaryKeyResponse.status).toBe(200)

  const ordinaryKey = await ordinaryKeyResponse.json()
  expect(ordinaryKey.releaseRevision).toBeNull()
  expect(ordinaryKey.issuerBinding).toBeNull()
  expect(
    (await get('/api/runtime-keys', operator.token)).map(
      (value: { id: string }) => value.id,
    ),
  ).toEqual([ordinaryKey.id])

  const expectedBody = {
    document,
    html:
      '<h1 class="article-heading" title="Literal &lt;heading&gt; &amp; ไทย">' +
      '$input.body.secret$input.query.secret$data$auth' +
      '  &lt;script&gt;alert("literal")&lt;/script&gt; &amp; ไทย  </h1>',
    provenance: {
      flowId: created.id,
      releaseRevision: 1,
      snapshotId: terminal.config.snapshotId,
      snapshotSha256: terminal.config.snapshotSha256,
      collectionId: collection.id,
      collectionVersion: 1,
      structId: model.id,
      structVersion: 1,
      entryId: entry.id,
      entryVersion: 1,
      fieldKey: 'body',
      fieldPath: ['body'],
      schemaVersion: 2,
      astVersion: 2,
      rendererSchemaVersion: 1,
      rendererSha256: rendererHash,
      rendererVersion: 1,
      consumerContract: null,
    },
  }
  // A worked canonical example fixes key order independently of server helpers.
  const canonicalPayload = JSON.stringify({
    document: {
      astVersion: 2,
      children: [
        {
          children: literalText.map((text) => ({
            marks: [],
            text,
            type: 'text',
          })),
          level: 1,
          type: 'heading',
        },
      ],
      type: 'document',
    },
    preview: {
      astVersion: 2,
      collectionId: collection.id,
      collectionVersion: 1,
      consumerContract: null,
      entryId: entry.id,
      entryVersion: 1,
      fieldKey: 'body',
      fieldPath: ['body'],
      html: expectedBody.html,
      rendererSchemaVersion: 1,
      rendererSha256: rendererHash,
      rendererVersion: 1,
      schemaVersion: 2,
      structId: model.id,
      structVersion: 1,
    },
    schemaVersion: 1,
  })
  expect(terminal.config.snapshotSha256).toBe(
    createHash('sha256').update(canonicalPayload, 'utf8').digest('hex'),
  )
  const runtimePath = '/run/literal-article-snapshot?secret=caller-data'
  expect((await request(runtimePath)).status).toBe(401)
  expect((await request(runtimePath, 'GET', undefined, '')).status).toBe(401)
  const called = await request(runtimePath, 'GET', undefined, key.token)
  expect(called.status).toBe(200)
  expect(called.headers.get('content-type')).toBe('application/json')
  expect(await called.json()).toEqual(expectedBody)

  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const loadResponse = await request('/api/load-tests', 'POST', {
    flowId: created.id,
  })
  expect(loadResponse.status).toBe(202)

  const load = await loadResponse.json()
  let finished = load
  for (let attempt = 0; attempt < 100; attempt++) {
    finished = await get('/api/load-tests/' + load.id)
    if (finished.status !== 'running') break
    await Bun.sleep(10)
  }
  expect(finished.status).toBe('completed')
  expect(loadReplies).toEqual([expectedBody])
  expect(
    (await get('/api/load-tests')).map((value: { id: string }) => value.id),
  ).toEqual([load.id])
  expect(await get('/api/load-tests', operator.token)).toEqual([])
  const hiddenLoad = await request(
    '/api/load-tests/' + load.id,
    'GET',
    undefined,
    operator.token,
  )
  expect(hiddenLoad.status).toBe(404)
  expect(await hiddenLoad.json()).toEqual({ error: 'Load test not found' })
  const loadAuditBefore = await get('/api/audit')
  const hiddenCancel = await request(
    '/api/load-tests/' + load.id + '/cancel',
    'POST',
    {},
    operator.token,
  )
  expect(hiddenCancel.status).toBe(404)
  expect(await hiddenCancel.json()).toEqual({ error: 'Load test not found' })
  expect(await get('/api/load-tests/' + load.id)).toEqual(finished)
  expect(await get('/api/audit')).toEqual(loadAuditBefore)

  const changedDocument = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'New source content', marks: [] }],
      },
    ],
  }
  const changedEntry = await request(entryPath, 'PUT', {
    version: 1,
    data: { body: changedDocument },
  })
  expect(changedEntry.status).toBe(200)
  expect((await changedEntry.json()).version).toBe(2)
  const changedRenderer = await request(rendererPath, 'PUT', {
    version: 1,
    renderer: {
      schemaVersion: 1,
      elements: { h1: { classes: ['later-heading'] } },
    },
  })
  expect(changedRenderer.status).toBe(200)
  expect((await changedRenderer.json()).version).toBe(2)
  expect(await get(runtimePath, key.token)).toEqual(expectedBody)

  if (server.app.server) await server.app.stop(true)
  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  expect(await get(runtimePath, key.token)).toEqual(expectedBody)
  expect(await get(flowPath)).toEqual(published)

  const backupResponse = await request('/api/backups', 'POST', {})
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const archive = new Uint8Array(await download.arrayBuffer())
  expect(archive.byteLength).toBe(backup.bytes)
  const restoredPath = join(directory, 'downloaded-restore.sqlite')
  writeFileSync(restoredPath, archive)

  for (let attempt = 0; attempt < 2; attempt++) {
    await server.close()
    server = createApp({
      databasePath: restoredPath,
      backupDir: join(directory, 'restored-backups'),
      runtimeCodeDir: join(directory, 'restored-runtime-' + attempt),
      adminToken: owner,
    })
    expect(await get(runtimePath, key.token)).toEqual(expectedBody)
    expect(await get(flowPath)).toEqual(published)
    expect(
      (await request(flowPath, 'GET', undefined, editor.token)).status,
    ).toBe(404)
    expect(
      (await get('/api/flows', editor.token)).map(
        (flow: { id: string }) => flow.id,
      ),
    ).not.toContain(created.id)
    const migrations = await get('/api/migrations')
    expect(
      migrations.filter(
        (migration: { version: number }) => migration.version === 28,
      ),
    ).toHaveLength(1)
  }

  // Tamper only a disposable downloaded copy; acceptance is observed at startup.
  const corruptPath = join(directory, 'declassified-restore.sqlite')
  writeFileSync(corruptPath, archive)
  const corrupt = new Database(corruptPath)
  try {
    const changed = corrupt
      .query('UPDATE flows SET cms = 0 WHERE id = ?')
      .run(created.id)
    if (changed.changes !== 1)
      throw new Error('Could not prepare corrupt restore fixture')
  } finally {
    corrupt.close()
  }

  let failedRestore: unknown
  let unexpectedServer: ReturnType<typeof createApp> | undefined
  try {
    unexpectedServer = createApp({
      databasePath: corruptPath,
      backupDir: join(directory, 'corrupt-backups'),
      runtimeCodeDir: join(directory, 'corrupt-runtime'),
      adminToken: owner,
    })
  } catch (reason) {
    failedRestore = reason
  } finally {
    await unexpectedServer?.close()
  }
  expect(failedRestore).toMatchObject({ status: 503 })
  expect(await get(runtimePath, key.token)).toEqual(expectedBody)

  const contentBeforeMigration = await contentSnapshot()
  const previousSchemaPath = join(
    directory,
    'representative-migration-27.sqlite',
  )
  writeFileSync(previousSchemaPath, archive)
  const previous = new Database(previousSchemaPath)
  try {
    // Reconstruct a preceding schema, not an archived old-release artifact.
    previous.run('PRAGMA foreign_keys = OFF')
    previous.query('DELETE FROM load_tests WHERE id = ?').run(load.id)
    previous.query('DELETE FROM runtime_keys WHERE flow_id = ?').run(created.id)
    previous
      .query('DELETE FROM backend_artifacts WHERE flow_id = ?')
      .run(created.id)
    previous.query('DELETE FROM releases WHERE flow_id = ?').run(created.id)
    previous.query('DELETE FROM flows WHERE id = ?').run(created.id)

    previous.run('DROP TABLE cms_snapshots')
    previous.run('ALTER TABLE flows DROP COLUMN cms')
    previous.run('DELETE FROM migrations WHERE version = 28')
  } finally {
    previous.close()
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    await server.close()
    server = createApp({
      databasePath: previousSchemaPath,
      backupDir: join(directory, 'migrated-backups'),
      runtimeCodeDir: join(directory, 'migrated-runtime-' + attempt),
      adminToken: owner,
    })
    expect(await get('/run/ordinary-pin-control', ordinaryKey.token)).toEqual({
      message: 'Hello, Besh!',
    })
    expect(await contentSnapshot()).toEqual(contentBeforeMigration)
    const migrations = await get('/api/migrations')
    expect(
      migrations.filter(
        (migration: { version: number }) => migration.version === 28,
      ),
    ).toHaveLength(1)
  }
})

test('a typed nested formatted snapshot stays literal after deleting its source entry', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Nested paragraph model',
    fields: [
      {
        key: 'items',
        label: 'Items',
        required: true,
        schema: {
          type: 'array',
          items: {
            type: 'object',
            fields: [
              {
                key: 'copy',
                label: 'Copy',
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
    name: 'Nested paragraphs',
    structId: model.id,
    structVersion: 1,
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
            text: '  Selected <b>literal</b> & ไทย $data  ',
            marks: [],
          },
        ],
      },
    ],
  }
  const entryResponse = await request(
    '/api/collections/' + collection.id + '/entries',
    'POST',
    {
      data: {
        items: [
          {
            copy: {
              type: 'document',
              astVersion: 2,
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      text: 'Private unselected content',
                      marks: [],
                    },
                  ],
                },
              ],
            },
          },
          { copy: document },
        ],
      },
    },
  )
  expect(entryResponse.status).toBe(200)
  const entry = await entryResponse.json()
  const entryPath = '/api/collections/' + collection.id + '/entries/' + entry.id
  const createdResponse = await request(entryPath + '/snapshot-flow', 'POST', {
    name: 'Selected nested paragraph',
    path: '/selected-paragraph',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 0,
    fieldPath: ['items', 1, 'copy'],
  })
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(
    (
      await request('/api/flows/' + created.id + '/publish', 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const keyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Nested paragraph caller',
    flowId: created.id,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  })
  expect(keyResponse.status).toBe(200)
  const key = await keyResponse.json()
  const result = await get(
    '/run/selected-paragraph?index=0&copy=caller',
    key.token,
  )
  expect(result.document).toEqual(document)
  expect(result.html).toBe(
    '<p>  Selected &lt;b&gt;literal&lt;/b&gt; &amp; ไทย $data  </p>',
  )
  expect(result.provenance).toMatchObject({
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    entryId: entry.id,
    entryVersion: 1,
    fieldKey: 'copy',
    fieldPath: ['items', 1, 'copy'],
    schemaVersion: 2,
    astVersion: 2,
    rendererVersion: 0,
    flowId: created.id,
    releaseRevision: 1,
  })
  expect(JSON.stringify(result)).not.toContain('Private unselected content')
  expect((await request(entryPath, 'DELETE', { version: 1 })).status).toBe(200)
  expect((await request(entryPath)).status).toBe(404)
  expect(await get('/run/selected-paragraph', key.token)).toEqual(result)
})

test('a root version-one paragraph snapshot preserves empty nodes and literal text', async () => {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Literal paragraph model',
    fields: [
      {
        key: 'body',
        label: 'Body',
        required: true,
        schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)
  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Literal paragraphs',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const document = {
    type: 'document',
    astVersion: 1,
    children: [
      { type: 'paragraph', children: [] },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '' },
          {
            type: 'text',
            text: '$input.query.copy <script>literal</script> & ไทย',
          },
          { type: 'text', text: '' },
        ],
      },
    ],
  }
  const entryResponse = await request(
    '/api/collections/' + collection.id + '/entries',
    'POST',
    { data: { body: document } },
  )
  expect(entryResponse.status).toBe(200)
  const entry = await entryResponse.json()
  const createdResponse = await request(
    '/api/collections/' +
      collection.id +
      '/entries/' +
      entry.id +
      '/snapshot-flow',
    'POST',
    {
      name: 'Literal paragraph API',
      path: '/literal-paragraph',
      collectionVersion: 1,
      entryVersion: 1,
      rendererVersion: 0,
      fieldPath: ['body'],
    },
  )
  expect(createdResponse.status).toBe(200)
  const created = await createdResponse.json()
  expect(
    (
      await request('/api/flows/' + created.id + '/publish', 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const keyResponse = await request('/api/runtime-keys', 'POST', {
    name: 'Literal paragraph caller',
    flowId: created.id,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  })
  expect(keyResponse.status).toBe(200)
  const key = await keyResponse.json()
  const result = await get(
    '/run/literal-paragraph?copy=caller-substitution',
    key.token,
  )
  expect(result.document).toEqual(document)
  expect(result.html).toBe(
    '<p></p><p>$input.query.copy &lt;script&gt;literal&lt;/script&gt; &amp; ไทย</p>',
  )
  expect(result.provenance).toMatchObject({
    schemaVersion: 1,
    astVersion: 1,
    rendererVersion: 0,
    fieldPath: ['body'],
    entryVersion: 1,
    releaseRevision: 1,
  })
})
