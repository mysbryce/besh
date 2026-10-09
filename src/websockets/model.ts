import type { ApiSchema } from '../flows/contracts'

export type WebSocketDefinition = {
  input: ApiSchema
  output: ApiSchema
  allowedOrigins: string[]
}

export type WebSocketTicket = {
  ticket: string
  expiresAt: string
  revision: number
  path: string
  protocol: 'besh.ws.v1'
}
