import { z } from 'zod'
import { ApiError } from '../errors'
import type { StructField, StructSchema } from '../structs/model'
import type { Store } from '../workspace/store'
import type { ContentEntry, ContentEntryPage, EntryData } from './model'
import type { collectionService } from './service'

type EntryRow = {
  id: string
  collection_id: string
  version: number
  data: string
  created_at: string
  updated_at: string
}

const reservedKeys = new Set(['constructor', 'prototype', '__proto__'])
const versionSchema = z.number().int().positive().safe()
const updateSchema = z
  .object({ version: versionSchema, data: z.unknown() })
  .strict()
const deleteSchema = z.object({ version: versionSchema }).strict()
const metadataSchema = z
  .object({
    id: z.string().uuid(),
    collectionId: z.string().uuid(),
    version: versionSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function boundedData(value: unknown) {
  const pending: { value: unknown; depth: number; exit?: boolean }[] = [
    { value, depth: 0 },
  ]
  const ancestors = new WeakSet<object>()
  let visited = 0

  // Bound raw values before recursive schema matching or JSON encoding.
  while (pending.length) {
    const current = pending.pop()!
    if (current.exit) {
      ancestors.delete(current.value as object)
      continue
    }

    if (++visited > 1024 || current.depth > 6) return false
    if (typeof current.value === 'string') {
      if (Buffer.byteLength(current.value, 'utf8') > 4096) return false
      continue
    }
    if (typeof current.value === 'number') {
      if (!Number.isFinite(current.value)) return false
      continue
    }
    if (typeof current.value === 'boolean') continue
    if (!Array.isArray(current.value) && !record(current.value)) return false
    if (ancestors.has(current.value)) return false

    const descriptors = Object.getOwnPropertyDescriptors(current.value)
    const keys = Reflect.ownKeys(descriptors)
    if (keys.some((key) => typeof key !== 'string')) return false

    let children: unknown[]
    if (Array.isArray(current.value)) {
      if (
        current.value.length > 128 ||
        keys.length !== current.value.length + 1
      )
        return false

      children = []
      for (let index = 0; index < current.value.length; index++) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !('value' in descriptor)) return false
        children.push(descriptor.value)
      }
    } else {
      if (keys.length > 1024 - visited) return false

      children = []
      for (const key of keys as string[]) {
        const descriptor = descriptors[key]!
        if (
          reservedKeys.has(key) ||
          Buffer.byteLength(key, 'utf8') > 256 ||
          !('value' in descriptor) ||
          !descriptor.enumerable
        )
          return false

        children.push(descriptor.value)
      }
    }

    ancestors.add(current.value)
    pending.push({ value: current.value, depth: current.depth, exit: true })
    for (const child of children)
      pending.push({ value: child, depth: current.depth + 1 })
  }

  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= 16_384
  } catch {
    return false
  }
}

function matchesFields(fields: StructField[], value: unknown): boolean {
  if (!record(value)) return false

  const definitions = new Map(fields.map((field) => [field.key, field]))
  for (const key of Object.keys(value)) {
    const field = definitions.get(key)
    if (!field || !matchesSchema(field.schema, value[key])) return false
  }

  return fields.every(
    (field) => !field.required || Object.hasOwn(value, field.key),
  )
}

function matchesSchema(schema: StructSchema, value: unknown): boolean {
  switch (schema.type) {
    case 'text':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return matchesFields(schema.fields, value)
    case 'array':
      return (
        Array.isArray(value) &&
        value.every((item) => matchesSchema(schema.items, item))
      )
    case 'select':
      return (
        typeof value === 'string' &&
        schema.options.some((option) => option.value === value)
      )
  }
}

function parseData(fields: StructField[], value: unknown): EntryData | null {
  if (!record(value) || !boundedData(value) || !matchesFields(fields, value))
    return null

  return value as EntryData
}

function timestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function pageQuery(query: URLSearchParams) {
  const seen = new Set<string>()
  const page = { offset: 0, limit: 20 }

  for (const [key, value] of query) {
    if (
      (key !== 'offset' && key !== 'limit') ||
      seen.has(key) ||
      !/^(0|[1-9][0-9]*)$/.test(value)
    )
      throw new ApiError(400, 'Provide a valid entry page offset and limit')

    seen.add(key)
    const number = Number(value)
    if (
      !Number.isSafeInteger(number) ||
      (key === 'limit' && (number < 1 || number > 25))
    )
      throw new ApiError(400, 'Provide a valid entry page offset and limit')

    page[key] = number
  }

  return page
}

