import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'

const owner = 'client-code-owner-credential-disposable'
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-client-code-'))
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(async () => {
    if (server.app.server) await server.app.stop()
    await server.close()
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
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  return { server, request }
}

const definition = {
  name: 'Echo API',
  method: 'POST',
  path: '/v1/echo/:id',
  nodes: [
    { id: 'request', type: 'request', position: { x: 0, y: 0 }, config: {} },
    {
      id: 'response',
      type: 'response',
      position: { x: 1, y: 1 },
      config: { status: 200, body: '$input.body' },
    },
  ],
  edges: [{ id: 'edge', source: 'request', target: 'response' }],
}

test('member generates Fetch example from the immutable published revision and receives safe source metadata', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...definition,
    path: '/draft-only',
    revision: 1,
  })
  const metadata = await request(`/api/flows/${flow.id}/client-code`)
  expect(metadata.status).toBe(200)
  expect(await metadata.json()).toMatchObject({
    source: 'published',
    revision: 1,
    path: '/v1/echo/:id',
    method: 'POST',
  })
  const response = await request(`/api/flows/${flow.id}/client-code`, 'POST', {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test/prefix',
    request: {
      params: { id: '東京 %2F' },
      query: { q: 'a & b' },
      body: { ok: true, count: 3, empty: null },
    },
  })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result).toMatchObject({
    source: 'published',
    revision: 1,
    target: 'javascript-fetch',
    method: 'POST',
    filename: 'request.mjs',
    contentType: 'text/plain',
    url: 'https://example.test/prefix/run/v1/echo/%E6%9D%B1%E4%BA%AC%20%252F?q=a+%26+b',
  })
  expect(result.code).toContain('BESH_RUNTIME_API_KEY')
  expect(result.code).toContain("fetch('https://example.test/")
  expect(result.code).not.toContain(owner)
  expect(result.code).not.toContain('/draft-only')
})

test('client-code catalog targets generate dependency-labeled examples without copying workspace credentials', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const catalog = await (await request('/api/client-code/targets')).json()
  expect(catalog.map((target: { id: string }) => target.id)).toEqual([
    'javascript-axios',
    'javascript-fetch',
    'php-curl',
    'curl',
    'rust-reqwest',
    'go-net-http',
    'java-http-client',
    'cpp-libcurl',
  ])
  for (const target of catalog) {
    const response = await request(
      `/api/flows/${flow.id}/client-code`,
      'POST',
      {
        target: target.id,
        revision: 1,
        baseUrl: 'https://example.test',
        request: {
          params: { id: 'one' },
          body: {
            text: 'quotes \'" ` ${injection} \\ 東京\n\r\t',
            scalar: null,
          },
        },
      },
    )
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.dependencies.length).toBeGreaterThan(0)
    expect(result.code).toContain('BESH_RUNTIME_API_KEY')
    expect(result.code).not.toContain(owner)
    expect(result.code).not.toContain('$input.body')
    expect(result.filename).toBe(target.filename)
  }
})

test('GraphQL examples validate the selected schema, operation and exact typed variables without executing the flow', async () => {
  const { request } = workspace()
  const gql = {
    ...definition,
    path: '/graphql-echo',
    graphql: {
      schema:
        'type Query { echo(text: String!, count: Int!): String! } type Mutation { echo(text: String!, count: Int!): String! }',
    },
  }
  const flow = await (await request('/api/flows', 'POST', gql)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const input = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test',
    request: {
      graphql: {
        query:
          'query Read($text: String!, $count: Int!) { echo(text:$text,count:$count) } mutation Write($text: String!, $count: Int!) { echo(text:$text,count:$count) }',
        variables: { text: '東京 "quoted"\n', count: 3 },
        operationName: 'Write',
      },
    },
  }
  const before = await (await request('/api/audit')).json()
  const response = await request(
    `/api/flows/${flow.id}/client-code`,
    'POST',
    input,
  )
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.url).toBe('https://example.test/graphql/graphql-echo')
  expect(result.code).toContain('Write')
  expect(result.code).toContain('application/json')
  expect(await (await request('/api/audit')).json()).toEqual(before)
  for (const graphql of [
    { ...input.request.graphql, operationName: undefined },
    { ...input.request.graphql, variables: { text: 'ok', count: '3' } },
    { ...input.request.graphql, query: '{ missing }' },
    { query: '{ __schema { types { name } } }' },
  ])
    expect(
      (
        await request(`/api/flows/${flow.id}/client-code`, 'POST', {
          ...input,
          request: { graphql },
        })
      ).status,
    ).toBe(400)
})

