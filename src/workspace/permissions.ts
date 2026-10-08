export const permissionCatalog = [
  {
    id: 'flows.read',
    label: 'Read APIs',
    group: 'APIs',
    description: 'Read drafts, release history, and OpenAPI documents.',
  },
  {
    id: 'flows.write',
    label: 'Edit APIs',
    group: 'APIs',
    description: 'Create and save API drafts.',
  },
  {
    id: 'flows.test',
    label: 'Test drafts',
    group: 'APIs',
    description:
      'Execute saved REST and GraphQL drafts, including their configured data and product-login steps.',
  },
  {
    id: 'flows.publish',
    label: 'Publish and roll back',
    group: 'APIs',
    description:
      'Change live API behavior by publishing drafts or rolling back releases.',
  },
  {
    id: 'sources.read',
    label: 'Read data sources',
    group: 'Data sources',
    description: 'Read source metadata and saved rows.',
  },
  {
    id: 'sources.write',
    label: 'Manage data sources',
    group: 'Data sources',
    description:
      'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.',
  },
  {
    id: 'database-connections.read',
    label: 'Read database copies',
    group: 'Databases',
    description:
      'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.',
  },
  {
    id: 'database-connections.manage',
    label: 'Manage database copies',
    group: 'Databases',
    description:
      'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.',
  },
  {
    id: 'auth-connections.read',
    label: 'Read product login connections',
    group: 'Product login',
    description:
      'Read product-login connection metadata without provider secrets.',
  },
  {
    id: 'auth-connections.manage',
    label: 'Manage product login connections',
    group: 'Product login',
    description:
      'Create, update, and delete server-held provider credentials. Changes affect live product login.',
  },
  {
    id: 'runtime-keys.manage',
    label: 'Manage runtime API keys',
    group: 'Security',
    description:
      'Issue, list, replace, and revoke runtime keys for any published API. Newly issued credentials can call their scoped API.',
  },
  {
    id: 'audit.read',
    label: 'Read audit history',
    group: 'Workspace',
    description: 'Read workspace activity and security events.',
  },
  {
    id: 'backups.manage',
    label: 'Manage workspace backups',
    group: 'Workspace',
    description:
      'Create, list, and download complete workspace backups containing saved data and sensitive credential records.',
  },
  {
    id: 'migrations.read',
    label: 'Read migration history',
    group: 'Workspace',
    description: 'Read the control database migration history.',
  },
  {
    id: 'load-tests.run',
    label: 'Run load tests',
    group: 'Load testing',
    description:
      'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.',
  },
] as const

export type Permission = (typeof permissionCatalog)[number]['id']
export type BuiltInRole = 'owner' | 'editor' | 'viewer'
export type PermissionMember = {
  role: BuiltInRole | 'custom'
  permissions?: readonly string[]
}

export const builtinPermissions: Record<BuiltInRole, readonly Permission[]> = {
  owner: permissionCatalog.map((entry) => entry.id),
  editor: [
    'flows.read',
    'flows.write',
    'flows.test',
    'sources.read',
    'sources.write',
    'auth-connections.read',
  ],
  viewer: ['flows.read'],
}

export function can(
  member: PermissionMember | null | undefined,
  permission: Permission,
) {
  if (!member) return false
  return (
    member.permissions ??
    (member.role === 'custom' ? [] : builtinPermissions[member.role])
  ).includes(permission)
}
