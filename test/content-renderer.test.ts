import { afterEach, beforeEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'content-renderer-first-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-content-renderer-first-'
let directory: string
let server: ReturnType<typeof createApp>

type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), temporaryPrefix))
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
  expect(basename(target).startsWith(temporaryPrefix)).toBe(true)

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
        ...(token === null ? {} : { authorization: 'Bearer ' + token }),
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function get(path: string) {
  const response = await request(path)
  expect(response.status).toBe(200)

  return response.json()
}

async function audit(): Promise<AuditEvent[]> {
  return get('/api/audit')
}

async function createCollection() {
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Collection presentation model',
    fields: [
      {
        key: 'body',
        label: 'Body',
        required: true,
        schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
      },
    ],
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private presentation collection',
    structId: model.id,
    structVersion: model.version,
  })
  expect(collectionResponse.status).toBe(200)

  return { model, collection: await collectionResponse.json() }
}

test('owner explicitly saves one collection renderer and stale review cannot overwrite it', async () => {
  const currentOwner = await get('/api/me')
  expect(currentOwner.role).toBe('owner')

  const fields = [
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Reviewed renderer articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private renderer articles',
    structId: model.id,
    structVersion: 1,
  })
  expect(collectionResponse.status).toBe(200)

  const collection = await collectionResponse.json()
  expect(collection.version).toBe(1)
  expect(collection.struct).toEqual({
    id: model.id,
    version: 1,
    name: model.name,
    fields,
  })

  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'heading',
        level: 1,
        children: [
          { type: 'text', text: '  Saved <heading> & ไทย  ', marks: [] },
        ],
      },
    ],
  }
  const collectionPath = '/api/collections/' + collection.id
  const entriesPath = collectionPath + '/entries'
  const entryResponse = await request(entriesPath, 'POST', {
    data: { body: document },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.collectionId).toBe(collection.id)
  expect(entry.version).toBe(1)
  expect(entry.data).toEqual({ body: document })

  const entryPath = entriesPath + '/' + entry.id
  const savedModel = await get('/api/structs/' + model.id)
  const savedCollection = await get(collectionPath)
  const savedEntry = await get(entryPath)
  const savedEntries = await get(entriesPath)
  expect(savedModel).toEqual(model)
  expect(savedCollection).toEqual(collection)
  expect(savedEntry).toEqual(entry)

  const beforeAudit = await audit()

  async function expectContentUnchanged() {
    expect(await get('/api/structs/' + model.id)).toEqual(savedModel)
    expect(await get(collectionPath)).toEqual(savedCollection)
    expect(await get(entryPath)).toEqual(savedEntry)
    expect(await get(entriesPath)).toEqual(savedEntries)
  }

  const provenance = {
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
  }
  const rendererPath = collectionPath + '/renderer'

  // Independently worked sorted-key bytes from the proposed public identity contract.
  const defaultHash = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')
  const virtualDefault = {
    ...provenance,
    version: 0,
    renderer: { schemaVersion: 1, elements: {} },
    rendererSha256: defaultHash,
    consumerContract: null,
    createdAt: null,
    updatedAt: null,
  }
  expect(await get(rendererPath)).toEqual(virtualDefault)
  expect(await get(rendererPath)).toEqual(virtualDefault)
  await expectContentUnchanged()
  expect(await audit()).toEqual(beforeAudit)

  const renderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['text-heading-1'],
        attributes: { title: 'Saved <heading> & ไทย' },
      },
    },
  }
  const savedHash = createHash('sha256')
    .update(
      '{"consumerContract":null,"elements":{"h1":{"attributes":{"title":"Saved <heading> & ไทย"},"classes":["text-heading-1"]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')

  const saveResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer,
  })
  expect(saveResponse.status).toBe(200)

  const saved = await saveResponse.json()
  expect(saved.createdAt).toEqual(expect.any(String))
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt)
  expect(saved.updatedAt).toBe(saved.createdAt)
  expect(saved).toEqual({
    ...provenance,
    version: 1,
    renderer,
    rendererSha256: savedHash,
    consumerContract: null,
    createdAt: saved.createdAt,
    updatedAt: saved.createdAt,
  })
  expect(await get(rendererPath)).toEqual(saved)
  await expectContentUnchanged()

  const afterSaveAudit = await audit()
  const priorIds = new Set(beforeAudit.map((event) => event.id))
  const additions = afterSaveAudit.filter((event) => !priorIds.has(event.id))
  expect(additions).toEqual([
    {
      id: expect.any(Number),
      actor: currentOwner.id,
      action: 'collection.renderer.saved',
      resource: collection.id,
      created_at: expect.any(String),
    },
  ])

  const addedIds = new Set(additions.map((event) => event.id))
  expect(afterSaveAudit.filter((event) => !addedIds.has(event.id))).toEqual(
    beforeAudit,
  )

  // GET's nested renderer remains valid PUT wire data, without synthetic null fields.
  const staleResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer: saved.renderer,
  })
  expect(staleResponse.status).toBe(409)
  expect((await staleResponse.json()).error).toEqual(expect.any(String))

  expect(await get(rendererPath)).toEqual(saved)
  await expectContentUnchanged()
  expect(await audit()).toEqual(afterSaveAudit)
})

