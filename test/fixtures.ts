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
