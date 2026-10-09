import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import { Database } from 'bun:sqlite'

const owner = 'tenant-fields-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-tenant-fields-'))
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  }
  let server = createApp(options)
  cleanup.push(async () => {
    await server.close()
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture cleanup must remain inside the OS temporary directory',
      )
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
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
  return Object.assign(request, {
    directory,
    options,
    async reopen() {
      await server.close()
      server = createApp(options)
    },
  })
}

async function source(request: ReturnType<typeof workspace>) {
  const upload = new FormData()
  upload.set('name', 'Tenant salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const response = await request('/api/data-sources/import', 'POST', upload)
  expect(response.status).toBe(200)
  return response.json()
}

async function copy(request: ReturnType<typeof workspace>) {
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER); CREATE TABLE notes (tenant TEXT, note TEXT)',
  )
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('B', 'Grace', 2400)
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private A note')
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Tenant copy')
  upload.set('file', new File([bytes], 'tenants.sqlite'))
  const response = await request('/api/database-connections', 'POST', upload)
  expect(response.status).toBe(200)
  return response.json()
}

test('an absent owner source tenant field profile inherits shared fields without exposing exact identity text', async () => {
  const request = workspace()
  const imported = await source(request)
  const tenantResponse = await request('/api/tenants', 'POST', {
    label: 'Company A',
    value: ' A ',
  })
  expect(tenantResponse.status).toBe(200)
  const tenant = await tenantResponse.json()
  const response = await request(
    `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`,
  )
  expect(response.status).toBe(200)
  const profile = await response.json()
  expect(profile).toEqual({
    mode: 'unprotected',
    version: 1,
    resourceVersion: 1,
    tenant: { id: tenant.id, label: 'Company A', state: 'active', version: 1 },
    active: false,
    configured: false,
    profile: { mode: 'inherit' },
    globalFields: { mode: 'all', columns: [] },
    effectiveColumns: ['tenant', 'name', 'salary'],
  })
  expect(JSON.stringify(profile)).not.toContain(' A ')
})

test('owner saves a dormant selected source profile with shared policy versions and it survives restart', async () => {
  const request = workspace()
  const imported = await source(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`
  const changed = await request(path, 'PUT', {
    version: 1,
    resourceVersion: 1,
    tenantVersion: 1,
    fields: { mode: 'selected', columns: ['salary'] },
  })
  expect(changed.status).toBe(200)
  expect(await changed.json()).toMatchObject({
    mode: 'unprotected',
    version: 2,
    resourceVersion: 1,
    active: false,
    configured: true,
    profile: { mode: 'selected', columns: ['salary'] },
    effectiveColumns: ['salary'],
  })
  await request.reopen()
  const restored = await request(path)
  expect(restored.status).toBe(200)
  expect(await restored.json()).toMatchObject({
    version: 2,
    profile: { mode: 'selected', columns: ['salary'] },
    effectiveColumns: ['salary'],
  })
})

test('a tenant profile denies private fields to an old pinned caller while another tenant keeps the unchanged publication', async () => {
  const request = workspace()
  const imported = await source(request)
  const flow = await (
    await request(`/api/data-sources/${imported.id}/api`, 'POST', {
      name: 'Tenant salaries',
      path: '/tenant-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  expect(
    (
      await request(`/api/data-sources/${imported.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issue = async (tenantId: string) => {
    const response = await request('/api/runtime-keys', 'POST', {
      name: 'Pinned caller',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(response.status).toBe(200)
    return response.json()
  }
  const keyA = await issue(a.id)
  const keyB = await issue(b.id)
  expect(
    await (
      await request('/run/tenant-salaries', 'GET', undefined, keyA.token)
    ).json(),
  ).toEqual([{ name: 'Ada', salary: 1200 }])
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code?revision=1`)
  ).json()
  expect(
    (
      await request(
        `/api/data-sources/${imported.id}/tenant-fields/${a.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          tenantVersion: 1,
          fields: { mode: 'selected', columns: ['name'] },
        },
      )
    ).status,
  ).toBe(200)
  const denied = await request(
    '/run/tenant-salaries',
    'GET',
    undefined,
    keyA.token,
  )
  expect(denied.status).toBe(403)
  expect(await denied.text()).not.toContain('1200')
  const permitted = await request(
    '/run/tenant-salaries',
    'GET',
    undefined,
    keyB.token,
  )
  expect(permitted.status).toBe(200)
  expect(await permitted.json()).toEqual([{ name: 'Grace', salary: 2400 }])
  expect(
    await (
      await request(`/api/flows/${flow.id}/backend-code?revision=1`)
    ).json(),
  ).toEqual(artifact)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
  ).toBe(1)
})

