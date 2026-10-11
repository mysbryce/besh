import type { ApiContract, ApiSchema } from '../../../src/flows/contracts'
import type { WebSocketDefinition } from '../../../src/websockets/model'

function flatObject(schema: ApiSchema | undefined): ApiSchema | null {
  if (
    schema?.type !== 'object' ||
    schema.nullable ||
    Object.values(schema.properties ?? {}).some(
      (field) => field.type === 'object' || field.type === 'array',
    )
  )
    return null
  return { ...schema, additionalProperties: false }
}

export function webSocketReadRules(
  contract: ApiContract | undefined,
): WebSocketDefinition | null {
  const response = contract?.response
  if (
    response?.type !== 'array' ||
    response.nullable ||
    (response.minItems ?? 0) > 100 ||
    (response.maxItems ?? 100) > 100 ||
    (contract?.query && contract.body)
  )
    return null
  const items = flatObject(response.items)
  const input = contract?.query || contract?.body
  const received = input
    ? flatObject(input)
    : { type: 'object' as const, properties: {}, additionalProperties: false }
  if (!items || !received) return null
  return {
    input: received,
    output: { ...response, items, maxItems: response.maxItems ?? 100 },
    allowedOrigins: [],
  }
}
