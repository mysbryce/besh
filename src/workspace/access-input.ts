import { z } from 'zod'

const ids = z
  .array(z.string().min(1).max(80))
  .max(256)
  .refine((value) => new Set(value).size === value.length)
const version = z.number().int().positive().safe()
const dependencyUse = z
  .object({ sources: ids, databaseConnections: ids, authConnections: ids })
  .strict()
export const flowAccessSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }).strict(),
  z.object({ mode: z.literal('selected'), flowIds: ids }).strict(),
])
export const flowAccessUpdateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all'), version }).strict(),
  z.object({ mode: z.literal('selected'), flowIds: ids, version }).strict(),
])
export const memberAccessSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }).strict(),
  z
    .object({ mode: z.literal('selected'), flowIds: ids, dependencyUse })
    .strict(),
])
export const memberAccessUpdateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all'), version }).strict(),
  z
    .object({
      mode: z.literal('selected'),
      flowIds: ids,
      dependencyUse,
      version,
    })
    .strict(),
])
