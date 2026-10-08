import { afterEach, expect, test, mock } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'

const owner = 'spreadsheet-test-owner-key-32-characters-long'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
})

function workspace(overrides: Partial<Parameters<typeof createApp>[0]> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-data-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...overrides,
  }
  const server = createApp(options)
  cleanup.push(() => {
    server.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  })

  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) {
    return server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
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
  }

  return { request, server, options }
}

function upload(content: string | Uint8Array, filename = 'contacts.csv') {
  const body = new FormData()
  body.append('name', 'Contacts')
  body.append(
    'file',
    new File(
      [typeof content === 'string' ? content : new Uint8Array(content)],
      filename,
    ),
  )
  return body
}

test('CSV import previews typed rows and safe original header mappings', async () => {
  const { request } = workspace()
  const response = await request(
    '/api/data-sources/import',
    'POST',
    upload(
      'Full Name,Age,Active,Code,Notes\r\n"Ada, Lovelace",36,true,001,"Two\nlines"\r\nGrace,85,false,002,\r\n',
    ),
  )
  expect(response.status).toBe(200)
  const source = await response.json()
  expect(source).toMatchObject({
    name: 'Contacts',
    kind: 'upload',
    rowCount: 2,
    version: 1,
    columns: [
      { key: 'full_name', label: 'Full Name', type: 'string', nullable: false },
      { key: 'age', label: 'Age', type: 'number', nullable: false },
      { key: 'active', label: 'Active', type: 'boolean', nullable: false },
      { key: 'code', label: 'Code', type: 'string', nullable: false },
      { key: 'notes', label: 'Notes', type: 'string', nullable: true },
    ],
    rows: [
      {
        full_name: 'Ada, Lovelace',
        age: 36,
        active: true,
        code: '001',
        notes: 'Two\nlines',
      },
      { full_name: 'Grace', age: 85, active: false, code: '002', notes: null },
    ],
  })
  expect(
    await (await request(`/api/data-sources/${source.id}`)).json(),
  ).toEqual(source)
  const listed = await (await request('/api/data-sources')).json()
  expect(listed).toHaveLength(1)
  expect(listed[0]).not.toHaveProperty('rows')
  expect(
    (await (await request('/api/audit')).json()).some(
      (event: { action: string }) => event.action === 'data-source.imported',
    ),
  ).toBe(true)
})

test('Google Sheets import fetches a normalized public export once and serves its saved snapshot', async () => {
  const fetched: string[] = []
  const provider = mock(async (url: string, options?: RequestInit) => {
    fetched.push(url)
    expect(options?.redirect).toBe('manual')
    expect(options?.credentials).toBe('omit')
    expect(new Headers(options?.headers).has('authorization')).toBe(false)
    return url.startsWith('https://docs.google.com/')
      ? new Response(null, {
          status: 307,
          headers: {
            location:
              'https://doc-08-4o-sheets.googleusercontent.com/export/public-file',
          },
        })
      : new Response('Name,Age\nAda,36', {
          headers: { 'content-type': 'text/csv' },
        })
  })
  const { request } = workspace({ sheetFetch: provider })
  const response = await request('/api/data-sources/google-sheets', 'POST', {
    name: 'Shared contacts',
    url: 'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit?usp=sharing#gid=123',
  })
  expect(response.status).toBe(200)
  const source = await response.json()
  expect(source).toMatchObject({
    kind: 'google-sheets',
    sourceUrl:
      'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit#gid=123',
    rows: [{ name: 'Ada', age: 36 }],
  })
  expect(fetched).toEqual([
    'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/export?format=csv&gid=123',
    'https://doc-08-4o-sheets.googleusercontent.com/export/public-file',
  ])
  await request(`/api/data-sources/${source.id}`)
  expect(fetched).toHaveLength(2)
})

