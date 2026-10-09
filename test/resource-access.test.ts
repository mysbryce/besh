import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { Database } from 'bun:sqlite'
import { helloFlow } from './fixtures'

const owner = 'resource-access-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-resource-access-'))
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...overrides,
  }
  let server = createApp(options)
  cleanup.push(async () => {
    if (server.app.server) await server.app.stop(true)
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
    headers: Record<string, string> = {},
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined || body instanceof FormData
            ? {}
            : { 'content-type': 'application/json' }),
        },
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
      }),
    )
  return {
    request,
    server: () => server,
    async reopen() {
      await server.close()
      server = createApp(options)
    },
  }
}

const none = { sources: [], databaseConnections: [], authConnections: [] }

test('publish-only selected responses expose publication metadata and hide an unrelated current draft on rollback', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Publication operator',
      permissions: ['flows.publish'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Publisher',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  const published = await request(
    `/api/flows/${flow.id}/publish`,
    'POST',
    { revision: 1 },
    member.token,
  )
  expect(published.status).toBe(200)
  expect(await published.json()).toEqual({
    id: flow.id,
    revision: 1,
    publishedRevision: 1,
    publishedEndpoint: {
      method: 'GET',
      path: '/hello',
      graphql: false,
      transport: 'rest',
    },
  })
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...helloFlow,
    path: '/hello-two',
    revision: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  const upload = new FormData()
  upload.set('name', 'Owner private source')
  upload.set('file', new File(['name\nOwner private row\n'], 'private.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const privateDraft = {
    ...helloFlow,
    name: 'Private draft name',
    nodes: [
      ...helloFlow.nodes,
      {
        id: 'private-dependency',
        type: 'data',
        position: { x: 300, y: 300 },
        config: { sourceId: source.id, columns: ['name'], limit: 10 },
      },
    ],
    revision: 2,
  }
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', privateDraft)).status,
  ).toBe(200)
  const rollback = await request(
    `/api/flows/${flow.id}/rollback`,
    'POST',
    { revision: 1, publishedRevision: 2 },
    member.token,
  )
  expect(rollback.status).toBe(200)
  expect(await rollback.json()).toEqual({
    id: flow.id,
    revision: 3,
    publishedRevision: 1,
    publishedEndpoint: {
      method: 'GET',
      path: '/hello',
      graphql: false,
      transport: 'rest',
    },
  })
  const saved = await (await request(`/api/flows/${flow.id}`)).json()
  expect(saved.name).toBe('Private draft name')
  expect(
    saved.nodes.some((node: { type: string }) => node.type === 'data'),
  ).toBe(true)
})

test('selected stale issuance pins reject before inspecting a newer ungranted dependency', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Pinned issuer',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Issuer',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  const upload = new FormData()
  upload.set('name', 'New private source')
  upload.set('file', new File(['name\nPrivate Ada\n'], 'private.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const reading = {
    ...helloFlow,
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'rows',
        type: 'data',
        position: { x: 200, y: 200 },
        config: { sourceId: source.id, columns: ['name'], limit: 10 },
      },
      { ...helloFlow.nodes[1], config: { status: 200, body: '$data' } },
    ],
    edges: [
      { id: 'a', source: 'request', target: 'rows' },
      { id: 'b', source: 'rows', target: 'response' },
    ],
    revision: 1,
  }
  expect((await request(`/api/flows/${flow.id}`, 'PUT', reading)).status).toBe(
    200,
  )
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const settings = {
    name: 'Stale key',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  }
  const before = await (await request('/api/audit')).json()
  expect(
    (await request('/api/runtime-keys', 'POST', settings, member.token)).status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action !== 'access.denied',
    ),
  ).toEqual(before)
})

