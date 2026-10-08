import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { createApp } from '../src/app'
import { executeFlow } from '../src/flows/engine'
import { helloFlow, graphqlFlow } from './fixtures'
import manifest from '../package.json'

const owner = 'contract-owner-token-32-characters-long'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-contract-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
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
    headers: Record<string, string> = {},
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...headers,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
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

  async function publish(flow: unknown) {
    const response = await request('/api/flows', 'POST', flow)
    expect(response.status).toBe(200)
    const saved = await response.json()
    expect(
      (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(200)
    const key = await (
      await request('/api/runtime-keys', 'POST', {
        name: 'Caller',
        flowId: saved.id,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
    ).json()
    return { saved, token: key.token }
  }

  return {
    request,
    publish,
    server: () => server,
    options,
    reopen() {
      server.close()
      server = createApp(options)
    },
  }
}

test('health reports the installed package version after a release bump', async () => {
  const { request } = workspace()
  const response = await request('/health')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    status: 'ok',
    version: manifest.version,
  })
})

test('native HTTP canonical paths retain scoped authorization and reject observable unsafe segments', async () => {
  const { publish, server } = workspace()
  const { token } = await publish({ ...helloFlow, path: '/users/:id' })
  await publish({ ...helloFlow, path: '/private/:id' })
  server().app.listen({ port: 0, hostname: '127.0.0.1' })
  const native = server().app.server!
  cleanup.push(() => {
    void native.stop(true)
  })

  async function status(path: string) {
    return new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        {
          hostname: '127.0.0.1',
          port: native.port,
          path,
          headers: { authorization: `Bearer ${token}` },
        },
        (response) => {
          response.resume()
          response.on('end', () => resolve(response.statusCode!))
        },
      )
      request.on('error', reject)
      request.end()
    })
  }

  expect(await status('/run/users/Ada')).toBe(200)
  for (const path of [
    '/run/users/%2e%2e/users/Ada',
    '/run/users/a\\..\\Ada',
    '/run/users/../users/Ada',
  ])
    expect(await status(path), path).toBe(200)
  for (const path of [
    '/run/users/%2e%2e/private/secret',
    '/run/users/a\\..\\..\\private\\secret',
  ])
    expect(await status(path), path).toBe(403)
  expect(await status('/run/users/%2e/users/Ada')).toBe(404)
  for (const path of ['/run/users/Ada%2Fprivate', '/run/users/Ada%5Cprivate'])
    expect(await status(path), path).toBe(400)
})

test('REST route parameters decode once and resolve in responses and draft tests', async () => {
  const { request, publish } = workspace()
  const flow = {
    ...helloFlow,
    path: '/v1/users/:userId',
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 200, body: { id: '$input.params.userId' } },
      },
    ],
  }
  const { saved, token } = await publish(flow)
  const result = await request(
    '/run/v1/users/Ada%20Lovelace',
    'GET',
    undefined,
    token,
  )
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ id: 'Ada Lovelace' })
  expect(
    await (
      await request('/run/v1/users/%252F', 'GET', undefined, token)
    ).json(),
  ).toEqual({ id: '%2F' })
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: null,
        query: {},
      })
    ).status,
  ).toBe(400)
  const draft = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: {},
    params: { userId: 'Ada' },
  })
  expect(draft.status).toBe(200)
  expect((await draft.json()).body).toEqual({ id: 'Ada' })
})

test('path rules coerce scalars and OpenAPI exposes required path parameters', async () => {
  const { request, publish } = workspace()
  const { saved, token } = await publish({
    ...helloFlow,
    path: '/v1/items/:id/:active',
    contract: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1 },
          active: { type: 'boolean' },
        },
        required: ['id', 'active'],
        additionalProperties: false,
      },
    },
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: {
          status: 200,
          body: { id: '$input.params.id', active: '$input.params.active' },
        },
      },
    ],
  })
  const response = await request(
    '/run/v1/items/42/false',
    'GET',
    undefined,
    token,
  )
  expect(await response.json()).toEqual({ id: 42, active: false })
  expect(
    (await request('/run/v1/items/0/false', 'GET', undefined, token)).status,
  ).toBe(400)
  const document = await (
    await request(`/api/flows/${saved.id}/openapi`)
  ).json()
  expect(document.paths['/run/v1/items/{id}/{active}'].get.parameters).toEqual([
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'integer', minimum: 1 },
    },
    { name: 'active', in: 'path', required: true, schema: { type: 'boolean' } },
  ])
})

