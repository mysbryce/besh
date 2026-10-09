import { afterEach, expect, test } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { createApp } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const cleanup: (() => Promise<void>)[] = []
const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, options: Bun.WebSocketOptions): WebSocket
}

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

test('first WebSocket publication keeps the original REST listener and its native incoming-frame limit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-ws-runtime-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  const sockets = new Set<WebSocket>()
  cleanup.push(async () => {
    for (const socket of sockets) socket.close()
    server.beginShutdown()
    if (server.app.server) await server.app.stop(true)
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const native = server.app.server!
  const origin = native.url.origin
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const baseline = await (await request('/api/flows', 'POST', helloFlow)).json()
  expect(
    (
      await request(`/api/flows/${baseline.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const oldKey = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Existing REST caller',
      flowId: baseline.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const flow = await (
    await request('/api/flows', 'POST', {
      ...helloFlow,
      name: 'First WebSocket',
      path: '/first-socket',
      nodes: [
        helloFlow.nodes[0],
        { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
      ],
      websocket: { input: fields, output: fields, allowedOrigins: [] },
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  expect(server.app.server).toBe(native)
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code`)
  ).json()
  expect(artifact.endpoint.path).toBe('/ws/first-socket')
  expect(artifact.code).toContain("app.ws('/ws/first-socket'")
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Pinned socket caller',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['ws'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const socket = new NativeWebSocket(
    origin.replace(/^http/, 'ws') + '/ws/first-socket',
    {
      headers: { authorization: `Bearer ${key.token}` },
    },
  )
  sockets.add(socket)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Native socket did not open')),
      5000,
    )
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        reject(new Error('Native upgrade rejected'))
      },
      { once: true },
    )
  })
  const reply = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Native reply did not arrive')),
      5000,
    )
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        try {
          resolve(JSON.parse(String(event.data)))
        } catch {
          reject(new Error('Reply was not JSON'))
        }
      },
      { once: true },
    )
  })
  socket.send(
    JSON.stringify({ id: 'first', body: { message: 'Hello ไทย 🙂' } }),
  )
  expect(await reply).toEqual({
    id: 'first',
    result: { message: 'Hello ไทย 🙂' },
  })
  let oversizedReplies = 0
  socket.addEventListener('message', () => {
    oversizedReplies++
  })
  const closed = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Oversized frame did not close')),
      5000,
    )
    socket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timer)
        resolve(event.code)
      },
      { once: true },
    )
  })
  socket.send(new Uint8Array(32_769))
  expect([1006, 1009]).toContain(await closed)
  expect(oversizedReplies).toBe(0)
  expect(
    await (await request('/run/hello', 'GET', undefined, oldKey.token)).json(),
  ).toEqual({ message: 'Hello, Besh!' })
})

test('REST GraphQL and WebSocket publications keep separate exact route namespaces at the same path', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-ws-namespaces-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(async () => {
    server.beginShutdown()
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
      new Request('http://localhost' + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const definitions = [
    { ...helloFlow, path: '/shared-transport' },
    { ...graphqlFlow, path: '/shared-transport' },
    {
      ...helloFlow,
      path: '/shared-transport',
      websocket: { input: fields, output: fields, allowedOrigins: [] },
      nodes: [
        helloFlow.nodes[0],
        { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
      ],
    },
  ]
  const endpoints: string[] = []
  for (const definition of definitions) {
    const saved = await (await request('/api/flows', 'POST', definition)).json()
    expect(
      (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
    const artifact = await (
      await request(`/api/flows/${saved.id}/backend-code`)
    ).json()
    endpoints.push(artifact.endpoint.path)
  }
  expect(endpoints).toEqual([
    '/run/shared-transport',
    '/graphql/shared-transport',
    '/ws/shared-transport',
  ])
})

function nativeWorkspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-ws-lifecycle-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const options = {
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    runtimeCodeDir: join(directory, 'generated'),
    adminToken: owner,
  }
  const server = createApp(options)
  const sockets = new Set<WebSocket>()
  cleanup.push(async () => {
    for (const socket of sockets) socket.close()
    server.beginShutdown()
    if (server.app.server) await server.app.stop(true)
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const origin = server.app.server!.url.origin
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  async function connect(
    path: string,
    token?: string,
    options: Bun.WebSocketOptions = {},
  ) {
    const socket = new NativeWebSocket(origin.replace(/^http/, 'ws') + path, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
    sockets.add(socket)
    const accepted = await new Promise<boolean>((resolve, reject) => {
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
    return { socket, accepted }
  }
  return { server, request, connect, options, directory, origin }
}

function nativeReply(socket: WebSocket, id: string) {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Native reply did not arrive')),
      5000,
    )
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timer)
        try {
          resolve(JSON.parse(String(event.data)))
        } catch {
          reject(new Error('Native reply must be JSON'))
        }
      },
      { once: true },
    )
    socket.send(JSON.stringify({ id, body: { message: 'Current ไทย 🙂' } }))
  })
}

function nativeClose(socket: WebSocket) {
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Native socket did not close')),
      5000,
    )
    socket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timer)
        resolve(event.code)
      },
      { once: true },
    )
  })
}

