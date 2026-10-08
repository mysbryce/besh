import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'

const ownerToken = 'session-test-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-sessions-'))
  server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: ownerToken,
  })
})

afterEach(() => {
  server.close()
  rmSync(directory, { recursive: true, force: true })
})

function request(path: string, method = 'GET', body?: unknown, headers = {}) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: { origin, 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function login(token = ownerToken) {
  const response = await request('/auth/login', 'POST', { token })
  expect(response.status).toBe(200)
  const cookie = response.headers.get('set-cookie')!.split(';')[0]!
  return { response, cookie, ...(await response.json()) }
}

test('member key creates a private cookie session restored after reload', async () => {
  const session = await login()
  expect(session.response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(session.response.headers.get('set-cookie')).toContain(
    'SameSite=Strict',
  )
  expect(session.response.headers.get('set-cookie')).toContain('Path=/')
  expect(session.response.headers.get('set-cookie')).toContain('Max-Age=43200')
  expect(session.member).toMatchObject({
    id: 'owner',
    name: 'Owner',
    role: 'owner',
  })
  expect(session.csrfToken).toBeString()
  expect(JSON.stringify(session.member)).not.toContain(ownerToken)

  const restored = await request('/auth/session', 'GET', undefined, {
    cookie: session.cookie,
  })
  expect(restored.status).toBe(200)
  expect(await restored.json()).toEqual({
    member: session.member,
    csrfToken: session.csrfToken,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
  })
  expect(
    (await request('/api/me', 'GET', undefined, { cookie: session.cookie }))
      .status,
  ).toBe(200)
})

test('cookie writes require session CSRF and exact origin; logout revokes immediately', async () => {
  const session = await login()
  const headers = { cookie: session.cookie, 'x-besh-csrf': session.csrfToken }
  const member = { name: 'Editor', role: 'editor' }
  expect(
    (await request('/api/members', 'POST', member, { cookie: session.cookie }))
      .status,
  ).toBe(403)
  expect(
    (
      await request('/api/members', 'POST', member, {
        ...headers,
        origin: 'https://evil.example',
      })
    ).status,
  ).toBe(403)
  expect((await request('/api/members', 'POST', member, headers)).status).toBe(
    200,
  )
  expect(
    (
      await request('/api/me', 'GET', undefined, {
        ...headers,
        authorization: 'Bearer invalid',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { token: ownerToken },
        { origin: 'https://evil.example' },
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { token: ownerToken },
        { origin: '' },
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/auth/logout', 'POST', {}, { cookie: session.cookie }))
      .status,
  ).toBe(403)
  const logout = await request('/auth/logout', 'POST', {}, headers)
  expect(logout.status).toBe(200)
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
  expect(
    (await request('/auth/session', 'GET', undefined, headers)).status,
  ).toBe(401)
})

test('members configure password accounts with fresh proof and sign in by normalized email', async () => {
  const session = await login()
  const headers = { cookie: session.cookie, 'x-besh-csrf': session.csrfToken }
  const account = {
    email: ' Owner@Example.COM ',
    password: 'Long password 123!',
  }
  expect((await request('/api/account', 'PUT', account, headers)).status).toBe(
    403,
  )
  const configured = await request(
    '/api/account',
    'PUT',
    { ...account, token: ownerToken },
    headers,
  )
  expect(configured.status).toBe(200)
  expect(await configured.json()).toEqual({ email: 'owner@example.com' })
  expect(
    await (await request('/api/account', 'GET', undefined, headers)).json(),
  ).toEqual({ email: 'owner@example.com' })
  const signedIn = await request('/auth/login', 'POST', {
    email: 'OWNER@example.com',
    password: account.password,
  })
  expect(signedIn.status).toBe(200)
  const otherCookie = signedIn.headers.get('set-cookie')!.split(';')[0]!
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'owner@example.com',
        password: account.password + ' ',
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request(
        '/api/account',
        'PUT',
        {
          email: account.email,
          password: 'New password 456!',
          currentPassword: account.password,
        },
        headers,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/auth/session', 'GET', undefined, { cookie: otherCookie }))
      .status,
  ).toBe(401)
  expect(
    (await request('/auth/session', 'GET', undefined, headers)).status,
  ).toBe(200)
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'owner@example.com',
        password: account.password,
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'owner@example.com',
        password: 'New password 456!',
      })
    ).status,
  ).toBe(200)
})

test('setup and member creation accept optional validated email/password pairs', async () => {
  server.close()
  server = createApp({
    databasePath: join(directory, 'fresh.sqlite'),
    backupDir: join(directory, 'backups'),
    setupKey: 'setup-test',
  })
  expect(
    (
      await request('/setup', 'POST', {
        key: 'setup-test',
        name: 'Accounts',
        email: 'owner@example.com',
      })
    ).status,
  ).toBe(400)
  const setup = await request('/setup', 'POST', {
    key: 'setup-test',
    name: 'Accounts',
    email: 'owner@example.com',
    password: 'Owner password 123!',
  })
  expect(setup.status).toBe(200)
  const key = (await setup.json()).token
  const owner = await login(key)
  const headers = { cookie: owner.cookie, 'x-besh-csrf': owner.csrfToken }
  expect(
    (
      await request(
        '/api/members',
        'POST',
        {
          name: 'Duplicate',
          role: 'viewer',
          email: 'OWNER@example.com',
          password: 'Viewer password 123!',
        },
        headers,
      )
    ).status,
  ).toBe(409)
  expect(
    (
      await request(
        '/api/members',
        'POST',
        {
          name: 'Weak',
          role: 'viewer',
          email: 'weak@example.com',
          password: 'short',
        },
        headers,
      )
    ).status,
  ).toBe(400)
  const created = await request(
    '/api/members',
    'POST',
    {
      name: 'Viewer',
      role: 'viewer',
      email: 'viewer@example.com',
      password: 'Viewer password 123!',
    },
    headers,
  )
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(member.token).toBeString()
  const signedIn = await request('/auth/login', 'POST', {
    email: 'viewer@example.com',
    password: 'Viewer password 123!',
  })
  expect(signedIn.status).toBe(200)
  expect((await signedIn.json()).member.role).toBe('viewer')
  const listed = await (
    await request('/api/members', 'GET', undefined, headers)
  ).json()
  expect(listed).toHaveLength(2)
  expect(JSON.stringify(listed)).not.toContain('password')
  expect(JSON.stringify(listed)).not.toContain('viewer@example.com')
})

test('session lists redact secrets and enforce own-session or owner revocation', async () => {
  const owner = await login()
  const ownerHeaders = { cookie: owner.cookie, 'x-besh-csrf': owner.csrfToken }
  const created = await request(
    '/api/members',
    'POST',
    { name: 'Viewer', role: 'viewer' },
    ownerHeaders,
  )
  const viewer = await created.json()
  const viewerSession = await login(viewer.token)
  const viewerHeaders = {
    cookie: viewerSession.cookie,
    'x-besh-csrf': viewerSession.csrfToken,
  }
  const mine = await request('/api/sessions', 'GET', undefined, viewerHeaders)
  expect(mine.status).toBe(200)
  const listed = await mine.json()
  expect(listed).toHaveLength(1)
  expect(listed[0]).toMatchObject({
    id: viewerSession.sessionId,
    memberId: viewer.id,
    memberName: 'Viewer',
    current: true,
  })
  expect(Object.keys(listed[0]).sort()).toEqual([
    'createdAt',
    'current',
    'expiresAt',
    'id',
    'lastSeenAt',
    'memberId',
    'memberName',
  ])
  expect(
    (
      await request(
        '/api/sessions/' + owner.sessionId,
        'DELETE',
        undefined,
        viewerHeaders,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/members', 'GET', undefined, viewerHeaders)).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/api/members',
        'POST',
        { name: 'Denied', role: 'viewer' },
        viewerHeaders,
      )
    ).status,
  ).toBe(403)
  expect(
    await (
      await request('/api/sessions', 'GET', undefined, ownerHeaders)
    ).json(),
  ).toHaveLength(2)
  expect(
    (
      await request(
        '/api/sessions/' + viewerSession.sessionId,
        'DELETE',
        undefined,
        ownerHeaders,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/api/me', 'GET', undefined, viewerHeaders)).status,
  ).toBe(401)
  const again = await login(viewer.token)
  expect(
    (
      await request(
        '/api/members/' + viewer.id,
        'DELETE',
        undefined,
        ownerHeaders,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/auth/session', 'GET', undefined, { cookie: again.cookie }))
      .status,
  ).toBe(401)
  expect(
    (
      await request(
        '/api/sessions/' + owner.sessionId,
        'DELETE',
        undefined,
        ownerHeaders,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/api/me', 'GET', undefined, ownerHeaders)).status,
  ).toBe(401)
})

test('sessions have fixed expiry and owner key recovery revokes owner sessions', async () => {
  server.close()
  let now = Date.parse('2026-10-08T00:00:00Z')
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: ownerToken,
    now: () => now,
  }
  server = createApp(options)
  const session = await login()
  expect(session.expiresAt).toBe('2026-10-08T12:00:00.000Z')
  now += 11 * 60 * 60 * 1000
  expect(
    (
      await request('/auth/session', 'GET', undefined, {
        cookie: session.cookie,
      })
    ).status,
  ).toBe(200)
  now += 60 * 60 * 1000
  expect(
    (
      await request('/auth/session', 'GET', undefined, {
        cookie: session.cookie,
      })
    ).status,
  ).toBe(401)
  const fresh = await login()
  server.close()
  server = createApp({
    ...options,
    adminToken: 'rotated-owner-key-at-least-32-characters',
  })
  expect(
    (await request('/auth/session', 'GET', undefined, { cookie: fresh.cookie }))
      .status,
  ).toBe(401)
  expect(
    (await request('/auth/login', 'POST', { token: ownerToken })).status,
  ).toBe(401)
  expect(
    (
      await request('/auth/login', 'POST', {
        token: 'rotated-owner-key-at-least-32-characters',
      })
    ).status,
  ).toBe(200)
})

test('login failure throttling survives restart and releases after five minutes', async () => {
  server.close()
  let now = Date.parse('2026-10-08T00:00:00Z')
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: ownerToken,
    now: () => now,
  }
  server = createApp(options)
  for (let attempt = 0; attempt < 10; attempt++) {
    const rejected = await request('/auth/login', 'POST', {
      email: 'missing@example.com',
      password: 'Wrong password 123!',
    })
    expect(rejected.status).toBe(401)
    expect(await rejected.json()).toEqual({ error: 'Invalid credentials' })
  }
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'missing@example.com',
        password: 'Wrong password 123!',
      })
    ).status,
  ).toBe(429)
  server.close()
  server = createApp(options)
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'missing@example.com',
        password: 'Wrong password 123!',
      })
    ).status,
  ).toBe(429)
  expect(
    (await request('/auth/login', 'POST', { token: ownerToken })).status,
  ).toBe(200)
  now += 5 * 60 * 1000
  expect(
    (
      await request('/auth/login', 'POST', {
        email: 'missing@example.com',
        password: 'Wrong password 123!',
      })
    ).status,
  ).toBe(401)
})