test('current reviewed wire round-trips exactly and competing saves accept one revision', async () => {
  const { model, collection } = await createCollection()
  const path = '/api/collections/' + collection.id + '/renderer'
  const beforeAudit = await audit()
  const renderer = {
    schemaVersion: 1,
    consumerContract: 'besh.fixed-heading-id.v1',
    elements: {
      p: { classes: [], attributes: {} },
      h1: {
        classes: ['heading-b', 'heading-a'],
        attributes: { 'x-data': 'h1', title: '' },
      },
      h2: {},
    },
  }
  const hash = createHash('sha256')
    .update(
      '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"title":"","x-data":"h1"},"classes":["heading-b","heading-a"]},"h2":{},"p":{"attributes":{},"classes":[]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')
  const firstResponse = await request(path, 'PUT', { version: 0, renderer })
  expect(firstResponse.status).toBe(200)

  const first = await firstResponse.json()
  expect(first.version).toBe(1)
  expect(first.renderer).toEqual(renderer)
  expect(first.rendererSha256).toBe(hash)
  expect(first.consumerContract).toBe('besh.fixed-heading-id.v1')

  const reviewed = await get(path)
  expect(reviewed).toEqual(first)

  const secondResponse = await request(path, 'PUT', {
    version: reviewed.version,
    renderer: reviewed.renderer,
  })
  expect(secondResponse.status).toBe(200)

  const second = await secondResponse.json()
  expect(second).toEqual({
    ...first,
    version: 2,
    updatedAt: second.updatedAt,
  })
  expect(new Date(second.updatedAt).toISOString()).toBe(second.updatedAt)
  expect(await get(path)).toEqual(second)

  const afterRoundtrip = await audit()
  const stale = await request(path, 'PUT', {
    version: 1,
    renderer: reviewed.renderer,
  })
  expect(stale.status).toBe(409)
  expect(await get(path)).toEqual(second)
  expect(await audit()).toEqual(afterRoundtrip)

  const candidates = [
    { schemaVersion: 1, elements: { p: { classes: ['first-choice'] } } },
    { schemaVersion: 1, elements: { p: { classes: ['second-choice'] } } },
  ]
  const replies = await Promise.all(
    candidates.map((candidate) =>
      request(path, 'PUT', { version: 2, renderer: candidate }),
    ),
  )
  expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])

  const winnerIndex = replies.findIndex((reply) => reply.status === 200)
  const winner = await replies[winnerIndex]!.json()
  expect(winner.version).toBe(3)
  expect(winner.renderer).toEqual(candidates[winnerIndex])
  expect(winner.createdAt).toBe(first.createdAt)
  expect(winner.consumerContract).toBeNull()
  expect(await get(path)).toEqual(winner)
  expect(await get('/api/collections/' + collection.id)).toEqual(collection)
  expect(await get('/api/structs/' + model.id)).toEqual(model)

  const afterAudit = await audit()
  const priorIds = new Set(beforeAudit.map((event) => event.id))
  const additions = afterAudit.filter((event) => !priorIds.has(event.id))
  expect(additions).toHaveLength(3)
  for (const event of additions) {
    expect(event).toEqual({
      id: expect.any(Number),
      actor: 'owner',
      action: 'collection.renderer.saved',
      resource: collection.id,
      created_at: expect.any(String),
    })
  }

  const addedIds = new Set(additions.map((event) => event.id))
  expect(afterAudit.filter((event) => !addedIds.has(event.id))).toEqual(
    beforeAudit,
  )
})

