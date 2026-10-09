import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import { Database } from 'bun:sqlite'
import type { RuntimeKey } from '../src/workspace/store'

const owner = 'member-fields-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-member-fields-'))
  const server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(async () => {
    await server.close()
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture cleanup must remain inside the OS temporary directory',
      )
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  return (path: string, method = 'GET', body?: unknown, token = owner) =>
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
}

test('owner reviews absent inherited source member fields without rows or exact identity text', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Member people')
  upload.set(
    'file',
    new File(['tenant,name\n A ,Ada\nB,Grace\n'], 'people.csv'),
  )
  const importedResponse = await request(
    '/api/data-sources/import',
    'POST',
    upload,
  )
  expect(importedResponse.status).toBe(200)
  const source = await importedResponse.json()
  const tenantResponse = await request('/api/tenants', 'POST', {
    label: 'Company A',
    value: ' A ',
  })
  expect(tenantResponse.status).toBe(200)
  const tenant = await tenantResponse.json()
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
  const memberResponse = await request('/api/members', 'POST', {
    name: 'Assigned reader',
    role: 'viewer',
    tenantId: tenant.id,
  })
  expect(memberResponse.status).toBe(200)
  const member = await memberResponse.json()
  const response = await request(
    `/api/data-sources/${source.id}/member-fields/${member.id}`,
  )
  expect(response.status).toBe(200)
  const profile = await response.json()
  expect(profile).toEqual({
    mode: 'tenant',
    version: 2,
    resourceVersion: 1,
    member: {
      id: member.id,
      name: 'Assigned reader',
      role: 'viewer',
      roleId: null,
      roleVersion: 0,
      accessVersion: 1,
      tenantAssignment: { tenantId: tenant.id, version: 1 },
    },
    tenant: { id: tenant.id, label: 'Company A', state: 'active', version: 1 },
    active: true,
    configured: false,
    profile: { mode: 'inherit' },
    globalFields: { mode: 'all', columns: [] },
    tenantProfile: { mode: 'inherit' },
    effectiveColumns: ['tenant', 'name'],
  })
  expect(JSON.stringify(profile)).not.toContain(' A ')
  expect(JSON.stringify(profile)).not.toContain('Ada')
})

test('owner saves reviewed source member fields and reads their persisted intersection', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Reviewed member people')
  upload.set(
    'file',
    new File(
      ['tenant,name,salary,email\nA,Ada,1200,ada@example.test\n'],
      'people.csv',
    ),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const tenantResponse = await request('/api/tenants', 'POST', {
    label: 'Company A',
    value: 'A',
  })
  expect(tenantResponse.status).toBe(200)
  const tenant = await tenantResponse.json()
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        fields: { mode: 'selected', columns: ['name', 'salary'] },
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/tenant-fields/${tenant.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          tenantVersion: 1,
          fields: { mode: 'selected', columns: ['name', 'email'] },
        },
      )
    ).status,
  ).toBe(200)
  const created = await request('/api/members', 'POST', {
    name: 'Profile reader',
    role: 'viewer',
    tenantId: tenant.id,
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  const path = `/api/data-sources/${source.id}/member-fields/${member.id}`
  const saved = await request(path, 'PUT', {
    version: 3,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: null,
    roleVersion: 0,
    fields: { mode: 'selected', columns: ['name', 'salary'] },
  })
  expect(saved.status).toBe(200)
  const profile = await saved.json()
  expect(profile).toMatchObject({
    mode: 'tenant',
    version: 4,
    resourceVersion: 1,
    configured: true,
    active: true,
    profile: { mode: 'selected', columns: ['name', 'salary'] },
    globalFields: { mode: 'selected', columns: ['name', 'salary'] },
    tenantProfile: { mode: 'selected', columns: ['name', 'email'] },
    effectiveColumns: ['name'],
    member: {
      id: member.id,
      roleId: null,
      roleVersion: 0,
      accessVersion: 1,
      tenantAssignment: { tenantId: tenant.id, version: 1 },
    },
  })
  expect(await (await request(path)).json()).toEqual(profile)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'data-source.member-fields.updated' &&
        entry.resource === `${source.id}:${member.id}`,
    ),
  ).toHaveLength(1)
})

test('source member fields restrict the original pinned issuer while same-tenant and owner-independent callers remain unchanged', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Issuer salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const generated = await request(
    `/api/data-sources/${source.id}/api`,
    'POST',
    {
      name: 'Issuer salaries',
      path: '/member-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Shared company',
      value: 'A',
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
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code?revision=1`)
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Linked callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const createMember = async (name: string) => {
    const response = await request('/api/members', 'POST', {
      name,
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
    expect(response.status).toBe(200)
    return response.json()
  }
  const a = await createMember('Original issuer A')
  const b = await createMember('Same-tenant issuer B')
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const issue = async (name: string, token: string, tenantId?: string) => {
    const response = await request(
      '/api/runtime-keys',
      'POST',
      {
        name,
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt,
        ...(tenantId === undefined ? {} : { tenantId }),
      },
      token,
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const originalA = await issue('Original A', a.token)
  const keyB = await issue('Independent B', b.token)
  const independent = await issue('Owner-independent', owner, tenant.id)
  const rotated = await request(
    `/api/runtime-keys/${originalA.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
  )
  expect(rotated.status).toBe(200)
  const successorA = await rotated.json()
  expect(successorA).toMatchObject({
    tenantId: tenant.id,
    releaseRevision: 1,
    expiresAt,
    issuerBinding: { memberId: a.id, action: 'runtime-keys.manage' },
  })
  expect(independent.issuerBinding).toBeNull()
  for (const key of [originalA, successorA, keyB, independent])
    expect(
      await (
        await request('/run/member-salaries', 'GET', undefined, key.token)
      ).json(),
    ).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/member-fields/${a.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          memberAccessVersion: 1,
          tenantAssignmentVersion: 1,
          tenantVersion: 1,
          roleId: role.id,
          roleVersion: 1,
          fields: { mode: 'selected', columns: ['name'] },
        },
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/run/member-salaries', 'GET', undefined, originalA.token))
      .status,
  ).toBe(403)
  expect(
    (
      await request(
        `/run/member-salaries?memberId=${b.id}`,
        'GET',
        undefined,
        successorA.token,
      )
    ).status,
  ).toBe(403)
  for (const key of [keyB, independent])
    expect(
      await (
        await request('/run/member-salaries', 'GET', undefined, key.token)
      ).json(),
    ).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(
    await (
      await request(`/api/flows/${flow.id}/backend-code?revision=1`)
    ).json(),
  ).toEqual(artifact)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).contract,
  ).toEqual(flow.contract)
})

