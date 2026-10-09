import { afterEach, expect, spyOn, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const ownerToken = 'rotation-test-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0)) await dispose()
})

function workspace(overrides: Partial<AppOptions> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-rotation-'))
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: ownerToken,
    ...overrides,
  }
  let server = createApp(options)
  cleanup.push(async () => {
    await server.close()
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture cleanup must remain inside the OS temporary directory',
      )
    rmSync(directory, { recursive: true, force: true })
  })

  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = ownerToken,
    headers: Record<string, string> = {},
  ) =>
    server.app.handle(
      new Request(origin + path, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined && !(body instanceof FormData)
            ? { 'content-type': 'application/json' }
            : {}),
          ...headers,
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
    options,
    restart(databasePath = options.databasePath) {
      server.close()
      server = createApp({ ...options, databasePath })
    },
  }
}

async function publishedKey(
  request: ReturnType<typeof workspace>['request'],
  graphql = false,
  permissions: ('rest' | 'query' | 'mutation')[] = graphql
    ? ['query']
    : ['rest'],
) {
  const response = await request(
    '/api/flows',
    'POST',
    graphql ? graphqlFlow : helloFlow,
  )
  expect(response.status).toBe(200)
  const flow = await response.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Application server',
    flowId: flow.id,
    permissions,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  return { key: await issued.json(), flow }
}

test('owner replaces a runtime key and preserves its exact scope and expiration', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)

  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const replacement = await response.json()
  expect(replacement).toMatchObject({
    name: 'Application server',
    flowId: key.flowId,
    permissions: ['rest'],
    expiresAt: key.expiresAt,
    revokedAt: null,
  })
  expect(replacement.id).not.toBe(key.id)
  expect(replacement.token).not.toBe(key.token)
  expect(replacement.token).toMatch(/^besh_[A-Za-z0-9_-]{43}$/)
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(401)
  expect(
    await (
      await request('/run/hello', 'GET', undefined, replacement.token)
    ).json(),
  ).toEqual({ message: 'Hello, Besh!' })
})

test('owner schedules a short overlap without changing either key scope or original expiration', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 2,
  })
  expect(response.status).toBe(200)
  const replacement = await response.json()
  expect(replacement).toMatchObject({
    name: key.name,
    flowId: key.flowId,
    permissions: key.permissions,
    releaseRevision: key.releaseRevision,
    expiresAt: key.expiresAt,
    tenantId: key.tenantId,
    issuerBinding: key.issuerBinding,
    replacesKeyId: key.id,
    replacedByKeyId: null,
    acceptUntil: key.expiresAt,
  })
  const inventory = await (await request('/api/runtime-keys')).json()
  const old = inventory.find((item: { id: string }) => item.id === key.id)
  expect(old).toMatchObject({
    expiresAt: key.expiresAt,
    revokedAt: null,
    replacesKeyId: null,
    replacedByKeyId: replacement.id,
  })
  expect(Date.parse(old.acceptUntil) - Date.parse(replacement.createdAt)).toBe(
    2000,
  )
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(200)
})

test('a downloaded backup with a dangling replacement refuses runtime admission', async () => {
  const { request, options } = workspace()
  const { key } = await publishedKey(request)
  expect(
    (
      await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
        graceSeconds: 30,
      })
    ).status,
  ).toBe(200)
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const restoredPath = join(options.backupDir, 'dangling-rollover.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await download.arrayBuffer()))

  // Only the detached public backup is corrupted; the live workspace stays untouched.
  const detached = new Database(restoredPath)
  detached.run('PRAGMA foreign_keys = OFF')
  detached
    .query(
      'UPDATE runtime_key_rollovers SET next_key_id = ? WHERE previous_key_id = ?',
    )
    .run('missing-successor', key.id)
  detached.close()

  let restored: ReturnType<typeof createApp> | undefined
  let startupError: unknown
  try {
    restored = createApp({ ...options, databasePath: restoredPath })
  } catch (error) {
    startupError = error
  }
  if (startupError) {
    expect(startupError).toMatchObject({
      status: 503,
      message: 'Runtime key rollover is unavailable',
    })
  } else {
    try {
      const response = await restored!.app.handle(
        new Request(origin + '/run/hello', {
          headers: { authorization: `Bearer ${key.token}` },
        }),
      )
      expect(response.status).toBe(503)
    } finally {
      await restored!.close()
    }
  }
})

