import type { Flow } from '../../src/flows/model'
import type { Permission } from '../../src/workspace/permissions'
import type { FlowAccess, MemberAccess } from '../../src/workspace/flow-access'
import type { TenantAssignment } from '../../src/workspace/tenant-model'
import type { FlowTransport } from '../../src/flows/transport'

export type { StructDraft, StructSummary } from '../../src/structs/model'
export type { Collection, CollectionSummary } from '../../src/collections/model'
export type {
  ContentEntry,
  ContentEntryPage,
} from '../../src/collections/model'

export type PublishedEndpoint = {
  method: Flow['method']
  path: string
  graphql: boolean
  transport: FlowTransport
}

export type SavedFlow = Flow & {
  id: string
  revision: number
  publishedRevision: number | null
  publishedEndpoint: PublishedEndpoint | null
}

export type RuntimePermission = 'rest' | 'query' | 'mutation' | 'ws'

export type RuntimeKey = {
  id: string
  name: string
  flowId: string
  releaseRevision: number | null
  tenantId: string | null
  cleanupOnly?: true
  issuerBinding: {
    memberId: string
    action: 'runtime-keys.manage' | 'load-tests.run'
  } | null
  permissions: RuntimePermission[]
  expiresAt: string
  acceptUntil: string
  replacesKeyId: string | null
  replacedByKeyId: string | null
  createdAt: string
  revokedAt: string | null
  managedBy?: 'load-test'
}

export type Member = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer' | 'custom'
  permissions: Permission[]
  flowAccess: FlowAccess
  access: MemberAccess
  tenantAssignment: TenantAssignment
  roleId?: string
  roleName?: string
  hasAccount?: boolean
}

export type Role = {
  id: string
  name: string
  permissions: Permission[]
  version: number
  createdAt: string
  updatedAt: string
}

export type DataSource = {
  id: string
  name: string
  kind: 'upload' | 'google-sheets'
  columns: {
    key: string
    label: string
    type: 'string' | 'number' | 'boolean'
    nullable: boolean
  }[]
  rowCount: number
  version: number
  createdAt: string
  updatedAt: string
  sheetName?: string
  sourceUrl?: string
}

export type DataSourceDetail = DataSource & { rows: Record<string, unknown>[] }

export type AuthConnection = {
  id: string
  name: string
  provider: 'github'
  clientId: string
  redirectUri: string
  version: number
  createdAt: string
  updatedAt: string
}

export type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}

export type Backup = { id: string; bytes: number; createdAt: string }

export type Migration = { version: number; name: string; applied_at: string }

export type WorkspaceSession = {
  member: Member
  csrfToken: string
  sessionId: string
  expiresAt: string
}

export type SessionRecord = {
  id: string
  memberId: string
  memberName: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  current: boolean
}
