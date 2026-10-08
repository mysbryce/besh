import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const owner = 'roles-owner-token-at-least-32-characters-long'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-roles-'))
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...overrides,
  }
  let server = createApp(options)
  cleanup.push(() => {
    server.close()
    if (server.app.server) void server.app.stop(true)
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
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
          ...(body !== undefined && !(body instanceof FormData)
            ? { 'content-type': 'application/json' }
            : {}),
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
    options,
    server: () => server,
    reopen() {
      server.close()
      server = createApp(options)
    },
  }
}

test('owners create custom roles with an explicit catalog while built-in grants remain unchanged', async () => {
  const { request } = workspace()
  const catalogResponse = await request('/api/permissions')
  expect(catalogResponse.status).toBe(200)
  const catalog = await catalogResponse.json()
  expect(catalog.map((entry: { id: string }) => entry.id)).toEqual([
    'flows.read',
    'flows.write',
    'flows.test',
    'flows.publish',
    'sources.read',
    'sources.write',
    'database-connections.read',
    'database-connections.manage',
    'auth-connections.read',
    'auth-connections.manage',
    'runtime-keys.manage',
    'audit.read',
    'backups.manage',
    'migrations.read',
    'load-tests.run',
  ])
  const created = await request('/api/roles', 'POST', {
    name: 'API reviewer',
    permissions: ['flows.read', 'flows.test'],
  })
  expect(created.status).toBe(200)
  const role = await created.json()
  expect(role).toMatchObject({
    name: 'API reviewer',
    permissions: ['flows.read', 'flows.test'],
    version: 1,
  })
  expect(role.id).toBeString()
  expect(role.createdAt).toBeString()
  expect(role.updatedAt).toBe(role.createdAt)
  expect(await (await request('/api/roles')).json()).toEqual([role])
  expect((await (await request('/api/me')).json()).permissions).toEqual(
    catalog.map((entry: { id: string }) => entry.id),
  )
  const editor = await (
    await request('/api/members', 'POST', { name: 'Editor', role: 'editor' })
  ).json()
  expect(editor.permissions).toEqual([
    'flows.read',
    'flows.write',
    'flows.test',
    'sources.read',
    'sources.write',
    'auth-connections.read',
  ])
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  expect(viewer.permissions).toEqual(['flows.read'])
})