test('downloaded backup restoration rejects cross-scope edges and multi-key cycles', async () => {
  const { request, options } = workspace()
  const { key } = await publishedKey(request)
  const second = await (
    await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  ).json()
  const third = await (
    await request(`/api/runtime-keys/${second.id}/rotate`, 'POST')
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())

  for (const kind of ['cross-scope', 'cycle']) {
    const restoredPath = join(options.backupDir, `${kind}.sqlite`)
    writeFileSync(restoredPath, bytes)
    const detached = new Database(restoredPath)
    detached.run('PRAGMA foreign_keys = OFF')
    if (kind === 'cross-scope')
      detached
        .query('UPDATE runtime_keys SET permissions = ? WHERE id = ?')
        .run('["query"]', second.id)
    else
      detached
        .query('INSERT INTO runtime_key_rollovers VALUES (?, ?, ?, ?, ?)')
        .run(third.id, key.id, third.createdAt, third.createdAt, 0)
    detached.close()

    let restored: ReturnType<typeof createApp> | undefined
    let startupError: unknown
    try {
      restored = createApp({ ...options, databasePath: restoredPath })
    } catch (error) {
      startupError = error
    } finally {
      await restored?.close()
    }
    expect(startupError).toMatchObject({
      status: 503,
      message: 'Runtime key rollover is unavailable',
    })
  }
})

test('downloaded backup rollover schedules must match the immutable successor creation time', async () => {
  const { request, options } = workspace()
  const { key } = await publishedKey(request)
  const rotated = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 30,
  })
  expect(rotated.status).toBe(200)
  const successor = await rotated.json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const restoredPath = join(options.backupDir, 'shifted-schedule.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await download.arrayBuffer()))
  const detached = new Database(restoredPath)
  const changedStart = new Date(
    Date.parse(successor.createdAt) + 1000,
  ).toISOString()
  const changedEnd = new Date(
    Date.parse(successor.createdAt) + 31_000,
  ).toISOString()
  detached
    .query(
      'UPDATE runtime_key_rollovers SET created_at = ?, accept_until = ? WHERE previous_key_id = ?',
    )
    .run(changedStart, changedEnd, key.id)
  detached.close()

  let restored: ReturnType<typeof createApp> | undefined
  let startupError: unknown
  try {
    restored = createApp({ ...options, databasePath: restoredPath })
  } catch (error) {
    startupError = error
  }
  if (startupError) {
    expect(startupError).toMatchObject({
      status: 503,
      message: 'Runtime key rollover is unavailable',
    })
  } else {
    try {
      const response = await restored!.app.handle(
        new Request(origin + '/run/hello', {
          headers: { authorization: `Bearer ${key.token}` },
        }),
      )
      expect(response.status).toBe(503)
    } finally {
      await restored!.close()
    }
  }
})

test('the fixed overlap deadline rejects old credentials after real elapsed time while the successor remains usable', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 1,
  })
  expect(response.status).toBe(200)
  const replacement = await response.json()
  const inventory = await (await request('/api/runtime-keys')).json()
  const previous = inventory.find((item: { id: string }) => item.id === key.id)
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
  await Bun.sleep(
    Math.max(0, Date.parse(previous.acceptUntil) - Date.now()) + 25,
  )
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(401)
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(200)
  const after = await (await request('/api/runtime-keys')).json()
  expect(
    after.find((item: { id: string }) => item.id === key.id),
  ).toMatchObject({
    revokedAt: null,
    acceptUntil: previous.acceptUntil,
    expiresAt: key.expiresAt,
  })
})

