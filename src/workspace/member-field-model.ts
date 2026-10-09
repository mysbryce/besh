import type { FieldProfile } from './tenant-field-model'
import type { FieldPolicy, Tenant, TenantAssignment } from './tenant-model'

export type MemberFieldSubject = {
  id: string
  name: string
  role: 'editor' | 'viewer' | 'custom'
  roleId: string | null
  roleVersion: number
  accessVersion: number
  tenantAssignment: TenantAssignment
}

export type SourceMemberFieldProfile = {
  mode: 'unprotected' | 'tenant'
  version: number
  resourceVersion: number
  member: MemberFieldSubject
  tenant: Pick<Tenant, 'id' | 'label' | 'state' | 'version'> | null
  active: boolean
  configured: boolean
  profile: FieldProfile
  globalFields: FieldPolicy
  tenantProfile: FieldProfile | null
  effectiveColumns: string[] | null
}

export type SourceMemberFieldProfileInput = {
  version: number
  resourceVersion: number
  memberAccessVersion: number
  tenantAssignmentVersion: number
  tenantVersion: number | null
  roleId: string | null
  roleVersion: number
  fields: FieldProfile
}

export type DatabaseMemberFieldProfile = Omit<
  SourceMemberFieldProfile,
  'profile' | 'globalFields' | 'tenantProfile' | 'effectiveColumns'
> & {
  tables: {
    table: string
    configured: boolean
    profile: FieldProfile
    globalFields: FieldPolicy
    tenantProfile: FieldProfile | null
    effectiveColumns: string[] | null
  }[]
}

export type DatabaseMemberFieldProfileInput = Omit<
  SourceMemberFieldProfileInput,
  'fields'
> & {
  tables: { table: string; fields: FieldProfile }[]
}

export type MemberFieldProfileSummary = {
  version: number
  resourceVersion: number
  configuredMemberIds: string[]
}
