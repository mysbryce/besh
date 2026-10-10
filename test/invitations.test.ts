import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Database } from 'bun:sqlite'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'invitation-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>
let clock: number

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-invitations-'))
  clock = Date.now()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    now: () => clock,
  })
})

afterEach(async () => {
  await server.close()
  const target = resolve(directory)
  const parent = resolve(tmpdir())
  expect(target.toLowerCase().startsWith((parent + sep).toLowerCase())).toBe(
    true,
  )
  expect(basename(target).startsWith('besh-invitations-')).toBe(true)
  rmSync(target, { recursive: true, force: true })
})

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  token: string | null = owner,
  headers: Record<string, string> = {},
) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function member() {
  const result = await request('/api/members', 'POST', {
    name: 'Invited viewer',
    role: 'viewer',
  })
  expect(result.status).toBe(200)
  return result.json() as Promise<{ id: string; token: string }>
}

test('owner issues a fixed one-day link and only metadata remains in its active list', async () => {
  const target = await member()
  const result = await request('/api/invitations', 'POST', {
    memberId: target.id,
    email: '  Invitee@Example.com  ',
  })
  expect(result.status).toBe(200)
  const invitation = await result.json()
  expect(invitation).toEqual({
    id: expect.any(String),
    memberId: target.id,
    memberName: 'Invited viewer',
    email: 'invitee@example.com',
    createdAt: new Date(clock).toISOString(),
    expiresAt: new Date(clock + 86_400_000).toISOString(),
    token: expect.any(String),
  })
  expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  const { token, ...metadata } = invitation
  expect(await (await request('/api/invitations')).json()).toEqual([metadata])
  expect(
    (await request('/api/invitations', 'GET', undefined, target.token)).status,
  ).toBe(403)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string }) => entry.action === 'invitation.created',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(audit)).not.toContain(token)
  expect(JSON.stringify(audit)).not.toContain('invitee@example.com')
})

test('public preview reviews current member metadata; reissue and exact revoke invalidate original links', async () => {
  const target = await member()
  const first = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'first@example.com',
    })
  ).json()
  const preview = await request(
    '/auth/invitations/preview',
    'POST',
    { token: first.token },
    null,
  )
  expect(preview.status).toBe(200)
  expect(await preview.json()).toEqual({
    workspaceName: 'My workspace',
    memberName: 'Invited viewer',
    email: 'first@example.com',
    roleName: 'Viewer',
    accessMode: 'all',
    expiresAt: first.expiresAt,
  })
  const secondResult = await request('/api/invitations', 'POST', {
    memberId: target.id,
    email: 'second@example.com',
  })
  expect(secondResult.status).toBe(200)
  const second = await secondResult.json()
  expect(second.id).not.toBe(first.id)
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: first.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request(`/api/invitations/${second.id}`, 'DELETE')).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: second.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(await (await request('/api/invitations')).json()).toEqual([])
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string }) => entry.action === 'invitation.created',
    ),
  ).toHaveLength(2)
  expect(
    audit.filter(
      (entry: { action: string }) => entry.action === 'invitation.revoked',
    ),
  ).toHaveLength(2)
  expect(JSON.stringify(audit)).not.toContain('first@example.com')
  expect(JSON.stringify(audit)).not.toContain(second.token)
})

test('accept inserts the invited account once, preserves membership and key, and revokes prior sessions without signing in', async () => {
  const target = await member()
  const before = await (
    await request('/api/me', 'GET', undefined, target.token)
  ).json()
  const signedIn = await request(
    '/auth/login',
    'POST',
    { token: target.token },
    null,
  )
  const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'welcome@example.com',
    })
  ).json()
  const result = await request(
    '/auth/invitations/accept',
    'POST',
    { token: invitation.token, password: 'New password 123!' },
    null,
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({
    ok: true,
    email: 'welcome@example.com',
  })
  expect(result.headers.has('set-cookie')).toBe(false)
  expect(
    (await request('/auth/session', 'GET', undefined, null, { cookie })).status,
  ).toBe(401)
  expect((await request('/auth/session', 'GET', undefined, null)).status).toBe(
    401,
  )
  expect(
    await (await request('/api/me', 'GET', undefined, target.token)).json(),
  ).toEqual(before)
  expect(await (await request('/api/invitations')).json()).toEqual([])
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Another password 123!' },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { email: 'welcome@example.com', password: 'New password 123!' },
        null,
      )
    ).status,
  ).toBe(200)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string }) => entry.action === 'invitation.accepted',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(audit)).not.toContain(invitation.token)
  expect(JSON.stringify(audit)).not.toContain('welcome@example.com')
  expect(JSON.stringify(audit)).not.toContain('New password')
})