test('collection renderer management denies current non-owners without revealing or saving settings', async () => {
  const { model, collection } = await createCollection()
  const path = '/api/collections/' + collection.id + '/renderer'
  const current = await get(path)
  const editorResponse = await request('/api/members', 'POST', {
    name: 'Presentation editor',
    role: 'editor',
  })
  const viewerResponse = await request('/api/members', 'POST', {
    name: 'Presentation viewer',
    role: 'viewer',
  })
  expect(editorResponse.status).toBe(200)
  expect(viewerResponse.status).toBe(200)

  const editor = await editorResponse.json()
  const viewer = await viewerResponse.json()
  expect(typeof editor.token).toBe('string')
  expect(typeof viewer.token).toBe('string')
  const beforeAudit = await audit()

  const proofs = [
    { token: null, status: 401, actor: 'anonymous', resource: 'management' },
    { token: editor.token, status: 403, actor: editor.id, resource: 'api' },
    { token: viewer.token, status: 403, actor: viewer.id, resource: 'api' },
  ]
  const expectedDenials: { actor: string; resource: string }[] = []
  for (const proof of proofs) {
    for (const method of ['GET', 'PUT']) {
      const reply = await request(
        path,
        method,
        method === 'GET' ? undefined : { version: 0, renderer: null },
        proof.token,
      )
      expect(reply.status).toBe(proof.status)

      const denied = await reply.json()
      expect(denied.error).toEqual(expect.any(String))
      expect(denied.renderer).toBeUndefined()
      expect(denied.collectionId).toBeUndefined()
      expect(denied.rendererSha256).toBeUndefined()
      expectedDenials.push({ actor: proof.actor, resource: proof.resource })
    }
  }

  expect(await get(path)).toEqual(current)
  expect(await get('/api/collections/' + collection.id)).toEqual(collection)
  expect(await get('/api/structs/' + model.id)).toEqual(model)
  const afterAudit = await audit()
  const priorIds = new Set(beforeAudit.map((event) => event.id))
  const additions = afterAudit.filter((event) => !priorIds.has(event.id))
  expect(additions).toHaveLength(expectedDenials.length)
  expect(
    additions.map(({ actor, action, resource }) => ({
      actor,
      action,
      resource,
    })),
  ).toEqual(
    [...expectedDenials].reverse().map((denial) => ({
      ...denial,
      action: 'access.denied',
    })),
  )

  const addedIds = new Set(additions.map((event) => event.id))
  expect(afterAudit.filter((event) => !addedIds.has(event.id))).toEqual(
    beforeAudit,
  )
})