test('source replacement preserves a dormant member selection even when shared fields remain unrestricted', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Dormant member salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const created = await request('/api/members', 'POST', {
    name: 'Unassigned reader',
    role: 'viewer',
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  const profilePath = `/api/data-sources/${source.id}/member-fields/${member.id}`
  const selected = await request(profilePath, 'PUT', {
    version: 1,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: null,
    roleId: null,
    roleVersion: 0,
    fields: { mode: 'selected', columns: ['salary'] },
  })
  expect(selected.status).toBe(200)
  const profile = await selected.json()
  expect(profile).toMatchObject({
    mode: 'unprotected',
    configured: true,
    active: false,
    globalFields: { mode: 'all', columns: [] },
    profile: { mode: 'selected', columns: ['salary'] },
    tenant: null,
    effectiveColumns: null,
  })
  const before = await (await request(`/api/data-sources/${source.id}`)).json()
  const auditBefore = await (await request('/api/audit')).json()
  const replacement = new FormData()
  replacement.set('name', 'Dormant member salaries')
  replacement.set('file', new File(['tenant,name\nA,Ada\n'], 'people.csv'))
  const replaced = await request(
    `/api/data-sources/${source.id}/import`,
    'PUT',
    replacement,
  )
  expect(replaced.status).toBe(409)
  expect(
    await (await request(`/api/data-sources/${source.id}`)).json(),
  ).toEqual(before)
  expect(await (await request(profilePath)).json()).toEqual(profile)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
})

test('owner reviews every inspected SQLite table with inherited member fields and distinguishes an unassigned member', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER); CREATE TABLE notes (tenant TEXT, note TEXT)',
  )
  database.query('INSERT INTO people VALUES (?, ?, ?)').run(' A ', 'Ada', 1200)
  database.query('INSERT INTO notes VALUES (?, ?)').run(' A ', 'Private note')
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Member copy')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Company A',
      value: ' A ',
    })
  ).json()
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [
          { table: 'notes', column: 'tenant' },
          {
            table: 'people',
            column: 'tenant',
            fields: { mode: 'selected', columns: ['name', 'salary'] },
          },
        ],
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          tenantVersion: 1,
          tables: [
            { table: 'notes', fields: { mode: 'selected', columns: [] } },
            {
              table: 'people',
              fields: { mode: 'selected', columns: ['tenant', 'name'] },
            },
          ],
        },
      )
    ).status,
  ).toBe(200)
  const assigned = await (
    await request('/api/members', 'POST', {
      name: 'Assigned copy reader',
      role: 'viewer',
      tenantId: tenant.id,
    })
  ).json()
  const path = `/api/database-connections/${copy.id}/member-fields/${assigned.id}`
  const response = await request(path)
  expect(response.status).toBe(200)
  const profile = await response.json()
  expect(profile).toEqual({
    mode: 'tenant',
    version: 3,
    resourceVersion: 1,
    member: {
      id: assigned.id,
      name: 'Assigned copy reader',
      role: 'viewer',
      roleId: null,
      roleVersion: 0,
      accessVersion: 1,
      tenantAssignment: { tenantId: tenant.id, version: 1 },
    },
    tenant: { id: tenant.id, label: 'Company A', state: 'active', version: 1 },
    active: true,
    configured: false,
    tables: [
      {
        table: 'notes',
        configured: false,
        profile: { mode: 'inherit' },
        globalFields: { mode: 'all', columns: [] },
        tenantProfile: { mode: 'selected', columns: [] },
        effectiveColumns: [],
      },
      {
        table: 'people',
        configured: false,
        profile: { mode: 'inherit' },
        globalFields: { mode: 'selected', columns: ['name', 'salary'] },
        tenantProfile: { mode: 'selected', columns: ['tenant', 'name'] },
        effectiveColumns: ['name'],
      },
    ],
  })
  for (const privateText of [' A ', 'Ada', 'Private note', '1200'])
    expect(JSON.stringify(profile)).not.toContain(privateText)
  expect((await request(path, 'GET', undefined, assigned.token)).status).toBe(
    403,
  )
  const unassigned = await (
    await request('/api/members', 'POST', {
      name: 'Unassigned copy reader',
      role: 'viewer',
    })
  ).json()
  const unknownResponse = await request(
    `/api/database-connections/${copy.id}/member-fields/${unassigned.id}`,
  )
  expect(unknownResponse.status).toBe(200)
  const unknown = await unknownResponse.json()
  expect(unknown).toMatchObject({
    tenant: null,
    active: false,
    configured: false,
    member: { tenantAssignment: { tenantId: null, version: 1 } },
    tables: [
      {
        table: 'notes',
        profile: { mode: 'inherit' },
        globalFields: { mode: 'all', columns: [] },
        tenantProfile: null,
        effectiveColumns: null,
      },
      {
        table: 'people',
        profile: { mode: 'inherit' },
        globalFields: { mode: 'selected', columns: ['name', 'salary'] },
        tenantProfile: null,
        effectiveColumns: null,
      },
    ],
  })
})