test('an approved old window blocks successor replacement and old keys cannot create a second successor', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
    graceSeconds: 1,
  })
  expect(response.status).toBe(200)
  const next = await response.json()
  const before = await (await request('/api/runtime-keys')).json()
  const audit = await (await request('/api/audit')).json()
  expect(
    (
      await request(`/api/runtime-keys/${next.id}/rotate`, 'POST', {
        graceSeconds: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})).status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(audit)
  const previous = before.find((item: { id: string }) => item.id === key.id)
  await Bun.sleep(
    Math.max(0, Date.parse(previous.acceptUntil) - Date.now()) + 25,
  )
  const final = await request(`/api/runtime-keys/${next.id}/rotate`, 'POST', {})
  expect(final.status).toBe(200)
  const current = await final.json()
  expect(current.expiresAt).toBe(key.expiresAt)
  expect(current.replacesKeyId).toBe(next.id)
  expect(
    (await request('/run/hello', 'GET', undefined, current.token)).status,
  ).toBe(200)
  expect(
    (await request('/run/hello', 'GET', undefined, next.token)).status,
  ).toBe(401)
})

test('requested grace cannot extend or silently shorten the original expiry and rejects invalid settings atomically', async () => {
  const { request } = workspace()
  const { flow } = await publishedKey(request)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Nearly expired',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 2000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const before = await (await request('/api/runtime-keys')).json()
  const audit = await (await request('/api/audit')).json()
  expect(
    (
      await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {
        graceSeconds: 3,
      })
    ).status,
  ).toBe(400)
  expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(audit)
  for (const body of [
    { graceSeconds: -1 },
    { graceSeconds: 301 },
    { graceSeconds: 1.5 },
    { graceSeconds: '1' },
    { graceSeconds: null },
    { graceSeconds: 0, expiresAt: key.expiresAt },
  ])
    expect(
      (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', body))
        .status,
    ).toBe(400)
  const immediate = await request(
    `/api/runtime-keys/${key.id}/rotate`,
    'POST',
    { graceSeconds: 0 },
  )
  expect(immediate.status).toBe(200)
  expect((await immediate.json()).expiresAt).toBe(key.expiresAt)
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(401)
})

test('replacement rejects unknown settings and preserves immediate replacement for an absent body or empty object', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const before = await (await request('/api/runtime-keys')).json()

  for (const body of [
    null,
    [],
    'replace',
    { name: 'Different name' },
    { flowId: 'different-flow' },
    { permissions: ['query', 'mutation'] },
    { expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString() },
  ]) {
    expect(
      (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', body))
        .status,
    ).toBe(400)
    expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  }

  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST', {})).status,
  ).toBe(200)
})

test('only owners replace keys and owner sessions require origin and CSRF proof', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  const path = `/api/runtime-keys/${key.id}/rotate`
  const before = await (await request('/api/runtime-keys')).json()

  for (const role of ['editor', 'viewer']) {
    const member = await (
      await request('/api/members', 'POST', { name: role, role })
    ).json()
    expect((await request(path, 'POST', undefined, member.token)).status).toBe(
      403,
    )
  }
  for (const token of ['', 'invalid', key.token])
    expect((await request(path, 'POST', undefined, token)).status).toBe(401)

  const login = await request(
    '/auth/login',
    'POST',
    { token: ownerToken },
    '',
    {
      origin,
    },
  )
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const session = await login.json()
  const headers = { cookie, origin, 'x-besh-csrf': session.csrfToken }

  expect(
    (await request(path, 'POST', undefined, '', { cookie, origin })).status,
  ).toBe(403)
  expect(
    (
      await request(path, 'POST', undefined, '', {
        ...headers,
        origin: 'https://evil.example',
      })
    ).status,
  ).toBe(403)
  expect(
    (await request(path, 'POST', undefined, 'invalid', headers)).status,
  ).toBe(401)
  expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  const replaced = await request(path, 'POST', undefined, '', headers)
  expect(replaced.status).toBe(200)
  const replacement = await replaced.json()

  for (const token of ['', ownerToken])
    expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
      401,
    )
  expect(
    (await request('/run/hello', 'GET', undefined, '', { cookie })).status,
  ).toBe(401)
  expect(
    (await request('/api/me', 'GET', undefined, replacement.token)).status,
  ).toBe(401)
})

