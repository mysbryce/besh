import { z } from 'zod'
import { ApiError } from '../errors'
import type { DatabaseConnection } from './model'
import { flowSchema } from '../flows/model'

export function databaseApi(connection: DatabaseConnection, value: unknown) {
  const parsed = z
    .object({
      version: z.number().int().positive().safe(),
      table: z.string().min(1).max(128),
      name: z.string().trim().min(1).max(80),
      path: z
        .string()
        .max(160)
        .regex(/^\/[a-zA-Z0-9/_-]+$/),
      protocol: z.enum(['rest', 'graphql']),
      columns: z
        .array(z.string())
        .min(1)
        .max(32)
        .refine((keys) => new Set(keys).size === keys.length),
      filter: z
        .object({
          column: z.string(),
          inputName: z
            .string()
            .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)
            .refine(
              (name) =>
                !['constructor', 'prototype', '__proto__'].includes(name),
            ),
        })
        .strict()
        .optional(),
      limit: z.number().int().min(1).max(100),
    })
    .strict()
    .safeParse(value)
  if (!parsed.success)
    throw new ApiError(
      400,
      'Choose a version, table, API name, path, columns, and bounded row limit',
    )
  const options = parsed.data
  if (connection.version !== options.version)
    throw new ApiError(
      409,
      'Database connection changed. Reload before continuing.',
    )
  const table = connection.tables.find((item) => item.name === options.table)
  if (
    !table ||
    options.columns.some(
      (key) => !table.columns.some((column) => column.key === key),
    )
  )
    throw new ApiError(400, 'Choose inspected table columns')
  const filterColumn = options.filter
    ? table.columns.find((column) => column.key === options.filter!.column)
    : undefined
  if (options.filter && !filterColumn)
    throw new ApiError(400, 'Choose an inspected filter column')
  const graphql = options.protocol === 'graphql'
  const fields = options.columns.map((key) =>
    table.columns.find((column) => column.key === key)!,
  )
  const gqlType = (type: string) =>
    ({ string: 'String', number: 'Float', boolean: 'Boolean' })[
      type as 'string'
    ]
  const argumentsList =
    filterColumn && options.filter
      ? `(${options.filter.inputName}: ${gqlType(filterColumn.type)})`
      : ''
  return flowSchema.parse({
    name: options.name,
    method: graphql ? 'POST' : 'GET',
    path: options.path,
    ...(graphql
      ? {
          graphql: {
            schema: `type Query { rows${argumentsList}: [DatabaseRow!]! }\ntype DatabaseRow { ${fields.map((column) => `${column.key}: ${gqlType(column.type)}${column.nullable ? '' : '!'}`).join(' ')} }`,
          },
        }
      : {
          contract: {
            ...(filterColumn && options.filter
              ? {
                  query: {
                    type: 'object',
                    properties: {
                      [options.filter.inputName]: { type: filterColumn.type },
                    },
                  },
                }
              : {}),
            response: {
              type: 'array',
              maxItems: options.limit,
              items: {
                type: 'object',
                properties: Object.fromEntries(
                  fields.map((column) => [
                    column.key,
                    { type: column.type, nullable: column.nullable },
                  ]),
                ),
                required: options.columns,
                additionalProperties: false,
              },
            },
          },
        }),
    nodes: [
      {
        id: 'request',
        type: 'request',
        position: { x: 80, y: 100 },
        config: {},
      },
      {
        id: 'database',
        type: 'database',
        position: { x: 360, y: 100 },
        config: {
          connectionId: connection.id,
          table: options.table,
          columns: options.columns,
          limit: options.limit,
          ...(options.filter
            ? {
                filter: {
                  column: options.filter.column,
                  value: `$input.${graphql ? 'body' : 'query'}.${options.filter.inputName}`,
                },
              }
            : {}),
        },
      },
      {
        id: 'response',
        type: 'response',
        position: { x: 640, y: 100 },
        config: { status: 200, body: '$data' },
      },
    ],
    edges: [
      { id: 'request-database', source: 'request', target: 'database' },
      { id: 'database-response', source: 'database', target: 'response' },
    ],
  })
}