test('publication rejects overlapping REST routes without capturing another flow key', async () => {
  const { request, publish } = workspace()
  const { token } = await publish({ ...helloFlow, path: '/v1/users/:id' })
  for (const path of ['/v1/users/me', '/v1/users/:name']) {
    const saved = await (
      await request('/api/flows', 'POST', { ...helloFlow, path })
    ).json()
    expect(
      (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 1 }))
        .status,
    ).toBe(409)
  }
  await publish({ ...helloFlow, path: '/v2/users/:id' })
  await publish({ ...helloFlow, path: '/v1/users/me', method: 'POST' })
  expect((await request('/run/v1/users/me', 'POST', {}, token)).status).toBe(
    403,
  )
})

test('owners roll back immutable releases while the latest draft remains untouched', async () => {
  const { request, publish, reopen } = workspace()
  const { saved, token } = await publish(helloFlow)
  const second = { ...helloFlow, path: '/v2/hello', name: 'Second version' }
  expect(
    (await request(`/api/flows/${saved.id}`, 'PUT', { ...second, revision: 1 }))
      .status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...second,
        name: 'Future draft',
        revision: 2,
      })
    ).status,
  ).toBe(200)
  const historyResponse = await request(`/api/flows/${saved.id}/releases`)
  expect(historyResponse.status).toBe(200)
  const history = await historyResponse.json()
  expect(
    history.map((release: { revision: number; current: boolean }) => [
      release.revision,
      release.current,
    ]),
  ).toEqual([
    [2, true],
    [1, false],
  ])
  const snapshot = await (
    await request(`/api/flows/${saved.id}/releases/1`)
  ).json()
  expect(snapshot.definition).toEqual(helloFlow)
  const rollback = await request(`/api/flows/${saved.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  expect(rollback.status).toBe(200)
  expect(await rollback.json()).toMatchObject({
    name: 'Future draft',
    revision: 3,
    publishedRevision: 1,
    publishedEndpoint: { path: '/hello' },
  })
  expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
    200,
  )
  expect((await request('/run/v2/hello', 'GET', undefined, token)).status).toBe(
    404,
  )
  expect(
    (
      await request(`/api/flows/${saved.id}/rollback`, 'POST', {
        revision: 2,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/flows/${saved.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 1,
      })
    ).status,
  ).toBe(409)
  expect(
    (
      await request(`/api/flows/${saved.id}/rollback`, 'POST', {
        revision: 99,
        publishedRevision: 1,
      })
    ).status,
  ).toBe(404)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ),
  ).toHaveLength(1)
  reopen()
  expect(
    (await (await request(`/api/flows/${saved.id}/releases/1`)).json())
      .definition,
  ).toEqual(snapshot.definition)
  expect(
    (await (await request(`/api/flows/${saved.id}`)).json()).publishedRevision,
  ).toBe(1)
})

test('invalid parameter definitions, rules and inputs fail safely', async () => {
  const { request, publish } = workspace()
  for (const path of [
    '/users/:id/:id',
    '/users/:constructor',
    '/users/:prototype',
    '/users/:__proto__',
    '/users/:1id',
    '/users/pre:id',
    '/users/:id?',
    '/users/*',
    '/users/:id(\\d+)',
    '/users/:id.:ext',
  ])
    expect(
      (await request('/api/flows', 'POST', { ...helloFlow, path })).status,
    ).toBe(400)
  expect(
    (
      await request('/api/flows', 'POST', {
        ...graphqlFlow,
        path: '/users/:id',
      })
    ).status,
  ).toBe(400)
  for (const params of [
    { type: 'string' },
    { type: 'object', properties: { id: { type: 'string' } } },
    {
      type: 'object',
      properties: { other: { type: 'string' } },
      required: ['other'],
    },
    {
      type: 'object',
      properties: { id: { type: 'string', nullable: true } },
      required: ['id'],
    },
    {
      type: 'object',
      nullable: true,
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    {
      type: 'object',
      properties: { id: { type: 'array', items: { type: 'string' } } },
      required: ['id'],
    },
    {
      type: 'object',
      properties: { id: { type: 'object' } },
      required: ['id'],
    },
  ])
    expect(
      (
        await request('/api/flows', 'POST', {
          ...helloFlow,
          path: '/users/:id',
          contract: { params },
        })
      ).status,
    ).toBe(400)
  const { saved, token } = await publish({ ...helloFlow, path: '/users/:id' })
  for (const value of [
    '%2F',
    '%5C',
    '%00',
    '%',
    '%GG',
    '%C0%AF',
    '%2e%2e%2Fhidden',
  ]) {
    const failure = await request(
      `/run/users/${value}`,
      'GET',
      undefined,
      token,
    )
    expect(failure.status).toBe(400)
    expect(await failure.text()).not.toContain('hidden')
  }
  for (const value of ['%0A', '%09', '%7F'])
    expect(
      (await request(`/run/users/${value}`, 'GET', undefined, token)).status,
    ).toBe(400)
  for (const params of [
    {},
    { id: '.' },
    { id: '..' },
    { id: '' },
    { id: 'a/b' },
    { id: 'a\\b' },
    { id: 'a\u0000b' },
    { id: 'ok', other: 'extra' },
  ])
    expect(
      (
        await request(`/api/flows/${saved.id}/test`, 'POST', {
          body: null,
          query: {},
          params,
        })
      ).status,
    ).toBe(400)
  const document = await (
    await request(`/api/flows/${saved.id}/openapi`)
  ).json()
  expect(document.paths['/run/users/{id}'].get.parameters).toEqual([
    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
  ])
})

test('conditions read typed route parameters through the executor boundary', async () => {
  const flow = {
    ...helloFlow,
    path: '/items/:count',
    contract: {
      params: {
        type: 'object',
        properties: { count: { type: 'integer' } },
        required: ['count'],
      },
    },
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'check',
        type: 'condition',
        position: { x: 200, y: 100 },
        config: { field: 'params.count', equals: 2 },
      },
      { ...helloFlow.nodes[1], config: { status: 200, body: 'two' } },
      {
        ...helloFlow.nodes[1],
        id: 'other',
        config: { status: 200, body: 'other' },
      },
    ],
    edges: [
      { id: 'a', source: 'request', target: 'check' },
      { id: 'b', source: 'check', target: 'response', sourceHandle: 'true' },
      { id: 'c', source: 'check', target: 'other', sourceHandle: 'false' },
    ],
  }
  expect(
    (await executeFlow(flow, { body: null, query: {}, params: { count: '2' } }))
      .body,
  ).toBe('two')
  expect(
    (await executeFlow(flow, { body: null, query: {}, params: { count: '3' } }))
      .body,
  ).toBe('other')
})

test('unicode path values work while malformed UTF-16 draft values are rejected', async () => {
  const { request, publish } = workspace()
  const { saved, token } = await publish({
    ...helloFlow,
    path: '/users/:name',
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 200, body: '$input.params.name' },
      },
    ],
  })
  const response = await request(
    '/run/users/%E0%B9%84%E0%B8%97%E0%B8%A2',
    'GET',
    undefined,
    token,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toBe('ไทย')
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: null,
        query: {},
        params: { name: '\ud800' },
      })
    ).status,
  ).toBe(400)
})

test('rollback respects member roles, strict revision input, and route conflicts atomically', async () => {
  const { request, publish } = workspace()
  const { saved, token } = await publish({ ...helloFlow, path: '/users/:id' })
  await request(`/api/flows/${saved.id}`, 'PUT', {
    ...helloFlow,
    path: '/v2/users/:id',
    revision: 1,
  })
  await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 })
  const rollbackPath = `/api/flows/${saved.id}/rollback`
  for (const role of ['viewer', 'editor']) {
    const member = await (
      await request('/api/members', 'POST', { name: role, role })
    ).json()
    expect(
      (
        await request(
          `/api/flows/${saved.id}/releases`,
          'GET',
          undefined,
          member.token,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await request(
          `/api/flows/${saved.id}/releases/1`,
          'GET',
          undefined,
          member.token,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await request(
          rollbackPath,
          'POST',
          { revision: 1, publishedRevision: 2 },
          member.token,
        )
      ).status,
    ).toBe(403)
  }
  for (const credential of ['', 'invalid', token]) {
    expect(
      (
        await request(
          `/api/flows/${saved.id}/releases`,
          'GET',
          undefined,
          credential,
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await request(
          rollbackPath,
          'POST',
          { revision: 1, publishedRevision: 2 },
          credential,
        )
      ).status,
    ).toBe(401)
  }
  for (const body of [
    { revision: 1 },
    { revision: '1', publishedRevision: 2 },
    { revision: 0, publishedRevision: 2 },
    { revision: 1.5, publishedRevision: 2 },
    { revision: 1, publishedRevision: 0 },
    { revision: 1, publishedRevision: 2, extra: true },
  ])
    expect((await request(rollbackPath, 'POST', body)).status).toBe(400)
  expect((await request(`/api/flows/${saved.id}/releases/0`)).status).toBe(400)
  expect((await request(`/api/flows/${saved.id}/releases/99`)).status).toBe(404)
  const snapshot = await (
    await request(`/api/flows/${saved.id}/releases/1`)
  ).json()
  await publish({ ...helloFlow, path: '/users/me' })
  expect(
    (await request(rollbackPath, 'POST', { revision: 1, publishedRevision: 2 }))
      .status,
  ).toBe(409)
  expect(
    (await (await request(`/api/flows/${saved.id}`)).json()).publishedRevision,
  ).toBe(2)
  expect(
    await (await request(`/api/flows/${saved.id}/releases/1`)).json(),
  ).toEqual(snapshot)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ),
  ).toHaveLength(0)
})

test('rollback revalidates archived source dependencies without altering live or draft state', async () => {
  const { request, publish } = workspace()
  const upload = new FormData()
  upload.set('name', 'Old source')
  upload.set(
    'file',
    new File(['Name\nAda'], 'people.csv', { type: 'text/csv' }),
  )
  const sourceResponse = await request(
    '/api/data-sources/import',
    'POST',
    upload,
  )
  expect(sourceResponse.status).toBe(200)
  const source = await sourceResponse.json()
  const sourced = {
    ...helloFlow,
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'data',
        type: 'data',
        position: { x: 250, y: 100 },
        config: { sourceId: source.id, columns: ['name'], limit: 1 },
      },
      { ...helloFlow.nodes[1], config: { status: 200, body: '$data' } },
    ],
    edges: [
      { id: 'a', source: 'request', target: 'data' },
      { id: 'b', source: 'data', target: 'response' },
    ],
  }
  const { saved, token } = await publish(sourced)
  await request(`/api/flows/${saved.id}`, 'PUT', { ...helloFlow, revision: 1 })
  await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 })
  expect(
    (await request(`/api/data-sources/${source.id}`, 'DELETE')).status,
  ).toBe(200)
  const before = await (await request(`/api/flows/${saved.id}`)).json()
  expect(
    (
      await request(`/api/flows/${saved.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(400)
  expect(await (await request(`/api/flows/${saved.id}`)).json()).toEqual(before)
  expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
    200,
  )
  expect(
    (await (await request(`/api/flows/${saved.id}/releases/1`)).json())
      .definition,
  ).toEqual(sourced)
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ),
  ).toHaveLength(0)
})

