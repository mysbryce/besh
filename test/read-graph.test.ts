import { afterEach, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import type { K6Runner } from '../src/load-tests/model'

const owner = 'read-graph-owner-token-at-least-32-characters'
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

function workspace(
  archive?: Uint8Array,
  options: { listen?: boolean; k6Runner?: K6Runner } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'besh-read-graph-'))
  if (archive) writeFileSync(join(directory, 'workspace.sqlite'), archive)
  const server = createApp({
    databasePath: join(directory, 'workspace.sqlite'),
    backupDir: join(directory, 'backups'),
    adminToken: owner,
    k6Runner: options.k6Runner,
  })
  if (options.listen) server.app.listen({ hostname: '127.0.0.1', port: 0 })
  cleanup.push(async () => {
    if (server.app.server) await server.app.stop(true)
    await server.close()
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture cleanup must remain inside the OS temporary directory',
      )
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 })
  })
  return (path: string, method = 'GET', body?: unknown, token = owner) =>
    server.app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined || body instanceof FormData
            ? {}
            : { 'content-type': 'application/json' }),
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

async function fixtures(
  request: ReturnType<typeof workspace>,
  values: { sourceName?: string; copyName?: string | null } = {},
) {
  const upload = new FormData()
  upload.set('name', 'First read')
  upload.set(
    'file',
    new File(
      [
        `tenant,name\nA,${values.sourceName ?? 'Ada source'}\nB,${values.sourceName === '1' ? '2' : 'Grace source'}\n`,
      ],
      'people.csv',
    ),
  )
  const sourceResponse = await request(
    '/api/data-sources/import',
    'POST',
    upload,
  )
  expect(sourceResponse.status).toBe(200)
  const source = await sourceResponse.json()
  const database = new Database(':memory:')
  database.run('CREATE TABLE people (tenant TEXT, name TEXT)')
  database
    .query('INSERT INTO people VALUES (?, ?)')
    .run('A', values.copyName === undefined ? 'Ada copy' : values.copyName)
  database.query('INSERT INTO people VALUES (?, ?)').run('B', 'Grace copy')
  const bytes = new Uint8Array(database.serialize())
  database.close()
  const copyUpload = new FormData()
  copyUpload.set('name', 'Last read')
  copyUpload.set('file', new File([bytes], 'people.sqlite'))
  const copyResponse = await request(
    '/api/database-connections',
    'POST',
    copyUpload,
  )
  expect(
    copyResponse.status,
    JSON.stringify(await copyResponse.clone().json()),
  ).toBe(200)
  const copy = await copyResponse.json()
  const tenant = await (
    await request('/api/tenants', 'POST', { label: 'A', value: 'A' })
  ).json()
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        column: 'tenant',
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        tables: [{ table: 'people', column: 'tenant' }],
        version: 1,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  const flow = {
    name: 'Two protected reads',
    method: 'GET',
    path: '/two-protected-reads',
    contract: {
      response: {
        type: 'array',
        maxItems: 100,
        items: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false,
        },
      },
    },
    nodes: [
      { id: 'request', type: 'request', position: { x: 0, y: 0 }, config: {} },
      {
        id: 'first',
        type: 'data',
        position: { x: 100, y: 0 },
        config: { sourceId: source.id, columns: ['name'], limit: 10 },
      },
      {
        id: 'last',
        type: 'database',
        position: { x: 200, y: 0 },
        config: {
          connectionId: copy.id,
          table: 'people',
          columns: ['name'],
          limit: 10,
        },
      },
      {
        id: 'response',
        type: 'response',
        position: { x: 300, y: 0 },
        config: { status: 200, body: '$data' },
      },
    ],
    edges: [
      { id: 'one', source: 'request', target: 'first' },
      { id: 'two', source: 'first', target: 'last' },
      { id: 'three', source: 'last', target: 'response' },
    ],
  }
  const savedResponse = await request('/api/flows', 'POST', flow)
  expect(savedResponse.status).toBe(200)
  const saved = await savedResponse.json()
  return { source, copy, tenant, flow, saved }
}

