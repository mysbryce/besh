import { afterEach, expect, test } from 'bun:test'
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

test('a published GraphQL endpoint resolves typed fields and variables', async () => {
  const { request } = workspace()
  const draft = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  expect(
    (await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)

  const response = await request('/graphql/hello', 'POST', {
    query: 'query Greeting($name: String!) { greet(name: $name) { name } }',
    variables: { name: 'Ada' },
    operationName: 'Greeting',
  })
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

  expect((await request('/graphql/hello', 'POST', operation)).status).toBe(404)
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
  expect((await request('/graphql/hello', 'POST', operation, '')).status).toBe(
    401,
  )
  expect((await request('/graphql/hello')).status).toBe(405)

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
    const invalid = await request('/graphql/hello', 'POST', body)
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
  ).toBe(200)

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
    await (await request('/graphql/hello', 'POST', operation)).json(),
  ).toEqual({ data: { greet: { message: 'Hello, Besh!', name: 'Ada' } } })
  await request(`/api/flows/${draft.id}/publish`, 'POST', { revision: 2 })
  expect(
    await (await request('/graphql/hello', 'POST', operation)).json(),
  ).toEqual({ data: { greet: { message: 'Draft message', name: 'Ada' } } })
  expect((await request('/run/hello', 'POST')).status).toBe(404)
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

  for (const query of [
    `{ ${Array.from({ length: 17 }, (_, index) => `g${index}: greet(name: "Ada") { name }`).join(' ')} }`,
    `{ greet(name: "Ada") { ${Array.from({ length: 201 }, (_, index) => `n${index}: name`).join(' ')} } }`,
    '{ __schema { types { name } } }',
  ]) {
    const response = await request('/graphql/hello', 'POST', { query })
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
  expect((await request('/run/hello', 'POST')).status).toBe(200)
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
  expect((await request('/run/hello')).status).toBe(404)
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
  expect((await request('/run/hello', 'GET', undefined, '')).status).toBe(401)
  expect(await (await request('/run/hello')).json()).toEqual({
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
  expect(await (await request('/run/hello')).json()).toEqual({
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
  expect(await (await request('/run/hello')).json()).toEqual({
    message: 'Updated!',
  })
})

test('backups restore published flows and migration history survives restarts', async () => {
  const { request, options } = workspace()
  const flow = await (await request('/api/flows', 'POST', helloFlow)).json()
  await request(`/api/flows/${flow.id}/publish`, 'POST', { revision: 1 })
  const graph = await (await request('/api/flows', 'POST', graphqlFlow)).json()
  await request(`/api/flows/${graph.id}/publish`, 'POST', { revision: 1 })

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
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    )
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
    const graphResponse = await restored.app.handle(
      new Request('http://localhost/graphql/hello', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: '{ greet(name: "Ada") { name } }' }),
      }),
    )
    expect(await graphResponse.json()).toEqual({
      data: { greet: { name: 'Ada' } },
    })
    const migrations = await (
      await restored.app.handle(
        new Request('http://localhost/api/migrations', {
          headers: { authorization: `Bearer ${adminToken}` },
        }),
      )
    ).json()
    expect(
      migrations.map((migration: { version: number }) => migration.version),
    ).toEqual([1, 2, 3, 4, 5])
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
    const response = await request('/run/hello', method)
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
