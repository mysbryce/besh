import { afterEach, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type AppOptions } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const ownerToken = 'rotation-test-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
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
  cleanup.push(() => {
    server.close()
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
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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

test('replacement rejects settings and accepts only an absent body or empty object', async () => {
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
      { ...key, token: undefined, revokedAt: replacement.createdAt },
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
    peer.close()
  }
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