test('a saved two-resource protected REST graph returns only the last read for its reviewed tenant', async () => {
  const request = workspace()
  const { tenant, saved } = await fixtures(request)
  const tested = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: {},
    tenantId: tenant.id,
  })
  expect(tested.status).toBe(200)
  expect(await tested.json()).toEqual({
    status: 200,
    body: [{ name: 'Ada copy' }],
    visited: ['request', 'first', 'last', 'response'],
  })
})

test('input branches retain last-read semantics and a forbidden untaken copy blocks the existing pinned publication', async () => {
  const request = workspace()
  const { tenant, copy, flow, saved } = await fixtures(request)
  const branched = {
    ...flow,
    nodes: [
      ...flow.nodes,
      {
        id: 'choose',
        type: 'condition',
        position: { x: 150, y: 0 },
        config: { field: 'query.copy', equals: 'yes' },
      },
    ],
    edges: [
      flow.edges[0],
      { id: 'choose', source: 'first', target: 'choose' },
      { id: 'true', source: 'choose', target: 'last', sourceHandle: 'true' },
      {
        id: 'false',
        source: 'choose',
        target: 'response',
        sourceHandle: 'false',
      },
      flow.edges[2],
    ],
  }
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...branched,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  for (const [query, expected, visited] of [
    [{}, [{ name: 'Ada source' }], ['request', 'first', 'choose', 'response']],
    [
      { copy: 'yes' },
      [{ name: 'Ada copy' }],
      ['request', 'first', 'choose', 'last', 'response'],
    ],
  ] as const) {
    const result = await request(`/api/flows/${saved.id}/test`, 'POST', {
      body: null,
      query,
      tenantId: tenant.id,
    })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      status: 200,
      body: expected,
      visited,
    })
  }
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const issued = await request('/api/runtime-keys', 'POST', {
    name: 'Original mixed pin',
    flowId: saved.id,
    permissions: ['rest'],
    releaseRevision: 2,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(
    await (
      await request('/run/two-protected-reads', 'GET', undefined, key.token)
    ).json(),
  ).toEqual([{ name: 'Ada source' }])
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'tenant',
        tables: [
          {
            table: 'people',
            column: 'tenant',
            fields: { mode: 'selected', columns: [] },
          },
        ],
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  const denied = await request(
    '/run/two-protected-reads',
    'GET',
    undefined,
    key.token,
  )
  expect(denied.status).toBe(403)
  expect(JSON.stringify(await denied.json())).not.toContain('Ada')
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: null,
        query: {},
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(403)
})

test('mixed GraphQL checks every declared raw row field before a caller projects only typename', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request)
  const graphql = {
    ...flow,
    method: 'POST',
    contract: undefined,
    graphql: { schema: 'type Row { name: Int! } type Query { rows: [Row!]! }' },
  }
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...graphql,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const result = await request(`/api/flows/${saved.id}/graphql/test`, 'POST', {
    query: '{ rows { __typename } }',
    tenantId: tenant.id,
  })
  expect(result.status).toBe(200)
  const body = await result.json()
  expect(JSON.stringify(body)).not.toContain('Ada')
  expect(body).toMatchObject({
    status: 500,
    body: {
      errors: [{ message: 'Response does not match GraphQL row rules' }],
    },
  })
})

