import { afterEach, expect, test, spyOn } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { helloFlow, graphqlFlow } from './fixtures'
import { writeFileSync } from 'node:fs'

const adminToken = 'test-only-admin-token-32-characters-long'
const cleanup: (() => void)[] = []
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose()
})

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'besh-test-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken,
  }
  const server = createApp(options)
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
    token = adminToken,
  ) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  return { request, server, options }
}

async function issueRuntimeKey(
  request: ReturnType<typeof workspace>['request'],
  flowId: string,
  permissions: ('rest' | 'query' | 'mutation')[] = ['rest'],
) {
  const response = await request('/api/runtime-keys', 'POST', {
    name: 'Test application',
    flowId,
    permissions,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(response.status).toBe(200)
  return response.json()
}

test('member credentials cannot call published runtime endpoints', async () => {
  const { request } = workspace()
  const rest = await (await request('/api/flows', 'POST', helloFlow)).json()
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${rest.id}/publish`, 'POST', { revision: 1 })
  await request(`/api/flows/${graph.id}/publish`, 'POST', { revision: 1 })

  for (const token of [
    adminToken,
    ...(await Promise.all(
      ['editor', 'viewer'].map(async (role) => {
        const member = await (
          await request('/api/members', 'POST', { name: role, role })
        ).json()
        return member.token
      }),
    )),
  ]) {
    expect((await request('/run/hello', 'GET', undefined, token)).status).toBe(
      401,
    )
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          { query: '{ greet(name: "Ada") { name } }' },
          token,
        )
      ).status,
    ).toBe(401)
  }
})

test('owners issue runtime keys for one published REST flow and revoke immediately', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  const other = await (
    await request('/api/flows', 'POST', { ...helloFlow, path: '/other' })
  ).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  await request(`/api/flows/${other.id}/publish`, 'POST', { revision: 1 })
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString()
  const response = await request('/api/runtime-keys', 'POST', {
    name: '  Application  ',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt,
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const key = await response.json()
  expect(key).toMatchObject({
    name: 'Application',
    flowId: flow.id,
    permissions: ['rest'],
    expiresAt,
    revokedAt: null,
  })
  expect(key.token).toMatch(/^besh_[A-Za-z0-9_-]{43}$/)
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
  expect(
    (await request('/run/other', 'GET', undefined, key.token)).status,
  ).toBe(403)
  expect((await request('/api/me', 'GET', undefined, key.token)).status).toBe(
    401,
  )
  const listed = await (await request('/api/runtime-keys')).json()
  expect(listed).toEqual([
    {
      id: key.id,
      name: key.name,
      flowId: key.flowId,
      releaseRevision: null,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      revokedAt: null,
    },
  ])
  expect(JSON.stringify(listed)).not.toContain(key.token)
  expect(
    await (await request(`/api/runtime-keys/${key.id}`, 'DELETE')).json(),
  ).toEqual({ ok: true })
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(401)
  expect(
    (await (await request('/api/runtime-keys')).json())[0].revokedAt,
  ).toEqual(expect.any(String))
  const events = await (await request('/api/audit')).json()
  expect(
    events.some(
      (event: { action: string; resource: string }) =>
        event.action === 'runtime-key.created' && event.resource === key.id,
    ),
  ).toBe(true)
  expect(
    events.some(
      (event: { action: string; resource: string }) =>
        event.action === 'runtime-key.revoked' && event.resource === key.id,
    ),
  ).toBe(true)
  expect(JSON.stringify(events)).not.toContain(key.token)
})

test('GraphQL runtime grants apply to the selected operation before any flow execution', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Queries only',
      flowId: flow.id,
      permissions: ['query'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
  ).json()
  const document =
    'query Read { alias: greet(name: "Ada") { ...Greeting } } mutation Write { alias: greet(name: "Ada") { ...Greeting } } fragment Greeting on Greeting { name }'
  expect(
    await (
      await request(
        '/graphql/hello',
        'POST',
        { query: document, operationName: 'Read' },
        key.token,
      )
    ).json(),
  ).toEqual({ data: { alias: { name: 'Ada' } } })

  const before = await (await request('/api/audit')).json()
  const executedBefore = before.filter(
    (event: { action: string }) => event.action === 'graphql.executed',
  ).length
  for (const query of [
    { query: document, operationName: 'Write' },
    {
      query:
        'mutation { ... on Mutation { renamed: greet(name: "Ada") { name } } }',
    },
    {
      query:
        'mutation { ...Fields } fragment Fields on Mutation { greet(name: "Ada") { name } }',
    },
  ]) {
    const forbidden = await request('/graphql/hello', 'POST', query, key.token)
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toHaveProperty('errors')
  }
  for (const operationName of [undefined, 'Missing']) {
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          { query: document, operationName },
          key.token,
        )
      ).status,
    ).toBe(400)
  }
  const after = await (await request('/api/audit')).json()
  expect(
    after.filter(
      (event: { action: string }) => event.action === 'graphql.executed',
    ),
  ).toHaveLength(executedBefore)
  expect(
    after.some(
      (event: { actor: string; action: string }) =>
        event.actor === `runtime:${key.id}` && event.action === 'access.denied',
    ),
  ).toBe(true)

  const mutationKey = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Mutations only',
      flowId: flow.id,
      permissions: ['mutation'],
      expiresAt: key.expiresAt,
    })
  ).json()
  expect(
    (
      await request(
        '/graphql/hello',
        'POST',
        { query: document, operationName: 'Read' },
        mutationKey.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        '/graphql/hello',
        'POST',
        { query: document, operationName: 'Write' },
        mutationKey.token,
      )
    ).status,
  ).toBe(200)
})

test('runtime keys expire at their deadline and expired attempts identify only their key id', async () => {
  const { request } = workspace()
  const rest = await (await request('/api/flows', 'POST', helloFlow)).json()
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${rest.id}/publish`, 'POST', { revision: 1 })
  await request(`/api/flows/${graph.id}/publish`, 'POST', { revision: 1 })
  const restKey = await issueRuntimeKey(request, rest.id)
  const graphKey = await issueRuntimeKey(request, graph.id, ['query'])
  expect(
    (await request('/run/hello', 'GET', undefined, restKey.token)).status,
  ).toBe(200)
  const clock = spyOn(Date, 'now').mockReturnValue(
    Date.parse(restKey.expiresAt) - 1,
  )
  try {
    expect(
      (await request('/run/hello', 'GET', undefined, restKey.token)).status,
    ).toBe(200)
    clock.mockReturnValue(Date.parse(restKey.expiresAt))
    expect(
      (await request('/run/hello', 'GET', undefined, restKey.token)).status,
    ).toBe(401)
    clock.mockReturnValue(Date.parse(graphKey.expiresAt))
    expect(
      (
        await request(
          '/graphql/hello',
          'POST',
          { query: '{ greet(name: "Ada") { name } }' },
          graphKey.token,
        )
      ).status,
    ).toBe(401)
  } finally {
    clock.mockRestore()
  }
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some(
      (event: { actor: string; action: string }) =>
        event.actor === `runtime:${restKey.id}` &&
        event.action === 'access.denied',
    ),
  ).toBe(true)
  expect(JSON.stringify(audit)).not.toContain(restKey.token)
})

