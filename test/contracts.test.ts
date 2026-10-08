import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { executeFlow } from '../src/flows/engine'
import { helloFlow, graphqlFlow } from './fixtures'

const owner = 'contract-owner-token-32-characters-long'
const cleanup: (() => void)[] = []

afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
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
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
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
    reopen() {
      server.close()
      server = createApp(options)
    },
  }
}

test('REST query rules deliver typed values and reject invalid input safely', async () => {
  const { request, publish } = workspace()
  const flow = {
    ...helloFlow,
    contract: {
      query: {
        type: 'object',
        properties: {
          count: { type: 'integer', minimum: 1 },
          active: { type: 'boolean' },
        },
        required: ['count'],
      },
    },
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: {
          status: 200,
          body: {
            count: '$input.query.count',
            active: '$input.query.active',
            extra: '$input.query.extra',
          },
        },
      },
    ],
  }
  const { saved, token } = await publish(flow)
  const result = await request(
    '/run/hello?count=2&active=false&extra=text',
    'GET',
    undefined,
    token,
  )
  expect(await result.json()).toEqual({
    count: 2,
    active: false,
    extra: 'text',
  })
  for (const query of [
    'count=',
    'count=1.5',
    'count=secret-value',
    'count=2&active=TRUE',
    'active=true',
  ]) {
    const failure = await request(
      `/run/hello?${query}`,
      'GET',
      undefined,
      token,
    )
    expect(failure.status).toBe(400)
    expect(await failure.text()).not.toContain('secret-value')
  }
  const draft = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: { count: '3', active: 'true' },
  })
  expect((await draft.json()).body).toEqual({
    count: 3,
    active: true,
    extra: null,
  })
})

test('body rules use exact types and response failures redact runtime and draft payloads', async () => {
  const { request, publish } = workspace()
  const flow = {
    ...helloFlow,
    method: 'POST',
    contract: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 8 },
          values: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
            maxItems: 2,
          },
        },
        required: ['name', 'values'],
        additionalProperties: false,
      },
      response: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
    },
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 200, body: { secret: 'private-response-payload' } },
      },
    ],
  }
  const { saved, token } = await publish(flow)
  for (const body of [
    { name: 'Ada', values: ['1'] },
    { name: 'A', values: [1] },
    { name: 'Ada', values: [] },
    { name: 'Ada', values: [1], extra: true },
    { name: null, values: [1] },
  ]) {
    expect((await request('/run/hello', 'POST', body, token)).status).toBe(400)
  }
  for (const response of [
    await request('/run/hello', 'POST', { name: 'Ada', values: [1] }, token),
    await request(`/api/flows/${saved.id}/test`, 'POST', {
      body: { name: 'Ada', values: [1] },
      query: {},
    }),
  ]) {
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Response does not match response rules',
    })
  }
})

