import type { FieldPolicy, Tenant } from './tenant-model'

export type FieldProfile =
  { mode: 'inherit' } | { mode: 'selected'; columns: string[] }

type TenantFieldReview = {
  mode: 'unprotected' | 'tenant'
  version: number
  resourceVersion: number
  tenant: Pick<Tenant, 'id' | 'label' | 'state' | 'version'>
  active: boolean
  configured: boolean
}

type FieldIntersection = {
  profile: FieldProfile
  globalFields: FieldPolicy
  effectiveColumns: string[]
}

export type SourceTenantFieldProfile = TenantFieldReview & FieldIntersection

export type DatabaseTenantFieldProfile = TenantFieldReview & {
  tables: (FieldIntersection & { table: string; configured: boolean })[]
}

export type TenantFieldProfileSummary = {
  version: number
  resourceVersion: number
  configuredTenantIds: string[]
}
