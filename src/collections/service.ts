import { ApiError } from '../errors'
import { structService } from '../structs/service'
import type { Store } from '../workspace/store'
import {
  parseCollectionInput,
  parseCollectionMetadata,
  parseCollectionSnapshot,
  type Collection,
  type CollectionSummary,
} from './model'

type CollectionRow = {
  id: string
  name: string
  version: number
  struct_id: string
  struct_version: number
  struct_snapshot: string
  created_at: string
  updated_at: string
}

function timestamp(value: string) {
  if (typeof value !== 'string') return false

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function collection(row: CollectionRow): Collection {
  if (
    typeof row.struct_snapshot !== 'string' ||
    Buffer.byteLength(row.struct_snapshot, 'utf8') > 33_024
  ) {
    throw new ApiError(503, 'Collection is unavailable')
  }

  let value: unknown
  try {
    value = JSON.parse(row.struct_snapshot)
  } catch {
    throw new ApiError(503, 'Collection is unavailable')
  }

  const metadata = parseCollectionMetadata({
    id: row.id,
    name: row.name,
    version: row.version,
    structId: row.struct_id,
    structVersion: row.struct_version,
  })
  const snapshot = parseCollectionSnapshot(value)
  if (
    !metadata ||
    metadata.name !== row.name ||
    row.version !== 1 ||
    !snapshot ||
    snapshot.id !== row.struct_id ||
    snapshot.version !== row.struct_version ||
    !timestamp(row.created_at) ||
    !timestamp(row.updated_at)
  ) {
    throw new ApiError(503, 'Collection is unavailable')
  }

  return {
    id: row.id,
    name: row.name,
    version: row.version,
    struct: snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function collectionService(store: Store) {
  const structs = structService(store)
  const service = {
    list(): CollectionSummary[] {
      const rows = store
        .query<CollectionRow, []>(
          'SELECT * FROM collections ORDER BY created_at, id LIMIT 129',
        )
        .all()
      if (rows.length > 128)
        throw new ApiError(503, 'Collection catalog is unavailable')

      return rows.map((row) => {
        const { struct, ...metadata } = collection(row)
        return {
          ...metadata,
          structId: struct.id,
          structVersion: struct.version,
        }
      })
    },
    get(id: string): Collection {
      const row = store
        .query<CollectionRow, [string]>(
          'SELECT * FROM collections WHERE id = ?',
        )
        .get(id)
      if (!row) throw new ApiError(404, 'Collection not found')

      return collection(row)
    },
    create(actor: string, value: unknown, authorize: () => void): Collection {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const input = parseCollectionInput(value)
          if (!input)
            throw new ApiError(
              400,
              'Provide a bounded collection name and the reviewed Struct revision',
            )

          const current = structs.get(input.structId)
          if (current.version !== input.structVersion)
            throw new ApiError(
              409,
              'Struct draft changed. Review before creating.',
            )

          const count = store
            .query<{ count: number }, []>(
              'SELECT count(*) AS count FROM collections',
            )
            .get()!.count
          if (count >= 128)
            throw new ApiError(
              409,
              'Collection catalog is limited to 128 collections',
            )

          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          const snapshot = {
            id: current.id,
            version: current.version,
            name: current.name,
            fields: current.fields,
          }

          store
            .query(
              'INSERT INTO collections (id, name, version, struct_id, struct_version, struct_snapshot, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)',
            )
            .run(
              id,
              input.name,
              current.id,
              current.version,
              JSON.stringify(snapshot),
              now,
              now,
            )
          store.audit(actor, 'collection.created', id)

          return service.get(id)
        })
        .immediate()
    },
  }

  return service
}
