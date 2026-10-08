import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'
import type { K6Runner, LoadTestSummary } from '../src/load-test-model'

const adminToken = 'load-test-owner-token-32-characters-long'
const cleanup: (() => void)[] = []
const summary: LoadTestSummary = {
  requests: 4,
  requestsPerSecond: 2,
  failedRequests: 0,
  checkRate: 1,
  avgMs: 2,
  p95Ms: 3,
  maxMs: 4,
  thresholdsPassed: true,
}

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace(k6Runner?: K6Runner) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-load-test-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken,
    k6Runner,
  }
  const server = createApp(options)
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = adminToken,
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
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
  return { request, server, options }
}

async function published(
  request: ReturnType<typeof workspace>['request'],
  definition: unknown = helloFlow,
) {
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  return flow
}

test('owners select actual published releases while edited and unpublished drafts stay separate', async () => {
  const { request } = workspace()
  const flow = await published(request)
  expect(
    (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...helloFlow,
        name: 'Changed draft',
        method: 'POST',
        path: '/changed',
        revision: 1,
      })
    ).status,
  ).toBe(200)
  await request('/api/flows', 'POST', { ...helloFlow, path: '/unpublished' })
  const response = await request('/api/load-tests/targets')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([
    {
      id: flow.id,
      name: 'Hello API',
      revision: 1,
      method: 'GET',
      path: '/hello',
      graphql: null,
      unavailableReason: null,
    },
  ])
})

async function terminal(
  request: ReturnType<typeof workspace>['request'],
  id: string,
) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const run = await (await request(`/api/load-tests/${id}`)).json()
    if (run.status !== 'running') return run
    await Bun.sleep(10)
  }
  throw new Error('Load test did not finish')
}

