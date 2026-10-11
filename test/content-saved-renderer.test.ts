import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const owner = 'saved-renderer-preview-owner-key-at-least-32-characters'
const origin = 'http://127.0.0.1:5173'
const temporaryPrefix = 'besh-saved-renderer-preview-'
let directory: string
let server: ReturnType<typeof createApp>

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

function request(path: string, method = 'GET', body?: unknown) {
  return server.app.handle(
    new Request(origin + path, {
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

async function get(path: string) {
  const response = await request(path)
  expect(response.status).toBe(200)

  return response.json()
}

test('owner previews exact current saved HTML settings without changing content or audit', async () => {
  const fields = [
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Saved renderer articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private saved renderer articles',
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
          {
            type: 'text',
            text: '  <script>literal</script> & ไทย $input.body.secret $data $auth  ',
            marks: [],
          },
        ],
      },
    ],
  }
  const modelPath = '/api/structs/' + model.id
  const collectionPath = '/api/collections/' + collection.id
  const entriesPath = collectionPath + '/entries'
  const rendererPath = collectionPath + '/renderer'
  const entryResponse = await request(entriesPath, 'POST', {
    data: { body: document },
  })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.collectionId).toBe(collection.id)
  expect(entry.version).toBe(1)
  expect(entry.data).toEqual({ body: document })

  const entryPath = entriesPath + '/' + entry.id
  const previewPath = entryPath + '/render-preview'
  expect(await get(modelPath)).toEqual(model)
  expect(await get(collectionPath)).toEqual(collection)
  expect(await get(entryPath)).toEqual(entry)

  const renderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['heading-b', 'heading-a'],
        attributes: { title: 'Saved <heading> & ไทย', 'x-data': 'h1' },
      },
      h2: {},
      p: { classes: [], attributes: {} },
    },
    consumerContract: 'besh.fixed-heading-id.v1',
  }

  // Independently authored canonical bytes, not a production parser/hash helper.
  const firstHash = createHash('sha256')
    .update(
      '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"title":"Saved <heading> & ไทย","x-data":"h1"},"classes":["heading-b","heading-a"]},"h2":{},"p":{"attributes":{},"classes":[]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')
  const saveResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer,
  })
  expect(saveResponse.status).toBe(200)

  const saved = await saveResponse.json()
  expect(saved.version).toBe(1)
  expect(saved.renderer).toEqual(renderer)
  expect(saved.rendererSha256).toBe(firstHash)
  expect(saved.consumerContract).toBe('besh.fixed-heading-id.v1')
  expect(await get(rendererPath)).toEqual(saved)

  async function snapshot() {
    return {
      model: await get(modelPath),
      collection: await get(collectionPath),
      entry: await get(entryPath),
      entries: await get(entriesPath),
      renderer: await get(rendererPath),
      audit: await get('/api/audit'),
    }
  }

  const beforeFirstPreview = await snapshot()
  const identity = {
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
    entryId: entry.id,
    entryVersion: 1,
    fieldKey: 'body',
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
  }
  const escapedText =
    '  &lt;script&gt;literal&lt;/script&gt; &amp; ไทย $input.body.secret $data $auth  '
  const firstPreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldKey: 'body',
    rendererVersion: 1,
  })
  expect(firstPreview.status).toBe(200)
  expect(await firstPreview.json()).toEqual({
    ...identity,
    rendererVersion: 1,
    rendererSha256: firstHash,
    consumerContract: 'besh.fixed-heading-id.v1',
    html:
      '<h1 class="heading-b heading-a" title="Saved &lt;heading&gt; &amp; ไทย" x-data="h1">' +
      escapedText +
      '</h1>',
  })
  expect(await snapshot()).toEqual(beforeFirstPreview)

  const secondRenderer = {
    schemaVersion: 1,
    elements: {
      h1: {
        classes: ['second-heading'],
        attributes: { 'aria-label': 'Second & <heading>' },
      },
    },
  }
  const secondHash = createHash('sha256')
    .update(
      '{"consumerContract":null,"elements":{"h1":{"attributes":{"aria-label":"Second & <heading>"},"classes":["second-heading"]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')
  const updateResponse = await request(rendererPath, 'PUT', {
    version: 1,
    renderer: secondRenderer,
  })
  expect(updateResponse.status).toBe(200)

  const updated = await updateResponse.json()
  expect(updated.version).toBe(2)
  expect(updated.renderer).toEqual(secondRenderer)
  expect(updated.rendererSha256).toBe(secondHash)
  expect(updated.consumerContract).toBeNull()
  expect(await get(rendererPath)).toEqual(updated)

  const beforeCurrentPreview = await snapshot()
  const stalePreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldKey: 'body',
    rendererVersion: 1,
  })
  expect(stalePreview.status).toBe(409)
  expect(await snapshot()).toEqual(beforeCurrentPreview)

  const currentPreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldKey: 'body',
    rendererVersion: 2,
  })
  expect(currentPreview.status).toBe(200)
  expect(await currentPreview.json()).toEqual({
    ...identity,
    rendererVersion: 2,
    rendererSha256: secondHash,
    consumerContract: null,
    html:
      '<h1 class="second-heading" aria-label="Second &amp; &lt;heading&gt;">' +
      escapedText +
      '</h1>',
  })
  expect(await snapshot()).toEqual(beforeCurrentPreview)

  const defaultRenderer = { schemaVersion: 1, elements: {} }
  const bothSelectors = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldKey: 'body',
    rendererVersion: 2,
    renderer: defaultRenderer,
  })
  expect(bothSelectors.status).toBe(400)
  expect(await snapshot()).toEqual(beforeCurrentPreview)

  const defaultHash = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')
  const transientPreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldKey: 'body',
    renderer: defaultRenderer,
  })
  expect(transientPreview.status).toBe(200)
  expect(await transientPreview.json()).toEqual({
    ...identity,
    rendererSha256: defaultHash,
    consumerContract: null,
    html: '<h1>' + escapedText + '</h1>',
  })
  expect(await snapshot()).toEqual(beforeCurrentPreview)
})

