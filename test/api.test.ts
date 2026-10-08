import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow } from './fixtures'
import { writeFileSync } from 'node:fs'

const adminToken = 'test-only-admin-token-32-characters-long'
const cleanup: (() => void)[] = []
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-test-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken,
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
  return { request, server, options }
}

test('management routes require a valid token and identify the owner', async () => {
  const { request } = workspace()
  expect((await request('/health', 'GET', undefined, '')).status).toBe(200)
  expect((await request('/api/me', 'GET', undefined, '')).status).toBe(401)
  expect((await request('/api/me', 'GET', undefined, 'wrong')).status).toBe(401)
  const me = await request('/api/me')
  expect(await me.json()).toMatchObject({ name: 'Owner', role: 'owner' })
})

test('owners issue and revoke scoped member tokens with an audit trail', async () => {
  const { request } = workspace()
  const response = await request('/api/members', 'POST', {
    name: 'Reader',
    role: 'viewer',
  })
  expect(response.status).toBe(200)

  const reader = await response.json()
  expect(reader.token.length).toBeGreaterThan(32)
  expect(
    (await request('/api/me', 'GET', undefined, reader.token)).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/members',
        'POST',
        { name: 'Escalated', role: 'editor' },
        reader.token,
      )
    ).status,
  ).toBe(403)
  expect((await request('/api/members')).status).toBe(200)
  expect(await (await request('/api/members')).text()).not.toContain(
    reader.token,
  )

  expect((await request(`/api/members/${reader.id}`, 'DELETE')).status).toBe(
    200,
  )
  expect(
    (await request('/api/me', 'GET', undefined, reader.token)).status,
  ).toBe(401)
  expect((await request('/api/members/owner', 'DELETE')).status).toBe(409)

  const events = await (await request('/api/audit')).json()
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'member.created',
  )
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'member.revoked',
  )
  expect(JSON.stringify(events)).not.toContain(reader.token)
})

test('a saved draft can be tested, published and called without draft edits changing its release', async () => {
  const { request } = workspace()
  const response = await request('/api/flows', 'POST', helloFlow)
  expect(response.status).toBe(200)

  const flow = await response.json()
  expect(flow.revision).toBe(1)
  expect((await request('/run/hello')).status).toBe(404)
  expect(
    await (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: null,
        query: {},
      })
    ).json(),
  ).toMatchObject({ status: 200, body: { message: 'Hello, Besh!' } })
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  expect((await request('/run/hello', 'GET', undefined, '')).status).toBe(401)
  expect(await (await request('/run/hello')).json()).toEqual({
    message: 'Hello, Besh!',
  })

  const edited = {
    ...helloFlow,
    name: 'New draft',
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 202, body: { message: 'Updated!' } },
      },
    ],
  }
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', { ...edited, revision: 1 }))
      .status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', { ...edited, revision: 1 }))
      .status,
  ).toBe(409)
  expect(await (await request('/run/hello')).json()).toEqual({
    message: 'Hello, Besh!',
  })
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(409)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(await (await request('/run/hello')).json()).toEqual({
    message: 'Updated!',
  })
})

test('backups restore published flows and migration history survives restarts', async () => {
  const { request, options } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)

  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, Buffer.from(await download.arrayBuffer()))
  const restored = createApp({ ...options, databasePath: restoredPath })
  try {
    const response = await restored.app.handle(
      new Request('http://localhost/run/hello', {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    )
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
    const migrations = await (await request('/api/migrations')).json()
    expect(
      migrations.map((migration: { version: number }) => migration.version),
    ).toEqual([1, 2, 3, 4])
    expect(await (await request('/api/backups')).json()).toHaveLength(1)
  } finally {
    restored.close()
  }
})