test('Excel imports typed cells and cached formulas from a real XLSX worksheet', async () => {
  const { request } = workspace()
  const response = await request(
    '/api/data-sources/import',
    'POST',
    upload(
      readFileSync(join(import.meta.dir, 'fixtures/contacts.xlsx')),
      'contacts.xlsx',
    ),
  )
  expect(response.status).toBe(200)
  const source = await response.json()
  expect(source).toMatchObject({
    kind: 'upload',
    sheetName: 'Contacts',
    rowCount: 1,
    rows: [
      {
        name: 'Ada',
        count: 2,
        active: true,
        created: '2024-07-27T00:00:00.000Z',
        total: 4,
      },
    ],
  })
  expect(source.columns.map((column: { type: string }) => column.type)).toEqual(
    ['string', 'number', 'boolean', 'string', 'number'],
  )
})

test('Excel imports reject missing cached formulas at custom worksheet paths', async () => {
  const { request } = workspace()
  for (const filename of [
    'uncached-formula-relocated.xlsx',
    'uncached-formula-uppercase.xlsx',
  ]) {
    const response = await request(
      '/api/data-sources/import',
      'POST',
      upload(
        readFileSync(join(import.meta.dir, 'fixtures', filename)),
        filename,
      ),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain(
      'formula has no saved result',
    )
  }
  expect(await (await request('/api/data-sources')).json()).toEqual([])
})

test('Excel imports reject relationship-selected data beneath a malformed worksheet root', async () => {
  const { request } = workspace()
  const response = await request(
    '/api/data-sources/import',
    'POST',
    upload(
      readFileSync(
        join(import.meta.dir, 'fixtures/malformed-root-formula.xlsx'),
      ),
      'malformed-root-formula.xlsx',
    ),
  )
  expect(response.status).toBe(400)
  expect(await (await request('/api/data-sources')).json()).toEqual([])
})

test('Excel imports accept valid relocated worksheets with lowercase or uppercase XML extensions', async () => {
  const { request } = workspace()
  for (const filename of [
    'contacts-relocated.xlsx',
    'contacts-uppercase.xlsx',
  ]) {
    const response = await request(
      '/api/data-sources/import',
      'POST',
      upload(
        readFileSync(join(import.meta.dir, 'fixtures', filename)),
        filename,
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      sheetName: 'Contacts',
      rowCount: 1,
      rows: [
        {
          name: 'Ada',
          count: 2,
          active: true,
          created: '2024-07-27T00:00:00.000Z',
          total: 4,
        },
      ],
    })
  }
})

test('Excel imports bound row and column coordinates at custom worksheet paths', async () => {
  const { request } = workspace()
  for (const filename of [
    'overlimit-grid-relocated.xlsx',
    'overlimit-grid-uppercase.xlsx',
    'overlimit-column-relocated.xlsx',
    'overlimit-column-uppercase.xlsx',
  ]) {
    const response = await request(
      '/api/data-sources/import',
      'POST',
      upload(
        readFileSync(join(import.meta.dir, 'fixtures', filename)),
        filename,
      ),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Use at most')
  }
  expect(await (await request('/api/data-sources')).json()).toEqual([])
})

test('a generated REST draft publishes bounded selected spreadsheet rows with a named filter', async () => {
  const { request } = workspace()
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      upload('Name,Age,Active\nAda,36,true\nGrace,85,false'),
    )
  ).json()
  const created = await request(`/api/data-sources/${source.id}/api`, 'POST', {
    name: 'Contacts API',
    path: '/contacts',
    protocol: 'rest',
    columns: ['name', 'age'],
    filter: { column: 'name', inputName: 'person' },
    limit: 10,
  })
  expect(created.status).toBe(200)
  const flow = await created.json()
  expect(flow.publishedRevision).toBeNull()
  const preview = await (
    await request(`/api/flows/${flow.id}/test`, 'POST', {
      body: null,
      query: { person: 'Grace' },
    })
  ).json()
  expect(preview.body).toEqual([{ name: 'Grace', age: 85 }])
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Application',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
  ).json()
  const result = await request(
    '/run/contacts?person=Ada',
    'GET',
    undefined,
    key.token,
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual([{ name: 'Ada', age: 36 }])
  expect(
    await (await request('/run/contacts', 'GET', undefined, key.token)).json(),
  ).toEqual([
    { name: 'Ada', age: 36 },
    { name: 'Grace', age: 85 },
  ])
})