test('owner session rollback needs origin and CSRF, and racing stale rollback has one winner', async () => {
  const { request, publish, options } = workspace()
  const { saved } = await publish(helloFlow)
  await request(`/api/flows/${saved.id}`, 'PUT', {
    ...helloFlow,
    path: '/v2/hello',
    revision: 1,
  })
  await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 })
  const path = `/api/flows/${saved.id}/rollback`
  const body = { revision: 1, publishedRevision: 2 }
  const origin = 'http://localhost'
  const login = await request('/auth/login', 'POST', { token: owner }, '', {
    origin,
  })
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const session = await login.json()
  expect(
    (await request(path, 'POST', body, '', { cookie, origin })).status,
  ).toBe(403)
  expect(
    (
      await request(path, 'POST', body, '', {
        cookie,
        origin: 'https://evil.example',
        'x-besh-csrf': session.csrfToken,
      })
    ).status,
  ).toBe(403)
  const second = createApp(options)
  cleanup.push(() => second.close())
  const competitor = () =>
    second.app.handle(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${owner}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    )
  const results = await Promise.all([
    request(path, 'POST', body, '', {
      cookie,
      origin,
      'x-besh-csrf': session.csrfToken,
    }),
    competitor(),
  ])
  expect(results.map((response) => response.status).sort()).toEqual([200, 409])
  expect(
    (await (await request('/api/audit')).json()).filter(
      (event: { action: string }) => event.action === 'flow.rolled-back',
    ),
  ).toHaveLength(1)
})