test('saving rejects unsupported, unsafe, contradictory and oversized REST rules', async () => {
  const { request } = workspace()
  let deep: unknown = { type: 'string' }
  for (let index = 0; index < 8; index++) deep = { type: 'array', items: deep }
  const schemas = [
    { type: 'string', format: 'email' },
    { type: 'boolean', minimum: 1 },
    { type: 'number', minimum: 3, maximum: 2 },
    { type: 'string', minLength: 5, maxLength: 4 },
    { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 1 },
    { type: 'object', properties: { constructor: { type: 'string' } } },
    JSON.parse(
      '{"type":"object","properties":{"__proto__":{"type":"string"}}}',
    ),
    { type: 'object', properties: { 'bad-name': { type: 'string' } } },
    {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name', 'name'],
    },
    { type: 'object', required: ['missing'] },
    deep,
    {
      type: 'object',
      properties: Object.fromEntries(
        Array.from({ length: 65 }, (_, index) => [
          `field${index}`,
          { type: 'string' },
        ]),
      ),
    },
    {
      type: 'object',
      properties: Object.fromEntries(
        Array.from({ length: 64 }, (_, index) => [
          `field${index}`,
          { type: 'string', description: 'a'.repeat(500) },
        ]),
      ),
    },
    {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(
          Array.from({ length: 64 }, (_, index) => [
            `field${index}`,
            {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'array', items: { type: 'string' } },
              },
            },
          ]),
        ),
      },
    },
  ]
  for (const response of schemas)
    expect(
      (
        await request('/api/flows', 'POST', {
          ...helloFlow,
          contract: { response },
        })
      ).status,
    ).toBe(400)
  for (const query of [
    { type: 'string' },
    { type: 'object', nullable: true },
    {
      type: 'object',
      properties: { field: { type: 'array', items: { type: 'string' } } },
    },
    {
      type: 'object',
      properties: { field: { type: 'string', nullable: true } },
    },
  ]) {
    expect(
      (
        await request('/api/flows', 'POST', {
          ...helloFlow,
          contract: { query },
        })
      ).status,
    ).toBe(400)
  }
  expect(
    (await request('/api/flows', 'POST', { ...graphqlFlow, contract: {} }))
      .status,
  ).toBe(400)
  for (const method of ['GET', 'HEAD'])
    expect(
      (
        await request('/api/flows', 'POST', {
          ...helloFlow,
          method,
          contract: { body: { type: 'object' } },
        })
      ).status,
    ).toBe(400)
})