test('missing, revoked, and expired keys cannot create replacements or change audit history', async () => {
  const { request } = workspace()
  const { key } = await publishedKey(request)
  expect((await request(`/api/runtime-keys/${key.id}`, 'DELETE')).status).toBe(
    200,
  )
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Expiring client',
    flowId: key.flowId,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const expiring = await issued.json()
  const before = await (await request('/api/runtime-keys')).json()
  const audit = await (await request('/api/audit')).json()

  expect(
    (await request('/api/runtime-keys/missing/rotate', 'POST')).status,
  ).toBe(404)
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')).status,
  ).toBe(409)

  const clock = spyOn(Date, 'now').mockReturnValue(
    Date.parse(expiring.expiresAt),
  )
  try {
    expect(
      (await request(`/api/runtime-keys/${expiring.id}/rotate`, 'POST')).status,
    ).toBe(409)
    expect(
      (await request('/run/hello', 'GET', undefined, expiring.token)).status,
    ).toBe(401)
  } finally {
    clock.mockRestore()
  }
  expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  const keyEvents = (events: { action: string }[]) =>
    events.filter((event) => event.action.startsWith('runtime-key.'))
  expect(keyEvents(await (await request('/api/audit')).json())).toEqual(
    keyEvents(audit),
  )
})

