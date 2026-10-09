import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import type { WebSocketTicket } from '../src/websockets/model'

const owner = 'websocket-owner-disposable-credential'
const cleanup: (() => Promise<void>)[] = []
const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, options: Bun.WebSocketOptions): WebSocket
}

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-websocket-'))
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    authOrigin: 'http://localhost',
  })
  const sockets = new Set<WebSocket>()
  cleanup.push(async () => {
    for (const socket of sockets) socket.close()
    server.beginShutdown()
    if (server.app.server) await server.app.stop(true)
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
  return { server, request, sockets }
}

function opened(socket: WebSocket) {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Native upgrade did not settle')),
      5000,
    )
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        resolve(true)
      },
      { once: true },
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        resolve(false)
      },
      { once: true },
    )
  })
}

async function browserSession(
  server: ReturnType<typeof createApp>,
  token = owner,
) {
  const response = await server.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token }),
    }),
  )
  expect(response.status).toBe(200)
  const session = await response.json()
  return {
    cookie: response.headers.get('set-cookie')!.split(';')[0]!,
    csrfToken: session.csrfToken as string,
  }
}

async function draftTicket(
  server: ReturnType<typeof createApp>,
  flowId: string,
  session: Awaited<ReturnType<typeof browserSession>>,
) {
  const response = await server.app.handle(
    new Request(`http://localhost/api/flows/${flowId}/ws/test-ticket`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        cookie: session.cookie,
        'x-besh-csrf': session.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ revision: 1 }),
    }),
  )
  expect(response.status).toBe(200)
  return response.json()
}

function ended(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('WebSocket did not close')),
      5000,
    )
    socket.addEventListener(
      'close',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function reply(socket: WebSocket) {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('WebSocket reply did not arrive')),
      5000,
    )
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        try {
          resolve(JSON.parse(String(event.data)))
        } catch {
          reject(new Error('Expected JSON reply'))
        }
      },
      { once: true },
    )
  })
}

async function publishedCaller(
  request: ReturnType<typeof workspace>['request'],
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
) {
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const response = await request('/api/runtime-keys', 'POST', {
    name: 'Native WebSocket caller',
    flowId: flow.id,
    permissions: ['ws'],
    releaseRevision: 1,
    expiresAt,
  })
  expect(response.status).toBe(200)
  return { flow, key: await response.json() }
}

const echo = {
  name: 'Typed WebSocket reply',
  method: 'GET',
  path: '/v1/events',
  nodes: [
    { id: 'receive', type: 'request', position: { x: 0, y: 0 }, config: {} },
    {
      id: 'reply',
      type: 'response',
      position: { x: 160, y: 0 },
      config: { status: 200, body: '$input.body' },
    },
  ],
  edges: [{ id: 'next', source: 'receive', target: 'reply' }],
}

const fields = {
  type: 'object',
  properties: {
    message: { type: 'string', maxLength: 128 },
    accepted: { type: 'boolean' },
  },
  required: ['message', 'accepted'],
  additionalProperties: false,
}
const websocket = {
  input: fields,
  output: fields,
  allowedOrigins: ['https://product.example'],
}

test('owner saves typed WebSocket metadata without adding transport defaults to existing REST drafts', async () => {
  const { request } = workspace()
  const oldResponse = await request('/api/flows', 'POST', {
    ...echo,
    name: 'Existing REST',
    path: '/existing-rest',
  })
  expect(oldResponse.status).toBe(200)
  const old = await oldResponse.json()
  expect(Object.hasOwn(old, 'websocket')).toBe(false)
  expect(Object.hasOwn(old, 'transport')).toBe(false)

  const created = await request('/api/flows', 'POST', { ...echo, websocket })
  expect(created.status).toBe(200)
  const flow = await created.json()
  expect(flow.websocket).toEqual(websocket)
  const saved = await request(`/api/flows/${flow.id}`)
  expect(saved.status).toBe(200)
  expect((await saved.json()).websocket).toEqual(websocket)
  expect(await (await request(`/api/flows/${old.id}`)).json()).toEqual(old)
})

test('WebSocket drafts reject route parameters and ambiguous literal paths while REST keeps parameter routes', async () => {
  const { request } = workspace()
  for (const path of ['/v1/events/:id', '/v1//events', '/v1/events/', '/']) {
    const rejected = await request('/api/flows', 'POST', {
      ...echo,
      path,
      websocket,
    })
    expect(rejected.status).toBe(400)
  }
  expect(await (await request('/api/flows')).json()).toEqual([])
  const rest = await request('/api/flows', 'POST', {
    ...echo,
    path: '/v1/events/:id',
  })
  expect(rest.status).toBe(200)
  expect((await rest.json()).path).toBe('/v1/events/:id')
})