test('uploaded SQLite tenant profiles default to inherit independently for every inspected table', async () => {
  const request = workspace()
  const imported = await copy(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: ' A ' })
  ).json()
  const response = await request(
    `/api/database-connections/${imported.id}/tenant-fields/${tenant.id}`,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    mode: 'unprotected',
    version: 1,
    resourceVersion: 1,
    tenant: { id: tenant.id, label: 'A', state: 'active', version: 1 },
    active: false,
    configured: false,
    tables: [
      {
        table: 'notes',
        configured: false,
        profile: { mode: 'inherit' },
        globalFields: { mode: 'all', columns: [] },
        effectiveColumns: ['tenant', 'note'],
      },
      {
        table: 'people',
        configured: false,
        profile: { mode: 'inherit' },
        globalFields: { mode: 'all', columns: [] },
        effectiveColumns: ['tenant', 'name', 'salary'],
      },
    ],
  })
})

test('owner saves complete independent SQLite table profiles including deny-all and restores their review metadata', async () => {
  const request = workspace()
  const imported = await copy(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/database-connections/${imported.id}/tenant-fields/${tenant.id}`
  const changed = await request(path, 'PUT', {
    version: 1,
    resourceVersion: 1,
    tenantVersion: 1,
    tables: [
      { table: 'people', fields: { mode: 'selected', columns: ['salary'] } },
      { table: 'notes', fields: { mode: 'selected', columns: [] } },
    ],
  })
  expect(changed.status).toBe(200)
  const saved = await changed.json()
  expect(saved).toMatchObject({
    version: 2,
    resourceVersion: 1,
    active: false,
    configured: true,
  })
  expect(saved.tables).toEqual([
    {
      table: 'notes',
      configured: true,
      profile: { mode: 'selected', columns: [] },
      globalFields: { mode: 'all', columns: [] },
      effectiveColumns: [],
    },
    {
      table: 'people',
      configured: true,
      profile: { mode: 'selected', columns: ['salary'] },
      globalFields: { mode: 'all', columns: [] },
      effectiveColumns: ['salary'],
    },
  ])
  await request.reopen()
  expect(await (await request(path)).json()).toEqual(saved)
})

test('SQLite tenant profiles reject an old GraphQL projection even when the caller selects only a permitted field', async () => {
  const request = workspace()
  const imported = await copy(request)
  const flow = await (
    await request(`/api/database-connections/${imported.id}/api`, 'POST', {
      version: 1,
      table: 'people',
      name: 'Copy salaries',
      path: '/copy-salaries',
      protocol: 'graphql',
      columns: ['name', 'salary'],
      limit: 10,
    })
  ).json()
  const a = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const b = await (
    await request('/api/tenants', 'POST', { label: 'B', value: 'B' })
  ).json()
  expect(
    (
      await request(
        `/api/database-connections/${imported.id}/row-policy`,
        'PUT',
        {
          mode: 'tenant',
          version: 1,
          resourceVersion: 1,
          tables: [
            { table: 'people', column: 'tenant' },
            { table: 'notes', column: 'tenant' },
          ],
        },
      )
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issue = async (tenantId: string) => {
    const response = await request('/api/runtime-keys', 'POST', {
      name: 'Pinned query caller',
      flowId: flow.id,
      permissions: ['query'],
      releaseRevision: 1,
      tenantId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(response.status).toBe(200)
    return response.json()
  }
  const keyA = await issue(a.id)
  const keyB = await issue(b.id)
  expect(
    await (
      await request(
        '/graphql/copy-salaries',
        'POST',
        { query: '{ rows { name salary } }' },
        keyA.token,
      )
    ).json(),
  ).toEqual({ data: { rows: [{ name: 'Ada', salary: 1200 }] } })
  expect(
    (
      await request(
        `/api/database-connections/${imported.id}/tenant-fields/${a.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          tenantVersion: 1,
          tables: [
            {
              table: 'people',
              fields: { mode: 'selected', columns: ['name'] },
            },
            { table: 'notes', fields: { mode: 'inherit' } },
          ],
        },
      )
    ).status,
  ).toBe(200)
  const denied = await request(
    '/graphql/copy-salaries',
    'POST',
    { query: '{ rows { name } }' },
    keyA.token,
  )
  expect(denied.status).toBe(403)
  expect(await denied.text()).not.toContain('Ada')
  const permitted = await request(
    '/graphql/copy-salaries',
    'POST',
    { query: '{ rows { name salary } }' },
    keyB.token,
  )
  expect(permitted.status).toBe(200)
  expect(await permitted.json()).toEqual({
    data: { rows: [{ name: 'Grace', salary: 2400 }] },
  })
})

