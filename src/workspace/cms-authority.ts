import { ApiError } from '../errors'
import type { Member, Store } from './store'

export function ownerManagedFlow(store: Pick<Store, 'query'>, id: string) {
  const row = store
    .query<{ cms: number }, [string]>('SELECT cms FROM flows WHERE id = ?')
    .get(id)

  if (!row) throw new ApiError(404, 'Flow not found')
  if (row.cms !== 0 && row.cms !== 1)
    throw new ApiError(503, 'Flow classification is invalid')

  return row.cms === 1
}

export function assertCmsOwner(
  store: Pick<Store, 'query'>,
  member: Member,
  id: string,
) {
  if (ownerManagedFlow(store, id) && member.role !== 'owner')
    throw new ApiError(404, 'Flow not found')
}