test('downloaded backups retain immutable releases and the rollback selection', async () => {
  const { request, publish, options } = workspace()
  const { saved, token } = await publish(helloFlow)
  await request(`/api/flows/${saved.id}`, 'PUT', {
    ...helloFlow,
    path: '/v2/hello',
    revision: 1,
  })
  await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 })
  await request(`/api/flows/${saved.id}/rollback`, 'POST', {
    revision: 1,
    publishedRevision: 2,
  })
  const history = await (
    await request(`/api/flows/${saved.id}/releases`)
  ).json()
  const release = await (
    await request(`/api/flows/${saved.id}/releases/2`)
  ).json()
  const backup = await (await request('/api/backups', 'POST')).json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)
  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, new Uint8Array(await download.arrayBuffer()))
  const restored = createApp({ ...options, databasePath: restoredPath })
  cleanup.push(() => restored.close())
  const read = (path: string, credential = owner) =>
    restored.app.handle(
      new Request(`http://localhost${path}`, {
        headers: { authorization: `Bearer ${credential}` },
      }),
    )
  expect(await (await read(`/api/flows/${saved.id}/releases`)).json()).toEqual(
    history,
  )
  expect(
    await (await read(`/api/flows/${saved.id}/releases/2`)).json(),
  ).toEqual(release)
  expect(
    (await (await read(`/api/flows/${saved.id}`)).json()).publishedRevision,
  ).toBe(1)
  expect((await read('/run/hello', token)).status).toBe(200)
  expect((await read('/run/v2/hello', token)).status).toBe(404)
})