test('source replacement preserves retained retired tenant selections and owner can reset them without activating protection', async () => {
  const request = workspace()
  const imported = await source(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const profilePath = `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 1,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: ['salary'] },
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/tenants/${tenant.id}`, 'PUT', {
        label: 'Retired A',
        state: 'retired',
        version: 1,
      })
    ).status,
  ).toBe(200)
  const before = await (
    await request(`/api/data-sources/${imported.id}`)
  ).json()
  const auditBefore = await (await request('/api/audit')).json()
  const replace = () => {
    const upload = new FormData()
    upload.set('name', 'Tenant salaries')
    upload.set('file', new File(['tenant,name\nA,Ada\n'], 'people.csv'))
    return request(`/api/data-sources/${imported.id}/import`, 'PUT', upload)
  }
  expect((await replace()).status).toBe(409)
  expect(
    await (await request(`/api/data-sources/${imported.id}`)).json(),
  ).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 2,
        resourceVersion: 1,
        tenantVersion: 2,
        fields: { mode: 'inherit' },
      })
    ).status,
  ).toBe(200)
  expect((await replace()).status).toBe(200)
  const repaired = await (await request(profilePath)).json()
  expect(repaired).toMatchObject({
    mode: 'unprotected',
    active: false,
    configured: false,
    profile: { mode: 'inherit' },
    resourceVersion: 2,
    tenant: { state: 'retired', version: 2 },
    effectiveColumns: ['tenant', 'name'],
  })
})

test('owner profile summaries find retained tenants without disclosing registry values', async () => {
  const request = workspace()
  const imported = await source(request)
  const database = await copy(request)
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Company A',
      value: 'Secret exact identity',
    })
  ).json()
  expect(
    (
      await request(
        `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`,
        'PUT',
        {
          version: 1,
          resourceVersion: 1,
          tenantVersion: 1,
          fields: { mode: 'selected', columns: [] },
        },
      )
    ).status,
  ).toBe(200)
  const summary = await request(
    `/api/data-sources/${imported.id}/tenant-fields`,
  )
  expect(summary.status).toBe(200)
  expect(await summary.json()).toEqual({
    version: 2,
    resourceVersion: 1,
    configuredTenantIds: [tenant.id],
  })
  expect(
    (await request(`/api/database-connections/${database.id}/tenant-fields`))
      .status,
  ).toBe(200)
  expect(
    await (
      await request(`/api/database-connections/${database.id}/tenant-fields`)
    ).json(),
  ).toEqual({ version: 1, resourceVersion: 1, configuredTenantIds: [] })
})

