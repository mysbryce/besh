import { ApiError } from '../errors'
import type { DataColumn } from '../data/sources'
import type { Store } from './store'
import type { DataReadConfig, Flow } from '../flows/model'
import { databaseFields, fieldPolicySchema, sourceFields } from './field-policy'
import { tenantFieldPolicyService } from './tenant-field-policy'
import type {
  DatabaseMemberFieldProfile,
  MemberFieldProfileSummary,
  SourceMemberFieldProfile,
} from './member-field-model'
import type { DatabaseReadConfig, DatabaseTable } from '../databases/model'
import type { FieldProfile } from './tenant-field-model'
import { z } from 'zod'

const version = z.number().int().positive().safe()
const sourceInput = z
  .object({
    version,
    resourceVersion: version,
    memberAccessVersion: version,
    tenantAssignmentVersion: version,
    tenantVersion: version.nullable(),
    roleId: z.string().min(1).max(80).nullable(),
    roleVersion: z.number().int().min(0).safe(),
    fields: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('inherit') }).strict(),
      fieldPolicySchema(64).options[1],
    ]),
  })
  .strict()

const databaseInput = sourceInput.omit({ fields: true }).extend({
  tables: z
    .array(
      z
        .object({
          table: z.string().min(1).max(128),
          fields: z.discriminatedUnion('mode', [
            z.object({ mode: z.literal('inherit') }).strict(),
            fieldPolicySchema(32).options[1],
          ]),
        })
        .strict(),
    )
    .min(1)
    .max(8),
})

function databaseMemberProfile(
  store: Pick<Store, 'query'>,
  id: string,
  table: string,
  memberId: string,
  keys: string[],
): FieldProfile {
  const row = store
    .query<{ mode: string; columns: string }, [string, string, string]>(
      'SELECT mode, columns FROM database_member_field_profiles WHERE resource_id = ? AND table_name = ? AND member_id = ?',
    )
    .get(id, table, memberId)
  if (!row) return { mode: 'inherit' }
  try {
    const profile = fieldPolicySchema(32).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    if (
      profile.mode !== 'selected' ||
      profile.columns.some((key) => !keys.includes(key))
    )
      throw new Error('Invalid profile')
    return profile
  } catch {
    throw new ApiError(503, 'Member field profile is unavailable')
  }
}

function sourceMemberProfile(
  store: Pick<Store, 'query'>,
  id: string,
  memberId: string,
  keys: string[],
): FieldProfile {
  const row = store
    .query<{ mode: string; columns: string }, [string, string]>(
      'SELECT mode, columns FROM source_member_field_profiles WHERE resource_id = ? AND member_id = ?',
    )
    .get(id, memberId)
  if (!row) return { mode: 'inherit' }
  try {
    const profile = fieldPolicySchema(64).parse({
      mode: row.mode,
      columns: JSON.parse(row.columns),
    })
    if (
      profile.mode !== 'selected' ||
      profile.columns.some((key) => !keys.includes(key))
    )
      throw new Error('Invalid profile')
    return profile
  } catch {
    throw new ApiError(503, 'Member field profile is unavailable')
  }
}

export function assertRetainedSourceMemberProfiles(
  store: Pick<Store, 'query'>,
  id: string,
  currentKeys: string[],
  nextKeys: string[],
) {
  const profiles = store
    .query<{ member_id: string }, [string]>(
      'SELECT member_id FROM source_member_field_profiles WHERE resource_id = ? LIMIT 257',
    )
    .all(id)
  if (profiles.length > 256)
    throw new ApiError(503, 'Member field profiles are unavailable')
  for (const row of profiles) {
    const profile = sourceMemberProfile(store, id, row.member_id, currentKeys)
    if (
      profile.mode === 'selected' &&
      profile.columns.some((key) => !nextKeys.includes(key))
    )
      throw new ApiError(
        409,
        'Replacement must preserve member-profile API field columns. Review member profiles first.',
      )
  }
}

