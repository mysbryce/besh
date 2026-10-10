import { z } from 'zod'

export type StructSchema =
  | { type: 'text' | 'number' | 'boolean' }
  | { type: 'object'; fields: StructField[] }
  | { type: 'array'; items: StructSchema }
  | { type: 'select'; options: { value: string; label: string }[] }

export type StructField = {
  key: string
  label: string
  required: boolean
  schema: StructSchema
}

export type StructSummary = {
  id: string
  name: string
  version: number
  createdAt: string
  updatedAt: string
}

export type StructDraft = StructSummary & { fields: StructField[] }

const text = z.string().trim().min(1).max(80)
const key = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/)
  .refine((value) => !['constructor', 'prototype', '__proto__'].includes(value))

const fieldSchema: z.ZodType<StructField> = z.lazy(() =>
  z.object({ key, label: text, required: z.boolean(), schema }).strict(),
)

const fields = z
  .array(fieldSchema)
  .max(32)
  .refine(
    (entries) =>
      new Set(entries.map((field) => field.key)).size === entries.length,
  )

const schema: z.ZodType<StructSchema> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text') }).strict(),
    z.object({ type: z.literal('number') }).strict(),
    z.object({ type: z.literal('boolean') }).strict(),
    z.object({ type: z.literal('object'), fields }).strict(),
    z.object({ type: z.literal('array'), items: schema }).strict(),
    z
      .object({
        type: z.literal('select'),
        options: z
          .array(z.object({ value: text, label: text }).strict())
          .min(1)
          .max(32)
          .refine(
            (entries) =>
              new Set(entries.map((option) => option.value)).size ===
              entries.length,
          ),
      })
      .strict(),
  ]),
)

const definitionSchema = z.object({ name: text, fields }).strict()
const updateSchema = definitionSchema.extend({
  version: z.number().int().positive().safe(),
})

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function boundedDefinition(value: unknown) {
  const pending = [{ value, depth: 0 }]
  const seen = new WeakSet<object>()
  let entries = 0

  // Reject oversized or deeply nested raw input before JSON encoding or recursive parsing.
  while (pending.length) {
    const current = pending.pop()!
    if (++entries > 4096 || current.depth > 32) return false
    if (
      typeof current.value === 'string' &&
      Buffer.byteLength(current.value, 'utf8') > 32_768
    )
      return false
    if (current.value === null || typeof current.value !== 'object') continue
    if (seen.has(current.value)) return false

    seen.add(current.value)
    const children = Object.values(current.value)
    if (children.length > 4096 - entries - pending.length) return false
    for (const child of children)
      pending.push({ value: child, depth: current.depth + 1 })
  }

  if (!record(value) || !Array.isArray(value.fields)) return false
  const schemas = value.fields.map((field) => ({
    value: record(field) ? field.schema : undefined,
    depth: 1,
  }))
  let nodes = 0

  while (schemas.length) {
    const current = schemas.pop()!
    if (++nodes > 128 || current.depth > 6) return false
    if (!record(current.value)) continue

    if (current.value.type === 'array') {
      schemas.push({ value: current.value.items, depth: current.depth + 1 })
    } else if (
      current.value.type === 'object' &&
      Array.isArray(current.value.fields)
    ) {
      for (const field of current.value.fields)
        schemas.push({
          value: record(field) ? field.schema : undefined,
          depth: current.depth + 1,
        })
    }
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= 32_768
  } catch {
    return false
  }
}

export function parseStructDefinition(value: unknown) {
  if (!boundedDefinition(value)) return null

  const result = definitionSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseStructUpdate(value: unknown) {
  if (!boundedDefinition(value)) return null

  const result = updateSchema.safeParse(value)
  return result.success ? result.data : null
}