test('strict renderer wire accepts exactly 1024 bytes and rejects invalid settings without effects', async () => {
  const { collection } = await createCollection()
  const path = '/api/collections/' + collection.id + '/renderer'
  const initial = await get(path)
  const beforeAudit = await audit()
  const defaultRenderer = { schemaVersion: 1, elements: {} }
  const invalid = [
    null,
    { version: -1, renderer: defaultRenderer },
    { version: 0.5, renderer: defaultRenderer },
    { version: '0', renderer: defaultRenderer },
    { version: Number.MAX_SAFE_INTEGER + 1, renderer: defaultRenderer },
    { version: 0 },
    { version: 0, renderer: defaultRenderer, publish: true },
    { version: 0, renderer: { schemaVersion: 2, elements: {} } },
    { version: 0, renderer: { ...defaultRenderer, consumerContract: null } },
    { version: 0, renderer: { ...defaultRenderer, ast: { children: [] } } },
    {
      version: 0,
      renderer: { schemaVersion: 1, elements: { script: {} } },
    },
    {
      version: 0,
      renderer: {
        schemaVersion: 1,
        elements: { h1: { attributes: { onclick: 'alert(1)' } } },
      },
    },
    {
      version: 0,
      renderer: {
        schemaVersion: 1,
        elements: { h1: { attributes: { 'x-data': 'h1' } } },
      },
    },
  ]

  for (const value of invalid) {
    const reply = await request(path, 'PUT', value)
    expect(reply.status).toBe(400)
    expect((await reply.json()).error).toEqual(expect.any(String))
    expect(await get(path)).toEqual(initial)
    expect(await get('/api/collections/' + collection.id)).toEqual(collection)
    expect(await audit()).toEqual(beforeAudit)
  }

  const renderer = {
    schemaVersion: 1,
    elements: {
      p: {
        classes: Array.from(
          { length: 7 },
          (_, index) => 'c' + index + 'x'.repeat(62),
        ),
        attributes: { title: 'a'.repeat(160), 'aria-label': 'b'.repeat(160) },
      },
      h1: { attributes: { title: '' } },
    },
  }
  const padding = 1024 - Buffer.byteLength(JSON.stringify(renderer), 'utf8')
  expect(padding).toBeGreaterThan(0)
  expect(padding).toBeLessThan(160)
  renderer.elements.h1.attributes.title = 'x'.repeat(padding)
  expect(Buffer.byteLength(JSON.stringify(renderer), 'utf8')).toBe(1024)

  const response = await request(path, 'PUT', { version: 0, renderer })
  expect(response.status).toBe(200)

  const saved = await response.json()
  expect(saved.version).toBe(1)
  expect(saved.renderer).toEqual(renderer)
  expect(Object.hasOwn(saved.renderer, 'consumerContract')).toBe(false)
  expect(saved.consumerContract).toBeNull()
  expect(await get(path)).toEqual(saved)
  const afterSaveAudit = await audit()

  const excess = structuredClone(renderer)
  excess.elements.h1.attributes.title += 'x'
  expect(Buffer.byteLength(JSON.stringify(excess), 'utf8')).toBe(1025)
  const rejected = await request(path, 'PUT', { version: 1, renderer: excess })
  expect(rejected.status).toBe(400)
  expect(await get(path)).toEqual(saved)
  expect(await get('/api/collections/' + collection.id)).toEqual(collection)
  expect(await audit()).toEqual(afterSaveAudit)
})

test('frozen content and renderer revisions survive restart and an actual downloaded backup', async () => {
  const { model, collection } = await createCollection()
  const collectionPath = '/api/collections/' + collection.id
  const rendererPath = collectionPath + '/renderer'
  const document = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'heading',
        level: 1,
        children: [{ type: 'text', text: 'Frozen <body> & ไทย', marks: [] }],
      },
    ],
  }
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data: { body: document },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  const entryPath = collectionPath + '/entries/' + entry.id
  const firstResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer: { schemaVersion: 1, elements: {} },
  })
  expect(firstResponse.status).toBe(200)
  const savedResponse = await request(rendererPath, 'PUT', {
    version: 1,
    renderer: {
      schemaVersion: 1,
      elements: {
        h1: {
          classes: ['saved-heading', 'article-heading'],
          attributes: { title: 'Presentation <only> & ไทย' },
        },
      },
    },
  })
  expect(savedResponse.status).toBe(200)

  const saved = await savedResponse.json()
  expect(saved.version).toBe(2)
  const changedModelResponse = await request(
    '/api/structs/' + model.id,
    'PUT',
    {
      version: 1,
      name: 'Later model draft',
      fields: [
        {
          key: 'headline',
          label: 'Headline',
          required: true,
          schema: { type: 'text' },
        },
      ],
    },
  )
  expect(changedModelResponse.status).toBe(200)
  const changedModel = await changedModelResponse.json()
  expect(changedModel.version).toBe(2)
  expect(await get(collectionPath)).toEqual(collection)
  expect(await get(entryPath)).toEqual(entry)
  expect(await get(rendererPath)).toEqual(saved)

  const beforePreviewAudit = await audit()
  const previewResponse = await request(entryPath + '/render-preview', 'POST', {
    entryVersion: entry.version,
    fieldKey: 'body',
    renderer: { schemaVersion: 1, elements: {} },
  })
  expect(previewResponse.status).toBe(200)
  expect(await previewResponse.json()).toMatchObject({
    structId: model.id,
    structVersion: 1,
    entryId: entry.id,
    entryVersion: entry.version,
    html: '<h1>Frozen &lt;body&gt; &amp; ไทย</h1>',
  })
  expect(await audit()).toEqual(beforePreviewAudit)
  expect(await get(rendererPath)).toEqual(saved)

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())
  expect(bytes.byteLength).toBe(backup.bytes)
  expect(new TextDecoder().decode(bytes.slice(0, 16))).toBe('SQLite format 3\0')

  await server.close()
  server = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
  })
  expect(await get(rendererPath)).toEqual(saved)
  expect(await get(collectionPath)).toEqual(collection)
  expect(await get(entryPath)).toEqual(entry)
  expect(await get('/api/structs/' + model.id)).toEqual(changedModel)

  const restoredDirectory = join(directory, 'restored')
  mkdirSync(restoredDirectory)
  writeFileSync(join(restoredDirectory, 'control.sqlite'), bytes)
  const restored = createApp({
    databasePath: join(restoredDirectory, 'control.sqlite'),
    backupDir: join(restoredDirectory, 'backups'),
    adminToken: owner,
  })

  try {
    for (const [path, expected] of [
      [rendererPath, saved],
      [collectionPath, collection],
      [entryPath, entry],
      ['/api/structs/' + model.id, changedModel],
    ] as const) {
      const reply = await restored.app.handle(
        new Request(origin + path, {
          headers: { authorization: 'Bearer ' + owner },
        }),
      )
      expect(reply.status).toBe(200)
      expect(await reply.json()).toEqual(expected)
    }

    const migrationResponse = await restored.app.handle(
      new Request(origin + '/api/migrations', {
        headers: { authorization: 'Bearer ' + owner },
      }),
    )
    expect(migrationResponse.status).toBe(200)
    const migrations = await migrationResponse.json()
    expect(
      migrations.filter(
        (migration: { version: number }) => migration.version === 27,
      ),
    ).toHaveLength(1)
  } finally {
    await restored.close()
  }
})

