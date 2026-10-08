import { expect, test } from 'bun:test'
import { executeFlow, validateFlow } from '../src/flows/engine'

export const greeting = {
  name: 'Hello API',
  method: 'GET',
  path: '/hello',
  nodes: [
    { id: 'request', type: 'request', position: { x: 80, y: 100 }, config: {} },
    {
      id: 'response',
      type: 'response',
      position: { x: 400, y: 100 },
      config: { status: 200, body: { message: 'Hello, Besh!' } },
    },
  ],
  edges: [{ id: 'one', source: 'request', target: 'response' }],
}

test('a request flow returns the configured JSON response', () => {
  expect(executeFlow(greeting, { body: null, query: {} })).toEqual({
    status: 200,
    body: { message: 'Hello, Besh!' },
    visited: ['request', 'response'],
  })
})

test('invalid graphs cannot be published or run', () => {
  const invalid = [
    { ...greeting, nodes: [...greeting.nodes, greeting.nodes[0]] },
    {
      ...greeting,
      edges: [{ id: 'bad', source: 'request', target: 'missing' }],
    },
    {
      ...greeting,
      edges: [
        ...greeting.edges,
        { id: 'cycle', source: 'response', target: 'request' },
      ],
    },
    {
      ...greeting,
      nodes: [...greeting.nodes, { ...greeting.nodes[1], id: 'orphan' }],
    },
    {
      ...greeting,
      edges: [
        ...greeting.edges,
        { id: 'ambiguous', source: 'request', target: 'response' },
      ],
    },
    {
      ...greeting,
      nodes: Array.from({ length: 65 }, (_, i) => ({
        ...greeting.nodes[0],
        id: String(i),
      })),
    },
  ]
  for (const graph of invalid) expect(() => validateFlow(graph)).toThrow()
  expect(() => executeFlow(invalid[1], { body: null, query: {} })).toThrow()
})

test('conditions select a response and input references preserve JSON types', () => {
  const flow = {
    ...greeting,
    method: 'POST',
    nodes: [
      greeting.nodes[0],
      {
        id: 'check',
        type: 'condition',
        position: { x: 250, y: 100 },
        config: { field: 'body.active', equals: true },
      },
      {
        id: 'yes',
        type: 'response',
        position: { x: 450, y: 0 },
        config: {
          status: 201,
          body: { user: '$input.body.name', count: '$input.body.count' },
        },
      },
      {
        id: 'no',
        type: 'response',
        position: { x: 450, y: 200 },
        config: { status: 403, body: { error: 'Inactive' } },
      },
    ],
    edges: [
      { id: 'start', source: 'request', target: 'check' },
      { id: 'yes', source: 'check', target: 'yes', sourceHandle: 'true' },
      { id: 'no', source: 'check', target: 'no', sourceHandle: 'false' },
    ],
  }
  expect(
    executeFlow(flow, {
      body: { active: true, name: 'Ada', count: 3 },
      query: {},
    }),
  ).toEqual({
    status: 201,
    body: { user: 'Ada', count: 3 },
    visited: ['request', 'check', 'yes'],
  })
  expect(executeFlow(flow, { body: { active: false }, query: {} }).status).toBe(
    403,
  )
  expect(() =>
    validateFlow({ ...flow, edges: flow.edges.slice(0, 2) }),
  ).toThrow()
  expect(() =>
    executeFlow(
      {
        ...greeting,
        nodes: [
          greeting.nodes[0],
          {
            ...greeting.nodes[1],
            config: { status: 200, body: '$input.body.__proto__' },
          },
        ],
      },
      { body: {}, query: {} },
    ),
  ).toThrow()
})

test('executor bounds input, output and configuration nesting', () => {
  const input = { body: { value: 'x'.repeat(300_000) }, query: {} }
  expect(() => executeFlow(greeting, input)).toThrow('limit')
  const largeResponse = {
    ...greeting,
    nodes: [
      greeting.nodes[0],
      {
        ...greeting.nodes[1],
        config: { status: 200, body: 'x'.repeat(300_000) },
      },
    ],
  }
  expect(() => executeFlow(largeResponse, { body: null, query: {} })).toThrow(
    'limit',
  )
})