test('replacement validates published protocol and leaves incompatible keys unchanged', async () => {
  const { request } = workspace()
  const { key, flow } = await publishedKey(request)
  expect(
    (
      await request(`/api/flows/${flow.id}`, 'PUT', {
        ...graphqlFlow,
        revision: 1,
      })
    ).status,
  ).toBe(200)

  const response = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  expect(response.status).toBe(200)
  const replacement = await response.json()
  expect(replacement.permissions).toEqual(['rest'])
  expect(
    (await request('/run/hello', 'GET', undefined, replacement.token)).status,
  ).toBe(200)

  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const before = await (await request('/api/runtime-keys')).json()
  const audit = await (await request('/api/audit')).json()
  expect(
    (await request(`/api/runtime-keys/${replacement.id}/rotate`, 'POST'))
      .status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(audit)

  expect(
    (
      await request('/api/runtime-keys', 'POST', {
        name: 'Invalid REST grant',
        flowId: flow.id,
        permissions: ['rest'],
        expiresAt: key.expiresAt,
      })
    ).status,
  ).toBe(400)
})

test('concurrent callers get one replacement and paired secret-free audit events', async () => {
  const { request, options } = workspace()
  const { key } = await publishedKey(request)
  const peer = createApp(options)
  try {
    const responses = await Promise.all([
      request(`/api/runtime-keys/${key.id}/rotate`, 'POST'),
      peer.app.handle(
        new Request(`${origin}/api/runtime-keys/${key.id}/rotate`, {
          method: 'POST',
          headers: { authorization: `Bearer ${ownerToken}` },
        }),
      ),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ])
    const replacement = await responses.find((response) => response.ok)!.json()
    const { token, ...metadata } = replacement
    const keys = await (await request('/api/runtime-keys')).json()
    expect(keys).toEqual([
      metadata,
      {
        ...key,
        token: undefined,
        revokedAt: replacement.createdAt,
        acceptUntil: replacement.createdAt,
        replacedByKeyId: replacement.id,
      },
    ])
    const serialized = JSON.stringify(keys)
    expect(serialized).not.toContain(token)
    expect(serialized).not.toContain(key.token)
    expect(serialized).not.toContain('token_hash')
    expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
      200,
    )
    expect(
      (await request('/run/hello', 'GET', undefined, key.token)).status,
    ).toBe(401)
    expect(
      (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')).status,
    ).toBe(409)

    const events = await (await request('/api/audit')).json()
    expect(
      events.filter(
        (event: { action: string; resource: string }) =>
          event.action === 'runtime-key.revoked' && event.resource === key.id,
      ),
    ).toHaveLength(1)
    expect(
      events.filter(
        (event: { action: string; resource: string }) =>
          event.action === 'runtime-key.created' &&
          event.resource === replacement.id,
      ),
    ).toHaveLength(1)
    expect(JSON.stringify(events)).not.toContain(token)
    expect(JSON.stringify(events)).not.toContain(key.token)
  } finally {
    await peer.close()
  }
})

test('concurrent grace handovers have one winner and explicit predecessor revocation recovers a dormant pinned chain', async () => {
  const { request, options } = workspace()
  const { flow } = await publishedKey(request)
  const original = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Pinned handover',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  ).json()
  const peer = createApp(options)
  try {
    const responses = await Promise.all([
      request(`/api/runtime-keys/${original.id}/rotate`, 'POST', {
        graceSeconds: 30,
      }),
      peer.app.handle(
        new Request(`${origin}/api/runtime-keys/${original.id}/rotate`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${ownerToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ graceSeconds: 30 }),
        }),
      ),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ])
    const successor = await responses.find((response) => response.ok)!.json()
    const inventory = await (await request('/api/runtime-keys')).json()
    const old = inventory.find(
      (item: { id: string }) => item.id === original.id,
    )
    expect(old.revokedAt).toBeNull()
    expect(old.replacedByKeyId).toBe(successor.id)
    const events = await (await request('/api/audit')).json()
    expect(
      events.filter(
        (event: { action: string; resource: string }) =>
          event.action === 'runtime-key.rollover-scheduled' &&
          event.resource === original.id,
      ),
    ).toHaveLength(1)
    expect(
      events.filter(
        (event: { action: string; resource: string }) =>
          event.action === 'runtime-key.created' &&
          event.resource === successor.id,
      ),
    ).toHaveLength(1)

    expect(
      (
        await request(`/api/flows/${flow.id}`, 'PUT', {
          ...helloFlow,
          revision: 1,
        })
      ).status,
    ).toBe(200)
    expect(
      (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
        .status,
    ).toBe(200)
    for (const token of [original.token, successor.token])
      expect(
        (await request('/run/hello', 'GET', undefined, token)).status,
      ).toBe(403)
    expect(
      (await request(`/api/runtime-keys/${successor.id}/rotate`, 'POST'))
        .status,
    ).toBe(409)
    expect(
      (await request(`/api/runtime-keys/${original.id}`, 'DELETE')).status,
    ).toBe(200)
    const recoveredResponse = await request(
      `/api/runtime-keys/${successor.id}/rotate`,
      'POST',
    )
    expect(recoveredResponse.status).toBe(200)
    const recovered = await recoveredResponse.json()
    expect(recovered).toMatchObject({
      releaseRevision: 1,
      expiresAt: original.expiresAt,
      replacesKeyId: successor.id,
      acceptUntil: original.expiresAt,
    })
    expect(
      (await request('/run/hello', 'GET', undefined, original.token)).status,
    ).toBe(401)
    expect(
      (await request('/run/hello', 'GET', undefined, successor.token)).status,
    ).toBe(401)
    expect(
      (
        await request(`/api/flows/${flow.id}/rollback`, 'POST', {
          revision: 1,
          publishedRevision: 2,
        })
      ).status,
    ).toBe(200)
    expect(
      (await request('/run/hello', 'GET', undefined, recovered.token)).status,
    ).toBe(200)
  } finally {
    await peer.close()
  }
})