test('login bounds active sessions and evicts oldest session for a member', async () => {
  const oldest = await login()
  for (let index = 0; index < 20; index++) await login()
  const headers = { authorization: `Bearer ${ownerToken}` }
  expect(
    await (await request('/api/sessions', 'GET', undefined, headers)).json(),
  ).toHaveLength(20)
  expect(
    (
      await request('/auth/session', 'GET', undefined, {
        cookie: oldest.cookie,
      })
    ).status,
  ).toBe(401)
})

test('session cookies cannot invoke published REST or GraphQL APIs', async () => {
  const session = await login()
  const headers = { cookie: session.cookie, 'x-besh-csrf': session.csrfToken }
  for (const definition of [helloFlow, graphqlFlow]) {
    const flow = await (
      await request('/api/flows', 'POST', definition, headers)
    ).json()
    expect(
      (
        await request(
          '/api/flows/' + flow.id + '/publish',
          'POST',
          { revision: 1 },
          headers,
        )
      ).status,
    ).toBe(200)
    const key = await (
      await request(
        '/api/runtime-keys',
        'POST',
        {
          name: 'Runtime',
          flowId: flow.id,
          permissions: definition === helloFlow ? ['rest'] : ['query'],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        headers,
      )
    ).json()
    const path = definition === helloFlow ? '/run/hello' : '/graphql/hello'
    const method = definition === helloFlow ? 'GET' : 'POST'
    const body =
      definition === helloFlow
        ? undefined
        : { query: '{ greet(name: "Ada") { name } }' }
    expect((await request(path, method, body, headers)).status).toBe(401)
    expect(
      (
        await request(path, method, body, {
          ...headers,
          authorization: `Bearer ${ownerToken}`,
        })
      ).status,
    ).toBe(401)
    expect(
      (
        await request(path, method, body, {
          ...headers,
          authorization: `Bearer ${key.token}`,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await request('/api/me', 'GET', undefined, {
          ...headers,
          authorization: `Bearer ${key.token}`,
        })
      ).status,
    ).toBe(401)
  }
})

test('configured browser origin survives internal proxy URL and sets HTTPS Secure cookies', async () => {
  server.close()
  server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: ownerToken,
    authOrigin: 'https://besh.example',
  })
  const response = await request(
    '/auth/login',
    'POST',
    { token: ownerToken },
    { origin: 'https://besh.example' },
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('set-cookie')).toContain('; Secure')
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { token: ownerToken },
        {
          origin,
          'x-forwarded-host': 'besh.example',
          'x-forwarded-proto': 'https',
        },
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { token: ownerToken },
        { origin: 'https://besh.example.attacker.test' },
      )
    ).status,
  ).toBe(403)
  expect(() =>
    createApp({
      databasePath: join(directory, 'invalid.sqlite'),
      backupDir: join(directory, 'backups'),
      authOrigin: 'http://public.example',
    }),
  ).toThrow('BESH_WEB_URL')
})