test('saved renderer selection preserves virtual defaults, nested fields and owner boundaries', async () => {
  const fields = [
    {
      key: 'sections',
      label: 'Sections',
      required: true,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          fields: [
            {
              key: 'body',
              label: 'Body',
              required: true,
              schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
            },
          ],
        },
      },
    },
  ]
  const modelResponse = await request('/api/structs', 'POST', {
    name: 'Nested saved renderer articles',
    fields,
  })
  expect(modelResponse.status).toBe(200)

  const model = await modelResponse.json()
  expect(model.version).toBe(1)
  expect(model.fields).toEqual(fields)

  const collectionResponse = await request('/api/collections', 'POST', {
    name: 'Private nested saved renderer articles',
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
          { type: 'text', text: '  <b>Nested</b> & ไทย  ', marks: [] },
        ],
      },
    ],
  }
  const data = { sections: [{ body: document }] }
  const modelPath = '/api/structs/' + model.id
  const collectionPath = '/api/collections/' + collection.id
  const entriesPath = collectionPath + '/entries'
  const rendererPath = collectionPath + '/renderer'
  const entryResponse = await request(entriesPath, 'POST', { data })
  expect(entryResponse.status).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.collectionId).toBe(collection.id)
  expect(entry.version).toBe(1)
  expect(entry.data).toEqual(data)

  const entryPath = entriesPath + '/' + entry.id
  const previewPath = entryPath + '/render-preview'
  const fieldPath = ['sections', 0, 'body']
  const defaultRenderer = { schemaVersion: 1, elements: {} }
  const defaultHash = createHash('sha256')
    .update('{"consumerContract":null,"elements":{},"schemaVersion":1}', 'utf8')
    .digest('hex')
  const provenance = {
    collectionId: collection.id,
    collectionVersion: 1,
    structId: model.id,
    structVersion: 1,
  }
  const identity = {
    ...provenance,
    entryId: entry.id,
    entryVersion: 1,
    fieldKey: 'body',
    fieldPath,
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
  }
  const escapedText = '  &lt;b&gt;Nested&lt;/b&gt; &amp; ไทย  '

  async function resources() {
    return {
      model: await get(modelPath),
      collection: await get(collectionPath),
      entry: await get(entryPath),
      entries: await get(entriesPath),
      renderer: await get(rendererPath),
    }
  }

  async function snapshot() {
    return { ...(await resources()), audit: await get('/api/audit') }
  }

  expect(await get(modelPath)).toEqual(model)
  expect(await get(collectionPath)).toEqual(collection)
  expect(await get(entryPath)).toEqual(entry)
  expect(await get(rendererPath)).toEqual({
    ...provenance,
    version: 0,
    renderer: defaultRenderer,
    rendererSha256: defaultHash,
    consumerContract: null,
    createdAt: null,
    updatedAt: null,
  })

  const beforeVirtualPreview = await snapshot()
  const virtualPreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldPath,
    rendererVersion: 0,
  })
  expect(virtualPreview.status).toBe(200)
  expect(await virtualPreview.json()).toEqual({
    ...identity,
    rendererVersion: 0,
    rendererSha256: defaultHash,
    consumerContract: null,
    html: '<h1>' + escapedText + '</h1>',
  })
  expect(await snapshot()).toEqual(beforeVirtualPreview)

  const invalidVersions = [-1, 0.5, 9007199254740992, '0', null, true]
  const invalidRequests = [
    ...invalidVersions.map((rendererVersion) => ({
      entryVersion: 1,
      fieldPath,
      rendererVersion,
    })),
    { entryVersion: 1, fieldPath },
    {
      entryVersion: 1,
      fieldPath,
      rendererVersion: 0,
      renderer: defaultRenderer,
    },
    { entryVersion: 1, fieldPath, savedRendererVersion: 0 },
  ]

  for (const body of invalidRequests) {
    const rejected = await request(previewPath, 'POST', body)
    expect(rejected.status).toBe(400)
    expect((await rejected.json()).error).toEqual(expect.any(String))
    expect(await snapshot()).toEqual(beforeVirtualPreview)
  }

  const viewerResponse = await request('/api/members', 'POST', {
    name: 'Nested preview viewer',
    role: 'viewer',
  })
  expect(viewerResponse.status).toBe(200)

  const viewer = await viewerResponse.json()
  expect(typeof viewer.token).toBe('string')

  const beforeDeniedResources = await resources()
  const beforeDeniedAudit: {
    id: number
    actor: string
    action: string
    resource: string
  }[] = await get('/api/audit')
  const proofs = [
    { token: viewer.token, status: 403, actor: viewer.id, resource: 'api' },
    { token: null, status: 401, actor: 'anonymous', resource: 'management' },
  ]

  for (const proof of proofs) {
    const headers = new Headers({ origin, 'content-type': 'application/json' })
    if (proof.token !== null)
      headers.set('authorization', 'Bearer ' + proof.token)

    const denied = await server.app.handle(
      new Request(origin + previewPath, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entryVersion: 1,
          fieldPath,
          rendererVersion: 0,
        }),
      }),
    )
    expect(denied.status).toBe(proof.status)

    const reply = await denied.json()
    expect(Object.keys(reply)).toEqual(['error'])
    expect(reply.error).toEqual(expect.any(String))
    expect(await resources()).toEqual(beforeDeniedResources)
  }

  const afterDeniedAudit: typeof beforeDeniedAudit = await get('/api/audit')
  const priorIds = new Set(beforeDeniedAudit.map((event) => event.id))
  const additions = afterDeniedAudit.filter((event) => !priorIds.has(event.id))
  expect(additions).toHaveLength(proofs.length)
  expect(
    additions.map(({ actor, action, resource }) => ({
      actor,
      action,
      resource,
    })),
  ).toEqual(
    [...proofs].reverse().map(({ actor, resource }) => ({
      actor,
      action: 'access.denied',
      resource,
    })),
  )

  const addedIds = new Set(additions.map((event) => event.id))
  expect(afterDeniedAudit.filter((event) => !addedIds.has(event.id))).toEqual(
    beforeDeniedAudit,
  )

  const renderer = {
    schemaVersion: 1,
    elements: { h1: { classes: ['nested-heading'] } },
  }
  const savedHash = createHash('sha256')
    .update(
      '{"consumerContract":null,"elements":{"h1":{"classes":["nested-heading"]}},"schemaVersion":1}',
      'utf8',
    )
    .digest('hex')
  const saveResponse = await request(rendererPath, 'PUT', {
    version: 0,
    renderer,
  })
  expect(saveResponse.status).toBe(200)

  const saved = await saveResponse.json()
  expect(saved.version).toBe(1)
  expect(saved.renderer).toEqual(renderer)
  expect(saved.rendererSha256).toBe(savedHash)
  expect(await get(rendererPath)).toEqual(saved)

  const beforeSavedPreview = await snapshot()
  const staleZero = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldPath,
    rendererVersion: 0,
  })
  expect(staleZero.status).toBe(409)
  expect(await staleZero.json()).toEqual({
    error: 'Collection renderer changed. Reload before previewing.',
  })
  expect(await snapshot()).toEqual(beforeSavedPreview)

  const currentPreview = await request(previewPath, 'POST', {
    entryVersion: 1,
    fieldPath,
    rendererVersion: 1,
  })
  expect(currentPreview.status).toBe(200)
  expect(await currentPreview.json()).toEqual({
    ...identity,
    rendererVersion: 1,
    rendererSha256: savedHash,
    consumerContract: null,
    html: '<h1 class="nested-heading">' + escapedText + '</h1>',
  })
  expect(await snapshot()).toEqual(beforeSavedPreview)
})
