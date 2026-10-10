import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'struct-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-structs-'))
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
})

afterEach(async () => {
  await server.close()

  const target = resolve(directory)
  const parent = resolve(tmpdir())
  expect(target.toLowerCase().startsWith((parent + sep).toLowerCase())).toBe(
    true,
  )
  expect(basename(target).startsWith('besh-structs-')).toBe(true)
  rmSync(target, { recursive: true, force: true })
})

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  token: string | null = owner,
) {
  return server.app.handle(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

const article = {
  name: 'Article',
  fields: [
    {
      key: 'title',
      label: 'Title',
      required: true,
      schema: { type: 'text' },
    },
    {
      key: 'blocks',
      label: 'Blocks',
      required: false,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          fields: [
            {
              key: 'kind',
              label: 'Kind',
              required: true,
              schema: {
                type: 'select',
                options: [
                  { value: 'note', label: 'Note' },
                  { value: 'quote', label: 'Quote' },
                ],
              },
            },
          ],
        },
      },
    },
  ],
}

test('owner saves a nested content Struct through HTTP and reads its literal draft', async () => {
  const response = await request('/api/structs', 'POST', article)
  expect(response.status).toBe(200)

  const saved = await response.json()
  expect(saved).toEqual({
    ...article,
    id: expect.any(String),
    version: 1,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })
  expect(await (await request('/api/structs/' + saved.id)).json()).toEqual(
    saved,
  )
  expect(await (await request('/api/structs')).json()).toEqual([
    {
      id: saved.id,
      name: 'Article',
      version: 1,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    },
  ])
})

test('a stale Struct draft cannot overwrite a newer saved version', async () => {
  const initial = await (await request('/api/structs', 'POST', article)).json()
  const response = await request('/api/structs/' + initial.id, 'PUT', {
    ...article,
    name: 'Editorial Article',
    version: 1,
  })
  expect(response.status).toBe(200)

  const updated = await response.json()
  expect(updated).toEqual({
    ...initial,
    name: 'Editorial Article',
    version: 2,
    updatedAt: expect.any(String),
  })
  expect(
    (
      await request('/api/structs/' + initial.id, 'PUT', {
        ...article,
        name: 'Stale overwrite',
        version: 1,
      })
    ).status,
  ).toBe(409)
  expect(await (await request('/api/structs/' + initial.id)).json()).toEqual(
    updated,
  )

  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (entry: { action: string }) => entry.action === 'struct.updated',
    ),
  ).toHaveLength(1)
  expect(JSON.stringify(audit)).not.toContain('Editorial Article')
  expect(JSON.stringify(audit)).not.toContain('Stale overwrite')
})

test('Struct management denies non-owners before resource or definition inspection', async () => {
  const saved = await (await request('/api/structs', 'POST', article)).json()
  const definitionsBefore = await (await request('/api/structs')).json()
  const auditBefore = await (await request('/api/audit')).json()

  for (const role of ['editor', 'viewer']) {
    const member = await (
      await request('/api/members', 'POST', { name: 'Struct ' + role, role })
    ).json()
    for (const path of [
      '/api/structs',
      '/api/structs/' + saved.id,
      '/api/structs/missing',
    ]) {
      expect((await request(path, 'GET', undefined, member.token)).status).toBe(
        403,
      )
    }
    expect(
      (
        await request(
          '/api/structs',
          'POST',
          { unexpected: true },
          member.token,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await request(
          '/api/structs/' + saved.id,
          'PUT',
          { version: 'bad' },
          member.token,
        )
      ).status,
    ).toBe(403)
  }

  expect((await request('/api/structs', 'GET', undefined, null)).status).toBe(
    401,
  )
  expect(
    (await request('/api/structs', 'POST', article, 'unrecognized-key')).status,
  ).toBe(401)
  expect(await (await request('/api/structs')).json()).toEqual(
    definitionsBefore,
  )

  const auditAfter = await (await request('/api/audit')).json()
  expect(
    auditAfter.filter((entry: { action: string }) =>
      entry.action.startsWith('struct.'),
    ),
  ).toEqual(
    auditBefore.filter((entry: { action: string }) =>
      entry.action.startsWith('struct.'),
    ),
  )
})

test('invalid or over-budget Struct definitions leave drafts and audit unchanged', async () => {
  const before = await (await request('/api/structs')).json()
  const auditBefore = await (await request('/api/audit')).json()
  const title = article.fields[0]!
  let deep: unknown = { type: 'text' }
  for (let level = 0; level < 6; level++) deep = { type: 'array', items: deep }

  const invalid = [
    { name: 'Bad', fields: [{ ...title, key: 'constructor' }] },
    { name: 'Bad', fields: [title, title] },
    {
      name: 'Bad',
      fields: [{ ...title, schema: { type: 'text', default: 'silent' } }],
    },
    { name: 'Bad', fields: [{ ...title, schema: { type: 'unknown' } }] },
    { name: 'Bad', fields: [{ ...title, schema: deep }] },
    {
      name: 'Bad',
      fields: Array.from({ length: 33 }, (_, index) => ({
        ...title,
        key: 'field_' + index,
      })),
    },
    {
      name: 'Bad',
      fields: [
        {
          ...title,
          schema: {
            type: 'select',
            options: [
              { value: ' a ', label: 'First' },
              { value: 'a', label: 'Second' },
            ],
          },
        },
      ],
    },
    { ...article, unexpected: 'x'.repeat(32_769) },
  ]

  for (const value of invalid)
    expect((await request('/api/structs', 'POST', value)).status).toBe(400)

  expect(await (await request('/api/structs')).json()).toEqual(before)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
})

test('saved Struct definitions survive restart and public backup restoration', async () => {
  const saved = await (await request('/api/structs', 'POST', article)).json()
  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  expect(await (await request('/api/structs/' + saved.id)).json()).toEqual(
    saved,
  )
  const migrations = await (await request('/api/migrations')).json()
  expect(
    migrations.filter((entry: { version: number }) => entry.version === 24),
  ).toHaveLength(1)

  const restoreDirectory = join(directory, 'restored')
  mkdirSync(restoreDirectory)
  writeFileSync(join(restoreDirectory, 'control.sqlite'), bytes)
  const restored = createApp({
    databasePath: join(restoreDirectory, 'control.sqlite'),
    backupDir: join(restoreDirectory, 'backups'),
    adminToken: owner,
  })
  try {
    const response = await restored.app.handle(
      new Request(origin + '/api/structs/' + saved.id, {
        headers: { authorization: 'Bearer ' + owner },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(saved)
  } finally {
    await restored.close()
  }
})