test('strict access updates preserve legacy USE grants and reject stale or incompatible changes atomically', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Contacts')
  upload.set('file', new File(['name\nAda\n'], 'contacts.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const createdRole = await request('/api/roles', 'POST', {
    name: 'Scoped editor',
    permissions: ['flows.write'],
  })
  expect(createdRole.status).toBe(200)
  const role = await createdRole.json()
  const profile = {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: { ...none, sources: [source.id] },
  }
  const createdMember = await request('/api/members', 'POST', {
    name: 'Editor',
    role: 'custom',
    roleId: role.id,
    access: profile,
  })
  expect(createdMember.status).toBe(200)
  const member = await createdMember.json()
  const before = (await (await request('/api/audit')).json()).filter(
    (event: { action: string }) => event.action === 'member.access.updated',
  ).length
  for (const input of [
    { ...profile, version: 0 },
    { ...profile, version: 1, unknown: true },
    { ...profile, version: 1, flowIds: [flow.id, flow.id] },
    { ...profile, version: 1, dependencyUse: { sources: [source.id] } },
    {
      ...profile,
      version: 1,
      dependencyUse: { ...none, sources: Array(257).fill(source.id) },
    },
    { mode: 'all', version: 1, flowIds: [] },
  ]) {
    expect(
      (await request(`/api/members/${member.id}/access`, 'PUT', input)).status,
    ).toBe(400)
  }
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Invalid duplicate scope',
        role: 'viewer',
        access: { mode: 'all' },
        flowAccess: { mode: 'all' },
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        ...profile,
        version: 1,
        dependencyUse: { ...none, sources: ['missing'] },
      })
    ).status,
  ).toBe(404)
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: ['flows.write', 'sources.read'],
        version: role.version,
      })
    ).status,
  ).toBe(409)
  expect(
    (await request(`/api/members/${member.id}/role`, 'PUT', { role: 'editor' }))
      .status,
  ).toBe(409)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .access,
  ).toEqual({ ...profile, version: 1 })
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action === 'member.access.updated',
    ).length,
  ).toBe(before)

  const legacy = await request(`/api/members/${member.id}/flow-access`, 'PUT', {
    mode: 'selected',
    flowIds: [],
    version: 1,
  })
  expect(legacy.status).toBe(200)
  expect((await legacy.json()).access).toEqual({
    ...profile,
    flowIds: [],
    version: 2,
  })
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        ...profile,
        version: 1,
      })
    ).status,
  ).toBe(409)
  const all = await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'all',
    version: 2,
  })
  expect((await all.json()).flowAccess).toEqual({
    mode: 'all',
    flowIds: [],
    version: 3,
  })
  const selectedAgain = await request(
    `/api/members/${member.id}/flow-access`,
    'PUT',
    { mode: 'selected', flowIds: [flow.id], version: 3 },
  )
  expect((await selectedAgain.json()).access).toEqual({
    ...profile,
    dependencyUse: none,
    version: 4,
  })
})

test('owner manages a versioned operational access profile without granting dependency previews', async () => {
  const { request, reopen } = workspace()
  expect((await (await request('/api/me')).json()).access).toEqual({
    mode: 'all',
    flowIds: [],
    dependencyUse: none,
    version: 1,
  })
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'API collaborator',
      permissions: ['flows.read', 'flows.write', 'flows.test', 'flows.publish'],
    })
  ).json()
  const created = await request('/api/members', 'POST', {
    name: 'Collaborator',
    role: 'custom',
    roleId: role.id,
    access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(member.access).toEqual({
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 1,
  })
  expect(member.flowAccess).toEqual({
    mode: 'selected',
    flowIds: [flow.id],
    version: 1,
  })
  const changed = await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [],
    dependencyUse: none,
    version: 1,
  })
  expect(changed.status).toBe(200)
  expect((await changed.json()).access.version).toBe(2)
  await reopen()
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .access,
  ).toEqual({ mode: 'selected', flowIds: [], dependencyUse: none, version: 2 })
})