test('custom members receive only chosen actions with one-time atomic credential creation', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Draft writer',
      permissions: ['flows.write'],
    })
  ).json()
  const created = await request('/api/members', 'POST', {
    name: 'Writer',
    role: 'custom',
    roleId: role.id,
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(member).toMatchObject({
    name: 'Writer',
    role: 'custom',
    roleId: role.id,
    roleName: 'Draft writer',
    permissions: ['flows.write'],
  })
  const me = await (
    await request('/api/me', 'GET', undefined, member.token)
  ).json()
  expect(me).toEqual({
    id: member.id,
    name: member.name,
    role: 'custom',
    roleId: role.id,
    roleName: role.name,
    permissions: ['flows.write'],
    flowAccess: { mode: 'all', flowIds: [], version: 1 },
  })
  const flowResponse = await request(
    '/api/flows',
    'POST',
    helloFlow,
    member.token,
  )
  expect(flowResponse.status).toBe(200)
  const flow = await flowResponse.json()
  for (const path of [
    '/api/flows',
    `/api/flows/${flow.id}`,
    `/api/flows/${flow.id}/releases`,
    '/api/roles',
    '/api/members',
    '/api/data-sources',
    '/api/auth-connections',
    '/api/audit',
    '/api/runtime-keys',
    '/api/backups',
    '/api/migrations',
    '/api/load-tests/targets',
  ])
    expect((await request(path, 'GET', undefined, member.token)).status).toBe(
      403,
    )
  expect(
    (
      await request(
        `/api/flows/${flow.id}/test`,
        'POST',
        { body: null, query: {} },
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 1 },
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/api/members',
        'POST',
        { name: 'Denied', role: 'viewer' },
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/permissions', 'GET', undefined, member.token)).status,
  ).toBe(200)
  expect(
    JSON.stringify(await (await request('/api/members')).json()),
  ).not.toContain(member.token)
})

test('role grant changes revoke cookies atomically while bearer keys resolve current grants', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Draft editors',
      permissions: ['flows.read', 'flows.write'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Editor',
      role: 'custom',
      roleId: role.id,
      email: 'editor@example.com',
      password: 'safe-password-for-editor',
    })
  ).json()
  const login = await request(
    '/auth/login',
    'POST',
    { email: 'editor@example.com', password: 'safe-password-for-editor' },
    '',
    { origin: 'http://localhost' },
  )
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  expect(session.member).toMatchObject({
    role: 'custom',
    roleId: role.id,
    permissions: ['flows.read', 'flows.write'],
  })
  const renamed = await request(`/api/roles/${role.id}`, 'PUT', {
    name: 'Renamed editors',
    permissions: role.permissions,
    version: 1,
  })
  expect(renamed.status).toBe(200)
  expect(
    (await request('/auth/session', 'GET', undefined, '', { cookie })).status,
  ).toBe(200)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .roleName,
  ).toBe('Renamed editors')
  const changed = await request(`/api/roles/${role.id}`, 'PUT', {
    name: 'Readers only',
    permissions: ['flows.read'],
    version: 2,
  })
  expect(changed.status).toBe(200)
  expect((await changed.json()).version).toBe(3)
  expect(
    (await request('/auth/session', 'GET', undefined, '', { cookie })).status,
  ).toBe(401)
  expect(
    (await request('/api/flows', 'GET', undefined, member.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/flows', 'POST', helloFlow, member.token)).status,
  ).toBe(403)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .permissions,
  ).toEqual(['flows.read'])
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'role.updated',
    ),
  ).toHaveLength(2)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'session.revoked',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(events)).not.toContain(member.token)
})

test('owners assign built-in or custom roles and referenced roles cannot be deleted', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Auditors',
      permissions: ['audit.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  const login = await request(
    '/auth/login',
    'POST',
    { token: member.token },
    '',
    { origin: 'http://localhost' },
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const assigned = await request(`/api/members/${member.id}/role`, 'PUT', {
    role: 'custom',
    roleId: role.id,
  })
  expect(assigned.status).toBe(200)
  expect(await assigned.json()).toMatchObject({
    role: 'custom',
    roleId: role.id,
    roleName: 'Auditors',
    permissions: ['audit.read'],
  })
  expect(
    (await request('/auth/session', 'GET', undefined, '', { cookie })).status,
  ).toBe(401)
  expect(
    (await request('/api/audit', 'GET', undefined, member.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/flows', 'GET', undefined, member.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/roles/${role.id}`, 'DELETE', { version: 1 })).status,
  ).toBe(409)
  expect(
    (await request(`/api/members/${member.id}/role`, 'PUT', { role: 'editor' }))
      .status,
  ).toBe(200)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .roleId,
  ).toBeUndefined()
  expect(
    (await request('/api/flows', 'POST', helloFlow, member.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/audit', 'GET', undefined, member.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/roles/${role.id}`, 'DELETE', { version: 1 })).status,
  ).toBe(200)
  expect(await (await request('/api/roles')).json()).toEqual([])
  expect(
    (await request(`/api/members/owner/role`, 'PUT', { role: 'viewer' }))
      .status,
  ).toBe(409)
  expect((await (await request('/api/me')).json()).role).toBe('owner')
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'member.role.updated',
    ),
  ).toHaveLength(2)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'role.deleted',
    ),
  ).toHaveLength(1)
})

