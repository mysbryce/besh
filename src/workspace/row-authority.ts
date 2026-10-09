import { ApiError } from '../errors'
import type { Flow } from '../flows/model'
import type { Member, Store, RuntimeKey } from './store'
import { activeTenant } from './tenants'
import { assertGraphFields } from './field-policy'
import { assertTenantGraphFields } from './tenant-field-policy'
import {
  buildSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isLeafType,
} from 'graphql'

export type RowPrincipal = { tenantId: string; value: string }
export type RowReadPermit = {
  tenantId: string
  column: string
  value: string
  policyVersion: number
  resourceVersion: number
}
type RowStore = Pick<Store, 'db' | 'query'>
type PrincipalStore = RowStore & Pick<Store, 'member'>

export function protectedReads(store: RowStore, flow: Flow) {
  return flow.nodes.filter((node) => {
    if (node.type === 'data')
      return (
        store
          .query<{ mode: string }, [string]>(
            'SELECT mode FROM source_row_policies WHERE resource_id = ?',
          )
          .get(node.config.sourceId)?.mode === 'tenant'
      )
    if (node.type === 'database')
      return (
        store
          .query<{ mode: string }, [string]>(
            'SELECT mode FROM database_row_policies WHERE resource_id = ?',
          )
          .get(node.config.connectionId)?.mode === 'tenant'
      )
    return false
  })
}

export function protectedShape(store: RowStore, flow: Flow) {
  const reads = protectedReads(store, flow)
  if (!reads.length) return { required: false, supported: true }
  const request = flow.nodes.find((node) => node.type === 'request')
  const response = flow.nodes.find((node) => node.type === 'response')
  const read = reads[0]!
  let supported =
    reads.length === 1 &&
    flow.nodes.length === 3 &&
    flow.edges.length === 2 &&
    Boolean(request) &&
    response?.type === 'response' &&
    response.config.body === '$data' &&
    response.config.status === 200 &&
    flow.edges.some(
      (edge) =>
        edge.source === request!.id &&
        edge.target === read.id &&
        !edge.sourceHandle,
    ) &&
    flow.edges.some(
      (edge) =>
        edge.source === read.id &&
        edge.target === response.id &&
        !edge.sourceHandle,
    )
  if (supported && flow.graphql) {
    const schema = buildSchema(flow.graphql.schema)
    const fields = schema.getQueryType()?.getFields()
    const rows = fields?.rows?.type
    const list = rows && (isNonNullType(rows) ? rows.ofType : rows)
    supported =
      !schema.getMutationType() &&
      Boolean(fields) &&
      Object.keys(fields!).length === 1 &&
      Boolean(list) &&
      isListType(list!)
    if (supported && list && isListType(list)) {
      const rowType = isNonNullType(list.ofType)
        ? list.ofType.ofType
        : list.ofType
      supported =
        isObjectType(rowType) &&
        Object.values(rowType.getFields()).every(
          (field) =>
            isLeafType(
              isNonNullType(field.type) ? field.type.ofType : field.type,
            ) && field.args.length === 0,
        )
    }
  }
  return { required: true, supported }
}

export function memberRowPrincipal(
  store: RowStore,
  member: Member,
  flow: Flow,
  selector?: string,
): RowPrincipal | null {
  if (selector !== undefined && member.role !== 'owner')
    throw new ApiError(400, 'Only the owner may select a tenant for execution')
  assertGraphFields(store, flow)
  const shape = protectedShape(store, flow)
  if (!shape.required) {
    if (selector !== undefined)
      throw new ApiError(
        400,
        'Tenant selection requires a protected resource row policy',
      )
    return null
  }
  if (!shape.supported)
    throw new ApiError(
      400,
      'Protected APIs require one protected read between request and response',
    )
  const tenantId =
    member.role === 'owner' ? selector : member.tenantAssignment.tenantId
  if (!tenantId)
    throw new ApiError(
      member.role === 'owner' ? 400 : 403,
      'Choose an active tenant identity for this protected API',
    )
  let principal: RowPrincipal
  try {
    const tenant = activeTenant(store.db, tenantId)
    principal = { tenantId: tenant.id, value: tenant.value }
  } catch {
    throw new ApiError(
      member.role === 'owner' ? 400 : 403,
      'An active tenant identity is required',
    )
  }
  assertTenantGraphFields(store, flow, principal.tenantId)
  return principal
}

