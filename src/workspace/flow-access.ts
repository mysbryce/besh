export type FlowAccess = {
  mode: 'all' | 'selected'
  flowIds: string[]
  version: number
}

export type FlowAccessInput =
  { mode: 'all' } | { mode: 'selected'; flowIds: string[] }

export type DependencyUse = {
  sources: string[]
  databaseConnections: string[]
  authConnections: string[]
}
export type MemberAccess = FlowAccess & { dependencyUse: DependencyUse }
export type MemberAccessInput =
  | { mode: 'all' }
  | { mode: 'selected'; flowIds: string[]; dependencyUse: DependencyUse }

export const selectedPermissions = [
  'flows.read',
  'flows.write',
  'flows.test',
  'flows.publish',
  'runtime-keys.manage',
  'load-tests.run',
] as const

export function supportsSelectedFlows(permissions: readonly string[]) {
  return permissions.every((permission) =>
    (selectedPermissions as readonly string[]).includes(permission),
  )
}