function entry(row: EntryRow, collectionId: string, fields: StructField[]) {
  if (
    typeof row.data !== 'string' ||
    Buffer.byteLength(row.data, 'utf8') > 16_384
  )
    throw new ApiError(503, 'Content entry is unavailable')

  let value: unknown
  try {
    value = JSON.parse(row.data)
  } catch {
    throw new ApiError(503, 'Content entry is unavailable')
  }

  const metadata = metadataSchema.safeParse({
    id: row.id,
    collectionId: row.collection_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
  const data = parseData(fields, value)
  if (
    !metadata.success ||
    row.collection_id !== collectionId ||
    !timestamp(row.created_at) ||
    !timestamp(row.updated_at) ||
    !data
  )
    throw new ApiError(503, 'Content entry is unavailable')

  return { ...metadata.data, data }
}

export function contentEntryService(
  store: Store,
  collections: Pick<ReturnType<typeof collectionService>, 'get'>,
) {
  const service = {
    list(collectionId: string, query: URLSearchParams): ContentEntryPage {
      const { offset, limit } = pageQuery(query)

      return store.db
        .transaction(() => {
          const collection = collections.get(collectionId)
          const total = store
            .query<{ count: number }, [string]>(
              'SELECT count(*) AS count FROM collection_entries WHERE collection_id = ?',
            )
            .get(collectionId)!.count
          if (!Number.isSafeInteger(total) || total < 0 || total > 256)
            throw new ApiError(503, 'Content entry catalog is unavailable')

          const rows = store
            .query<EntryRow, [string, number, number]>(
              'SELECT * FROM collection_entries WHERE collection_id = ? ORDER BY created_at, id LIMIT ? OFFSET ?',
            )
            .all(collectionId, limit, offset)
          const entries = rows.map((row) =>
            entry(row, collectionId, collection.struct.fields),
          )

          return { entries, total, offset, limit }
        })
        .deferred()
    },
    get(collectionId: string, entryId: string): ContentEntry {
      const collection = collections.get(collectionId)
      const row = store
        .query<EntryRow, [string, string]>(
          'SELECT * FROM collection_entries WHERE id = ? AND collection_id = ?',
        )
        .get(entryId, collectionId)
      if (!row) throw new ApiError(404, 'Content entry not found')

      return entry(row, collectionId, collection.struct.fields)
    },
    create(
      actor: string,
      collectionId: string,
      value: unknown,
      authorize: () => void,
    ): ContentEntry {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const collection = collections.get(collectionId)
          const data =
            record(value) &&
            Object.keys(value).length === 1 &&
            Object.hasOwn(value, 'data')
              ? parseData(collection.struct.fields, value.data)
              : null
          if (!data)
            throw new ApiError(
              400,
              'Provide bounded content matching the collection',
            )

          const total = store
            .query<{ count: number }, []>(
              'SELECT count(*) AS count FROM collection_entries',
            )
            .get()!.count
          const count = store
            .query<{ count: number }, [string]>(
              'SELECT count(*) AS count FROM collection_entries WHERE collection_id = ?',
            )
            .get(collectionId)!.count
          if (total >= 1024 || count >= 256)
            throw new ApiError(409, 'Content entry capacity reached')

          const id = crypto.randomUUID()
          const now = new Date().toISOString()

          store
            .query(
              'INSERT INTO collection_entries (id, collection_id, version, data, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)',
            )
            .run(id, collectionId, JSON.stringify(data), now, now)
          store.audit(actor, 'entry.created', id)

          return service.get(collectionId, id)
        })
        .immediate()
    },
    update(
      actor: string,
      collectionId: string,
      entryId: string,
      value: unknown,
      authorize: () => void,
    ): ContentEntry {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const collection = collections.get(collectionId)
          const current = service.get(collectionId, entryId)
          const input = updateSchema.safeParse(value)
          if (!input.success || !record(value) || !Object.hasOwn(value, 'data'))
            throw new ApiError(
              400,
              'Provide the current entry version and complete content',
            )
          if (
            input.data.version !== current.version ||
            current.version === Number.MAX_SAFE_INTEGER
          )
            throw new ApiError(
              409,
              'Content entry changed. Reload before saving.',
            )

          const data = parseData(collection.struct.fields, input.data.data)
          if (!data)
            throw new ApiError(
              400,
              'Provide bounded content matching the collection',
            )

          const now = new Date().toISOString()

          const updated = store
            .query(
              'UPDATE collection_entries SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND collection_id = ? AND version = ?',
            )
            .run(
              JSON.stringify(data),
              now,
              entryId,
              collectionId,
              current.version,
            )
          if (updated.changes !== 1)
            throw new ApiError(
              409,
              'Content entry changed. Reload before saving.',
            )

          store.audit(actor, 'entry.updated', entryId)

          return service.get(collectionId, entryId)
        })
        .immediate()
    },
    remove(
      actor: string,
      collectionId: string,
      entryId: string,
      value: unknown,
      authorize: () => void,
    ) {
      return store.db
        .transaction(() => {
          authorize()
          if (store.member(actor)?.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const current = service.get(collectionId, entryId)
          const input = deleteSchema.safeParse(value)
          if (!input.success)
            throw new ApiError(400, 'Provide the current entry version')
          if (input.data.version !== current.version)
            throw new ApiError(
              409,
              'Content entry changed. Reload before deleting.',
            )

          const removed = store
            .query(
              'DELETE FROM collection_entries WHERE id = ? AND collection_id = ? AND version = ?',
            )
            .run(entryId, collectionId, current.version)
          if (removed.changes !== 1)
            throw new ApiError(
              409,
              'Content entry changed. Reload before deleting.',
            )

          store.audit(actor, 'entry.deleted', entryId)

          return { ok: true }
        })
        .immediate()
    },
  }

  return service
}
