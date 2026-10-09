import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'

const owner = 'database-test-owner-key-32-characters-long'
const cleanup: (() => void)[] = []
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-database-'))
  const options = {
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    authOrigin: 'http://127.0.0.1:5173',
  }
  const server = createApp(options)
  cleanup.push(() => {
    server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ) {
    return server.app.handle(
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
        signal,
      }),
    )
  }
  return { request, server, options }
}

function sqlite(
  sql = `CREATE TABLE people ("Full Name" TEXT NOT NULL, age INTEGER NOT NULL, active BOOLEAN NOT NULL, note TEXT);
  INSERT INTO people VALUES ('Ada', 36, 1, NULL), ('Grace', 85, 0, 'compiler');`,
) {
  const db = new Database(':memory:')
  try {
    db.run(sql)
    return new Uint8Array(db.serialize())
  } finally {
    db.close()
  }
}

function upload(bytes = sqlite()) {
  const form = new FormData()
  form.append('name', 'People copy')
  form.append('file', new File([bytes], 'people.sqlite'))
  return form
}

function pendingSqlite() {
  // A valid ordinary-table CHECK keeps native inspection pending independently of child startup speed.
  return sqlite(`CREATE TABLE t(a INTEGER CHECK(NOT ('${'a'.repeat(50000)}' LIKE '%${'a'.repeat(4000)}b')));
    PRAGMA ignore_check_constraints=ON; INSERT INTO t VALUES(1);`)
}

test('uploaded SQLite copy exposes inspected tables and bound projected preview', async () => {
  const { request } = workspace()
  const response = await request('/api/database-connections', 'POST', upload())
  expect(response.status).toBe(200)
  const connection = await response.json()
  expect(connection).toMatchObject({
    name: 'People copy',
    kind: 'sqlite',
    mode: 'uploaded-copy',
    version: 1,
    bytes: 8192,
    tables: [
      {
        name: 'people',
        rowCount: 2,
        columns: [
          {
            key: 'full_name',
            label: 'Full Name',
            type: 'string',
            nullable: false,
          },
          { key: 'age', label: 'age', type: 'number', nullable: false },
          { key: 'active', label: 'active', type: 'boolean', nullable: false },
          { key: 'note', label: 'note', type: 'string', nullable: true },
        ],
      },
    ],
  })
  expect(
    await (await request(`/api/database-connections/${connection.id}`)).json(),
  ).toEqual(connection)
  expect(await (await request('/api/database-connections')).json()).toEqual([
    connection,
  ])
  const preview = await request(
    `/api/database-connections/${connection.id}/preview`,
    'POST',
    {
      version: 1,
      table: 'people',
      columns: ['full_name', 'age'],
      filter: { column: 'active', value: true },
      limit: 10,
    },
  )
  expect(preview.status).toBe(200)
  expect(await preview.json()).toEqual({
    version: 1,
    table: 'people',
    columns: ['full_name', 'age'],
    rows: [{ full_name: 'Ada', age: 36 }],
  })
})