test('WebSocket drafts cannot also describe GraphQL or REST operation rules', async () => {
  const { request } = workspace()
  for (const incompatible of [
    { graphql: { schema: 'type Query { message: String! }' } },
    { contract: { response: fields } },
    { method: 'POST' },
  ]) {
    const response = await request('/api/flows', 'POST', {
      ...echo,
      websocket,
      ...incompatible,
    })
    expect(response.status).toBe(400)
  }
  expect(await (await request('/api/flows')).json()).toEqual([])
})

test('WebSocket message rules reject untyped or nested shapes and retain flat row-list replies', async () => {
  const { request } = workspace()
  for (const unsupported of [
    { input: { type: 'array', items: fields } },
    { input: { ...fields, properties: { nested: fields }, required: [] } },
    { input: { ...fields, additionalProperties: true } },
    { output: { type: 'string' } },
    { output: { ...fields, nullable: true } },
    { output: { type: 'array', items: { type: 'array', items: fields } } },
    { output: { type: 'array', items: fields, maxItems: 101 } },
  ]) {
    const response = await request('/api/flows', 'POST', {
      ...echo,
      websocket: { ...websocket, ...unsupported },
    })
    expect(response.status).toBe(400)
  }
  expect(await (await request('/api/flows')).json()).toEqual([])
  const output = {
    type: 'array',
    maxItems: 100,
    items: {
      ...fields,
      properties: {
        ...fields.properties,
        message: { type: 'string', nullable: true },
      },
    },
  }
  const supported = await request('/api/flows', 'POST', {
    ...echo,
    websocket: { ...websocket, output },
  })
  expect(supported.status).toBe(200)
  expect((await supported.json()).websocket.output).toEqual(output)
})

test('WebSocket publication rejects literal responses and HTTP statuses while drafts remain editable', async () => {
  const { request } = workspace()
  for (const config of [
    { status: 200, body: { message: 'literal', accepted: true } },
    { status: 201, body: '$input.body' },
    { status: 200, body: '$input.query' },
  ]) {
    const response = await request('/api/flows', 'POST', {
      ...echo,
      nodes: [echo.nodes[0], { ...echo.nodes[1], config }],
      websocket,
    })
    expect(response.status).toBe(200)
    const flow = await response.json()
    const published = await request(`/api/flows/${flow.id}/publish`, 'POST', {
      revision: flow.revision,
    })
    expect(published.status).toBe(400)
    expect(
      (await (await request(`/api/flows/${flow.id}`)).json()).publishedRevision,
    ).toBeNull()
  }
})

test('WebSocket caller keys require their dedicated grant and the current published release pin', async () => {
  const { request } = workspace()
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const settings = {
    name: 'WebSocket caller',
    flowId: flow.id,
    permissions: ['ws'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }
  expect((await request('/api/runtime-keys', 'POST', settings)).status).toBe(
    400,
  )
  const issued = await request('/api/runtime-keys', 'POST', {
    ...settings,
    releaseRevision: 1,
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(key.permissions).toEqual(['ws'])
  expect(key.releaseRevision).toBe(1)
  expect(
    (
      await request('/api/runtime-keys', 'POST', {
        ...settings,
        permissions: ['rest'],
        releaseRevision: 1,
      })
    ).status,
  ).toBe(400)
  expect(
    (await (await request('/api/runtime-keys')).json()).map(
      (item: { id: string }) => item.id,
    ),
  ).toEqual([key.id])
})

test('a pinned WebSocket caller mints a short-lived origin-bound browser ticket without returning its credential', async () => {
  const { request } = workspace()
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Product server',
      flowId: flow.id,
      permissions: ['ws'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const startedAt = Date.now()
  const response = await request(
    '/ws/v1/events/ticket',
    'POST',
    {
      revision: 1,
      origin: 'https://product.example',
    },
    key.token,
  )
  expect(response.status).toBe(200)
  const receipt = await response.json()
  expect(receipt).toMatchObject({
    revision: 1,
    path: '/ws/v1/events',
    protocol: 'besh.ws.v1',
  })
  expect(receipt.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(Date.parse(receipt.expiresAt)).toBeGreaterThan(startedAt)
  expect(Date.parse(receipt.expiresAt)).toBeLessThanOrEqual(Date.now() + 30_000)
  expect(JSON.stringify(receipt)).not.toContain(key.token)
  expect(
    JSON.stringify(await (await request('/api/audit')).json()),
  ).not.toContain(receipt.ticket)
})

test('two browser upgrades racing one published ticket admit one socket and select only the version protocol', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Browser issuer',
      flowId: flow.id,
      permissions: ['ws'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const receipt = await (
    await request(
      '/ws/v1/events/ticket',
      'POST',
      {
        revision: 1,
        origin: 'https://product.example',
      },
      key.token,
    )
  ).json()
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events'
  const pair = [0, 1].map(
    () =>
      new NativeWebSocket(url, {
        protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
        headers: { origin: 'https://product.example' },
      }),
  )
  for (const socket of pair) sockets.add(socket)
  const outcomes = await Promise.all(pair.map(opened))
  expect(outcomes.filter(Boolean)).toHaveLength(1)
  const winner = pair[outcomes.indexOf(true)]!
  expect(winner.protocol).toBe('besh.ws.v1')
  const reply = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Browser reply did not arrive')),
      5000,
    )
    winner.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        try {
          resolve(JSON.parse(String(event.data)))
        } catch {
          reject(new Error('Expected JSON reply'))
        }
      },
      { once: true },
    )
  })
  winner.send(
    JSON.stringify({
      id: 'browser-1',
      body: { message: 'Browser ไทย', accepted: true },
    }),
  )
  expect(await reply).toEqual({
    id: 'browser-1',
    result: { message: 'Browser ไทย', accepted: true },
  })
  const replay = new NativeWebSocket(url, {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: { origin: 'https://product.example' },
  })
  sockets.add(replay)
  expect(await opened(replay)).toBe(false)
})