test('PHP Java and C++ examples keep caller JSON readable without executable interpolation', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  for (const target of ['php-curl', 'java-http-client', 'cpp-libcurl']) {
    const response = await request(
      `/api/flows/${flow.id}/client-code`,
      'POST',
      {
        target,
        revision: 1,
        baseUrl: 'https://example.test',
        request: {
          params: { id: 'one' },
          body: {
            text: 'example-readability 東京 \' " ${attack} \\u000a )besh0"',
          },
        },
      },
    )
    expect(response.status).toBe(200)
    expect((await response.json()).code).toContain('example-readability')
  }
})

test('code generation rejects unsafe base URLs, unexpected fields and stale source revisions', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  expect((await request(`/api/flows/${flow.id}/client-code`)).status).toBe(404)
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const input = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test',
    request: { params: { id: 'one' } },
  }
  for (const baseUrl of [
    'file:///tmp/example',
    'ftp://example.test',
    'https://user:secret@example.test',
    'https://example.test?q=secret',
    'https://example.test#secret',
    'https://example.test?',
    'https://example.test#',
    'https://example.test\r\nX-Test:injection',
  ])
    expect(
      (
        await request(`/api/flows/${flow.id}/client-code`, 'POST', {
          ...input,
          baseUrl,
        })
      ).status,
    ).toBe(400)
  for (const extra of [
    { target: 'python' },
    { revision: -1 },
    { revision: 1.5 },
    { token: owner },
    { headers: { authorization: owner } },
    { source: 'archive' },
    { request: { ...input.request, sql: 'SELECT secret' } },
  ])
    expect(
      (
        await request(`/api/flows/${flow.id}/client-code`, 'POST', {
          ...input,
          ...extra,
        })
      ).status,
    ).toBe(400)
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...definition,
    path: '/saved-draft',
    revision: 1,
  })
  expect(
    (
      await request(`/api/flows/${flow.id}/client-code`, 'POST', {
        ...input,
        source: 'draft',
      })
    ).status,
  ).toBe(409)
  const draft = await request(`/api/flows/${flow.id}/client-code`, 'POST', {
    ...input,
    source: 'draft',
    revision: 2,
    request: {},
  })
  expect(draft.status).toBe(200)
  expect(await draft.json()).toMatchObject({
    source: 'draft',
    revision: 2,
    url: 'https://example.test/run/saved-draft',
    warnings: [
      'Publish this saved revision first. The current live release may differ.',
    ],
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  expect(
    (await request(`/api/flows/${flow.id}/client-code`, 'POST', input)).status,
  ).toBe(409)
  expect(
    (
      await request(
        `/api/flows/${flow.id}/client-code?source=draft&source=published`,
      )
    ).status,
  ).toBe(400)
})

test('examples require current flow-read grants and cookie CSRF without persisting example inputs', async () => {
  const { request, server } = workspace()
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Example readers',
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
  const input = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test',
    request: {
      params: { id: 'one' },
      body: { secretExample: 'PRIVATE-EXAMPLE-NOT-HISTORY' },
    },
  }
  const metadata = await (
    await request(
      `/api/flows/${flow.id}/client-code`,
      'GET',
      undefined,
      member.token,
    )
  ).json()
  expect(metadata).not.toHaveProperty('nodes')
  expect(
    (
      await request(
        `/api/flows/${flow.id}/client-code`,
        'POST',
        input,
        member.token,
      )
    ).status,
  ).toBe(200)
  const login = await server.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: member.token }),
    }),
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  const cookieRequest = (csrf?: string) =>
    server.app.handle(
      new Request(`http://localhost/api/flows/${flow.id}/client-code`, {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie,
          'content-type': 'application/json',
          ...(csrf ? { 'x-besh-csrf': csrf } : {}),
        },
        body: JSON.stringify(input),
      }),
    )
  expect((await cookieRequest()).status).toBe(403)
  expect((await cookieRequest(session.csrfToken)).status).toBe(200)
  await request(`/api/roles/${role.id}`, 'PUT', {
    name: role.name,
    version: role.version,
    permissions: [],
  })
  expect((await cookieRequest(session.csrfToken)).status).toBe(401)
  for (const path of [
    '/api/client-code/targets',
    `/api/flows/${flow.id}/client-code`,
  ])
    expect((await request(path, 'GET', undefined, member.token)).status).toBe(
      403,
    )
  expect(
    (
      await request(
        `/api/flows/${flow.id}/client-code`,
        'POST',
        input,
        member.token,
      )
    ).status,
  ).toBe(403)
  expect(
    JSON.stringify(await (await request('/api/audit')).json()),
  ).not.toContain('PRIVATE-EXAMPLE-NOT-HISTORY')
  expect(
    JSON.stringify(await (await request('/api/flows')).json()),
  ).not.toContain('PRIVATE-EXAMPLE-NOT-HISTORY')
})