test('mixed GraphQL counts active interface-fragment aliases before any graph execution', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request)
  const graphql = {
    ...flow,
    method: 'POST',
    contract: undefined,
    graphql: {
      schema:
        'type Row { name: String! } interface Readable { rows: [Row!]! } type Query implements Readable { rows: [Row!]! }',
    },
  }
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...graphql,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const key = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Mixed query',
      flowId: saved.id,
      permissions: ['query'],
      releaseRevision: 2,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  ).json()
  const before = await (await request('/api/audit')).json()
  const query =
    'query Read($second: Boolean! = true) { __typename ...Visible } fragment Visible on Readable { a: rows { name } b: rows @include(if: $second) { name } }'
  const denied = await request(
    '/graphql/two-protected-reads',
    'POST',
    { query },
    key.token,
  )
  expect(denied.status).toBe(400)
  expect(await denied.json()).toEqual({
    errors: [
      {
        message:
          'Use at most one active rows response key for a mixed protected read graph',
      },
    ],
  })
  const after = await (await request('/api/audit')).json()
  expect(
    after.filter(
      (entry: { action: string }) => entry.action === 'graphql.executed',
    ),
  ).toEqual(
    before.filter(
      (entry: { action: string }) => entry.action === 'graphql.executed',
    ),
  )
  const allowed = await request(
    '/graphql/two-protected-reads',
    'POST',
    { query, variables: { second: false } },
    key.token,
  )
  expect(allowed.status).toBe(200)
  expect(await allowed.json()).toEqual({
    data: { __typename: 'Query', a: [{ name: 'Ada copy' }] },
  })
  const example = await request(`/api/flows/${saved.id}/client-code`, 'POST', {
    target: 'javascript-fetch',
    revision: 2,
    baseUrl: 'http://localhost',
    request: { graphql: { query } },
  })
  expect(example.status).toBe(400)
  for (const [query, variables, expected] of [
    [
      '{ same: rows { name } ...More } fragment More on Query { same: rows { name } }',
      undefined,
      { same: [{ name: 'Ada copy' }] },
    ],
    [
      'query Skip($hide: Boolean! = true) { __typename ...Root @skip(if: $hide) } fragment Root on Query { a: rows { name } b: rows { name } }',
      undefined,
      { __typename: 'Query' },
    ],
    [
      'query Skip($hide: Boolean!) { a: rows { name } ... on Query @skip(if: $hide) { b: rows { name } } }',
      { hide: true },
      { a: [{ name: 'Ada copy' }] },
    ],
  ] as const) {
    const beforeOperation = await (await request('/api/audit')).json()
    const result = await request(
      '/graphql/two-protected-reads',
      'POST',
      { query, variables },
      key.token,
    )
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ data: expected })
    if (!Object.hasOwn(expected, 'a') && !Object.hasOwn(expected, 'same')) {
      const afterOperation = await (await request('/api/audit')).json()
      expect(
        afterOperation.filter(
          (entry: { action: string }) => entry.action === 'graphql.executed',
        ),
      ).toEqual(
        beforeOperation.filter(
          (entry: { action: string }) => entry.action === 'graphql.executed',
        ),
      )
    }
  }
})