test('published transport metadata follows the immutable WebSocket release after editing its draft to REST', async () => {
  const { request } = workspace()
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  const publication = await (
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  ).json()
  expect(publication.publishedEndpoint.transport).toBe('websocket')
  const draft = await (
    await request(`/api/flows/${flow.id}`, 'PUT', { ...echo, revision: 1 })
  ).json()
  expect(Object.hasOwn(draft, 'websocket')).toBe(false)
  expect(draft.publishedEndpoint.transport).toBe('websocket')
  const releases = await (
    await request(`/api/flows/${flow.id}/releases`)
  ).json()
  expect(releases[0].endpoint.transport).toBe('websocket')
})

test('workspace browser mints a saved-draft ticket with its live cookie and CSRF proof', async () => {
  const { server, request } = workspace()
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  const login = await server.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: owner }),
    }),
  )
  expect(login.status).toBe(200)
  const session = await login.json()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const response = await server.app.handle(
    new Request(`http://localhost/api/flows/${flow.id}/ws/test-ticket`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        cookie,
        'x-besh-csrf': session.csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ revision: 1 }),
    }),
  )
  expect(response.status).toBe(200)
  const receipt = await response.json()
  expect(receipt).toMatchObject({
    revision: 1,
    path: `/api/flows/${flow.id}/ws/test`,
    protocol: 'besh.ws.v1',
  })
  expect(receipt.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(JSON.stringify(receipt)).not.toContain(cookie)
  expect(JSON.stringify(receipt)).not.toContain(owner)
  expect(JSON.stringify(receipt)).not.toContain(session.csrfToken)
})

test('saved-draft browser upgrade requires its original live session and logout closes the socket', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  const login = await server.app.handle(
    new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: owner }),
    }),
  )
  const session = await login.json()
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const receipt = await (
    await server.app.handle(
      new Request(`http://localhost/api/flows/${flow.id}/ws/test-ticket`, {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie,
          'x-besh-csrf': session.csrfToken,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ revision: 1 }),
      }),
    )
  ).json()
  const socket = new NativeWebSocket(
    server.app.server!.url.toString().replace(/^http/, 'ws') +
      receipt.path.slice(1),
    {
      protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
      headers: { origin: 'http://localhost', cookie },
    },
  )
  sockets.add(socket)
  expect(await opened(socket)).toBe(true)
  expect(socket.protocol).toBe('besh.ws.v1')
  const ended = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Logged-out draft socket remained open')),
      5000,
    )
    socket.addEventListener(
      'close',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
  const logout = await server.app.handle(
    new Request('http://localhost/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        cookie,
        'x-besh-csrf': session.csrfToken,
      },
    }),
  )
  expect(logout.status).toBe(200)
  await ended
  expect(socket.readyState).toBe(WebSocket.CLOSED)
})

test('HTTP examples and OpenAPI reject a saved WebSocket draft while retaining the published REST source', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', echo)).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...echo,
        websocket,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const root = `/api/flows/${flow.id}`
  expect((await request(`${root}/client-code?source=draft`)).status).toBe(400)
  expect(
    (
      await request(`${root}/client-code`, 'POST', {
        source: 'draft',
        revision: 2,
        target: 'javascript-fetch',
        baseUrl: 'https://product.example',
        request: {},
      })
    ).status,
  ).toBe(400)
  expect((await request(`${root}/openapi?source=draft`)).status).toBe(400)
  expect((await request(`${root}/client-code?source=published`)).status).toBe(
    200,
  )
  expect((await request(`${root}/openapi?source=published`)).status).toBe(200)
})

