import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { version } from '../package.json'
import type { AppOptions } from '../src/app'

const owner = 'update-owner-key-at-least-32-characters'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace(extra: Pick<AppOptions, 'updateFetch' | 'now'> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-updates-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    ...extra,
  }
  let server = createApp(options)
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
    token = owner,
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  return {
    request,
    close() {
      server.close()
    },
    reopen() {
      server.close()
      server = createApp(options)
    },
  }
}

test('owners see installed version and explicit update settings without contacting GitHub', async () => {
  const { request } = workspace()
  const response = await request('/api/updates')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    currentVersion: version,
    settings: {
      repositoryUrl: 'https://github.com/mysbryce/besh',
      includePrereleases: true,
      revision: 1,
      updatedAt: null,
    },
    lastCheck: null,
  })
})

test('manual checks select the newest eligible release and expose only safe release metadata', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const { request, reopen } = workspace({
    now: () => Date.parse('2026-10-08T12:00:00.000Z'),
    updateFetch: async (url, init) => {
      calls.push({ url, init })
      return Response.json([
        {
          tag_name: 'v0.90.0',
          name: 'Stable',
          draft: false,
          prerelease: false,
        },
        {
          tag_name: 'v0.99.0-beta.2',
          name: 'New release',
          draft: false,
          prerelease: true,
          published_at: '2026-10-08T11:00:00Z',
          html_url: 'https://attacker.invalid/private',
          body: 'secret-release-body',
        },
        { tag_name: 'v0.99.0-beta.1', draft: false, prerelease: true },
        { tag_name: 'v0.99.0-beta.10', draft: true, prerelease: true },
        { tag_name: 'not-a-version', draft: false, prerelease: false },
      ])
    },
  })
  const response = await request('/api/updates/check', 'POST', { revision: 1 })
  expect(response.status).toBe(200)
  const checked = await response.json()
  expect(checked.lastCheck).toEqual({
    checkedAt: '2026-10-08T12:00:00.000Z',
    status: 'available',
    error: null,
    release: {
      version: '0.99.0-beta.2',
      tag: 'v0.99.0-beta.2',
      name: 'New release',
      url: 'https://github.com/mysbryce/besh/releases/tag/v0.99.0-beta.2',
      publishedAt: '2026-10-08T11:00:00.000Z',
      prerelease: true,
    },
  })
  expect(calls).toHaveLength(1)
  expect(calls[0].url).toBe(
    'https://api.github.com/repos/mysbryce/besh/releases?per_page=20',
  )
  expect(calls[0].init.redirect).toBe('error')
  expect(new Headers(calls[0].init.headers).get('authorization')).toBeNull()
  expect(JSON.stringify(checked)).not.toContain('secret-release-body')
  reopen()
  expect((await (await request('/api/updates')).json()).lastCheck).toEqual(
    checked.lastCheck,
  )
  expect(calls).toHaveLength(1)
})

test('saved GitHub settings survive restart and reject stale or unsafe repository input', async () => {
  const { request, reopen } = workspace()
  const settings = {
    repositoryUrl: 'https://github.com/Example/besh.git',
    includePrereleases: false,
    revision: 1,
  }
  const response = await request('/api/updates', 'PUT', settings)
  expect(response.status).toBe(200)
  const saved = await response.json()
  expect(saved.settings).toMatchObject({
    repositoryUrl: 'https://github.com/Example/besh',
    includePrereleases: false,
    revision: 2,
  })
  expect(saved.settings.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(saved.lastCheck).toBeNull()
  expect((await request('/api/updates', 'PUT', settings)).status).toBe(409)
  for (const repositoryUrl of [
    'http://github.com/a/b',
    'https://github.com.attacker.invalid/a/b',
    'https://user:secret@github.com/a/b',
    'https://github.com/a/b?token=private',
    'https://github.com/a/b/releases',
    'https://127.0.0.1/private',
    'https://github.com/a/b#fragment',
  ]) {
    expect(
      (
        await request('/api/updates', 'PUT', {
          ...settings,
          repositoryUrl,
          revision: 2,
        })
      ).status,
    ).toBe(400)
  }
  reopen()
  expect((await (await request('/api/updates')).json()).settings).toEqual(
    saved.settings,
  )
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (event: { action: string }) => event.action === 'update.settings.saved',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(audit)).not.toContain('secret')
})