test('dependency-use catalog exposes only allowed structure and preserves all-member read gates', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Private contacts')
  upload.set('file', new File(['name,age\nAda,36\n'], 'contacts.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Draft tester',
      permissions: ['flows.test'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Tester',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [],
        dependencyUse: { ...none, sources: [source.id] },
      },
    })
  ).json()
  const catalog = await request(
    '/api/dependencies/sources',
    'GET',
    undefined,
    member.token,
  )
  expect(catalog.status).toBe(200)
  expect(await catalog.json()).toEqual([
    { id: source.id, name: source.name, version: 1, columns: source.columns },
  ])
  expect(
    (
      await request(
        `/api/dependencies/sources/${source.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/dependencies/database-connections',
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/dependencies/auth-connections',
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(403)
  const unshared = await request(
    '/api/dependencies/sources/not-shared',
    'GET',
    undefined,
    member.token,
  )
  expect(unshared.status).toBe(404)
  expect(await unshared.json()).toEqual({ error: 'Dependency not found' })
  const allTester = await (
    await request('/api/members', 'POST', {
      name: 'All tester',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  expect(
    (
      await request(
        '/api/dependencies/sources',
        'GET',
        undefined,
        allTester.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request(`/api/data-sources/${source.id}`, 'DELETE')).status,
  ).toBe(409)
})

test('selected operators edit test publish and roll back existing APIs only with every dependency granted', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Contacts')
  upload.set('file', new File(['name,age\nAda,36\n'], 'contacts.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Operator',
      permissions: ['flows.read', 'flows.write', 'flows.test', 'flows.publish'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Operator',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  const reading = {
    ...helloFlow,
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'data',
        type: 'data',
        position: { x: 200, y: 100 },
        config: { sourceId: source.id, columns: ['name'], limit: 10 },
      },
      { ...helloFlow.nodes[1], config: { status: 200, body: '$data' } },
    ],
    edges: [
      { id: 'a', source: 'request', target: 'data' },
      { id: 'b', source: 'data', target: 'response' },
    ],
  }
  expect(
    (
      await request(
        `/api/flows/${flow.id}`,
        'PUT',
        { ...reading, revision: 1 },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/flows', 'POST', helloFlow, member.token)).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/api`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(403)
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: { ...none, sources: [source.id] },
    version: 1,
  })
  const saved = await request(
    `/api/flows/${flow.id}`,
    'PUT',
    { ...reading, revision: 1 },
    member.token,
  )
  expect(saved.status).toBe(200)
  const tested = await request(
    `/api/flows/${flow.id}/test`,
    'POST',
    { body: {}, query: {} },
    member.token,
  )
  expect(tested.status).toBe(200)
  expect((await tested.json()).body).toEqual([{ name: 'Ada' }])
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 2 },
        member.token,
      )
    ).status,
  ).toBe(200)
  await request(
    `/api/flows/${flow.id}`,
    'PUT',
    { ...helloFlow, revision: 2 },
    member.token,
  )
  await request(
    `/api/flows/${flow.id}/publish`,
    'POST',
    { revision: 3 },
    member.token,
  )
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 2,
  })
  expect(
    (
      await request(
        `/api/flows/${flow.id}/rollback`,
        'POST',
        { revision: 2, publishedRevision: 3 },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
  ).toBe(3)
})

test('selected-issued caller keys bind live issuer authority and preserve it through owner replacement', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Selected key manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Manager',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  const input = {
    name: 'Scoped client',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  }
  const issued = await request('/api/runtime-keys', 'POST', input, member.token)
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(key.issuerBinding).toEqual({
    memberId: member.id,
    action: 'runtime-keys.manage',
  })
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
  const legacy = await (
    await request('/api/runtime-keys', 'POST', {
      ...input,
      name: 'Independent owner client',
    })
  ).json()
  expect(legacy.issuerBinding).toBeNull()
  expect(
    (
      await request(
        `/api/runtime-keys/${legacy.id}/rotate`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await (
        await request('/api/runtime-keys', 'GET', undefined, member.token)
      ).json()
    ).map((entry: { id: string }) => entry.id),
  ).toEqual([key.id])
  expect(
    (
      await request(
        '/api/runtime-keys',
        'POST',
        { ...input, releaseRevision: undefined },
        member.token,
      )
    ).status,
  ).toBe(400)
  const replacement = await (
    await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})
  ).json()
  expect(replacement.issuerBinding).toEqual(key.issuerBinding)
  expect(replacement.expiresAt).toBe(key.expiresAt)
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [],
    dependencyUse: none,
    version: 1,
  })
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(403)
  expect(
    (await request('/run/hello', 'GET', undefined, legacy.token)).status,
  ).toBe(200)
  expect(
    (await request(`/api/runtime-keys/${replacement.id}/rotate`, 'POST', {}))
      .status,
  ).toBe(409)
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 2,
  })
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(200)
  await request(`/api/members/${member.id}`, 'DELETE')
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(403)
  expect(
    (await (await request('/api/runtime-keys')).json()).find(
      (entry: { id: string }) => entry.id === replacement.id,
    ).issuerBinding,
  ).toEqual(key.issuerBinding)
})