test('HTTP draft test endpoints cannot execute WebSocket message graphs', async () => {
  const { request } = workspace()
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: { message: 'HTTP must not execute this', accepted: true },
        query: {},
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/flows/${flow.id}/graphql/test`, 'POST', {
        query: '{ rows }',
      })
    ).status,
  ).toBe(400)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some((event: { action: string }) =>
      ['flow.tested', 'graphql.tested'].includes(event.action),
    ),
  ).toBe(false)
})

test('HTTP load tests omit WebSocket publications and reject direct starts without creating jobs or keys', async () => {
  const { server, request } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  expect(await (await request('/api/load-tests/targets')).json()).toEqual([])
  const response = await request('/api/load-tests', 'POST', { flowId: flow.id })
  expect(response.status).toBe(400)
  expect((await response.json()).error).toContain('WebSocket')
  expect(await (await request('/api/load-tests')).json()).toEqual([])
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
})

test('draft tickets cannot switch sessions or use invalid explicit authorization and denied upgrades leave the original ticket usable', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  const original = await browserSession(server)
  const other = await browserSession(server)
  const receipt = await draftTicket(server, flow.id, original)
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') +
    receipt.path.slice(1)
  const invalidProofs: Record<string, string>[] = [
    { cookie: other.cookie },
    { authorization: `Bearer ${owner}` },
    { cookie: original.cookie, authorization: 'Bearer invalid-explicit-key' },
    {},
  ]
  for (const headers of invalidProofs) {
    const denied = new NativeWebSocket(url, {
      protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
      headers: { origin: 'http://localhost', ...headers },
    })
    sockets.add(denied)
    expect(await opened(denied)).toBe(false)
  }
  const permitted = new NativeWebSocket(url, {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: { origin: 'http://localhost', cookie: original.cookie },
  })
  sockets.add(permitted)
  expect(await opened(permitted)).toBe(true)
  const consumed = (await (await request('/api/audit')).json()).filter(
    (event: { action: string }) => event.action === 'websocket-ticket.consumed',
  )
  expect(consumed).toHaveLength(1)
  expect(JSON.stringify(consumed)).not.toContain(receipt.ticket)
})

test('rotating a WebSocket caller closes its existing connection and invalidates outstanding tickets while preserving exact scope and expiry', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(request)
  const receipt = await (
    await request(
      '/ws/v1/events/ticket',
      'POST',
      { revision: 1, origin: 'https://product.example' },
      key.token,
    )
  ).json()
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events'
  const original = new NativeWebSocket(url, {
    headers: { authorization: `Bearer ${key.token}` },
  })
  sockets.add(original)
  expect(await opened(original)).toBe(true)
  const closed = ended(original)
  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  expect(response.status).toBe(200)
  const replacement = await response.json()
  expect(replacement).toMatchObject({
    permissions: ['ws'],
    releaseRevision: 1,
    expiresAt: key.expiresAt,
    tenantId: null,
    issuerBinding: null,
  })
  await closed
  const revokedTicket = new NativeWebSocket(url, {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: { origin: 'https://product.example' },
  })
  sockets.add(revokedTicket)
  expect(await opened(revokedTicket)).toBe(false)
  const renewed = new NativeWebSocket(url, {
    headers: { authorization: `Bearer ${replacement.token}` },
  })
  sockets.add(renewed)
  expect(await opened(renewed)).toBe(true)
})

test('WebSocket connection and pending ticket cannot outlive the original runtime key expiry', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(
    request,
    new Date(Date.now() + 1500).toISOString(),
  )
  const response = await request(
    '/ws/v1/events/ticket',
    'POST',
    { revision: 1, origin: 'https://product.example' },
    key.token,
  )
  expect(response.status).toBe(200)
  const receipt = await response.json()
  expect(receipt.expiresAt).toBe(key.expiresAt)
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events'
  const original = new NativeWebSocket(url, {
    headers: { authorization: `Bearer ${key.token}` },
  })
  sockets.add(original)
  expect(await opened(original)).toBe(true)
  await ended(original)
  expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(key.expiresAt))
  const expired = new NativeWebSocket(url, {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: { origin: 'https://product.example' },
  })
  sockets.add(expired)
  expect(await opened(expired)).toBe(false)
})

test('protected WebSocket row replies apply exact server identity before filters and limits and close after issuer reassignment', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const upload = new FormData()
  upload.set('name', 'Exact tenant rows')
  upload.set(
    'file',
    new File(
      [
        'tenant,name,city\n1,Foreign,London\n1.0,Ada,London\n1.0,Grace,London\n',
      ],
      'rows.csv',
    ),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const generated = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Private row replies',
      path: '/private-rows',
      protocol: 'rest',
      columns: ['name'],
      filter: { column: 'city', inputName: 'city' },
      limit: 1,
    })
  ).json()
  const saved = await request(`/api/flows/${generated.id}`, 'PUT', {
    name: generated.name,
    method: 'GET',
    path: '/private-rows',
    revision: 1,
    nodes: generated.nodes.map((node: { type: string; config: object }) =>
      node.type === 'data'
        ? {
            ...node,
            config: {
              ...node.config,
              filter: { column: 'city', value: '$input.body.city' },
            },
          }
        : node,
    ),
    edges: generated.edges,
    websocket: {
      input: {
        type: 'object',
        properties: { city: { type: 'string' }, tenant: { type: 'string' } },
        required: ['city', 'tenant'],
        additionalProperties: false,
      },
      output: {
        type: 'array',
        maxItems: 1,
        items: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false,
        },
      },
      allowedOrigins: [],
    },
  })
  expect(saved.status).toBe(200)
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
  const tenantA = await (
    await request('/api/tenants', 'POST', {
      label: 'Exact decimal tenant',
      value: '1.0',
    })
  ).json()
  const tenantB = await (
    await request('/api/tenants', 'POST', {
      label: 'Integer tenant',
      value: '1',
    })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Scoped WebSocket issuer',
      permissions: ['flows.test', 'runtime-keys.manage'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Protected issuer',
      role: 'custom',
      roleId: role.id,
      tenantId: tenantA.id,
      access: {
        mode: 'selected',
        flowIds: [generated.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${generated.id}/publish`, 'POST', {
        revision: 2,
      })
    ).status,
  ).toBe(200)
  const issuance = await request(
    '/api/runtime-keys',
    'POST',
    {
      name: 'Tenant row caller',
      flowId: generated.id,
      permissions: ['ws'],
      releaseRevision: 2,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    member.token,
  )
  expect(issuance.status).toBe(200)
  const key = await issuance.json()
  expect(key.tenantId).toBe(tenantA.id)
  expect(key.issuerBinding).toEqual({
    memberId: member.id,
    action: 'runtime-keys.manage',
  })
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/private-rows'
  const socket = new NativeWebSocket(url, {
    headers: { authorization: `Bearer ${key.token}` },
  })
  sockets.add(socket)
  expect(await opened(socket)).toBe(true)
  const rows = reply(socket)
  socket.send(
    JSON.stringify({ id: 'private-1', body: { city: 'London', tenant: '1' } }),
  )
  expect(await rows).toEqual({ id: 'private-1', result: [{ name: 'Ada' }] })
  const closed = ended(socket)
  expect(
    (
      await request(`/api/members/${member.id}/tenant`, 'PUT', {
        tenantId: tenantB.id,
        version: 1,
      })
    ).status,
  ).toBe(200)
  await closed
  const stale = new NativeWebSocket(url, {
    headers: { authorization: `Bearer ${key.token}` },
  })
  sockets.add(stale)
  expect(await opened(stale)).toBe(false)
})