test('profile reviews compare policy, resource, and tenant versions and roll back every copy table atomically', async () => {
  const request = workspace()
  const imported = await copy(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/database-connections/${imported.id}/tenant-fields/${tenant.id}`
  const before = await (await request(path)).json()
  const auditBefore = await (await request('/api/audit')).json()
  const tables = [
    { table: 'people', fields: { mode: 'selected', columns: ['name'] } },
    { table: 'notes', fields: { mode: 'selected', columns: ['unknown'] } },
  ]
  const input = { version: 1, resourceVersion: 1, tenantVersion: 1, tables }
  expect((await request(path, 'PUT', input)).status).toBe(400)
  expect(await (await request(path)).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  const valid = {
    ...input,
    tables: [
      { table: 'people', fields: { mode: 'selected', columns: [] } },
      { table: 'notes', fields: { mode: 'inherit' } },
    ],
  }
  for (const version of ['version', 'resourceVersion', 'tenantVersion']) {
    expect(
      (await request(path, 'PUT', { ...valid, [version]: 2 })).status,
    ).toBe(409)
  }
  expect(
    (await request(path, 'PUT', { ...valid, tables: [valid.tables[0]] }))
      .status,
  ).toBe(400)
  expect(
    (
      await request(path, 'PUT', {
        ...valid,
        tables: [valid.tables[0], valid.tables[0]],
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/tenants/${tenant.id}`, 'PUT', {
        label: 'Retired A',
        state: 'retired',
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect((await request(path, 'PUT', valid)).status).toBe(409)
  expect(
    (await request(path, 'PUT', { ...valid, tenantVersion: 2 })).status,
  ).toBe(200)
  expect(await (await request(path)).json()).toMatchObject({
    version: 2,
    active: false,
    tenant: { version: 2, state: 'retired' },
    configured: true,
  })
})

test('tenant profiles gate business filters and both rollover credentials while global-only publication remains valid', async () => {
  const request = workspace()
  const imported = await source(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Assigned editor',
      role: 'editor',
      tenantId: tenant.id,
    })
  ).json()
  const create = async (
    path: string,
    filter?: { column: string; inputName: string },
  ) => {
    const response = await request(
      `/api/data-sources/${imported.id}/api`,
      'POST',
      {
        name: path,
        path,
        protocol: 'rest',
        columns: ['name'],
        limit: 10,
        ...(filter ? { filter } : {}),
      },
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const names = await create('/profile-names')
  const privateFilter = await create('/profile-salary-filter', {
    column: 'salary',
    inputName: 'salary',
  })
  const identityFilter = await create('/profile-identity-filter', {
    column: 'tenant',
    inputName: 'tenant',
  })
  const policyPath = `/api/data-sources/${imported.id}/row-policy`
  const profilePath = `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`
  expect(
    (
      await request(policyPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 2,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  for (const flow of [names, privateFilter, identityFilter]) {
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
  }
  for (const flow of [privateFilter, identityFilter]) {
    expect(
      (
        await request(`/api/flows/${flow.id}/test`, 'POST', {
          body: null,
          query: {},
          tenantId: tenant.id,
        })
      ).status,
    ).toBe(403)
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
  }
  expect(
    (
      await request(
        `/api/flows/${names.id}/test`,
        'POST',
        { body: null, query: {} },
        member.token,
      )
    ).status,
  ).toBe(200)
  const issue = (flowId: string) =>
    request('/api/runtime-keys', 'POST', {
      name: 'Profile caller',
      flowId,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  expect((await issue(privateFilter.id)).status).toBe(403)
  const original = await (await issue(names.id)).json()
  const rotation = await request(
    `/api/runtime-keys/${original.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
  )
  expect(rotation.status).toBe(200)
  const replacement = await rotation.json()
  expect(replacement).toMatchObject({
    tenantId: tenant.id,
    releaseRevision: 1,
    expiresAt: original.expiresAt,
  })
  for (const token of [original.token, replacement.token]) {
    expect(
      await (
        await request('/run/profile-names', 'GET', undefined, token)
      ).json(),
    ).toEqual([{ name: 'Ada' }])
  }
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 3,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: [] },
      })
    ).status,
  ).toBe(200)
  for (const token of [original.token, replacement.token]) {
    expect(
      (await request('/run/profile-names', 'GET', undefined, token)).status,
    ).toBe(403)
  }
  expect((await issue(names.id)).status).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${replacement.id}/rotate`, 'POST', {}))
      .status,
  ).toBe(409)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 4,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'inherit' },
      })
    ).status,
  ).toBe(200)
  for (const token of [original.token, replacement.token]) {
    expect(
      (await request('/run/profile-names', 'GET', undefined, token)).status,
    ).toBe(200)
  }
})