test('roles protect edits, publishing and backups while route conflicts fail explicitly', async () => {
  const { request } = workspace()
  const editor = await (
    await request('/api/members', 'POST', { name: 'Builder', role: 'editor' })
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reader', role: 'viewer' })
  ).json()
  expect(
    (await request('/api/flows', 'POST', helloFlow, viewer.token)).status,
  ).toBe(403)
  const flow = await (
    await request('/api/flows', 'POST', helloFlow, editor.token)
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
    (await request('/api/backups', 'POST', undefined, editor.token)).status,
  ).toBe(403)
  expect(
    (await request('/api/backups', 'GET', undefined, viewer.token)).status,
  ).toBe(403)
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const duplicate = await (
    await request('/api/flows', 'POST', helloFlow)
  ).json()
  expect(
    (
      await request(`/api/flows/${duplicate.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(409)

  const malformed = await (
    await request('/api/flows', 'POST', {
      ...helloFlow,
      edges: [{ id: 'bad', source: 'request', target: 'absent' }],
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${malformed.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(400)
  expect((await request('/api/backups/not-a-backup')).status).toBe(404)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some((event: { action: string }) => event.action === 'access.denied'),
  ).toBe(true)
})

test('first-run setup creates one workspace with a protected, one-time owner key', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-setup-'))
  const server = createApp({
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    setupKey: 'local-setup-key-only-for-this-test-1234',
  })
  cleanup.push(() => {
    server.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  })
  const status = () =>
    server.app.handle(new Request('http://localhost/setup/status'))
  const setup = (key: string) =>
    server.app.handle(
      new Request('http://localhost/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, name: 'My studio' }),
      }),
    )

  expect(await (await status()).json()).toMatchObject({ required: true })
  expect((await setup('wrong')).status).toBe(403)
  const result = await setup('local-setup-key-only-for-this-test-1234')
  expect(result.status).toBe(200)
  const owner = await result.json()
  expect(owner.token.length).toBeGreaterThan(32)
  expect(await (await status()).json()).toMatchObject({
    required: false,
    name: 'My studio',
  })
  expect((await setup('local-setup-key-only-for-this-test-1234')).status).toBe(
    409,
  )
  expect(
    (
      await server.app.handle(
        new Request('http://localhost/api/me', {
          headers: { authorization: `Bearer ${owner.token}` },
        }),
      )
    ).status,
  ).toBe(200)
})

test('incomplete drafts can be saved but cannot be published', async () => {
  const { request } = workspace()
  const response = await request('/api/flows', 'POST', {
    ...helloFlow,
    nodes: [],
    edges: [],
  })
  expect(response.status).toBe(200)
  const flow = await response.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(400)
})

test('credential responses are not cached and raw authorization values are rejected', async () => {
  const { request, server } = workspace()
  const me = await request('/api/me')
  expect(me.headers.get('cache-control')).toBe('no-store')
  expect(me.headers.get('x-content-type-options')).toBe('nosniff')
  const raw = await server.app.handle(
    new Request('http://localhost/api/me', {
      headers: { authorization: adminToken },
    }),
  )
  expect(raw.status).toBe(401)
})

test.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
  '%s endpoints return a published response',
  async (method) => {
    const { request } = workspace()
    const flow = await (
      await request('/api/flows', 'POST', { ...helloFlow, method })
    ).json()
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
    const response = await request('/run/hello', method)
    expect(response.status).toBe(200)
    if (method === 'HEAD') expect(await response.text()).toBe('')
    else expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
  },
)

test('owner-key recovery persists through restart and records rotation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-recovery-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
  }
  const original = createApp({ ...options, adminToken })
  original.close()
  const replacement = 'replacement-owner-key-at-least-32-characters'
  const rotated = createApp({ ...options, adminToken: replacement })
  rotated.close()
  const restarted = createApp(options)
  cleanup.push(() => {
    restarted.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  })
  const request = (path: string, token: string) =>
    restarted.app.handle(
      new Request(`http://localhost${path}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    )

  expect((await request('/api/me', adminToken)).status).toBe(401)
  expect((await request('/api/me', replacement)).status).toBe(200)
  const audit = await (await request('/api/audit', replacement)).json()
  expect(
    audit.some(
      (event: { action: string }) => event.action === 'owner.key.rotated',
    ),
  ).toBe(true)
})