test('owner saves a complete reviewed SQLite member field map with independent inherited and selected defaults', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER); CREATE TABLE notes (tenant TEXT, note TEXT)',
  )
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private note')
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Reviewed member copy')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Company A',
      value: 'A',
    })
  ).json()
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [
          { table: 'notes', column: 'tenant' },
          {
            table: 'people',
            column: 'tenant',
            fields: { mode: 'selected', columns: ['name', 'salary'] },
          },
        ],
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        `/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          tenantVersion: 1,
          tables: [
            { table: 'notes', fields: { mode: 'inherit' } },
            {
              table: 'people',
              fields: { mode: 'selected', columns: ['tenant', 'name'] },
            },
          ],
        },
      )
    ).status,
  ).toBe(200)
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Reviewed copy reader',
      role: 'viewer',
      tenantId: tenant.id,
    })
  ).json()
  const path = `/api/database-connections/${copy.id}/member-fields/${member.id}`
  const saved = await request(path, 'PUT', {
    version: 3,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: null,
    roleVersion: 0,
    tables: [
      {
        table: 'people',
        fields: { mode: 'selected', columns: ['name', 'salary'] },
      },
      { table: 'notes', fields: { mode: 'inherit' } },
    ],
  })
  expect(saved.status).toBe(200)
  const profile = await saved.json()
  expect(profile).toMatchObject({
    version: 4,
    resourceVersion: 1,
    configured: true,
    active: true,
    member: {
      id: member.id,
      roleId: null,
      roleVersion: 0,
      accessVersion: 1,
      tenantAssignment: { tenantId: tenant.id, version: 1 },
    },
    tables: [
      {
        table: 'notes',
        configured: false,
        profile: { mode: 'inherit' },
        globalFields: { mode: 'all', columns: [] },
        tenantProfile: { mode: 'inherit' },
        effectiveColumns: ['tenant', 'note'],
      },
      {
        table: 'people',
        configured: true,
        profile: { mode: 'selected', columns: ['name', 'salary'] },
        globalFields: { mode: 'selected', columns: ['name', 'salary'] },
        tenantProfile: { mode: 'selected', columns: ['tenant', 'name'] },
        effectiveColumns: ['name'],
      },
    ],
  })
  expect(await (await request(path)).json()).toEqual(profile)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'database-connection.member-fields.updated' &&
        entry.resource === `${copy.id}:${member.id}`,
    ),
  ).toHaveLength(1)
})

test('SQLite member fields restrict the original pinned issuer through owner rotation without changing other same-tenant callers', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER); CREATE TABLE notes (tenant TEXT, note TEXT)',
  )
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('B', 'Grace', 2400)
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private note')
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Issuer copy salaries')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const generated = await request(
    `/api/database-connections/${copy.id}/api`,
    'POST',
    {
      version: 1,
      table: 'people',
      name: 'Issuer copy salaries',
      path: '/member-copy-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Shared company',
      value: 'A',
    })
  ).json()
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [
          { table: 'notes', column: 'tenant' },
          { table: 'people', column: 'tenant' },
        ],
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code?revision=1`)
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Linked copy callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const createMember = async (name: string) => {
    const response = await request('/api/members', 'POST', {
      name,
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [copy.id],
          authConnections: [],
        },
      },
    })
    expect(response.status).toBe(200)
    return response.json()
  }
  const a = await createMember('Original copy issuer A')
  const b = await createMember('Same-tenant copy issuer B')
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const issue = async (name: string, token: string, tenantId?: string) => {
    const response = await request(
      '/api/runtime-keys',
      'POST',
      {
        name,
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt,
        ...(tenantId === undefined ? {} : { tenantId }),
      },
      token,
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const originalA = await issue('Original copy A', a.token)
  const keyB = await issue('Independent copy B', b.token)
  const independent = await issue('Owner-independent copy', owner, tenant.id)
  const rotated = await request(
    `/api/runtime-keys/${originalA.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
  )
  expect(rotated.status).toBe(200)
  const successorA = await rotated.json()
  expect(successorA).toMatchObject({
    tenantId: tenant.id,
    releaseRevision: 1,
    expiresAt,
    issuerBinding: { memberId: a.id, action: 'runtime-keys.manage' },
  })
  expect(independent.issuerBinding).toBeNull()
  for (const key of [originalA, successorA, keyB, independent])
    expect(
      await (
        await request('/run/member-copy-salaries', 'GET', undefined, key.token)
      ).json(),
    ).toEqual([{ name: 'Ada', salary: 1200 }])
  const keys = await (await request('/api/runtime-keys')).json()
  expect(
    (
      await request(
        `/api/database-connections/${copy.id}/member-fields/${a.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          memberAccessVersion: 1,
          tenantAssignmentVersion: 1,
          tenantVersion: 1,
          roleId: role.id,
          roleVersion: 1,
          tables: [
            { table: 'notes', fields: { mode: 'inherit' } },
            {
              table: 'people',
              fields: { mode: 'selected', columns: ['name'] },
            },
          ],
        },
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/run/member-copy-salaries',
        'GET',
        undefined,
        originalA.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/run/member-copy-salaries?memberId=${b.id}`,
        'GET',
        undefined,
        successorA.token,
      )
    ).status,
  ).toBe(403)
  for (const key of [keyB, independent])
    expect(
      await (
        await request('/run/member-copy-salaries', 'GET', undefined, key.token)
      ).json(),
    ).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(await (await request('/api/runtime-keys')).json()).toEqual(
    keys.map((key: { id: string }) =>
      [originalA.id, successorA.id].includes(key.id)
        ? { ...key, cleanupOnly: true }
        : key,
    ),
  )
  expect(
    await (
      await request(`/api/flows/${flow.id}/backend-code?revision=1`)
    ).json(),
  ).toEqual(artifact)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).contract,
  ).toEqual(flow.contract)
})

test('a narrowed member cannot rotate another issuer credential even in the same tenant while metadata and cleanup stay available', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Rotation salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\n'], 'people.csv'),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const generate = async (path: string, columns: string[]) => {
    const response = await request(
      `/api/data-sources/${source.id}/api`,
      'POST',
      {
        name: path,
        path,
        protocol: 'rest',
        columns,
        limit: 10,
      },
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const wide = await generate('/foreign-issuer-wide', ['name', 'salary'])
  const narrow = await generate('/own-issuer-narrow', ['name'])
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'Shared A', value: 'A' })
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
  for (const flow of [wide, narrow])
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Rotation operators',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const createMember = async (name: string) =>
    (
      await request('/api/members', 'POST', {
        name,
        role: 'custom',
        roleId: role.id,
        tenantId: tenant.id,
        access: {
          mode: 'selected',
          flowIds: [wide.id, narrow.id],
          dependencyUse: {
            sources: [source.id],
            databaseConnections: [],
            authConnections: [],
          },
        },
      })
    ).json()
  const a = await createMember('Narrow manager A')
  const b = await createMember('Wide issuer B')
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/member-fields/${a.id}`,
        'PUT',
        {
          version: 2,
          resourceVersion: 1,
          memberAccessVersion: 1,
          tenantAssignmentVersion: 1,
          tenantVersion: 1,
          roleId: role.id,
          roleVersion: 1,
          fields: { mode: 'selected', columns: ['name'] },
        },
      )
    ).status,
  ).toBe(200)
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const issue = (flowId: string, token: string) =>
    request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'Original issuer credential',
        flowId,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt,
      },
      token,
    )
  const issuedB = await issue(wide.id, b.token)
  expect(issuedB.status).toBe(200)
  const keyB = await issuedB.json()
  expect((await issue(wide.id, a.token)).status).toBe(403)
  const beforeKeys = await (await request('/api/runtime-keys')).json()
  const beforeAudit = await (await request('/api/audit')).json()
  const denied = await request(
    `/api/runtime-keys/${keyB.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
    a.token,
  )
  expect(denied.status).toBe(404)
  expect(await denied.json()).toEqual({ error: 'Runtime key not found' })
  expect(await (await request('/api/runtime-keys')).json()).toEqual(beforeKeys)
  expect(await (await request('/api/audit')).json()).toEqual(beforeAudit)
  expect(
    (
      await (
        await request('/api/runtime-keys', 'GET', undefined, a.token)
      ).json()
    ).map((key: { id: string }) => key.id),
  ).toContain(keyB.id)
  const ownerRotated = await request(
    `/api/runtime-keys/${keyB.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
  )
  expect(ownerRotated.status).toBe(200)
  const successorB = await ownerRotated.json()
  expect(successorB).toMatchObject({
    tenantId: tenant.id,
    releaseRevision: 1,
    expiresAt,
    issuerBinding: { memberId: b.id, action: 'runtime-keys.manage' },
  })
  expect(
    (await request(`/api/runtime-keys/${keyB.id}/rotate`, 'POST', {}, a.token))
      .status,
  ).toBe(404)
  expect(
    await (
      await request(
        '/run/foreign-issuer-wide',
        'GET',
        undefined,
        successorB.token,
      )
    ).json(),
  ).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(
    (
      await request(
        `/api/runtime-keys/${successorB.id}`,
        'DELETE',
        undefined,
        a.token,
      )
    ).status,
  ).toBe(200)
  const ownA = await issue(narrow.id, a.token)
  expect(ownA.status).toBe(200)
  const ownKey = await ownA.json()
  const ownRotated = await request(
    `/api/runtime-keys/${ownKey.id}/rotate`,
    'POST',
    {},
    a.token,
  )
  expect(ownRotated.status).toBe(200)
  const ownSuccessor = await ownRotated.json()
  expect(ownSuccessor.issuerBinding).toEqual({
    memberId: a.id,
    action: 'runtime-keys.manage',
  })
  expect(
    await (
      await request(
        '/run/own-issuer-narrow',
        'GET',
        undefined,
        ownSuccessor.token,
      )
    ).json(),
  ).toEqual([{ name: 'Ada' }])
})