test('runtime key management rejects nonowners and invalid scopes without creating keys', async () => {
  const { request } = workspace()
  const rest = await (await request('/api/flows', 'POST', helloFlow)).json()
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  const unpublished = await (
    await request('/api/flows', 'POST', { ...helloFlow, path: '/draft' })
  ).json()
  await request(`/api/flows/${rest.id}/publish`, 'POST', { revision: 1 })
  await request(`/api/flows/${graph.id}/publish`, 'POST', { revision: 1 })
  const valid = {
    name: 'Application',
    flowId: rest.id,
    permissions: ['rest'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  }

  for (const invalid of [
    { ...valid, name: '' },
    { ...valid, name: '   ' },
    { ...valid, name: 'a'.repeat(81) },
    { ...valid, flowId: unpublished.id },
    { ...valid, permissions: [] },
    { ...valid, permissions: ['rest', 'rest'] },
    { ...valid, permissions: ['query'] },
    { ...valid, permissions: ['rest', 'mutation'] },
    { ...valid, permissions: ['owner'] },
    { ...valid, flowId: graph.id, permissions: ['rest'] },
    { ...valid, flowId: graph.id, permissions: ['query', 'query'] },
    { ...valid, expiresAt: 'invalid' },
    { ...valid, expiresAt: '2027-02-31T00:00:00.000Z' },
    { ...valid, expiresAt: new Date(Date.now() - 1).toISOString() },
    {
      ...valid,
      expiresAt: new Date(Date.now() + 367 * 86_400_000).toISOString(),
    },
  ]) {
    expect((await request('/api/runtime-keys', 'POST', invalid)).status).toBe(
      400,
    )
  }
  expect(
    (
      await request('/api/runtime-keys', 'POST', {
        ...valid,
        flowId: 'unknown',
      })
    ).status,
  ).toBe(404)
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  const key = await issueRuntimeKey(request, rest.id)
  for (const role of ['editor', 'viewer']) {
    const member = await (
      await request('/api/members', 'POST', { name: role, role })
    ).json()
    for (const [path, method, body] of [
      ['/api/runtime-keys', 'GET', undefined],
      ['/api/runtime-keys', 'POST', valid],
      [`/api/runtime-keys/${key.id}`, 'DELETE', undefined],
    ] as const) {
      expect((await request(path, method, body, member.token)).status).toBe(403)
      expect((await request(path, method, body, key.token)).status).toBe(401)
    }
  }
  expect((await request('/api/runtime-keys/unknown', 'DELETE')).status).toBe(
    404,
  )
  expect(
    (await request('/run/hello', 'GET', undefined, key.token)).status,
  ).toBe(200)
})

test('runtime keys follow published flow identity and reject a changed published protocol', async () => {
  const { request } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  expect(flow.publishedEndpoint).toBeNull()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const restKey = await issueRuntimeKey(request, flow.id)
  const draft = await (
    await request(`/api/flows/${flow.id}`, 'PUT', {
      ...helloFlow,
      path: '/moved',
      revision: 1,
    })
  ).json()
  expect(draft.publishedEndpoint).toEqual({
    method: 'GET',
    path: '/hello',
    graphql: false,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 })
  expect(
    (await request('/run/hello', 'GET', undefined, restKey.token)).status,
  ).toBe(404)
  expect(
    (await request('/run/moved', 'GET', undefined, restKey.token)).status,
  ).toBe(200)

  const graphDraft = await (
    await request(`/api/flows/${flow.id}`, 'PUT', {
      ...graphqlFlow,
      path: '/moved',
      revision: 2,
    })
  ).json()
  expect(graphDraft.publishedEndpoint).toEqual({
    method: 'GET',
    path: '/moved',
    graphql: false,
  })
  expect(
    (await request('/run/moved', 'GET', undefined, restKey.token)).status,
  ).toBe(200)
  expect(
    (
      await request('/api/runtime-keys', 'POST', {
        name: 'Too soon',
        flowId: flow.id,
        permissions: ['query'],
        expiresAt: restKey.expiresAt,
      })
    ).status,
  ).toBe(400)
  const published = await (
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 3 })
  ).json()
  expect(published.publishedEndpoint).toEqual({
    method: 'POST',
    path: '/moved',
    graphql: true,
  })
  const operation = { query: '{ greet(name: "Ada") { name } }' }
  expect(
    (await request('/graphql/moved', 'POST', operation, restKey.token)).status,
  ).toBe(403)
  const graphKey = await issueRuntimeKey(request, flow.id, ['query'])
  expect(
    (await request('/graphql/moved', 'POST', operation, graphKey.token)).status,
  ).toBe(200)
  await request(`/api/flows/${flow.id}`, 'PUT', {
    ...helloFlow,
    path: '/moved',
    revision: 3,
  })
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 4 })
  expect(
    (await request('/run/moved', 'GET', undefined, graphKey.token)).status,
  ).toBe(403)
  expect(
    (await request('/run/moved', 'GET', undefined, restKey.token)).status,
  ).toBe(200)
})