test('checking rejects parallel work and discards results after settings change with a persistent cooldown', async () => {
  let clock = Date.parse('2026-10-08T12:00:00.000Z')
  let finish!: (response: Response) => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  let calls = 0
  const { request, reopen } = workspace({
    now: () => clock,
    updateFetch: async () => {
      calls++
      started()
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    },
  })
  const pending = request('/api/updates/check', 'POST', { revision: 1 })
  await ready
  expect(
    (await request('/api/updates/check', 'POST', { revision: 1 })).status,
  ).toBe(409)
  expect(
    (
      await request('/api/updates', 'PUT', {
        repositoryUrl: 'https://github.com/example/other',
        includePrereleases: false,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  finish(
    Response.json([{ tag_name: 'v0.99.0', draft: false, prerelease: false }]),
  )
  expect((await pending).status).toBe(409)
  expect((await (await request('/api/updates')).json()).lastCheck).toBeNull()
  reopen()
  expect(
    (await request('/api/updates/check', 'POST', { revision: 2 })).status,
  ).toBe(429)
  expect(calls).toBe(1)
  clock += 61_000
  const next = request('/api/updates/check', 'POST', { revision: 2 })
  while (calls < 2) await Bun.sleep(1)
  finish(Response.json([]))
  expect((await next).status).toBe(200)
  expect((await (await request('/api/updates')).json()).lastCheck.status).toBe(
    'no-releases',
  )
})

test('remote failures and oversized release lists become safe cached errors without leaking provider data', async () => {
  for (const result of [
    () =>
      Response.json({ message: 'private-provider-detail' }, { status: 403 }),
    () => Response.json({ private: 'private-provider-detail' }),
    () =>
      new Response('private-provider-detail', {
        headers: { 'content-type': 'application/json' },
      }),
    () =>
      new Response(JSON.stringify([{ body: 'x'.repeat(270_000) }]), {
        headers: { 'content-type': 'application/json' },
      }),
    () =>
      Response.json(
        Array.from({ length: 21 }, () => ({
          tag_name: 'v0.99.0',
          draft: false,
          prerelease: false,
        })),
      ),
    () =>
      Response.json([], { headers: { 'x-large-header': 'x'.repeat(40_000) } }),
    () => {
      throw new Error('private-provider-detail')
    },
  ]) {
    const { request, reopen } = workspace({ updateFetch: async () => result() })
    const response = await request('/api/updates/check', 'POST', {
      revision: 1,
    })
    expect(response.status).toBe(200)
    const checked = await response.json()
    expect(checked.lastCheck).toMatchObject({ status: 'error', release: null })
    expect(checked.lastCheck.error).toContain('GitHub')
    expect(JSON.stringify(checked)).not.toContain('private-provider-detail')
    reopen()
    expect((await (await request('/api/updates')).json()).lastCheck).toEqual(
      checked.lastCheck,
    )
    const audit = await (await request('/api/audit')).json()
    expect(
      audit.filter(
        (event: { action: string }) => event.action === 'update.check.failed',
      ),
    ).toHaveLength(1)
    expect(JSON.stringify(audit)).not.toContain('private-provider-detail')
  }
})

test('only owners manage updates and strict check input never accepts transport options', async () => {
  let calls = 0
  const { request } = workspace({
    updateFetch: async () => {
      calls++
      return Response.json([])
    },
  })
  const catalog = await (await request('/api/permissions')).json()
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'All delegated actions',
      permissions: catalog.map((entry: { id: string }) => entry.id),
    })
  ).json()
  const member = await (
    await request('/api/members', 'POST', {
      name: 'Delegate',
      role: 'custom',
      roleId: role.id,
    })
  ).json()
  for (const [path, method, body] of [
    ['/api/updates', 'GET', undefined],
    [
      '/api/updates',
      'PUT',
      {
        repositoryUrl: 'https://github.com/a/b',
        includePrereleases: true,
        revision: 1,
      },
    ],
    ['/api/updates/check', 'POST', { revision: 1 }],
  ] as const) {
    expect((await request(path, method, body, member.token)).status).toBe(403)
    expect((await request(path, method, body, 'invalid')).status).toBe(401)
  }
  for (const body of [
    undefined,
    {},
    { revision: 0 },
    { revision: 1, url: 'http://localhost' },
    { revision: 1, token: 'private' },
    { revision: '1' },
  ])
    expect((await request('/api/updates/check', 'POST', body)).status).toBe(400)
  expect(
    (await request('/api/updates/check', 'POST', { revision: 2 })).status,
  ).toBe(409)
  expect(calls).toBe(0)
})

test('stable release filtering excludes suffix and provider-marked previews and compares numeric versions', async () => {
  const { request } = workspace({
    updateFetch: async () =>
      Response.json([
        { tag_name: 'v0.90.2', draft: false, prerelease: false },
        { tag_name: 'v0.90.10', draft: false, prerelease: false },
        { tag_name: 'v0.99.0-alpha.1', draft: false, prerelease: false },
        { tag_name: 'v0.99.0', draft: false, prerelease: true },
        { tag_name: 'v0.91.00', draft: false, prerelease: false },
      ]),
  })
  await request('/api/updates', 'PUT', {
    repositoryUrl: 'https://github.com/example/besh',
    includePrereleases: false,
    revision: 1,
  })
  const checked = await (
    await request('/api/updates/check', 'POST', { revision: 2 })
  ).json()
  expect(checked.lastCheck).toMatchObject({
    status: 'available',
    release: { version: '0.90.10', prerelease: false },
  })
})

test('the five-second deadline includes release response bodies and aborts stalled reads', async () => {
  let signal: AbortSignal | null | undefined
  let body!: ReadableStreamDefaultController<Uint8Array>
  const { request } = workspace({
    updateFetch: async (_url, init) => {
      signal = init.signal
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            body = controller
          },
        }),
      )
    },
  })
  const started = Date.now()
  const pending = request('/api/updates/check', 'POST', { revision: 1 })
  let timer: ReturnType<typeof setTimeout> | undefined
  const response = await Promise.race([
    pending,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 6500)
    }),
  ])
  clearTimeout(timer)
  if (!response) body.close()
  expect(response?.status).toBe(200)
  expect((await response!.json()).lastCheck.status).toBe('error')
  expect(signal?.aborted).toBe(true)
  expect(Date.now() - started).toBeLessThan(6500)
}, 10_000)

test('shutting down cancels an active check before SQLite closes and restart preserves the cooldown', async () => {
  let signal: AbortSignal | null | undefined
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  const { request, close, reopen } = workspace({
    updateFetch: async (_url, init) => {
      signal = init.signal
      started()
      return new Promise<Response>(() => {})
    },
  })
  const pending = request('/api/updates/check', 'POST', { revision: 1 })
  await ready
  close()
  expect(signal?.aborted).toBe(true)
  expect((await pending).status).toBe(503)
  reopen()
  expect(
    (await request('/api/updates/check', 'POST', { revision: 1 })).status,
  ).toBe(409)
}, 10_000)
