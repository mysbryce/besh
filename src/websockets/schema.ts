import { z } from 'zod'
import { apiSchema, contractSchema, type ApiSchema } from '../flows/contracts'
import type { WebSocketDefinition } from './model'

function exactOrigin(value: string) {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.origin === value
    )
  } catch {
    return false
  }
}

function flatObject(schema: ApiSchema) {
  return (
    schema.type === 'object' &&
    !schema.nullable &&
    schema.additionalProperties === false &&
    Object.values(schema.properties ?? {}).every(
      (field) => field.type !== 'object' && field.type !== 'array',
    )
  )
}

export const websocketSchema: z.ZodType<WebSocketDefinition> = z
  .object({
    input: apiSchema,
    output: apiSchema,
    allowedOrigins: z.array(z.string().max(2048).refine(exactOrigin)).max(16),
  })
  .strict()
  .superRefine((definition, context) => {
    const rules = contractSchema.safeParse({
      body: definition.input,
      response: definition.output,
    })
    if (!rules.success)
      context.addIssue({ code: 'custom', message: 'Invalid WebSocket rules' })
    const output = definition.output
    if (
      !flatObject(definition.input) ||
      !(
        flatObject(output) ||
        (output.type === 'array' &&
          !output.nullable &&
          flatObject(output.items) &&
          (output.minItems ?? 0) <= 100 &&
          (output.maxItems ?? 100) <= 100)
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'WebSocket input needs a flat typed object; output needs a flat object or at most 100 flat rows, with additional fields disabled',
      })
    if (
      new Set(definition.allowedOrigins).size !==
      definition.allowedOrigins.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Choose each allowed browser origin once',
      })
  })
