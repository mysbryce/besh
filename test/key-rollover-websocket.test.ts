import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow } from './fixtures'

const cleanup: (() => Promise<void>)[] = []
const browserOrigin = 'https://product.example'
const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, options: Bun.WebSocketOptions): WebSocket
}

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-key-rollover-ws-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  server.app.listen({ hostname: '127.0.0.1', port: 0 })
  const origin = server.app.server!.url.origin
  const sockets = new Set<WebSocket>()
  cleanup.push(async () => {
    for (const socket of sockets) socket.close()
    server.beginShutdown()
    await server.app.stop(true)
    await server.close()
    const target = resolve(directory)
    if (
      !target.startsWith(resolve(tmpdir()) + sep) ||
      !target.includes(`${sep}besh-key-rollover-ws-`)
    )
      throw new Error('Refusing unsafe test cleanup')
    rmSync(target, { recursive: true, force: true, maxRetries: 5 })
  })

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

  async function open(options: Bun.WebSocketOptions) {
    const socket = new NativeWebSocket(
      origin.replace(/^http/, 'ws') + '/ws/rollover-messages',
      options,
    )
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

  return { request, open }
}

async function exchange(socket: WebSocket, id: string) {
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
          reject(new Error('Native reply must be JSON'))
        }
      },
      { once: true },
    )
  })
  socket.send(
    JSON.stringify({ id, body: { message: 'Original proof ไทย 🙂' } }),
  )
  expect(await reply).toEqual({
    id,
    result: { message: 'Original proof ไทย 🙂' },
  })
}

function closed(socket: WebSocket) {
  return new Promise<{ code: number; at: number }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Retiring native socket did not close')),
      6000,
    )
    socket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timer)
        resolve({ code: event.code, at: Date.now() })
      },
      { once: true },
    )
  })
}

async function publishedKey(request: ReturnType<typeof workspace>['request']) {
  const fields = {
    type: 'object',
    properties: { message: { type: 'string', maxLength: 128 } },
    required: ['message'],
    additionalProperties: false,
  }
  const saved = await request('/api/flows', 'POST', {
    ...helloFlow,
    path: '/rollover-messages',
    nodes: [
      helloFlow.nodes[0],
      { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
    ],
    websocket: {
      input: fields,
      output: fields,
      allowedOrigins: [browserOrigin],
    },
  })
  expect(saved.status).toBe(200)
  const flow = await saved.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Original pinned message caller',
    flowId: flow.id,
    releaseRevision: 1,
    permissions: ['ws'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  return { flow, key: await issued.json() }
}

test('native browser ticket expires within its original retiring credential window', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const replaced = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 2,
  })
  expect(replaced.status).toBe(200)
  const keys = await (await request('/api/runtime-keys')).json()
  const original = keys.find((entry: { id: string }) => entry.id === key.id)
  expect(original.replacedByKeyId).toBe((await replaced.json()).id)
  const minted = await request(
    '/ws/rollover-messages/ticket',
    'POST',
    { revision: 1, origin: browserOrigin },
    key.token,
  )
  expect(minted.status).toBe(200)
  const ticket = await minted.json()
  expect(Date.parse(ticket.expiresAt)).toBeLessThanOrEqual(
    Date.parse(original.acceptUntil),
  )
  expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.now())
})

test('native original bearer and ticket sockets end at the fixed overlap while the successor remains usable', async () => {
  const { request, open } = workspace()
  const { key } = await publishedKey(request)
  const bearer = await open({
    headers: { authorization: `Bearer ${key.token}` },
  })
  expect(bearer.accepted).toBe(true)
  await exchange(bearer.socket, 'before-handover')
  const bearerClosed = closed(bearer.socket)
  const before = await request(
    '/ws/rollover-messages/ticket',
    'POST',
    { revision: 1, origin: browserOrigin },
    key.token,
  )
  expect(before.status).toBe(200)
  const unused = await before.json()
  const replaced = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 2,
  })
  expect(replaced.status).toBe(200)
  const successor = await replaced.json()
  const inventory = await (await request('/api/runtime-keys')).json()
  const predecessor = inventory.find(
    (entry: { id: string }) => entry.id === key.id,
  )
  const deadline = Date.parse(predecessor.acceptUntil)
  await exchange(bearer.socket, 'original-during-handover')
  const after = await request(
    '/ws/rollover-messages/ticket',
    'POST',
    { revision: 1, origin: browserOrigin },
    key.token,
  )
  expect(after.status).toBe(200)
  const ticket = await after.json()
  expect(Date.parse(ticket.expiresAt)).toBeLessThanOrEqual(deadline)
  const originalTicket = await open({
    protocols: [ticket.protocol, `besh.ticket.${ticket.ticket}`],
    headers: { origin: browserOrigin },
  })
  expect(originalTicket.accepted).toBe(true)
  const ticketClosed = closed(originalTicket.socket)
  await exchange(originalTicket.socket, 'original-ticket-during-handover')
  const current = await open({
    headers: { authorization: `Bearer ${successor.token}` },
  })
  expect(current.accepted).toBe(true)
  await exchange(current.socket, 'successor-during-handover')
  for (const ended of await Promise.all([bearerClosed, ticketClosed])) {
    expect(ended.code).toBe(1008)
    expect(ended.at).toBeGreaterThanOrEqual(deadline)
    expect(ended.at - deadline).toBeLessThan(1500)
  }
  expect(current.socket.readyState).toBe(WebSocket.OPEN)
  await exchange(current.socket, 'successor-after-handover')
  expect(
    (
      await request(
        '/ws/rollover-messages/ticket',
        'POST',
        { revision: 1, origin: browserOrigin },
        key.token,
      )
    ).status,
  ).toBe(401)
  expect(
    (
      await open({
        protocols: [unused.protocol, `besh.ticket.${unused.ticket}`],
        headers: { origin: browserOrigin },
      })
    ).accepted,
  ).toBe(false)
  const audit = JSON.stringify(await (await request('/api/audit')).json())
  for (const secret of [
    key.token,
    successor.token,
    ticket.ticket,
    unused.ticket,
  ])
    expect(audit).not.toContain(secret)
})
