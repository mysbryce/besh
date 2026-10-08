import { ApiError, requirePermission } from '../errors'
import type { Member } from './store'
import type { Permission } from './permissions'
import type { Flow } from '../flows/model'

export type CurrentMember = () => Member

export function authorizeFlow(
  member: Member,
  id: string,
  permission: Permission,
) {
  requirePermission(member, permission)
  if (member.access.mode === 'selected' && !member.access.flowIds.includes(id))
    throw new ApiError(404, 'Flow not found')
}

export function authorizeDependencies(member: Member, definition: Flow) {
  if (member.access.mode === 'all') return
  for (const node of definition.nodes) {
    if (
      node.type !== 'data' &&
      node.type !== 'database' &&
      node.type !== 'social'
    )
      continue
    const family =
      node.type === 'data'
        ? 'sources'
        : node.type === 'database'
          ? 'databaseConnections'
          : node.type === 'social'
            ? 'authConnections'
            : null
    const id =
      node.type === 'data' ? node.config.sourceId : node.config.connectionId
    if (
      family &&
      typeof id === 'string' &&
      id &&
      !member.access.dependencyUse[family].includes(id)
    )
      throw new ApiError(404, 'Dependency not found')
  }
}

export function authorizeGraph(
  member: Member,
  id: string,
  permission: Permission,
  definition: Flow,
) {
  authorizeFlow(member, id, permission)
  authorizeDependencies(member, definition)
}