test('both overlap credentials retain live protected field, tenant and issuer authority', async () => {
  const { request } = workspace()
  const upload = new FormData()
  upload.set('name', 'Protected salaries')
  upload.set(
    'file',
    new File(['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'], 'people.csv'),
  )
  const imported = await request('/api/data-sources/import', 'POST', upload)
  expect(imported.status).toBe(200)
  const source = await imported.json()
  const flow = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      name: 'Salaries',
      path: '/handover-salaries',
      protocol: 'rest',
      columns: ['name', 'salary'],
      limit: 10,
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  const policyPath = `/api/data-sources/${source.id}/row-policy`
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
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Selected issuer',
      permissions: ['runtime-keys.manage'],
    })
  ).json()
  const access = {
    mode: 'selected',
    flowIds: [flow.id],
    dependencyUse: {
      sources: [source.id],
      databaseConnections: [],
      authConnections: [],
    },
  }
  const member = await (
    await request('/api/members', 'POST', {
      name: 'A issuer',
      role: 'custom',
      roleId: role.id,
      access,
      tenantId: tenant.id,
    })
  ).json()
  const issued = await request(
    '/api/runtime-keys',
    'POST',
    {
      name: 'Protected caller',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    member.token,
  )
  expect(issued.status).toBe(200)
  const original = await issued.json()
  const handover = await request(
    `/api/runtime-keys/${original.id}/rotate`,
    'POST',
    { graceSeconds: 30 },
  )
  expect(handover.status).toBe(200)
  const successor = await handover.json()
  expect(successor).toMatchObject({
    tenantId: tenant.id,
    issuerBinding: { memberId: member.id, action: 'runtime-keys.manage' },
    releaseRevision: 1,
    expiresAt: original.expiresAt,
  })
  const assertCallers = async (status: number) => {
    for (const token of [original.token, successor.token]) {
      const response = await request(
        '/run/handover-salaries',
        'GET',
        undefined,
        token,
      )
      expect(response.status).toBe(status)
      if (status === 200)
        expect(await response.json()).toEqual([{ name: 'Ada', salary: 1200 }])
      else expect(await response.text()).not.toContain('1200')
    }
  }
  await assertCallers(200)
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
  await assertCallers(403)
  const keysBefore = await (await request('/api/runtime-keys')).json()
  const auditBefore = await (await request('/api/audit')).json()
  expect(
    (await request(`/api/runtime-keys/${successor.id}/rotate`, 'POST')).status,
  ).toBe(409)
  expect(await (await request('/api/runtime-keys')).json()).toEqual(keysBefore)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  expect(
    (
      await request(policyPath, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 3,
        resourceVersion: 1,
        fields: { mode: 'all', columns: [] },
      })
    ).status,
  ).toBe(200)
  await assertCallers(200)
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        ...access,
        version: 1,
        dependencyUse: { ...access.dependencyUse, sources: [] },
      })
    ).status,
  ).toBe(200)
  await assertCallers(403)
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        ...access,
        version: 2,
      })
    ).status,
  ).toBe(200)
  await assertCallers(200)
  expect(
    (
      await request(`/api/members/${member.id}/tenant`, 'PUT', {
        tenantId: null,
        version: 1,
      })
    ).status,
  ).toBe(200)
  await assertCallers(403)
  expect(
    (
      await request(`/api/members/${member.id}/tenant`, 'PUT', {
        tenantId: tenant.id,
        version: 2,
      })
    ).status,
  ).toBe(200)
  await assertCallers(200)
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: [],
        version: 1,
      })
    ).status,
  ).toBe(200)
  await assertCallers(403)
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: ['runtime-keys.manage'],
        version: 2,
      })
    ).status,
  ).toBe(200)
  await assertCallers(200)
  expect((await request(`/api/members/${member.id}`, 'DELETE')).status).toBe(
    200,
  )
  await assertCallers(403)
})

