import type { Database } from 'bun:sqlite'
import { z } from 'zod'
import { ApiError } from '../errors'
import { identityText } from '../data/provenance'
import type { Store } from './store'
import type { Tenant, TenantContext } from './tenant-model'

type TenantRow = {
  id: string
  label: string
  value: string
  state: Tenant['state']
  version: number
  created_at: string
  updated_at: string
}
const label = z.string().trim().min(1).max(80).refine(identityText)
const version = z.number().int().positive().safe()
const selector = z.string().min(1).max(80).nullable()
const createSchema = z
  .object({
    label,
    value: z
      .string()
      .min(1)
      .refine(
        (value) =>
          identityText(value) &&
          [...value].length <= 128 &&
          Buffer.byteLength(value, 'utf8') <= 512,
      ),
  })
  .strict()
const updateSchema = z
  .object({ label, state: z.enum(['active', 'retired']), version })
  .strict()
const assignmentSchema = z.object({ tenantId: selector, version }).strict()

function metadata(row: TenantRow): Tenant {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    state: row.state,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function activeTenant(db: Database, id: string): Tenant {
  const row = db
    .query<TenantRow, [string]>('SELECT * FROM tenants WHERE id = ?')
    .get(id)
  if (!row) throw new ApiError(404, 'Tenant identity not found')
  if (row.state !== 'active')
    throw new ApiError(409, 'Tenant identity is retired')
  return metadata(row)
}

export function tenantService(store: Store) {
  return {
    list() {
      return store
        .query<TenantRow, []>('SELECT * FROM tenants ORDER BY label, id')
        .all()
        .map(metadata)
    },
    create(actor: string, value: unknown, authorize?: () => void) {
      const input = createSchema.safeParse(value)
      if (!input.success)
        throw new ApiError(
          400,
          'Provide a label and exact tenant text of up to 128 characters and 512 UTF-8 bytes',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          if (
            store
              .query('SELECT id FROM tenants WHERE value = ? COLLATE BINARY')
              .get(input.data.value)
          )
            throw new ApiError(409, 'Tenant value already registered')
          if (
            store
              .query<{ count: number }, []>(
                'SELECT count(*) AS count FROM tenants',
              )
              .get()!.count >= 256
          )
            throw new ApiError(409, 'Tenant registry is limited to 256 entries')
          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          store
            .query('INSERT INTO tenants VALUES (?, ?, ?, ?, 1, ?, ?)')
            .run(id, input.data.label, input.data.value, 'active', now, now)
          store.audit(actor, 'tenant.created', id)
          return activeTenant(store.db, id)
        })
        .immediate()
    },
    update(actor: string, id: string, value: unknown, authorize?: () => void) {
      const input = updateSchema.safeParse(value)
      if (!input.success)
        throw new ApiError(
          400,
          'Provide the label, tenant state, and expected version',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const row = store
            .query<TenantRow, [string]>('SELECT * FROM tenants WHERE id = ?')
            .get(id)
          if (!row) throw new ApiError(404, 'Tenant identity not found')
          if (
            row.version !== input.data.version ||
            row.version === Number.MAX_SAFE_INTEGER
          )
            throw new ApiError(
              409,
              'Tenant identity changed. Reload before saving.',
            )
          store
            .query(
              'UPDATE tenants SET label = ?, state = ?, version = version + 1, updated_at = ? WHERE id = ?',
            )
            .run(
              input.data.label,
              input.data.state,
              new Date().toISOString(),
              id,
            )
          if (row.state === 'active' && input.data.state === 'retired')
            for (const member of store
              .query<{ member_id: string }, [string]>(
                'SELECT member_id FROM member_tenants WHERE tenant_id = ?',
              )
              .all(id))
              store.revokeMemberSessions(actor, member.member_id)
          store.audit(actor, 'tenant.updated', id)
          return metadata(
            store
              .query<TenantRow, [string]>('SELECT * FROM tenants WHERE id = ?')
              .get(id)!,
          )
        })
        .immediate()
    },
    assign(actor: string, id: string, value: unknown, authorize?: () => void) {
      const input = assignmentSchema.safeParse(value)
      if (!input.success)
        throw new ApiError(
          400,
          'Provide a tenant identity or null and the expected assignment version',
        )
      return store.db
        .transaction(() => {
          authorize?.()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const member = store.member(id)
          if (!member) throw new ApiError(404, 'Member not found')
          if (member.role === 'owner')
            throw new ApiError(409, 'Owner tenant assignment cannot be changed')
          if (
            member.tenantAssignment.version !== input.data.version ||
            member.tenantAssignment.version === Number.MAX_SAFE_INTEGER
          )
            throw new ApiError(
              409,
              'Tenant assignment changed. Reload before saving.',
            )
          if (input.data.tenantId !== null)
            activeTenant(store.db, input.data.tenantId)
          store
            .query(
              'UPDATE member_tenants SET tenant_id = ?, version = version + 1 WHERE member_id = ?',
            )
            .run(input.data.tenantId, id)
          store.revokeMemberSessions(actor, id)
          store.audit(actor, 'member.tenant.updated', id)
          return store.member(id)!
        })
        .immediate()
    },
    context(id: string): TenantContext {
      return store.db.transaction(() => {
        const member = store.member(id)
        if (!member) throw new ApiError(401, 'Authentication required')
        const row =
          member.tenantAssignment.tenantId === null
            ? null
            : store
                .query<TenantRow, [string]>(
                  'SELECT * FROM tenants WHERE id = ?',
                )
                .get(member.tenantAssignment.tenantId)
        const state = store
          .query<{ backups_owner_only: number }, []>(
            'SELECT backups_owner_only FROM row_protection_state WHERE id = 1',
          )
          .get()
        if (!state)
          throw new ApiError(503, 'Row protection state is unavailable')
        return {
          assignment: member.tenantAssignment,
          tenant: row
            ? { id: row.id, label: row.label, state: row.state }
            : null,
          backupsOwnerOnly: Boolean(state.backups_owner_only),
        }
      })()
    },
  }
}
