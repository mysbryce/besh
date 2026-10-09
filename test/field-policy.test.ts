import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { Database } from 'bun:sqlite'

const owner = 'field-policy-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-field-policy-'))
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
  return {
    request,
    listen() {
      server.app.listen({ hostname: '127.0.0.1', port: 0 })
    },
    async reopen() {
      await server.close()
      server = createApp(options)
    },
  }
}

async function source(request: ReturnType<typeof workspace>['request']) {
  const upload = new FormData()
  upload.set('name', 'Private salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const response = await request('/api/data-sources/import', 'POST', upload)
  expect(response.status).toBe(200)
  return response.json()
}

test('new source row policies default to all API fields and retain metadata after restart', async () => {
  const { request, reopen } = workspace()
  const imported = await source(request)
  const path = `/api/data-sources/${imported.id}/row-policy`
  const response = await request(path)
  expect(response.status).toBe(200)
  expect((await response.json()).fields).toEqual({ mode: 'all', columns: [] })
  await reopen()
  expect((await (await request(path)).json()).fields).toEqual({
    mode: 'all',
    columns: [],
  })
})

test('owner field selections share row policy versions, survive omitted fields and remain dormant when unprotected', async () => {
  const { request, reopen } = workspace()
  const imported = await source(request)
  const path = `/api/data-sources/${imported.id}/row-policy`
  const changed = await request(path, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 1,
    resourceVersion: 1,
    fields: { mode: 'selected', columns: ['name'] },
  })
  expect(changed.status).toBe(200)
  expect(await changed.json()).toMatchObject({
    version: 2,
    fields: { mode: 'selected', columns: ['name'] },
  })
  const preserved = await request(path, 'PUT', {
    mode: 'tenant',
    column: 'tenant',
    version: 2,
    resourceVersion: 1,
  })
  expect(preserved.status).toBe(200)
  expect((await preserved.json()).fields).toEqual({
    mode: 'selected',
    columns: ['name'],
  })
  expect(
    (
      await request(path, 'PUT', {
        mode: 'unprotected',
        version: 3,
        resourceVersion: 1,
        fields: { mode: 'all', columns: [] },
      })
    ).status,
  ).toBe(400)
  const dormant = await request(path, 'PUT', {
    mode: 'unprotected',
    version: 3,
    resourceVersion: 1,
  })
  expect(dormant.status).toBe(200)
  expect(await dormant.json()).toMatchObject({
    mode: 'unprotected',
    version: 4,
    fields: { mode: 'selected', columns: ['name'] },
  })
  await reopen()
  expect((await (await request(path)).json()).fields).toEqual({
    mode: 'selected',
    columns: ['name'],
  })
})