test('failed staging preserves an admitted socket, protocol changes close it, and exact rollback permits a fresh pinned connection', async () => {
  const { server, request, connect, options } = nativeWorkspace()
  const native = server.app.server
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const definition = {
    ...helloFlow,
    path: '/lifecycle',
    websocket: { input: fields, output: fields, allowedOrigins: [] },
    nodes: [
      helloFlow.nodes[0],
      { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
    ],
  }
  const flow = await (await request('/api/flows', 'POST', definition)).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code`)
  ).json()
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Lifecycle caller',
      flowId: flow.id,
      releaseRevision: 1,
      permissions: ['ws'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const original = await connect('/ws/lifecycle', key.token)
  expect(original.accepted).toBe(true)
  expect(await nativeReply(original.socket, 'before')).toEqual({
    id: 'before',
    result: { message: 'Current ไทย 🙂' },
  })
  expect(
    (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...helloFlow,
        path: '/lifecycle',
        revision: 1,
      })
    ).status,
  ).toBe(200)
  mkdirSync(options.runtimeCodeDir, { recursive: true })
  rmdirSync(options.runtimeCodeDir)
  writeFileSync(options.runtimeCodeDir, 'Deliberate staging filesystem failure')
  const audit = await (await request('/api/audit')).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(503)
  expect(await (await request('/api/audit')).json()).toEqual(audit)
  expect(
    await (await request(`/api/flows/${flow.id}/backend-code`)).json(),
  ).toEqual(artifact)
  expect(await nativeReply(original.socket, 'after-failure')).toEqual({
    id: 'after-failure',
    result: { message: 'Current ไทย 🙂' },
  })
  rmSync(options.runtimeCodeDir)
  const ended = nativeClose(original.socket)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(await ended).toBe(1008)
  expect((await connect('/ws/lifecycle', key.token)).accepted).toBe(false)
  const restKey = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'REST lifecycle caller',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  expect(
    await (
      await request('/run/lifecycle', 'GET', undefined, restKey.token)
    ).json(),
  ).toEqual({ message: 'Hello, Besh!' })
  expect(
    (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...graphqlFlow,
        path: '/lifecycle',
        revision: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 3 }))
      .status,
  ).toBe(200)
  const queryKey = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'GraphQL lifecycle caller',
      flowId: flow.id,
      permissions: ['query'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  expect(
    await (
      await request(
        '/graphql/lifecycle',
        'POST',
        { query: '{ greet(name: "Ada") { name } }' },
        queryKey.token,
      )
    ).json(),
  ).toEqual({ data: { greet: { name: 'Ada' } } })
  expect(
    (
      await request(`/api/flows/${flow.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 3,
      })
    ).status,
  ).toBe(200)
  expect(
    await (await request(`/api/flows/${flow.id}/backend-code`)).json(),
  ).toEqual(artifact)
  expect(
    (await request('/run/lifecycle', 'GET', undefined, restKey.token)).status,
  ).toBe(404)
  expect(
    (await request('/graphql/lifecycle', 'POST', {}, queryKey.token)).status,
  ).toBe(404)
  const restored = await connect('/ws/lifecycle', key.token)
  expect(restored.accepted).toBe(true)
  expect(await nativeReply(restored.socket, 'rollback')).toEqual({
    id: 'rollback',
    result: { message: 'Current ไทย 🙂' },
  })
  expect(server.app.server).toBe(native)
  expect(original.socket.readyState).toBe(WebSocket.CLOSED)
})