test('source and SQLite member reviews detect independent custom-role edits and require a fresh explicit review', async () => {
  const request = workspace()
  const sourceUpload = new FormData()
  sourceUpload.set('name', 'Role review source')
  sourceUpload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\n'], 'people.csv'),
  )
  const sourceResponse = await request(
    '/api/data-sources/import',
    'POST',
    sourceUpload,
  )
  expect(sourceResponse.status).toBe(200)
  const source = await sourceResponse.json()
  const database = new Database(':memory:')
  database.run('CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER)')
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const copyUpload = new FormData()
  copyUpload.set('name', 'Role review copy')
  copyUpload.set('file', new File([bytes], 'people.sqlite'))
  const copyResponse = await request(
    '/api/database-connections',
    'POST',
    copyUpload,
  )
  expect(copyResponse.status).toBe(200)
  const copy = await copyResponse.json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Reviewed custom reader',
      permissions: ['flows.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Role review subject',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const sourcePath = `/api/data-sources/${source.id}/member-fields/${member.id}`
  const copyPath = `/api/database-connections/${copy.id}/member-fields/${member.id}`
  const sourceReview = await (await request(sourcePath)).json()
  const copyReview = await (await request(copyPath)).json()
  for (const review of [sourceReview, copyReview])
    expect(review.member).toMatchObject({
      roleId: role.id,
      roleVersion: 1,
      accessVersion: 1,
      tenantAssignment: { tenantId: null, version: 1 },
    })
  const editedRole = await request(`/api/roles/${role.id}`, 'PUT', {
    name: 'Reviewed custom reader',
    permissions: ['flows.read', 'flows.test'],
    version: 1,
  })
  expect(editedRole.status).toBe(200)
  const freshSource = await (await request(sourcePath)).json()
  const freshCopy = await (await request(copyPath)).json()
  for (const review of [freshSource, freshCopy])
    expect(review.member).toMatchObject({
      roleId: role.id,
      roleVersion: 2,
      accessVersion: 1,
      tenantAssignment: { tenantId: null, version: 1 },
    })
  const auditBefore = await (await request('/api/audit')).json()
  const stale = {
    version: 1,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: null,
    roleId: role.id,
    roleVersion: 1,
  }
  expect(
    (
      await request(sourcePath, 'PUT', {
        ...stale,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(copyPath, 'PUT', {
        ...stale,
        tables: [
          {
            table: 'people',
            fields: { mode: 'selected', columns: ['salary'] },
          },
        ],
      })
    ).status,
  ).toBe(409)
  expect(await (await request(sourcePath)).json()).toEqual(freshSource)
  expect(await (await request(copyPath)).json()).toEqual(freshCopy)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  const savedSource = await request(sourcePath, 'PUT', {
    ...stale,
    roleVersion: freshSource.member.roleVersion,
    fields: { mode: 'selected', columns: ['name'] },
  })
  expect(savedSource.status).toBe(200)
  expect(await savedSource.json()).toMatchObject({
    version: 2,
    configured: true,
    profile: { mode: 'selected', columns: ['name'] },
    member: { roleVersion: 2, accessVersion: 1 },
  })
  const savedCopy = await request(copyPath, 'PUT', {
    ...stale,
    roleVersion: freshCopy.member.roleVersion,
    tables: [
      { table: 'people', fields: { mode: 'selected', columns: ['salary'] } },
    ],
  })
  expect(savedCopy.status).toBe(200)
  expect(await savedCopy.json()).toMatchObject({
    version: 2,
    configured: true,
    member: { roleVersion: 2, accessVersion: 1 },
    tables: [
      { table: 'people', profile: { mode: 'selected', columns: ['salary'] } },
    ],
  })
})

test('an invalid second SQLite table profile rolls back the valid first table without advancing the policy or audit', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE notes (tenant TEXT, note TEXT); CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER)',
  )
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private note')
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Atomic member copy')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const createdMember = await request('/api/members', 'POST', {
    name: 'Unassigned map reviewer',
    role: 'viewer',
  })
  expect(createdMember.status).toBe(200)
  const member = await createdMember.json()
  const path = `/api/database-connections/${copy.id}/member-fields/${member.id}`
  const reviewed = await request(path)
  expect(reviewed.status).toBe(200)
  const before = await reviewed.json()
  expect(before).toMatchObject({
    version: 1,
    resourceVersion: 1,
    configured: false,
    member: {
      roleId: null,
      roleVersion: 0,
      accessVersion: 1,
      tenantAssignment: { tenantId: null, version: 1 },
    },
    tables: [
      { table: 'notes', configured: false, profile: { mode: 'inherit' } },
      { table: 'people', configured: false, profile: { mode: 'inherit' } },
    ],
  })
  const beforeAudit = await (await request('/api/audit')).json()
  const rejected = await request(path, 'PUT', {
    version: 1,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: null,
    roleId: null,
    roleVersion: 0,
    tables: [
      { table: 'notes', fields: { mode: 'selected', columns: ['note'] } },
      {
        table: 'people',
        fields: { mode: 'selected', columns: ['missing_salary'] },
      },
    ],
  })
  expect(rejected.status).toBe(400)
  expect(await (await request(path)).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(beforeAudit)
})

