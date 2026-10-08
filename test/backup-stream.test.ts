import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'

const owner = 'backup-stream-owner-token-at-least-32-characters'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-backup-stream-'))
  const server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  cleanup.push(() => {
    server.close()
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })

  return async (
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
    headers: Record<string, string> = {},
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
          ...(body !== undefined && !(body instanceof FormData)
            ? { 'content-type': 'application/json' }
            : {}),
        },
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
      }),
    )
}

test('backup downloads bound each chunk and stop disclosure after current permission is removed', async () => {
  const request = workspace()
  const file = new FormData()
  file.set('name', 'Large backup fixture')
  file.set(
    'file',
    new File(
      [
        'name,value\n' +
          Array.from({ length: 500 }, () => `${'x'.repeat(1024)},1`).join('\n'),
      ],
      'rows.csv',
      { type: 'text/csv' },
    ),
  )
  expect((await request('/api/data-sources/import', 'POST', file)).status).toBe(
    200,
  )

  const roleResponse = await request('/api/roles', 'POST', {
    name: 'Backup operator',
    permissions: ['backups.manage'],
  })
  expect(roleResponse.status).toBe(200)
  const role = await roleResponse.json()
  const memberResponse = await request('/api/members', 'POST', {
    name: 'Backup operator',
    role: 'custom',
    roleId: role.id,
  })
  expect(memberResponse.status).toBe(200)
  const member = await memberResponse.json()
  const backupResponse = await request(
    '/api/backups',
    'POST',
    undefined,
    member.token,
  )
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  expect(backup.bytes).toBeGreaterThan(65_536)

  const download = await request(
    `/api/backups/${backup.id}`,
    'GET',
    undefined,
    member.token,
  )
  expect(download.status).toBe(200)
  const reader = download.body!.getReader()
  try {
    const first = await reader.read()
    expect(first.done).toBe(false)
    expect(first.value!.byteLength).toBeLessThanOrEqual(65_536)
    expect(new TextDecoder().decode(first.value!.subarray(0, 16))).toBe(
      'SQLite format 3\0',
    )

    const changed = await request(`/api/roles/${role.id}`, 'PUT', {
      name: role.name,
      permissions: [],
      version: role.version,
    })
    expect(changed.status).toBe(200)
    expect(
      (
        await request(
          `/api/backups/${backup.id}`,
          'GET',
          undefined,
          member.token,
        )
      ).status,
    ).toBe(403)
    await expect(reader.read()).rejects.toBeInstanceOf(Error)
  } finally {
    await reader.cancel().catch(() => {})
  }
})

test('backup downloads stop after the original cookie session logs out', async () => {
  const request = workspace()
  const file = new FormData()
  file.set('name', 'Session backup fixture')
  file.set(
    'file',
    new File(
      [
        'name\n' +
          Array.from({ length: 500 }, () => 'x'.repeat(1024)).join('\n'),
      ],
      'rows.csv',
      { type: 'text/csv' },
    ),
  )
  expect((await request('/api/data-sources/import', 'POST', file)).status).toBe(
    200,
  )
  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const login = await request('/auth/login', 'POST', { token: owner }, '', {
    origin: 'http://localhost',
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const session = await login.json()
  const download = await request(
    `/api/backups/${backup.id}`,
    'GET',
    undefined,
    '',
    {
      cookie,
    },
  )
  expect(download.status).toBe(200)
  const reader = download.body!.getReader()
  try {
    expect((await reader.read()).done).toBe(false)
    const logout = await request('/auth/logout', 'POST', {}, '', {
      cookie,
      origin: 'http://localhost',
      'x-besh-csrf': session.csrfToken,
    })
    expect(logout.status).toBe(200)
    expect(
      (
        await request(`/api/backups/${backup.id}`, 'GET', undefined, '', {
          cookie,
        })
      ).status,
    ).toBe(401)
    await expect(reader.read()).rejects.toBeInstanceOf(Error)
  } finally {
    await reader.cancel().catch(() => {})
  }
})