test('REST rules reject missing or mistyped example inputs and output is bounded before return', async () => {
  const { request } = workspace()
  const typed = {
    ...definition,
    contract: {
      params: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
      query: {
        type: 'object',
        properties: { active: { type: 'boolean' } },
        required: ['active'],
        additionalProperties: false,
      },
      body: {
        type: 'object',
        properties: { count: { type: 'integer' } },
        required: ['count'],
        additionalProperties: false,
      },
    },
  }
  const flow = await (await request('/api/flows', 'POST', typed)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const input = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test',
    request: {
      params: { id: '3' },
      query: { active: 'true' },
      body: { count: 3 },
    },
  }
  expect(
    (await request(`/api/flows/${flow.id}/client-code`, 'POST', input)).status,
  ).toBe(200)
  for (const example of [
    { ...input.request, params: {} },
    { ...input.request, params: { id: '../escape' } },
    { ...input.request, query: {} },
    { ...input.request, query: { active: '1' } },
    { ...input.request, body: { count: '3' } },
    { ...input.request, body: null },
  ])
    expect(
      (
        await request(`/api/flows/${flow.id}/client-code`, 'POST', {
          ...input,
          request: example,
        })
      ).status,
    ).toBe(400)
  const untyped = await (
    await request('/api/flows', 'POST', { ...definition, path: '/bounded' })
  ).json()
  await request(`/api/flows/${untyped.id}/publish`, 'POST', { revision: 1 })
  expect(
    (
      await request(`/api/flows/${untyped.id}/client-code`, 'POST', {
        ...input,
        request: { body: 'x'.repeat(70000) },
      })
    ).status,
  ).toBe(413)
  expect(
    (
      await request(`/api/flows/${untyped.id}/client-code`, 'POST', {
        ...input,
        request: { body: 'x'.repeat(300000) },
      })
    ).status,
  ).toBe(413)
})

test('all REST methods preserve absent bodies and JSON scalar bodies while HEAD examples reject bodies', async () => {
  const { request } = workspace()
  const catalog = await (await request('/api/client-code/targets')).json()
  for (const method of [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ]) {
    const flow = await (
      await request('/api/flows', 'POST', {
        ...definition,
        method,
        path: '/methods',
      })
    ).json()
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
    for (const target of catalog) {
      const response = await request(
        `/api/flows/${flow.id}/client-code`,
        'POST',
        { target: target.id, revision: 1, baseUrl: 'https://example.test' },
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        method,
        url: 'https://example.test/run/methods',
      })
    }
    for (const body of [null, true, 3, 'literal', [false, null, 0]]) {
      const response = await request(
        `/api/flows/${flow.id}/client-code`,
        'POST',
        {
          target: 'javascript-fetch',
          revision: 1,
          baseUrl: 'https://example.test',
          request: { body },
        },
      )
      expect(response.status).toBe(['GET', 'HEAD'].includes(method) ? 400 : 200)
    }
  }
})

test('GraphQL examples reject combined REST input and operations over runtime depth/root budgets', async () => {
  const { request } = workspace()
  const schema =
    'type Branch { value: String branch: Branch } type Query { branch: Branch echo: String }'
  const flow = await (
    await request('/api/flows', 'POST', {
      ...definition,
      path: '/gql-limits',
      graphql: { schema },
    })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const input = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'https://example.test',
  }
  const depth =
    '{ branch { ' + 'branch { '.repeat(12) + 'value' + ' }'.repeat(13) + ' }'
  const roots =
    '{ ' +
    Array.from({ length: 17 }, (_, index) => `root${index}: echo`).join(' ') +
    ' }'
  for (const example of [
    { body: null, graphql: { query: '{ echo }' } },
    { query: { q: 'value' }, graphql: { query: '{ echo }' } },
    { graphql: { query: depth } },
    { graphql: { query: roots } },
  ])
    expect(
      (
        await request(`/api/flows/${flow.id}/client-code`, 'POST', {
          ...input,
          request: example,
        })
      ).status,
    ).toBe(400)
})
