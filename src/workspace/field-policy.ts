import { ApiError } from '../errors'
import type { Store } from './store'
import type { FieldPolicy } from './tenant-model'
import { z } from 'zod'
import type { Flow, DataReadConfig } from '../flows/model'
import type { DatabaseReadConfig, DatabaseTable } from '../databases/model'

type FieldStore = Pick<Store, 'query'>

export function fieldPolicySchema(limit: number) {
  return z.discriminatedUnion('mode', [
    z
      .object({
        mode: z.literal('all'),
        columns: z.array(z.string()).length(0),
      })
      .strict(),
    z
      .object({
        mode: z.literal('selected'),
        columns: z
          .array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/))
          .max(limit)
          .refine((columns) => new Set(columns).size === columns.length),
      })
      .strict(),
  ])
}

export function validateFieldSelection(fields: FieldPolicy, keys: string[]) {
  if (fields.columns.some((key) => !keys.includes(key)))
    throw new ApiError(400, 'Choose existing API field columns')
}

export function sourceFields(store: FieldStore, id: string): FieldPolicy {
  const row = store
    .query<{ mode: string; columns: string; available: string }, [string]>(
      'SELECT mode, source_field_policies.columns, data_sources.columns AS available FROM source_field_policies JOIN data_sources ON resource_id = data_sources.id WHERE resource_id = ?',
    )
    .get(id)
  try {
    if (!row) throw new Error('Missing policy')
    const fields = fieldPolicySchema(64).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    const available = JSON.parse(row.available) as { key: string }[]
    if (
      !Array.isArray(available) ||
      available.some((column) => !column || typeof column.key !== 'string')
    )
      throw new Error('Invalid source columns')
    validateFieldSelection(
      fields,
      available.map((column) => column.key),
    )
    return fields
  } catch {
    throw new ApiError(503, 'Source field policy is unavailable')
  }
}

export function databaseFields(
  store: FieldStore,
  id: string,
  table: string,
  keys: string[],
): FieldPolicy {
  const row = store
    .query<{ mode: string; columns: string }, [string, string]>(
      'SELECT mode, columns FROM database_table_field_policies WHERE resource_id = ? AND table_name = ?',
    )
    .get(id, table)
  try {
    if (!row) throw new Error('Missing policy')
    const fields = fieldPolicySchema(32).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    validateFieldSelection(fields, keys)
    return fields
  } catch {
    throw new ApiError(503, 'Database field policy is unavailable')
  }
}

export function assertSourceFields(
  store: FieldStore,
  config: DataReadConfig,
  status = 403,
) {
  const policy = store
    .query<{ mode: string }, [string]>(
      'SELECT mode FROM source_row_policies WHERE resource_id = ?',
    )
    .get(config.sourceId)
  if (!policy || !['unprotected', 'tenant'].includes(policy.mode))
    throw new ApiError(503, 'Source row policy is unavailable')
  if (policy.mode !== 'tenant') return
  const fields = sourceFields(store, config.sourceId)
  const requested = [
    ...config.columns,
    ...(config.filter ? [config.filter.column] : []),
  ]
  if (
    fields.mode === 'selected' &&
    requested.some((key) => !fields.columns.includes(key))
  )
    throw new ApiError(
      status,
      'Resource field policy does not authorize this API read',
    )
}

export function assertGraphFields(
  store: FieldStore,
  flow: Flow,
  status = 403,
  allowMissing = false,
) {
  for (const node of flow.nodes) {
    if (
      allowMissing &&
      node.type === 'data' &&
      !store
        .query('SELECT id FROM data_sources WHERE id = ?')
        .get(node.config.sourceId)
    )
      continue
    if (
      allowMissing &&
      node.type === 'database' &&
      !store
        .query('SELECT id FROM database_connections WHERE id = ?')
        .get(node.config.connectionId)
    )
      continue
    if (node.type === 'data') assertSourceFields(store, node.config, status)
    else if (node.type === 'database')
      assertDatabaseFields(store, node.config, status)
  }
}

export function assertDatabaseFields(
  store: FieldStore,
  config: DatabaseReadConfig,
  status = 403,
) {
  const policy = store
    .query<{ mode: string; metadata: string }, [string]>(
      'SELECT mode, metadata FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
    )
    .get(config.connectionId)
  if (!policy || !['unprotected', 'tenant'].includes(policy.mode))
    throw new ApiError(503, 'Database row policy is unavailable')
  if (policy.mode !== 'tenant') return
  let fields: FieldPolicy
  try {
    const table = (JSON.parse(policy.metadata) as DatabaseTable[]).find(
      (entry) => entry.name === config.table,
    )
    if (!table) throw new Error('Missing table')
    fields = databaseFields(
      store,
      config.connectionId,
      config.table,
      table.columns.map((column) => column.key),
    )
  } catch {
    throw new ApiError(503, 'Database field policy is unavailable')
  }
  const requested = [
    ...config.columns,
    ...(config.filter ? [config.filter.column] : []),
  ]
  if (
    fields.mode === 'selected' &&
    requested.some((key) => !fields.columns.includes(key))
  )
    throw new ApiError(
      status,
      'Resource field policy does not authorize this API read',
    )
}