test('generated SQLite REST and GraphQL releases require scoped runtime keys and return typed selected rows', async () => {
  const { request } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload())
  ).json()
  for (const protocol of ['rest', 'graphql']) {
    const generated = await request(
      `/api/database-connections/${connection.id}/api`,
      'POST',
      {
        version: 1,
        table: 'people',
        name: `People ${protocol}`,
        path: `/people-${protocol}`,
        protocol,
        columns: ['full_name', 'active'],
        filter: { column: 'age', inputName: 'age' },
        limit: 10,
      },
    )
    expect(generated.status).toBe(200)
    const flow = await generated.json()
    expect(flow.nodes[1]).toMatchObject({
      type: 'database',
      config: { connectionId: connection.id, table: 'people' },
    })
    const input =
      protocol === 'rest'
        ? { body: null, query: { age: '85' } }
        : { query: 'query { rows(age:85) { full_name active } }' }
    const tested = await request(
      `/api/flows/${flow.id}/${protocol === 'rest' ? 'test' : 'graphql/test'}`,
      'POST',
      input,
    )
    expect(tested.status).toBe(200)
    expect(await tested.json()).toMatchObject(
      protocol === 'rest'
        ? { body: [{ full_name: 'Grace', active: false }] }
        : { body: { data: { rows: [{ full_name: 'Grace', active: false }] } } },
    )
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
    const key = await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Client',
        flowId: flow.id,
        permissions: [protocol === 'rest' ? 'rest' : 'query'],
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    ).json()
    const path =
      protocol === 'rest'
        ? `/run/people-${protocol}?age=85`
        : `/graphql/people-${protocol}`
    expect(
      (
        await request(
          path,
          protocol === 'rest' ? 'GET' : 'POST',
          protocol === 'rest' ? undefined : input,
        )
      ).status,
    ).toBe(401)
    const live = await request(
      path,
      protocol === 'rest' ? 'GET' : 'POST',
      protocol === 'rest' ? undefined : input,
      key.token,
    )
    expect(live.status).toBe(200)
    expect(await live.json()).toEqual(
      protocol === 'rest'
        ? [{ full_name: 'Grace', active: false }]
        : { data: { rows: [{ full_name: 'Grace', active: false }] } },
    )
  }
})

