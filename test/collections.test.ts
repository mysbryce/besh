import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'collection-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
let directory: string
let server: ReturnType<typeof createApp>

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'besh-collection-tracer-'))
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
  expect(basename(target).startsWith('besh-collection-tracer-')).toBe(true)

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
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

const products = {
  name: 'Products',
  fields: [
    {
      key: 'title',
      label: 'Title',
      required: true,
      schema: { type: 'text' },
    },
    {
      key: 'price',
      label: 'Price',
      required: true,
      schema: { type: 'number' },
    },
    {
      key: 'available',
      label: 'Available',
      required: false,
      schema: { type: 'boolean' },
    },
    {
      key: 'details',
      label: 'Details',
      required: false,
      schema: {
        type: 'object',
        fields: [
          {
            key: 'description',
            label: 'Description',
            required: false,
            schema: { type: 'text' },
          },
        ],
      },
    },
    {
      key: 'tags',
      label: 'Tags',
      required: false,
      schema: { type: 'array', items: { type: 'text' } },
    },
    {
      key: 'category',
      label: 'Category',
      required: true,
      schema: {
        type: 'select',
        options: [
          { value: 'retail', label: 'Retail' },
          { value: 'wholesale', label: 'Wholesale' },
        ],
      },
    },
  ],
}

test('a collection retains its reviewed Struct snapshot after the saved Struct changes', async () => {
  const structResponse = await request('/api/structs', 'POST', products)
  expect(structResponse.status).toBe(200)

  const savedStruct = await structResponse.json()
  expect(savedStruct).toEqual({
    ...products,
    id: expect.any(String),
    version: 1,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Shop inventory',
    structId: savedStruct.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  expect(collection).toEqual({
    id: expect.any(String),
    name: 'Shop inventory',
    version: 1,
    struct: {
      id: savedStruct.id,
      version: 1,
      name: 'Products',
      fields: products.fields,
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })

  const changedDefinition = {
    name: 'Revised products',
    version: 1,
    fields: [
      {
        key: 'title',
        label: 'Revised title',
        required: false,
        schema: { type: 'text' },
      },
    ],
  }
  const updateResponse = await request(
    '/api/structs/' + savedStruct.id,
    'PUT',
    changedDefinition,
  )
  expect(updateResponse.status).toBe(200)
  expect(await updateResponse.json()).toEqual({
    ...changedDefinition,
    id: savedStruct.id,
    version: 2,
    createdAt: savedStruct.createdAt,
    updatedAt: expect.any(String),
  })

  const detailResponse = await request('/api/collections/' + collection.id)
  expect(detailResponse.status).toBe(200)
  expect(await detailResponse.json()).toEqual(collection)

  const listResponse = await request('/api/collections')
  expect(listResponse.status).toBe(200)
  expect(await listResponse.json()).toEqual([
    {
      id: collection.id,
      name: 'Shop inventory',
      version: 1,
      structId: savedStruct.id,
      structVersion: 1,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    },
  ])
})

test('owner stores exact typed content using the bound Struct despite later model edits', async () => {
  const structResponse = await request('/api/structs', 'POST', products)
  expect(structResponse.status).toBe(200)
  const struct = await structResponse.json()

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Shop inventory',
    structId: struct.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()

  const changed = await request('/api/structs/' + struct.id, 'PUT', {
    name: 'Revised products',
    version: 1,
    fields: [products.fields[0]],
  })
  expect(changed.status).toBe(200)

  const data = {
    title: '',
    price: 0,
    available: false,
    details: {},
    tags: [],
    category: 'retail',
  }
  const created = await request(
    '/api/collections/' + collection.id + '/entries',
    'POST',
    { data },
  )
  expect(created.status).toBe(200)

  const entry = await created.json()
  expect(entry).toEqual({
    id: expect.any(String),
    collectionId: collection.id,
    version: 1,
    data,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })

  const detail = await request(
    '/api/collections/' + collection.id + '/entries/' + entry.id,
  )
  expect(detail.status).toBe(200)
  expect(await detail.json()).toEqual(entry)
})

test('concurrent content edits accept one versioned winner and audit only that edit', async () => {
  const structResponse = await request('/api/structs', 'POST', products)
  expect(structResponse.status).toBe(200)
  const struct = await structResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Shop inventory',
    structId: struct.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const basePath = '/api/collections/' + collection.id + '/entries'
  const created = await request(basePath, 'POST', {
    data: { title: 'Original', price: 10, category: 'retail' },
  })
  expect(created.status).toBe(200)
  const original = await created.json()
  const beforeResponse = await request('/api/audit')
  expect(beforeResponse.status).toBe(200)
  const before = await beforeResponse.json()
  const choices = [
    { title: '  First edit  ', price: 0, available: false, category: 'retail' },
    { title: 'Second edit', price: 2.5, tags: [], category: 'wholesale' },
  ]

  const replies = await Promise.all(
    choices.map((data) =>
      request(basePath + '/' + original.id, 'PUT', { version: 1, data }),
    ),
  )
  expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])

  const accepted = replies.findIndex((reply) => reply.status === 200)
  const winner = await replies[accepted]!.json()
  expect(winner).toEqual({
    id: original.id,
    collectionId: collection.id,
    version: 2,
    data: choices[accepted],
    createdAt: original.createdAt,
    updatedAt: expect.any(String),
  })
  const detail = await request(basePath + '/' + original.id)
  expect(detail.status).toBe(200)
  expect(await detail.json()).toEqual(winner)
  const afterResponse = await request('/api/audit')
  expect(afterResponse.status).toBe(200)
  const after = await afterResponse.json()
  expect(after.length).toBe(before.length + 1)
  expect(
    after.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'entry.updated' && event.resource === original.id,
    ),
  ).toHaveLength(1)
})