test('every mixed path needs a read and matching explicit row rules, without changing an accepted release', async () => {
  const request = workspace()
  const { tenant, flow, saved, copy } = await fixtures(request)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const before = await (
    await request(`/api/flows/${saved.id}/backend-code?revision=1`)
  ).json()
  const choose = {
    id: 'choose',
    type: 'condition',
    position: { x: 0, y: 0 },
    config: { field: 'query.read', equals: 'yes' },
  }
  const invalid = [
    { ...flow, contract: undefined },
    {
      ...flow,
      contract: { response: { ...flow.contract.response, nullable: true } },
    },
    {
      ...flow,
      contract: { response: { ...flow.contract.response, maxItems: 101 } },
    },
    {
      ...flow,
      nodes: flow.nodes.map((node) =>
        node.id === 'last'
          ? { ...node, config: { ...node.config, columns: ['tenant'] } }
          : node,
      ),
    },
    {
      ...flow,
      nodes: flow.nodes.map((node) =>
        node.id === 'last'
          ? {
              ...node,
              config: {
                ...node.config,
                filter: { column: 'name', value: '$data' },
              },
            }
          : node,
      ),
    },
    {
      ...flow,
      nodes: [...flow.nodes, choose],
      edges: [
        { id: 'begin', source: 'request', target: 'choose' },
        { id: 'read', source: 'choose', target: 'first', sourceHandle: 'true' },
        {
          id: 'skip',
          source: 'choose',
          target: 'response',
          sourceHandle: 'false',
        },
        flow.edges[1],
        flow.edges[2],
      ],
    },
  ]
  let revision = 1
  for (const definition of invalid) {
    expect(
      (
        await request(`/api/flows/${saved.id}`, 'PUT', {
          ...definition,
          revision,
        })
      ).status,
    ).toBe(200)
    revision++
    expect(
      (
        await request(`/api/flows/${saved.id}/test`, 'POST', {
          body: null,
          query: {},
          tenantId: tenant.id,
        })
      ).status,
    ).toBe(400)
    const auditBefore = await (await request('/api/audit')).json()
    expect(
      (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision }))
        .status,
    ).toBe(400)
    expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
    expect(
      (
        await (
          await request(`/api/flows/${saved.id}/backend-code?revision=1`)
        ).json()
      ).sha256,
    ).toBe(before.sha256)
  }
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}`, 'PUT', { ...flow, revision }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: null,
        query: {},
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(400)
})

test('legacy one-read rules and hyphenated input filters remain valid without new response contracts', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request)
  const legacy = {
    ...flow,
    contract: undefined,
    nodes: flow.nodes
      .filter((node) => node.id !== 'last')
      .map((node) =>
        node.id === 'first'
          ? {
              ...node,
              config: {
                ...node.config,
                filter: { column: 'name', value: '$input.query.customer-id' },
              },
            }
          : node,
      ),
    edges: [
      flow.edges[0],
      { id: 'finish', source: 'first', target: 'response' },
    ],
  }
  expect(
    (await request(`/api/flows/${saved.id}`, 'PUT', { ...legacy, revision: 1 }))
      .status,
  ).toBe(200)
  const result = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: { 'customer-id': 'Ada source' },
    tenantId: tenant.id,
  })
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({
    status: 200,
    body: [{ name: 'Ada source' }],
    visited: ['request', 'first', 'response'],
  })
})

test('mixed graph joins accept four reads and three conditions while refusing a fifth read', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request)
  const first = flow.nodes.find((node) => node.id === 'first')!
  const last = flow.nodes.find((node) => node.id === 'last')!
  const reads = [
    first,
    last,
    { ...first, id: 'third' },
    { ...last, id: 'fourth' },
  ]
  const conditions = [0, 1, 2].map((index) => ({
    id: `condition-${index}`,
    type: 'condition',
    position: { x: 0, y: 0 },
    config: { field: 'query.branch', equals: 'yes' },
  }))
  const nodes = [flow.nodes[0], ...reads, ...conditions, flow.nodes[3]]
  const edges = [
    { id: 'begin', source: 'request', target: 'first' },
    ...conditions.flatMap((condition, index) => [
      {
        id: `to-condition-${index}`,
        source: reads[index]!.id,
        target: condition.id,
      },
      {
        id: `true-${index}`,
        source: condition.id,
        target: reads[index + 1]!.id,
        sourceHandle: 'true',
      },
      {
        id: `false-${index}`,
        source: condition.id,
        target: reads[index + 1]!.id,
        sourceHandle: 'false',
      },
    ]),
    { id: 'finish', source: 'fourth', target: 'response' },
  ]
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...flow,
        nodes,
        edges,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const result = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: { branch: 'yes' },
    tenantId: tenant.id,
  })
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({
    status: 200,
    body: [{ name: 'Ada copy' }],
    visited: [
      'request',
      'first',
      'condition-0',
      'last',
      'condition-1',
      'third',
      'condition-2',
      'fourth',
      'response',
    ],
  })
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...flow,
        nodes: [...nodes, { ...first, id: 'fifth' }],
        edges: [
          ...edges.filter((edge) => edge.id !== 'finish'),
          { id: 'to-fifth', source: 'fourth', target: 'fifth' },
          { id: 'finish', source: 'fifth', target: 'response' },
        ],
        revision: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/flows/${saved.id}/test`, 'POST', {
        body: null,
        query: {},
        tenantId: tenant.id,
      })
    ).status,
  ).toBe(400)
})