test('owner target metadata identifies key-only members without exposing account state to self metadata', async () => {
  const target = await member()
  expect(
    (await (await request('/api/members')).json()).find(
      (entry: { id: string }) => entry.id === target.id,
    ).hasAccount,
  ).toBe(false)
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'target@example.com',
    })
  ).json()
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Target password 123!' },
        null,
      )
    ).status,
  ).toBe(200)
  expect(
    (await (await request('/api/members')).json()).find(
      (entry: { id: string }) => entry.id === target.id,
    ).hasAccount,
  ).toBe(true)
  expect(
    await (await request('/api/me', 'GET', undefined, target.token)).json(),
  ).not.toHaveProperty('hasAccount')
  expect(
    (
      await request('/api/invitations', 'POST', {
        memberId: target.id,
        email: 'other@example.com',
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request('/api/invitations', 'POST', {
        memberId: 'owner',
        email: 'owner@example.com',
      })
    ).status,
  ).toBe(409)
})

test('changing the invited member role invalidates the pending link in the same update', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'stale@example.com',
    })
  ).json()
  expect(
    (await request(`/api/members/${target.id}/role`, 'PUT', { role: 'editor' }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Never set password 123!' },
        null,
      )
    ).status,
  ).toBe(404)
  expect(await (await request('/api/invitations')).json()).toEqual([])
  expect(
    (await (await request('/api/members')).json()).find(
      (entry: { id: string }) => entry.id === target.id,
    ).hasAccount,
  ).toBe(false)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'invitation.revoked' &&
        entry.resource === invitation.id,
    ),
  ).toHaveLength(1)
})

test('self account setup revokes a pending invitation without replacing the chosen account', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'invited@example.com',
    })
  ).json()
  expect(
    (
      await request(
        '/api/account',
        'PUT',
        {
          email: 'chosen@example.com',
          password: 'Chosen password 123!',
          token: target.token,
        },
        target.token,
      )
    ).status,
  ).toBe(200)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string; resource: string }) =>
        entry.action === 'invitation.revoked' &&
        entry.resource === invitation.id,
    ),
  ).toHaveLength(1)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Ignored password 123!' },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { email: 'chosen@example.com', password: 'Chosen password 123!' },
        null,
      )
    ).status,
  ).toBe(200)
})

test('changing the recovery owner key clears every pending link on restart', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'recovery@example.com',
    })
  ).json()
  await server.close()
  const replacement = 'replacement-owner-recovery-key-at-least-32-characters'
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: replacement,
    now: () => clock,
  })
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    await (
      await request('/api/invitations', 'GET', undefined, replacement)
    ).json(),
  ).toEqual([])
  expect(
    (await request('/api/me', 'GET', undefined, target.token)).status,
  ).toBe(200)
})

test('a downloaded backup with an invalid invitation deadline fails closed rather than accepting forever', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'malformed@example.com',
    })
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const bytes = new Uint8Array(
    await (await request(`/api/backups/${backup.id}`)).arrayBuffer(),
  )
  const path = join(directory, 'detached-invalid.sqlite')
  writeFileSync(path, bytes)
  // Only an offline, downloaded copy is edited. Observations stay public HTTP.
  const detached = new Database(path)
  try {
    detached
      .query('UPDATE invitations SET expires_at = ? WHERE id = ?')
      .run('not-a-date', invitation.id)
  } finally {
    detached.close()
  }
  await server.close()
  server = createApp({
    databasePath: path,
    backupDir: join(directory, 'restored-backups'),
    adminToken: owner,
    now: () => clock,
  })
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Never valid password 123!' },
        null,
      )
    ).status,
  ).toBe(404)
  expect((await request('/api/invitations')).status).toBe(503)
})