test('owner browses bounded content pages without skipping or duplicating entries', async () => {
  const structResponse = await request('/api/structs', 'POST', products)
  expect(structResponse.status).toBe(200)
  const struct = await structResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Shop inventory',
    structId: struct.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const basePath = '/api/collections/' + collection.id + '/entries'
  const created = []

  for (const title of ['First product', 'Second product', 'Third product']) {
    const response = await request(basePath, 'POST', {
      data: { title, price: 10, category: 'retail' },
    })
    expect(response.status).toBe(200)
    created.push(await response.json())
  }

  const firstResponse = await request(basePath + '?limit=2&offset=0')
  expect(firstResponse.status).toBe(200)
  const first = await firstResponse.json()
  expect(first).toEqual({
    entries: expect.any(Array),
    total: 3,
    offset: 0,
    limit: 2,
  })
  expect(first.entries).toHaveLength(2)

  const lastResponse = await request(basePath + '?limit=2&offset=2')
  expect(lastResponse.status).toBe(200)
  const last = await lastResponse.json()
  expect(last).toEqual({
    entries: expect.any(Array),
    total: 3,
    offset: 2,
    limit: 2,
  })
  expect(last.entries).toHaveLength(1)
  expect([...first.entries, ...last.entries]).toEqual(
    expect.arrayContaining(created),
  )
  expect(
    new Set([...first.entries, ...last.entries].map((entry) => entry.id)).size,
  ).toBe(3)

  const defaultResponse = await request(basePath)
  expect(defaultResponse.status).toBe(200)
  expect(await defaultResponse.json()).toEqual({
    entries: [...first.entries, ...last.entries],
    total: 3,
    offset: 0,
    limit: 20,
  })

  for (const query of [
    '?limit=0',
    '?limit=26',
    '?limit=1.5',
    '?offset=-1',
    '?offset=9007199254740992',
    '?limit=2&limit=3',
    '?search=private',
  ]) {
    expect((await request(basePath + query)).status).toBe(400)
  }
})