test('ticket and connection quotas are bounded and quota-denied upgrades do not consume their ticket', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(request)
  const receipts: WebSocketTicket[] = []
  for (let count = 0; count < 8; count++) {
    const response = await request(
      '/ws/v1/events/ticket',
      'POST',
      { revision: 1, origin: 'https://product.example' },
      key.token,
    )
    expect(response.status).toBe(200)
    receipts.push(await response.json())
  }
  expect(
    (
      await request(
        '/ws/v1/events/ticket',
        'POST',
        { revision: 1, origin: 'https://product.example' },
        key.token,
      )
    ).status,
  ).toBe(429)
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events'
  const connect = (index: number) => {
    const socket = new NativeWebSocket(url, {
      protocols: ['besh.ws.v1', `besh.ticket.${receipts[index]!.ticket}`],
      headers: { origin: 'https://product.example' },
    })
    sockets.add(socket)
    return socket
  }
  const active = []
  for (let index = 0; index < 3; index++) {
    const socket = connect(index)
    expect(await opened(socket)).toBe(true)
    active.push(socket)
  }
  expect(await opened(connect(3))).toBe(false)
  const closed = ended(active[0]!)
  active[0]!.close()
  await closed
  expect(await opened(connect(3))).toBe(true)
  const consumed = (await (await request('/api/audit')).json()).filter(
    (event: { action: string }) => event.action === 'websocket-ticket.consumed',
  )
  expect(consumed).toHaveLength(4)
})