test('a generated GraphQL API selects typed row fields and validates filter variables', async () => {
  const { request } = workspace()
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      upload('Name,Age,Active\nAda,36,true\nGrace,85,false'),
    )
  ).json()
  const created = await request(`/api/data-sources/${source.id}/api`, 'POST', {
    name: 'GraphQL contacts',
    path: '/contacts',
    protocol: 'graphql',
    columns: ['age', 'active'],
    filter: { column: 'name', inputName: 'person' },
    limit: 10,
  })
  expect(created.status).toBe(200)
  const flow = await created.json()
  expect(flow.graphql.schema).toContain('age: Float!')
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Application',
      flowId: flow.id,
      permissions: ['query'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
  ).json()
  const result = await request(
    '/graphql/contacts',
    'POST',
    {
      query: 'query Find($name: String) { rows(person: $name) { active age } }',
      variables: { name: 'Ada' },
    },
    key.token,
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({
    data: { rows: [{ active: true, age: 36 }] },
  })
  expect(
    (
      await request(
        '/graphql/contacts',
        'POST',
        { query: '{ rows { name } }' },
        key.token,
      )
    ).status,
  ).toBe(400)
  expect(
    (
      await request(
        '/graphql/contacts',
        'POST',
        {
          query: 'query Find($name: String) { rows(person: $name) { age } }',
          variables: { name: 36 },
        },
        key.token,
      )
    ).status,
  ).toBe(400)
})

test('replacing a snapshot updates live data while protecting published output and filter column types', async () => {
  const { request } = workspace()
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      upload('Name,Age,Active\nAda,36,true'),
    )
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Contacts',
      path: '/contacts',
      protocol: 'graphql',
      columns: ['name'],
      filter: { column: 'age', inputName: 'age' },
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const replaced = await request(
    `/api/data-sources/${source.id}/import`,
    'PUT',
    upload('Name,Age,Active\nGrace,85,false'),
  )
  expect(replaced.status).toBe(200)
  expect(await replaced.json()).toMatchObject({
    id: source.id,
    version: 2,
    rows: [{ name: 'Grace', age: 85, active: false }],
  })
  for (const contents of [
    'Name,Age,Active\nGrace,unknown,false',
    'Name,Active\nGrace,false',
    'Name,Age,Active\nGrace,85,false\n,86,true',
  ]) {
    expect(
      (
        await request(
          `/api/data-sources/${source.id}/import`,
          'PUT',
          upload(contents),
        )
      ).status,
    ).toBe(409)
  }
  expect(
    await (await request(`/api/data-sources/${source.id}`)).json(),
  ).toMatchObject({
    version: 2,
    rows: [{ name: 'Grace', age: 85, active: false }],
  })
  expect(
    (await request(`/api/data-sources/${source.id}`, 'DELETE')).status,
  ).toBe(409)
  const result = await (
    await request(`/api/flows/${flow.id}/graphql/test`, 'POST', {
      query: '{ rows(age: 85) { name } }',
    })
  ).json()
  expect(result.body).toEqual({ data: { rows: [{ name: 'Grace' }] } })
  const unused = await (
    await request('/api/data-sources/import', 'POST', upload('Name\nUnused'))
  ).json()
  expect(
    await (await request(`/api/data-sources/${unused.id}`, 'DELETE')).json(),
  ).toEqual({ ok: true })
  expect((await request(`/api/data-sources/${unused.id}`)).status).toBe(404)
})