export function assertSourceMemberFields(
  store: Pick<Store, 'query' | 'member'>,
  config: DataReadConfig,
  memberId: string | null | undefined,
  status = 403,
) {
  const row = store
    .query<{ mode: string; columns: string }, [string]>(
      'SELECT mode, data_sources.columns FROM source_row_policies JOIN data_sources ON resource_id = data_sources.id WHERE resource_id = ?',
    )
    .get(config.sourceId)
  if (!row || !['unprotected', 'tenant'].includes(row.mode))
    throw new ApiError(503, 'Source row policy is unavailable')
  if (row.mode !== 'tenant' || !memberId) return
  const member = store.member(memberId)
  if (!member)
    throw new ApiError(
      status,
      'Original member no longer authorizes this API read',
    )
  if (member.role === 'owner') return
  const keys = (JSON.parse(row.columns) as DataColumn[]).map(
    (column) => column.key,
  )
  const profile = sourceMemberProfile(store, config.sourceId, memberId, keys)
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
      'Member field profile does not authorize this API read',
    )
}

export function assertMemberGraphFields(
  store: Pick<Store, 'query' | 'member'>,
  flow: Flow,
  memberId: string | null,
  status = 403,
) {
  for (const node of flow.nodes)
    if (node.type === 'data')
      assertSourceMemberFields(store, node.config, memberId, status)
    else if (node.type === 'database')
      assertDatabaseMemberFields(store, node.config, memberId, status)
}

export function assertDatabaseMemberFields(
  store: Pick<Store, 'query' | 'member'>,
  config: DatabaseReadConfig,
  memberId: string | null | undefined,
  status = 403,
) {
  const row = store
    .query<{ mode: string; metadata: string }, [string]>(
      'SELECT mode, metadata FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
    )
    .get(config.connectionId)
  if (!row || !['unprotected', 'tenant'].includes(row.mode))
    throw new ApiError(503, 'Database row policy is unavailable')
  if (row.mode !== 'tenant' || !memberId) return
  const member = store.member(memberId)
  if (!member)
    throw new ApiError(
      status,
      'Original member no longer authorizes this API read',
    )
  if (member.role === 'owner') return
  const table = (JSON.parse(row.metadata) as DatabaseTable[]).find(
    (entry) => entry.name === config.table,
  )
  if (!table) throw new ApiError(503, 'Database field policy is unavailable')
  const profile = databaseMemberProfile(
    store,
    config.connectionId,
    config.table,
    memberId,
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
      'Member field profile does not authorize this API read',
    )
}