test('default runs call the local published API with a temporary scoped key and retain only summary', async () => {
  let token = ''
  let complete!: (value: LoadTestSummary) => void
  const done = new Promise<LoadTestSummary>((resolve) => {
    complete = resolve
  })
  const { request, server } = workspace(async (input) => {
    token = input.token
    const response = await fetch(input.url, {
      headers: { authorization: `Bearer ${input.token}` },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
    return done
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const response = await request('/api/load-tests', 'POST', { flowId: flow.id })
  expect(response.status).toBe(202)
  const run = await response.json()
  expect(run.status).toBe('running')
  expect(run.config).toEqual({
    vus: 1,
    durationSeconds: 5,
    p95Ms: 1000,
    maxErrorRate: 0.01,
    expectedStatus: null,
  })
  complete(summary)
  const finished = await terminal(request, run.id)
  expect(finished.status).toBe('completed')
  expect(finished.summary).toEqual(summary)
  expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
    401,
  )
  expect(
    JSON.stringify(await (await request('/api/load-tests')).json()),
  ).not.toContain(token)
  expect(
    (await (await request('/api/audit')).json()).some(
      (event: { action: string }) => event.action === 'load-test.completed',
    ),
  ).toBe(true)
})

test('load tests reject arbitrary targets, scripts, invalid budgets and unbounded request input', async () => {
  const { request, server } = workspace(async () => summary)
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  for (const extra of [
    { url: 'https://example.com' },
    { headers: { authorization: 'secret' } },
    { script: 'while (true) {}' },
    { config: { vus: 11 } },
    { config: { durationSeconds: 31 } },
    { config: { p95Ms: 0 } },
    { config: { maxErrorRate: 1.1 } },
    { config: { expectedStatus: 199 } },
    { config: { durationSeconds: '5' } },
    { config: { cli: '--unsafe' } },
    { request: { headers: { cookie: 'secret' } } },
    { request: { query: { number: 2 } } },
    {
      request: {
        query: Object.fromEntries(
          Array.from({ length: 65 }, (_, index) => [`key${index}`, 'x']),
        ),
      },
    },
    { request: { body: { invalidGetBody: true } } },
    { request: { graphql: { query: '{anything}' } } },
  ]) {
    expect(
      (await request('/api/load-tests', 'POST', { flowId: flow.id, ...extra }))
        .status,
    ).toBe(400)
  }
  expect((await request('/api/load-tests', 'POST', null)).status).toBe(400)
  expect(
    (
      await request('/api/load-tests', 'POST', {
        flowId: flow.id,
        request: { body: 'x'.repeat(262_145) },
      })
    ).status,
  ).toBe(413)
  expect(await (await request('/api/load-tests')).json()).toEqual([])
})

test('GraphQL load tests validate selected operations and variables against the published schema', async () => {
  const received: string[] = []
  const { request, server } = workspace(async (input) => {
    const response = await fetch(input.url, {
      method: input.method,
      headers: {
        authorization: `Bearer ${input.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input.body),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { greet: { name: 'Ada' } } })
    const opposite = await request(
      '/graphql/hello',
      'POST',
      {
        query:
          received.length === 0
            ? 'mutation { greet(name: "Ada") { name } }'
            : '{ greet(name: "Ada") { name } }',
      },
      input.token,
    )
    expect(opposite.status).toBe(403)
    received.push(input.token)
    return summary
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request, graphqlFlow)
  for (const graphql of [
    undefined,
    { query: '{ missing }' },
    { query: 'subscription { greet(name: "Ada") { name } }' },
    { query: '{ __schema { types { name } } }' },
    {
      query: 'query X($name: String!) { greet(name: $name) { name } }',
      variables: { name: 8 },
    },
    { query: 'query X($name: String!) { greet(name: $name) { name } }' },
    {
      query:
        'query X { greet(name: "Ada") { name } } query Y { greet(name: "Ada") { name } }',
    },
    {
      query: 'query X { greet(name: "Ada") { name } }',
      operationName: 'Other',
    },
    {
      query: `{ ${Array.from({ length: 17 }, (_, i) => `g${i}: greet(name: "Ada") { name }`).join(' ')} }`,
    },
  ]) {
    expect(
      (
        await request('/api/load-tests', 'POST', {
          flowId: flow.id,
          request: { graphql },
        })
      ).status,
    ).toBe(400)
  }
  for (const operation of ['query', 'mutation']) {
    const response = await request('/api/load-tests', 'POST', {
      flowId: flow.id,
      request: {
        graphql: {
          query: `${operation} X($name: String!) { greet(name: $name) { name } }`,
          variables: { name: 'Ada' },
          operationName: 'X',
        },
      },
    })
    expect(response.status).toBe(202)
    const run = await terminal(request, (await response.json()).id)
    expect(run.status).toBe('completed')
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          { query: '{ greet(name: "Ada") { name } }' },
          received.at(-1),
        )
      ).status,
    ).toBe(401)
    expect(JSON.stringify(run)).not.toContain('Ada')
  }
})

test('stopping the HTTP server interrupts pending jobs and immediately revokes their temporary keys', async () => {
  let token = ''
  let signal!: AbortSignal
  const { request, server } = workspace(async (input, abort) => {
    token = input.token
    signal = abort
    return new Promise(() => {})
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const run = await (
    await request('/api/load-tests', 'POST', { flowId: flow.id })
  ).json()
  await server.app.stop(true)
  expect(
    (await (await request(`/api/load-tests/${run.id}`)).json()).status,
  ).toBe('interrupted')
  expect(signal.aborted).toBe(true)
  expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
    401,
  )
})

test('load test request and encoded URL budgets reject input before creating jobs or temporary keys', async () => {
  const { request, server } = workspace(async () => summary)
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request, { ...helloFlow, method: 'POST' })
  for (const input of [
    { body: 'x'.repeat(16_385) },
    { body: '界'.repeat(6000) },
    { query: { q: '界'.repeat(2000) } },
    { query: { q: ' '.repeat(4096), other: ' '.repeat(4096) } },
  ]) {
    expect(
      (
        await request('/api/load-tests', 'POST', {
          flowId: flow.id,
          request: input,
        })
      ).status,
    ).toBe(400)
  }
  expect(await (await request('/api/load-tests')).json()).toEqual([])
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
})

test('load test routes enforce owner roles, runtime separation and cookie CSRF checks', async () => {
  const { request, server } = workspace(async () => new Promise(() => {}))
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const run = await (
    await request('/api/load-tests', 'POST', { flowId: flow.id })
  ).json()
  const runtime = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Application',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const credentials = ['', runtime.token]
  for (const role of ['editor', 'viewer']) {
    const member = await (
      await request('/api/members', 'POST', { name: role, role })
    ).json()
    credentials.push(member.token)
  }
  for (const token of credentials) {
    const status = token === '' || token === runtime.token ? 401 : 403
    for (const [path, method, body] of [
      ['/api/load-tests/targets', 'GET'],
      ['/api/load-tests', 'GET'],
      [`/api/load-tests/${run.id}`, 'GET'],
      ['/api/load-tests', 'POST', { flowId: flow.id }],
      [`/api/load-tests/${run.id}/cancel`, 'POST'],
    ] as const)
      expect((await request(path, method, body, token)).status).toBe(status)
  }
  const origin = 'http://127.0.0.1:5173'
  const login = await server.app.handle(
    new Request(`${origin}/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ token: adminToken }),
    }),
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const session = await login.json()
  const cancel = (headers: Record<string, string>) =>
    server.app.handle(
      new Request(`${origin}/api/load-tests/${run.id}/cancel`, {
        method: 'POST',
        headers: { cookie, origin, ...headers },
      }),
    )
  expect((await cancel({})).status).toBe(403)
  expect(
    (
      await cancel({
        'x-besh-csrf': session.csrfToken,
        origin: 'https://evil.example',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await cancel({
        'x-besh-csrf': session.csrfToken,
        authorization: 'Bearer invalid',
      })
    ).status,
  ).toBe(401)
  expect((await cancel({ 'x-besh-csrf': session.csrfToken })).status).toBe(200)
})

test('REST load tests support every published method and safely encoded query and optional body', async () => {
  let responseStatus = 0
  let responseBody: unknown
  const { request, server } = workspace(async (input) => {
    const response = await fetch(input.url, {
      method: input.method,
      headers: {
        authorization: `Bearer ${input.token}`,
        'content-type': 'application/json',
      },
      ...(input.body === null ? {} : { body: JSON.stringify(input.body) }),
    })
    responseStatus = response.status
    const text = await response.text()
    responseBody = text ? JSON.parse(text) : null
    return summary
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  for (const method of [
    'OPTIONS',
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
  ]) {
    const flow = await published(request, {
      ...helloFlow,
      method,
      path: `/method-${method}`,
      nodes: [
        helloFlow.nodes[0],
        {
          ...helloFlow.nodes[1],
          config: {
            status: 200,
            body: { query: '$input.query.q', body: '$input.body' },
          },
        },
      ],
    })
    const body = ['GET', 'HEAD', 'OPTIONS'].includes(method)
      ? null
      : { example: 'Sensitive input' }
    const response = await request('/api/load-tests', 'POST', {
      flowId: flow.id,
      config: {
        vus: 2,
        durationSeconds: 1,
        p95Ms: 50,
        maxErrorRate: 0,
        expectedStatus: 200,
      },
      request: { body, query: { q: 'quotes " & /? Unicode 界' } },
    })
    expect(response.status).toBe(202)
    const run = await terminal(request, (await response.json()).id)
    expect({ method, responseStatus }).toEqual({ method, responseStatus: 200 })
    if (method !== 'HEAD')
      expect({ method, responseBody }).toEqual({
        method,
        responseBody: { query: 'quotes " & /? Unicode 界', body },
      })
    expect(run.status).toBe('completed')
    expect(run.method).toBe(method)
    expect(JSON.stringify(run)).not.toContain('Sensitive input')
    expect(JSON.stringify(run)).not.toContain('Unicode')
  }
})

test('cancel immediately revokes access and late subprocess results cannot overwrite terminal jobs', async () => {
  let token = ''
  let abort!: AbortSignal
  let complete!: (value: LoadTestSummary) => void
  const { request, server } = workspace(async (input, signal) => {
    token = input.token
    abort = signal
    return new Promise((resolve) => {
      complete = resolve
    })
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const run = await (
    await request('/api/load-tests', 'POST', { flowId: flow.id })
  ).json()
  expect(
    (await request('/api/load-tests', 'POST', { flowId: flow.id })).status,
  ).toBe(409)
  expect(
    (await request(`/api/load-tests/${run.id}/cancel`, 'POST')).status,
  ).toBe(200)
  expect(abort.aborted).toBe(true)
  expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
    401,
  )
  complete(summary)
  await Bun.sleep(10)
  expect((await terminal(request, run.id)).status).toBe('canceled')
  expect(
    (await request(`/api/load-tests/${run.id}/cancel`, 'POST')).status,
  ).toBe(200)
  const audits = await (await request('/api/audit')).json()
  expect(
    audits
      .filter(
        (event: { action: string; resource: string }) =>
          event.resource === run.id,
      )
      .map((event: { action: string }) => event.action)
      .sort(),
  ).toEqual(['load-test.canceled', 'load-test.started'])
})

test('failed subprocesses redact error logs, revoke keys and allow the next run', async () => {
  let token = ''
  const { request, server } = workspace(async (input) => {
    token = input.token
    throw new Error(
      `SECRET-PROCESS-LOG ${input.token} ${JSON.stringify(input.body)}`,
    )
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request, { ...helloFlow, method: 'POST' })
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request('/api/load-tests', 'POST', {
      flowId: flow.id,
      request: { body: { confidential: 'NEVER-PERSIST-PAYLOAD' } },
    })
    expect(response.status).toBe(202)
    const run = await terminal(request, (await response.json()).id)
    expect(run.status).toBe('failed')
    expect(run.error).not.toContain('SECRET-PROCESS-LOG')
    expect((await request('/run/hello', 'POST', {}, token)).status).toBe(401)
    expect(
      (await request(`/api/load-tests/${run.id}/cancel`, 'POST')).status,
    ).toBe(409)
  }
  const history = JSON.stringify(
    await (await request('/api/load-tests')).json(),
  )
  const audit = JSON.stringify(await (await request('/api/audit')).json())
  for (const secret of [token, 'NEVER-PERSIST-PAYLOAD', 'SECRET-PROCESS-LOG']) {
    expect(history).not.toContain(secret)
    expect(audit).not.toContain(secret)
  }
})

test('REST load test input must satisfy the actual published request rules before keys are issued', async () => {
  const { request, server } = workspace(async () => summary)
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const definition = {
    ...helloFlow,
    method: 'POST',
    contract: {
      body: {
        type: 'object',
        properties: { name: { type: 'string', maxLength: 10 } },
        required: ['name'],
        additionalProperties: false,
      },
      query: {
        type: 'object',
        properties: { count: { type: 'integer', minimum: 1 } },
        required: ['count'],
        additionalProperties: false,
      },
    },
  }
  const flow = await published(request, definition)
  for (const input of [
    {},
    { body: { name: 'Ada' }, query: { count: '0' } },
    { body: { name: 9 }, query: { count: '1' } },
    {
      body: { name: 'Ada', extra: 'NEVER-RETURN-VALUE' },
      query: { count: '1' },
    },
  ]) {
    const response = await request('/api/load-tests', 'POST', {
      flowId: flow.id,
      request: input,
    })
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('NEVER-RETURN-VALUE')
  }
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  const response = await request('/api/load-tests', 'POST', {
    flowId: flow.id,
    request: { body: { name: 'Ada' }, query: { count: '1' } },
  })
  expect(response.status).toBe(202)
  expect((await terminal(request, (await response.json()).id)).status).toBe(
    'completed',
  )
})

test('only one load test can start across two real workspace connections', async () => {
  const { request, server, options } = workspace(
    async () => new Promise(() => {}),
  )
  const other = createApp(options)
  cleanup.push(() => {
    other.close()
    if (other.app.server) void other.app.stop(true)
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  other.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const responses = await Promise.all([
    request('/api/load-tests', 'POST', { flowId: flow.id }),
    other.app.handle(
      new Request('http://localhost/api/load-tests', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ flowId: flow.id }),
      }),
    ),
  ])
  expect(responses.map((response) => response.status).sort()).toEqual([
    202, 409,
  ])
  expect(await (await request('/api/load-tests')).json()).toHaveLength(1)
  expect(await (await request('/api/runtime-keys')).json()).toHaveLength(1)
})

test('restarting and restoring a backup interrupt pending runs while retaining secret-free history', async () => {
  let token = ''
  const { request, server, options } = workspace(async (input) => {
    token = input.token
    return new Promise(() => {})
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request, { ...helloFlow, method: 'POST' })
  const run = await (
    await request('/api/load-tests', 'POST', {
      flowId: flow.id,
      request: {
        body: 'NEVER-PERSIST-INPUT',
        query: { secret: 'NEVER-PERSIST-QUERY' },
      },
    })
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const downloaded = await (
    await request(`/api/backups/${backup.id}`)
  ).arrayBuffer()
  const bytes = Buffer.from(downloaded)
  for (const sensitive of [token, 'NEVER-PERSIST-INPUT', 'NEVER-PERSIST-QUERY'])
    expect(bytes.includes(Buffer.from(sensitive))).toBe(false)
  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, bytes)
  const restored = createApp({ ...options, databasePath: restoredPath })
  cleanup.push(() => restored.close())
  const restoredRequest = (path: string) =>
    restored.app.handle(
      new Request(`http://localhost${path}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    )
  const interrupted = await (
    await restoredRequest(`/api/load-tests/${run.id}`)
  ).json()
  expect(interrupted.status).toBe('interrupted')
  expect(interrupted.finishedAt).toBeString()
  expect(interrupted.flowName).toBe('Hello API')
  expect(
    (
      await restored.app.handle(
        new Request('http://localhost/run/hello', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        }),
      )
    ).status,
  ).toBe(401)
  const audit = await (await restoredRequest('/api/audit')).json()
  expect(
    audit
      .filter((event: { resource: string }) => event.resource === run.id)
      .map((event: { action: string }) => event.action)
      .sort(),
  ).toEqual(['load-test.interrupted', 'load-test.started'])
  server.close()
  const restarted = createApp(options)
  cleanup.push(() => restarted.close())
  const restartedRun = await (
    await restarted.app.handle(
      new Request(`http://localhost/api/load-tests/${run.id}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    )
  ).json()
  expect(restartedRun.status).toBe('interrupted')
})

test('load tests require a listening app and derive targets from its real loopback port', async () => {
  let targetUrl = ''
  const { request, server } = workspace(async (input) => {
    targetUrl = input.url
    return summary
  })
  const flow = await published(request)
  expect(
    (await request('/api/load-tests', 'POST', { flowId: flow.id })).status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const response = await server.app.handle(
    new Request('https://attacker.example/api/load-tests', {
      method: 'POST',
      headers: {
        host: 'attacker.example',
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ flowId: flow.id }),
    }),
  )
  expect(response.status).toBe(202)
  expect((await terminal(request, (await response.json()).id)).status).toBe(
    'completed',
  )
  expect(targetUrl).toBe(
    `http://127.0.0.1:${server.app.server!.port}/run/hello`,
  )
})

test('published product login APIs explain why automatic repeated OAuth is unavailable', async () => {
  const { request, server } = workspace(async () => summary)
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const connection = await (
    await request('/api/auth-connections', 'POST', {
      name: 'Product GitHub',
      provider: 'github',
      clientId: 'test-client',
      clientSecret: 'private-provider-secret',
      redirectUri: 'https://product.example/oauth/github',
    })
  ).json()
  const flow = await (
    await request(`/api/auth-connections/${connection.id}/generate`, 'POST', {
      name: 'Product login',
      path: '/login',
      kind: 'rest',
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const targets = await (await request('/api/load-tests/targets')).json()
  expect(targets[0].unavailableReason).toBe(
    'Product login APIs cannot be load tested automatically',
  )
  const response = await request('/api/load-tests', 'POST', {
    flowId: flow.id,
    request: { body: { action: 'BEGIN' } },
  })
  expect(response.status).toBe(400)
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  expect(await (await request('/api/load-tests')).json()).toEqual([])
})

test('temporary load test credentials cannot be replaced into a token disclosed through management', async () => {
  const { request, server } = workspace(async () => new Promise(() => {}))
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const run = await (
    await request('/api/load-tests', 'POST', { flowId: flow.id })
  ).json()
  const keys = await (await request('/api/runtime-keys')).json()
  const response = await request(
    `/api/runtime-keys/${keys[0].id}/rotate`,
    'POST',
  )
  expect(response.status).toBe(409)
  expect(await response.json()).not.toHaveProperty('token')
  expect(await (await request('/api/runtime-keys')).json()).toHaveLength(1)
  expect(
    (await request(`/api/load-tests/${run.id}/cancel`, 'POST')).status,
  ).toBe(200)
})

test('runtime key metadata identifies managed load test keys without relying on their names', async () => {
  let token = ''
  const { request, server } = workspace(async (input) => {
    token = input.token
    return new Promise(() => {})
  })
  server.app.listen({ port: 0, hostname: '127.0.0.1' })
  const flow = await published(request)
  const ordinary = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Load test ordinary application',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const run = await (
    await request('/api/load-tests', 'POST', { flowId: flow.id })
  ).json()
  const keys = await (await request('/api/runtime-keys')).json()
  const managed = keys.find((key: { id: string }) => key.id !== ordinary.id)
  expect(managed.managedBy).toBe('load-test')
  expect(
    keys.find((key: { id: string }) => key.id === ordinary.id),
  ).not.toHaveProperty('managedBy')
  expect(JSON.stringify(keys)).not.toContain(token)
  expect(JSON.stringify(keys)).not.toContain('token_hash')
  await request(`/api/load-tests/${run.id}/cancel`, 'POST')
  const canceledKeys = await (await request('/api/runtime-keys')).json()
  expect(
    canceledKeys.find((key: { id: string }) => key.id === managed.id),
  ).toMatchObject({ managedBy: 'load-test', revokedAt: expect.any(String) })
})