test('latent tenant fields intersect current shared fields and remain inactive through deprotection', async () => {
  const request = workspace()
  const imported = await source(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const flow = await (
    await request(`/api/data-sources/${imported.id}/api`, 'POST', {
      name: 'Salary only',
      path: '/latent-salary',
      protocol: 'rest',
      columns: ['salary'],
      limit: 10,
    })
  ).json()
  const rowPath = `/api/data-sources/${imported.id}/row-policy`
  const profilePath = `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`
  expect(
    (
      await request(rowPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const original = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Latent caller',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  ).json()
  const call = () =>
    request('/run/latent-salary', 'GET', undefined, original.token)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 2,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: ['salary'] },
      })
    ).status,
  ).toBe(200)
  expect((await call()).status).toBe(200)
  expect(
    (
      await request(rowPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 3,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  expect(await (await request(profilePath)).json()).toMatchObject({
    profile: { mode: 'selected', columns: ['salary'] },
    effectiveColumns: [],
    active: true,
  })
  expect((await call()).status).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${original.id}/rotate`, 'POST', {}))
      .status,
  ).toBe(409)
  expect(
    (
      await request(rowPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 4,
        resourceVersion: 1,
        fields: { mode: 'all', columns: [] },
      })
    ).status,
  ).toBe(200)
  expect(await (await call()).json()).toEqual([{ salary: 1200 }])
  expect(
    (
      await request(rowPath, 'PUT', {
        mode: 'unprotected',
        version: 5,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 6,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: [] },
      })
    ).status,
  ).toBe(200)
  expect(await (await request(profilePath)).json()).toMatchObject({
    active: false,
    configured: true,
    effectiveColumns: [],
    profile: { mode: 'selected', columns: [] },
  })
  expect(await (await call()).json()).toEqual([
    { salary: 1200 },
    { salary: 2400 },
  ])
  expect(
    (
      await request(rowPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 7,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect((await call()).status).toBe(403)
  expect(
    (
      await request(profilePath, 'PUT', {
        version: 8,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'inherit' },
      })
    ).status,
  ).toBe(200)
  expect(await (await call()).json()).toEqual([{ salary: 1200 }])
})

test('malformed profiles in detached downloaded backups fail closed instead of inheriting shared fields', async () => {
  const request = workspace()
  const imported = await source(request)
  const database = await copy(request)
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const sourcePath = `/api/data-sources/${imported.id}/tenant-fields/${tenant.id}`
  const databasePath = `/api/database-connections/${database.id}/tenant-fields/${tenant.id}`
  expect(
    (
      await request(sourcePath, 'PUT', {
        version: 1,
        resourceVersion: 1,
        tenantVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(databasePath, 'PUT', {
        version: 1,
        resourceVersion: 1,
        tenantVersion: 1,
        tables: [
          { table: 'people', fields: { mode: 'selected', columns: ['name'] } },
          { table: 'notes', fields: { mode: 'inherit' } },
        ],
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/data-sources/${imported.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/database-connections/${database.id}/row-policy`,
        'PUT',
        {
          mode: 'tenant',
          version: 2,
          resourceVersion: 1,
          tables: [
            { table: 'people', column: 'tenant' },
            { table: 'notes', column: 'tenant' },
          ],
        },
      )
    ).status,
  ).toBe(200)
  const sourceFlow = await (
    await request(`/api/data-sources/${imported.id}/api`, 'POST', {
      name: 'Source names',
      path: '/corrupt-source',
      protocol: 'rest',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const databaseFlow = await (
    await request(`/api/database-connections/${database.id}/api`, 'POST', {
      name: 'Copy names',
      path: '/corrupt-copy',
      protocol: 'rest',
      version: 1,
      table: 'people',
      columns: ['name'],
      limit: 10,
    })
  ).json()
  const issue = async (flowId: string) => {
    expect(
      (await request(`/api/flows/${flowId}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
    const response = await request('/api/runtime-keys', 'POST', {
      name: 'Retained caller',
      flowId,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(response.status).toBe(200)
    return response.json()
  }
  const sourceKey = await issue(sourceFlow.id)
  const databaseKey = await issue(databaseFlow.id)
  expect(
    (
      await request(
        `/api/data-sources/${imported.id}/tenant-fields/missing-tenant`,
      )
    ).status,
  ).toBe(404)
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())
  const cases = [
    {
      file: 'duplicate-source.sqlite',
      sql: 'UPDATE source_tenant_field_profiles SET columns = \'["name","name"]\'',
      path: sourcePath,
      runtime: '/run/corrupt-source',
      token: sourceKey.token,
    },
    {
      file: 'unknown-copy.sqlite',
      sql: 'UPDATE database_tenant_field_profiles SET columns = \'["unknown"]\'',
      path: databasePath,
      runtime: '/run/corrupt-copy',
      token: databaseKey.token,
    },
    {
      file: 'dangling-profile.sqlite',
      sql: 'DELETE FROM tenants',
      path: `/api/data-sources/${imported.id}/tenant-fields`,
    },
  ]
  for (const fixture of cases) {
    const path = join(request.directory, fixture.file)
    writeFileSync(path, bytes)
    // Only a detached public backup is changed; no active control database writes.
    const detached = new Database(path)
    detached.run('PRAGMA foreign_keys = OFF')
    detached.run(fixture.sql)
    detached.close()
    const restored = createApp({ ...request.options, databasePath: path })
    try {
      const response = await restored.app.handle(
        new Request(`http://localhost${fixture.path}`, {
          headers: { authorization: `Bearer ${owner}` },
        }),
      )
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain('Private A note')
      if (fixture.runtime) {
        const runtime = await restored.app.handle(
          new Request(`http://localhost${fixture.runtime}`, {
            headers: { authorization: `Bearer ${fixture.token}` },
          }),
        )
        expect(runtime.status).toBe(503)
        expect(await runtime.text()).not.toContain('Ada')
        const audit = await restored.app.handle(
          new Request('http://localhost/api/audit', {
            headers: { authorization: `Bearer ${owner}` },
          }),
        )
        expect(
          (await audit.json()).filter(
            (event: { action: string }) => event.action === 'flow.executed',
          ),
        ).toEqual([])
      }
    } finally {
      await restored.close()
    }
  }
})