test('invalid and oversized spreadsheets are rejected without saving a partial source', async () => {
  const { request } = workspace()
  for (const content of [
    'Name,Name\nAda,Grace',
    ',Age\nAda,36',
    '__proto__,Age\nAda,36',
    'constructor,Age\nAda,36',
    `${'a'.repeat(81)}\nAda`,
    'Name\n"unfinished',
    'Name\nAda,Extra',
    'Name',
    `Name\n${'a'.repeat(4097)}`,
    `${Array.from({ length: 65 }, (_, index) => `Field${index}`).join(',')}\n${Array(65).fill('x').join(',')}`,
    `Name\n${Array(5001).fill('Ada').join('\n')}`,
  ])
    expect(
      (await request('/api/data-sources/import', 'POST', upload(content)))
        .status,
    ).toBe(400)
  expect(
    (
      await request(
        '/api/data-sources/import',
        'POST',
        upload('x'.repeat(2 * 1024 * 1024 + 1)),
      )
    ).status,
  ).toBe(400)
  for (const filename of [
    'compressed-bomb.xlsx',
    'forged-bomb.xlsx',
    'oversized-grid.xlsx',
    'encoded-grid.xlsx',
    'namespaced-grid.xlsx',
    'zero-cell.xlsx',
  ]) {
    const response = await request(
      '/api/data-sources/import',
      'POST',
      upload(
        readFileSync(join(import.meta.dir, 'fixtures', filename)),
        filename,
      ),
    )
    expect(response.status).toBe(400)
  }
  const formula = await request(
    '/api/data-sources/import',
    'POST',
    upload(
      readFileSync(join(import.meta.dir, 'fixtures/uncached-formula.xlsx')),
      'formula.xlsx',
    ),
  )
  expect(formula.status).toBe(400)
  expect((await formula.json()).error).toContain('no saved result')
  expect(await (await request('/api/data-sources')).json()).toEqual([])
  expect(
    (await (await request('/api/audit')).json()).some(
      (event: { action: string }) => event.action === 'data-source.imported',
    ),
  ).toBe(false)
})

test('multipart uploads may exceed 256 KiB while ordinary API requests keep that boundary', async () => {
  const { request } = workspace()
  const content = `Name,Notes\n${Array.from({ length: 1000 }, (_, index) => `Person${index},${'a'.repeat(400)}`).join('\n')}`
  const imported = await request(
    '/api/data-sources/import',
    'POST',
    upload(content),
  )
  expect(imported.status).toBe(200)
  expect(await imported.json()).toMatchObject({
    rowCount: 1000,
    rows: expect.any(Array),
  })
  expect(
    (await request('/api/flows', 'POST', { notes: 'a'.repeat(262_144) }))
      .status,
  ).toBe(413)
})

test('multipart spreadsheet uploads work through the actual HTTP transport', async () => {
  const { server } = workspace()
  server.app.listen({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 3 * 1024 * 1024,
  })
  try {
    const response = await fetch(
      new URL('/api/data-sources/import', server.app.server!.url),
      {
        method: 'POST',
        headers: { authorization: `Bearer ${owner}` },
        body: upload(
          'name,price,available\nTea,12,true\nCoffee,15,false\n',
          'products.csv',
        ),
      },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      rowCount: 2,
      rows: [
        { name: 'Tea', price: 12, available: true },
        { name: 'Coffee', price: 15, available: false },
      ],
    })
  } finally {
    await server.app.stop()
  }
})