test('selected k6 jobs bind load authority and keep scoped cleanup possible after USE removal', async () => {
  let workerToken = ''
  let begin!: () => void
  const entered = new Promise<void>((resolve) => {
    begin = resolve
  })
  const { request, server } = workspace({
    k6Runner: async (plan, signal) => {
      workerToken = plan.token
      begin()
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
      throw new Error('Stopped')
    },
  })
  server().app.listen(0)
  const upload = new FormData()
  upload.set('name', 'Contacts')
  upload.set('file', new File(['name\nAda\n'], 'contacts.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Rows',
      path: '/rows',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Load runner',
      permissions: ['load-tests.run'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Runner',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: { ...none, sources: [source.id] },
      },
    })
  ).json()
  const targets = await request(
    '/api/load-tests/targets',
    'GET',
    undefined,
    member.token,
  )
  expect(targets.status).toBe(200)
  expect(
    (await targets.json()).map((target: { id: string }) => target.id),
  ).toEqual([flow.id])
  const started = await request(
    '/api/load-tests',
    'POST',
    { flowId: flow.id },
    member.token,
  )
  expect(started.status).toBe(202)
  const run = await started.json()
  await entered
  const managed = (await (await request('/api/runtime-keys')).json()).find(
    (key: { managedBy?: string }) => key.managedBy === 'load-test',
  )
  expect(managed.issuerBinding).toEqual({
    memberId: member.id,
    action: 'load-tests.run',
  })
  expect(managed.releaseRevision).toBe(1)
  expect(
    (await request('/run/rows', 'GET', undefined, workerToken)).status,
  ).toBe(200)
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 1,
  })
  expect(
    (await request('/run/rows', 'GET', undefined, workerToken)).status,
  ).toBe(403)
  expect(
    await (
      await request('/api/load-tests/targets', 'GET', undefined, member.token)
    ).json(),
  ).toEqual([])
  expect(
    (await request(`/api/load-tests/${run.id}`, 'GET', undefined, member.token))
      .status,
  ).toBe(200)
  const cleaner = await (
    await request('/api/members', 'POST', {
      name: 'Cleanup operator',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  expect(
    (
      await request(
        `/api/load-tests/${run.id}/cancel`,
        'POST',
        {},
        cleaner.token,
      )
    ).status,
  ).toBe(200)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.find(
      (event: { action: string }) => event.action === 'load-test.canceled',
    ).actor,
  ).toBe(cleaner.id)
})

test('revoking OAuth dependency use during exchange prevents the next provider effect and identity disclosure', async () => {
  const calls: string[] = []
  let enter!: () => void
  let release!: () => void
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const { request } = workspace({
    oauthFetch: async (url) => {
      calls.push(url)
      if (url.includes('access_token')) {
        enter()
        await waiting
        return Response.json({
          access_token: 'private-provider-token',
          token_type: 'bearer',
        })
      }
      return Response.json({
        id: 1,
        login: 'ada',
        name: 'Private identity',
        avatar_url: null,
      })
    },
  })
  const connection = await (
    await request('/api/auth-connections', 'POST', {
      name: 'GitHub',
      provider: 'github',
      clientId: 'client',
      clientSecret: 'private-secret',
      redirectUri: 'https://product.example/callback',
    })
  ).json()
  const flow = await (
    await request(`/api/auth-connections/${connection.id}/generate`, 'POST', {
      name: 'Login',
      path: '/login',
      kind: 'rest',
    })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Login tester',
      permissions: ['flows.test'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Tester',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: { ...none, authConnections: [connection.id] },
      },
    })
  ).json()
  const attempt = await (
    await request(
      `/api/flows/${flow.id}/test`,
      'POST',
      { body: { action: 'BEGIN' }, query: {} },
      member.token,
    )
  ).json()
  const pending = request(
    `/api/flows/${flow.id}/test`,
    'POST',
    {
      body: {
        action: 'COMPLETE',
        code: 'code',
        state: attempt.body.state,
        proof: attempt.body.proof,
      },
      query: {},
    },
    member.token,
  )
  await entered
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 1,
  })
  release()
  const response = await pending
  expect(calls).toEqual(['https://github.com/login/oauth/access_token'])
  expect(response.status).toBe(404)
  expect(JSON.stringify(await response.json())).not.toContain(
    'Private identity',
  )
})

