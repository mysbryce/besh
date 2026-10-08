import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow } from './fixtures'

const owner = 'flow-access-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-flow-access-'))
  const options = {
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  }
  let server = createApp(options)
  cleanup.push(async () => {
    await server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  const request = (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
    raw = false,
    headers: Record<string, string> = {},
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body:
          body === undefined
            ? undefined
            : raw
              ? String(body)
              : JSON.stringify(body),
      }),
    )
  return {
    request,
    async reopen() {
      await server.close()
      server = createApp(options)
    },
  }
}

test('existing roles default to all API reads with versioned member scope after restart', async () => {
  const { request, reopen } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reviewer', role: 'viewer' })
  ).json()
  expect(viewer.flowAccess).toEqual({ mode: 'all', flowIds: [], version: 1 })
  expect((await (await request('/api/me')).json()).flowAccess).toEqual({
    mode: 'all',
    flowIds: [],
    version: 1,
  })
  await reopen()
  expect(
    (await (await request('/api/me', 'GET', undefined, viewer.token)).json())
      .flowAccess,
  ).toEqual({ mode: 'all', flowIds: [], version: 1 })
  expect(
    (
      await (await request('/api/flows', 'GET', undefined, viewer.token)).json()
    ).map((entry: { id: string }) => entry.id),
  ).toEqual([flow.id])
})

test('owners select API reads and members cannot read unshared definitions or exports', async () => {
  const { request } = workspace()
  const visible = await (await request('/api/flows', 'POST', helloFlow)).json()
  const hidden = await (
    await request('/api/flows', 'POST', {
      ...helloFlow,
      name: 'Private API',
      path: '/private',
    })
  ).json()
  await request(`/api/flows/${visible.id}/publish`, 'POST', { revision: 1 })
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reviewer', role: 'viewer' })
  ).json()
  const changed = await request(
    `/api/members/${viewer.id}/flow-access`,
    'PUT',
    { mode: 'selected', flowIds: [visible.id], version: 1 },
  )
  expect(changed.status).toBe(200)
  expect((await changed.json()).flowAccess).toEqual({
    mode: 'selected',
    flowIds: [visible.id],
    version: 2,
  })
  expect(
    (
      await (await request('/api/flows', 'GET', undefined, viewer.token)).json()
    ).map((entry: { id: string }) => entry.id),
  ).toEqual([visible.id])
  for (const suffix of [
    '',
    '/releases',
    '/releases/not-a-revision',
    '/openapi?source=wrong',
    '/client-code?source=bad&source=bad',
    '/backend-code?revision=bad',
  ]) {
    const denied = await request(
      `/api/flows/${hidden.id}${suffix}`,
      'GET',
      undefined,
      viewer.token,
    )
    const missing = await request(
      `/api/flows/missing${suffix}`,
      'GET',
      undefined,
      viewer.token,
    )
    expect(denied.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await denied.json()).toEqual(await missing.json())
  }
  for (const suffix of [
    '',
    '/releases',
    '/releases/1',
    '/openapi?source=published',
    '/client-code?source=published',
    '/backend-code?revision=1',
  ])
    expect(
      (
        await request(
          `/api/flows/${visible.id}${suffix}`,
          'GET',
          undefined,
          viewer.token,
        )
      ).status,
    ).toBe(200)
  expect(
    (
      await request(
        `/api/flows/${hidden.id}/client-code`,
        'POST',
        {},
        viewer.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (await request('/api/client-code/targets', 'GET', undefined, viewer.token))
      .status,
  ).toBe(200)
})

test('selected member creation is atomic and role changes cannot grant global actions', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Reader',
      permissions: ['flows.read'],
    })
  ).json()
  const created = await request('/api/members', 'POST', {
    name: 'Selected',
    role: 'custom',
    roleId: role.id,
    flowAccess: { mode: 'selected', flowIds: [flow.id] },
  })
  expect(created.status).toBe(200)
  const member = await created.json()
  expect(member.flowAccess).toEqual({
    mode: 'selected',
    flowIds: [flow.id],
    version: 1,
  })
  const auditBefore = await (await request('/api/audit')).json()
  expect(
    (await request(`/api/members/${member.id}/role`, 'PUT', { role: 'editor' }))
      .status,
  ).toBe(409)
  expect(
    (
      await request(`/api/roles/${role.id}`, 'PUT', {
        name: role.name,
        permissions: ['flows.read', 'sources.read'],
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .permissions,
  ).toEqual(['flows.read'])
  const count = (await (await request('/api/members')).json()).length
  expect(
    (
      await request('/api/members', 'POST', {
        name: 'Invalid',
        role: 'editor',
        flowAccess: { mode: 'selected', flowIds: [] },
      })
    ).status,
  ).toBe(400)
  expect((await (await request('/api/members')).json()).length).toBe(count)
  expect(
    (await request(`/api/members/${member.id}/role`, 'PUT', { role: 'viewer' }))
      .status,
  ).toBe(200)
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .flowAccess,
  ).toEqual({ mode: 'selected', flowIds: [flow.id], version: 2 })
  expect(
    (
      await request(`/api/members/${member.id}/flow-access`, 'PUT', {
        mode: 'all',
        version: 1,
      })
    ).status,
  ).toBe(409)
})