test('Google imports reject arbitrary targets, unsafe redirects, private responses and streamed oversize data', async () => {
  const provider = mock(
    async () =>
      new Response('Name\nAda', { headers: { 'content-type': 'text/csv' } }),
  )
  const { request } = workspace({ sheetFetch: provider })
  for (const url of [
    'http://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit',
    'https://docs.google.com.evil.test/spreadsheets/d/test-sheet-12345678901234567890/edit',
    'https://owner:secret@docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit',
    'https://127.0.0.1/private',
    'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit#gid=abc',
    'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit?gid=1#gid=2',
  ])
    expect(
      (
        await request('/api/data-sources/google-sheets', 'POST', {
          name: 'Sheet',
          url,
        })
      ).status,
    ).toBe(400)
  expect(provider).not.toHaveBeenCalled()
  const valid = {
    name: 'Sheet',
    url: 'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit',
  }
  for (const location of [
    'https://127.0.0.1/private',
    'https://accounts.google.com/login',
    'http://docs.google.com/private',
    'https://other.googleusercontent.com/export',
    'https://docs.google.com:444/private',
  ]) {
    provider.mockImplementation(
      async () => new Response(null, { status: 307, headers: { location } }),
    )
    expect(
      (await request('/api/data-sources/google-sheets', 'POST', valid)).status,
    ).toBe(400)
  }
  provider.mockImplementation(
    async () =>
      new Response('<html>Private account</html>', {
        headers: { 'content-type': 'text/html' },
      }),
  )
  const privateSheet = await request(
    '/api/data-sources/google-sheets',
    'POST',
    valid,
  )
  expect(privateSheet.status).toBe(400)
  expect((await privateSheet.json()).error).toContain(
    'upload Excel/CSV instead',
  )
  let cancelled = false
  provider.mockImplementation(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
          },
          cancel() {
            cancelled = true
          },
        }),
        { headers: { 'content-type': 'text/csv', 'content-length': '1' } },
      ),
  )
  expect(
    (await request('/api/data-sources/google-sheets', 'POST', valid)).status,
  ).toBe(400)
  expect(cancelled).toBe(true)
  provider.mockImplementation(async () => {
    throw new Error('private-provider-error-do-not-reveal')
  })
  const failure = await request(
    '/api/data-sources/google-sheets',
    'POST',
    valid,
  )
  expect(failure.status).toBe(502)
  expect(await failure.text()).not.toContain(
    'private-provider-error-do-not-reveal',
  )
  expect(await (await request('/api/data-sources')).json()).toEqual([])
})

test('Google refresh replaces only the snapshot explicitly and detects concurrent refreshes', async () => {
  let pendingResolve: (response: Response) => void = () => {}
  let enteredResolve: () => void = () => {}
  const entered = new Promise<void>((resolve) => {
    enteredResolve = resolve
  })
  let calls = 0
  const provider = mock(async () => {
    calls++
    if (calls === 2) {
      enteredResolve()
      return new Promise<Response>((resolve) => {
        pendingResolve = resolve
      })
    }
    return new Response(
      calls === 1 ? 'Name,Age\nAda,36' : 'Name,Age\nGrace,85',
      { headers: { 'content-type': 'text/csv' } },
    )
  })
  const { request } = workspace({ sheetFetch: provider })
  const source = await (
    await request('/api/data-sources/google-sheets', 'POST', {
      name: 'Contacts',
      url: 'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit',
    })
  ).json()
  const slow = request(`/api/data-sources/${source.id}/refresh`, 'POST')
  await entered
  const fast = await request(`/api/data-sources/${source.id}/refresh`, 'POST')
  expect(fast.status).toBe(200)
  expect(await fast.json()).toMatchObject({
    id: source.id,
    version: 2,
    rows: [{ name: 'Grace', age: 85 }],
  })
  pendingResolve(
    new Response('Name,Age\nLate,50', {
      headers: { 'content-type': 'text/csv' },
    }),
  )
  expect((await slow).status).toBe(409)
  expect(
    await (await request(`/api/data-sources/${source.id}`)).json(),
  ).toMatchObject({ version: 2, rows: [{ name: 'Grace', age: 85 }] })
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (event: { action: string }) => event.action === 'data-source.refreshed',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(audit)).not.toContain('docs.google.com')
  expect(JSON.stringify(audit)).not.toContain('Grace')
})