test('invitation revocation rejects a null body without deleting the pending link', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'strict@example.com',
    })
  ).json()
  expect(
    (await request(`/api/invitations/${invitation.id}`, 'DELETE', null)).status,
  ).toBe(400)
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(200)
})

test('original owner cookie proof and public exact Origin stay mandatory; unavailable tokens share one response', async () => {
  const target = await member()
  const login = await request('/auth/login', 'POST', { token: owner }, null)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const { csrfToken } = await login.json()
  const input = { memberId: target.id, email: 'origin@example.com' }
  expect(
    (await request('/api/invitations', 'POST', input, null, { cookie })).status,
  ).toBe(403)
  expect(
    (
      await request('/api/invitations', 'POST', input, null, {
        cookie,
        'x-besh-csrf': csrfToken,
        origin: 'https://evil.example',
      })
    ).status,
  ).toBe(403)
  expect(
    (
      await request('/api/invitations', 'POST', input, 'invalid', {
        cookie,
        'x-besh-csrf': csrfToken,
      })
    ).status,
  ).toBe(401)
  const result = await request('/api/invitations', 'POST', input, null, {
    cookie,
    'x-besh-csrf': csrfToken,
  })
  expect(result.status).toBe(200)
  const invitation = await result.json()
  for (const operation of ['preview', 'accept']) {
    const body = {
      token: invitation.token,
      ...(operation === 'accept' ? { password: 'Origin password 123!' } : {}),
    }
    for (const rejectedOrigin of ['', 'https://evil.example', origin + '/']) {
      expect(
        (
          await request('/auth/invitations/' + operation, 'POST', body, null, {
            origin: rejectedOrigin,
          })
        ).status,
      ).toBe(403)
    }
    expect(
      (
        await request(
          '/auth/invitations/' + operation,
          'POST',
          { ...body, email: 'attacker@example.com' },
          null,
        )
      ).status,
    ).toBe(400)
  }
  const unavailable = await request(
    '/auth/invitations/preview',
    'POST',
    { token: 'a'.repeat(43) },
    null,
  )
  expect(unavailable.status).toBe(404)
  const generic = await unavailable.json()
  expect(generic).toEqual({ error: 'Invitation unavailable' })
  expect(
    await (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: 'invalid' },
        null,
      )
    ).json(),
  ).toEqual(generic)
  clock += 86_400_000
  const expired = await request(
    '/auth/invitations/accept',
    'POST',
    { token: invitation.token, password: 'Origin password 123!' },
    null,
  )
  expect(expired.status).toBe(404)
  expect(await expired.json()).toEqual(generic)
  expect(await (await request('/api/invitations')).json()).toEqual([])
  expect(
    (await (await request('/api/members')).json()).find(
      (entry: { id: string }) => entry.id === target.id,
    ).hasAccount,
  ).toBe(false)
})

test('two app connections accept one invitation exactly once without overwriting the winner password', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'winner@example.com',
    })
  ).json()
  const peer = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'peer-backups'),
    adminToken: owner,
    now: () => clock,
  })
  const passwords = [
    'First concurrent password 123!',
    'Second concurrent password 123!',
  ]
  try {
    const replies = await Promise.all([
      request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: passwords[0] },
        null,
      ),
      peer.app.handle(
        new Request(origin + '/auth/invitations/accept', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            token: invitation.token,
            password: passwords[1],
          }),
        }),
      ),
    ])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 404])
    const winner = replies.findIndex((reply) => reply.status === 200)
    expect(
      (
        await request(
          '/auth/login',
          'POST',
          { email: 'winner@example.com', password: passwords[winner] },
          null,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await request(
          '/auth/login',
          'POST',
          { email: 'winner@example.com', password: passwords[1 - winner] },
          null,
        )
      ).status,
    ).toBe(401)
    const audit = await (await request('/api/audit')).json()
    expect(
      audit.filter(
        (entry: { action: string }) => entry.action === 'invitation.accepted',
      ),
    ).toHaveLength(1)
    expect(await (await request('/api/invitations')).json()).toEqual([])
  } finally {
    await peer.close()
  }
})

