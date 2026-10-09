import type { Flow } from '../flows/model'

export function validateWebSocketGraph(flow: Flow) {
  if (!flow.websocket) return
  const response = flow.nodes.find((node) => node.type === 'response')
  const reads = flow.nodes.filter(
    (node) => node.type === 'data' || node.type === 'database',
  )
  if (
    !response ||
    response.config.status !== 200 ||
    flow.nodes.filter((node) => node.type === 'response').length !== 1 ||
    reads.length > 1 ||
    flow.nodes.length !== 2 + reads.length ||
    flow.nodes.some(
      (node) =>
        !['request', 'response', 'data', 'database'].includes(node.type),
    ) ||
    (reads.length
      ? response.config.body !== '$data' ||
        flow.websocket.output.type !== 'array'
      : response.config.body !== '$input.body' ||
        flow.websocket.output.type !== 'object')
  )
    throw new Error(
      'WebSocket replies need request → response with $input.body, or one data read → response with $data, using status 200',
    )
}