test('role settings and assignments reject invalid, stale, missing and reserved values without partial changes', async () => {
  const { request } = workspace()
  for (const value of [
    { name: '', permissions: [] },
    { name: 'Owner', permissions: [] },
    { name: 'editor', permissions: [] },
    { name: 'viewer', permissions: [] },
    { name: 'Bad\nname', permissions: [] },
    { name: 'x'.repeat(81), permissions: [] },
    { name: 'No catalog', permissions: ['members.manage'] },
    { name: 'Duplicate', permissions: ['flows.read', 'flows.read'] },
    { name: 'Bad grant', permissions: [null] },
    { name: 'Extra', permissions: [], role: 'owner' },
    { name: 'No grants' },
  ])
    expect((await request('/api/roles', 'POST', value)).status).toBe(400)
  expect(await (await request('/api/roles')).json()).toEqual([])
  const role = await (
    await request('/api/roles', 'POST', { name: 'Empty', permissions: [] })
  ).json()
  expect(
    (await request('/api/roles', 'POST', { name: 'empty', permissions: [] }))
      .status,
  ).toBe(409)
  const member = await (
    await request('/api/members', 'POST', {
      name: 'No access',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  expect(
    (await request('/api/flows', 'GET', undefined, member.token)).status,
  ).toBe(403)
  const membersBefore = await (await request('/api/members')).json()
  for (const assignment of [
    { role: 'custom' },
    { role: 'owner' },
    { role: 'viewer', roleId: role.id },
    { role: 'editor', permissions: ['flows.publish'] },
    { role: 'custom', roleId: role.id, permissions: [] },
  ]) {
    expect(
      (await request(`/api/members/${member.id}/role`, 'PUT', assignment))
        .status,
    ).toBe(400)
    expect(
      (await request('/api/members', 'POST', { name: 'Bad', ...assignment }))
        .status,
    ).toBe(400)
  }
  expect(
    (
      await request(`/api/members/${member.id}/role`, 'PUT', {
        role: 'custom',
        roleId: 'missing',
      })
    ).status,
  ).toBe(404)
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Missing role',
        role: 'custom',
        roleId: 'missing',
        email: 'missing@example.com',
        password: 'safe-password-for-missing',
      })
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/members/missing/role', 'PUT', { role: 'viewer' }))
      .status,
  ).toBe(404)
  expect(await (await request('/api/members')).json()).toEqual(membersBefore)
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: 'Readers',
        permissions: ['flows.read'],
        version: 1,
      })
    ).status,
  ).toBe(200)
  for (const value of [
    { name: 'Overwrite', permissions: [], version: 1 },
    { name: 'Overwrite', permissions: [], version: 2, extra: true },
    { name: 'Overwrite', permissions: [], version: '2' },
    { name: 'Overwrite', permissions: [], version: 0 },
  ]) {
    const expected = value.version === 1 ? 409 : 400
    expect((await request(`/api/roles/${role.id}`, 'PUT', value)).status).toBe(
      expected,
    )
  }
  expect(
    (await request(`/api/roles/${role.id}`, 'DELETE', { version: 1 })).status,
  ).toBe(409)
  for (const body of [
    undefined,
    {},
    { version: '2' },
    { version: 2, extra: true },
  ])
    expect(
      (await request(`/api/roles/${role.id}`, 'DELETE', body)).status,
    ).toBe(400)
  expect(
    (
      await request('/api/roles/missing', 'PUT', {
        name: 'Missing',
        permissions: [],
        version: 1,
      })
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/roles/missing', 'DELETE', { version: 1 })).status,
  ).toBe(404)
  expect((await (await request('/api/roles')).json())[0]).toMatchObject({
    name: 'Readers',
    permissions: ['flows.read'],
    version: 2,
  })
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'role.created',
    ),
  ).toHaveLength(1)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'role.updated',
    ),
  ).toHaveLength(1)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'member.created',
    ),
  ).toHaveLength(1)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'member.role.updated',
    ),
  ).toHaveLength(0)
})