test('post-admission deletion, reissue and expiry deny pending password work before account insertion', async () => {
  for (const change of ['delete', 'reissue', 'expire'] as const) {
    const target = await member()
    const invitation = await (
      await request('/api/invitations', 'POST', {
        memberId: target.id,
        email: `${change}@example.com`,
      })
    ).json()
    // The public tenth-attempt budget proves acceptance admitted its work;
    // its password hash is the next asynchronous boundary, without a mock/delay.
    for (let count = 0; count < 9; count++)
      expect(
        (
          await request(
            '/auth/invitations/preview',
            'POST',
            { token: invitation.token },
            null,
          )
        ).status,
      ).toBe(200)
    let settled = false
    const pending = request(
      '/auth/invitations/accept',
      'POST',
      { token: invitation.token, password: 'Pending password 123!' },
      null,
    ).finally(() => {
      settled = true
    })
    expect(
      (
        await request(
          '/auth/invitations/preview',
          'POST',
          { token: invitation.token },
          null,
        )
      ).status,
    ).toBe(429)
    expect(settled).toBe(false)
    if (change === 'delete')
      expect(
        (await request(`/api/members/${target.id}`, 'DELETE')).status,
      ).toBe(200)
    else if (change === 'reissue')
      expect(
        (
          await request('/api/invitations', 'POST', {
            memberId: target.id,
            email: 'new-link@example.com',
          })
        ).status,
      ).toBe(200)
    else clock += 86_400_000
    const result = await pending
    expect(result.status).toBe(404)
    const audit = await (await request('/api/audit')).json()
    expect(
      audit.filter(
        (entry: { action: string; resource: string }) =>
          entry.action === 'invitation.accepted' &&
          entry.resource === invitation.id,
      ),
    ).toHaveLength(0)
    expect(
      (
        await request(
          '/auth/login',
          'POST',
          { email: `${change}@example.com`, password: 'Pending password 123!' },
          null,
        )
      ).status,
    ).toBe(401)
  }
})

test('accept preserves a custom selected member role, access and tenant clocks; concurrent email claims cannot overwrite an account', async () => {
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Invited limited reader',
      permissions: ['flows.read'],
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Assigned company',
      value: ' exact A ',
    })
  ).json()
  const targetResult = await request('/api/members', 'POST', {
    name: 'Assigned invitee',
    role: 'custom',
    roleId: role.id,
    tenantId: tenant.id,
    access: {
      mode: 'selected',
      flowIds: [],
      dependencyUse: {
        sources: [],
        databaseConnections: [],
        authConnections: [],
      },
    },
  })
  expect(targetResult.status).toBe(200)
  const target = await targetResult.json()
  const before = await (
    await request('/api/me', 'GET', undefined, target.token)
  ).json()
  expect(before).toMatchObject({
    role: 'custom',
    roleId: role.id,
    permissions: ['flows.read'],
    access: { mode: 'selected', flowIds: [], version: 1 },
    tenantAssignment: { tenantId: tenant.id, version: 1 },
  })
  const other = await member()
  const receipts = []
  for (const actor of [target, other])
    receipts.push(
      await (
        await request('/api/invitations', 'POST', {
          memberId: actor.id,
          email: 'shared-email@example.com',
        })
      ).json(),
    )
  const replies = await Promise.all(
    receipts.map((receipt, index) =>
      request(
        '/auth/invitations/accept',
        'POST',
        { token: receipt.token, password: `Unique claimed password ${index}!` },
        null,
      ),
    ),
  )
  expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])
  const winner = replies.findIndex((reply) => reply.status === 200)
  const loser = 1 - winner
  expect(await replies[loser]!.json()).toEqual({
    error: 'Email address unavailable',
  })
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        {
          email: 'shared-email@example.com',
          password: `Unique claimed password ${winner}!`,
        },
        null,
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        {
          email: 'shared-email@example.com',
          password: `Unique claimed password ${loser}!`,
        },
        null,
      )
    ).status,
  ).toBe(401)
  expect(
    await (await request('/api/me', 'GET', undefined, target.token)).json(),
  ).toEqual(before)
  const members = await (await request('/api/members')).json()
  expect(
    members.filter((entry: { hasAccount: boolean }) => entry.hasAccount),
  ).toHaveLength(1)
  expect(
    (await (await request('/api/invitations')).json()).map(
      (entry: { id: string }) => entry.id,
    ),
  ).toEqual([receipts[loser].id])
})