test('OpenAPI download describes selected immutable release and never response literals', async () => {
  const { request, publish, reopen } = workspace()
  const flow = {
    ...helloFlow,
    method: 'POST',
    contract: {
      query: {
        type: 'object',
        properties: { count: { type: 'integer', minimum: 1 } },
        required: ['count'],
      },
      body: {
        type: 'object',
        nullable: true,
        properties: { note: { type: 'string', nullable: true } },
      },
      response: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
  }
  const { saved, token } = await publish(flow)
  const release = await request(`/api/flows/${saved.id}/openapi`)
  expect(release.status).toBe(200)
  expect(release.headers.get('content-disposition')).toBe(
    `attachment; filename="besh-${saved.id}-openapi.json"`,
  )
  const original = await release.text()
  expect(original).not.toContain('Hello, Besh!')
  expect(original).not.toContain(token)
  expect(original).not.toContain('nullable')
  const spec = JSON.parse(original)
  expect(spec.openapi).toBe('3.1.1')
  expect(spec.info).toEqual({ title: 'Hello API', version: '1' })
  expect(spec.paths['/run/hello'].post.parameters).toEqual([
    {
      name: 'count',
      in: 'query',
      required: true,
      schema: { type: 'integer', minimum: 1 },
    },
  ])
  expect(spec.paths['/run/hello'].post.requestBody.required).toBe(false)
  expect(
    spec.paths['/run/hello'].post.requestBody.content['application/json'].schema
      .type,
  ).toEqual(['object', 'null'])
  expect(spec.paths['/run/hello'].post.security).toEqual([{ RuntimeKey: [] }])
  expect(spec.components.securitySchemes.RuntimeKey).toEqual({
    type: 'http',
    scheme: 'bearer',
    description:
      'Unexpired runtime API key scoped to this flow with the rest grant',
  })
  for (const status of ['400', '401', '403', '404', '413', '500'])
    expect(spec.paths['/run/hello'].post.responses[status]).toBeDefined()
  await request(`/api/flows/${saved.id}`, 'PUT', {
    ...flow,
    revision: 1,
    name: 'Draft name',
    path: '/draft-only',
    contract: { response: { type: 'boolean' } },
  })
  reopen()
  expect(await (await request(`/api/flows/${saved.id}/openapi`)).text()).toBe(
    original,
  )
  const draft = await (
    await request(`/api/flows/${saved.id}/openapi?source=draft`)
  ).json()
  expect(draft.info).toEqual({ title: 'Draft name', version: '2' })
  expect(
    draft.paths['/run/draft-only'].post.responses['200'].content[
      'application/json'
    ].schema,
  ).toEqual({ type: 'boolean' })
})

test('generated spreadsheet REST contracts use selected column types, nullability and row limit', async () => {
  const { request, reopen } = workspace()
  const upload = new FormData()
  upload.append('name', 'People')
  upload.append(
    'file',
    new File(
      ['Name,Age,Active,Private\nAda,37,true,secret\nLin,,false,hidden'],
      'people.csv',
      { type: 'text/csv' },
    ),
  )
  const source = await (
    await request('/api/data-sources/import', 'POST', upload)
  ).json()
  const options = {
    name: 'People API',
    path: '/people',
    protocol: 'rest',
    columns: ['name', 'age', 'active'],
    filter: { column: 'age', inputName: 'age' },
    limit: 2,
  }
  const generated = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', options)
  ).json()
  expect(generated.contract).toEqual({
    query: { type: 'object', properties: { age: { type: 'number' } } },
    response: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', nullable: false },
          age: { type: 'number', nullable: true },
          active: { type: 'boolean', nullable: false },
        },
        required: ['name', 'age', 'active'],
        additionalProperties: false,
      },
    },
  })
  reopen()
  expect(
    (await (await request(`/api/flows/${generated.id}`)).json()).contract,
  ).toEqual(generated.contract)
  expect(
    (
      await request(`/api/flows/${generated.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'People reader',
      flowId: generated.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
  ).json()
  expect(
    await (
      await request('/run/people?age=37', 'GET', undefined, key.token)
    ).json(),
  ).toEqual([{ name: 'Ada', age: 37, active: true }])
  expect(
    (await request('/run/people?age=', 'GET', undefined, key.token)).status,
  ).toBe(400)
  const graph = await (
    await request(`/api/data-sources/${source.id}/api`, 'POST', {
      ...options,
      protocol: 'graphql',
    })
  ).json()
  expect(graph.contract).toBeUndefined()
  expect(graph.graphql.schema).toContain('age: Float')
})

test('contract failures are audited without credentials or submitted and returned values', async () => {
  const { request, publish } = workspace()
  const { saved, token } = await publish({
    ...helloFlow,
    method: 'POST',
    contract: { body: { type: 'integer' }, response: { type: 'boolean' } },
  })
  expect(
    (await request('/run/hello', 'POST', 'private-input', token)).status,
  ).toBe(400)
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: 1,
        query: {},
      })
    ).status,
  ).toBe(500)
  const events = await (await request('/api/audit')).json()
  const failed = events.filter(
    (event: { action: string }) => event.action === 'flow.validation-failed',
  )
  expect(failed).toHaveLength(2)
  for (const event of failed) expect(event.resource).toBe(saved.id)
  expect(JSON.stringify(events)).not.toContain('private-input')
  expect(JSON.stringify(events)).not.toContain('Hello, Besh!')
  expect(JSON.stringify(events)).not.toContain(token)
})

test('OpenAPI access follows member permissions and selected REST protocol', async () => {
  const { request, publish } = workspace()
  const { saved, token } = await publish(helloFlow)
  for (const role of ['editor', 'viewer']) {
    const member = await (
      await request('/api/members', 'POST', { name: role, role })
    ).json()
    expect(
      (
        await request(
          `/api/flows/${saved.id}/openapi`,
          'GET',
          undefined,
          member.token,
        )
      ).status,
    ).toBe(200)
  }
  for (const denied of ['', token])
    expect(
      (
        await request(
          `/api/flows/${saved.id}/openapi`,
          'GET',
          undefined,
          denied,
        )
      ).status,
    ).toBe(401)
  expect(
    (await request(`/api/flows/${saved.id}/openapi?source=other`)).status,
  ).toBe(400)
  expect(
    (
      await request(
        `/api/flows/${saved.id}/openapi?source=draft&source=published`,
      )
    ).status,
  ).toBe(400)
  const draft = await (await request('/api/flows', 'POST', helloFlow)).json()
  expect((await request(`/api/flows/${draft.id}/openapi`)).status).toBe(404)
  const incomplete = await (
    await request('/api/flows', 'POST', { ...helloFlow, nodes: [], edges: [] })
  ).json()
  expect(
    (await request(`/api/flows/${incomplete.id}/openapi?source=draft`)).status,
  ).toBe(200)
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  expect(
    (await request(`/api/flows/${graph.id}/openapi?source=draft`)).status,
  ).toBe(400)
  await request(`/api/flows/${saved.id}`, 'PUT', {
    ...graphqlFlow,
    revision: 1,
  })
  expect((await request(`/api/flows/${saved.id}/openapi`)).status).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}/openapi?source=draft`)).status,
  ).toBe(400)
  expect(
    await (await request('/run/hello', 'GET', undefined, token)).json(),
  ).toEqual({ message: 'Hello, Besh!' })
})

