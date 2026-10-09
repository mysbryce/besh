import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { Database } from 'bun:sqlite'

const owner = 'row-protection-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-row-protection-'))
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
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
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
    listen() {
      server.app.listen({ port: 0 })
    },
    async reopen() {
      await server.close()
      server = createApp(options)
    },
  }
}

test('new spreadsheet snapshots expose owner policy metadata from aligned original cells without changing business output', async () => {
  const { request, reopen } = workspace()
  const upload = new FormData()
  upload.set('name', 'Original tenant text')
  upload.set(
    'file',
    new File(['tenant,name\n1.0,Ada\n1,Grace\n A ,Spaced\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  expect(source.rows).toEqual([
    { tenant: '1', name: 'Ada' },
    { tenant: '1', name: 'Grace' },
    { tenant: 'A', name: 'Spaced' },
  ])
  const policy = await request(`/api/data-sources/${source.id}/row-policy`)
  expect(policy.status).toBe(200)
  const expected = {
    mode: 'unprotected',
    version: 1,
    resourceVersion: 1,
    column: null,
    provenance: { status: 'available', textColumns: ['tenant', 'name'] },
  }
  expect(await policy.json()).toEqual(expected)
  await reopen()
  expect(
    await (await request(`/api/data-sources/${source.id}/row-policy`)).json(),
  ).toEqual(expected)
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/row-policy`,
        'GET',
        undefined,
        viewer.token,
      )
    ).status,
  ).toBe(403)
})

test('owner registers exact tenant identities and atomically assigns versioned member identities', async () => {
  const { request, reopen } = workspace()
  expect((await request('/api/tenants')).status).toBe(200)
  expect(await (await request('/api/tenants')).json()).toEqual([])
  const created = await request('/api/tenants', 'POST', {
    label: 'Tenant with spaces',
    value: ' A ',
  })
  expect(created.status).toBe(200)
  const tenant = await created.json()
  expect(tenant).toMatchObject({
    label: 'Tenant with spaces',
    value: ' A ',
    state: 'active',
    version: 1,
  })
  expect(
    (
      await request('/api/tenants', 'POST', {
        label: 'Distinct tenant',
        value: 'A',
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request('/api/tenants', 'POST', {
        label: 'Duplicate',
        value: ' A ',
      })
    ).status,
  ).toBe(409)
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Tenant reader',
      role: 'viewer',
      tenantId: tenant.id,
    })
  ).json()
  expect(member.tenantAssignment).toEqual({ tenantId: tenant.id, version: 1 })
  const context = await (
    await request('/api/tenant-context', 'GET', undefined, member.token)
  ).json()
  expect(context).toEqual({
    assignment: member.tenantAssignment,
    tenant: { id: tenant.id, label: tenant.label, state: 'active' },
    backupsOwnerOnly: false,
  })
  expect(
    (await request('/api/tenants', 'GET', undefined, member.token)).status,
  ).toBe(403)
  const changed = await request(`/api/members/${member.id}/tenant`, 'PUT', {
    tenantId: null,
    version: 1,
  })
  expect(changed.status).toBe(200)
  expect((await changed.json()).tenantAssignment).toEqual({
    tenantId: null,
    version: 2,
  })
  expect(
    (
      await request(`/api/members/${member.id}/tenant`, 'PUT', {
        tenantId: tenant.id,
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request('/api/members/owner/tenant', 'PUT', {
        tenantId: tenant.id,
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/tenants/${tenant.id}`, 'PUT', {
        label: tenant.label,
        state: 'retired',
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Retired identity',
        role: 'viewer',
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(409)
  await reopen()
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .tenantAssignment,
  ).toEqual({ tenantId: null, version: 2 })
})

test('source tenant predicates use original exact text before business filters limits and projection', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Tenant rows')
  upload.set(
    'file',
    new File(
      ['tenant,name,city\n1,Foreign,Paris\n1.0,Ada,London\n1.0,Grace,London\n'],
      'people.csv',
    ),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/names',
      protocol: 'rest',
      columns: ['name'],
      filter: { column: 'city', inputName: 'city' },
      limit: 1,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Original decimal text',
      value: '1.0',
    })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Tenant tester',
      permissions: ['flows.test'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Tester',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  const changed = await request(
    `/api/data-sources/${source.id}/row-policy`,
    'PUT',
    { mode: 'tenant', column: 'tenant', version: 1, resourceVersion: 1 },
  )
  expect(changed.status).toBe(200)
  expect((await changed.json()).mode).toBe('tenant')
  const result = await request(
    `/api/flows/${flow.id}/test`,
    'POST',
    { body: null, query: {} },
    member.token,
  )
  expect(result.status).toBe(200)
  expect((await result.json()).body).toEqual([{ name: 'Ada' }])
  const filtered = await request(
    `/api/flows/${flow.id}/test`,
    'POST',
    { body: null, query: { city: 'Paris' } },
    member.token,
  )
  expect(filtered.status).toBe(200)
  expect((await filtered.json()).body).toEqual([])
  const ownerTest = await request(`/api/flows/${flow.id}/test`, 'POST', {
    body: null,
    query: {},
    tenantId: tenant.id,
  })
  expect(ownerTest.status).toBe(200)
  expect((await ownerTest.json()).body).toEqual([{ name: 'Ada' }])
  expect(
    (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: null,
        query: {},
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(
        `/api/flows/${flow.id}/test`,
        'POST',
        { body: null, query: {}, tenantId: tenant.id },
        member.token,
      )
    ).status,
  ).toBe(400)
})