test('ordinary HTTP and wrong-Origin attempts cannot consume a browser WebSocket ticket', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(request)
  const receipt = await (
    await request(
      '/ws/v1/events/ticket',
      'POST',
      { revision: 1, origin: 'https://product.example' },
      key.token,
    )
  ).json()
  const protocols = ['besh.ws.v1', `besh.ticket.${receipt.ticket}`]
  const ordinary = await server.app.handle(
    new Request('http://localhost/ws/v1/events', {
      headers: {
        origin: 'https://product.example',
        'sec-websocket-protocol': protocols.join(', '),
      },
    }),
  )
  expect(ordinary.status).toBe(426)
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events'
  const foreign = new NativeWebSocket(url, {
    protocols,
    headers: { origin: 'https://foreign.example' },
  })
  sockets.add(foreign)
  expect(await opened(foreign)).toBe(false)
  const explicitInvalid = new NativeWebSocket(url, {
    protocols,
    headers: {
      origin: 'https://product.example',
      authorization: 'Bearer invalid-runtime-proof',
    },
  })
  sockets.add(explicitInvalid)
  expect(await opened(explicitInvalid)).toBe(false)
  const permitted = new NativeWebSocket(url, {
    protocols,
    headers: { origin: 'https://product.example' },
  })
  sockets.add(permitted)
  expect(await opened(permitted)).toBe(true)
})

test('invalid typed or binary WebSocket messages return bounded generic errors without values or execution audits and allow a corrected message', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(request)
  const socket = new NativeWebSocket(
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events',
    {
      headers: { authorization: `Bearer ${key.token}` },
    },
  )
  sockets.add(socket)
  expect(await opened(socket)).toBe(true)
  const privateValue = 'private-submitted-message-must-not-be-returned'
  const invalid = [
    JSON.stringify({
      id: 'bad-1',
      body: { message: { privateValue }, accepted: true },
    }),
    JSON.stringify({ id: 'bad-2', body: { message: privateValue } }),
    JSON.stringify({
      id: `bad\n${privateValue}`,
      body: { message: privateValue, accepted: true },
    }),
    new TextEncoder().encode(
      JSON.stringify({
        id: 'binary',
        body: { message: privateValue, accepted: true },
      }),
    ),
    `invalid JSON ${privateValue}`,
  ]
  for (const frame of invalid) {
    const result = reply(socket)
    socket.send(frame)
    const response = await result
    expect(response).toMatchObject({ error: 'WebSocket message failed' })
    expect(JSON.stringify(response)).not.toContain(privateValue)
  }
  const before = await (await request('/api/audit')).json()
  expect(
    before.some(
      (event: { action: string }) => event.action === 'websocket.executed',
    ),
  ).toBe(false)
  await Bun.sleep(1050)
  const corrected = reply(socket)
  socket.send(
    JSON.stringify({
      id: 'corrected',
      body: { message: 'Typed reply ไทย', accepted: false },
    }),
  )
  expect(await corrected).toEqual({
    id: 'corrected',
    result: { message: 'Typed reply ไทย', accepted: false },
  })
  const after = await (await request('/api/audit')).json()
  expect(
    after.filter(
      (event: { action: string }) => event.action === 'websocket.executed',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(after)).not.toContain('Typed reply')
  expect(JSON.stringify(after)).not.toContain(privateValue)
  expect(JSON.stringify(after)).not.toContain(key.token)
})

test('published and saved-draft WebSocket upgrades reject undefined URL query input without consuming a draft ticket', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { flow, key } = await publishedCaller(request)
  const base = server.app.server!.url.toString().replace(/^http/, 'ws')
  const alias = new NativeWebSocket(
    `${base}ws/v1/events?token=unused-query-secret`,
    {
      headers: { authorization: `Bearer ${key.token}` },
    },
  )
  sockets.add(alias)
  expect(await opened(alias)).toBe(false)
  const session = await browserSession(server)
  const receipt = await draftTicket(server, flow.id, session)
  const options = {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: { origin: 'http://localhost', cookie: session.cookie },
  }
  const draftAlias = new NativeWebSocket(
    `${base}${receipt.path.slice(1)}?token=unused-query-secret`,
    options,
  )
  sockets.add(draftAlias)
  expect(await opened(draftAlias)).toBe(false)
  const clean = new NativeWebSocket(`${base}${receipt.path.slice(1)}`, options)
  sockets.add(clean)
  expect(await opened(clean)).toBe(true)
  expect(
    JSON.stringify(await (await request('/api/audit')).json()),
  ).not.toContain('unused-query-secret')
})