test('restart and downloaded backup reconstruction purge outstanding tickets while retaining exact WebSocket code and pinned credentials', async () => {
  const { server, request, connect, options, directory } = nativeWorkspace()
  const browserOrigin = 'https://product.example'
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const flow = await (
    await request('/api/flows', 'POST', {
      ...helloFlow,
      path: '/restored-socket',
      websocket: {
        input: fields,
        output: fields,
        allowedOrigins: [browserOrigin],
      },
      nodes: [
        helloFlow.nodes[0],
        { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
      ],
    })
  ).json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const artifact = await (
    await request(`/api/flows/${flow.id}/backend-code`)
  ).json()
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Restored caller',
      flowId: flow.id,
      permissions: ['ws'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const mint = () =>
    request(
      '/ws/restored-socket/ticket',
      'POST',
      { revision: 1, origin: browserOrigin },
      key.token,
    )
  const used = await (await mint()).json()
  const pending = await (await mint()).json()
  const original = await connect(used.path, undefined, {
    protocols: [used.protocol, `besh.ticket.${used.ticket}`],
    headers: { origin: browserOrigin },
  })
  expect(original.accepted).toBe(true)
  expect(original.socket.protocol).toBe('besh.ws.v1')
  const backup = await (await request('/api/backups', 'POST', {})).json()
  const archive = await request(`/api/backups/${backup.id}`)
  expect(archive.status).toBe(200)
  const restoredPath = join(directory, 'restored.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await archive.arrayBuffer()))
  const shutdown = nativeClose(original.socket)
  server.beginShutdown()
  expect(await shutdown).toBe(1001)
  await server.app.stop(true)
  await server.close()

  const restarted = createApp(options)
  const restored = createApp({
    ...options,
    databasePath: restoredPath,
    runtimeCodeDir: join(directory, 'restored-code'),
    backupDir: join(directory, 'restored-backups'),
  })
  const sockets = new Set<WebSocket>()
  cleanup.push(async () => {
    for (const socket of sockets) socket.close()
    for (const app of [restarted, restored]) {
      app.beginShutdown()
      if (app.app.server) await app.app.stop(true)
      await app.close()
    }
  })
  for (const app of [restarted, restored]) {
    app.app.listen({ hostname: '127.0.0.1', port: 0 })
    const origin = app.app.server!.url.origin
    const call = (
      path: string,
      method = 'GET',
      body?: unknown,
      token?: string,
    ) =>
      fetch(origin + path, {
        method,
        headers: {
          authorization: `Bearer ${token ?? options.adminToken}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    expect(
      await (await call(`/api/flows/${flow.id}/backend-code`)).json(),
    ).toEqual(artifact)
    expect(
      (await (await call('/api/migrations')).json()).map(
        (item: { version: number }) => item.version,
      ),
    ).toEqual(Array.from({ length: 21 }, (_, index) => index + 1))
    async function browser(receipt: typeof pending) {
      const socket = new NativeWebSocket(
        origin.replace(/^http/, 'ws') + receipt.path,
        {
          protocols: [receipt.protocol, `besh.ticket.${receipt.ticket}`],
          headers: { origin: browserOrigin },
        },
      )
      sockets.add(socket)
      const accepted = await new Promise<boolean>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Restored native upgrade did not settle')),
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
      return { socket, accepted }
    }
    expect((await browser(used)).accepted).toBe(false)
    expect((await browser(pending)).accepted).toBe(false)
    const freshResponse = await call(
      '/ws/restored-socket/ticket',
      'POST',
      { revision: 1, origin: browserOrigin },
      key.token,
    )
    expect(freshResponse.status).toBe(200)
    const fresh = await browser(await freshResponse.json())
    expect(fresh.accepted).toBe(true)
    expect(fresh.socket.protocol).toBe('besh.ws.v1')
    expect(await nativeReply(fresh.socket, 'after-restore')).toEqual({
      id: 'after-restore',
      result: { message: 'Current ไทย 🙂' },
    })
    const audit = JSON.stringify(await (await call('/api/audit')).json())
    expect(audit).not.toContain(key.token)
    expect(audit).not.toContain(pending.ticket)
    expect(audit).not.toContain(used.ticket)
  }
})

test('downloaded backup reconstruction rejects overlapping WebSocket ticket helper routes before opening a listener', async () => {
  const { request, options, directory } = nativeWorkspace()
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const ids: string[] = []
  for (const path of ['/events', '/other-events']) {
    const flow = await (
      await request('/api/flows', 'POST', {
        ...helloFlow,
        path,
        websocket: { input: fields, output: fields, allowedOrigins: [] },
        nodes: [
          helloFlow.nodes[0],
          {
            ...helloFlow.nodes[1],
            config: { status: 200, body: '$input.body' },
          },
        ],
      })
    ).json()
    ids.push(flow.id)
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
  }
  const backup = await (await request('/api/backups', 'POST', {})).json()
  const archive = await request(`/api/backups/${backup.id}`)
  expect(archive.status).toBe(200)
  const path = join(directory, 'overlapping-helper.sqlite')
  writeFileSync(path, new Uint8Array(await archive.arrayBuffer()))
  const fixture = new Database(path)
  try {
    fixture.run(
      "UPDATE flows SET published = json_set(published, '$.path', '/events/ticket') WHERE id = ?",
      [ids[1]!],
    )
    fixture
      .query('DELETE FROM backend_artifacts WHERE flow_id = ?')
      .run(ids[1]!)
  } finally {
    fixture.close()
  }
  let restored: ReturnType<typeof createApp> | undefined
  let failure: unknown
  try {
    restored = createApp({
      ...options,
      databasePath: path,
      runtimeCodeDir: join(directory, 'overlapping-code'),
    })
  } catch (error) {
    failure = error
  }
  if (restored) await restored.close()
  expect(failure).toMatchObject({ status: 503 })
})
