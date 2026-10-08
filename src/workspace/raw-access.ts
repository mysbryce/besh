import { ApiError } from '../errors'
import type { Member, Store } from './store'

export function assertRawResource(
  store: Store,
  member: Member,
  family: 'sources' | 'database-connections',
  id: string,
) {
  if (member.role === 'owner') return
  const table =
    family === 'sources' ? 'source_row_policies' : 'database_row_policies'
  const policy = store
    .query<{ mode: string }, [string]>(
      `SELECT mode FROM ${table} WHERE resource_id = ?`,
    )
    .get(id)
  if (!policy || policy.mode === 'tenant')
    throw new ApiError(
      404,
      family === 'sources'
        ? 'Data source not found'
        : 'Database connection not found',
    )
}