test('owner discovers retained source member profiles without exposing dormant subject names or data', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Private source summary')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Summary reader',
      permissions: ['flows.read'],
    })
  ).json()
  const created = await request('/api/members', 'POST', {
    name: 'Private dormant subject',
    role: 'custom',
    roleId: role.id,
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(
    (
      await request(
        `/api/data-sources/${source.id}/member-fields/${member.id}`,
        'PUT',
        {
          version: 1,
          resourceVersion: 1,
          memberAccessVersion: 1,
          tenantAssignmentVersion: 1,
          tenantVersion: null,
          roleId: role.id,
          roleVersion: 1,
          fields: { mode: 'selected', columns: ['name'] },
        },
      )
    ).status,
  ).toBe(200)
  const path = `/api/data-sources/${source.id}/member-fields`
  const response = await request(path)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    version: 2,
    resourceVersion: 1,
    configuredMemberIds: [member.id],
  })
  expect(
    (
      await request(
        '/api/data-sources/missing/member-fields',
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/data-sources/missing/member-fields')).status,
  ).toBe(404)
})

test('owner discovers retained SQLite member profiles including an empty selected table without exposing dormant subject data', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE notes (tenant TEXT, note TEXT); CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER)',
  )
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private note')
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Private copy summary')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Copy summary reader',
      permissions: ['flows.read'],
    })
  ).json()
  const created = await request('/api/members', 'POST', {
    name: 'Private dormant copy subject',
    role: 'custom',
    roleId: role.id,
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(
    (
      await request(
        `/api/database-connections/${copy.id}/member-fields/${member.id}`,
        'PUT',
        {
          version: 1,
          resourceVersion: 1,
          memberAccessVersion: 1,
          tenantAssignmentVersion: 1,
          tenantVersion: null,
          roleId: role.id,
          roleVersion: 1,
          tables: [
            { table: 'notes', fields: { mode: 'selected', columns: [] } },
            { table: 'people', fields: { mode: 'inherit' } },
          ],
        },
      )
    ).status,
  ).toBe(200)
  const path = `/api/database-connections/${copy.id}/member-fields`
  const response = await request(path)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    version: 2,
    resourceVersion: 1,
    configuredMemberIds: [member.id],
  })
  expect(
    (
      await request(
        '/api/database-connections/missing/member-fields',
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/database-connections/missing/member-fields')).status,
  ).toBe(404)
})

