import { z } from 'zod'
import { contractSchema } from './contracts'
export type { ApiSchema, ApiContract } from './contracts'

const position = z.object({ x: z.number().finite(), y: z.number().finite() })
const base = { id: z.string().min(1).max(80), position }

export const flowSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    method: z.enum([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ]),
    path: z
      .string()
      .max(160)
      .regex(/^\/[a-zA-Z0-9/_-]+$/),
    graphql: z.object({ schema: z.string().min(1).max(16_384) }).optional(),
    contract: contractSchema.optional(),
    nodes: z
      .array(
        z.discriminatedUnion('type', [
          z.object({
            ...base,
            type: z.literal('request'),
            config: z.object({}),
          }),
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
            type: z.literal('data'),
            config: z.object({
              sourceId: z.string().min(1).max(80),
              columns: z
                .array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/))
                .min(1)
                .max(64),
              filter: z
                .object({
                  column: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
                  value: z.union([
                    z.string().max(4096),
                    z.number().finite(),
                    z.boolean(),
                    z.null(),
                  ]),
                })
                .optional(),
              limit: z.number().int().min(1).max(100),
            }),
          }),
          z.object({
            ...base,
            type: z.literal('social'),
            config: z.object({ connectionId: z.string().min(1).max(80) }),
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
  .superRefine((flow, context) => {
    if (
      flow.contract &&
      (flow.graphql ||
        ((flow.method === 'GET' || flow.method === 'HEAD') &&
          flow.contract.body))
    )
      context.addIssue({
        code: 'custom',
        message: 'REST rules do not match this API protocol or method',
      })
  })

export type Flow = z.infer<typeof flowSchema>
export type FlowNode = Flow['nodes'][number]
export type DataReadConfig = Extract<FlowNode, { type: 'data' }>['config']
export type SocialConfig = Extract<FlowNode, { type: 'social' }>['config']
export type FlowContext = {
  readData?: (config: DataReadConfig) => unknown
  social?: (config: SocialConfig, input: { body: unknown }) => Promise<unknown>
}
export type FlowInput = { body: unknown; query: Record<string, string> }
export type FlowResult = { status: number; body: unknown; visited: string[] }