export function sourceReadPermit(
  store: Store,
  id: string,
  principal: RowPrincipal | null,
): RowReadPermit | undefined {
  const policy = store
    .query<
      {
        mode: string
        tenant_column: string | null
        version: number
        resource_version: number
      },
      [string]
    >(
      'SELECT mode, tenant_column, source_row_policies.version, data_sources.version AS resource_version FROM source_row_policies JOIN data_sources ON resource_id = data_sources.id WHERE resource_id = ?',
    )
    .get(id)
  if (!policy) throw new ApiError(503, 'Source row policy is unavailable')
  if (policy.mode !== 'tenant') return undefined
  if (!principal)
    throw new ApiError(403, 'A trusted tenant identity is required')
  return {
    tenantId: principal.tenantId,
    column: policy.tenant_column!,
    value: principal.value,
    policyVersion: policy.version,
    resourceVersion: policy.resource_version,
  }
}

export function databaseReadPermit(
  store: Store,
  id: string,
  table: string,
  principal: RowPrincipal | null,
): RowReadPermit | undefined {
  const policy = store
    .query<
      { mode: string; version: number; resource_version: number },
      [string]
    >(
      'SELECT mode, database_row_policies.version, database_connections.version AS resource_version FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
    )
    .get(id)
  if (policy?.mode !== 'tenant') return undefined
  if (!principal)
    throw new ApiError(403, 'A trusted tenant identity is required')
  const column = store
    .query<{ column_key: string }, [string, string]>(
      'SELECT column_key FROM database_tenant_columns WHERE resource_id = ? AND table_name = ?',
    )
    .get(id, table)
  if (!column)
    throw new ApiError(503, 'Protected database tenant column is unavailable')
  return {
    tenantId: principal.tenantId,
    column: column.column_key,
    value: principal.value,
    policyVersion: policy.version,
    resourceVersion: policy.resource_version,
  }
}

export function runtimeRowPrincipal(
  store: PrincipalStore,
  key: RuntimeKey,
  flow: Flow,
  status = 403,
): RowPrincipal | null {
  assertGraphFields(store, flow, status)
  const shape = protectedShape(store, flow)
  if (shape.required && (!shape.supported || !key.tenantId))
    throw new ApiError(
      status,
      'Runtime key does not authorize this protected API',
    )
  if (!key.tenantId) return null
  let principal: RowPrincipal
  try {
    const tenant = activeTenant(store.db, key.tenantId)
    if (key.issuerBinding) {
      const issuer = store.member(key.issuerBinding.memberId)
      if (
        !issuer ||
        (issuer.role !== 'owner' &&
          issuer.tenantAssignment.tenantId !== tenant.id)
      )
        throw new Error('Issuer identity changed')
    }
    principal = { tenantId: tenant.id, value: tenant.value }
  } catch {
    throw new ApiError(
      status,
      'Runtime key tenant identity is no longer authorized',
    )
  }
  assertTenantGraphFields(store, flow, principal.tenantId, status)
  return principal
}

export function rowCheckpoint(
  store: RowStore,
  flow: Flow,
  authorize: () => void,
  principal: () => RowPrincipal | null = () => null,
) {
  const signature = () =>
    JSON.stringify(
      flow.nodes.flatMap((node) => {
        if (node.type === 'data') {
          const policy = store
            .query<
              { mode: string; version: number; resource_version: number },
              [string]
            >(
              'SELECT mode, source_row_policies.version, data_sources.version AS resource_version FROM source_row_policies JOIN data_sources ON resource_id = data_sources.id WHERE resource_id = ?',
            )
            .get(node.config.sourceId)
          if (!policy)
            throw new ApiError(503, 'Source row policy is unavailable')
          return [
            {
              id: node.id,
              mode: policy.mode,
              version: policy.version,
              ...(policy.mode === 'tenant'
                ? { resourceVersion: policy.resource_version }
                : {}),
            },
          ]
        }
        if (node.type === 'database') {
          const policy = store
            .query<
              { mode: string; version: number; resource_version: number },
              [string]
            >(
              'SELECT mode, database_row_policies.version, database_connections.version AS resource_version FROM database_row_policies JOIN database_connections ON resource_id = database_connections.id WHERE resource_id = ?',
            )
            .get(node.config.connectionId)
          if (!policy)
            throw new ApiError(503, 'Database row policy is unavailable')
          return [
            {
              id: node.id,
              mode: policy.mode,
              version: policy.version,
              ...(policy.mode === 'tenant'
                ? { resourceVersion: policy.resource_version }
                : {}),
            },
          ]
        }
        return []
      }),
    )
  const snapshot = () => {
    authorize()
    return store.db.transaction(() => {
      authorize()
      return { policies: signature(), tenantId: principal()?.tenantId ?? null }
    })()
  }
  const admitted = snapshot()
  return () => {
    const current = snapshot()
    if (
      current.policies !== admitted.policies ||
      current.tenantId !== admitted.tenantId
    )
      throw new ApiError(
        403,
        'Row protection or identity changed during this execution. Retry with current policy.',
      )
  }
}