test('an empty source member ceiling denies existing callers until an explicit inherited reset restores the unchanged published replies', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Reset member salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const flows = []
  for (const [path, columns] of [
    ['/reset-wide', ['name', 'salary']],
    ['/reset-narrow', ['name']],
  ] as const) {
    const generated = await request(
      `/api/data-sources/${source.id}/api`,
      'POST',
      { name: path, path, protocol: 'rest', columns, limit: 10 },
    )
    expect(generated.status).toBe(200)
    flows.push(await generated.json())
  }
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'Company A', value: 'A' })
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
  for (const flow of flows)
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
  const artifacts = await Promise.all(
    flows.map(async (flow) =>
      (await request(`/api/flows/${flow.id}/backend-code?revision=1`)).json(),
    ),
  )
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Reset linked callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const members: { id: string; token: string }[] = []
  for (const name of ['Original issuer A', 'Same-tenant issuer B']) {
    const created = await request('/api/members', 'POST', {
      name,
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: flows.map((flow) => flow.id),
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
    expect(created.status).toBe(200)
    members.push(await created.json())
  }
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const keys: (RuntimeKey & { token: string })[] = []
  for (const [flow, token, independent] of [
    [flows[0], members[0].token, false],
    [flows[1], members[0].token, false],
    [flows[0], members[1].token, false],
    [flows[0], owner, true],
  ] as const) {
    const issued = await request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'Reset existing caller',
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt,
        ...(independent ? { tenantId: tenant.id } : {}),
      },
      token,
    )
    expect(issued.status).toBe(200)
    keys.push(await issued.json())
  }
  const call = (index: number) =>
    request(
      index === 1 ? '/run/reset-narrow' : '/run/reset-wide',
      'GET',
      undefined,
      keys[index].token,
    )
  const replies = [
    [{ name: 'Ada', salary: 1200 }],
    [{ name: 'Ada' }],
    [{ name: 'Ada', salary: 1200 }],
    [{ name: 'Ada', salary: 1200 }],
  ]
  for (let index = 0; index < keys.length; index++)
    expect(await (await call(index)).json()).toEqual(replies[index])
  const profilePath = `/api/data-sources/${source.id}/member-fields/${members[0].id}`
  const summaryPath = `/api/data-sources/${source.id}/member-fields`
  const auditCount = async () => {
    const audit = await (await request('/api/audit')).json()
    return audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'data-source.member-fields.updated' &&
        entry.resource === `${source.id}:${members[0].id}`,
    ).length
  }
  expect(await auditCount()).toBe(0)
  const review = {
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: role.id,
    roleVersion: 1,
  }
  const selected = await request(profilePath, 'PUT', {
    ...review,
    version: 2,
    fields: { mode: 'selected', columns: [] },
  })
  expect(selected.status).toBe(200)
  expect(await selected.json()).toMatchObject({
    version: 3,
    configured: true,
    profile: { mode: 'selected', columns: [] },
    effectiveColumns: [],
  })
  expect(await (await request(summaryPath)).json()).toEqual({
    version: 3,
    resourceVersion: 1,
    configuredMemberIds: [members[0].id],
  })
  expect(await auditCount()).toBe(1)
  for (const index of [0, 1]) expect((await call(index)).status).toBe(403)
  for (const index of [2, 3])
    expect(await (await call(index)).json()).toEqual(replies[index])
  const reset = await request(profilePath, 'PUT', {
    ...review,
    version: 3,
    fields: { mode: 'inherit' },
  })
  expect(reset.status).toBe(200)
  expect(await reset.json()).toMatchObject({
    version: 4,
    configured: false,
    profile: { mode: 'inherit' },
    effectiveColumns: ['tenant', 'name', 'salary'],
  })
  expect(await (await request(summaryPath)).json()).toEqual({
    version: 4,
    resourceVersion: 1,
    configuredMemberIds: [],
  })
  expect(await auditCount()).toBe(2)
  for (let index = 0; index < keys.length; index++)
    expect(await (await call(index)).json()).toEqual(replies[index])
  for (let index = 0; index < flows.length; index++) {
    const flow = flows[index]
    expect(
      await (
        await request(`/api/flows/${flow.id}/backend-code?revision=1`)
      ).json(),
    ).toEqual(artifacts[index])
    expect(
      (await (await request(`/api/flows/${flow.id}`)).json()).contract,
    ).toEqual(flow.contract)
  }
  const inventory = await (await request('/api/runtime-keys')).json()
  for (const key of keys)
    expect(
      inventory.find((current: { id: string }) => current.id === key.id),
    ).toMatchObject({
      flowId: key.flowId,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt,
      issuerBinding: key.issuerBinding,
      replacesKeyId: null,
      replacedByKeyId: null,
      revokedAt: null,
    })
})

test('an empty SQLite member table ceiling resets through a complete inherited map without replacing original callers or published replies', async () => {
  const request = workspace()
  const database = new Database(':memory:')
  database.run(
    'CREATE TABLE notes (tenant TEXT, note TEXT); CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER)',
  )
  database.query('INSERT INTO notes VALUES (?, ?)').run('A', 'Private note')
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('B', 'Grace', 2400)
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const upload = new FormData()
  upload.set('name', 'Reset copy salaries')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const generated = await request(
    `/api/database-connections/${copy.id}/api`,
    'POST',
    {
      version: 1,
      table: 'people',
      name: 'Reset copy salaries',
      path: '/reset-copy-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'Company A', value: 'A' })
  ).json()
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [
          { table: 'notes', column: 'tenant' },
          { table: 'people', column: 'tenant' },
        ],
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifactPath = `/api/flows/${flow.id}/backend-code?revision=1`
  const artifact = await (await request(artifactPath)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Reset copy callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const members: { id: string; token: string }[] = []
  for (const name of ['Original copy issuer A', 'Same-tenant copy issuer B']) {
    const created = await request('/api/members', 'POST', {
      name,
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [copy.id],
          authConnections: [],
        },
      },
    })
    expect(created.status).toBe(200)
    members.push(await created.json())
  }
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const keys: (RuntimeKey & { token: string })[] = []
  for (const token of [members[0].token, members[1].token, owner]) {
    const issued = await request(
      '/api/runtime-keys',
      'POST',
      {
        name: 'Reset existing copy caller',
        flowId: flow.id,
        permissions: ['rest'],
        releaseRevision: 1,
        expiresAt,
        ...(token === owner ? { tenantId: tenant.id } : {}),
      },
      token,
    )
    expect(issued.status).toBe(200)
    keys.push(await issued.json())
  }
  const call = (key: RuntimeKey & { token: string }) =>
    request('/run/reset-copy-salaries', 'GET', undefined, key.token)
  for (const key of keys)
    expect(await (await call(key)).json()).toEqual([
      { name: 'Ada', salary: 1200 },
    ])
  const profilePath = `/api/database-connections/${copy.id}/member-fields/${members[0].id}`
  const summaryPath = `/api/database-connections/${copy.id}/member-fields`
  const auditCount = async () => {
    const audit = await (await request('/api/audit')).json()
    return audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'database-connection.member-fields.updated' &&
        entry.resource === `${copy.id}:${members[0].id}`,
    ).length
  }
  expect(await auditCount()).toBe(0)
  const review = {
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: role.id,
    roleVersion: 1,
  }
  const selected = await request(profilePath, 'PUT', {
    ...review,
    version: 2,
    tables: [
      { table: 'notes', fields: { mode: 'inherit' } },
      { table: 'people', fields: { mode: 'selected', columns: [] } },
    ],
  })
  expect(selected.status).toBe(200)
  expect(await selected.json()).toMatchObject({
    version: 3,
    configured: true,
    tables: [
      {
        table: 'notes',
        configured: false,
        profile: { mode: 'inherit' },
        effectiveColumns: ['tenant', 'note'],
      },
      {
        table: 'people',
        configured: true,
        profile: { mode: 'selected', columns: [] },
        effectiveColumns: [],
      },
    ],
  })
  expect(await (await request(summaryPath)).json()).toEqual({
    version: 3,
    resourceVersion: 1,
    configuredMemberIds: [members[0].id],
  })
  expect(await auditCount()).toBe(1)
  expect((await call(keys[0])).status).toBe(403)
  for (const key of keys.slice(1))
    expect(await (await call(key)).json()).toEqual([
      { name: 'Ada', salary: 1200 },
    ])
  const reset = await request(profilePath, 'PUT', {
    ...review,
    version: 3,
    tables: [
      { table: 'people', fields: { mode: 'inherit' } },
      { table: 'notes', fields: { mode: 'inherit' } },
    ],
  })
  expect(reset.status).toBe(200)
  expect(await reset.json()).toMatchObject({
    version: 4,
    configured: false,
    tables: [
      {
        table: 'notes',
        configured: false,
        profile: { mode: 'inherit' },
        effectiveColumns: ['tenant', 'note'],
      },
      {
        table: 'people',
        configured: false,
        profile: { mode: 'inherit' },
        effectiveColumns: ['tenant', 'name', 'salary'],
      },
    ],
  })
  expect(await (await request(summaryPath)).json()).toEqual({
    version: 4,
    resourceVersion: 1,
    configuredMemberIds: [],
  })
  expect(await auditCount()).toBe(2)
  for (const key of keys)
    expect(await (await call(key)).json()).toEqual([
      { name: 'Ada', salary: 1200 },
    ])
  expect(await (await request(artifactPath)).json()).toEqual(artifact)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).contract,
  ).toEqual(flow.contract)
  const inventory = await (await request('/api/runtime-keys')).json()
  for (const key of keys)
    expect(
      inventory.find((current: { id: string }) => current.id === key.id),
    ).toMatchObject({
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt,
      issuerBinding: key.issuerBinding,
      replacesKeyId: null,
      replacedByKeyId: null,
      revokedAt: null,
    })
})

