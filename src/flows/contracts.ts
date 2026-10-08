import { z } from 'zod'
import { ApiError } from '../errors'

type SchemaDetails = { nullable?: boolean; description?: string }
export type ApiSchema = SchemaDetails &
  (
    | {
        type: 'object'
        properties?: Record<string, ApiSchema>
        required?: string[]
        additionalProperties?: boolean
      }
    | { type: 'array'; items: ApiSchema; minItems?: number; maxItems?: number }
    | { type: 'string'; minLength?: number; maxLength?: number }
    | { type: 'number' | 'integer'; minimum?: number; maximum?: number }
    | { type: 'boolean' }
  )
export type ApiContract = {
  params?: ApiSchema
  query?: ApiSchema
  body?: ApiSchema
  response?: ApiSchema
}

const details = {
  nullable: z.boolean().optional(),
  description: z.string().max(500).optional(),
}
const natural = z.number().int().min(0).optional()
const fieldName = z
  .string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/)
  .refine((name) => !['__proto__', 'prototype', 'constructor'].includes(name))
const propertiesSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (
      value &&
      typeof value === 'object' &&
      Object.keys(value).some((name) => !fieldName.safeParse(name).success)
    )
      context.addIssue({ code: 'custom', message: 'Use safe API field names' })
  })
  .pipe(
    z.record(
      fieldName,
      z.lazy(() => apiSchema),
    ),
  )

export const apiSchema: z.ZodType<ApiSchema> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        ...details,
        type: z.literal('object'),
        properties: propertiesSchema.optional(),
        required: z.array(fieldName).max(64).optional(),
        additionalProperties: z.boolean().optional(),
      })
      .strict(),
    z
      .object({
        ...details,
        type: z.literal('array'),
        items: apiSchema,
        minItems: natural,
        maxItems: natural,
      })
      .strict(),
    z
      .object({
        ...details,
        type: z.literal('string'),
        minLength: natural,
        maxLength: natural,
      })
      .strict(),
    z
      .object({
        ...details,
        type: z.literal('number'),
        minimum: z.number().finite().optional(),
        maximum: z.number().finite().optional(),
      })
      .strict(),
    z
      .object({
        ...details,
        type: z.literal('integer'),
        minimum: z.number().finite().optional(),
        maximum: z.number().finite().optional(),
      })
      .strict(),
    z.object({ ...details, type: z.literal('boolean') }).strict(),
  ]),
)

export const contractSchema = z
  .object({
    params: apiSchema.optional(),
    query: apiSchema.optional(),
    body: apiSchema.optional(),
    response: apiSchema.optional(),
  })
  .strict()
  .superRefine((contract, context) => {
    let nodes = 0
    let invalid =
      new TextEncoder().encode(JSON.stringify(contract)).length > 16_384

    function visit(schema: ApiSchema, depth: number) {
      nodes++
      if (depth > 8 || nodes > 256) invalid = true
      if (schema.type === 'object') {
        const properties = schema.properties ?? {}
        const names = Object.keys(properties)
        const required = schema.required ?? []
        if (
          names.length > 64 ||
          names.some(
            (name) =>
              !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name) ||
              ['__proto__', 'prototype', 'constructor'].includes(name),
          ) ||
          new Set(required).size !== required.length ||
          required.some((name) => !Object.hasOwn(properties, name))
        )
          invalid = true
        for (const item of Object.values(properties)) visit(item, depth + 1)
      } else if (schema.type === 'array') {
        if (
          schema.minItems !== undefined &&
          schema.maxItems !== undefined &&
          schema.minItems > schema.maxItems
        )
          invalid = true
        visit(schema.items, depth + 1)
      } else if (schema.type === 'string') {
        if (
          schema.minLength !== undefined &&
          schema.maxLength !== undefined &&
          schema.minLength > schema.maxLength
        )
          invalid = true
      } else if (schema.type === 'number' || schema.type === 'integer') {
        if (
          schema.minimum !== undefined &&
          schema.maximum !== undefined &&
          (schema.minimum > schema.maximum ||
            (schema.type === 'integer' &&
              Math.ceil(schema.minimum) > Math.floor(schema.maximum)))
        )
          invalid = true
      }
    }

    for (const schema of Object.values(contract)) if (schema) visit(schema, 1)
    for (const query of [contract.query, contract.params]) {
      if (
        query &&
        (query.type !== 'object' ||
          query.nullable ||
          Object.values(query.properties ?? {}).some(
            (schema) =>
              schema.type === 'object' ||
              schema.type === 'array' ||
              schema.nullable,
          ))
      )
        invalid = true
    }
    if (invalid)
      context.addIssue({
        code: 'custom',
        message: 'Invalid or oversized API rules',
      })
  })

function mismatch(path: string, expected: string): never {
  throw new ApiError(
    400,
    `Input ${path.slice(0, 160)} must match ${expected} rules`,
  )
}

export function checkValue(
  schema: ApiSchema,
  value: unknown,
  path: string,
): void {
  if (value === null && schema.nullable) return
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      mismatch(path, 'object')
    const object = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(object, key))
        mismatch(`${path}.${key}`, 'required field')
    }
    for (const [key, item] of Object.entries(object)) {
      if (Object.hasOwn(schema.properties ?? {}, key))
        checkValue(schema.properties![key], item, `${path}.${key}`)
      else if (schema.additionalProperties === false)
        mismatch(path, 'declared fields')
    }
    return
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) mismatch(path, 'array')
    if (
      (schema.minItems !== undefined && value.length < schema.minItems) ||
      (schema.maxItems !== undefined && value.length > schema.maxItems)
    )
      mismatch(path, 'array length')
    value.forEach((item, index) =>
      checkValue(schema.items, item, `${path}[${index}]`),
    )
    return
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') mismatch(path, 'string')
    const length = [...value].length
    if (
      (schema.minLength !== undefined && length < schema.minLength) ||
      (schema.maxLength !== undefined && length > schema.maxLength)
    )
      mismatch(path, 'string length')
    return
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') mismatch(path, 'boolean')
    return
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (schema.type === 'integer' && !Number.isInteger(value))
  )
    mismatch(path, schema.type)
  if (
    (schema.minimum !== undefined && value < schema.minimum) ||
    (schema.maximum !== undefined && value > schema.maximum)
  )
    mismatch(path, 'numeric bounds')
}

export function prepareInput(
  contract: ApiContract | undefined,
  input: {
    body: unknown
    query: Record<string, string>
    params?: Record<string, string>
  },
) {
  if (!contract) return input
  function coerce(
    rules: ApiSchema | undefined,
    values: Record<string, string>,
    location: string,
  ) {
    const query: Record<string, string | number | boolean> = { ...values }
    if (rules?.type !== 'object') return query
    for (const [name, schema] of Object.entries(rules.properties ?? {})) {
      if (!Object.hasOwn(query, name)) continue
      const value = query[name]
      if (schema.type === 'number' || schema.type === 'integer') {
        if (
          typeof value !== 'string' ||
          !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
        )
          mismatch(`${location}.${name}`, schema.type)
        query[name] = Number(value)
      } else if (schema.type === 'boolean') {
        if (value !== 'true' && value !== 'false')
          mismatch(`${location}.${name}`, 'boolean')
        query[name] = value === 'true'
      }
    }
    checkValue(rules, query, location)
    return query
  }
  const query = coerce(contract.query, input.query, 'query')
  const params = coerce(contract.params, input.params ?? {}, 'params')
  if (contract.body) checkValue(contract.body, input.body, 'body')
  return {
    body: input.body,
    query,
    params,
  }
}