test('protected GraphQL tests use trusted identity and reject unsupported published branches', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'GraphQL tenants')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/gql-names',
      protocol: 'graphql',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  const tested = await request(`/api/flows/${flow.id}/graphql/test`, 'POST', {
    query: '{ rows { name } }',
    tenantId: tenant.id,
  })
  expect(tested.status).toBe(200)
  expect((await tested.json()).body).toEqual({
    data: { rows: [{ name: 'Ada' }] },
  })
  const unsupported = {
    ...flow,
    nodes: [
      ...flow.nodes,
      {
        id: 'extra',
        type: 'response',
        position: { x: 0, y: 0 },
        config: { status: 200, body: 'private' },
      },
    ],
  }
  const changed = await (
    await request(`/api/flows/${flow.id}`, 'PUT', unsupported)
  ).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/publish`, 'POST', {
        revision: changed.revision,
      })
    ).status,
  ).toBe(400)
})

test('SQLite tenant equality overrides NOCASE and runs before projection and row limits', async () => {
  const { request } = workspace()
  const sqlite = new Database(':memory:')
  sqlite.run(
    "CREATE TABLE people (tenant TEXT COLLATE NOCASE, name TEXT); INSERT INTO people VALUES ('a', 'Foreign'), ('A', 'Ada'), (NULL, 'Unknown')",
  )
  const bytes = sqlite.serialize()
  sqlite.close()
  const upload = new FormData()
  upload.set('name', 'Tenant copy')
  upload.set('file', new File([new Uint8Array(bytes)], 'people.sqlite'))
  const created = await request('/api/database-connections', 'POST', upload)
  expect(created.status).toBe(200)
  const connection = await created.json()
  const flow = await (
    await request(`/api/database-connections/${connection.id}/api`, 'POST', {
      version: 1,
      table: 'people',
      name: 'Names',
      path: '/sqlite-names',
      protocol: 'rest',
      columns: ['name'],
      limit: 1,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'Uppercase', value: 'A' })
  ).json()
  const policy = await request(
    `/api/database-connections/${connection.id}/row-policy`,
    'PUT',
    {
      mode: 'tenant',
      version: 1,
      resourceVersion: 1,
      tables: [{ table: 'people', column: 'tenant' }],
    },
  )
  expect(policy.status).toBe(200)
  expect((await policy.json()).tables).toEqual([
    { table: 'people', column: 'tenant', textColumns: ['tenant', 'name'] },
  ])
  const result = await request(`/api/flows/${flow.id}/test`, 'POST', {
    body: null,
    query: {},
    tenantId: tenant.id,
  })
  expect(result.status).toBe(200)
  expect((await result.json()).body).toEqual([{ name: 'Ada' }])
})

test('protection hides raw source data and permanently reserves backups for owner', async () => {
  const { request, reopen } = workspace()
  const upload = new FormData()
  upload.set('name', 'Private raw data')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Raw manager',
      permissions: ['sources.read', 'sources.write', 'backups.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Delegated manager',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const backup = await (await request('/api/backups', 'POST', {})).json()
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    await (
      await request('/api/data-sources', 'GET', undefined, member.token)
    ).json(),
  ).toEqual([])
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/refresh`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/backups', 'GET', undefined, member.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/backups/${backup.id}`, 'GET', undefined, member.token))
      .status,
  ).toBe(403)
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  await reopen()
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/api/backups', 'GET', undefined, member.token)).status,
  ).toBe(403)
  expect(
    (
      await (
        await request('/api/tenant-context', 'GET', undefined, member.token)
      ).json()
    ).backupsOwnerOnly,
  ).toBe(true)
})