test('native draft tickets keep the original member key proof without cookie substitution or flow-read access and close after member deletion', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const flow = await (
    await request('/api/flows', 'POST', { ...echo, websocket })
  ).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Native draft tester',
      permissions: ['flows.test'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'No-read tester',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [],
          authConnections: [],
        },
      },
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}`, 'GET', undefined, member.token))
      .status,
  ).toBe(403)
  const mint = await server.app.handle(
    new Request(`http://localhost/api/flows/${flow.id}/ws/test-ticket`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        authorization: `Bearer ${member.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ revision: 1 }),
    }),
  )
  expect(mint.status).toBe(200)
  const receipt = await mint.json()
  const session = await browserSession(server, member.token)
  const url =
    server.app.server!.url.toString().replace(/^http/, 'ws') +
    receipt.path.slice(1)
  for (const headers of [
    { cookie: session.cookie },
    { authorization: `Bearer ${owner}` },
  ]) {
    const denied = new NativeWebSocket(url, {
      protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
      headers: { origin: 'http://localhost', ...headers },
    })
    sockets.add(denied)
    expect(await opened(denied)).toBe(false)
  }
  const original = new NativeWebSocket(url, {
    protocols: ['besh.ws.v1', `besh.ticket.${receipt.ticket}`],
    headers: {
      origin: 'http://localhost',
      authorization: `Bearer ${member.token}`,
    },
  })
  sockets.add(original)
  expect(await opened(original)).toBe(true)
  const result = reply(original)
  original.send(
    JSON.stringify({
      id: 'native-draft',
      body: { message: 'No-read typed test', accepted: true },
    }),
  )
  expect(await result).toEqual({
    id: 'native-draft',
    result: { message: 'No-read typed test', accepted: true },
  })
  const closed = ended(original)
  expect((await request(`/api/members/${member.id}`, 'DELETE')).status).toBe(
    200,
  )
  await closed
  expect(original.readyState).toBe(WebSocket.CLOSED)
})

test('saving a new draft closes saved-revision sockets and invalidates their pending tickets without changing the published socket', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { flow, key } = await publishedCaller(request)
  const session = await browserSession(server)
  const admitted = await draftTicket(server, flow.id, session)
  const pending = await draftTicket(server, flow.id, session)
  const base = server.app.server!.url.toString().replace(/^http/, 'ws')
  const draft = new NativeWebSocket(base + admitted.path.slice(1), {
    protocols: ['besh.ws.v1', `besh.ticket.${admitted.ticket}`],
    headers: { origin: 'http://localhost', cookie: session.cookie },
  })
  const published = new NativeWebSocket(base + 'ws/v1/events', {
    headers: { authorization: `Bearer ${key.token}` },
  })
  sockets.add(draft)
  sockets.add(published)
  expect(await opened(draft)).toBe(true)
  expect(await opened(published)).toBe(true)
  const closed = ended(draft)
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', { ...echo, revision: 1 }))
      .status,
  ).toBe(200)
  await closed
  const stale = new NativeWebSocket(base + pending.path.slice(1), {
    protocols: ['besh.ws.v1', `besh.ticket.${pending.ticket}`],
    headers: { origin: 'http://localhost', cookie: session.cookie },
  })
  sockets.add(stale)
  expect(await opened(stale)).toBe(false)
  const result = reply(published)
  published.send(
    JSON.stringify({
      id: 'still-published',
      body: { message: 'Immutable live reply', accepted: true },
    }),
  )
  expect(await result).toEqual({
    id: 'still-published',
    result: { message: 'Immutable live reply', accepted: true },
  })
})

test('WebSocket publication rejects browser-ticket route collisions in either direction without changing the existing route or audit', async () => {
  for (const [existingPath, overlappingPath] of [
    ['/ticket-guard', '/ticket-guard/ticket'],
    ['/ticket-guard/ticket', '/ticket-guard'],
  ]) {
    const { request } = workspace()
    const existing = await (
      await request('/api/flows', 'POST', {
        ...echo,
        path: existingPath,
        websocket,
      })
    ).json()
    expect(
      (
        await request(`/api/flows/${existing.id}/publish`, 'POST', {
          revision: 1,
        })
      ).status,
    ).toBe(200)
    const key = await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Existing browser-ticket issuer',
        flowId: existing.id,
        permissions: ['ws'],
        releaseRevision: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    ).json()
    const overlapping = await (
      await request('/api/flows', 'POST', {
        ...echo,
        path: overlappingPath,
        websocket,
      })
    ).json()
    const before = await (await request('/api/audit')).json()
    const rejected = await request(
      `/api/flows/${overlapping.id}/publish`,
      'POST',
      { revision: 1 },
    )
    expect(rejected.status).toBe(409)
    expect(
      (await (await request(`/api/flows/${overlapping.id}`)).json())
        .publishedRevision,
    ).toBeNull()
    expect(await (await request('/api/audit')).json()).toEqual(before)
    expect(
      (
        await request(
          `/ws${existingPath}/ticket`,
          'POST',
          { revision: 1, origin: 'https://product.example' },
          key.token,
        )
      ).status,
    ).toBe(200)
  }
})

