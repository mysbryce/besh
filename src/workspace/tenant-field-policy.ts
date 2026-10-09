import { ApiError } from '../errors'
import type { DataColumn } from '../data/sources'
import type { Store } from './store'
import type {
  SourceTenantFieldProfile,
  DatabaseTenantFieldProfile,
  FieldProfile,
  TenantFieldProfileSummary,
} from './tenant-field-model'
import type { Tenant } from './tenant-model'
import { databaseFields, fieldPolicySchema, sourceFields } from './field-policy'
import type { DatabaseTable, DatabaseReadConfig } from '../databases/model'
import { z } from 'zod'
import type { Flow, DataReadConfig } from '../flows/model'

type ProfileStore = Pick<Store, 'query'>

const version = z.number().int().positive().safe()

function fieldProfileSchema(limit: number) {
  return z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('inherit') }).strict(),
    fieldPolicySchema(limit).options[1],
  ])
}

const sourceInput = z
  .object({
    version,
    resourceVersion: version,
    tenantVersion: version,
    fields: fieldProfileSchema(64),
  })
  .strict()

const databaseInput = z
  .object({
    version,
    resourceVersion: version,
    tenantVersion: version,
    tables: z
      .array(
        z
          .object({
            table: z.string().min(1).max(128),
            fields: fieldProfileSchema(32),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

function tenantMetadata(store: ProfileStore, id: string, missingStatus = 404) {
  const tenant = store
    .query<Pick<Tenant, 'id' | 'label' | 'state' | 'version'>, [string]>(
      'SELECT id, label, state, version FROM tenants WHERE id = ?',
    )
    .get(id)
  if (!tenant)
    throw new ApiError(
      missingStatus,
      missingStatus === 503
        ? 'Tenant field profile is unavailable'
        : 'Tenant identity not found',
    )
  return tenant
}

export function sourceTenantProfile(
  store: ProfileStore,
  id: string,
  tenantId: string,
  keys: string[],
): FieldProfile {
  const row = store
    .query<{ mode: string; columns: string }, [string, string]>(
      'SELECT mode, columns FROM source_tenant_field_profiles WHERE resource_id = ? AND tenant_id = ?',
    )
    .get(id, tenantId)
  if (!row) return { mode: 'inherit' }
  try {
    const parsed = fieldPolicySchema(64).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    if (
      parsed.mode !== 'selected' ||
      parsed.columns.some((key) => !keys.includes(key))
    )
      throw new Error('Invalid profile')
    return parsed
  } catch {
    throw new ApiError(503, 'Tenant field profile is unavailable')
  }
}

export function databaseTenantProfile(
  store: ProfileStore,
  id: string,
  table: string,
  tenantId: string,
  keys: string[],
): FieldProfile {
  const row = store
    .query<{ mode: string; columns: string }, [string, string, string]>(
      'SELECT mode, columns FROM database_tenant_field_profiles WHERE resource_id = ? AND table_name = ? AND tenant_id = ?',
    )
    .get(id, table, tenantId)
  if (!row) return { mode: 'inherit' }
  try {
    const parsed = fieldPolicySchema(32).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    if (
      parsed.mode !== 'selected' ||
      parsed.columns.some((key) => !keys.includes(key))
    )
      throw new Error('Invalid profile')
    return parsed
  } catch {
    throw new ApiError(503, 'Tenant field profile is unavailable')
  }
}

export function assertRetainedSourceProfiles(
  store: ProfileStore,
  id: string,
  currentKeys: string[],
  nextKeys: string[],
) {
  const profiles = store
    .query<{ tenant_id: string }, [string]>(
      'SELECT tenant_id FROM source_tenant_field_profiles WHERE resource_id = ?',
    )
    .all(id)
  for (const row of profiles) {
    const profile = sourceTenantProfile(store, id, row.tenant_id, currentKeys)
    if (
      profile.mode === 'selected' &&
      profile.columns.some((key) => !nextKeys.includes(key))
    )
      throw new ApiError(
        409,
        'Replacement must preserve tenant-profile API field columns. Review tenant profiles first.',
      )
  }
}

export function tenantFieldPolicyService(store: Store) {
  const service = {
    sourceSummary(id: string): TenantFieldProfileSummary {
      return store.db.transaction(() => {
        const row = store
          .query<
            { version: number; resource_version: number; columns: string },
            [string]
          >(
            'SELECT source_row_policies.version, data_sources.version AS resource_version, data_sources.columns FROM data_sources JOIN source_row_policies ON resource_id = data_sources.id WHERE data_sources.id = ?',
          )
          .get(id)
        if (!row) throw new ApiError(404, 'Data source not found')
        const keys = (JSON.parse(row.columns) as DataColumn[]).map(
          (column) => column.key,
        )
        const profiles = store
          .query<{ tenant_id: string }, [string]>(
            'SELECT tenant_id FROM source_tenant_field_profiles WHERE resource_id = ? ORDER BY tenant_id LIMIT 257',
          )
          .all(id)
        if (profiles.length > 256)
          throw new ApiError(503, 'Tenant field profiles are unavailable')
        for (const profile of profiles) {
          tenantMetadata(store, profile.tenant_id, 503)
          sourceTenantProfile(store, id, profile.tenant_id, keys)
        }
        return {
          version: row.version,
          resourceVersion: row.resource_version,
          configuredTenantIds: profiles.map((profile) => profile.tenant_id),
        }
      })()
    },
    databaseSummary(id: string): TenantFieldProfileSummary {
      return store.db.transaction(() => {
        const row = store
          .query<
            { version: number; resource_version: number; metadata: string },
            [string]
          >(
            'SELECT database_row_policies.version, database_connections.version AS resource_version, metadata FROM database_connections JOIN database_row_policies ON resource_id = database_connections.id WHERE database_connections.id = ?',
          )
          .get(id)
        if (!row) throw new ApiError(404, 'Database connection not found')
        const metadata = JSON.parse(row.metadata) as DatabaseTable[]
        const profiles = store
          .query<{ tenant_id: string; table_name: string }, [string]>(
            'SELECT tenant_id, table_name FROM database_tenant_field_profiles WHERE resource_id = ? ORDER BY tenant_id, table_name LIMIT 2049',
          )
          .all(id)
        if (profiles.length > 2048)
          throw new ApiError(503, 'Tenant field profiles are unavailable')
        const ids = [...new Set(profiles.map((profile) => profile.tenant_id))]
        if (ids.length > 256)
          throw new ApiError(503, 'Tenant field profiles are unavailable')
        for (const profile of profiles) {
          tenantMetadata(store, profile.tenant_id, 503)
          const table = metadata.find(
            (entry) => entry.name === profile.table_name,
          )
          if (!table)
            throw new ApiError(503, 'Tenant field profile is unavailable')
          databaseTenantProfile(
            store,
            id,
            table.name,
            profile.tenant_id,
            table.columns.map((column) => column.key),
          )
        }
        return {
          version: row.version,
          resourceVersion: row.resource_version,
          configuredTenantIds: ids,
        }
      })()
    },
    database(id: string, tenantId: string): DatabaseTenantFieldProfile {
      return store.db.transaction(() => {
        const row = store
          .query<
            {
              mode: 'unprotected' | 'tenant'
              version: number
              resource_version: number
              metadata: string
            },
            [string]
          >(
            'SELECT mode, database_row_policies.version, database_connections.version AS resource_version, metadata FROM database_connections JOIN database_row_policies ON resource_id = database_connections.id WHERE database_connections.id = ?',
          )
          .get(id)
        if (!row) throw new ApiError(404, 'Database connection not found')
        const tenant = tenantMetadata(store, tenantId)
        const tables = (JSON.parse(row.metadata) as DatabaseTable[]).map(
          (table) => {
            const keys = table.columns.map((column) => column.key)
            const profile = databaseTenantProfile(
              store,
              id,
              table.name,
              tenantId,
              keys,
            )
            const globalFields = databaseFields(store, id, table.name, keys)
            return {
              table: table.name,
              configured: profile.mode === 'selected',
              profile,
              globalFields,
              effectiveColumns: keys.filter(
                (key) =>
                  (globalFields.mode === 'all' ||
                    globalFields.columns.includes(key)) &&
                  (profile.mode === 'inherit' || profile.columns.includes(key)),
              ),
            }
          },
        )
        return {
          mode: row.mode,
          version: row.version,
          resourceVersion: row.resource_version,
          tenant,
          active: row.mode === 'tenant' && tenant.state === 'active',
          configured: tables.some((table) => table.configured),
          tables,
        }
      })()
    },
    updateDatabase(
      actor: string,
      id: string,
      tenantId: string,
      value: unknown,
      authorize?: () => void,
    ) {
      const input = databaseInput.safeParse(value)
      if (!input.success)
        throw new ApiError(
          400,
          'Choose complete table field profiles and current review versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.database(id, tenantId)
          if (
            current.version !== input.data.version ||
            current.resourceVersion !== input.data.resourceVersion ||
            current.tenant.version !== input.data.tenantVersion
          )
            throw new ApiError(
              409,
              'Resource, row policy, or tenant changed. Refresh before reviewing this profile.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (
            input.data.tables.length !== current.tables.length ||
            new Set(input.data.tables.map((table) => table.table)).size !==
              current.tables.length ||
            input.data.tables.some(
              (table) =>
                !current.tables.some((known) => table.table === known.table),
            )
          )
            throw new ApiError(400, 'Review every inspected table exactly once')
          const row = store
            .query<{ metadata: string }, [string]>(
              'SELECT metadata FROM database_connections WHERE id = ?',
            )
            .get(id)!
          const metadata = JSON.parse(row.metadata) as DatabaseTable[]
          for (const table of input.data.tables) {
            if (table.fields.mode === 'selected') {
              const keys = metadata
                .find((known) => known.name === table.table)!
                .columns.map((column) => column.key)
              if (table.fields.columns.some((key) => !keys.includes(key)))
                throw new ApiError(400, 'Choose existing API field columns')
              store
                .query(
                  `INSERT INTO database_tenant_field_profiles VALUES (?, ?, ?, 'selected', ?)
              ON CONFLICT(resource_id, table_name, tenant_id) DO UPDATE SET columns = excluded.columns`,
                )
                .run(
                  id,
                  table.table,
                  tenantId,
                  JSON.stringify(table.fields.columns),
                )
            } else {
              store
                .query(
                  'DELETE FROM database_tenant_field_profiles WHERE resource_id = ? AND table_name = ? AND tenant_id = ?',
                )
                .run(id, table.table, tenantId)
            }
          }
          store
            .query(
              'UPDATE database_row_policies SET version = version + 1 WHERE resource_id = ?',
            )
            .run(id)
          store.audit(
            actor,
            'database-connection.tenant-fields.updated',
            `${id}:${tenantId}`,
          )
          return service.database(id, tenantId)
        })
        .immediate()
    },
    source(id: string, tenantId: string): SourceTenantFieldProfile {
      return store.db.transaction(() => {
        const row = store
          .query<
            {
              mode: 'unprotected' | 'tenant'
              version: number
              resource_version: number
              columns: string
            },
            [string]
          >(
            'SELECT mode, source_row_policies.version, data_sources.version AS resource_version, data_sources.columns FROM data_sources JOIN source_row_policies ON resource_id = data_sources.id WHERE data_sources.id = ?',
          )
          .get(id)
        if (!row) throw new ApiError(404, 'Data source not found')
        const tenant = tenantMetadata(store, tenantId)
        const keys = (JSON.parse(row.columns) as DataColumn[]).map(
          (column) => column.key,
        )
        const profile = sourceTenantProfile(store, id, tenantId, keys)
        const globalFields = sourceFields(store, id)
        return {
          mode: row.mode,
          version: row.version,
          resourceVersion: row.resource_version,
          tenant,
          active: row.mode === 'tenant' && tenant.state === 'active',
          configured: profile.mode === 'selected',
          profile,
          globalFields,
          effectiveColumns: keys.filter(
            (key) =>
              (globalFields.mode === 'all' ||
                globalFields.columns.includes(key)) &&
              (profile.mode === 'inherit' || profile.columns.includes(key)),
          ),
        }
      })()
    },
    updateSource(
      actor: string,
      id: string,
      tenantId: string,
      value: unknown,
      authorize?: () => void,
    ) {
      const input = sourceInput.safeParse(value)
      if (!input.success)
        throw new ApiError(
          400,
          'Choose a valid tenant field profile and current review versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.source(id, tenantId)
          if (
            current.version !== input.data.version ||
            current.resourceVersion !== input.data.resourceVersion ||
            current.tenant.version !== input.data.tenantVersion
          )
            throw new ApiError(
              409,
              'Resource, row policy, or tenant changed. Refresh before reviewing this profile.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (input.data.fields.mode === 'selected') {
            const row = store
              .query<{ columns: string }, [string]>(
                'SELECT columns FROM data_sources WHERE id = ?',
              )
              .get(id)!
            const keys = (JSON.parse(row.columns) as DataColumn[]).map(
              (column) => column.key,
            )
            if (input.data.fields.columns.some((key) => !keys.includes(key)))
              throw new ApiError(400, 'Choose existing API field columns')
            store
              .query(
                `INSERT INTO source_tenant_field_profiles VALUES (?, ?, 'selected', ?)
            ON CONFLICT(resource_id, tenant_id) DO UPDATE SET columns = excluded.columns`,
              )
              .run(id, tenantId, JSON.stringify(input.data.fields.columns))
          } else {
            store
              .query(
                'DELETE FROM source_tenant_field_profiles WHERE resource_id = ? AND tenant_id = ?',
              )
              .run(id, tenantId)
          }
          store
            .query(
              'UPDATE source_row_policies SET version = version + 1 WHERE resource_id = ?',
            )
            .run(id)
          store.audit(
            actor,
            'data-source.tenant-fields.updated',
            `${id}:${tenantId}`,
          )
          return service.source(id, tenantId)
        })
        .immediate()
    },
  }
  return service
}

export function assertSourceTenantFields(
  store: ProfileStore,
  config: DataReadConfig,
  tenantId?: string,
  status = 403,
) {
  const row = store
    .query<{ mode: string; columns: string }, [string]>(
      'SELECT mode, data_sources.columns FROM source_row_policies JOIN data_sources ON resource_id = data_sources.id WHERE resource_id = ?',
    )
    .get(config.sourceId)
  if (!row || !['unprotected', 'tenant'].includes(row.mode))
    throw new ApiError(503, 'Source row policy is unavailable')
  if (row.mode !== 'tenant') return
  if (!tenantId)
    throw new ApiError(status, 'A trusted tenant identity is required')
  const keys = (JSON.parse(row.columns) as DataColumn[]).map(
    (column) => column.key,
  )
  const profile = sourceTenantProfile(store, config.sourceId, tenantId, keys)
  const requested = [
    ...config.columns,
    ...(config.filter ? [config.filter.column] : []),
  ]
  if (
    profile.mode === 'selected' &&
    (!profile.columns.length ||
      requested.some((key) => !profile.columns.includes(key)))
  )
    throw new ApiError(
      status,
      'Tenant field profile does not authorize this API read',
    )
}

export function assertTenantGraphFields(
  store: ProfileStore,
  flow: Flow,
  tenantId: string,
  status = 403,
) {
  for (const node of flow.nodes)
    if (node.type === 'data')
      assertSourceTenantFields(store, node.config, tenantId, status)
    else if (node.type === 'database')
      assertDatabaseTenantFields(store, node.config, tenantId, status)
}

export function assertDatabaseTenantFields(
  store: ProfileStore,
  config: DatabaseReadConfig,
  tenantId?: string,
  status = 403,
) {
  const row = store
    .query<{ mode: string; metadata: string }, [string]>(
      'SELECT mode, metadata FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
    )
    .get(config.connectionId)
  if (!row || !['unprotected', 'tenant'].includes(row.mode))
    throw new ApiError(503, 'Database row policy is unavailable')
  if (row.mode !== 'tenant') return
  if (!tenantId)
    throw new ApiError(status, 'A trusted tenant identity is required')
  const table = (JSON.parse(row.metadata) as DatabaseTable[]).find(
    (entry) => entry.name === config.table,
  )
  if (!table) throw new ApiError(503, 'Database field policy is unavailable')
  const profile = databaseTenantProfile(
    store,
    config.connectionId,
    config.table,
    tenantId,
    table.columns.map((column) => column.key),
  )
  const requested = [
    ...config.columns,
    ...(config.filter ? [config.filter.column] : []),
  ]
  if (
    profile.mode === 'selected' &&
    (!profile.columns.length ||
      requested.some((key) => !profile.columns.includes(key)))
  )
    throw new ApiError(
      status,
      'Tenant field profile does not authorize this API read',
    )
}