test('owner deletes only the reviewed content revision without changing its collection', async () => {
  const structResponse = await request('/api/structs', 'POST', products)
  expect(structResponse.status).toBe(200)
  const struct = await structResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Shop inventory',
    structId: struct.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)
  const collection = await collectionResponse.json()
  const basePath = '/api/collections/' + collection.id + '/entries'
  const created = await request(basePath, 'POST', {
    data: { title: 'Original', price: 10, category: 'retail' },
  })
  expect(created.status).toBe(200)
  const original = await created.json()
  const path = basePath + '/' + original.id
  const edited = await request(path, 'PUT', {
    version: 1,
    data: { title: 'Reviewed product', price: 20, category: 'wholesale' },
  })
  expect(edited.status).toBe(200)
  const current = await edited.json()
  const beforeResponse = await request('/api/audit')
  const before = await beforeResponse.json()

  expect((await request(path, 'DELETE', { version: 1 })).status).toBe(409)
  const retained = await request(path)
  expect(retained.status).toBe(200)
  expect(await retained.json()).toEqual(current)
  expect(await (await request('/api/audit')).json()).toEqual(before)

  const deleted = await request(path, 'DELETE', { version: 2 })
  expect(deleted.status).toBe(200)
  expect(await deleted.json()).toEqual({ ok: true })
  expect((await request(path)).status).toBe(404)
  expect(await (await request(basePath)).json()).toEqual({
    entries: [],
    total: 0,
    offset: 0,
    limit: 20,
  })
  expect(
    await (await request('/api/collections/' + collection.id)).json(),
  ).toEqual(collection)
  const afterResponse = await request('/api/audit')
  const after = await afterResponse.json()
  expect(after.length).toBe(before.length + 1)
  expect(
    after.filter(
      (event: { action: string; resource: string }) =>
        event.action === 'entry.deleted' && event.resource === original.id,
    ),
  ).toHaveLength(1)
})

test('private collection management denies members before exposing records or validating input', async () => {
  const struct = await (await request('/api/structs', 'POST', products)).json()
  const collection = await (
    await request('/api/collections', 'POST', {
      name: 'Private inventory',
      structId: struct.id,
      structVersion: 1,
    })
  ).json()
  const basePath = '/api/collections/' + collection.id + '/entries'
  const entry = await (
    await request(basePath, 'POST', {
      data: { title: 'Owner-only product', price: 1, category: 'retail' },
    })
  ).json()
  const roleResponse = await request('/api/roles', 'POST', {
    name: 'Resource manager',
    permissions: [
      'flows.read',
      'flows.write',
      'sources.read',
      'backups.manage',
    ],
  })
  expect(roleResponse.status).toBe(200)
  const role = await roleResponse.json()
  const tokens = []

  for (const memberRole of ['editor', 'viewer', 'custom']) {
    const response = await request('/api/members', 'POST', {
      name: 'Collection ' + memberRole,
      role: memberRole,
      ...(memberRole === 'custom' ? { roleId: role.id } : {}),
    })
    expect(response.status).toBe(200)
    tokens.push((await response.json()).token)
  }

  const before = await (await request('/api/audit')).json()
  const operations = [
    ['/api/collections', 'GET', undefined],
    ['/api/collections', 'POST', { unexpected: true }],
    ['/api/collections/' + collection.id, 'GET', undefined],
    ['/api/collections/missing', 'GET', undefined],
    [basePath, 'GET', undefined],
    [basePath + '?limit=invalid', 'GET', undefined],
    [basePath, 'POST', { data: null }],
    [basePath + '/' + entry.id, 'GET', undefined],
    [basePath + '/' + entry.id, 'PUT', { version: 'invalid' }],
    [basePath + '/' + entry.id, 'DELETE', { version: 'invalid' }],
  ] as const

  for (const [path, method, body] of operations) {
    expect((await request(path, method, body, null)).status).toBe(401)

    for (const token of tokens) {
      const response = await request(path, method, body, token)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain('Owner-only product')
    }
  }

  const after = await (await request('/api/audit')).json()
  expect(
    after.filter(
      (event: { action: string }) => event.action !== 'access.denied',
    ),
  ).toEqual(before)
  expect(
    after.filter(
      (event: { action: string }) => event.action === 'access.denied',
    ),
  ).toHaveLength(40)
  expect(await (await request(basePath + '/' + entry.id)).json()).toEqual(entry)
})

