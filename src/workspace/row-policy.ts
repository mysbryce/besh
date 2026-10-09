import { ApiError } from '../errors'
import type { DataColumn } from '../data/sources'
import { readProvenance, textColumns } from '../data/provenance'
import type { Store } from './store'
import type { SourceRowPolicy } from './tenant-model'
import { databaseRowPolicyService } from './database-row-policy'
import { z } from 'zod'
import {
  fieldPolicySchema,
  sourceFields,
  validateFieldSelection,
} from './field-policy'

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const sourcePolicySchema = z.discriminatedUnion('mode', [
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
      column: z.string().min(1).max(64),
      fields: fieldPolicySchema(64).optional(),
      version: revision,
      resourceVersion: revision,
    })
    .strict(),
])

export function rowPolicyService(store: Store) {
  const service = {
    ...databaseRowPolicyService(store),
    source(id: string): SourceRowPolicy {
      const row = store
        .query<
          {
            version: number
            columns: string
            row_count: number
            original_cells: Uint8Array | null
            mode: SourceRowPolicy['mode']
            policy_version: number
            tenant_column: string | null
          },
          [string]
        >(
          'SELECT data_sources.version, columns, row_count, original_cells, mode, source_row_policies.version AS policy_version, tenant_column FROM data_sources JOIN source_row_policies ON resource_id = data_sources.id WHERE data_sources.id = ?',
        )
        .get(id)
      if (!row) throw new ApiError(404, 'Data source not found')
      const provenance = readProvenance(
        row.original_cells,
        JSON.parse(row.columns) as DataColumn[],
        row.row_count,
      )
      return {
        mode: row.mode,
        version: row.policy_version,
        resourceVersion: row.version,
        column: row.tenant_column,
        fields: sourceFields(store, id),
        provenance: {
          status: provenance ? 'available' : 'requires-reimport',
          textColumns: provenance ? textColumns(provenance) : [],
        },
      }
    },
    updateSource(
      actor: string,
      id: string,
      value: unknown,
      authorize?: () => void,
    ) {
      const parsed = sourcePolicySchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose a valid source row policy and current versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.source(id)
          const input = parsed.data
          if (
            input.version !== current.version ||
            input.resourceVersion !== current.resourceVersion
          )
            throw new ApiError(
              409,
              'Source or row policy changed. Refresh before reviewing it.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (
            input.mode === 'tenant' &&
            current.provenance.status !== 'available'
          )
            throw new ApiError(
              409,
              'Reimport or refresh this source to capture original tenant text',
            )
          if (
            input.mode === 'tenant' &&
            !current.provenance.textColumns.includes(input.column)
          )
            throw new ApiError(
              400,
              'Choose a column containing only safe original text or null cells',
            )
          if (input.mode === 'tenant' && input.fields) {
            const row = store
              .query<{ columns: string }, [string]>(
                'SELECT columns FROM data_sources WHERE id = ?',
              )
              .get(id)!
            validateFieldSelection(
              input.fields,
              (JSON.parse(row.columns) as DataColumn[]).map(
                (column) => column.key,
              ),
            )
            store
              .query(
                'UPDATE source_field_policies SET mode = ?, columns = ? WHERE resource_id = ?',
              )
              .run(input.fields.mode, JSON.stringify(input.fields.columns), id)
          }
          store
            .query(
              'UPDATE source_row_policies SET mode = ?, tenant_column = ?, version = version + 1 WHERE resource_id = ?',
            )
            .run(input.mode, input.mode === 'tenant' ? input.column : null, id)
          if (input.mode === 'tenant')
            store
              .query(
                'UPDATE row_protection_state SET backups_owner_only = 1 WHERE id = 1',
              )
              .run()
          store.audit(actor, 'data-source.row-policy.updated', id)
          return service.source(id)
        })
        .immediate()
    },
  }
  return service
}
