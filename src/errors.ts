import type { Member } from './store'

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