test('deleting the original issuer removes retained source and SQLite profiles without granting inherited access to its existing or owner-rotated credentials', async () => {
  const request = workspace()
  const csv = new FormData()
  csv.set('name', 'Deleted issuer source')
  csv.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const importedSource = await request('/api/data-sources/import', 'POST', csv)
  expect(importedSource.status).toBe(200)
  const source = await importedSource.json()
  const database = new Database(':memory:')
  database.run('CREATE TABLE people (tenant TEXT, name TEXT, salary INTEGER)')
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Ada', 1200)
  database.query('INSERT INTO people VALUES (?, ?, ?)').run('B', 'Grace', 2400)
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const sqlite = new FormData()
  sqlite.set('name', 'Deleted issuer copy')
  sqlite.set('file', new File([bytes], 'people.sqlite'))
  const importedCopy = await request(
    '/api/database-connections',
    'POST',
    sqlite,
  )
  expect(importedCopy.status).toBe(200)
  const copy = await importedCopy.json()
  const resources = [
    {
      base: `/api/data-sources/${source.id}`,
      path: '/deleted-issuer-source',
      generation: {},
      protection: { column: 'tenant' },
    },
    {
      base: `/api/database-connections/${copy.id}`,
      path: '/deleted-issuer-copy',
      generation: { version: 1, table: 'people' },
      protection: { tables: [{ table: 'people', column: 'tenant' }] },
    },
  ]
  const flows: { id: string; contract: unknown }[] = []
  for (const resource of resources) {
    const generated = await request(`${resource.base}/api`, 'POST', {
      ...resource.generation,
      name: resource.path,
      path: resource.path,
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    })
    expect(generated.status).toBe(200)
    flows.push(await generated.json())
  }
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Shared company',
      value: 'A',
    })
  ).json()
  for (const resource of resources)
    expect(
      (
        await request(`${resource.base}/row-policy`, 'PUT', {
          ...resource.protection,
          mode: 'tenant',
          version: 1,
          resourceVersion: 1,
        })
      ).status,
    ).toBe(200)
  for (const flow of flows)
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
  const artifacts = await Promise.all(
    flows.map(async (flow) =>
      (await request(`/api/flows/${flow.id}/backend-code?revision=1`)).json(),
    ),
  )
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Deletion linked callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const members: { id: string; token: string }[] = []
  for (const name of ['Deleted original A', 'Surviving same-tenant B']) {
    const created = await request('/api/members', 'POST', {
      name,
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: flows.map((flow) => flow.id),
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [copy.id],
          authConnections: [],
        },
      },
    })
    expect(created.status).toBe(200)
    members.push(await created.json())
  }
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  const callers: {
    original: RuntimeKey & { token: string }
    successor: RuntimeKey & { token: string }
    surviving: (RuntimeKey & { token: string })[]
  }[] = []
  for (const flow of flows) {
    const issued: (RuntimeKey & { token: string })[] = []
    for (const token of [members[0].token, members[1].token, owner]) {
      const receipt = await request(
        '/api/runtime-keys',
        'POST',
        {
          name: 'Deletion existing caller',
          flowId: flow.id,
          permissions: ['rest'],
          releaseRevision: 1,
          expiresAt,
          ...(token === owner ? { tenantId: tenant.id } : {}),
        },
        token,
      )
      expect(receipt.status).toBe(200)
      issued.push(await receipt.json())
    }
    const rotated = await request(
      `/api/runtime-keys/${issued[0].id}/rotate`,
      'POST',
      { graceSeconds: 30 },
    )
    expect(rotated.status).toBe(200)
    const successor = await rotated.json()
    expect(successor).toMatchObject({
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt,
      issuerBinding: {
        memberId: members[0].id,
        action: 'runtime-keys.manage',
      },
    })
    callers.push({ original: issued[0], successor, surviving: issued.slice(1) })
  }
  const review = {
    version: 2,
    resourceVersion: 1,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: role.id,
    roleVersion: 1,
  }
  for (let index = 0; index < resources.length; index++) {
    const base = resources[index].base
    const saved = await request(
      `${base}/member-fields/${members[0].id}`,
      'PUT',
      {
        ...review,
        ...(index === 0
          ? { fields: { mode: 'selected', columns: ['name', 'salary'] } }
          : {
              tables: [
                {
                  table: 'people',
                  fields: { mode: 'selected', columns: ['name', 'salary'] },
                },
              ],
            }),
      },
    )
    expect(saved.status).toBe(200)
    expect(await (await request(`${base}/member-fields`)).json()).toEqual({
      version: 3,
      resourceVersion: 1,
      configuredMemberIds: [members[0].id],
    })
    const keys = callers[index]
    for (const key of [keys.original, keys.successor, ...keys.surviving])
      expect(
        await (
          await request(
            `/run${resources[index].path}`,
            'GET',
            undefined,
            key.token,
          )
        ).json(),
      ).toEqual([{ name: 'Ada', salary: 1200 }])
  }
  const inventoryBefore = await (await request('/api/runtime-keys')).json()
  expect(
    (await request(`/api/members/${members[0].id}`, 'DELETE')).status,
  ).toBe(200)
  const inventoryAfter = await (await request('/api/runtime-keys')).json()
  for (let index = 0; index < resources.length; index++) {
    const resource = resources[index]
    expect(
      (await request(`${resource.base}/member-fields/${members[0].id}`)).status,
    ).toBe(404)
    expect(
      await (await request(`${resource.base}/member-fields`)).json(),
    ).toEqual({
      version: 3,
      resourceVersion: 1,
      configuredMemberIds: [],
    })
    const keys = callers[index]
    for (const key of [keys.original, keys.successor]) {
      expect(
        (await request(`/run${resource.path}`, 'GET', undefined, key.token))
          .status,
      ).toBe(403)
      const before = inventoryBefore.find(
        (entry: { id: string }) => entry.id === key.id,
      )
      expect(
        inventoryAfter.find((entry: { id: string }) => entry.id === key.id),
      ).toEqual({ ...before, cleanupOnly: true })
    }
    for (const key of keys.surviving) {
      expect(
        await (
          await request(`/run${resource.path}`, 'GET', undefined, key.token)
        ).json(),
      ).toEqual([{ name: 'Ada', salary: 1200 }])
      expect(
        inventoryAfter.find((entry: { id: string }) => entry.id === key.id),
      ).toEqual(
        inventoryBefore.find((entry: { id: string }) => entry.id === key.id),
      )
    }
    const flow = flows[index]
    expect(
      await (
        await request(`/api/flows/${flow.id}/backend-code?revision=1`)
      ).json(),
    ).toEqual(artifacts[index])
    expect(
      (await (await request(`/api/flows/${flow.id}`)).json()).contract,
    ).toEqual(flow.contract)
  }
})

