import { z } from 'zod'
import { ApiError } from '../errors'
import type { DatabaseTable } from '../databases/model'
import type { Store } from './store'
import type { DatabaseRowPolicy } from './tenant-model'

const revision = z.number().int().positive().safe()
const policySchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('unprotected'),
      version: revision,
      resourceVersion: revision,
    })
    .strict(),
  z
    .object({
      mode: z.literal('tenant'),
      tables: z
        .array(
          z
            .object({
              table: z.string().min(1).max(128),
              column: z.string().min(1).max(64),
            })
            .strict(),
        )
        .min(1)
        .max(8),
      version: revision,
      resourceVersion: revision,
    })
    .strict(),
])

export function databaseRowPolicyService(store: Store) {
  const service = {
    database(id: string): DatabaseRowPolicy {
      const row = store
        .query<
          {
            mode: DatabaseRowPolicy['mode']
            version: number
            resource_version: number
            metadata: string
          },
          [string]
        >(
          'SELECT mode, database_row_policies.version, database_connections.version AS resource_version, metadata FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
        )
        .get(id)
      if (!row) throw new ApiError(404, 'Database connection not found')
      const columns = store
        .query<{ table_name: string; column_key: string }, [string]>(
          'SELECT table_name, column_key FROM database_tenant_columns WHERE resource_id = ?',
        )
        .all(id)
      return {
        mode: row.mode,
        version: row.version,
        resourceVersion: row.resource_version,
        tables: (JSON.parse(row.metadata) as DatabaseTable[]).map((table) => ({
          table: table.name,
          column:
            columns.find((entry) => entry.table_name === table.name)
              ?.column_key ?? null,
          textColumns: table.columns
            .filter((column) => column.type === 'string')
            .map((column) => column.key),
        })),
      }
    },
    updateDatabase(
      actor: string,
      id: string,
      value: unknown,
      authorize?: () => void,
    ) {
      const parsed = policySchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose valid table tenant columns and current versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.database(id)
          const input = parsed.data
          if (
            input.version !== current.version ||
            input.resourceVersion !== current.resourceVersion
          )
            throw new ApiError(
              409,
              'Database or row policy changed. Refresh before reviewing it.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (
            input.mode === 'tenant' &&
            (input.tables.length !== current.tables.length ||
              new Set(input.tables.map((table) => table.table)).size !==
                current.tables.length ||
              input.tables.some(
                (entry) =>
                  !current.tables
                    .find((table) => table.table === entry.table)
                    ?.textColumns.includes(entry.column),
              ))
          )
            throw new ApiError(
              400,
              'Choose an inspected text tenant column for every table',
            )
          store
            .query('DELETE FROM database_tenant_columns WHERE resource_id = ?')
            .run(id)
          if (input.mode === 'tenant') {
            for (const table of input.tables)
              store
                .query('INSERT INTO database_tenant_columns VALUES (?, ?, ?)')
                .run(id, table.table, table.column)
            store
              .query(
                'UPDATE row_protection_state SET backups_owner_only = 1 WHERE id = 1',
              )
              .run()
          }
          store
            .query(
              'UPDATE database_row_policies SET mode = ?, version = version + 1 WHERE resource_id = ?',
            )
            .run(input.mode, id)
          store.audit(actor, 'database-connection.row-policy.updated', id)
          return service.database(id)
        })
        .immediate()
    },
  }
  return service
}