test('checking and deleting SQLite copies require exact versions and preserve historical release dependencies', async () => {
  const { request } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload())
  ).json()
  const checkPath = `/api/database-connections/${connection.id}/check`
  const checked = await request(checkPath, 'POST', { version: 1 })
  expect(checked.status).toBe(200)
  expect(await checked.json()).toEqual({
    version: 1,
    ok: true,
    tables: connection.tables,
  })
  expect((await request(checkPath, 'POST', { version: 2 })).status).toBe(409)
  expect((await request(checkPath, 'POST', { version: '1' })).status).toBe(400)
  const flow = await (
    await request(`/api/database-connections/${connection.id}/api`, 'POST', {
      version: 1,
      table: 'people',
      name: 'History',
      path: '/history',
      protocol: 'rest',
      columns: ['age'],
      limit: 1,
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const edited = {
    ...flow,
    nodes: [
      flow.nodes[0],
      { ...flow.nodes[2], config: { status: 200, body: [] } },
    ],
    edges: [{ id: 'response', source: 'request', target: 'response' }],
  }
  expect((await request(`/api/flows/${flow.id}`, 'PUT', edited)).status).toBe(
    200,
  )
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(`/api/database-connections/${connection.id}`, 'DELETE', {
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/flows/${flow.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(200)
  const unused = await (
    await request('/api/database-connections', 'POST', upload())
  ).json()
  expect(
    (
      await request(`/api/database-connections/${unused.id}`, 'DELETE', {
        version: 2,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/database-connections/${unused.id}`, 'DELETE', {
        version: 1,
        path: 'control.sqlite',
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/database-connections/${unused.id}`, 'DELETE', {
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect((await request(`/api/database-connections/${unused.id}`)).status).toBe(
    404,
  )
  const actions = (await (await request('/api/audit')).json()).map(
    (event: { action: string }) => event.action,
  )
  expect(actions).toContain('database-connection.checked')
  expect(actions).toContain('database-connection.deleted')
})

test('SQLite reads quote inspected identifiers and bind values without accepting SQL, paths, or unexpected fields', async () => {
  const { request } = workspace()
  const bytes =
    sqlite(`CREATE TABLE "order" ("odd""name" TEXT NOT NULL, "__proto__" TEXT, "constructor" INTEGER, "中文" TEXT);
    INSERT INTO "order" VALUES ('x'' OR 1=1 --', 'safe', 2, '字'), ('other', NULL, 3, NULL);`)
  const created = await request(
    '/api/database-connections',
    'POST',
    upload(bytes),
  )
  expect(created.status).toBe(200)
  const connection = await created.json()
  expect(connection.tables[0].columns).toEqual([
    { key: 'odd_name', label: 'odd"name', type: 'string', nullable: false },
    { key: 'proto', label: '__proto__', type: 'string', nullable: true },
    { key: 'column_3', label: 'constructor', type: 'number', nullable: true },
    { key: 'column_4', label: '中文', type: 'string', nullable: true },
  ])
  const path = `/api/database-connections/${connection.id}/preview`
  const options = {
    version: 1,
    table: 'order',
    columns: ['odd_name', 'proto', 'column_4'],
    filter: { column: 'odd_name', value: "x' OR 1=1 --" },
    limit: 100,
  }
  expect(await (await request(path, 'POST', options)).json()).toMatchObject({
    rows: [{ odd_name: "x' OR 1=1 --", proto: 'safe', column_4: '字' }],
  })
  for (const changed of [
    { ...options, sql: 'SELECT * FROM members' },
    { ...options, path: 'control.sqlite' },
    { ...options, table: 'order"; ATTACH DATABASE' },
    { ...options, columns: ['odd_name"'] },
    { ...options, columns: ['odd_name', 'odd_name'] },
    { ...options, filter: { column: 'column_3', value: '2' } },
    { ...options, limit: 101 },
    { ...options, version: '1' },
    { ...options, filter: { ...options.filter, sql: '1=1' } },
  ])
    expect((await request(path, 'POST', changed)).status).toBe(400)
  expect((await request(path, 'POST', { ...options, version: 2 })).status).toBe(
    409,
  )
  expect(await (await request('/api/database-connections')).json()).toEqual([
    connection,
  ])
})

test('SQLite actions use explicit current grants, independent read/manage, and cookie CSRF', async () => {
  const { request } = workspace()
  async function custom(permissions: string[]) {
    const role = await (
      await request('/api/roles', 'POST', {
        name: `Role ${permissions.join(' ')}`,
        permissions,
      })
    ).json()
    const member = await (
      await request('/api/members', 'POST', {
        name: 'Operator',
        role: 'custom',
        roleId: role.id,
      })
    ).json()
    return { role, member }
  }
  const manager = await custom(['database-connections.manage'])
  const reader = await custom(['database-connections.read'])
  const connection = await (
    await request(
      '/api/database-connections',
      'POST',
      upload(),
      manager.member.token,
    )
  ).json()
  const prefix = `/api/database-connections/${connection.id}`
  const preview = { version: 1, table: 'people', columns: ['age'], limit: 1 }
  expect(
    (
      await request(
        '/api/database-connections',
        'GET',
        undefined,
        manager.member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request(prefix, 'GET', undefined, manager.member.token)).status,
  ).toBe(403)
  expect(
    (await request(`${prefix}/preview`, 'POST', preview, manager.member.token))
      .status,
  ).toBe(403)
  expect(
    (
      await request(
        `${prefix}/check`,
        'POST',
        { version: 1 },
        manager.member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/database-connections',
        'GET',
        undefined,
        reader.member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request(`${prefix}/preview`, 'POST', preview, reader.member.token))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/database-connections',
        'POST',
        upload(),
        reader.member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `${prefix}/check`,
        'POST',
        { version: 1 },
        reader.member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request(prefix, 'DELETE', { version: 1 }, reader.member.token))
      .status,
  ).toBe(403)
  const options = {
    ...preview,
    name: 'People',
    path: '/people',
    protocol: 'rest',
  }
  expect(
    (await request(`${prefix}/api`, 'POST', options, reader.member.token))
      .status,
  ).toBe(403)
  expect(
    (await request(`${prefix}/api`, 'POST', options, manager.member.token))
      .status,
  ).toBe(403)
  const origin = 'http://127.0.0.1:5173'
  const login = await request(
    '/auth/login',
    'POST',
    { token: manager.member.token },
    '',
    { origin },
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  expect(
    (
      await request(`${prefix}/check`, 'POST', { version: 1 }, '', {
        cookie,
        origin,
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await request(`${prefix}/check`, 'POST', { version: 1 }, '', {
        cookie,
        origin,
        'x-besh-csrf': session.csrfToken,
      })
    ).status,
  ).toBe(200)
  const pending = request(
    '/api/database-connections',
    'POST',
    upload(pendingSqlite()),
    manager.member.token,
  )
  await Bun.sleep(10)
  expect(
    (
      await request(`/api/roles/${manager.role.id}`, 'PUT', {
        name: manager.role.name,
        permissions: [],
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect((await pending).status).toBe(403)
  expect(
    (
      await request(
        `${prefix}/check`,
        'POST',
        { version: 1 },
        manager.member.token,
      )
    ).status,
  ).toBe(403)
  expect((await request(prefix, 'GET', undefined, '', { cookie })).status).toBe(
    401,
  )
  expect(
    await (await request('/api/database-connections')).json(),
  ).toHaveLength(1)
})

test('revoked browser session cannot finish an already pending SQLite upload', async () => {
  const { request } = workspace()
  const origin = 'http://127.0.0.1:5173'
  const login = await request('/auth/login', 'POST', { token: owner }, '', {
    origin,
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  const headers = { cookie, origin, 'x-besh-csrf': session.csrfToken }
  const pending = request(
    '/api/database-connections',
    'POST',
    upload(pendingSqlite()),
    '',
    headers,
  )
  await Bun.sleep(10)
  expect((await request('/auth/logout', 'POST', {}, '', headers)).status).toBe(
    200,
  )
  expect((await pending).status).toBe(401)
  expect(await (await request('/api/database-connections')).json()).toEqual([])
})

test('SQLite uploads reject unsafe scalars, unsupported structures, sidecars, and bounded schema/data violations', async () => {
  const { request } = workspace()
  const invalid = [
    new Uint8Array(120),
    sqlite().subarray(0, 200),
    sqlite('CREATE TABLE t(a TEXT); CREATE VIEW v AS SELECT * FROM t;'),
    sqlite('CREATE VIRTUAL TABLE t USING fts5(a);'),
    sqlite('CREATE TABLE t(a INTEGER, b INTEGER GENERATED ALWAYS AS (a+1));'),
    sqlite("CREATE TABLE t(a TEXT); INSERT INTO t VALUES (x'1234');"),
    sqlite('CREATE TABLE t(a REAL); INSERT INTO t VALUES (1e999);'),
    sqlite(
      'CREATE TABLE t(a INTEGER); INSERT INTO t VALUES (9007199254740993);',
    ),
    sqlite("CREATE TABLE t(a INTEGER); INSERT INTO t VALUES (1), ('mixed');"),
    sqlite('CREATE TABLE t(a BOOLEAN); INSERT INTO t VALUES (2);'),
    sqlite(
      `CREATE TABLE t(a TEXT); INSERT INTO t VALUES ('${'a'.repeat(4097)}');`,
    ),
    sqlite('CREATE TABLE t(a);'),
    sqlite(
      Array.from(
        { length: 9 },
        (_, index) => `CREATE TABLE t${index}(a TEXT);`,
      ).join(''),
    ),
    sqlite(
      `CREATE TABLE t(${Array.from({ length: 33 }, (_, index) => `c${index} TEXT`).join(',')});`,
    ),
    sqlite(
      'CREATE TABLE t(a INTEGER); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<5001) INSERT INTO t SELECT x FROM n;',
    ),
    sqlite(
      Array.from(
        { length: 5 },
        (_, index) =>
          `CREATE TABLE t${index}(a INTEGER); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<5000) INSERT INTO t${index} SELECT x FROM n;`,
      ).join(''),
    ),
  ]
  const wal = sqlite()
  wal[18] = 2
  wal[19] = 2
  invalid.push(wal)
  for (const bytes of invalid) {
    const rejected = await request(
      '/api/database-connections',
      'POST',
      upload(bytes),
    )
    expect(rejected.status).toBe(400)
    expect(JSON.stringify(await rejected.json())).not.toContain('SELECT ')
  }
  expect(
    (
      await request(
        '/api/database-connections',
        'POST',
        upload(new Uint8Array(2 * 1024 * 1024 + 1)),
      )
    ).status,
  ).toBe(413)
  expect(await (await request('/api/database-connections')).json()).toEqual([])
  const good = await (
    await request(
      '/api/database-connections',
      'POST',
      upload(
        sqlite(
          "CREATE TABLE t(a INTEGER NOT NULL, b BOOLEAN, c TEXT); INSERT INTO t VALUES (9007199254740991, NULL, NULL),(-9007199254740991,1,'字'); CREATE TABLE empty_table(a REAL);",
        ),
      ),
    )
  ).json()
  expect(
    good.tables.find((table: { name: string }) => table.name === 'empty_table'),
  ).toMatchObject({
    rowCount: 0,
    columns: [{ type: 'number', nullable: true }],
  })
  expect(
    await (
      await request(`/api/database-connections/${good.id}/preview`, 'POST', {
        version: 1,
        table: 't',
        columns: ['a', 'b', 'c'],
        limit: 10,
      })
    ).json(),
  ).toMatchObject({
    rows: [
      { a: 9007199254740991, b: null, c: null },
      { a: -9007199254740991, b: true, c: '字' },
    ],
  })
})

test('SQLite response budget rejects oversized projections and frees its reader for subsequent requests', async () => {
  const { request } = workspace()
  const bytes = sqlite(
    `CREATE TABLE t(a TEXT NOT NULL); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100) INSERT INTO t SELECT '${'x'.repeat(4096)}' FROM n;`,
  )
  const imported = await request(
    '/api/database-connections',
    'POST',
    upload(bytes),
  )
  expect(imported.status).toBe(200)
  const connection = await imported.json()
  const options = { version: 1, table: 't', columns: ['a'], limit: 100 }
  expect(
    (
      await request(
        `/api/database-connections/${connection.id}/preview`,
        'POST',
        options,
      )
    ).status,
  ).toBe(413)
  const preview = await request(
    `/api/database-connections/${connection.id}/preview`,
    'POST',
    { ...options, limit: 1 },
  )
  expect(preview.status).toBe(200)
  expect((await preview.json()).rows).toEqual([{ a: 'x'.repeat(4096) }])
})

function costlySqlite() {
  // CHECK runs during SQLite integrity inspection. Ignore it only while creating the hostile fixture.
  return sqlite(`CREATE TABLE t(a TEXT CHECK(a LIKE '%${'a'.repeat(25000)}b'));
    PRAGMA ignore_check_constraints=ON;
    INSERT INTO t VALUES ('${'a'.repeat(1750000)}');`)
}

test('real SQLite native inspection respects heap and wall-time budgets while parent HTTP stays responsive', async () => {
  const { request } = workspace()
  const memory = sqlite(
    'CREATE TABLE t(a INTEGER CHECK(length(randomblob(33554432))>0)); PRAGMA ignore_check_constraints=ON; INSERT INTO t VALUES(1);',
  )
  expect(
    (await request('/api/database-connections', 'POST', upload(memory))).status,
  ).toBe(400)
  const bytes = costlySqlite()
  const started = performance.now()
  const pending = request('/api/database-connections', 'POST', upload(bytes))
  await Bun.sleep(100)
  for (let index = 0; index < 5; index++) {
    const before = performance.now()
    expect((await request('/health')).status).toBe(200)
    expect(performance.now() - before).toBeLessThan(500)
    await Bun.sleep(15)
  }
  const response = await pending
  expect(response.status).toBe(503)
  expect(performance.now() - started).toBeLessThan(3500)
  expect(await response.json()).toEqual({
    error: 'SQLite read exceeded its deadline or was cancelled',
  })
  expect(await (await request('/api/database-connections')).json()).toEqual([])
  expect(
    (await request('/api/database-connections', 'POST', upload())).status,
  ).toBe(200)
})

test('SQLite readers share a process-wide concurrency limit and cancel real children on request abort and shutdown', async () => {
  const first = workspace()
  const second = workspace()
  const third = workspace()
  const bytes = costlySqlite()
  const controller = new AbortController()
  const pendingFirst = first.request(
    '/api/database-connections',
    'POST',
    upload(bytes),
    owner,
    {},
    controller.signal,
  )
  const pendingSecond = second.request(
    '/api/database-connections',
    'POST',
    upload(bytes),
  )
  await Bun.sleep(100)
  expect(
    (await third.request('/api/database-connections', 'POST', upload())).status,
  ).toBe(429)
  const started = performance.now()
  controller.abort()
  expect((await pendingFirst).status).toBe(503)
  expect(performance.now() - started).toBeLessThan(600)
  expect(
    (await third.request('/api/database-connections', 'POST', upload())).status,
  ).toBe(200)
  const stopping = performance.now()
  await second.server.close()
  expect((await pendingSecond).status).toBe(503)
  expect(performance.now() - stopping).toBeLessThan(600)
  const restarted = createApp(second.options)
  cleanup.push(() => restarted.close())
  const listed = await restarted.app.handle(
    new Request('http://localhost/api/database-connections', {
      headers: { authorization: `Bearer ${owner}` },
    }),
  )
  expect(await listed.json()).toEqual([])
})

test('published SQLite REST reads stop their actual child when the caller aborts', async () => {
  const { request } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload(pendingSqlite()))
  ).json()
  const flow = await (
    await request(`/api/database-connections/${connection.id}/api`, 'POST', {
      version: 1,
      table: 't',
      name: 'Abort API',
      path: '/abort-copy',
      protocol: 'rest',
      columns: ['a'],
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Client',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })
  ).json()
  const controller = new AbortController()
  const pending = request(
    '/run/abort-copy',
    'GET',
    undefined,
    key.token,
    {},
    controller.signal,
  )
  await Bun.sleep(10)
  controller.abort()
  expect((await pending).status).toBe(503)
  expect(
    (await request('/run/abort-copy', 'GET', undefined, key.token)).status,
  ).toBe(200)
})

test('uploaded copies and their published APIs survive restart and downloaded control-backup restoration', async () => {
  const original = workspace()
  const connection = await (
    await original.request('/api/database-connections', 'POST', upload())
  ).json()
  const flow = await (
    await original.request(
      `/api/database-connections/${connection.id}/api`,
      'POST',
      {
        version: 1,
        table: 'people',
        name: 'Restored people',
        path: '/restore-copy',
        protocol: 'rest',
        columns: ['full_name', 'age'],
        limit: 10,
      },
    )
  ).json()
  await original.request(`/api/flows/${flow.id}/publish`, 'POST', {
    revision: 1,
  })
  const key = await (
    await original.request('/api/runtime-keys', 'POST', {
      name: 'Client',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })
  ).json()
  const backup = await (await original.request('/api/backups', 'POST')).json()
  const downloaded = await original.request(`/api/backups/${backup.id}`)
  expect(downloaded.status).toBe(200)
  const bytes = new Uint8Array(await downloaded.arrayBuffer())
  await original.server.close()
  const restarted = createApp(original.options)
  cleanup.push(() => restarted.close())
  const metadata = await restarted.app.handle(
    new Request(`http://localhost/api/database-connections/${connection.id}`, {
      headers: { authorization: `Bearer ${owner}` },
    }),
  )
  expect(await metadata.json()).toEqual(connection)
  const directory = mkdtempSync(join(tmpdir(), 'besh-restored-copy-'))
  const restoredPath = join(directory, 'restored.sqlite')
  writeFileSync(restoredPath, bytes)
  const restored = createApp({
    ...original.options,
    databasePath: restoredPath,
    backupDir: join(directory, 'backups'),
  })
  cleanup.push(() => {
    restored.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const live = await restored.app.handle(
    new Request('http://localhost/run/restore-copy', {
      headers: { authorization: `Bearer ${key.token}` },
    }),
  )
  expect(live.status).toBe(200)
  expect(await live.json()).toEqual([
    { full_name: 'Ada', age: 36 },
    { full_name: 'Grace', age: 85 },
  ])
  const check = await restored.app.handle(
    new Request(
      `http://localhost/api/database-connections/${connection.id}/check`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${owner}`,
          'content-type': 'application/json',
        },
        body: '{"version":1}',
      },
    ),
  )
  expect(await check.json()).toEqual({
    version: 1,
    ok: true,
    tables: connection.tables,
  })
})

test('SQLite registry quotas commit atomically across concurrent app handles', async () => {
  const first = workspace()
  const secondServer = createApp(first.options)
  cleanup.push(() => secondServer.close())
  for (let index = 0; index < 7; index++)
    expect(
      (await first.request('/api/database-connections', 'POST', upload()))
        .status,
    ).toBe(200)
  const other = (body: FormData) =>
    secondServer.app.handle(
      new Request('http://localhost/api/database-connections', {
        method: 'POST',
        headers: { authorization: `Bearer ${owner}` },
        body,
      }),
    )
  const responses = await Promise.all([
    first.request('/api/database-connections', 'POST', upload()),
    other(upload()),
  ])
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ])
  expect(
    await (await first.request('/api/database-connections')).json(),
  ).toHaveLength(8)
})

test('editable database drafts preserve missing dependencies but publication checks references and the four-node bound', async () => {
  const { request } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload())
  ).json()
  const options = {
    version: 1,
    table: 'people',
    name: 'Dependency',
    path: '/dependency',
    protocol: 'rest',
    columns: ['age'],
    limit: 1,
  }
  const flow = await (
    await request(
      `/api/database-connections/${connection.id}/api`,
      'POST',
      options,
    )
  ).json()
  expect(
    (
      await request(`/api/database-connections/${connection.id}`, 'DELETE', {
        version: 1,
      })
    ).status,
  ).toBe(409)
  const node = flow.nodes[1]
  for (const config of [
    { ...node.config, connectionId: 'missing' },
    { ...node.config, table: 'missing' },
    { ...node.config, columns: ['missing'] },
  ]) {
    const created = await request('/api/flows', 'POST', {
      ...flow,
      path: `/bad-${crypto.randomUUID()}`,
      nodes: [flow.nodes[0], { ...node, config }, flow.nodes[2]],
    })
    expect(created.status).toBe(200)
    const draft = await created.json()
    expect(
      (await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(400)
  }
  const many = Array.from({ length: 5 }, (_, index) => ({
    ...node,
    id: `database${index}`,
  }))
  const draft = await (
    await request('/api/flows', 'POST', {
      ...flow,
      path: '/too-many-databases',
      nodes: [flow.nodes[0], ...many, flow.nodes[2]],
      edges: [
        { id: 'start', source: 'request', target: 'database0' },
        ...many.map((item, index) => ({
          id: `edge${index}`,
          source: item.id,
          target: index === 4 ? 'response' : `database${index + 1}`,
        })),
      ],
    })
  ).json()
  const rejected = await request(`/api/flows/${draft.id}/publish`, 'POST', {
    revision: 1,
  })
  expect(rejected.status).toBe(400)
  expect(await rejected.json()).toEqual({
    error: 'Use at most four database nodes per flow',
  })
})

test('SQLite generation and deletion share a transaction across control database handles', async () => {
  const first = workspace()
  const second = createApp(first.options)
  cleanup.push(() => second.close())
  const connection = await (
    await first.request('/api/database-connections', 'POST', upload())
  ).json()
  const generate = first.request(
    `/api/database-connections/${connection.id}/api`,
    'POST',
    {
      version: 1,
      table: 'people',
      name: 'Race',
      path: '/generation-race',
      protocol: 'rest',
      columns: ['age'],
      limit: 1,
    },
  )
  const deletion = second.app.handle(
    new Request(`http://localhost/api/database-connections/${connection.id}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${owner}`,
        'content-type': 'application/json',
      },
      body: '{"version":1}',
    }),
  )
  const [created, deleted] = await Promise.all([generate, deletion])
  if (created.status === 200) {
    expect(deleted.status).toBe(409)
    const flow = await created.json()
    expect(
      (
        await first.request(`/api/flows/${flow.id}/publish`, 'POST', {
          revision: 1,
        })
      ).status,
    ).toBe(200)
  } else {
    expect(created.status).toBe(404)
    expect(deleted.status).toBe(200)
    expect(await (await first.request('/api/flows')).json()).toEqual([])
  }
})

test('SQLite filters preserve scalar types including explicit null rather than implicit coercion', async () => {
  const { request } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload())
  ).json()
  const path = `/api/database-connections/${connection.id}/preview`
  const options = {
    version: 1,
    table: 'people',
    columns: ['full_name'],
    limit: 10,
  }
  expect(
    await (
      await request(path, 'POST', {
        ...options,
        filter: { column: 'note', value: null },
      })
    ).json(),
  ).toMatchObject({ rows: [{ full_name: 'Ada' }] })
  expect(
    await (
      await request(path, 'POST', {
        ...options,
        filter: { column: 'active', value: false },
      })
    ).json(),
  ).toMatchObject({ rows: [{ full_name: 'Grace' }] })
  expect(
    (
      await request(path, 'POST', {
        ...options,
        filter: { column: 'active', value: 0 },
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(path, 'POST', {
        ...options,
        filter: { column: 'age', value: '36' },
      })
    ).status,
  ).toBe(400)
})

test('ordinary sqlite-prefixed names stay visible and cannot conceal unsupported views or evade table limits', async () => {
  const { request } = workspace()
  const visible = await request(
    '/api/database-connections',
    'POST',
    upload(
      sqlite(
        "CREATE TABLE sqlitePeople(name TEXT); INSERT INTO sqlitePeople VALUES('Ada');",
      ),
    ),
  )
  expect(visible.status).toBe(200)
  expect((await visible.json()).tables).toEqual([
    {
      name: 'sqlitePeople',
      rowCount: 1,
      columns: [{ key: 'name', label: 'name', type: 'string', nullable: true }],
    },
  ])
  expect(
    (
      await request(
        '/api/database-connections',
        'POST',
        upload(
          sqlite(
            'CREATE TABLE people(name TEXT); CREATE VIEW sqliteHidden AS SELECT name FROM people;',
          ),
        ),
      )
    ).status,
  ).toBe(400)
  expect(
    (
      await request(
        '/api/database-connections',
        'POST',
        upload(
          sqlite(
            'CREATE TABLE people(name TEXT);' +
              Array.from(
                { length: 9 },
                (_, index) => `CREATE TABLE sqliteExtra${index}(a INTEGER);`,
              ).join(''),
          ),
        ),
      )
    ).status,
  ).toBe(400)
})

test('shutdown cancels published REST and GraphQL database reads before either can audit against closed SQLite', async () => {
  const { request, server, options } = workspace()
  const connection = await (
    await request('/api/database-connections', 'POST', upload(pendingSqlite()))
  ).json()
  const pending: Promise<Response>[] = []
  for (const protocol of ['rest', 'graphql']) {
    const flow = await (
      await request(`/api/database-connections/${connection.id}/api`, 'POST', {
        version: 1,
        table: 't',
        name: `Close ${protocol}`,
        path: `/close-${protocol}`,
        protocol,
        columns: ['a'],
        limit: 1,
      })
    ).json()
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
    const key = await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Client',
        flowId: flow.id,
        permissions: [protocol === 'rest' ? 'rest' : 'query'],
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
    ).json()
    pending.push(
      request(
        `/${protocol === 'rest' ? 'run' : 'graphql'}/close-${protocol}`,
        protocol === 'rest' ? 'GET' : 'POST',
        protocol === 'rest' ? undefined : { query: '{ rows { a } }' },
        key.token,
      ),
    )
  }
  await Bun.sleep(10)
  await server.close()
  expect(
    (await Promise.all(pending)).map((response) => response.status),
  ).toEqual([503, 503])
  const restarted = createApp(options)
  cleanup.push(() => restarted.close())
  const audit = await restarted.app.handle(
    new Request('http://localhost/api/audit', {
      headers: { authorization: `Bearer ${owner}` },
    }),
  )
  const actions = (await audit.json()).map(
    (event: { action: string }) => event.action,
  )
  expect(actions).not.toContain('flow.executed')
  expect(actions).not.toContain('graphql.executed')
})
