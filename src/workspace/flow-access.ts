import { z } from 'zod'

export type FlowAccess = {
  mode: 'all' | 'selected'
  flowIds: string[]
  version: number
}

export type FlowAccessInput =
  { mode: 'all' } | { mode: 'selected'; flowIds: string[] }

export const flowAccessSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }).strict(),
  z
    .object({
      mode: z.literal('selected'),
      flowIds: z
        .array(z.string().min(1).max(80))
        .max(256)
        .refine((ids) => new Set(ids).size === ids.length),
    })
    .strict(),
])

export const flowAccessUpdateSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('all'),
      version: z.number().int().positive().safe(),
    })
    .strict(),
  z
    .object({
      mode: z.literal('selected'),
      flowIds: z
        .array(z.string().min(1).max(80))
        .max(256)
        .refine((ids) => new Set(ids).size === ids.length),
      version: z.number().int().positive().safe(),
    })
    .strict(),
])

export function supportsSelectedFlows(permissions: readonly string[]) {
  return permissions.every((permission) => permission === 'flows.read')
}