test('a published GraphQL endpoint resolves typed fields and variables', async () => {
  const { request } = workspace()
  const draft = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  expect(
    (await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await issueRuntimeKey(request, draft.id, ['query'])

  const response = await request(
    '/graphql/hello',
    'POST',
    {
      query: 'query Greeting($name: String!) { greet(name: $name) { name } }',
      variables: { name: 'Ada' },
      operationName: 'Greeting',
    },
    key.token,
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ data: { greet: { name: 'Ada' } } })
})

test('GraphQL resolves nested root types from flow data without rerunning the flow', async () => {
  const { request } = workspace()
  const definition = {
    ...graphqlFlow,
    graphql: { schema: 'type Query { item: Query name: String child: Query }' },
    nodes: [
      graphqlFlow.nodes[0],
      {
        ...graphqlFlow.nodes[1],
        config: {
          status: 200,
          body: { name: 'outer', child: { name: 'inner' } },
        },
      },
    ],
  }
  const draft = await (await request('/api/flows', 'POST', definition)).json()
  const result = await (
    await request(`/api/flows/${draft.id}/graphql/test`, 'POST', {
      query: '{ item { name child { name } } }',
    })
  ).json()
  expect(result.body).toEqual({
    data: { item: { name: 'outer', child: { name: 'inner' } } },
  })
  expect(result.visited).toEqual(['request', 'response'])

  const tooDeep = `{ item { ${'child { '.repeat(12)} name ${'}'.repeat(12)} } }`
  const limited = await (
    await request(`/api/flows/${draft.id}/graphql/test`, 'POST', {
      query: tooDeep,
    })
  ).json()
  expect(limited.status).toBe(400)
  expect(limited.body.errors[0].message).toContain('depth limit')
})

test('GraphQL execution errors do not reveal unselected flow data', async () => {
  const { request } = workspace()
  const draft = await (
    await request('/api/flows', 'POST', {
      ...graphqlFlow,
      nodes: [
        graphqlFlow.nodes[0],
        {
          ...graphqlFlow.nodes[1],
          config: {
            status: 200,
            body: {
              message: { secret: 'private-value-must-stay-hidden' },
              name: 'Ada',
            },
          },
        },
      ],
    })
  ).json()
  const result = await request(`/api/flows/${draft.id}/graphql/test`, 'POST', {
    query: '{ greet(name: "Ada") { message } }',
  })
  const body = await result.json()
  expect(body.body).toHaveProperty('errors')
  expect(JSON.stringify(body)).not.toContain('private-value-must-stay-hidden')
  expect(body.body.errors[0].message).toBe(
    'GraphQL field could not be resolved',
  )
})

test('GraphQL rejects invalid input before execution and protects draft releases', async () => {
  const { request } = workspace()
  const draft = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  const operation = {
    query:
      'mutation Greeting($name: String!) { greet(name: $name) { message name } }',
    variables: { name: 'Ada' },
  }

  expect((await request('/graphql/hello', 'POST', operation)).status).toBe(401)
  const preview = await request(
    `/api/flows/${draft.id}/graphql/test`,
    'POST',
    operation,
  )
  expect(preview.status).toBe(200)
  expect(await preview.json()).toMatchObject({
    body: { data: { greet: { message: 'Hello, Besh!', name: 'Ada' } } },
  })
  await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 1 })
  const key = await issueRuntimeKey(request, draft.id, ['query', 'mutation'])
  expect((await request('/graphql/hello', 'POST', operation, '')).status).toBe(
    401,
  )
  expect(
    (await request('/graphql/hello', 'GET', undefined, key.token)).status,
  ).toBe(405)

  for (const body of [
    { query: '{ greet(name: "Ada") { unknown } }' },
    {
      query: 'query ($name: String!) { greet(name: $name) { name } }',
      variables: { name: 123 },
    },
    { query: '{' },
    {},
    [{ query: '{ __typename }' }],
  ]) {
    const invalid = await request('/graphql/hello', 'POST', body, key.token)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toHaveProperty('errors')
  }

  const viewer = await (
    await request('/api/members', 'POST', {
      name: 'GraphQL reader',
      role: 'viewer',
    })
  ).json()
  expect(
    (
      await request(
        `/api/flows/${draft.id}/graphql/test`,
        'POST',
        operation,
        viewer.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (
      await request(
        `/api/flows/${draft.id}/publish`,
        'POST',
        { revision: 1 },
        viewer.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/graphql/hello', 'POST', operation, viewer.token)).status,
  ).toBe(401)

  const changed = {
    ...graphqlFlow,
    nodes: [
      graphqlFlow.nodes[0],
      {
        ...graphqlFlow.nodes[1],
        config: {
          status: 200,
          body: { message: 'Draft message', name: '$input.body.name' },
        },
      },
    ],
    revision: 1,
  }
  await request(`/api/flows/${draft.id}`, 'PUT', changed)
  expect(
    await (
      await request('/graphql/hello', 'POST', operation, key.token)
    ).json(),
  ).toEqual({ data: { greet: { message: 'Hello, Besh!', name: 'Ada' } } })
  await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 2 })
  expect(
    await (
      await request('/graphql/hello', 'POST', operation, key.token)
    ).json(),
  ).toEqual({ data: { greet: { message: 'Draft message', name: 'Ada' } } })
  expect(
    (await request('/run/hello', 'POST', undefined, key.token)).status,
  ).toBe(404)
  const events = await (await request('/api/audit')).json()
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'graphql.executed',
  )
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'graphql.tested',
  )
})