test('accounts and sessions persist through restart and an actual downloaded backup restore', async () => {
  const session = await login()
  const headers = { cookie: session.cookie, 'x-besh-csrf': session.csrfToken }
  const account = {
    email: 'owner@example.com',
    password: 'Owner password 123!',
    token: ownerToken,
  }
  expect((await request('/api/account', 'PUT', account, headers)).status).toBe(
    200,
  )
  const migrations = await (
    await request('/api/migrations', 'GET', undefined, headers)
  ).json()
  expect(
    migrations.find(
      (migration: { version: number }) => migration.version === 8,
    ),
  ).toMatchObject({
    version: 8,
    name: 'workspace accounts and sessions',
  })
  const backup = await (
    await request('/api/backups', 'POST', {}, headers)
  ).json()
  const download = await request(
    '/api/backups/' + backup.id,
    'GET',
    undefined,
    headers,
  )
  expect(download.status).toBe(200)
  const restoredPath = join(directory, 'restored.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await download.arrayBuffer()))
  server.close()
  server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
  })
  expect(
    (await request('/auth/session', 'GET', undefined, headers)).status,
  ).toBe(200)
  expect((await request('/auth/logout', 'POST', {}, headers)).status).toBe(200)
  server.close()
  server = createApp({
    databasePath: restoredPath,
    backupDir: join(directory, 'restored-backups'),
  })
  expect(
    (await request('/auth/session', 'GET', undefined, headers)).status,
  ).toBe(200)
  expect(
    (
      await request('/auth/login', 'POST', {
        email: account.email,
        password: account.password,
      })
    ).status,
  ).toBe(200)
  const events = await (
    await request('/api/audit', 'GET', undefined, headers)
  ).json()
  expect(
    events.some(
      (event: { action: string }) => event.action === 'account.updated',
    ),
  ).toBe(true)
  expect(JSON.stringify(events)).not.toContain(account.email)
  expect(JSON.stringify(events)).not.toContain(account.password)
  expect(JSON.stringify(events)).not.toContain(ownerToken)
})