test('a source member ceiling denies a static GraphQL business filter even when its optional argument and private field are omitted', async () => {
  const request = workspace()
  const upload = new FormData()
  upload.set('name', 'Member filtered names')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const generated = await request(
    `/api/data-sources/${source.id}/api`,
    'POST',
    {
      name: 'Member filtered names',
      path: '/member-filtered-names',
      protocol: 'graphql',
      columns: ['name'],
      filter: { column: 'salary', inputName: 'salary' },
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  expect(flow.graphql.schema).toBe(
    'type Query { rows(salary: Float): [SpreadsheetRow!]! }\ntype SpreadsheetRow { name: String! }',
  )
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Shared company',
      value: 'A',
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
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifactPath = `/api/flows/${flow.id}/backend-code?revision=1`
  const artifact = await (await request(artifactPath)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Filtered linked callers',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const members: { id: string; token: string }[] = []
  const keys: (RuntimeKey & { token: string })[] = []
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
  for (const name of ['Filtered original A', 'Filtered same-tenant B']) {
    const created = await request('/api/members', 'POST', {
      name,
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
    expect(created.status).toBe(200)
    const member: { id: string; token: string } = await created.json()
    members.push(member)
    const issued = await request(
      '/api/runtime-keys',
      'POST',
      {
        name,
        flowId: flow.id,
        releaseRevision: 1,
        permissions: ['query'],
        expiresAt,
      },
      member.token,
    )
    expect(issued.status).toBe(200)
    keys.push(await issued.json())
  }
  const call = (key: RuntimeKey & { token: string }, query: string) =>
    request('/graphql/member-filtered-names', 'POST', { query }, key.token)
  const explicitQuery = '{ rows(salary: 1200) { name } }'
  const omittedQuery = '{ rows { name } }'
  for (const key of keys)
    expect(await (await call(key, explicitQuery)).json()).toEqual({
      data: { rows: [{ name: 'Ada' }] },
    })
  const inventoryBefore = await (await request('/api/runtime-keys')).json()
  const selected = await request(
    `/api/data-sources/${source.id}/member-fields/${members[0].id}`,
    'PUT',
    {
      version: 2,
      resourceVersion: 1,
      memberAccessVersion: 1,
      tenantAssignmentVersion: 1,
      tenantVersion: 1,
      roleId: role.id,
      roleVersion: 1,
      fields: { mode: 'selected', columns: ['name'] },
    },
  )
  expect(selected.status).toBe(200)
  expect(await selected.json()).toMatchObject({
    version: 3,
    profile: { mode: 'selected', columns: ['name'] },
    effectiveColumns: ['name'],
  })
  const executions = async () => {
    const audit = await (await request('/api/audit')).json()
    return audit.filter(
      (entry: { actor: string; action: string; resource: string }) =>
        entry.actor === `runtime:${keys[0].id}` &&
        entry.action === 'graphql.executed' &&
        entry.resource === flow.id,
    )
  }
  const beforeDenied = await executions()
  expect(beforeDenied).toHaveLength(1)
  const denied = await call(keys[0], omittedQuery)
  expect(denied.status).toBe(403)
  expect(await denied.json()).toEqual({
    errors: [
      { message: 'Member field profile does not authorize this API read' },
    ],
  })
  expect(await executions()).toEqual(beforeDenied)
  const explicitB = await call(keys[1], explicitQuery)
  expect(explicitB.status).toBe(200)
  expect(await explicitB.json()).toEqual({ data: { rows: [{ name: 'Ada' }] } })
  const omittedB = await call(keys[1], omittedQuery)
  expect(omittedB.status).toBe(200)
  expect(await omittedB.json()).toEqual({ data: { rows: [{ name: 'Ada' }] } })
  expect(await (await request(artifactPath)).json()).toEqual(artifact)
  const current = await (await request(`/api/flows/${flow.id}`)).json()
  expect(current.graphql).toEqual(flow.graphql)
  expect(current.nodes).toEqual(flow.nodes)
  const inventoryAfter = await (await request('/api/runtime-keys')).json()
  for (let index = 0; index < keys.length; index++) {
    const before = inventoryBefore.find(
      (entry: { id: string }) => entry.id === keys[index].id,
    )
    expect(
      inventoryAfter.find(
        (entry: { id: string }) => entry.id === keys[index].id,
      ),
    ).toEqual(index === 0 ? { ...before, cleanupOnly: true } : before)
  }
})
