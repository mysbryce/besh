import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'

const owner = 'row-database-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-row-database-'))
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(async () => {
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  return async (path: string, method = 'GET', body?: unknown, token = owner) =>
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

function copy(
  name: string,
  sql = "CREATE TABLE people (tenant TEXT, name TEXT); INSERT INTO people VALUES ('A', 'Ada'), ('B', 'Grace');",
) {
  const db = new Database(':memory:')
  let bytes: Uint8Array
  try {
    db.run(sql)
    bytes = new Uint8Array(db.serialize())
  } finally {
    db.close()
  }
  const form = new FormData()
  form.set('name', name)
  form.set('file', new File([new Uint8Array(bytes)], 'people.sqlite'))
  return form
}

test('activating protection during a real raw SQLite read withholds rows and check metadata', async () => {
  const request = workspace()
  const connection = await (
    await request(
      '/api/database-connections',
      'POST',
      copy(
        'Pending raw reads',
        "CREATE TABLE people (tenant TEXT, name TEXT CHECK(length(printf('%100000s', '')) = 100000)); WITH RECURSIVE ids(value) AS (SELECT 0 UNION ALL SELECT value + 1 FROM ids WHERE value < 4999) INSERT INTO people SELECT CASE WHEN value < 2500 THEN 'B' ELSE 'A' END, 'Private raw row ' || printf('%0200d', value) FROM ids;",
      ),
    )
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Pending raw manager',
      permissions: ['database-connections.read', 'database-connections.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Pending raw manager',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  let policyVersion = 1
  for (const operation of ['preview', 'check']) {
    let settled = false
    const pending = request(
      `/api/database-connections/${connection.id}/${operation}`,
      'POST',
      operation === 'preview'
        ? { version: 1, table: 'people', columns: ['name'], limit: 1 }
        : { version: 1 },
      member.token,
    ).then((response) => {
      settled = true
      return response
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)
    expect(
      (
        await request(
          `/api/database-connections/${connection.id}/row-policy`,
          'PUT',
          {
            mode: 'tenant',
            tables: [{ table: 'people', column: 'tenant' }],
            version: policyVersion++,
            resourceVersion: 1,
          },
        )
      ).status,
    ).toBe(200)
    const response = await pending
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'Database connection not found',
    })
    expect(
      (
        await request(
          `/api/database-connections/${connection.id}/row-policy`,
          'PUT',
          { mode: 'unprotected', version: policyVersion++, resourceVersion: 1 },
        )
      ).status,
    ).toBe(200)
  }
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some(
      (event: { actor: string; action: string }) =>
        event.actor === member.id &&
        event.action === 'database-connection.checked',
    ),
  ).toBe(false)
}, 20_000)

test('database tenant activation requires a complete inspected text mapping and preserves current policy on rejected reviews', async () => {
  const request = workspace()
  const connection = await (
    await request(
      '/api/database-connections',
      'POST',
      copy(
        'Two protected tables',
        "CREATE TABLE customers (tenant TEXT, name TEXT); CREATE TABLE invoices (tenant TEXT, amount INTEGER); INSERT INTO customers VALUES ('A', 'Ada'), ('B', 'Bree'); INSERT INTO invoices VALUES ('A', 12), ('B', 99);",
      ),
    )
  ).json()
  const initial = await (
    await request(`/api/database-connections/${connection.id}/row-policy`)
  ).json()
  expect(initial).toEqual({
    mode: 'unprotected',
    version: 1,
    resourceVersion: 1,
    tables: [
      {
        table: 'customers',
        column: null,
        textColumns: ['tenant', 'name'],
        fields: { mode: 'all', columns: [] },
      },
      {
        table: 'invoices',
        column: null,
        textColumns: ['tenant'],
        fields: { mode: 'all', columns: [] },
      },
    ],
  })
  const path = `/api/database-connections/${connection.id}/row-policy`
  for (const tables of [
    [{ table: 'customers', column: 'tenant' }],
    [
      { table: 'customers', column: 'tenant' },
      { table: 'customers', column: 'name' },
    ],
    [
      { table: 'customers', column: 'tenant' },
      { table: 'invoices', column: 'amount' },
    ],
    [
      { table: 'customers', column: 'tenant' },
      { table: 'invented', column: 'tenant' },
    ],
  ]) {
    expect(
      (
        await request(path, 'PUT', {
          mode: 'tenant',
          version: 1,
          resourceVersion: 1,
          tables,
        })
      ).status,
    ).toBe(400)
    expect(await (await request(path)).json()).toEqual(initial)
  }
  const tables = [
    { table: 'customers', column: 'tenant' },
    { table: 'invoices', column: 'tenant' },
  ]
  expect(
    (
      await request(path, 'PUT', {
        mode: 'tenant',
        version: 1,
        resourceVersion: 2,
        tables,
      })
    ).status,
  ).toBe(409)
  expect(await (await request(path)).json()).toEqual(initial)
  const activated = await request(path, 'PUT', {
    mode: 'tenant',
    version: 1,
    resourceVersion: 1,
    tables,
  })
  expect(activated.status).toBe(200)
  const policy = await activated.json()
  expect(policy).toEqual({
    ...initial,
    mode: 'tenant',
    version: 2,
    tables: initial.tables.map((table: { table: string }) => ({
      ...table,
      column: 'tenant',
    })),
  })
  expect(
    (
      await request(path, 'PUT', {
        mode: 'unprotected',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(409)
  expect(await (await request(path)).json()).toEqual(policy)
  const audits = await (await request('/api/audit')).json()
  expect(
    audits.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'database-connection.row-policy.updated' &&
        event.resource === connection.id,
    ),
  ).toHaveLength(1)
  expect(
    (await (await request('/api/tenant-context')).json()).backupsOwnerOnly,
  ).toBe(true)
})

test('all-mode database grants omit protected raw copies while keeping structural choices and unprotected reads', async () => {
  const request = workspace()
  const protectedResponse = await request(
    '/api/database-connections',
    'POST',
    copy('Private original'),
  )
  expect(protectedResponse.status).toBe(200)
  const protectedCopy = await protectedResponse.json()
  const visibleResponse = await request(
    '/api/database-connections',
    'POST',
    copy('Shared original'),
  )
  expect(visibleResponse.status).toBe(200)
  const visibleCopy = await visibleResponse.json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Global copy reader',
      permissions: ['database-connections.read', 'database-connections.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Global copy reader',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  expect(
    (
      await request(
        `/api/database-connections/${protectedCopy.id}/row-policy`,
        'PUT',
        {
          mode: 'tenant',
          tables: [{ table: 'people', column: 'tenant' }],
          version: 1,
          resourceVersion: 1,
        },
      )
    ).status,
  ).toBe(200)

  const list = await request(
    '/api/database-connections',
    'GET',
    undefined,
    member.token,
  )
  expect(list.status).toBe(200)
  expect((await list.json()).map((entry: { id: string }) => entry.id)).toEqual([
    visibleCopy.id,
  ])
  expect(
    (
      await request(
        `/api/database-connections/${protectedCopy.id}`,
        'GET',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/database-connections/${protectedCopy.id}/preview`,
        'POST',
        { invalid: true },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/database-connections/${protectedCopy.id}/check`,
        'POST',
        { invalid: true },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/database-connections/${protectedCopy.id}`,
        'DELETE',
        { invalid: true },
        member.token,
      )
    ).status,
  ).toBe(404)
  for (const id of [protectedCopy.id, 'missing-copy']) {
    for (const [method, suffix] of [
      ['POST', '/preview'],
      ['POST', '/check'],
      ['DELETE', ''],
    ]) {
      const denial = await request(
        `/api/database-connections/${id}${suffix}`,
        method,
        { invalid: true },
        member.token,
      )
      expect(denial.status).toBe(404)
      expect(await denial.json()).toEqual({
        error: 'Database connection not found',
      })
    }
  }
  const catalog = await (
    await request(
      '/api/dependencies/database-connections',
      'GET',
      undefined,
      member.token,
    )
  ).json()
  expect(catalog.map((entry: { id: string }) => entry.id).sort()).toEqual(
    [protectedCopy.id, visibleCopy.id].sort(),
  )
  for (const entry of catalog) {
    expect(Object.keys(entry).sort()).toEqual([
      'id',
      'name',
      'tables',
      'version',
    ])
    expect(Object.keys(entry.tables[0]).sort()).toEqual(['columns', 'name'])
  }
  const preview = await request(
    `/api/database-connections/${visibleCopy.id}/preview`,
    'POST',
    { version: 1, table: 'people', columns: ['name'], limit: 1 },
    member.token,
  )
  expect(preview.status).toBe(200)
  expect((await preview.json()).rows).toEqual([{ name: 'Ada' }])
})

test('quoted SQLite columns keep RTRIM spaces and Unicode identities exact before filters limits and GraphQL projection', async () => {
  const request = workspace()
  const db = new Database(':memory:')
  let bytes: Uint8Array
  try {
    db.run(
      'CREATE TABLE "tenant rows""safe" ("tenant id""safe" TEXT COLLATE RTRIM, name TEXT, city TEXT)',
    )
    const insert = db.query('INSERT INTO "tenant rows""safe" VALUES (?, ?, ?)')
    for (let index = 0; index < 100; index++)
      insert.run('A', 'Foreign ' + index, 'Paris')
    insert.run('A ', 'Ada', 'London')
    insert.run('A  ', 'Extra space', 'London')
    insert.run(null, 'Null identity', 'London')
    insert.run('', 'Empty identity', 'London')
    insert.run("A' OR 1=1 --", 'Safe quote', 'London')
    insert.run('é', 'Composed', 'London')
    insert.run('e\u0301', 'Decomposed', 'London')
    bytes = new Uint8Array(db.serialize())
  } finally {
    db.close()
  }
  const form = new FormData()
  form.set('name', 'Exact SQLite tenant text')
  form.set('file', new File([new Uint8Array(bytes)], 'tenants.sqlite'))
  const uploaded = await request('/api/database-connections', 'POST', form)
  expect(uploaded.status).toBe(200)
  const connection = await uploaded.json()
  const options = {
    version: 1,
    table: 'tenant rows"safe',
    name: 'Exact names',
    columns: ['name'],
    filter: { column: 'city', inputName: 'city' },
    limit: 1,
  }
  const restResponse = await request(
    `/api/database-connections/${connection.id}/api`,
    'POST',
    { ...options, path: '/exact-sqlite', protocol: 'rest' },
  )
  expect(restResponse.status).toBe(200)
  const rest = await restResponse.json()
  const graphqlResponse = await request(
    `/api/database-connections/${connection.id}/api`,
    'POST',
    { ...options, path: '/exact-sqlite-query', protocol: 'graphql' },
  )
  expect(graphqlResponse.status).toBe(200)
  const graphql = await graphqlResponse.json()
  expect(
    (
      await request(
        `/api/database-connections/${connection.id}/row-policy`,
        'PUT',
        {
          mode: 'tenant',
          tables: [{ table: 'tenant rows"safe', column: 'tenant_id_safe' }],
          version: 1,
          resourceVersion: 1,
        },
      )
    ).status,
  ).toBe(200)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Exact row tester',
      permissions: ['flows.test'],
    })
  ).json()
  for (const [value, expectedName] of [
    ['A ', 'Ada'],
    ["A' OR 1=1 --", 'Safe quote'],
    ['é', 'Composed'],
    ['e\u0301', 'Decomposed'],
  ]) {
    const tenant = await (
      await request('/api/tenants', 'POST', { label: expectedName, value })
    ).json()
    const member = await (
      await request('/api/members', 'POST', {
        name: expectedName,
        role: 'custom',
        roleId: role.id,
        tenantId: tenant.id,
      })
    ).json()
    const tested = await request(
      `/api/flows/${rest.id}/test`,
      'POST',
      { body: { tenant: 'A', tenantId: 'forged' }, query: {} },
      member.token,
    )
    expect(tested.status).toBe(200)
    expect((await tested.json()).body).toEqual([{ name: expectedName }])
    const queried = await request(
      `/api/flows/${graphql.id}/graphql/test`,
      'POST',
      {
        query: '{ rows { name } }',
        variables: { tenantId: 'forged', tenant: 'A' },
      },
      member.token,
    )
    expect(queried.status).toBe(200)
    expect((await queried.json()).body).toEqual({
      data: { rows: [{ name: expectedName }] },
    })
  }
  const spaceTenant = (await (await request('/api/tenants')).json()).find(
    (tenant: { value: string }) => tenant.value === 'A ',
  )
  const filtered = await request(`/api/flows/${rest.id}/test`, 'POST', {
    body: null,
    query: { city: 'Paris' },
    tenantId: spaceTenant.id,
  })
  expect(filtered.status).toBe(200)
  expect((await filtered.json()).body).toEqual([])
})