test('invitation attempt windows survive restart, reset after five minutes, and do not throttle member login', async () => {
  const target = await member()
  const invitation = await (
    await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: 'limits@example.com',
    })
  ).json()
  for (let count = 0; count < 10; count++)
    expect(
      (
        await request(
          '/auth/invitations/preview',
          'POST',
          { token: invitation.token },
          null,
        )
      ).status,
    ).toBe(200)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitation.token, password: 'Limited password 123!' },
        null,
      )
    ).status,
  ).toBe(429)
  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    now: () => clock,
  })
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(429)
  expect(
    (await request('/auth/login', 'POST', { token: target.token }, null))
      .status,
  ).toBe(200)
  clock += 300_000
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: invitation.token },
        null,
      )
    ).status,
  ).toBe(200)
  clock += 300_000
  for (let identity = 0; identity < 10; identity++) {
    const token = String(identity).padStart(43, 'a')
    for (let count = 0; count < 10; count++)
      expect(
        (await request('/auth/invitations/preview', 'POST', { token }, null))
          .status,
      ).toBe(404)
  }
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: 'z'.repeat(43) },
        null,
      )
    ).status,
  ).toBe(429)
  expect(
    (await request('/auth/login', 'POST', { token: target.token }, null))
      .status,
  ).toBe(200)
  clock += 300_000
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: 'z'.repeat(43) },
        null,
      )
    ).status,
  ).toBe(404)
})

test('the process admits at most four concurrent invitation hashes across app handles', async () => {
  const invitations: { token: string }[] = []
  for (let index = 0; index < 5; index++) {
    const target = await member()
    invitations.push(
      await (
        await request('/api/invitations', 'POST', {
          memberId: target.id,
          email: `hash-${index}@example.com`,
        })
      ).json(),
    )
  }
  const peer = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'peer-backups'),
    adminToken: owner,
    now: () => clock,
  })
  try {
    const replies = await Promise.all(
      invitations.map((invitation, index) => {
        const body = {
          token: invitation.token,
          password: `Concurrent safe password ${index}!`,
        }
        return index % 2
          ? peer.app.handle(
              new Request(origin + '/auth/invitations/accept', {
                method: 'POST',
                headers: { origin, 'content-type': 'application/json' },
                body: JSON.stringify(body),
              }),
            )
          : request('/auth/invitations/accept', 'POST', body, null)
      }),
    )
    expect(replies.map((reply) => reply.status).sort()).toEqual([
      200, 200, 200, 200, 429,
    ])
    const retry = replies.findIndex((reply) => reply.status === 429)
    expect(
      (
        await request(
          '/auth/invitations/accept',
          'POST',
          {
            token: invitations[retry]!.token,
            password: 'Retry safe password 123!',
          },
          null,
        )
      ).status,
    ).toBe(200)
    expect(await (await request('/api/invitations')).json()).toEqual([])
  } finally {
    await peer.close()
  }
})

test('256 pending links bound storage, reissue keeps its slot, and expired links release capacity', async () => {
  let first: { id: string; token: string } | undefined
  for (let index = 0; index < 256; index++) {
    const target = await member()
    first ??= target
    const response = await request('/api/invitations', 'POST', {
      memberId: target.id,
      email: `pending-${index}@example.com`,
    })
    expect(response.status).toBe(200)
  }
  const extra = await member()
  const before = await (await request('/api/audit')).json()
  expect(
    (
      await request('/api/invitations', 'POST', {
        memberId: extra.id,
        email: 'excess@example.com',
      })
    ).status,
  ).toBe(409)
  expect(await (await request('/api/audit')).json()).toEqual(before)
  expect(await (await request('/api/invitations')).json()).toHaveLength(256)
  const replacement = await request('/api/invitations', 'POST', {
    memberId: first!.id,
    email: 'replacement@example.com',
  })
  expect(replacement.status).toBe(200)
  expect(await (await request('/api/invitations')).json()).toHaveLength(256)
  const previous = await replacement.json()
  clock += 86_400_000
  expect(
    (
      await request('/api/invitations', 'POST', {
        memberId: extra.id,
        email: 'fresh@example.com',
      })
    ).status,
  ).toBe(200)
  expect(await (await request('/api/invitations')).json()).toHaveLength(1)
  expect(
    (
      await request(
        '/auth/invitations/preview',
        'POST',
        { token: previous.token },
        null,
      )
    ).status,
  ).toBe(404)
})