test('even all custom action grants cannot administer roles, members, other sessions or updates', async () => {
  const { request } = workspace()
  const catalog = await (await request('/api/permissions')).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'All actions',
      permissions: catalog.map((entry: { id: string }) => entry.id),
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Operator',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const login = await request('/auth/login', 'POST', { token: owner }, '', {
    origin: 'http://localhost',
  })
  const ownerSession = await login.json()
  const cases: [string, string, unknown?][] = [
    ['/api/roles', 'GET'],
    ['/api/roles', 'POST', { name: 'Escalation', permissions: [] }],
    [
      `/api/roles/${role.id}`,
      'PUT',
      { name: 'Escalation', permissions: [], version: 1 },
    ],
    [`/api/roles/${role.id}`, 'DELETE', { version: 1 }],
    ['/api/members', 'GET'],
    ['/api/members', 'POST', { name: 'Escalation', role: 'viewer' }],
    [`/api/members/${member.id}/role`, 'PUT', { role: 'editor' }],
    [`/api/members/${member.id}`, 'DELETE'],
    [`/api/sessions/${ownerSession.sessionId}`, 'DELETE'],
    ['/api/updates', 'GET'],
    ['/api/updates', 'PUT', {}],
    ['/api/updates/check', 'POST', {}],
  ]
  for (const [path, method, body] of cases)
    expect((await request(path, method, body, member.token)).status).toBe(403)
  expect(
    await (
      await request('/api/sessions', 'GET', undefined, member.token)
    ).json(),
  ).toEqual([])
  for (const token of ['', 'invalid']) {
    expect(
      (await request('/api/permissions', 'GET', undefined, token)).status,
    ).toBe(401)
    expect((await request('/api/roles', 'GET', undefined, token)).status).toBe(
      401,
    )
  }
})

test('generated drafts require both source metadata access and draft writing without implicit grants', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'People')
  upload.set(
    'file',
    new File(['Name\nAda'], 'people.csv', { type: 'text/csv' }),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const connection = await (
    await request('/api/auth-connections', 'POST', {
      name: 'GitHub',
      provider: 'github',
      clientId: 'client',
      clientSecret: 'provider-secret',
      redirectUri: 'https://product.example/callback',
    })
  ).json()
  const sourceBody = {
    name: 'People API',
    path: '/people',
    protocol: 'rest',
    columns: ['name'],
    limit: 1,
  }
  const authBody = { name: 'Login', path: '/login', kind: 'rest' }
  for (const permissions of [
    ['sources.read'],
    ['auth-connections.read'],
    ['flows.write'],
    ['sources.read', 'flows.write'],
    ['auth-connections.read', 'flows.write'],
  ]) {
    const role = await (
      await request('/api/roles', 'POST', {
        name: permissions.join(' + '),
        permissions,
      })
    ).json()
    const member = await (
      await request('/api/members', 'POST', {
        name: 'Generator',
        role: 'custom',
        roleId: role.id,
      })
    ).json()
    const sourceExpected =
      permissions.includes('sources.read') &&
      permissions.includes('flows.write')
        ? 200
        : 403
    const authExpected =
      permissions.includes('auth-connections.read') &&
      permissions.includes('flows.write')
        ? 200
        : 403
    expect(
      (
        await request(
          `/api/data-sources/${source.id}/api`,
          'POST',
          sourceBody,
          member.token,
        )
      ).status,
    ).toBe(sourceExpected)
    expect(
      (
        await request(
          `/api/auth-connections/${connection.id}/generate`,
          'POST',
          authBody,
          member.token,
        )
      ).status,
    ).toBe(authExpected)
    expect(
      (await request('/api/flows', 'GET', undefined, member.token)).status,
    ).toBe(403)
  }
})