test('malformed downloaded-backup renderer inputs fail closed through public GET and PUT', async () => {
  const { collection } = await createCollection()
  const collectionPath = '/api/collections/' + collection.id
  const path = collectionPath + '/renderer'
  const renderer = { schemaVersion: 1, elements: { p: { classes: ['saved'] } } }
  const savedResponse = await request(path, 'PUT', { version: 0, renderer })
  expect(savedResponse.status).toBe(200)
  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())

  const variants = [
    {
      name: 'invalid-wire',
      sql: 'UPDATE collection_renderers SET renderer = ? WHERE collection_id = ?',
      value: JSON.stringify({ schemaVersion: 1, elements: { script: {} } }),
    },
    {
      name: 'invalid-hash',
      sql: 'UPDATE collection_renderers SET renderer_sha256 = ? WHERE collection_id = ?',
      value: '0'.repeat(64),
    },
    {
      name: 'invalid-time',
      sql: 'UPDATE collection_renderers SET updated_at = ? WHERE collection_id = ?',
      value: 'yesterday',
    },
  ]

  for (const variant of variants) {
    const fixtureDirectory = join(directory, variant.name)
    mkdirSync(fixtureDirectory)
    const fixturePath = join(fixtureDirectory, 'control.sqlite')
    writeFileSync(fixturePath, bytes)

    // Modify only disposable backup inputs; behavior is asserted through HTTP.
    const fixture = new Database(fixturePath)
    try {
      fixture.query(variant.sql).run(variant.value, collection.id)
    } finally {
      fixture.close()
    }

    const restored = createApp({
      databasePath: fixturePath,
      backupDir: join(fixtureDirectory, 'backups'),
      adminToken: owner,
    })
    async function restoredRequest(
      route: string,
      method = 'GET',
      body?: unknown,
    ) {
      return restored.app.handle(
        new Request(origin + route, {
          method,
          headers: {
            origin,
            authorization: 'Bearer ' + owner,
            'content-type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      )
    }

    try {
      const beforeAuditResponse = await restoredRequest('/api/audit')
      expect(beforeAuditResponse.status).toBe(200)
      const beforeAudit = await beforeAuditResponse.json()

      for (const method of ['GET', 'PUT', 'GET']) {
        const reply = await restoredRequest(
          path,
          method,
          method === 'PUT' ? { version: 1, renderer } : undefined,
        )
        expect(reply.status).toBe(503)
        const denied = await reply.json()
        expect(denied.error).toBe('Collection renderer is unavailable')
        expect(denied.renderer).toBeUndefined()
        expect(denied.version).toBeUndefined()
      }

      const collectionResponse = await restoredRequest(collectionPath)
      expect(collectionResponse.status).toBe(200)
      expect(await collectionResponse.json()).toEqual(collection)
      const afterAuditResponse = await restoredRequest('/api/audit')
      expect(afterAuditResponse.status).toBe(200)
      expect(await afterAuditResponse.json()).toEqual(beforeAudit)
    } finally {
      await restored.close()
    }
  }
})

test('a representative pre-renderer backup migrates once without saving default settings', async () => {
  const { model, collection } = await createCollection()
  const collectionPath = '/api/collections/' + collection.id
  const rendererPath = collectionPath + '/renderer'
  const entryResponse = await request(collectionPath + '/entries', 'POST', {
    data: {
      body: {
        type: 'document',
        astVersion: 2,
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Before renderer ไทย', marks: [] },
            ],
          },
        ],
      },
    },
  })
  expect(entryResponse.status).toBe(200)
  const entry = await entryResponse.json()
  const entryPath = collectionPath + '/entries/' + entry.id

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)
  const bytes = new Uint8Array(await download.arrayBuffer())
  expect(bytes.byteLength).toBe(backup.bytes)

  const fixtureDirectory = join(directory, 'pre-renderer')
  mkdirSync(fixtureDirectory)
  const fixturePath = join(fixtureDirectory, 'control.sqlite')
  writeFileSync(fixturePath, bytes)

  // This disposable input models the preceding schema; it is not an old release artifact.
  const fixture = new Database(fixturePath)
  try {
    fixture.run('DROP TABLE collection_renderers')
    fixture.query('DELETE FROM migrations WHERE version = ?').run(27)
  } finally {
    fixture.close()
  }

  const options = {
    databasePath: fixturePath,
    backupDir: join(fixtureDirectory, 'backups'),
    adminToken: owner,
  }
  let restored = createApp(options)
  async function restoredGet(path: string) {
    const response = await restored.app.handle(
      new Request(origin + path, {
        headers: { authorization: 'Bearer ' + owner },
      }),
    )
    expect(response.status).toBe(200)

    return response.json()
  }

  const expected = {
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    version: 0,
    renderer: { schemaVersion: 1, elements: {} },
    rendererSha256: createHash('sha256')
      .update('{"consumerContract":null,"elements":{},"schemaVersion":1}')
      .digest('hex'),
    consumerContract: null,
    createdAt: null,
    updatedAt: null,
  }

  try {
    const beforeAudit = await restoredGet('/api/audit')
    const migrations = await restoredGet('/api/migrations')
    expect(
      migrations.filter(
        (migration: { version: number }) => migration.version === 27,
      ),
    ).toHaveLength(1)

    for (let opening = 0; opening < 2; opening++) {
      if (opening === 1) {
        await restored.close()
        restored = createApp(options)
      }

      expect(await restoredGet(rendererPath)).toEqual(expected)
      expect(await restoredGet(rendererPath)).toEqual(expected)
      expect(await restoredGet(collectionPath)).toEqual(collection)
      expect(await restoredGet(entryPath)).toEqual(entry)
      expect(await restoredGet('/api/structs/' + model.id)).toEqual(model)
      expect(await restoredGet('/api/migrations')).toEqual(migrations)
      expect(await restoredGet('/api/audit')).toEqual(beforeAudit)
    }
  } finally {
    await restored.close()
  }
})