test('malformed WebSocket attempts share the five-message rate budget and a corrected message works after its window', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const { key } = await publishedCaller(request)
  const socket = new NativeWebSocket(
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events',
    {
      headers: { authorization: `Bearer ${key.token}` },
    },
  )
  sockets.add(socket)
  expect(await opened(socket)).toBe(true)
  const responses = new Promise<unknown[]>((resolve, reject) => {
    const items: unknown[] = []
    const timer = setTimeout(
      () => reject(new Error('Rate-limited replies did not arrive')),
      5000,
    )
    const receive = (event: MessageEvent) => {
      items.push(JSON.parse(String(event.data)))
      if (items.length === 6) {
        clearTimeout(timer)
        socket.removeEventListener('message', receive)
        resolve(items)
      }
    }
    socket.addEventListener('message', receive)
  })
  for (let count = 0; count < 6; count++) socket.send('malformed-private-frame')
  const errors = await responses
  expect(errors[0]).toEqual({ id: null, error: 'WebSocket message failed' })
  expect(errors[5]).toEqual({
    id: null,
    error: 'WebSocket request limit reached',
  })
  expect(JSON.stringify(errors)).not.toContain('malformed-private-frame')
  expect(
    (await (await request('/api/audit')).json()).some(
      (event: { action: string }) => event.action === 'websocket.executed',
    ),
  ).toBe(false)
  await Bun.sleep(1050)
  const corrected = reply(socket)
  socket.send(
    JSON.stringify({
      id: 'after-window',
      body: { message: 'Corrected after rate window', accepted: true },
    }),
  )
  expect(await corrected).toEqual({
    id: 'after-window',
    result: { message: 'Corrected after rate window', accepted: true },
  })
})

test('changing a protected source policy closes an admitted owner-reviewed WebSocket even when its key remains authorized', async () => {
  const { server, request, sockets } = workspace()
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const upload = new FormData()
  upload.set('name', 'Policy-bound rows')
  upload.set('file', new File(['tenant,name\nA,Ada\nB,Foreign\n'], 'rows.csv'))
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Reviewed tenant',
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
  const flow = await (
    await request('/api/flows', 'POST', {
      ...echo,
      nodes: [
        echo.nodes[0],
        {
          id: 'read',
          type: 'data',
          position: { x: 80, y: 0 },
          config: { sourceId: source.id, columns: ['name'], limit: 1 },
        },
        { ...echo.nodes[1], config: { status: 200, body: '$data' } },
      ],
      edges: [
        { id: 'first', source: 'receive', target: 'read' },
        { id: 'second', source: 'read', target: 'reply' },
      ],
      websocket: {
        input: fields,
        output: {
          type: 'array',
          maxItems: 1,
          items: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
        allowedOrigins: [],
      },
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Reviewed owner caller',
      flowId: flow.id,
      permissions: ['ws'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const socket = new NativeWebSocket(
    server.app.server!.url.toString().replace(/^http/, 'ws') + 'ws/v1/events',
    { headers: { authorization: `Bearer ${key.token}` } },
  )
  sockets.add(socket)
  expect(await opened(socket)).toBe(true)
  const originalRows = reply(socket)
  socket.send(
    JSON.stringify({
      id: 'before-refresh',
      body: { message: 'Rows', accepted: true },
    }),
  )
  expect(await originalRows).toEqual({
    id: 'before-refresh',
    result: [{ name: 'Ada' }],
  })
  const replacement = new FormData()
  replacement.set(
    'file',
    new File(['tenant,name\nA,Eve\nB,Foreign\n'], 'rows.csv'),
  )
  expect(
    (await request(`/api/data-sources/${source.id}/import`, 'PUT', replacement))
      .status,
  ).toBe(200)
  const refreshedRows = reply(socket)
  socket.send(
    JSON.stringify({
      id: 'after-refresh',
      body: { message: 'Rows', accepted: true },
    }),
  )
  expect(await refreshedRows).toEqual({
    id: 'after-refresh',
    result: [{ name: 'Eve' }],
  })
  const closed = ended(socket)
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 2,
      })
    ).status,
  ).toBe(200)
  await closed
  expect(socket.readyState).toBe(WebSocket.CLOSED)
}, 10_000)