test('individual explicit grants authorize REST and GraphQL, source, credential, backup and load actions', async () => {
  const { request, server } = workspace({
    k6Runner: async (_input, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Canceled')), {
          once: true,
        }),
      ),
  })
  server().app.listen({ hostname: '127.0.0.1', port: 0 })
  async function granted(permission: string) {
    const role = await (
      await request('/api/roles', 'POST', {
        name: permission,
        permissions: [permission],
      })
    ).json()
    return (
      await (
        await request('/api/members', 'POST', {
          name: permission,
          role: 'custom',
          roleId: role.id,
        })
      ).json()
    ).token as string
  }
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  const tester = await granted('flows.test')
  expect(
    (
      await request(
        `/api/flows/${flow.id}/test`,
        'POST',
        { body: null, query: {} },
        tester,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/flows/${graph.id}/graphql/test`,
        'POST',
        { query: '{ greet(name: "Ada") { name } }' },
        tester,
      )
    ).status,
  ).toBe(200)
  expect((await request('/api/flows', 'GET', undefined, tester)).status).toBe(
    403,
  )
  const publisher = await granted('flows.publish')
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 1 },
        publisher,
      )
    ).status,
  ).toBe(200)
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...helloFlow,
    path: '/v2/hello',
    revision: 1,
  })
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 2 },
        publisher,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/flows/${flow.id}/rollback`,
        'POST',
        { revision: 1, publishedRevision: 2 },
        publisher,
      )
    ).status,
  ).toBe(200)
  const reader = await granted('flows.read')
  for (const path of [
    '/api/flows',
    `/api/flows/${flow.id}`,
    `/api/flows/${flow.id}/releases`,
    `/api/flows/${flow.id}/releases/1`,
    `/api/flows/${flow.id}/openapi`,
  ])
    expect((await request(path, 'GET', undefined, reader)).status).toBe(200)
  const sourceWriter = await granted('sources.write')
  const upload = new FormData()
  upload.set('name', 'People')
  upload.set(
    'file',
    new File(['Name\nAda'], 'people.csv', { type: 'text/csv' }),
  )
  const imported = await request(
    '/api/data-sources/import',
    'POST',
    upload,
    sourceWriter,
  )
  expect(imported.status).toBe(200)
  const source = await imported.json()
  expect(
    (await request('/api/data-sources', 'GET', undefined, sourceWriter)).status,
  ).toBe(403)
  const sourceReader = await granted('sources.read')
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        sourceReader,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'DELETE',
        undefined,
        sourceReader,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'DELETE',
        undefined,
        sourceWriter,
      )
    ).status,
  ).toBe(200)
  const authManager = await granted('auth-connections.manage')
  const connected = await request(
    '/api/auth-connections',
    'POST',
    {
      name: 'GitHub',
      provider: 'github',
      clientId: 'client',
      clientSecret: 'provider-secret',
      redirectUri: 'https://product.example/callback',
    },
    authManager,
  )
  expect(connected.status).toBe(200)
  const connection = await connected.json()
  expect(
    (await request('/api/auth-connections', 'GET', undefined, authManager))
      .status,
  ).toBe(403)
  const authReader = await granted('auth-connections.read')
  expect(
    (await request('/api/auth-connections', 'GET', undefined, authReader))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/auth-connections/${connection.id}`,
        'PUT',
        {
          name: 'Changed',
          clientId: 'client',
          redirectUri: 'https://product.example/callback',
        },
        authManager,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/auth-connections/${connection.id}`,
        'DELETE',
        undefined,
        authManager,
      )
    ).status,
  ).toBe(200)
  const keyManager = await granted('runtime-keys.manage')
  const issued = await request(
    '/api/runtime-keys',
    'POST',
    {
      name: 'Caller',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    keyManager,
  )
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
  expect(
    (await request('/run/hello', 'GET', undefined, keyManager)).status,
  ).toBe(401)
  const rotated = await request(
    `/api/runtime-keys/${key.id}/rotate`,
    'POST',
    {},
    keyManager,
  )
  expect(rotated.status).toBe(200)
  expect(
    (
      await request(
        `/api/runtime-keys/${(await rotated.json()).id}`,
        'DELETE',
        undefined,
        keyManager,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/api/audit', 'GET', undefined, await granted('audit.read')))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/migrations',
        'GET',
        undefined,
        await granted('migrations.read'),
      )
    ).status,
  ).toBe(200)
  const backupManager = await granted('backups.manage')
  const backup = await (
    await request('/api/backups', 'POST', undefined, backupManager)
  ).json()
  expect(
    (await request('/api/backups', 'GET', undefined, backupManager)).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/backups/${backup.id}`,
        'GET',
        undefined,
        backupManager,
      )
    ).status,
  ).toBe(200)
  const loadRunner = await granted('load-tests.run')
  expect(
    (await request('/api/load-tests/targets', 'GET', undefined, loadRunner))
      .status,
  ).toBe(200)
  const started = await request(
    '/api/load-tests',
    'POST',
    { flowId: flow.id },
    loadRunner,
  )
  expect(started.status).toBe(202)
  const run = await started.json()
  expect(
    (await request(`/api/load-tests/${run.id}`, 'GET', undefined, loadRunner))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/load-tests/${run.id}/cancel`,
        'POST',
        undefined,
        loadRunner,
      )
    ).status,
  ).toBe(200)
})

