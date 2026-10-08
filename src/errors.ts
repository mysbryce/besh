import type { Member } from './workspace/store'
import { can, type Permission } from './workspace/permissions'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function allow(member: Member, roles: Member['role'][]) {
  if (!roles.includes(member.role)) throw new ApiError(403, 'Permission denied')
}

export function requirePermission(member: Member, permission: Permission) {
  if (!can(member, permission)) throw new ApiError(403, 'Permission denied')
}