test('only owners and editors manage or preview spreadsheet data', async () => {
  const { request } = workspace()
  const source = await (
    await request('/api/data-sources/import', 'POST', upload('Name\nAda'))
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reader', role: 'viewer' })
  ).json()
  const editor = await (
    await request('/api/members', 'POST', { name: 'Builder', role: 'editor' })
  ).json()
  for (const [path, method, body] of [
    ['/api/data-sources', 'GET', undefined],
    [`/api/data-sources/${source.id}`, 'GET', undefined],
    ['/api/data-sources/import', 'POST', upload('Name\nPrivate')],
    [`/api/data-sources/${source.id}/import`, 'PUT', upload('Name\nPrivate')],
    [
      '/api/data-sources/google-sheets',
      'POST',
      {
        name: 'Private',
        url: 'https://docs.google.com/spreadsheets/d/test-sheet-12345678901234567890/edit',
      },
    ],
    [`/api/data-sources/${source.id}/refresh`, 'POST', undefined],
    [`/api/data-sources/${source.id}`, 'DELETE', undefined],
    [
      `/api/data-sources/${source.id}/api`,
      'POST',
      {
        name: 'Private',
        path: '/private',
        protocol: 'rest',
        columns: ['name'],
        limit: 10,
      },
    ],
  ] as const)
    expect((await request(path, method, body, viewer.token)).status).toBe(403)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'GET',
        undefined,
        editor.token,
      )
    ).status,
  ).toBe(200)
  const imported = await request(
    '/api/data-sources/import',
    'POST',
    upload('Name\nEditor'),
    editor.token,
  )
  expect(imported.status).toBe(200)
  const flow = await (
    await request(
      `/api/data-sources/${source.id}/api`,
      'POST',
      {
        name: 'Editor API',
        path: '/editor',
        protocol: 'rest',
        columns: ['name'],
        limit: 10,
      },
      editor.token,
    )
  ).json()
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 1 },
        editor.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/data-sources/${source.id}`,
        'DELETE',
        undefined,
        editor.token,
      )
    ).status,
  ).toBe(409)
})

test('backup restoration includes snapshot rows, versions and published data APIs', async () => {
  const { request, options } = workspace()
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      upload('Name,Age\nAda,36'),
    )
  ).json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Contacts',
      path: '/contacts',
      protocol: 'rest',
      columns: ['name', 'age'],
      limit: 10,
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Application',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const downloaded = await request(`/api/backups/${backup.id}`)
  const restoredPath = join(options.backupDir, 'data-restored.sqlite')
  writeFileSync(restoredPath, Buffer.from(await downloaded.arrayBuffer()))
  await request(
    `/api/data-sources/${source.id}/import`,
    'PUT',
    upload('Name,Age\nGrace,85'),
  )
  const restored = createApp({ ...options, databasePath: restoredPath })
  try {
    const preview = await restored.app.handle(
      new Request(`http://localhost/api/data-sources/${source.id}`, {
        headers: { authorization: `Bearer ${owner}` },
      }),
    )
    expect(await preview.json()).toMatchObject({
      version: 1,
      rows: [{ name: 'Ada', age: 36 }],
    })
    const result = await restored.app.handle(
      new Request('http://localhost/run/contacts', {
        headers: { authorization: `Bearer ${key.token}` },
      }),
    )
    expect(await result.json()).toEqual([{ name: 'Ada', age: 36 }])
    expect(
      await (
        await request('/run/contacts', 'GET', undefined, key.token)
      ).json(),
    ).toEqual([{ name: 'Grace', age: 85 }])
  } finally {
    restored.close()
  }
})

test('generated APIs reject invalid columns and enforce row and response budgets', async () => {
  const { request } = workspace()
  const source = await (
    await request(
      '/api/data-sources/import',
      'POST',
      upload(
        `Name,Notes\n${Array.from({ length: 100 }, (_, index) => `Person${index},${'x'.repeat(3000)}`).join('\n')}`,
      ),
    )
  ).json()
  const valid = {
    name: 'Contacts',
    path: '/contacts',
    protocol: 'rest',
    columns: ['name', 'notes'],
    limit: 100,
  }
  for (const options of [
    { ...valid, columns: [] },
    { ...valid, columns: ['missing'] },
    { ...valid, columns: ['name', 'name'] },
    { ...valid, limit: 101 },
    { ...valid, filter: { column: 'missing', inputName: 'name' } },
    { ...valid, filter: { column: 'name', inputName: 'constructor' } },
  ])
    expect(
      (await request(`/api/data-sources/${source.id}/api`, 'POST', options))
        .status,
    ).toBe(400)
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', valid)
  ).json()
  const oversized = await request(`/api/flows/${flow.id}/test`, 'POST', {
    body: null,
    query: {},
  })
  expect(oversized.status).toBe(400)
  expect((await oversized.json()).error).toContain('response limits')
})