export function memberFieldPolicyService(store: Store) {
  const tenantFields = tenantFieldPolicyService(store)

  const service = {
    sourceSummary(id: string): MemberFieldProfileSummary {
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
        const profiles = store
          .query<{ member_id: string }, [string]>(
            'SELECT member_id FROM source_member_field_profiles WHERE resource_id = ? ORDER BY member_id LIMIT 257',
          )
          .all(id)
        if (profiles.length > 256)
          throw new ApiError(503, 'Member field profiles are unavailable')
        const keys = (JSON.parse(row.columns) as DataColumn[]).map(
          (column) => column.key,
        )
        for (const profile of profiles) {
          const member = store.member(profile.member_id)
          if (
            !member ||
            member.role === 'owner' ||
            (member.role === 'custom' &&
              !store
                .query<{ id: string }, [string]>(
                  'SELECT id FROM workspace_roles WHERE id = ?',
                )
                .get(member.roleId!))
          )
            throw new ApiError(503, 'Member field profile is unavailable')
          sourceMemberProfile(store, id, member.id, keys)
        }
        return {
          version: row.version,
          resourceVersion: row.resource_version,
          configuredMemberIds: profiles.map((profile) => profile.member_id),
        }
      })()
    },
    databaseSummary(id: string): MemberFieldProfileSummary {
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
        let metadata: DatabaseTable[]
        try {
          metadata = JSON.parse(row.metadata)
          if (
            !Array.isArray(metadata) ||
            !metadata.length ||
            metadata.length > 8 ||
            new Set(metadata.map((table) => table.name)).size !==
              metadata.length ||
            metadata.some(
              (table) =>
                typeof table.name !== 'string' ||
                !table.name.length ||
                !Array.isArray(table.columns) ||
                !table.columns.length ||
                table.columns.length > 32 ||
                new Set(table.columns.map((column) => column.key)).size !==
                  table.columns.length ||
                table.columns.some((column) => typeof column.key !== 'string'),
            )
          )
            throw new Error('Invalid inspected tables')
        } catch {
          throw new ApiError(503, 'Member field profiles are unavailable')
        }
        const profiles = store
          .query<{ member_id: string; table_name: string }, [string]>(
            'SELECT member_id, table_name FROM database_member_field_profiles WHERE resource_id = ? ORDER BY member_id, table_name LIMIT 2049',
          )
          .all(id)
        if (profiles.length > 2048)
          throw new ApiError(503, 'Member field profiles are unavailable')
        const ids = [...new Set(profiles.map((profile) => profile.member_id))]
        if (ids.length > 256)
          throw new ApiError(503, 'Member field profiles are unavailable')
        for (const id of ids) {
          const member = store.member(id)
          if (
            !member ||
            member.role === 'owner' ||
            (member.role === 'custom' &&
              !store
                .query<{ id: string }, [string]>(
                  'SELECT id FROM workspace_roles WHERE id = ?',
                )
                .get(member.roleId!))
          )
            throw new ApiError(503, 'Member field profile is unavailable')
        }
        for (const profile of profiles) {
          const table = metadata.find(
            (entry) => entry.name === profile.table_name,
          )
          if (!table)
            throw new ApiError(503, 'Member field profile is unavailable')
          databaseMemberProfile(
            store,
            id,
            table.name,
            profile.member_id,
            table.columns.map((column) => column.key),
          )
        }
        return {
          version: row.version,
          resourceVersion: row.resource_version,
          configuredMemberIds: ids,
        }
      })()
    },
    database(id: string, memberId: string): DatabaseMemberFieldProfile {
      return store.db.transaction((): DatabaseMemberFieldProfile => {
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
        const member = store.member(memberId)
        if (!member) throw new ApiError(404, 'Member not found')
        if (member.role === 'owner')
          throw new ApiError(
            409,
            'Member field profiles require a non-owner member',
          )
        const roleVersion =
          member.role === 'custom'
            ? store
                .query<{ version: number }, [string]>(
                  'SELECT version FROM workspace_roles WHERE id = ?',
                )
                .get(member.roleId!)?.version
            : 0
        if (roleVersion === undefined)
          throw new ApiError(503, 'Member role is unavailable')
        const tenantId = member.tenantAssignment.tenantId
        const tenantProfile =
          tenantId === null ? null : tenantFields.database(id, tenantId)
        const tables = (JSON.parse(row.metadata) as DatabaseTable[]).map(
          (table) => {
            const tenantTable = tenantProfile?.tables.find(
              (entry) => entry.table === table.name,
            )
            const profile = databaseMemberProfile(
              store,
              id,
              table.name,
              memberId,
              table.columns.map((column) => column.key),
            )
            return {
              table: table.name,
              configured: profile.mode === 'selected',
              profile,
              globalFields:
                tenantTable?.globalFields ??
                databaseFields(
                  store,
                  id,
                  table.name,
                  table.columns.map((column) => column.key),
                ),
              tenantProfile: tenantTable?.profile ?? null,
              effectiveColumns:
                tenantTable?.effectiveColumns.filter(
                  (key) =>
                    profile.mode === 'inherit' || profile.columns.includes(key),
                ) ?? null,
            }
          },
        )
        return {
          mode: row.mode,
          version: row.version,
          resourceVersion: row.resource_version,
          member: {
            id: member.id,
            name: member.name,
            role: member.role,
            roleId: member.roleId ?? null,
            roleVersion,
            accessVersion: member.access.version,
            tenantAssignment: member.tenantAssignment,
          },
          tenant: tenantProfile?.tenant ?? null,
          active:
            row.mode === 'tenant' && tenantProfile?.tenant.state === 'active',
          configured: tables.some((table) => table.configured),
          tables,
        }
      })()
    },
    updateDatabase(
      actor: string,
      id: string,
      memberId: string,
      value: unknown,
      authorize?: () => void,
    ): DatabaseMemberFieldProfile {
      const parsed = databaseInput.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose complete member table field profiles and current review versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.database(id, memberId)
          const input = parsed.data
          if (
            current.version !== input.version ||
            current.resourceVersion !== input.resourceVersion ||
            current.member.accessVersion !== input.memberAccessVersion ||
            current.member.tenantAssignment.version !==
              input.tenantAssignmentVersion ||
            (current.tenant?.version ?? null) !== input.tenantVersion ||
            current.member.roleId !== input.roleId ||
            current.member.roleVersion !== input.roleVersion
          )
            throw new ApiError(
              409,
              'Resource, policy, member access, assignment, role, or tenant changed. Refresh before reviewing this profile.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (
            input.tables.length !== current.tables.length ||
            new Set(input.tables.map((table) => table.table)).size !==
              current.tables.length ||
            input.tables.some(
              (table) =>
                !current.tables.some((known) => table.table === known.table),
            )
          )
            throw new ApiError(400, 'Review every inspected table exactly once')
          if (
            !current.configured &&
            input.tables.some((table) => table.fields.mode === 'selected') &&
            store
              .query<{ count: number }, [string]>(
                'SELECT count(DISTINCT member_id) AS count FROM database_member_field_profiles WHERE resource_id = ?',
              )
              .get(id)!.count >= 256
          )
            throw new ApiError(
              409,
              'Member field profile limit reached for this database connection',
            )
          const row = store
            .query<{ metadata: string }, [string]>(
              'SELECT metadata FROM database_connections WHERE id = ?',
            )
            .get(id)!
          const metadata = JSON.parse(row.metadata) as DatabaseTable[]
          for (const table of input.tables) {
            if (table.fields.mode === 'selected') {
              const keys = metadata
                .find((known) => known.name === table.table)!
                .columns.map((column) => column.key)
              if (table.fields.columns.some((key) => !keys.includes(key)))
                throw new ApiError(400, 'Choose existing API field columns')
              store
                .query(
                  `INSERT INTO database_member_field_profiles VALUES (?, ?, ?, 'selected', ?)
              ON CONFLICT(resource_id, table_name, member_id) DO UPDATE SET columns = excluded.columns`,
                )
                .run(
                  id,
                  table.table,
                  memberId,
                  JSON.stringify(table.fields.columns),
                )
            } else {
              store
                .query(
                  'DELETE FROM database_member_field_profiles WHERE resource_id = ? AND table_name = ? AND member_id = ?',
                )
                .run(id, table.table, memberId)
            }
          }
          store
            .query(
              'UPDATE database_row_policies SET version = version + 1 WHERE resource_id = ?',
            )
            .run(id)
          store.audit(
            actor,
            'database-connection.member-fields.updated',
            `${id}:${memberId}`,
          )
          return service.database(id, memberId)
        })
        .immediate()
    },
    source(id: string, memberId: string): SourceMemberFieldProfile {
      return store.db.transaction((): SourceMemberFieldProfile => {
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
        const member = store.member(memberId)
        if (!member) throw new ApiError(404, 'Member not found')
        if (member.role === 'owner')
          throw new ApiError(
            409,
            'Member field profiles require a non-owner member',
          )
        const roleVersion =
          member.role === 'custom'
            ? store
                .query<{ version: number }, [string]>(
                  'SELECT version FROM workspace_roles WHERE id = ?',
                )
                .get(member.roleId!)?.version
            : 0
        if (roleVersion === undefined)
          throw new ApiError(503, 'Member role is unavailable')
        const tenantId = member.tenantAssignment.tenantId
        const tenantProfile =
          tenantId === null ? null : tenantFields.source(id, tenantId)
        const keys = (JSON.parse(row.columns) as DataColumn[]).map(
          (column) => column.key,
        )
        const profile = sourceMemberProfile(store, id, memberId, keys)
        return {
          mode: row.mode,
          version: row.version,
          resourceVersion: row.resource_version,
          member: {
            id: member.id,
            name: member.name,
            role: member.role,
            roleId: member.roleId ?? null,
            roleVersion,
            accessVersion: member.access.version,
            tenantAssignment: member.tenantAssignment,
          },
          tenant: tenantProfile?.tenant ?? null,
          active:
            row.mode === 'tenant' && tenantProfile?.tenant.state === 'active',
          configured: profile.mode === 'selected',
          profile,
          globalFields: tenantProfile?.globalFields ?? sourceFields(store, id),
          tenantProfile: tenantProfile?.profile ?? null,
          effectiveColumns:
            tenantProfile === null
              ? null
              : tenantProfile.effectiveColumns.filter(
                  (key) =>
                    profile.mode === 'inherit' || profile.columns.includes(key),
                ),
        }
      })()
    },
    updateSource(
      actor: string,
      id: string,
      memberId: string,
      value: unknown,
      authorize?: () => void,
    ): SourceMemberFieldProfile {
      const parsed = sourceInput.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose a valid member field profile and current review versions',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const current = service.source(id, memberId)
          const input = parsed.data
          if (
            current.version !== input.version ||
            current.resourceVersion !== input.resourceVersion ||
            current.member.accessVersion !== input.memberAccessVersion ||
            current.member.tenantAssignment.version !==
              input.tenantAssignmentVersion ||
            (current.tenant?.version ?? null) !== input.tenantVersion ||
            current.member.roleId !== input.roleId ||
            current.member.roleVersion !== input.roleVersion
          )
            throw new ApiError(
              409,
              'Resource, policy, member access, assignment, role, or tenant changed. Refresh before reviewing this profile.',
            )
          if (current.version === Number.MAX_SAFE_INTEGER)
            throw new ApiError(409, 'Row policy version limit reached')
          if (input.fields.mode === 'selected') {
            const row = store
              .query<{ columns: string }, [string]>(
                'SELECT columns FROM data_sources WHERE id = ?',
              )
              .get(id)!
            const keys = (JSON.parse(row.columns) as DataColumn[]).map(
              (column) => column.key,
            )
            if (input.fields.columns.some((key) => !keys.includes(key)))
              throw new ApiError(400, 'Choose existing API field columns')
            if (
              !current.configured &&
              store
                .query<{ count: number }, [string]>(
                  'SELECT count(*) AS count FROM source_member_field_profiles WHERE resource_id = ?',
                )
                .get(id)!.count >= 256
            )
              throw new ApiError(
                409,
                'Member field profile limit reached for this source',
              )
            store
              .query(
                `INSERT INTO source_member_field_profiles VALUES (?, ?, 'selected', ?)
            ON CONFLICT(resource_id, member_id) DO UPDATE SET columns = excluded.columns`,
              )
              .run(id, memberId, JSON.stringify(input.fields.columns))
          } else {
            store
              .query(
                'DELETE FROM source_member_field_profiles WHERE resource_id = ? AND member_id = ?',
              )
              .run(id, memberId)
          }
          store
            .query(
              'UPDATE source_row_policies SET version = version + 1 WHERE resource_id = ?',
            )
            .run(id)
          store.audit(
            actor,
            'data-source.member-fields.updated',
            `${id}:${memberId}`,
          )
          return service.source(id, memberId)
        })
        .immediate()
    },
  }
  return service
}
