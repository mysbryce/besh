import { can, type Permission } from '../src/workspace/permissions'
import type { Member } from './lib/api'

export function canReadDependencyStructure(
  member: Member | null | undefined,
  readPermission: Permission,
) {
  if (member?.access.mode === 'selected')
    return [
      'flows.write',
      'flows.test',
      'flows.publish',
      'runtime-keys.manage',
      'load-tests.run',
    ].some((permission) => can(member, permission as Permission))
  return can(member, readPermission)
}