test('raw mixed GraphQL honors nullable scalars and rejects null, enum and numeric ID coercion before projection', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request, {
    copyName: null,
    sourceName: '1',
  })
  let revision = 1
  const testSchema = async (schema: string, sourceLast = false) => {
    const nodes = sourceLast
      ? [flow.nodes[0], flow.nodes[2], flow.nodes[1], flow.nodes[3]]
      : flow.nodes
    const edges = sourceLast
      ? [
          { id: 'first', source: 'request', target: 'last' },
          { id: 'next', source: 'last', target: 'first' },
          { id: 'finish', source: 'first', target: 'response' },
        ]
      : flow.edges
    expect(
      (
        await request(`/api/flows/${saved.id}`, 'PUT', {
          ...flow,
          method: 'POST',
          contract: undefined,
          graphql: { schema },
          nodes,
          edges,
          revision,
        })
      ).status,
    ).toBe(200)
    revision++
    const result = await request(
      `/api/flows/${saved.id}/graphql/test`,
      'POST',
      { query: '{ rows { name } }', tenantId: tenant.id },
    )
    expect(result.status).toBe(200)
    return result.json()
  }
  expect(
    await testSchema('type Row { name: String } type Query { rows: [Row!]! }'),
  ).toMatchObject({ status: 200, body: { data: { rows: [{ name: null }] } } })
  expect(
    await testSchema('type Row { name: String! } type Query { rows: [Row!]! }'),
  ).toMatchObject({
    status: 500,
    body: {
      errors: [{ message: 'Response does not match GraphQL row rules' }],
    },
  })
  expect(
    await testSchema(
      'type Row { name: ID! } type Query { rows: [Row!]! }',
      true,
    ),
  ).toMatchObject({ status: 500 })
  expect(
    await testSchema(
      'enum Label { READY } type Row { name: Label! } type Query { rows: [Row!]! }',
      true,
    ),
  ).toMatchObject({ status: 500 })
  expect(
    await testSchema(
      'type Row { name: Int! } type Query { rows: [Row!]! }',
      true,
    ),
  ).toMatchObject({ status: 200, body: { data: { rows: [{ name: 1 }] } } })
})

test('dollar-prefixed fixed filter text remains a literal in a protected legacy graph', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request, { sourceName: '$50' })
  const nodes = flow.nodes
    .filter((node) => node.id !== 'last')
    .map((node) =>
      node.id === 'first'
        ? {
            ...node,
            config: {
              ...node.config,
              filter: { column: 'name', value: '$50' },
            },
          }
        : node,
    )
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...flow,
        contract: undefined,
        nodes,
        edges: [
          flow.edges[0],
          { id: 'finish', source: 'first', target: 'response' },
        ],
        revision: 1,
      })
    ).status,
  ).toBe(200)
  const result = await request(`/api/flows/${saved.id}/test`, 'POST', {
    body: null,
    query: {},
    tenantId: tenant.id,
  })
  expect(await result.json()).toMatchObject({
    status: 200,
    body: [{ name: '$50' }],
  })
})

