export const helloFlow = {
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

export const graphqlFlow = {
  ...helloFlow,
  name: 'GraphQL greeting',
  method: 'POST',
  graphql: {
    schema: `type Query { greet(name: String!): Greeting! }
type Mutation { greet(name: String!): Greeting! }
type Greeting { message: String! name: String! }`,
  },
  nodes: [
    helloFlow.nodes[0],
    {
      ...helloFlow.nodes[1],
      config: {
        status: 200,
        body: { message: 'Hello, Besh!', name: '$input.body.name' },
      },
    },
  ],
}