test('scoped credential errors hide inaccessible IDs before settings and preserve cleanup after use loss', async () => {
  const { request } = workspace()
  const visible = await (await request('/api/flows', 'POST', helloFlow)).json()
  const hidden = await (
    await request('/api/flows', 'POST', { ...helloFlow, path: '/hidden' })
  ).json()
  await request(`/api/flows/${visible.id}/publish`, 'POST', { revision: 1 })
  await request(`/api/flows/${hidden.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Scoped keys',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const issuer = await (
    await request('/api/members', 'POST', {
      name: 'Other issuer',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [hidden.id], dependencyUse: none },
    })
  ).json()
  const manager = await (
    await request('/api/members', 'POST', {
      name: 'Manager',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [visible.id], dependencyUse: none },
    })
  ).json()
  const key = await (
    await request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'Private',
        flowId: hidden.id,
        releaseRevision: 1,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
      issuer.token,
    )
  ).json()
  const denied = await request(
    `/api/runtime-keys/${key.id}/rotate`,
    'POST',
    { invalid: true },
    manager.token,
  )
  const missing = await request(
    '/api/runtime-keys/missing/rotate',
    'POST',
    { invalid: true },
    manager.token,
  )
  expect(denied.status).toBe(404)
  expect(await denied.json()).toEqual(await missing.json())
  expect(
    (
      await request(
        '/api/runtime-keys',
        'POST',
        {
          name: '',
          flowId: hidden.id,
          releaseRevision: 0,
          expiresAt: 'invalid',
          permissions: ['rest'],
        },
        manager.token,
      )
    ).status,
  ).toBe(404)
})

test('bound GraphQL callers check current issuer actions and USE before parsing private input', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'People')
  upload.set('file', new File(['name\nPrivate Ada\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'People',
      path: '/private-people',
      protocol: 'graphql',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Query issuer',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const profile = {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: { ...none, sources: [source.id] },
  }
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Issuer',
      role: 'custom',
      roleId: role.id,
      access: profile,
    })
  ).json()
  const settings = {
    name: 'Query client',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['query'],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  }
  expect(
    (
      await request(
        '/api/runtime-keys',
        'POST',
        { ...settings, issuerBinding: null },
        member.token,
      )
    ).status,
  ).toBe(400)
  const issued = await request(
    '/api/runtime-keys',
    'POST',
    settings,
    member.token,
  )
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const valid = await request(
    '/graphql/private-people',
    'POST',
    { query: 'query { rows { name } }' },
    key.token,
  )
  expect(valid.status).toBe(200)
  expect((await valid.json()).data).toEqual({ rows: [{ name: 'Private Ada' }] })
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: [],
        version: 1,
      })
    ).status,
  ).toBe(200)
  const deniedAction = await request(
    '/graphql/private-people',
    'POST',
    { query: 'invalid query' },
    key.token,
  )
  expect(deniedAction.status).toBe(403)
  expect(await deniedAction.json()).toEqual({
    errors: [{ message: 'Runtime key issuer no longer authorizes this API' }],
  })
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: ['runtime-keys.manage'],
        version: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        ...profile,
        dependencyUse: none,
        version: 1,
      })
    ).status,
  ).toBe(200)
  const deniedUse = await request(
    '/graphql/private-people',
    'POST',
    { query: 'invalid query' },
    key.token,
  )
  expect(deniedUse.status).toBe(403)
  expect(await deniedUse.json()).toEqual({
    errors: [{ message: 'Runtime key issuer no longer authorizes this API' }],
  })
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (event: { action: string }) => event.action === 'graphql.executed',
    ),
  ).toHaveLength(1)
})

test('typed SQLite and OAuth use catalogs authorize structures and real reads without global resource access', async () => {
  const { request } = workspace()
  const fixture = new Database(':memory:')
  fixture.run(
    "CREATE TABLE people (id INTEGER, name TEXT); INSERT INTO people VALUES (1, 'Private Ada')",
  )
  const bytes = fixture.serialize()
  fixture.close()
  const upload = new FormData()
  upload.set('name', 'People copy')
  upload.set('file', new File([new Uint8Array(bytes)], 'people.sqlite'))
  const connection = await (
    await request('/api/database-connections', 'POST', upload)
  ).json()
  const auth = await (
    await request('/api/auth-connections', 'POST', {
      name: 'Product login',
      provider: 'github',
      clientId: 'private-client-id',
      clientSecret: 'private-secret-value',
      redirectUri: 'https://product.example/private-callback',
    })
  ).json()
  const flow = await (
    await request(`/api/database-connections/${connection.id}/api`, 'POST', {
      version: 1,
      table: 'people',
      name: 'People API',
      path: '/people',
      protocol: 'graphql',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Database tester',
      permissions: ['flows.read', 'flows.test'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Tester',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          ...none,
          databaseConnections: [connection.id],
          authConnections: [auth.id],
        },
      },
    })
  ).json()
  const catalog = await (
    await request(
      '/api/dependencies/database-connections',
      'GET',
      undefined,
      member.token,
    )
  ).json()
  expect(catalog).toEqual([
    {
      id: connection.id,
      name: connection.name,
      version: 1,
      tables: connection.tables.map(
        (table: { name: string; columns: unknown }) => ({
          name: table.name,
          columns: table.columns,
        }),
      ),
    },
  ])
  expect(
    await (
      await request(
        '/api/dependencies/auth-connections',
        'GET',
        undefined,
        member.token,
      )
    ).json(),
  ).toEqual([{ id: auth.id, name: auth.name, version: 1, provider: 'github' }])
  expect(JSON.stringify(catalog)).not.toContain('Private Ada')
  expect(
    (
      await request(
        `/api/database-connections/${connection.id}/preview`,
        'POST',
        { version: 1, table: 'people', columns: ['name'], limit: 10 },
        member.token,
      )
    ).status,
  ).toBe(403)
  const result = await request(
    `/api/flows/${flow.id}/graphql/test`,
    'POST',
    { query: 'query { rows { name } }' },
    member.token,
  )
  expect(result.status).toBe(200)
  expect((await result.json()).body.data).toEqual({
    rows: [{ name: 'Private Ada' }],
  })
  expect(
    (
      await request(`/api/database-connections/${connection.id}`, 'DELETE', {
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (await request(`/api/auth-connections/${auth.id}`, 'DELETE')).status,
  ).toBe(409)
  const count = (await (await request('/api/members')).json()).length
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Wrong family',
        role: 'custom',
        roleId: role.id,
        access: {
          mode: 'selected',
          flowIds: [flow.id],
          dependencyUse: { ...none, sources: [connection.id] },
        },
      })
    ).status,
  ).toBe(404)
  expect((await (await request('/api/members')).json()).length).toBe(count)
})

test('dependency authorization covers unreachable nodes and archived pinned releases before validation', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Contacts')
  upload.set('file', new File(['name\nAda\n'], 'contacts.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Rows',
      path: '/rows',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Publisher and keys',
      permissions: [
        'flows.write',
        'flows.test',
        'flows.publish',
        'runtime-keys.manage',
      ],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Issuer',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: { ...none, sources: [source.id] },
      },
    })
  ).json()
  const input = {
    name: 'Pinned rows',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  }
  const key = await (
    await request('/api/runtime-keys', 'POST', input, member.token)
  ).json()
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...helloFlow,
    path: '/rows',
    revision: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  const other = await (
    await request('/api/members', 'POST', {
      name: 'Other manager',
      role: 'custom',
      roleId: role.id,
      access: { mode: 'selected', flowIds: [flow.id], dependencyUse: none },
    })
  ).json()
  expect(
    (
      await request(
        `/api/runtime-keys/${key.id}/rotate`,
        'POST',
        {},
        other.token,
      )
    ).status,
  ).toBe(404)
  const replacement = await request(
    `/api/runtime-keys/${key.id}/rotate`,
    'POST',
    {},
    member.token,
  )
  expect(replacement.status).toBe(200)
  const replaced = await replacement.json()
  expect(replaced.releaseRevision).toBe(1)
  expect(
    (await request('/run/rows', 'GET', undefined, replaced.token)).status,
  ).toBe(403)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  expect(
    (await request('/run/rows', 'GET', undefined, replaced.token)).status,
  ).toBe(200)
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: none,
    version: 1,
  })
  const isolated = {
    ...helloFlow,
    nodes: [
      ...helloFlow.nodes,
      {
        id: 'unreached',
        type: 'data',
        position: { x: 300, y: 300 },
        config: { sourceId: source.id, columns: ['unknown_column'], limit: 10 },
      },
    ],
  }
  expect(
    (
      await request(
        `/api/flows/${flow.id}`,
        'PUT',
        { ...isolated, revision: 2 },
        member.token,
      )
    ).status,
  ).toBe(404)
  await request(`/api/flows/${flow.id}`, 'PUT', { ...isolated, revision: 2 })
  expect(
    (
      await request(
        `/api/flows/${flow.id}/test`,
        'POST',
        { body: {}, query: {} },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 3 },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/runtime-keys/${replaced.id}`,
        'DELETE',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
})