test('owner cookie administration requires origin and CSRF and stale role edits race with one winner', async () => {
  const { request, options } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Readers',
      permissions: ['flows.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Reader',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const memberLogin = await request(
    '/auth/login',
    'POST',
    { token: member.token },
    '',
    { origin: 'http://localhost' },
  )
  const memberCookie = memberLogin.headers.get('set-cookie')!.split(';')[0]
  const login = await request('/auth/login', 'POST', { token: owner }, '', {
    origin: 'http://localhost',
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  const body = {
    name: 'Publishers',
    permissions: ['flows.publish'],
    version: 1,
  }
  const path = `/api/roles/${role.id}`
  const headers = {
    cookie,
    origin: 'http://localhost',
    'x-besh-csrf': session.csrfToken,
  }
  expect(
    (
      await request(path, 'PUT', body, '', {
        cookie,
        origin: 'http://localhost',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await request(path, 'PUT', body, '', {
        ...headers,
        origin: 'https://evil.example',
      })
    ).status,
  ).toBe(403)
  expect((await request(path, 'PUT', body, 'invalid', headers)).status).toBe(
    401,
  )
  const second = createApp(options)
  cleanup.push(() => second.close())
  const competitor = second.app.handle(
    new Request(`http://localhost${path}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${owner}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...body, name: 'Other publisher' }),
    }),
  )
  const responses = await Promise.all([
    request(path, 'PUT', body, '', headers),
    competitor,
  ])
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ])
  expect(
    (
      await request('/auth/session', 'GET', undefined, '', {
        cookie: memberCookie,
      })
    ).status,
  ).toBe(401)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .permissions,
  ).toEqual(['flows.publish'])
  const events = await (await request('/api/audit')).json()
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'role.updated',
    ),
  ).toHaveLength(1)
  expect(
    events.filter(
      (event: { action: string }) => event.action === 'session.revoked',
    ),
  ).toHaveLength(1)
  expect(
    (
      await request(
        `/api/members/${member.id}/role`,
        'PUT',
        { role: 'viewer' },
        '',
        headers,
      )
    ).status,
  ).toBe(200)
})

test('concurrent role deletion and assignment preserve referential integrity across connections', async () => {
  const { request, options } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Temporary',
      permissions: ['flows.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  const second = createApp(options)
  cleanup.push(() => second.close())
  const assignment = second.app.handle(
    new Request(`http://localhost/api/members/${member.id}/role`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${owner}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'custom', roleId: role.id }),
    }),
  )
  const [deleted, assigned] = await Promise.all([
    request(`/api/roles/${role.id}`, 'DELETE', { version: 1 }),
    assignment,
  ])
  const current = await (
    await request('/api/me', 'GET', undefined, member.token)
  ).json()
  if (deleted.status === 200) {
    expect(assigned.status).toBe(404)
    expect(current.role).toBe('viewer')
    expect(await (await request('/api/roles')).json()).toEqual([])
  } else {
    expect(deleted.status).toBe(409)
    expect(assigned.status).toBe(200)
    expect(current.roleId).toBe(role.id)
    expect((await request(`/api/members/${member.id}`, 'DELETE')).status).toBe(
      200,
    )
    expect(
      (await request(`/api/roles/${role.id}`, 'DELETE', { version: 1 })).status,
    ).toBe(200)
  }
})

test('roles, assignments and effective grants survive restart and downloaded backup restoration', async () => {
  const { request, options, reopen } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'API readers',
      permissions: ['flows.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Reader',
      role: 'custom',
      roleId: role.id,
      email: 'reader@example.com',
      password: 'reader-password-at-least12',
    })
  ).json()
  await request('/api/flows', 'POST', helloFlow)
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await download.arrayBuffer()))
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: 'No access now',
        permissions: [],
        version: 1,
      })
    ).status,
  ).toBe(200)
  reopen()
  expect(
    (await request('/api/flows', 'GET', undefined, member.token)).status,
  ).toBe(403)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .permissions,
  ).toEqual([])
  const restored = createApp({ ...options, databasePath: restoredPath })
  cleanup.push(() => restored.close())
  const read = (path: string, token = owner) =>
    restored.app.handle(
      new Request(`http://localhost${path}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
  expect(await (await read('/api/roles')).json()).toEqual([role])
  expect(
    (await (await read('/api/me', member.token)).json()).permissions,
  ).toEqual(['flows.read'])
  expect((await read('/api/flows', member.token)).status).toBe(200)
  const login = await restored.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'reader@example.com',
        password: 'reader-password-at-least12',
      }),
    }),
  )
  expect(login.status).toBe(200)
  expect((await login.json()).member).toMatchObject({
    role: 'custom',
    roleId: role.id,
    roleName: role.name,
    permissions: ['flows.read'],
  })
  expect(
    (await (await read('/api/migrations')).json()).map(
      (migration: { version: number }) => migration.version,
    ),
  ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
})

test('pending password sign-in resolves changed assignments after verification and pending creation rechecks deleted roles', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Writers',
      permissions: ['flows.write'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Writer',
      role: 'custom',
      roleId: role.id,
      email: 'writer@example.com',
      password: 'writer-password-at-least12',
    })
  ).json()
  const pendingLogin = request(
    '/auth/login',
    'POST',
    { email: 'writer@example.com', password: 'writer-password-at-least12' },
    '',
    { origin: 'http://localhost' },
  )
  expect(
    (await request(`/api/members/${member.id}/role`, 'PUT', { role: 'viewer' }))
      .status,
  ).toBe(200)
  const login = await pendingLogin
  expect(login.status).toBe(200)
  const session = await login.json()
  expect(session.member).toMatchObject({
    role: 'viewer',
    permissions: ['flows.read'],
  })
  expect(session.member.roleId).toBeUndefined()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(
    (
      await request('/api/flows', 'POST', helloFlow, '', {
        cookie,
        origin: 'http://localhost',
        'x-besh-csrf': session.csrfToken,
      })
    ).status,
  ).toBe(403)
  const pendingCreate = request('/api/members', 'POST', {
    name: 'Pending',
    role: 'custom',
    roleId: role.id,
    email: 'pending@example.com',
    password: 'pending-password-at-least12',
  })
  expect(
    (await request(`/api/roles/${role.id}`, 'DELETE', { version: 1 })).status,
  ).toBe(200)
  expect((await pendingCreate).status).toBe(404)
  expect(
    (await (await request('/api/members')).json()).map(
      (entry: { name: string }) => entry.name,
    ),
  ).toEqual(['Owner', 'Writer'])
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Available email',
        role: 'viewer',
        email: 'pending@example.com',
        password: 'pending-password-at-least12',
      })
    ).status,
  ).toBe(200)
})

test('cookie permission and CSRF denials retain member audit attribution without overriding explicit credentials', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', { name: 'No grants', permissions: [] })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Denied member',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const login = await request(
    '/auth/login',
    'POST',
    { token: member.token },
    '',
    { origin: 'http://localhost' },
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(
    (await request('/api/flows', 'GET', undefined, '', { cookie })).status,
  ).toBe(403)
  expect(
    (
      await request('/api/flows', 'POST', helloFlow, '', {
        cookie,
        origin: 'http://localhost',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/api/flows',
        'GET',
        undefined,
        'invalid-explicit-credential',
        { cookie },
      )
    ).status,
  ).toBe(401)
  const audit = await (await request('/api/audit')).json()
  const denials = audit.filter(
    (event: { action: string }) => event.action === 'access.denied',
  )
  expect(denials.map((event: { actor: string }) => event.actor)).toEqual([
    'anonymous',
    member.id,
    member.id,
  ])
  const serialized = JSON.stringify(audit)
  expect(serialized).not.toContain(member.token)
  expect(serialized).not.toContain(cookie)
  expect(serialized).not.toContain('invalid-explicit-credential')
})
