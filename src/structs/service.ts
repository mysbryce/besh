import { ApiError } from '../errors'
import type { Store } from '../workspace/store'
import {
  parseStructDefinition,
  parseStructUpdate,
  type StructDraft,
  type StructSummary,
} from './model'

type StructRow = {
  id: string
  name: string
  fields: string
  version: number
  created_at: string
  updated_at: string
}

function timestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function draft(row: StructRow): StructDraft {
  if (
    typeof row.fields !== 'string' ||
    Buffer.byteLength(row.fields, 'utf8') > 32_768
  ) {
    throw new ApiError(503, 'Struct draft is unavailable')
  }

  let value: unknown
  try {
    value = { name: row.name, fields: JSON.parse(row.fields) }
  } catch {
    throw new ApiError(503, 'Struct draft is unavailable')
  }

  const definition = parseStructDefinition(value)
  if (
    !definition ||
    definition.name !== row.name ||
    !row.id ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1 ||
    !timestamp(row.created_at) ||
    !timestamp(row.updated_at)
  ) {
    throw new ApiError(503, 'Struct draft is unavailable')
  }

  return {
    id: row.id,
    ...definition,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function structService(store: Store) {
  const service = {
    list(): StructSummary[] {
      const rows = store
        .query<StructRow, []>(
          'SELECT * FROM structs ORDER BY created_at, id LIMIT 129',
        )
        .all()
      if (rows.length > 128)
        throw new ApiError(503, 'Struct catalog is unavailable')

      return rows.map((row) => {
        const { fields: _fields, ...summary } = draft(row)
        return summary
      })
    },
    get(id: string): StructDraft {
      const row = store
        .query<StructRow, [string]>('SELECT * FROM structs WHERE id = ?')
        .get(id)
      if (!row) throw new ApiError(404, 'Struct not found')

      return draft(row)
    },
    create(actor: string, value: unknown, authorize: () => void): StructDraft {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const definition = parseStructDefinition(value)
          if (!definition)
            throw new ApiError(
              400,
              'Provide a bounded Struct name and valid field definitions',
            )
          const count = store
            .query<{ count: number }, []>(
              'SELECT count(*) AS count FROM structs',
            )
            .get()!.count
          if (count >= 128)
            throw new ApiError(409, 'Struct catalog is limited to 128 drafts')

          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          store
            .query('INSERT INTO structs VALUES (?, ?, ?, 1, ?, ?)')
            .run(
              id,
              definition.name,
              JSON.stringify(definition.fields),
              now,
              now,
            )
          store.audit(actor, 'struct.created', id)

          return service.get(id)
        })
        .immediate()
    },
    update(
      actor: string,
      id: string,
      value: unknown,
      authorize: () => void,
    ): StructDraft {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const current = service.get(id)
          const version =
            value !== null && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, unknown>).version
              : undefined
          if (
            typeof version !== 'number' ||
            !Number.isSafeInteger(version) ||
            version < 1
          )
            throw new ApiError(400, 'Provide the current Struct version')
          if (
            version !== current.version ||
            current.version === Number.MAX_SAFE_INTEGER
          )
            throw new ApiError(
              409,
              'Struct draft changed. Refresh before saving.',
            )

          const definition = parseStructUpdate(value)
          if (!definition)
            throw new ApiError(
              400,
              'Provide a bounded Struct name and valid field definitions',
            )

          const now = new Date().toISOString()
          store
            .query(
              'UPDATE structs SET name = ?, fields = ?, version = version + 1, updated_at = ? WHERE id = ?',
            )
            .run(definition.name, JSON.stringify(definition.fields), now, id)
          store.audit(actor, 'struct.updated', id)

          return service.get(id)
        })
        .immediate()
    },
  }

  return service
}