test('operators can review minimal row-access requirements without receiving a private graph', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Protected requirements')
  upload.set('file', new File(['tenant,name\nA,Ada\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Private graph',
      path: '/requirements',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Tester only',
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
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  const response = await request(
    `/api/flows/${flow.id}/row-access?source=draft`,
    'GET',
    undefined,
    member.token,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    source: 'draft',
    revision: 1,
    required: true,
    supported: true,
  })
  expect(
    (
      await request(
        '/api/flows/hidden/row-access?source=invalid',
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request(`/api/flows/${flow.id}`, 'GET', undefined, member.token))
      .status,
  ).toBe(403)
})

test('pending delegated refresh cannot disclose or commit rows after owner enables protection', async () => {
  let release!: (response: Response) => void
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  let calls = 0
  const { request } = workspace({
    sheetFetch: async () => {
      if (++calls === 1)
        return new Response('tenant,name\nA,Ada\nB,Grace\n', {
          headers: { 'content-type': 'text/csv' },
        })
      started()
      return new Promise<Response>((resolve) => {
        release = resolve
      })
    },
  })
  const imported = await request('/api/data-sources/google-sheets', 'POST', {
    name: 'Public sheet',
    url: 'https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuv/edit',
  })
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Refresh manager',
      permissions: ['sources.write'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Manager',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const refresh = request(
    `/api/data-sources/${source.id}/refresh`,
    'POST',
    {},
    member.token,
  )
  await pending
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  release(
    new Response('tenant,name\nA,New private row\n', {
      headers: { 'content-type': 'text/csv' },
    }),
  )
  const result = await refresh
  expect(result.status).toBe(404)
  expect(await result.text()).not.toContain('New private row')
  const ownerSource = await (
    await request(`/api/data-sources/${source.id}`)
  ).json()
  expect(ownerSource.version).toBe(1)
  expect(ownerSource.rows).toEqual([
    { tenant: 'A', name: 'Ada' },
    { tenant: 'B', name: 'Grace' },
  ])
})

test('protected runtime keys pin tenant identity and fail closed after issuer reassignment', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Runtime tenants')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/tenant-runtime',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'All-mode key manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'A manager',
      role: 'custom',
      roleId: role.id,
      tenantId: a.id,
    })
  ).json()
  const input = {
    name: 'A caller',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  }
  expect(
    (await request('/api/runtime-keys', 'POST', input, member.token)).status,
  ).toBe(400)
  const issued = await request(
    '/api/runtime-keys',
    'POST',
    { ...input, releaseRevision: 1 },
    member.token,
  )
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(key.tenantId).toBe(a.id)
  expect(key.issuerBinding).toEqual({
    memberId: member.id,
    action: 'runtime-keys.manage',
  })
  const result = await request(
    '/run/tenant-runtime?tenant=B',
    'GET',
    undefined,
    key.token,
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual([{ name: 'Ada' }])
  await request(`/api/members/${member.id}/tenant`, 'PUT', {
    tenantId: b.id,
    version: 1,
  })
  expect(
    (await request('/run/tenant-runtime', 'GET', undefined, key.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})).status,
  ).toBe(409)
  expect(
    (
      await request(
        `/api/runtime-keys/${key.id}`,
        'DELETE',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  const ownerKey = await (
    await request('/api/runtime-keys', 'POST', {
      ...input,
      name: 'Independent owner',
      releaseRevision: 1,
      tenantId: b.id,
    })
  ).json()
  expect(
    (
      await request(
        `/api/runtime-keys/${ownerKey.id}/rotate`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/runtime-keys', 'GET', undefined, member.token)).json(),
  ).resolves.not.toContainEqual(expect.objectContaining({ id: ownerKey.id }))
  const ownerResult = await request(
    '/run/tenant-runtime',
    'GET',
    undefined,
    ownerKey.token,
  )
  expect(ownerResult.status).toBe(200)
  expect(await ownerResult.json()).toEqual([{ name: 'Grace' }])
  const boundB = await (
    await request(
      '/api/runtime-keys',
      'POST',
      { ...input, name: 'Bound B', releaseRevision: 1 },
      member.token,
    )
  ).json()
  expect(
    (
      await request(`/api/tenants/${b.id}`, 'PUT', {
        label: 'Retired B',
        state: 'retired',
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request('/run/tenant-runtime', 'GET', undefined, boundB.token))
      .status,
  ).toBe(403)
  const retiredInventory = await (
    await request('/api/runtime-keys', 'GET', undefined, member.token)
  ).json()
  expect(
    retiredInventory.find((item: { id: string }) => item.id === boundB.id)
      .cleanupOnly,
  ).toBe(true)
  expect(
    (
      await request(
        `/api/runtime-keys/${boundB.id}`,
        'DELETE',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
})

test('protected load-test jobs retain tenant metadata and deny later calls after identity changes', async () => {
  let execute!: () => Promise<Response>
  let entered!: () => void
  const running = new Promise<void>((resolve) => {
    entered = resolve
  })
  let finish!: (
    value: import('../src/load-tests/model').LoadTestSummary,
  ) => void
  const { request, listen } = workspace({
    k6Runner: async (input) => {
      execute = () =>
        fetch(input.url, {
          headers: { authorization: `Bearer ${input.token}` },
        })
      entered()
      return new Promise((resolve) => {
        finish = resolve
      })
    },
  })
  const upload = new FormData()
  upload.set('name', 'Load-test tenant rows')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/tenant-load',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Load-test only',
      permissions: ['load-tests.run'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'A tester',
      role: 'custom',
      roleId: role.id,
      tenantId: a.id,
    })
  ).json()
  listen()
  const started = await request(
    '/api/load-tests',
    'POST',
    { flowId: flow.id },
    member.token,
  )
  expect(started.status).toBe(202)
  const job = await started.json()
  expect(job.tenantId).toBe(a.id)
  await running
  expect(await (await execute()).json()).toEqual([{ name: 'Ada' }])
  await request(`/api/members/${member.id}/tenant`, 'PUT', {
    tenantId: b.id,
    version: 1,
  })
  expect((await execute()).status).toBe(403)
  expect(
    (
      await request(
        `/api/load-tests/${job.id}/cancel`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(200)
  const history = await (
    await request(`/api/load-tests/${job.id}`, 'GET', undefined, member.token)
  ).json()
  expect(history.tenantId).toBe(a.id)
  expect(history.cleanupOnly).toBe(true)
  finish({
    requests: 1,
    requestsPerSecond: 1,
    failedRequests: 0,
    checkRate: 1,
    avgMs: 1,
    p95Ms: 1,
    maxMs: 1,
    thresholdsPassed: true,
  })
})

test('source protection accepts original text only and separately bounds provenance bytes', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Typed originals')
  upload.set(
    'file',
    new File(
      [
        new Uint8Array(
          readFileSync(join(import.meta.dir, 'fixtures/contacts.xlsx')),
        ),
      ],
      'contacts.xlsx',
    ),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const policy = await (
    await request(`/api/data-sources/${source.id}/row-policy`)
  ).json()
  expect(policy.provenance.textColumns).toEqual(['name'])
  for (const column of ['count', 'active', 'created', 'total'])
    expect(
      (
        await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
          mode: 'tenant',
          column,
          version: 1,
          resourceVersion: 1,
        })
      ).status,
    ).toBe(400)
  for (const filename of [
    'provenance-overlimit.xlsx',
    'provenance-overlimit-uppercase.xlsx',
  ]) {
    const oversized = new FormData()
    oversized.set('name', 'Oversized originals')
    oversized.set(
      'file',
      new File(
        [
          new Uint8Array(
            readFileSync(join(import.meta.dir, 'fixtures', filename)),
          ),
        ],
        filename,
      ),
    )
    const rejected = await request(
      '/api/data-sources/import',
      'POST',
      oversized,
    )
    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toEqual({
      error: 'Original cell snapshot exceeds 16 MiB',
    })
  }
  expect(
    (await (await request('/api/data-sources')).json()).map(
      (item: { id: string }) => item.id,
    ),
  ).toEqual([source.id])
})

test('protected GraphQL admission rejects scalar row lists before execution', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Protected scalar rows')
  upload.set('file', new File(['tenant,name\nA,Ada\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/scalar-rows',
      protocol: 'graphql',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  const saved = await (
    await request(`/api/flows/${flow.id}`, 'PUT', {
      ...flow,
      graphql: { schema: 'type Query { rows: [String!]! }' },
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/publish`, 'POST', {
        revision: saved.revision,
      })
    ).status,
  ).toBe(400)
  expect(
    await (
      await request(`/api/flows/${flow.id}/row-access?source=draft`)
    ).json(),
  ).toEqual({ source: 'draft', revision: 2, required: true, supported: false })
  for (const schema of [
    'type Row { name: String } type Query { rows: [[Row!]!]! }',
    'type Row { name: [String!]! } type Query { rows: [Row!]! }',
  ]) {
    const current = await (await request(`/api/flows/${flow.id}`)).json()
    const nested = await (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...current,
        graphql: { schema },
      })
    ).json()
    expect(
      (
        await request(`/api/flows/${flow.id}/publish`, 'POST', {
          revision: nested.revision,
        })
      ).status,
    ).toBe(400)
  }
})

test('all-mode credential privacy denies foreign and missing keys before replacement settings', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Foreign keys')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/foreign-keys',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Key manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const memberA = await (
    await request('/api/members', 'POST', {
      name: 'A manager',
      role: 'custom',
      roleId: role.id,
      tenantId: a.id,
    })
  ).json()
  const memberB = await (
    await request('/api/members', 'POST', {
      name: 'B manager',
      role: 'custom',
      roleId: role.id,
      tenantId: b.id,
    })
  ).json()
  const key = await (
    await request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'B caller',
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
      memberB.token,
    )
  ).json()
  for (const id of [key.id, 'missing-key']) {
    const result = await request(
      `/api/runtime-keys/${id}/rotate`,
      'POST',
      { tenantId: a.id },
      memberA.token,
    )
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({ error: 'Runtime key not found' })
  }
  expect(
    await (
      await request('/api/runtime-keys', 'GET', undefined, memberA.token)
    ).json(),
  ).toEqual([])
})

test('protected source replacement preserves exact identity header while updating mutable business rows', async () => {
  const { request } = workspace()
  const file = (text: string) => {
    const upload = new FormData()
    upload.set('name', 'Mutable rows')
    upload.set('file', new File([text], 'people.csv'))
    return upload
  }
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      file(' tenant ,name\nA,Ada\nB,Grace\n'),
    )
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/mutable-protected',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'A',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  ).json()
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/import`,
        'PUT',
        file('tenant,name\nA,Changed\n'),
      )
    ).status,
  ).toBe(409)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/import`,
        'PUT',
        file(' tenant ,name\nB,Foreign first\nA,Updated\n'),
      )
    ).status,
  ).toBe(200)
  expect(
    await (
      await request('/run/mutable-protected', 'GET', undefined, key.token)
    ).json(),
  ).toEqual([{ name: 'Updated' }])
  expect(
    (await (await request(`/api/data-sources/${source.id}/row-policy`)).json())
      .resourceVersion,
  ).toBe(2)
})

test('tenant registry bounds exact identities and retirement revokes affected cookies atomically', async () => {
  const { request } = workspace()
  const maximum = '😀'.repeat(128)
  const created = await request('/api/tenants', 'POST', {
    label: 'Maximum UTF-8 identity',
    value: maximum,
  })
  expect(created.status).toBe(200)
  const tenant = await created.json()
  expect(tenant.value).toBe(maximum)
  for (const value of [
    '😀'.repeat(129),
    'bad\nidentity',
    'bad\u0000identity',
    '\ud800',
  ])
    expect(
      (
        await request('/api/tenants', 'POST', {
          label: 'Invalid identity',
          value,
        })
      ).status,
    ).toBe(400)
  expect(
    (
      await request(`/api/tenants/${tenant.id}`, 'PUT', {
        label: 'Changed',
        state: 'active',
        version: 1,
        value: 'Changed identity',
      })
    ).status,
  ).toBe(400)
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Assigned viewer',
      role: 'viewer',
      tenantId: tenant.id,
    })
  ).json()
  const login = await request(
    '/auth/login',
    'POST',
    { token: member.token },
    '',
    { origin: 'http://localhost' },
  )
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  expect(
    (await request('/api/me', 'GET', undefined, '', { cookie })).status,
  ).toBe(200)
  const retired = await request(`/api/tenants/${tenant.id}`, 'PUT', {
    label: 'Retired',
    state: 'retired',
    version: 1,
  })
  expect(retired.status).toBe(200)
  expect((await retired.json()).value).toBe(maximum)
  expect(
    (await request('/api/me', 'GET', undefined, '', { cookie })).status,
  ).toBe(401)
  expect(
    (
      await request(`/api/tenants/${tenant.id}`, 'PUT', {
        label: 'Stale',
        state: 'active',
        version: 1,
      })
    ).status,
  ).toBe(409)
  for (let index = 0; index < 255; index++)
    expect(
      (
        await request('/api/tenants', 'POST', {
          label: 'Quota entry',
          value: `quota-${index}`,
        })
      ).status,
    ).toBe(200)
  expect(
    (
      await request('/api/tenants', 'POST', {
        label: 'Overflow',
        value: 'overflow',
      })
    ).status,
  ).toBe(409)
  expect((await (await request('/api/tenants')).json()).length).toBe(256)
})

test('resource policy blocks old null-tenant keys and statically rejects even untaken protected branches', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Branch data')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const generated = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Rows',
      path: '/before-protection',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${generated.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Legacy independent',
      flowId: generated.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  ).json()
  expect(key.tenantId).toBeNull()
  expect(
    (await request('/run/before-protection', 'GET', undefined, key.token))
      .status,
  ).toBe(200)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const [requestNode, data, response] = generated.nodes
  const branch = await (
    await request('/api/flows', 'POST', {
      name: 'Conditional branch',
      method: 'POST',
      path: '/branch-protection',
      nodes: [
        requestNode,
        {
          id: 'condition',
          type: 'condition',
          position: { x: 200, y: 100 },
          config: { field: 'body.read', equals: true },
        },
        data,
        response,
        {
          id: 'public',
          type: 'response',
          position: { x: 640, y: 300 },
          config: { status: 200, body: 'public' },
        },
      ],
      edges: [
        { id: 'first', source: 'request', target: 'condition' },
        {
          id: 'yes',
          source: 'condition',
          sourceHandle: 'true',
          target: 'data',
        },
        {
          id: 'no',
          source: 'condition',
          sourceHandle: 'false',
          target: 'public',
        },
        { id: 'rows', source: 'data', target: 'response' },
      ],
    })
  ).json()
  expect(
    (await request(`/api/flows/${branch.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  expect(
    (await request('/run/before-protection', 'GET', undefined, key.token))
      .status,
  ).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})).status,
  ).toBe(409)
  const tested = await request(`/api/flows/${branch.id}/test`, 'POST', {
    body: { read: false, tenantId: 'B' },
    query: { tenant: 'B' },
    tenantId: tenant.id,
  })
  expect(tested.status).toBe(400)
  expect(await tested.text()).not.toContain('Ada')
  expect(
    (await (await request(`/api/flows/${branch.id}/row-access`)).json())
      .supported,
  ).toBe(false)
})

test('an explicit owner tenant selector cannot pretend to protect an unprotected API', async () => {
  const { request, listen } = workspace()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const flow = await (
    await request('/api/flows', 'POST', {
      name: 'Unprotected literal',
      method: 'GET',
      path: '/unprotected-selector',
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'response',
          type: 'response',
          position: { x: 100, y: 0 },
          config: {
            status: 200,
            body: {
              literal: 'Unfiltered literal',
              businessTenant: '$input.query.tenant',
            },
          },
        },
      ],
      edges: [{ id: 'next', source: 'request', target: 'response' }],
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: null,
        query: {},
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(400)
  const ordinary = await request(`/api/flows/${flow.id}/test`, 'POST', {
    body: { tenantId: 'Forged body identity' },
    query: { tenant: 'Business only' },
  })
  expect(ordinary.status).toBe(200)
  expect((await ordinary.json()).body).toEqual({
    literal: 'Unfiltered literal',
    businessTenant: 'Business only',
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  expect(
    (
      await request('/api/runtime-keys', 'POST', {
        name: 'Cannot fake isolation',
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        tenantId: tenant.id,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
    ).status,
  ).toBe(400)
  listen()
  expect(
    (
      await request('/api/load-tests', 'POST', {
        flowId: flow.id,
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(400)
})

test('replacement retains protected tenant issuer pin and expiry through dormancy deprotection and issuer loss', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Credential lifecycle rows')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/tenant-lifecycle',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Scoped manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Original issuer',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  const input = {
    name: 'Caller',
    flowId: flow.id,
    permissions: ['rest'],
    releaseRevision: 1,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  }
  const original = await (
    await request('/api/runtime-keys', 'POST', input, member.token)
  ).json()
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...flow,
    path: '/tenant-lifecycle-next',
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  const dormantResponse = await request(
    `/api/runtime-keys/${original.id}/rotate`,
    'POST',
    {},
  )
  expect(dormantResponse.status).toBe(200)
  const dormant = await dormantResponse.json()
  expect(dormant).toMatchObject({
    tenantId: tenant.id,
    issuerBinding: { memberId: member.id, action: 'runtime-keys.manage' },
    releaseRevision: 1,
    expiresAt: original.expiresAt,
    permissions: ['rest'],
  })
  expect(
    (
      await request(
        '/run/tenant-lifecycle-next',
        'GET',
        undefined,
        dormant.token,
      )
    ).status,
  ).toBe(403)
  await request(`/api/flows/${flow.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  expect(
    await (
      await request('/run/tenant-lifecycle', 'GET', undefined, dormant.token)
    ).json(),
  ).toEqual([{ name: 'Ada' }])
  await request(`/api/roles/${role.id}`, 'PUT', {
    name: role.name,
    permissions: [],
    version: 1,
  })
  expect(
    (await request('/run/tenant-lifecycle', 'GET', undefined, dormant.token))
      .status,
  ).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${dormant.id}/rotate`, 'POST', {}))
      .status,
  ).toBe(409)
  await request(`/api/roles/${role.id}`, 'PUT', {
    name: role.name,
    permissions: ['runtime-keys.manage'],
    version: 2,
  })
  expect(
    (await request('/run/tenant-lifecycle', 'GET', undefined, dormant.token))
      .status,
  ).toBe(200)
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'unprotected',
    version: 2,
    resourceVersion: 1,
  })
  const afterDeprotection = await (
    await request(`/api/runtime-keys/${dormant.id}/rotate`, 'POST', {})
  ).json()
  expect(afterDeprotection).toMatchObject({
    tenantId: tenant.id,
    issuerBinding: dormant.issuerBinding,
    releaseRevision: 1,
    expiresAt: original.expiresAt,
  })
  await request(`/api/members/${member.id}`, 'DELETE')
  expect(
    (
      await request(
        '/run/tenant-lifecycle',
        'GET',
        undefined,
        afterDeprotection.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/runtime-keys/${afterDeprotection.id}/rotate`,
        'POST',
        {},
      )
    ).status,
  ).toBe(409)
  expect(
    (await (await request('/api/runtime-keys')).json()).find(
      (key: { id: string }) => key.id === afterDeprotection.id,
    ).issuerBinding,
  ).toEqual(dormant.issuerBinding)
})

test('foreign load-test history is filtered before the hundred-run window and own history remains cleanup-only', async () => {
  const { request, listen } = workspace({
    k6Runner: async () => ({
      requests: 1,
      requestsPerSecond: 1,
      failedRequests: 0,
      checkRate: 1,
      avgMs: 1,
      p95Ms: 1,
      maxMs: 1,
      thresholdsPassed: true,
    }),
  })
  const upload = new FormData()
  upload.set('name', 'History rows')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/history-rows',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'History tester',
      permissions: ['load-tests.run'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'A tester',
      role: 'custom',
      roleId: role.id,
      tenantId: a.id,
    })
  ).json()
  listen()
  const start = async (token: string, tenantId?: string) => {
    const response = await request(
      '/api/load-tests',
      'POST',
      { flowId: flow.id, ...(tenantId ? { tenantId } : {}) },
      token,
    )
    if (response.status !== 202)
      throw new Error(
        'History fixture could not start its local authorized run',
      )
    const run = await response.json()
    const deadline = Date.now() + 2000
    while (
      (await (await request(`/api/load-tests/${run.id}`)).json()).status ===
      'running'
    ) {
      if (Date.now() > deadline)
        throw new Error('History fixture did not complete')
      await Bun.sleep(1)
    }
    return run
  }
  const own = await start(member.token)
  let foreign!: { id: string }
  for (let index = 0; index < 100; index++) foreign = await start(owner, b.id)
  const history = await (
    await request('/api/load-tests', 'GET', undefined, member.token)
  ).json()
  expect(history.map((job: { id: string }) => job.id)).toEqual([own.id])
  for (const id of [foreign.id, 'missing-run']) {
    const response = await request(
      `/api/load-tests/${id}`,
      'GET',
      undefined,
      member.token,
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Load test not found' })
    expect(
      (await request(`/api/load-tests/${id}/cancel`, 'POST', {}, member.token))
        .status,
    ).toBe(404)
  }
  await request(`/api/members/${member.id}/tenant`, 'PUT', {
    tenantId: null,
    version: 1,
  })
  const historical = await (
    await request(`/api/load-tests/${own.id}`, 'GET', undefined, member.token)
  ).json()
  expect(historical).toMatchObject({ tenantId: a.id, cleanupOnly: true })
  expect(
    (
      await request(
        '/api/load-tests',
        'POST',
        { flowId: flow.id },
        member.token,
      )
    ).status,
  ).toBe(403)
}, 20_000)

test('downloaded backups restore trusted provenance policy assignment and tenant-bound callers together', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Restored rows')
  upload.set(
    'file',
    new File(['tenant,name\n1,Foreign\n1.0,Ada\n'], 'people.csv'),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/restored-tenant',
      protocol: 'graphql',
      columns: ['name'],
      limit: 1,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Original decimal',
      value: '1.0',
    })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Restored manager',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Original issuer',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
    })
  ).json()
  const key = await (
    await request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'Original caller',
        flowId: flow.id,
        permissions: ['query'],
        releaseRevision: 1,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
      member.token,
    )
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const downloaded = await request(`/api/backups/${backup.id}`)
  expect(downloaded.status).toBe(200)
  const bytes = new Uint8Array(await downloaded.arrayBuffer())
  expect(bytes.length).toBe(backup.bytes)
  const directory = mkdtempSync(join(tmpdir(), 'besh-tenant-restore-'))
  const databasePath = join(directory, 'restored.sqlite')
  writeFileSync(databasePath, bytes)
  const restored = createApp({
    databasePath,
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(async () => {
    await restored.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const fetchRestored = (
    path: string,
    token: string,
    method = 'GET',
    body?: unknown,
  ) =>
    restored.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  expect(
    await (await fetchRestored('/api/tenant-context', member.token)).json(),
  ).toEqual({
    assignment: { tenantId: tenant.id, version: 1 },
    tenant: { id: tenant.id, label: tenant.label, state: 'active' },
    backupsOwnerOnly: true,
  })
  expect(
    (
      await (
        await fetchRestored(`/api/data-sources/${source.id}/row-policy`, owner)
      ).json()
    ).provenance,
  ).toEqual({ status: 'available', textColumns: ['tenant', 'name'] })
  expect(
    (await (await fetchRestored('/api/runtime-keys', owner)).json())[0],
  ).toMatchObject({
    id: key.id,
    tenantId: tenant.id,
    issuerBinding: key.issuerBinding,
    releaseRevision: 1,
    expiresAt: key.expiresAt,
  })
  const result = await fetchRestored(
    '/graphql/restored-tenant',
    key.token,
    'POST',
    { query: '{ rows { name } }' },
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ data: { rows: [{ name: 'Ada' }] } })
})

test('protected job history becomes cleanup-only when its still-assigned issuer loses dependency use', async () => {
  let finish!: (
    summary: import('../src/load-tests/model').LoadTestSummary,
  ) => void
  const { request, listen } = workspace({
    k6Runner: async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  const upload = new FormData()
  upload.set('name', 'Cleanup rows')
  upload.set('file', new File(['tenant,name\nA,Ada\n'], 'people.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Names',
      path: '/cleanup-rows',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Scoped load runner',
      permissions: ['load-tests.run'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Still assigned A',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  listen()
  const started = await request(
    '/api/load-tests',
    'POST',
    { flowId: flow.id },
    member.token,
  )
  expect(started.status).toBe(202)
  const job = await started.json()
  expect(
    (
      await (
        await request(
          `/api/load-tests/${job.id}`,
          'GET',
          undefined,
          member.token,
        )
      ).json()
    ).cleanupOnly,
  ).toBeUndefined()
  await request(`/api/members/${member.id}/access`, 'PUT', {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: {
      sources: [],
      databaseConnections: [],
      authConnections: [],
    },
    version: member.access.version,
  })
  const history = await (
    await request(`/api/load-tests/${job.id}`, 'GET', undefined, member.token)
  ).json()
  expect(history).toMatchObject({ tenantId: tenant.id, cleanupOnly: true })
  expect(
    (
      await (
        await request('/api/load-tests', 'GET', undefined, member.token)
      ).json()
    )[0],
  ).toMatchObject({ id: job.id, cleanupOnly: true })
  expect(
    (
      await request(
        `/api/load-tests/${job.id}/cancel`,
        'POST',
        {},
        member.token,
      )
    ).status,
  ).toBe(200)
  finish({
    requests: 0,
    requestsPerSecond: 0,
    failedRequests: 0,
    checkRate: 0,
    avgMs: 0,
    p95Ms: 0,
    maxMs: 0,
    thresholdsPassed: false,
  })
})

test('source identity eligibility rejects control cells without rejecting ordinary business text and excludes blank identities', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Blank and exact text')
  upload.set(
    'file',
    new File(
      [
        'tenant,name,notes\n,Unknown,ok\n A ,Spaced,ok\nA,Plain,ok\na,Lower,ok\n',
      ],
      'people.csv',
    ),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Exact names',
      path: '/blank-identity',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Space-sensitive',
      value: ' A ',
    })
  ).json()
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await (
        await request(`/api/flows/${flow.id}/test`, 'POST', {
          body: null,
          query: {},
          tenantId: tenant.id,
        })
      ).json()
    ).body,
  ).toEqual([{ name: 'Spaced' }])
  const unsafe = new FormData()
  unsafe.set('name', 'Ordinary control text')
  unsafe.set('file', new File(['tenant,name\n"A\t",Ada\n'], 'people.csv'))
  const imported = await request('/api/data-sources/import', 'POST', unsafe)
  expect(imported.status).toBe(200)
  const control = await imported.json()
  expect(
    (await (await request(`/api/data-sources/${control.id}/row-policy`)).json())
      .provenance,
  ).toEqual({ status: 'available', textColumns: ['name'] })
  expect(
    (
      await request(`/api/data-sources/${control.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(400)
})