test('downloaded current backup restores pending links and consumed account state without creating a session', async () => {
  const used = await member()
  const pending = await member()
  const invitations = []
  for (const [target, email] of [
    [used, 'used@example.com'],
    [pending, 'pending@example.com'],
  ] as const)
    invitations.push(
      await (
        await request('/api/invitations', 'POST', {
          memberId: target.id,
          email,
        })
      ).json(),
    )
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitations[0].token, password: 'Restored password 123!' },
        null,
      )
    ).status,
  ).toBe(200)
  const metadata = await (await request('/api/invitations')).json()
  expect(metadata).toHaveLength(1)
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())
  expect(bytes.byteLength).toBe(backup.bytes)
  const pristine = join(directory, 'pristine.sqlite')
  const restored = join(directory, 'restored.sqlite')
  writeFileSync(pristine, bytes)
  writeFileSync(restored, bytes)
  const hash = createHash('sha256').update(bytes).digest('hex')
  await server.close()
  server = createApp({
    databasePath: restored,
    backupDir: join(directory, 'restored-backups'),
    adminToken: owner,
    now: () => clock,
  })
  expect(
    (await (await request('/api/migrations')).json()).find(
      (migration: { version: number }) => migration.version === 23,
    ),
  ).toMatchObject({
    version: 23,
    name: 'one-time workspace member invitations',
  })
  expect(await (await request('/api/invitations')).json()).toEqual(metadata)
  expect(
    (
      await request(
        '/auth/invitations/accept',
        'POST',
        { token: invitations[0].token, password: 'Wrong reset password 123!' },
        null,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        '/auth/login',
        'POST',
        { email: 'used@example.com', password: 'Restored password 123!' },
        null,
      )
    ).status,
  ).toBe(200)
  const accepted = await request(
    '/auth/invitations/accept',
    'POST',
    { token: invitations[1].token, password: 'Pending restored password 123!' },
    null,
  )
  expect(accepted.status).toBe(200)
  expect(accepted.headers.has('set-cookie')).toBe(false)
  expect(
    (await request('/api/me', 'GET', undefined, pending.token)).status,
  ).toBe(200)
  expect(
    createHash('sha256').update(readFileSync(pristine)).digest('hex'),
  ).toBe(hash)
})

test('current API access, custom role grants and tenant assignment changes conservatively revoke pending links', async () => {
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Pending custom reader',
      permissions: ['flows.read'],
    })
  ).json()
  const tenant = await (
    await request('/api/tenants', 'POST', {
      label: 'Pending company',
      value: 'company',
    })
  ).json()
  for (const change of ['access', 'grants', 'assignment'] as const) {
    const target = await (
      await request('/api/members', 'POST', {
        name: 'Pending ' + change,
        role: 'custom',
        roleId: role.id,
      })
    ).json()
    const invitation = await (
      await request('/api/invitations', 'POST', {
        memberId: target.id,
        email: `${change}@example.com`,
      })
    ).json()
    const changed =
      change === 'access'
        ? await request(`/api/members/${target.id}/access`, 'PUT', {
            mode: 'all',
            version: 1,
          })
        : change === 'grants'
          ? await request(`/api/roles/${role.id}`, 'PUT', {
              name: role.name,
              permissions: ['flows.read', 'flows.write'],
              version: 1,
            })
          : await request(`/api/members/${target.id}/tenant`, 'PUT', {
              tenantId: tenant.id,
              version: 1,
            })
    expect(changed.status).toBe(200)
    expect(
      (
        await request(
          '/auth/invitations/preview',
          'POST',
          { token: invitation.token },
          null,
        )
      ).status,
    ).toBe(404)
    const audit = await (await request('/api/audit')).json()
    expect(
      audit.filter(
        (entry: { action: string; resource: string }) =>
          entry.action === 'invitation.revoked' &&
          entry.resource === invitation.id,
      ),
    ).toHaveLength(1)
  }
})