test('OpenAPI includes every response status and excludes content for empty HTTP responses', async () => {
  const { request } = workspace()
  for (const method of ['POST', 'HEAD']) {
    const saved = await (
      await request('/api/flows', 'POST', {
        ...helloFlow,
        method,
        nodes: [
          helloFlow.nodes[0],
          ...[200, 204, 205, 304, 400].map((status) => ({
            ...helloFlow.nodes[1],
            id: `response${status}`,
            config: { status, body: 'private-literal' },
          })),
        ],
      })
    ).json()
    const spec = await (
      await request(`/api/flows/${saved.id}/openapi?source=draft`)
    ).json()
    const responses = spec.paths['/run/hello'][method.toLowerCase()].responses
    for (const status of ['200', '204', '205', '304', '400'])
      expect(responses[status]).toBeDefined()
    for (const status of method === 'HEAD'
      ? Object.keys(responses)
      : ['204', '205', '304'])
      expect(responses[status].content).toBeUndefined()
    if (method === 'POST')
      expect(
        responses['400'].content['application/json'].schema.anyOf,
      ).toHaveLength(2)
    expect(JSON.stringify(spec)).not.toContain('private-literal')
  }
})

test('nullable body and Unicode character lengths agree in runtime and draft rules', async () => {
  const { request, publish } = workspace()
  const flow = {
    ...helloFlow,
    method: 'POST',
    contract: {
      body: { type: 'string', nullable: true, minLength: 1, maxLength: 1 },
      response: { type: 'string', nullable: true, minLength: 1, maxLength: 1 },
    },
    nodes: [
      helloFlow.nodes[0],
      { ...helloFlow.nodes[1], config: { status: 200, body: '$input.body' } },
    ],
  }
  const { saved, token } = await publish(flow)
  expect(await (await request('/run/hello', 'POST', '😀', token)).json()).toBe(
    '😀',
  )
  expect(
    await (await request('/run/hello', 'POST', undefined, token)).json(),
  ).toBeNull()
  expect((await request('/run/hello', 'POST', '😀😀', token)).status).toBe(400)
  const tested = await (
    await request(`/api/flows/${saved.id}/test`, 'POST', {
      body: '😀',
      query: {},
    })
  ).json()
  expect(tested.body).toBe('😀')
})

test('executor validates input before reaching an unavailable data boundary', async () => {
  const flow = {
    ...helloFlow,
    contract: {
      query: {
        type: 'object',
        properties: { count: { type: 'integer' } },
        required: ['count'],
      },
    },
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'data',
        type: 'data',
        position: { x: 200, y: 100 },
        config: { sourceId: 'missing', columns: ['name'], limit: 1 },
      },
      helloFlow.nodes[1],
    ],
    edges: [
      { id: 'one', source: 'request', target: 'data' },
      { id: 'two', source: 'data', target: 'response' },
    ],
  }
  await expect(
    executeFlow(flow, { body: null, query: { count: 'invalid' } }),
  ).rejects.toThrow('Input query.count must match integer rules')
  await expect(
    executeFlow(flow, { body: null, query: { count: '1' } }),
  ).rejects.toThrow('Data sources are unavailable')
})
