import { ApiError, requirePermission } from '../errors'
import { can } from './permissions'
import type { Member, Store } from './store'
import type { DependencyFamily } from './dependency-model'

const families = {
  sources: {
    table: 'data_sources',
    grants: 'member_source_use',
    columns: 'r.id, r.name, r.version, r.columns',
    permission: 'sources.read',
  },
  'database-connections': {
    table: 'database_connections',
    grants: 'member_database_use',
    columns: 'r.id, r.name, r.version, r.metadata',
    permission: 'database-connections.read',
  },
  'auth-connections': {
    table: 'auth_connections',
    grants: 'member_auth_use',
    columns: 'r.id, r.name, r.version, r.provider',
    permission: 'auth-connections.read',
  },
} as const

export function dependencyService(store: Store) {
  return {
    catalog(member: Member, family: DependencyFamily, id?: string) {
      const settings = families[family]
      const selected = member.access.mode === 'selected'
      if (selected) {
        if (
          !(
            [
              'flows.write',
              'flows.test',
              'flows.publish',
              'runtime-keys.manage',
              'load-tests.run',
            ] as const
          ).some((permission) => can(member, permission))
        )
          throw new ApiError(403, 'Permission denied')
      } else requirePermission(member, settings.permission)
      const sql = `SELECT ${settings.columns} FROM ${settings.table} r ${selected ? `JOIN ${settings.grants} g ON g.resource_id = r.id` : ''} WHERE 1 = 1 ${selected ? 'AND g.member_id = ?' : ''} ${id === undefined ? '' : 'AND r.id = ?'} ORDER BY r.name, r.id`
      const rows = store
        .query<{
          id: string
          name: string
          version: number
          columns?: string
          metadata?: string
          provider?: 'github'
        }>(sql)
        .all(
          ...(selected ? [member.id] : []),
          ...(id === undefined ? [] : [id]),
        )
      const result = rows.map((row) => {
        const base = { id: row.id, name: row.name, version: row.version }
        if (family === 'sources')
          return { ...base, columns: JSON.parse(row.columns!) }
        if (family === 'database-connections')
          return {
            ...base,
            tables: JSON.parse(row.metadata!).map(
              (table: { name: string; columns: unknown }) => ({
                name: table.name,
                columns: table.columns,
              }),
            ),
          }
        return { ...base, provider: row.provider! }
      })
      if (id !== undefined && !result.length)
        throw new ApiError(404, 'Dependency not found')
      return id === undefined ? result : result[0]
    },
  }
}