test('selected read policy runs before request parsing and global resources stay forbidden', async () => {
  const { request } = workspace()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'No APIs',
      role: 'viewer',
      flowAccess: { mode: 'selected', flowIds: [] },
    })
  ).json()
  const malformed = await request(
    '/api/flows/missing/client-code',
    'POST',
    '{broken',
    member.token,
    true,
  )
  expect(malformed.status).toBe(404)
  for (const path of [
    '/api/data-sources',
    '/api/database-connections',
    '/api/auth-connections',
    '/api/runtime-keys',
    '/api/audit',
    '/api/backups',
    '/api/migrations',
    '/api/load-tests',
    '/api/load-tests/targets',
    '/api/roles',
    '/api/members',
    '/api/updates',
  ])
    expect((await request(path, 'GET', undefined, member.token)).status).toBe(
      403,
    )
  for (const path of [
    '/api/me',
    '/api/account',
    '/api/sessions',
    '/api/permissions',
    '/api/client-code/targets',
  ])
    expect((await request(path, 'GET', undefined, member.token)).status).toBe(
      200,
    )
  expect(
    (await request('/api/flows', 'GET', undefined, member.token)).status,
  ).toBe(200)
})

test('scope saves are strict and versioned, revoke browser sessions, and leave rejected changes atomic', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reviewer', role: 'viewer' })
  ).json()
  const login = await request(
    '/auth/login',
    'POST',
    { token: viewer.token },
    '',
    false,
    { origin: 'http://localhost' },
  )
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(
    (await request('/auth/session', 'GET', undefined, '', false, { cookie }))
      .status,
  ).toBe(200)
  const invalid = [
    { mode: 'all' },
    { mode: 'all', version: 0 },
    { mode: 'all', version: 1, flowIds: [] },
    { mode: 'selected', version: 1 },
    { mode: 'selected', version: 1, flowIds: [flow.id, flow.id] },
    {
      mode: 'selected',
      version: 1,
      flowIds: Array.from({ length: 257 }, (_, i) => `flow-${i}`),
    },
    { mode: 'selected', version: 1, flowIds: [], role: 'viewer' },
  ]
  const auditBefore = await (await request('/api/audit')).json()
  for (const body of invalid)
    expect(
      (await request(`/api/members/${viewer.id}/flow-access`, 'PUT', body))
        .status,
    ).toBe(400)
  expect(
    (
      await request(`/api/members/${viewer.id}/flow-access`, 'PUT', {
        mode: 'selected',
        version: 1,
        flowIds: [flow.id, 'missing'],
      })
    ).status,
  ).toBe(404)
  expect(
    (
      await request('/api/members/owner/flow-access', 'PUT', {
        mode: 'selected',
        version: 1,
        flowIds: [],
      })
    ).status,
  ).toBe(409)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  expect(
    (await request('/auth/session', 'GET', undefined, '', false, { cookie }))
      .status,
  ).toBe(200)
  const race = await Promise.all([
    request(`/api/members/${viewer.id}/flow-access`, 'PUT', {
      mode: 'selected',
      version: 1,
      flowIds: [flow.id],
    }),
    request(`/api/members/${viewer.id}/flow-access`, 'PUT', {
      mode: 'selected',
      version: 1,
      flowIds: [],
    }),
  ])
  expect(race.map((response) => response.status).sort()).toEqual([200, 409])
  expect(
    (await request('/auth/session', 'GET', undefined, '', false, { cookie }))
      .status,
  ).toBe(401)
  const live = await (
    await request('/api/me', 'GET', undefined, viewer.token)
  ).json()
  expect(live.flowAccess.version).toBe(2)
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) =>
        event.action === 'member.flow-access.updated',
    ),
  ).toHaveLength(1)
  expect(
    (
      await request(
        `/api/members/${viewer.id}/flow-access`,
        'PUT',
        { mode: 'all', version: 2 },
        viewer.token,
      )
    ).status,
  ).toBe(403)
  const reset = await request(`/api/members/${viewer.id}/flow-access`, 'PUT', {
    mode: 'all',
    version: 2,
  })
  expect((await reset.json()).flowAccess).toEqual({
    mode: 'all',
    flowIds: [],
    version: 3,
  })
  expect(
    (await request(`/api/flows/${flow.id}`, 'GET', undefined, viewer.token))
      .status,
  ).toBe(200)
})