test('an exhausted renderer revision cannot wrap or change its saved settings', async () => {
  const { collection } = await createCollection()
  const collectionPath = '/api/collections/' + collection.id
  const path = collectionPath + '/renderer'
  const renderer = {
    schemaVersion: 1,
    elements: { p: { classes: ['retained'] } },
  }
  const savedResponse = await request(path, 'PUT', { version: 0, renderer })
  expect(savedResponse.status).toBe(200)
  const saved = await savedResponse.json()

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request('/api/backups/' + backup.id)
  expect(download.status).toBe(200)

  const fixtureDirectory = join(directory, 'exhausted')
  mkdirSync(fixtureDirectory)
  const fixturePath = join(fixtureDirectory, 'control.sqlite')
  writeFileSync(fixturePath, new Uint8Array(await download.arrayBuffer()))

  const fixture = new Database(fixturePath)
  try {
    fixture
      .query(
        'UPDATE collection_renderers SET version = ? WHERE collection_id = ?',
      )
      .run(Number.MAX_SAFE_INTEGER, collection.id)
  } finally {
    fixture.close()
  }

  const restored = createApp({
    databasePath: fixturePath,
    backupDir: join(fixtureDirectory, 'backups'),
    adminToken: owner,
  })
  async function restoredRequest(
    route: string,
    method = 'GET',
    body?: unknown,
  ) {
    return restored.app.handle(
      new Request(origin + route, {
        method,
        headers: {
          origin,
          authorization: 'Bearer ' + owner,
          'content-type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  }
  async function restoredGet(route: string) {
    const response = await restoredRequest(route)
    expect(response.status).toBe(200)

    return response.json()
  }

  try {
    const exhausted = { ...saved, version: Number.MAX_SAFE_INTEGER }
    expect(await restoredGet(path)).toEqual(exhausted)
    const beforeAudit = await restoredGet('/api/audit')

    const rejected = await restoredRequest(path, 'PUT', {
      version: Number.MAX_SAFE_INTEGER,
      renderer: { schemaVersion: 1, elements: {} },
    })
    expect(rejected.status).toBe(409)
    expect((await rejected.json()).error).toBe(
      'Collection renderer changed. Reload before saving.',
    )
    expect(await restoredGet(path)).toEqual(exhausted)
    expect(await restoredGet(collectionPath)).toEqual(collection)
    expect(await restoredGet('/api/audit')).toEqual(beforeAudit)
  } finally {
    await restored.close()
  }
})

test('a renderer save with a held body cannot use a replaced owner proof', async () => {
  const { collection } = await createCollection()
  const path = '/api/collections/' + collection.id + '/renderer'
  const original = await get(path)
  const renderer = {
    schemaVersion: 1,
    elements: { p: { classes: ['reviewed'] } },
  }
  const body = new TextEncoder().encode(
    JSON.stringify({ version: 0, renderer }),
  )
  let release!: () => void
  let consumed!: () => void
  const reading = new Promise<void>((resolve) => {
    consumed = resolve
  })
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body.slice(0, 1))
      release = () => {
        controller.enqueue(body.slice(1))
        controller.close()
      }
    },
    pull() {
      consumed()
    },
  })
  const pending = server.app.handle(
    new Request(origin + path, {
      method: 'PUT',
      headers: {
        origin,
        authorization: 'Bearer ' + owner,
        'content-type': 'application/json',
      },
      body: stream,
    }),
  )
  await reading

  const replacement = 'replacement-renderer-owner-proof-at-least-32-characters'
  const rotated = createApp({
    databasePath: join(directory, 'control.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: replacement,
  })

  try {
    const beforeAudit = await (
      await request('/api/audit', 'GET', undefined, replacement)
    ).json()
    release()
    const denied = await pending
    expect(denied.status).toBe(401)
    expect((await denied.json()).renderer).toBeUndefined()

    const currentResponse = await request(path, 'GET', undefined, replacement)
    expect(currentResponse.status).toBe(200)
    expect(await currentResponse.json()).toEqual(original)
    const afterAudit = await (
      await request('/api/audit', 'GET', undefined, replacement)
    ).json()
    const priorIds = new Set(beforeAudit.map((event: AuditEvent) => event.id))
    const additions = afterAudit.filter(
      (event: AuditEvent) => !priorIds.has(event.id),
    )
    expect(additions).toEqual([
      {
        id: expect.any(Number),
        actor: 'anonymous',
        action: 'access.denied',
        resource: 'management',
        created_at: expect.any(String),
      },
    ])
    expect(
      afterAudit.filter((event: AuditEvent) => priorIds.has(event.id)),
    ).toEqual(beforeAudit)

    const accepted = await request(
      path,
      'PUT',
      { version: 0, renderer },
      replacement,
    )
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ version: 1, renderer })
  } finally {
    await rotated.close()
  }
})
