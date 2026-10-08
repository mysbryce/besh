import { z } from 'zod'

const position = z.object({ x: z.number().finite(), y: z.number().finite() })
const base = { id: z.string().min(1).max(80), position }

export const flowSchema = z.object({
  name: z.string().trim().min(1).max(80),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z
    .string()
    .max(160)
    .regex(/^\/[a-zA-Z0-9/_-]+$/),
  graphql: z.object({ schema: z.string().min(1).max(16_384) }).optional(),
  nodes: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ ...base, type: z.literal('request'), config: z.object({}) }),
        z.object({
          ...base,
          type: z.literal('condition'),
          config: z.object({
            field: z.string().min(1).max(160),
            equals: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          }),
        }),
        z.object({
          ...base,
          type: z.literal('response'),
          config: z.object({
            status: z.number().int().min(200).max(599),
            body: z.json(),
          }),
        }),
      ]),
    )
    .max(64),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().nullish(),
      }),
    )
    .max(128),
})

export type Flow = z.infer<typeof flowSchema>
export type FlowNode = Flow['nodes'][number]
export type FlowInput = { body: unknown; query: Record<string, string> }
export type FlowResult = { status: number; body: unknown; visited: string[] }