test('selected account access stays private and ungranted custom roles gain no implicit read', async () => {
  const { request } = workspace()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Selected',
      role: 'viewer',
      flowAccess: { mode: 'selected', flowIds: [] },
    })
  ).json()
  const other = await (
    await request('/api/members', 'POST', { name: 'Other', role: 'viewer' })
  ).json()
  const otherLogin = await request(
    '/auth/login',
    'POST',
    { token: other.token },
    '',
    false,
    { origin: 'http://localhost' },
  )
  const otherSession = await otherLogin.json()
  expect(
    await (
      await request('/api/sessions', 'GET', undefined, member.token)
    ).json(),
  ).toEqual([])
  const inaccessible = await request(
    `/api/sessions/${otherSession.sessionId}`,
    'DELETE',
    undefined,
    member.token,
  )
  const missing = await request(
    '/api/sessions/missing',
    'DELETE',
    undefined,
    member.token,
  )
  expect(inaccessible.status).toBe(404)
  expect(await inaccessible.json()).toEqual(await missing.json())
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Account only',
      permissions: [],
    })
  ).json()
  const empty = await (
    await request('/api/members', 'POST', {
      name: 'No grants',
      role: 'custom',
      roleId: role.id,
      flowAccess: { mode: 'selected', flowIds: [] },
    })
  ).json()
  expect((await request('/api/me', 'GET', undefined, empty.token)).status).toBe(
    200,
  )
  expect(
    (await request('/api/account', 'GET', undefined, empty.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/permissions', 'GET', undefined, empty.token)).status,
  ).toBe(200)
  expect(
    (await request('/api/flows', 'GET', undefined, empty.token)).status,
  ).toBe(403)
  expect(
    (await request('/api/client-code/targets', 'GET', undefined, empty.token))
      .status,
  ).toBe(403)
})

test('concurrent scope and role changes cannot produce a selected member with global grants', async () => {
  const { request } = workspace()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Reader',
      permissions: ['flows.read'],
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Reviewer',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  const roleRace = await Promise.all([
    request(`/api/members/${member.id}/flow-access`, 'PUT', {
      mode: 'selected',
      flowIds: [],
      version: 1,
    }),
    request(`/api/roles/${role.id}`, 'PUT', {
      name: role.name,
      permissions: ['flows.read', 'audit.read'],
      version: 1,
    }),
  ])
  expect(roleRace.map((response) => response.status).sort()).toEqual([200, 409])
  const live = await (
    await request('/api/me', 'GET', undefined, member.token)
  ).json()
  expect(
    live.flowAccess.mode === 'all' ||
      live.permissions.every(
        (permission: string) => permission === 'flows.read',
      ),
  ).toBe(true)
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Viewer', role: 'viewer' })
  ).json()
  const assignmentRace = await Promise.all([
    request(`/api/members/${viewer.id}/flow-access`, 'PUT', {
      mode: 'selected',
      flowIds: [],
      version: 1,
    }),
    request(`/api/members/${viewer.id}/role`, 'PUT', { role: 'editor' }),
  ])
  expect(assignmentRace.map((response) => response.status).sort()).toEqual([
    200, 409,
  ])
})

test('selected readers generate client examples with CSRF and password sessions resolve current scope', async () => {
  const { request, reopen } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Reader',
      role: 'viewer',
      email: 'reader@example.com',
      password: 'reader-long-password',
      flowAccess: { mode: 'selected', flowIds: [flow.id] },
    })
  ).json()
  const example = {
    target: 'javascript-fetch',
    revision: 1,
    baseUrl: 'http://localhost',
    request: {},
  }
  const login = await request(
    '/auth/login',
    'POST',
    { email: 'reader@example.com', password: 'reader-long-password' },
    '',
    false,
    { origin: 'http://localhost' },
  )
  expect(login.status).toBe(200)
  const session = await login.json()
  expect(session.member.flowAccess).toEqual({
    mode: 'selected',
    flowIds: [flow.id],
    version: 1,
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  expect(
    (
      await request(
        `/api/flows/${flow.id}/client-code`,
        'POST',
        example,
        '',
        false,
        { cookie, origin: 'http://localhost' },
      )
    ).status,
  ).toBe(403)
  const generated = await request(
    `/api/flows/${flow.id}/client-code`,
    'POST',
    example,
    '',
    false,
    { cookie, origin: 'http://localhost', 'x-besh-csrf': session.csrfToken },
  )
  expect(generated.status).toBe(200)
  expect((await generated.json()).code).toContain('BESH_RUNTIME_API_KEY')
  expect(
    (
      await request(
        `/api/flows/${flow.id}/test`,
        'POST',
        { body: {}, query: {} },
        member.token,
      )
    ).status,
  ).toBe(403)
  await reopen()
  expect(
    (await (await request('/api/me', 'GET', undefined, member.token)).json())
      .flowAccess,
  ).toEqual({ mode: 'selected', flowIds: [flow.id], version: 1 })
})