test('a live owner field restriction denies an already pinned release before exposing private columns', async () => {
  const { request } = workspace()
  const imported = await source(request)
  const flow = await (
    await request(`/api/data-sources/${imported.id}/api`, 'POST', {
      name: 'Salaries',
      path: '/salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const policyPath = `/api/data-sources/${imported.id}/row-policy`
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
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Reviewed A salaries',
    flowId: flow.id,
    permissions: ['rest'],
    releaseRevision: 1,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const before = await request('/run/salaries', 'GET', undefined, key.token)
  expect(before.status).toBe(200)
  expect(await before.json()).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(
    (
      await request(policyPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  const auditBefore = await (await request('/api/audit')).json()
  const denied = await request('/run/salaries', 'GET', undefined, key.token)
  expect(denied.status).toBe(403)
  expect(await denied.text()).not.toContain('1200')
  const auditAfter = await (await request('/api/audit')).json()
  expect(
    auditAfter.filter(
      (event: { action: string }) => event.action === 'flow.executed',
    ).length,
  ).toBe(
    auditBefore.filter(
      (event: { action: string }) => event.action === 'flow.executed',
    ).length,
  )
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
  ).toBe(1)
})

test('uploaded SQLite tables expose independent default API field policies after restart', async () => {
  const { request, reopen } = workspace()
  const sqlite = new Database(':memory:')
  sqlite.run(
    "CREATE TABLE people(tenant TEXT, name TEXT, salary INTEGER); INSERT INTO people VALUES ('A', 'Ada', 1200); CREATE TABLE empty_rows(tenant TEXT, note TEXT)",
  )
  const bytes = new Uint8Array(sqlite.serialize())
  sqlite.close()
  const upload = new FormData()
  upload.set('name', 'Copied salaries')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const path = `/api/database-connections/${copy.id}/row-policy`
  const policy = await request(path)
  expect(policy.status).toBe(200)
  expect(
    (await policy.json()).tables.map(
      (table: { table: string; fields: unknown }) => ({
        table: table.table,
        fields: table.fields,
      }),
    ),
  ).toEqual([
    { table: 'empty_rows', fields: { mode: 'all', columns: [] } },
    { table: 'people', fields: { mode: 'all', columns: [] } },
  ])
  await reopen()
  expect(
    (await (await request(path)).json()).tables.every(
      (table: { fields: { mode: string } }) => table.fields.mode === 'all',
    ),
  ).toBe(true)
})

test('SQLite owner selections persist independently per table and omitted fields never widen them', async () => {
  const { request, reopen } = workspace()
  const sqlite = new Database(':memory:')
  sqlite.run(
    "CREATE TABLE people(tenant TEXT, name TEXT, salary INTEGER); INSERT INTO people VALUES ('A', 'Ada', 1200); CREATE TABLE empty_rows(tenant TEXT, note TEXT)",
  )
  const bytes = new Uint8Array(sqlite.serialize())
  sqlite.close()
  const upload = new FormData()
  upload.set('name', 'Copied salaries')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const path = `/api/database-connections/${copy.id}/row-policy`
  const tables = [
    {
      table: 'empty_rows',
      column: 'tenant',
      fields: { mode: 'selected', columns: [] },
    },
    {
      table: 'people',
      column: 'tenant',
      fields: { mode: 'selected', columns: ['name'] },
    },
  ]
  const changed = await request(path, 'PUT', {
    mode: 'tenant',
    tables,
    version: 1,
    resourceVersion: 1,
  })
  expect(changed.status).toBe(200)
  expect(
    (await changed.json()).tables.map(
      (table: { fields: unknown }) => table.fields,
    ),
  ).toEqual([
    { mode: 'selected', columns: [] },
    { mode: 'selected', columns: ['name'] },
  ])
  const preserved = await request(path, 'PUT', {
    mode: 'tenant',
    tables: tables.map(({ table, column }) => ({ table, column })),
    version: 2,
    resourceVersion: 1,
  })
  expect(preserved.status).toBe(200)
  await reopen()
  expect(
    (await (await request(path)).json()).tables.map(
      (table: { fields: unknown }) => table.fields,
    ),
  ).toEqual([
    { mode: 'selected', columns: [] },
    { mode: 'selected', columns: ['name'] },
  ])
})

test('a quoted SQLite table applies current field restrictions to a pinned release without changing its rows or publication', async () => {
  const { request } = workspace()
  const sqlite = new Database(':memory:')
  sqlite.run(
    'CREATE TABLE "pay""roll"(tenant TEXT COLLATE NOCASE, name TEXT, salary INTEGER); INSERT INTO "pay""roll" VALUES (\'A\', \'Ada\', 1200), (\'a\', \'Other\', 3000)',
  )
  const bytes = new Uint8Array(sqlite.serialize())
  sqlite.close()
  const upload = new FormData()
  upload.set('name', 'Quoted salaries')
  upload.set('file', new File([bytes], 'people.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const generated = await request(
    `/api/database-connections/${copy.id}/api`,
    'POST',
    {
      version: 1,
      table: 'pay"roll',
      name: 'Quoted salaries',
      path: '/sql-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const policyPath = `/api/database-connections/${copy.id}/row-policy`
  expect(
    (
      await request(policyPath, 'PUT', {
        mode: 'tenant',
        tables: [{ table: 'pay"roll', column: 'tenant' }],
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Reviewed SQL salaries',
    flowId: flow.id,
    permissions: ['rest'],
    releaseRevision: 1,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const baseline = await request(
    '/run/sql-salaries',
    'GET',
    undefined,
    key.token,
  )
  expect(baseline.status).toBe(200)
  expect(await baseline.json()).toEqual([{ name: 'Ada', salary: 1200 }])
  expect(
    (
      await request(policyPath, 'PUT', {
        mode: 'tenant',
        tables: [
          {
            table: 'pay"roll',
            column: 'tenant',
            fields: { mode: 'selected', columns: ['name'] },
          },
        ],
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  const denied = await request('/run/sql-salaries', 'GET', undefined, key.token)
  expect(denied.status).toBe(403)
  expect(await denied.text()).not.toContain('1200')
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
  ).toBe(1)
})

test('source replacement cannot orphan active or dormant selected fields and new columns are never implicitly shared', async () => {
  const { request } = workspace()
  const imported = await source(request)
  const path = `/api/data-sources/${imported.id}/row-policy`
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: ['salary'] },
      })
    ).status,
  ).toBe(200)
  const replacement = (text: string) => {
    const upload = new FormData()
    upload.set('name', 'Private salaries')
    upload.set('file', new File([text], 'people.csv'))
    return request(`/api/data-sources/${imported.id}/import`, 'PUT', upload)
  }
  expect((await replacement('tenant,name\nA,Ada\n')).status).toBe(409)
  expect((await (await request(path)).json()).resourceVersion).toBe(1)
  expect(
    (
      await request(path, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect((await replacement('tenant,name\nA,Ada\n')).status).toBe(409)
  const added = await replacement(
    'tenant,name,salary,new_secret\nA,Ada,1300,never-shared\n',
  )
  expect(added.status).toBe(200)
  expect(await (await request(path)).json()).toMatchObject({
    mode: 'unprotected',
    version: 3,
    resourceVersion: 2,
    fields: { mode: 'selected', columns: ['salary'] },
  })
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 3,
        resourceVersion: 2,
      })
    ).status,
  ).toBe(200)
  const generated = await request(
    `/api/data-sources/${imported.id}/api`,
    'POST',
    {
      name: 'New column',
      path: '/new-secret',
      protocol: 'rest',
      columns: ['new_secret'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(403)
})

test('field restrictions deny static business filters even when absent from input, while the private tenant predicate remains usable', async () => {
  const { request } = workspace()
  const imported = await source(request)
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
        limit: 1,
        ...(filter ? { filter } : {}),
      },
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const allowed = await create('/allowed-name')
  const salaryFilter = await create('/private-salary-filter', {
    column: 'salary',
    inputName: 'salary',
  })
  const tenantFilter = await create('/private-tenant-filter', {
    column: 'tenant',
    inputName: 'tenant',
  })
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/data-sources/${imported.id}/row-policy`
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  const input = { body: null, query: {}, tenantId: tenant.id }
  const names = await request(`/api/flows/${allowed.id}/test`, 'POST', input)
  expect(names.status).toBe(200)
  expect((await names.json()).body).toEqual([{ name: 'Ada' }])
  for (const denied of [salaryFilter, tenantFilter]) {
    const result = await request(`/api/flows/${denied.id}/test`, 'POST', input)
    expect(result.status).toBe(403)
    expect(await result.text()).not.toContain('1200')
    expect(
      (
        await request(`/api/flows/${denied.id}/publish`, 'POST', {
          revision: 1,
        })
      ).status,
    ).toBe(403)
  }
  expect(
    (await request(`/api/flows/${allowed.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Allowed names',
    flowId: allowed.id,
    permissions: ['rest'],
    releaseRevision: 1,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: [] },
      })
    ).status,
  ).toBe(200)
  expect(
    (await request('/run/allowed-name', 'GET', undefined, key.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/flows/${allowed.id}/test`, 'POST', input)).status,
  ).toBe(403)
  const raw = await request(`/api/data-sources/${imported.id}`)
  expect(raw.status).toBe(200)
  expect((await raw.json()).rows).toEqual([
    { tenant: 'A', name: 'Ada', salary: 1200 },
    { tenant: 'B', name: 'Grace', salary: 2400 },
  ])
})

test('owner load targets omit field-denied releases while their historical jobs remain cleanup-only and cancellable', async () => {
  const { request, listen } = workspace({
    k6Runner: async (_input, signal) =>
      new Promise((resolve) => {
        signal.addEventListener(
          'abort',
          () =>
            resolve({
              requests: 0,
              requestsPerSecond: 0,
              failedRequests: 0,
              checkRate: 0,
              avgMs: 0,
              p95Ms: 0,
              maxMs: 0,
              thresholdsPassed: false,
            }),
          { once: true },
        )
      }),
  })
  const imported = await source(request)
  const flow = await (
    await request(`/api/data-sources/${imported.id}/api`, 'POST', {
      name: 'Job names',
      path: '/job-names',
      protocol: 'rest',
      columns: ['name'],
      limit: 1,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/data-sources/${imported.id}/row-policy`
  expect(
    (
      await request(path, 'PUT', {
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
  listen()
  const started = await request('/api/load-tests', 'POST', {
    flowId: flow.id,
    tenantId: tenant.id,
  })
  expect(started.status).toBe(202)
  const job = await started.json()
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: [] },
      })
    ).status,
  ).toBe(200)
  const targets = await request('/api/load-tests/targets')
  expect(targets.status).toBe(200)
  expect(await targets.json()).toEqual([])
  const history = await request(`/api/load-tests/${job.id}`)
  expect(history.status).toBe(200)
  expect(await history.json()).toMatchObject({ id: job.id, cleanupOnly: true })
  expect(
    (await request(`/api/load-tests/${job.id}/cancel`, 'POST', {})).status,
  ).toBe(200)
  expect(
    (
      await request('/api/load-tests', 'POST', {
        flowId: flow.id,
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(403)
})

test('GraphQL field changes block old keys, replacement and rollback until the saved graph is explicitly reviewed', async () => {
  const { request } = workspace()
  const imported = await source(request)
  const generated = await request(
    `/api/data-sources/${imported.id}/api`,
    'POST',
    {
      name: 'GraphQL salaries',
      path: '/gql-salaries',
      protocol: 'graphql',
      columns: ['name', 'salary'],
      limit: 10,
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const path = `/api/data-sources/${imported.id}/row-policy`
  expect(
    (
      await request(path, 'PUT', {
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
  const keyInput = {
    name: 'Reviewed query',
    flowId: flow.id,
    permissions: ['query'],
    releaseRevision: 1,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  }
  const issued = await request('/api/runtime-keys', 'POST', keyInput)
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const query = { query: '{ rows { name salary } }' }
  const before = await request(
    '/graphql/gql-salaries',
    'POST',
    query,
    key.token,
  )
  expect(before.status).toBe(200)
  expect(await before.json()).toEqual({
    data: { rows: [{ name: 'Ada', salary: 1200 }] },
  })
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
        fields: { mode: 'selected', columns: ['name'] },
      })
    ).status,
  ).toBe(200)
  expect(
    (await request('/graphql/gql-salaries', 'POST', query, key.token)).status,
  ).toBe(403)
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})).status,
  ).toBe(409)
  expect((await request('/api/runtime-keys', 'POST', keyInput)).status).toBe(
    403,
  )
  const metadata = await (await request('/api/runtime-keys')).json()
  expect(
    metadata.find((item: { id: string }) => item.id === key.id),
  ).toMatchObject({
    revokedAt: null,
    releaseRevision: 1,
    expiresAt: key.expiresAt,
    cleanupOnly: true,
  })
  const reviewed = {
    ...flow,
    graphql: {
      schema:
        'type Query { rows: [SpreadsheetRow!]! } type SpreadsheetRow { name: String! }',
    },
    nodes: flow.nodes.map(
      (node: { type: string; config: Record<string, unknown> }) =>
        node.type === 'data'
          ? { ...node, config: { ...node.config, columns: ['name'] } }
          : node,
    ),
  }
  expect((await request(`/api/flows/${flow.id}`, 'PUT', reviewed)).status).toBe(
    200,
  )
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const audit = await (await request('/api/audit')).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(403)
  expect(
    (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
  ).toBe(2)
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ).length,
  ).toBe(
    audit.filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ).length,
  )
  const newKey = await (
    await request('/api/runtime-keys', 'POST', {
      ...keyInput,
      releaseRevision: 2,
    })
  ).json()
  const names = await request(
    '/graphql/gql-salaries',
    'POST',
    { query: '{ rows { name } }' },
    newKey.token,
  )
  expect(names.status).toBe(200)
  expect(await names.json()).toEqual({ data: { rows: [{ name: 'Ada' }] } })
  expect((await request(`/api/runtime-keys/${key.id}`, 'DELETE')).status).toBe(
    200,
  )
})

test('multi-table field review rejects unknown columns atomically and stale row-policy versions cannot overwrite a selection', async () => {
  const { request } = workspace()
  const sqlite = new Database(':memory:')
  sqlite.run(
    "CREATE TABLE first_table(tenant TEXT, name TEXT); INSERT INTO first_table VALUES ('A', 'Ada'); CREATE TABLE second_table(tenant TEXT, note TEXT)",
  )
  const bytes = new Uint8Array(sqlite.serialize())
  sqlite.close()
  const upload = new FormData()
  upload.set('name', 'Two table review')
  upload.set('file', new File([bytes], 'review.sqlite'))
  const imported = await request('/api/database-connections', 'POST', upload)
  expect(imported.status).toBe(200)
  const copy = await imported.json()
  const path = `/api/database-connections/${copy.id}/row-policy`
  const original = await (await request(path)).json()
  const audit = await (await request('/api/audit')).json()
  const invalid = await request(path, 'PUT', {
    mode: 'tenant',
    version: 1,
    resourceVersion: 1,
    tables: [
      {
        table: 'first_table',
        column: 'tenant',
        fields: { mode: 'selected', columns: ['name'] },
      },
      {
        table: 'second_table',
        column: 'tenant',
        fields: { mode: 'selected', columns: ['missing'] },
      },
    ],
  })
  expect(invalid.status).toBe(400)
  expect(await (await request(path)).json()).toEqual(original)
  expect(await (await request('/api/audit')).json()).toEqual(audit)
  expect(
    (await (await request('/api/tenant-context')).json()).backupsOwnerOnly,
  ).toBe(false)
  const valid = {
    mode: 'tenant',
    version: 1,
    resourceVersion: 1,
    tables: [
      {
        table: 'first_table',
        column: 'tenant',
        fields: { mode: 'selected', columns: ['name'] },
      },
      {
        table: 'second_table',
        column: 'tenant',
        fields: { mode: 'selected', columns: [] },
      },
    ],
  }
  expect((await request(path, 'PUT', valid)).status).toBe(200)
  const selected = await (await request(path)).json()
  expect(
    (
      await request(path, 'PUT', {
        ...valid,
        tables: valid.tables.map((table) => ({
          ...table,
          fields: { mode: 'all', columns: [] },
        })),
      })
    ).status,
  ).toBe(409)
  expect(await (await request(path)).json()).toEqual(selected)
  for (const fields of [
    { mode: 'all', columns: ['name'] },
    { mode: 'selected', columns: ['name', 'name'] },
    { mode: 'selected', columns: ['name'], sql: 'SELECT *' },
  ]) {
    expect(
      (
        await request(path, 'PUT', {
          ...valid,
          version: 2,
          tables: [{ ...valid.tables[0], fields }, valid.tables[1]],
        })
      ).status,
    ).toBe(400)
    expect(await (await request(path)).json()).toEqual(selected)
  }
})
