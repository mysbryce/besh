export type FlowTransport = 'rest' | 'graphql' | 'websocket'

export function websocketRoutesOverlap(left: string, right: string) {
  return (
    left === right || `${left}/ticket` === right || left === `${right}/ticket`
  )
}

export function flowTransport(flow: {
  graphql?: unknown
  websocket?: unknown
}): FlowTransport {
  if (flow.graphql && flow.websocket)
    throw new Error('Choose one API transport')
  if (flow.websocket) return 'websocket'
  return flow.graphql ? 'graphql' : 'rest'
}
