import { ApiError } from '../errors'

export const websocketLimits = {
  maxPayloadLength: 32_768,
  backpressureLimit: 131_072,
  closeOnBackpressureLimit: true,
  idleTimeout: 30,
  perMessageDeflate: false,
} as const

export function bearerProof(request: Request) {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) throw new ApiError(401, 'Authentication required')
  return token
}

export function requireUpgrade(request: Request) {
  const url = new URL(request.url)
  if (url.search || url.hash)
    throw new ApiError(
      400,
      'WebSocket upgrades do not accept URL query or fragment input',
    )
  if (
    request.method !== 'GET' ||
    request.headers.get('upgrade')?.toLowerCase() !== 'websocket' ||
    !request.headers
      .get('connection')
      ?.toLowerCase()
      .split(/\s*,\s*/)
      .includes('upgrade')
  )
    throw new ApiError(426, 'WebSocket upgrade required')
}

export function ticketProtocol(request: Request) {
  const offered = request.headers.get('sec-websocket-protocol') ?? ''
  const protocols = offered.split(',').map((value) => value.trim())
  const tickets = protocols.filter((value) => value.startsWith('besh.ticket.'))
  if (
    offered.length > 512 ||
    protocols.length !== 2 ||
    protocols.filter((value) => value === 'besh.ws.v1').length !== 1 ||
    tickets.length !== 1 ||
    !/^besh\.ticket\.[A-Za-z0-9_-]{43}$/.test(tickets[0]!)
  )
    throw new ApiError(
      401,
      'WebSocket ticket is invalid or expired. Request a new ticket.',
    )
  return tickets[0]!.slice('besh.ticket.'.length)
}

export function scrubUpgrade(context: {
  request: Request
  headers: Record<string, string | undefined>
  cookie: object
  set: { headers: Record<string, unknown>; cookie?: unknown }
}) {
  const retained = new Set([
    'connection',
    'upgrade',
    'sec-websocket-key',
    'sec-websocket-version',
  ])
  const protocols = context.request.headers.get('sec-websocket-protocol')
  const version = protocols
    ?.split(',')
    .some((item) => item.trim() === 'besh.ws.v1')
  for (const name of [...context.request.headers.keys()])
    if (!retained.has(name)) context.request.headers.delete(name)
  for (const name of Object.keys(context.headers))
    if (!retained.has(name.toLowerCase())) delete context.headers[name]
  for (const name of Object.keys(context.cookie))
    Reflect.deleteProperty(context.cookie, name)
  Reflect.deleteProperty(context, 'session')
  Reflect.deleteProperty(context, 'member')
  delete context.set.cookie
  for (const name of Object.keys(context.set.headers))
    if (
      [
        'authorization',
        'cookie',
        'set-cookie',
        'sec-websocket-protocol',
      ].includes(name.toLowerCase())
    )
      delete context.set.headers[name]
  if (version) {
    context.request.headers.set('sec-websocket-protocol', 'besh.ws.v1')
    context.headers['sec-websocket-protocol'] = 'besh.ws.v1'
    context.set.headers['sec-websocket-protocol'] = 'besh.ws.v1'
  }
}

export function messageEnvelope(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof Uint8Array
  )
    throw new ApiError(400, 'Invalid WebSocket message')
  const item = value as Record<string, unknown>
  if (
    Object.keys(item).length !== 2 ||
    !Object.hasOwn(item, 'body') ||
    typeof item.id !== 'string' ||
    [...item.id].length < 1 ||
    [...item.id].length > 64 ||
    /[\u0000-\u001f\u007f]/.test(item.id) ||
    !item.body ||
    typeof item.body !== 'object' ||
    Array.isArray(item.body)
  )
    throw new ApiError(400, 'Invalid WebSocket message')
  return { id: item.id, body: item.body }
}