test('invalid typed content and stale bindings leave saved entries and audit unchanged', async () => {
  const struct = await (await request('/api/structs', 'POST', products)).json()
  const definition = {
    name: 'Private inventory',
    structId: struct.id,
    structVersion: 1,
  }
  const collection = await (
    await request('/api/collections', 'POST', definition)
  ).json()
  const second = await (
    await request('/api/collections', 'POST', {
      ...definition,
      name: 'Other inventory',
    })
  ).json()
  const path = '/api/collections/' + collection.id + '/entries'
  const valid = { title: 'Untouched product', price: 0, category: 'retail' }
  const entry = await (await request(path, 'POST', { data: valid })).json()
  const before = await (await request('/api/audit')).json()
  const invalid = [
    {},
    { ...valid, title: null },
    { ...valid, price: '0' },
    { ...valid, available: 0 },
    { ...valid, details: [] },
    { ...valid, details: { unknown: 'private-secret-value' } },
    { ...valid, tags: ['literal', 1] },
    { ...valid, category: 'Retail' },
    { ...valid, unknown: 'private-secret-value' },
    JSON.parse(
      '{"title":"Untouched product","price":0,"category":"retail","__proto__":{"secret":true}}',
    ),
    { ...valid, title: '😀'.repeat(1025) },
    { ...valid, tags: Array.from({ length: 129 }, () => 'tag') },
  ]

  for (const data of invalid) {
    const created = await request(path, 'POST', { data })
    expect(created.status).toBe(400)
    expect(await created.text()).not.toContain('private-secret-value')
    expect(
      (await request(path + '/' + entry.id, 'PUT', { version: 1, data }))
        .status,
    ).toBe(400)
  }

  for (const body of [
    { data: valid, extra: true },
    { version: 1, data: valid },
    { data: valid, schema: products.fields },
  ]) {
    expect((await request(path, 'POST', body)).status).toBe(400)
  }

  for (const version of [0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    expect(
      (await request(path + '/' + entry.id, 'PUT', { version, data: valid }))
        .status,
    ).toBe(400)
    expect(
      (await request(path + '/' + entry.id, 'DELETE', { version })).status,
    ).toBe(400)
  }

  expect(
    (
      await request(path + '/' + entry.id, 'DELETE', {
        version: 1,
        extra: true,
      })
    ).status,
  ).toBe(400)
  const foreignPath = '/api/collections/' + second.id + '/entries/' + entry.id
  expect((await request(foreignPath)).status).toBe(404)
  expect(
    (await request(foreignPath, 'PUT', { version: 1, data: valid })).status,
  ).toBe(404)
  expect((await request(foreignPath, 'DELETE', { version: 1 })).status).toBe(
    404,
  )
  expect(
    (
      await request('/api/collections', 'POST', {
        ...definition,
        structVersion: 2,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request('/api/collections', 'POST', {
        ...definition,
        fields: products.fields,
      })
    ).status,
  ).toBe(400)
  expect(await (await request(path + '/' + entry.id)).json()).toEqual(entry)
  expect(await (await request('/api/audit')).json()).toEqual(before)
})

test('collection snapshots and edited content survive restart and public backup restoration', async () => {
  const struct = await (await request('/api/structs', 'POST', products)).json()
  const collection = await (
    await request('/api/collections', 'POST', {
      name: 'Private inventory',
      structId: struct.id,
      structVersion: 1,
    })
  ).json()
  const path = '/api/collections/' + collection.id + '/entries'
  const initial = await (
    await request(path, 'POST', {
      data: { title: 'Original', price: 1, category: 'retail' },
    })
  ).json()
  const entry = await (
    await request(path + '/' + initial.id, 'PUT', {
      version: 1,
      data: {
        title: 'Restored content',
        price: 0,
        available: false,
        category: 'wholesale',
      },
    })
  ).json()
  const changedStruct = await request('/api/structs/' + struct.id, 'PUT', {
    name: 'Changed model',
    version: 1,
    fields: [products.fields[0]],
  })
  expect(changedStruct.status).toBe(200)
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
  expect(
    await (await request('/api/collections/' + collection.id)).json(),
  ).toEqual(collection)
  expect(await (await request(path + '/' + entry.id)).json()).toEqual(entry)
  const history = await (await request('/api/migrations')).json()
  expect(
    history.filter((item: { version: number }) => item.version === 25),
  ).toHaveLength(1)
  expect(
    history.filter((item: { version: number }) => item.version === 26),
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
    for (const [route, expected] of [
      ['/api/collections/' + collection.id, collection],
      [path + '/' + entry.id, entry],
    ] as const) {
      const response = await restored.app.handle(
        new Request(origin + route, {
          headers: { authorization: 'Bearer ' + owner },
        }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  } finally {
    await restored.close()
  }
})

test('content byte and traversal limits reject excess work without coercing valid values', async () => {
  const fields = [
    ...['first', 'second', 'third', 'fourth', 'fifth'].map((key) => ({
      key,
      label: key,
      required: false,
      schema: { type: 'text' },
    })),
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => ({
      key,
      label: key,
      required: false,
      schema: { type: 'array', items: { type: 'boolean' } },
    })),
  ]
  const structResponse = await request('/api/structs', 'POST', {
    name: 'Bounded data',
    fields,
  })
  expect(structResponse.status).toBe(200)
  const struct = await structResponse.json()
  const collection = await (
    await request('/api/collections', 'POST', {
      name: 'Bounded content',
      structId: struct.id,
      structVersion: 1,
    })
  ).json()
  const path = '/api/collections/' + collection.id + '/entries'
  const exactText = 'ก'.repeat(1365) + 'a'
  const byteData = {
    first: 'a'.repeat(4000),
    second: 'b'.repeat(4000),
    third: 'c'.repeat(4000),
    fourth: 'd'.repeat(4000),
    fifth: 'e'.repeat(326),
  }
  const workData = {
    a: Array(127).fill(false),
    b: Array(127).fill(false),
    c: Array(127).fill(false),
    d: Array(127).fill(false),
    e: Array(127).fill(false),
    f: Array(127).fill(false),
    g: Array(127).fill(false),
    h: Array(126).fill(false),
  }

  for (const data of [{ first: exactText }, byteData, workData]) {
    const response = await request(path, 'POST', { data })
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual(data)
  }

  const before = await (await request('/api/audit')).json()
  for (const data of [
    { first: exactText + 'b' },
    { ...byteData, fifth: 'e'.repeat(327) },
    {
      a: Array(127).fill(false),
      b: Array(127).fill(false),
      c: Array(127).fill(false),
      d: Array(127).fill(false),
      e: Array(127).fill(false),
      f: Array(127).fill(false),
      g: Array(127).fill(false),
      h: Array(127).fill(false),
    },
  ]) {
    expect((await request(path, 'POST', { data })).status).toBe(400)
  }

  expect(await (await request('/api/audit')).json()).toEqual(before)
  expect((await (await request(path)).json()).total).toBe(3)
})

test('content capacity stays bounded and a reviewed deletion releases workspace capacity', async () => {
  const struct = await (
    await request('/api/structs', 'POST', { name: 'Empty record', fields: [] })
  ).json()
  const collections = []

  for (const name of ['First', 'Second', 'Third', 'Fourth', 'Fifth']) {
    const response = await request('/api/collections', 'POST', {
      name,
      structId: struct.id,
      structVersion: 1,
    })
    expect(response.status).toBe(200)
    collections.push(await response.json())
  }

  let firstEntry: { id: string } | undefined
  for (const collection of collections.slice(0, 4)) {
    const path = '/api/collections/' + collection.id + '/entries'

    for (let index = 0; index < 256; index++) {
      const response = await request(path, 'POST', { data: {} })
      expect(response.status).toBe(200)
      const entry = await response.json()
      firstEntry ??= entry
    }

    const before = await (await request('/api/audit')).json()
    expect((await request(path, 'POST', { data: {} })).status).toBe(409)
    expect(await (await request('/api/audit')).json()).toEqual(before)
    expect((await (await request(path)).json()).total).toBe(256)
  }

  const finalPath = '/api/collections/' + collections[4].id + '/entries'
  expect((await request(finalPath, 'POST', { data: {} })).status).toBe(409)
  const deleted = await request(
    '/api/collections/' + collections[0].id + '/entries/' + firstEntry!.id,
    'DELETE',
    { version: 1 },
  )
  expect(deleted.status).toBe(200)
  expect((await request(finalPath, 'POST', { data: {} })).status).toBe(200)
})