test('selected mixed operators need every dependency USE and original issuer authority survives no replacement bypass', async () => {
  const request = workspace()
  const { tenant, flow, saved, source, copy } = await fixtures(request)
  const role = await (
    await request('/api/roles', 'POST', {
      name: 'Mixed operator',
      permissions: ['flows.test', 'flows.publish', 'runtime-keys.manage'],
    })
  ).json()
  const dependencyUse = {
    sources: [source.id],
    databaseConnections: [],
    authConnections: [],
  }
  const memberResponse = await request('/api/members', 'POST', {
    name: 'Assigned mixed operator',
    role: 'custom',
    roleId: role.id,
    tenantId: tenant.id,
    access: { mode: 'selected', flowIds: [saved.id], dependencyUse },
  })
  expect(memberResponse.status).toBe(200)
  const member = await memberResponse.json()
  expect(
    (
      await request(
        `/api/flows/${saved.id}/test`,
        'POST',
        { body: null, query: {} },
        member.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(
        `/api/flows/${saved.id}/publish`,
        'POST',
        { revision: 1 },
        member.token,
      )
    ).status,
  ).toBe(404)
  const allowedUse = { ...dependencyUse, databaseConnections: [copy.id] }
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        mode: 'selected',
        flowIds: [saved.id],
        dependencyUse: allowedUse,
        version: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    await (
      await request(
        `/api/flows/${saved.id}/test`,
        'POST',
        { body: null, query: {} },
        member.token,
      )
    ).json(),
  ).toMatchObject({ status: 200, body: [{ name: 'Ada copy' }] })
  expect(
    (
      await request(
        `/api/flows/${saved.id}/publish`,
        'POST',
        { revision: 1 },
        member.token,
      )
    ).status,
  ).toBe(200)
  const issued = await request(
    '/api/runtime-keys',
    'POST',
    {
      name: 'Selected mixed caller',
      flowId: saved.id,
      permissions: ['rest'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    member.token,
  )
  expect(issued.status).toBe(200)
  const key = await issued.json()
  expect(key).toMatchObject({
    tenantId: tenant.id,
    issuerBinding: { memberId: member.id, action: 'runtime-keys.manage' },
  })
  expect(
    await (
      await request('/run/two-protected-reads', 'GET', undefined, key.token)
    ).json(),
  ).toEqual([{ name: 'Ada copy' }])
  expect(
    (
      await request(`/api/members/${member.id}/access`, 'PUT', {
        mode: 'selected',
        flowIds: [saved.id],
        dependencyUse,
        version: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request('/run/two-protected-reads', 'GET', undefined, key.token))
      .status,
  ).toBe(403)
  const auditBefore = await (await request('/api/audit')).json()
  expect(
    (await request(`/api/runtime-keys/${key.id}/rotate`, 'POST')).status,
  ).toBe(409)
  expect(await (await request('/api/audit')).json()).toEqual(auditBefore)
  expect(
    (
      await request(
        `/api/runtime-keys/${key.id}`,
        'DELETE',
        undefined,
        member.token,
      )
    ).status,
  ).toBe(200)
  expect(
    (await request('/run/two-protected-reads', 'GET', undefined, key.token))
      .status,
  ).toBe(401)
  expect(
    (await (await request(`/api/flows/${saved.id}`)).json()).publishedRevision,
  ).toBe(1)
  expect(
    (await (await request(`/api/flows/${saved.id}`)).json()).nodes,
  ).toEqual(flow.nodes)
})

test('mixed release rollback and an opaque complete backup preserve original pins, dependencies and artifact bytes', async () => {
  const request = workspace()
  const { tenant, flow, saved } = await fixtures(request)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 1 }))
      .status,
  ).toBe(200)
  const original = await (
    await request('/api/runtime-keys', 'POST', {
      name: 'Original mixed pin',
      flowId: saved.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  ).json()
  const artifact = await (
    await request(`/api/flows/${saved.id}/backend-code?revision=1`)
  ).json()
  const graphql = {
    ...flow,
    method: 'POST',
    contract: undefined,
    graphql: {
      schema: 'type Row { name: String! } type Query { rows: [Row!]! }',
    },
  }
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...graphql,
        revision: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  expect(
    (
      await request(
        '/run/two-protected-reads',
        'GET',
        undefined,
        original.token,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await request(`/api/flows/${saved.id}/rollback`, 'POST', {
        revision: 1,
        publishedRevision: 2,
      })
    ).status,
  ).toBe(200)
  expect(
    await (
      await request(
        '/run/two-protected-reads',
        'GET',
        undefined,
        original.token,
      )
    ).json(),
  ).toEqual([{ name: 'Ada copy' }])
  expect(
    (await (await request(`/api/flows/${saved.id}`)).json()).revision,
  ).toBe(2)
  const backedUp = await request('/api/backups', 'POST')
  expect(backedUp.status).toBe(200)
  const backup = await backedUp.json()
  const downloaded = await request(`/api/backups/${backup.id}`)
  expect(downloaded.status).toBe(200)
  const bytes = new Uint8Array(await downloaded.arrayBuffer())
  expect(bytes.byteLength).toBe(backup.bytes)
  const restored = workspace(bytes)
  expect(
    await (
      await restored(
        '/run/two-protected-reads',
        'GET',
        undefined,
        original.token,
      )
    ).json(),
  ).toEqual([{ name: 'Ada copy' }])
  expect(
    await (
      await restored(`/api/flows/${saved.id}/backend-code?revision=1`)
    ).json(),
  ).toEqual(artifact)
  expect(
    (await (await restored(`/api/flows/${saved.id}/releases`)).json()).map(
      (release: { revision: number }) => release.revision,
    ),
  ).toEqual([2, 1])
  expect(await (await restored('/api/runtime-keys')).json()).toContainEqual(
    expect.objectContaining({
      id: original.id,
      tenantId: original.tenantId,
      releaseRevision: 1,
      expiresAt: original.expiresAt,
    }),
  )
})

test('legacy single-read and unprotected GraphQL retain multiple alias executions', async () => {
  const request = workspace()
  const { tenant, flow, saved, source, copy } = await fixtures(request)
  const graphql = {
    ...flow,
    method: 'POST',
    contract: undefined,
    graphql: {
      schema: 'type Row { name: String! } type Query { rows: [Row!]! }',
    },
  }
  const single = {
    ...graphql,
    nodes: flow.nodes.filter((node) => node.id !== 'last'),
    edges: [
      flow.edges[0],
      { id: 'finish', source: 'first', target: 'response' },
    ],
  }
  expect(
    (await request(`/api/flows/${saved.id}`, 'PUT', { ...single, revision: 1 }))
      .status,
  ).toBe(200)
  const legacy = await request(`/api/flows/${saved.id}/graphql/test`, 'POST', {
    query: '{ a: rows { name } b: rows { name } }',
    tenantId: tenant.id,
  })
  expect(await legacy.json()).toMatchObject({
    status: 200,
    body: {
      data: { a: [{ name: 'Ada source' }], b: [{ name: 'Ada source' }] },
    },
    visited: ['request', 'first', 'response', 'request', 'first', 'response'],
  })
  expect(
    (
      await request(`/api/data-sources/${source.id}/row-policy`, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/database-connections/${copy.id}/row-policy`, 'PUT', {
        mode: 'unprotected',
        version: 2,
        resourceVersion: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...graphql,
        revision: 2,
      })
    ).status,
  ).toBe(200)
  const unprotected = await request(
    `/api/flows/${saved.id}/graphql/test`,
    'POST',
    { query: '{ a: rows { name } b: rows { name } }' },
  )
  expect(await unprotected.json()).toMatchObject({
    status: 200,
    body: {
      data: {
        a: [{ name: 'Ada copy' }, { name: 'Grace copy' }],
        b: [{ name: 'Ada copy' }, { name: 'Grace copy' }],
      },
    },
  })
})

test('mixed GraphQL load starts reject multiple active rows keys before creating a job or managed key', async () => {
  const request = workspace(undefined, {
    listen: true,
    k6Runner: async () => ({
      requests: 0,
      requestsPerSecond: 0,
      failedRequests: 0,
      checkRate: 1,
      avgMs: 0,
      p95Ms: 0,
      maxMs: 0,
      thresholdsPassed: true,
    }),
  })
  const { flow, saved, tenant } = await fixtures(request)
  expect(
    (
      await request(`/api/flows/${saved.id}`, 'PUT', {
        ...flow,
        method: 'POST',
        contract: undefined,
        graphql: {
          schema: 'type Row { name: String! } type Query { rows: [Row!]! }',
        },
        revision: 1,
      })
    ).status,
  ).toBe(200)
  expect(
    (await request(`/api/flows/${saved.id}/publish`, 'POST', { revision: 2 }))
      .status,
  ).toBe(200)
  const audit = await (await request('/api/audit')).json()
  const started = await request('/api/load-tests', 'POST', {
    flowId: saved.id,
    tenantId: tenant.id,
    request: {
      graphql: { query: '{ first: rows { name } second: rows { name } }' },
    },
  })
  expect(started.status).toBe(400)
  expect(await (await request('/api/load-tests')).json()).toEqual([])
  expect(await (await request('/api/runtime-keys')).json()).toEqual([])
  expect(await (await request('/api/audit')).json()).toEqual(audit)
})