test('GraphQL bounds operations and rejects unsupported schemas before publication', async () => {
  const { request } = workspace()
  const draft = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 1 })
  const key = await issueRuntimeKey(request, draft.id, ['query'])

  for (const query of [
    `{ ${Array.from({ length: 17 }, (_, index) => `g${index}: greet(name: "Ada") { name }`).join(' ')} }`,
    `{ greet(name: "Ada") { ${Array.from({ length: 201 }, (_, index) => `n${index}: name`).join(' ')} } }`,
    '{ __schema { types { name } } }',
  ]) {
    const response = await request(
      '/graphql/hello',
      'POST',
      { query },
      key.token,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toHaveProperty('errors')
  }

  for (const definition of [
    { ...graphqlFlow, method: 'GET' },
    {
      ...graphqlFlow,
      graphql: { schema: 'type Query { broken: MissingType }' },
    },
    {
      ...graphqlFlow,
      graphql: {
        schema:
          'type Query { value: String } type Subscription { tick: String }',
      },
    },
    {
      ...graphqlFlow,
      graphql: { schema: 'scalar Date\ntype Query { value: Date }' },
    },
  ]) {
    const invalid = await (
      await request('/api/flows', 'POST', definition)
    ).json()
    expect(
      (
        await request(`/api/flows/${invalid.id}/publish`, 'POST', {
          revision: 1,
        })
      ).status,
    ).toBe(400)
  }

  const duplicate = await (
    await request('/api/flows', 'POST', graphqlFlow)
  ).json()
  expect(
    (
      await request(`/api/flows/${duplicate.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(409)
  const rest = await (
    await request('/api/flows', 'POST', { ...helloFlow, method: 'POST' })
  ).json()
  expect(
    (await request(`/api/flows/${rest.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const restKey = await issueRuntimeKey(request, rest.id)
  expect(
    (await request('/run/hello', 'POST', undefined, restKey.token)).status,
  ).toBe(200)
})

test('management routes require a valid token and identify the owner', async () => {
  const { request } = workspace()
  expect((await request('/health', 'GET', undefined, '')).status).toBe(200)
  expect((await request('/api/me', 'GET', undefined, '')).status).toBe(401)
  expect((await request('/api/me', 'GET', undefined, 'wrong')).status).toBe(401)
  const me = await request('/api/me')
  expect(await me.json()).toMatchObject({ name: 'Owner', role: 'owner' })
})

test('owners issue and revoke scoped member tokens with an audit trail', async () => {
  const { request } = workspace()
  const response = await request('/api/members', 'POST', {
    name: 'Reader',
    role: 'viewer',
  })
  expect(response.status).toBe(200)

  const reader = await response.json()
  expect(reader.token.length).toBeGreaterThan(32)
  expect(
    (await request('/api/me', 'GET', undefined, reader.token)).status,
  ).toBe(200)
  expect(
    (
      await request(
        '/api/members',
        'POST',
        { name: 'Escalated', role: 'editor' },
        reader.token,
      )
    ).status,
  ).toBe(403)
  expect((await request('/api/members')).status).toBe(200)
  expect(await (await request('/api/members')).text()).not.toContain(
    reader.token,
  )

  expect((await request(`/api/members/${reader.id}`, 'DELETE')).status).toBe(
    200,
  )
  expect(
    (await request('/api/me', 'GET', undefined, reader.token)).status,
  ).toBe(401)
  expect((await request('/api/members/owner', 'DELETE')).status).toBe(409)

  const events = await (await request('/api/audit')).json()
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'member.created',
  )
  expect(events.map((event: { action: string }) => event.action)).toContain(
    'member.revoked',
  )
  expect(JSON.stringify(events)).not.toContain(reader.token)
})

test('a saved draft can be tested, published and called without draft edits changing its release', async () => {
  const { request } = workspace()
  const response = await request('/api/flows', 'POST', helloFlow)
  expect(response.status).toBe(200)

  const flow = await response.json()
  expect(flow.revision).toBe(1)
  expect((await request('/run/hello')).status).toBe(401)
  expect(
    await (
      await request(`/api/flows/${flow.id}/test`, 'POST', {
        body: null,
        query: {},
      })
    ).json(),
  ).toMatchObject({ status: 200, body: { message: 'Hello, Besh!' } })
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const key = await issueRuntimeKey(request, flow.id)
  expect((await request('/run/hello', 'GET', undefined, '')).status).toBe(401)
  expect(
    await (await request('/run/hello', 'GET', undefined, key.token)).json(),
  ).toEqual({
    message: 'Hello, Besh!',
  })

  const edited = {
    ...helloFlow,
    name: 'New draft',
    nodes: [
      helloFlow.nodes[0],
      {
        ...helloFlow.nodes[1],
        config: { status: 202, body: { message: 'Updated!' } },
      },
    ],
  }
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', { ...edited, revision: 1 }))
      .status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${flow.id}`, 'PUT', { ...edited, revision: 1 }))
      .status,
  ).toBe(409)
  expect(
    await (await request('/run/hello', 'GET', undefined, key.token)).json(),
  ).toEqual({
    message: 'Hello, Besh!',
  })
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(409)
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(
    await (await request('/run/hello', 'GET', undefined, key.token)).json(),
  ).toEqual({
    message: 'Updated!',
  })
})

test('backups restore published flows and migration history survives restarts', async () => {
  const { request, options } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${graph.id}/publish`, 'POST', { revision: 1 })
  const restKey = await issueRuntimeKey(request, flow.id)
  const graphKey = await issueRuntimeKey(request, graph.id, ['query'])
  const revokedKey = await issueRuntimeKey(request, flow.id)
  await request(`/api/runtime-keys/${revokedKey.id}`, 'DELETE')

  const backupResponse = await request('/api/backups', 'POST')
  expect(backupResponse.status).toBe(200)
  const backup = await backupResponse.json()
  const download = await request(`/api/backups/${backup.id}`)
  expect(download.status).toBe(200)

  const restoredPath = join(options.backupDir, 'restored.sqlite')
  writeFileSync(restoredPath, Buffer.from(await download.arrayBuffer()))
  const restored = createApp({ ...options, databasePath: restoredPath })
  try {
    const response = await restored.app.handle(
      new Request('http://localhost/run/hello', {
        headers: { authorization: `Bearer ${restKey.token}` },
      }),
    )
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
    const graphResponse = await restored.app.handle(
      new Request('http://localhost/graphql/hello', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${graphKey.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: '{ greet(name: "Ada") { name } }' }),
      }),
    )
    expect(await graphResponse.json()).toEqual({
      data: { greet: { name: 'Ada' } },
    })
    const forbiddenMutation = await restored.app.handle(
      new Request('http://localhost/graphql/hello', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${graphKey.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: 'mutation { greet(name: "Ada") { name } }',
        }),
      }),
    )
    expect(forbiddenMutation.status).toBe(403)
    const revokedResponse = await restored.app.handle(
      new Request('http://localhost/run/hello', {
        headers: { authorization: `Bearer ${revokedKey.token}` },
      }),
    )
    expect(revokedResponse.status).toBe(401)
    const keys = await (
      await restored.app.handle(
        new Request('http://localhost/api/runtime-keys', {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      )
    ).json()
    expect(
      keys.find((key: { id: string }) => key.id === graphKey.id),
    ).toMatchObject({
      permissions: ['query'],
      flowId: graph.id,
      expiresAt: graphKey.expiresAt,
    })
    expect(
      keys.find((key: { id: string }) => key.id === revokedKey.id).revokedAt,
    ).toEqual(expect.any(String))
    expect(JSON.stringify(keys)).not.toContain('token_hash')
    expect(JSON.stringify(keys)).not.toContain(graphKey.token)
    const migrations = await (
      await restored.app.handle(
        new Request('http://localhost/api/migrations', {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      )
    ).json()
    expect(
      migrations.map((migration: { version: number }) => migration.version),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(await (await request('/api/backups')).json()).toHaveLength(1)
  } finally {
    restored.close()
  }
})

test('roles protect edits, publishing and backups while route conflicts fail explicitly', async () => {
  const { request } = workspace()
  const editor = await (
    await request('/api/members', 'POST', { name: 'Builder', role: 'editor' })
  ).json()
  const viewer = await (
    await request('/api/members', 'POST', { name: 'Reader', role: 'viewer' })
  ).json()
  expect(
    (await request('/api/flows', 'POST', helloFlow, viewer.token)).status,
  ).toBe(403)
  const flow = await (
    await request('/api/flows', 'POST', helloFlow, editor.token)
  ).json()
  expect(
    (
      await request(
        `/api/flows/${flow.id}/publish`,
        'POST',
        { revision: 1 },
        editor.token,
      )
    ).status,
  ).toBe(403)
  expect(
    (await request('/api/backups', 'POST', undefined, editor.token)).status,
  ).toBe(403)
  expect(
    (await request('/api/backups', 'GET', undefined, viewer.token)).status,
  ).toBe(403)
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const duplicate = await (
    await request('/api/flows', 'POST', helloFlow)
  ).json()
  expect(
    (
      await request(`/api/flows/${duplicate.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(409)

  const malformed = await (
    await request('/api/flows', 'POST', {
      ...helloFlow,
      edges: [{ id: 'bad', source: 'request', target: 'absent' }],
    })
  ).json()
  expect(
    (
      await request(`/api/flows/${malformed.id}/publish`, 'POST', {
        revision: 1,
      })
    ).status,
  ).toBe(400)
  expect((await request('/api/backups/not-a-backup')).status).toBe(404)
  const audit = await (await request('/api/audit')).json()
  expect(
    audit.some((event: { action: string }) => event.action === 'access.denied'),
  ).toBe(true)
})

test('first-run setup creates one workspace with a protected, one-time owner key', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-setup-'))
  const server = createApp({
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
    setupKey: 'local-setup-key-only-for-this-test-1234',
  })
  cleanup.push(() => {
    server.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  })
  const status = () =>
    server.app.handle(new Request('http://localhost/setup/status'))
  const setup = (key: string) =>
    server.app.handle(
      new Request('http://localhost/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, name: 'My studio' }),
      }),
    )

  expect(await (await status()).json()).toMatchObject({ required: true })
  expect((await setup('wrong')).status).toBe(403)
  const result = await setup('local-setup-key-only-for-this-test-1234')
  expect(result.status).toBe(200)
  const owner = await result.json()
  expect(owner.token.length).toBeGreaterThan(32)
  expect(await (await status()).json()).toMatchObject({
    required: false,
    name: 'My studio',
  })
  expect((await setup('local-setup-key-only-for-this-test-1234')).status).toBe(
    409,
  )
  expect(
    (
      await server.app.handle(
        new Request('http://localhost/api/me', {
          headers: { authorization: `Bearer ${owner.token}` },
        }),
      )
    ).status,
  ).toBe(200)
})

test('incomplete drafts can be saved but cannot be published', async () => {
  const { request } = workspace()
  const response = await request('/api/flows', 'POST', {
    ...helloFlow,
    nodes: [],
    edges: [],
  })
  expect(response.status).toBe(200)
  const flow = await response.json()
  expect(
    (await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(400)
})

test('credential responses are not cached and raw authorization values are rejected', async () => {
  const { request, server } = workspace()
  const me = await request('/api/me')
  expect(me.headers.get('cache-control')).toBe('no-store')
  expect(me.headers.get('x-content-type-options')).toBe('nosniff')
  const raw = await server.app.handle(
    new Request('http://localhost/api/me', {
      headers: { authorization: adminToken },
    }),
  )
  expect(raw.status).toBe(401)
})

test.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
  '%s endpoints return a published response',
  async (method) => {
    const { request } = workspace()
    const flow = await (
      await request('/api/flows', 'POST', { ...helloFlow, method })
    ).json()
    await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
    const key = await issueRuntimeKey(request, flow.id)
    const response = await request('/run/hello', method, undefined, key.token)
    expect(response.status).toBe(200)
    if (method === 'HEAD') expect(await response.text()).toBe('')
    else expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
  },
)

test('owner-key recovery persists through restart and records rotation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-recovery-'))
  const options = {
    databasePath: join(directory, 'besh.sqlite'),
    backupDir: join(directory, 'backups'),
  }
  const original = createApp({ ...options, adminToken })
  original.close()
  const replacement = 'replacement-owner-key-at-least-32-characters'
  const rotated = createApp({ ...options, adminToken: replacement })
  rotated.close()
  const restarted = createApp(options)
  cleanup.push(() => {
    restarted.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  })
  const request = (path: string, token: string) =>
    restarted.app.handle(
      new Request(`http://localhost${path}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    )

  expect((await request('/api/me', adminToken)).status).toBe(401)
  expect((await request('/api/me', replacement)).status).toBe(200)
  const audit = await (await request('/api/audit', replacement)).json()
  expect(
    audit.some(
      (event: { action: string }) => event.action === 'owner.key.rotated',
    ),
  ).toBe(true)
})
