export type Tenant = {
  id: string
  label: string
  value: string
  state: 'active' | 'retired'
  version: number
  createdAt: string
  updatedAt: string
}

export type TenantAssignment = { tenantId: string | null; version: number }

export type SourceRowPolicy = {
  mode: 'unprotected' | 'tenant'
  version: number
  resourceVersion: number
  column: string | null
  provenance: {
    status: 'available' | 'requires-reimport'
    textColumns: string[]
  }
}

export type DatabaseRowPolicy = {
  mode: 'unprotected' | 'tenant'
  version: number
  resourceVersion: number
  tables: { table: string; column: string | null; textColumns: string[] }[]
}

export type TenantContext = {
  assignment: TenantAssignment
  tenant: Pick<Tenant, 'id' | 'label' | 'state'> | null
  backupsOwnerOnly: boolean
}

export type FlowRowAccess = {
  source: 'draft' | 'published'
  revision: number
  required: boolean
  supported: boolean
}