test('replacement preserves query, mutation, and combined grants without crossing flows', async () => {
  const { request } = workspace()
  const { key, flow } = await publishedKey(request, true)
  const other = await (
    await request('/api/flows', 'POST', { ...graphqlFlow, path: '/other' })
  ).json()
  expect(
    (await request(`/api/flows/${other.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)

  for (const permissions of [['query'], ['mutation'], ['mutation', 'query']]) {
    const original = await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Operation client',
        flowId: flow.id,
        permissions,
        expiresAt: key.expiresAt,
      })
    ).json()
    const response = await request(
      `/api/runtime-keys/${original.id}/rotate`,
      'POST',
    )
    expect(response.status).toBe(200)
    const replacement = await response.json()
    expect(replacement.permissions).toEqual(permissions)
    expect(replacement.expiresAt).toBe(key.expiresAt)

    for (const operation of ['query', 'mutation']) {
      const body = { query: `${operation} { greet(name: "Ada") { name } }` }
      const result = await request(
        '/graphql/hello',
        'POST',
        body,
        replacement.token,
      )
      expect(result.status).toBe(permissions.includes(operation) ? 200 : 403)
      if (result.ok)
        expect(await result.json()).toEqual({
          data: { greet: { name: 'Ada' } },
        })
      expect(
        (await request('/graphql/hello', 'POST', body, original.token)).status,
      ).toBe(401)
      expect(
        (await request('/graphql/other', 'POST', body, replacement.token))
          .status,
      ).toBe(403)
    }
  }
})

test('replacement revocation and grants survive restart and downloaded backup restoration', async () => {
  const { request, options, restart } = workspace()
  const rest = await publishedKey(request)
  const graph = await publishedKey(request, true)
  const restReplacement = await (
    await request(`/api/runtime-keys/${rest.key.id}/rotate`, 'POST')
  ).json()
  const graphReplacement = await (
    await request(`/api/runtime-keys/${graph.key.id}/rotate`, 'POST')
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, Buffer.from(await download.arrayBuffer()))

  for (const path of [options.databasePath, restoredPath]) {
    restart(path)
    expect(
      (await request('/run/hello', 'GET', undefined, rest.key.token)).status,
    ).toBe(401)
    expect(
      await (
        await request('/run/hello', 'GET', undefined, restReplacement.token)
      ).json(),
    ).toEqual({ message: 'Hello, Besh!' })
    const query = { query: '{ greet(name: "Ada") { name } }' }
    expect(
      (await request('/graphql/hello', 'POST', query, graph.key.token)).status,
    ).toBe(401)
    expect(
      await (
        await request('/graphql/hello', 'POST', query, graphReplacement.token)
      ).json(),
    ).toEqual({ data: { greet: { name: 'Ada' } } })
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          {
            query: 'mutation { greet(name: "Ada") { name } }',
          },
          graphReplacement.token,
        )
      ).status,
    ).toBe(403)
    const keys = await (await request('/api/runtime-keys')).json()
    expect(
      keys.find((key: { id: string }) => key.id === rest.key.id).revokedAt,
    ).toBeString()
    expect(
      keys.find((key: { id: string }) => key.id === graphReplacement.id),
    ).toMatchObject({
      flowId: graph.flow.id,
      expiresAt: graph.key.expiresAt,
      permissions: ['query'],
      revokedAt: null,
    })
  }

  const clock = spyOn(Date, 'now').mockReturnValue(
    Date.parse(rest.key.expiresAt),
  )
  try {
    expect(
      (await request('/run/hello', 'GET', undefined, restReplacement.token))
        .status,
    ).toBe(401)
    expect(
      (await request(`/api/runtime-keys/${restReplacement.id}/rotate`, 'POST'))
        .status,
    ).toBe(409)
  } finally {
    clock.mockRestore()
  }
})

test('replacement cannot complete a product login attempt begun with the revoked key', async () => {
  const { request } = workspace({
    oauthFetch: async () => {
      throw new Error('No provider exchange should occur for a mismatched key')
    },
  })
  const connection = await request('/api/auth-connections', 'POST', {
    name: 'Product GitHub',
    provider: 'github',
    clientId: 'rotation-test-client',
    clientSecret: 'disposable-provider-secret',
    redirectUri: 'https://product.example/oauth/github',
  })
  expect(connection.status).toBe(200)
  const saved = await connection.json()
  const generated = await request(
    `/api/auth-connections/${saved.id}/generate`,
    'POST',
    {
      name: 'GitHub login',
      path: '/login/github',
      kind: 'rest',
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Product server',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const begun = await request(
    '/run/login/github',
    'POST',
    { action: 'BEGIN' },
    key.token,
  )
  expect(begun.status).toBe(200)
  const attempt = await begun.json()
  const rotated = await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')
  expect(rotated.status).toBe(200)
  const replacement = await rotated.json()
  const completion = {
    action: 'COMPLETE',
    code: 'disposable-provider-code',
    state: attempt.state,
    proof: attempt.proof,
  }
  expect(
    (await request('/run/login/github', 'POST', completion, key.token)).status,
  ).toBe(401)
  expect(
    (await request('/run/login/github', 'POST', completion, replacement.token))
      .status,
  ).toBe(400)
  const fresh = await request(
    '/run/login/github',
    'POST',
    { action: 'BEGIN' },
    replacement.token,
  )
  expect(fresh.status).toBe(200)
  const freshAttempt = await fresh.json()
  expect(freshAttempt.state).not.toBe(attempt.state)
  expect(freshAttempt.proof).not.toBe(attempt.proof)
})

test('a held product identity response cannot outlive its original key grace window or transfer to the successor', async () => {
  let release!: (response: Response) => void
  let entered!: () => void
  const pending = new Promise<void>((resolve) => {
    entered = resolve
  })
  const { request } = workspace({
    oauthFetch: async (url) => {
      if (String(url).includes('/login/oauth/access_token'))
        return Response.json({
          access_token: 'disposable_provider_token',
          token_type: 'bearer',
        })
      entered()
      return new Promise<Response>((resolve) => {
        release = resolve
      })
    },
  })
  const connection = await request('/api/auth-connections', 'POST', {
    name: 'Held GitHub',
    provider: 'github',
    clientId: 'held-client',
    clientSecret: 'disposable-provider-secret',
    redirectUri: 'https://product.example/oauth/github',
  })
  expect(connection.status).toBe(200)
  const saved = await connection.json()
  const generated = await request(
    `/api/auth-connections/${saved.id}/generate`,
    'POST',
    {
      name: 'Held login',
      path: '/held-login',
      kind: 'rest',
    },
  )
  expect(generated.status).toBe(200)
  const flow = await generated.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Original product caller',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  const begin = async () => {
    const response = await request(
      '/run/held-login',
      'POST',
      { action: 'BEGIN' },
      key.token,
    )
    expect(response.status).toBe(200)
    return response.json()
  }
  const held = await begin()
  const untouched = await begin()
  const complete = (attempt: { state: string; proof: string }) => ({
    action: 'COMPLETE',
    code: 'disposable-code',
    state: attempt.state,
    proof: attempt.proof,
  })
  const result = request('/run/held-login', 'POST', complete(held), key.token)
  await pending
  try {
    const rotated = await request(
      `/api/runtime-keys/${key.id}/rotate`,
      'POST',
      { graceSeconds: 1 },
    )
    expect(rotated.status).toBe(200)
    const next = await rotated.json()
    expect(
      (
        await request(
          '/run/held-login',
          'POST',
          complete(untouched),
          next.token,
        )
      ).status,
    ).toBe(400)
    const old = (await (await request('/api/runtime-keys')).json()).find(
      (item: { id: string }) => item.id === key.id,
    )
    await Bun.sleep(Math.max(0, Date.parse(old.acceptUntil) - Date.now()) + 25)
    release(
      Response.json({
        id: 123,
        login: 'private-person',
        name: 'Private identity',
        avatar_url: null,
      }),
    )
    const denied = await result
    expect(denied.status).toBe(401)
    expect(await denied.text()).not.toContain('Private identity')
    const events = await (await request('/api/audit')).json()
    expect(
      events.filter(
        (event: { action: string; resource: string }) =>
          event.action === 'product-login.completed' &&
          event.resource === flow.id,
      ),
    ).toEqual([])
  } finally {
    release(
      Response.json({
        id: 123,
        login: 'private-person',
        name: 'Private identity',
        avatar_url: null,
      }),
    )
    await result
  }
})
