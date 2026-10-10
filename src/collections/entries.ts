import { z } from 'zod'
import { ApiError } from '../errors'
import type { StructField, StructSchema } from '../structs/model'
import { parseRichTextDocument } from '../structs/rich-text'
import { parseFormattedRichTextDocument } from '../structs/rich-text-formatted'
import { renderRichTextPreview } from '../structs/rich-text-render'
import type { Member, Store } from '../workspace/store'
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

type DataFrame = {
  value: unknown
  depth: number
  schema?: StructSchema
  fields?: StructField[]
  formattedDepth?: number
  exit?: boolean
}

function boundedData(fields: StructField[], value: unknown) {
  const pending: DataFrame[] = [{ value, depth: 0, fields }]
  const ancestors = new WeakSet<object>()
  let visited = 0

  // Bound raw values before recursive schema matching or JSON encoding.
  while (pending.length) {
    const current = pending.pop()!
    if (current.exit) {
      ancestors.delete(current.value as object)
      continue
    }

    if (
      ++visited > 1024 ||
      (current.formattedDepth === undefined && current.depth > 6) ||
      (current.formattedDepth !== undefined && current.formattedDepth > 24)
    )
      return false

    // Only the frozen field schema can admit an independent v2 AST encoding budget.
    const formattedDepth =
      current.formattedDepth ??
      (current.schema?.type === 'richText' &&
      current.schema.schemaVersion === 2 &&
      current.schema.astVersion === 2
        ? 0
        : undefined)

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

    const children: { value: unknown; schema?: StructSchema }[] = []
    if (Array.isArray(current.value)) {
      if (
        current.value.length > 128 ||
        keys.length !== current.value.length + 1
      )
        return false

      const itemSchema =
        formattedDepth === undefined && current.schema?.type === 'array'
          ? current.schema.items
          : undefined
      for (let index = 0; index < current.value.length; index++) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !('value' in descriptor)) return false
        children.push({ value: descriptor.value, schema: itemSchema })
      }
    } else {
      if (keys.length > 1024 - visited) return false

      const definitions = new Map(
        (
          current.fields ??
          (current.schema?.type === 'object' ? current.schema.fields : [])
        ).map((field) => [field.key, field.schema]),
      )
      for (const key of keys as string[]) {
        const descriptor = descriptors[key]!
        if (
          reservedKeys.has(key) ||
          Buffer.byteLength(key, 'utf8') > 256 ||
          !('value' in descriptor) ||
          !descriptor.enumerable
        )
          return false

        children.push({
          value: descriptor.value,
          schema:
            formattedDepth === undefined ? definitions.get(key) : undefined,
        })
      }
    }

    ancestors.add(current.value)
    pending.push({ value: current.value, depth: current.depth, exit: true })
    for (const child of children)
      pending.push({
        ...child,
        depth: current.depth + 1,
        formattedDepth:
          formattedDepth === undefined ? undefined : formattedDepth + 1,
      })
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
    case 'richText':
      return schema.schemaVersion === 1
        ? parseRichTextDocument(value) !== null
        : parseFormattedRichTextDocument(value) !== null
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
  if (
    !record(value) ||
    !boundedData(fields, value) ||
    !matchesFields(fields, value)
  )
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

type FieldPath = (string | number)[]
type PreviewInput = {
  entryVersion: number
  renderer: unknown
} & (
  | { selector: 'key'; fieldKey: string }
  | { selector: 'path'; fieldPath: FieldPath }
)

function fieldKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 64 &&
    /^[a-z]/.test(value) &&
    !/[^a-z0-9_]/.test(value) &&
    !reservedKeys.has(value)
  )
}

function fieldPath(value: unknown): FieldPath | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(descriptors).length !== value.length + 1) return null

  const path: FieldPath = []
  for (let index = 0; index < value.length; index++) {
    const descriptor = descriptors[String(index)]
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
      return null

    const segment: unknown = descriptor.value
    if (fieldKey(segment)) {
      path.push(segment)
    } else if (
      typeof segment === 'number' &&
      Number.isSafeInteger(segment) &&
      segment >= 0
    ) {
      path.push(segment)
    } else {
      return null
    }
  }

  return path
}

function previewInput(value: unknown): PreviewInput | null {
  if (!record(value)) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (
    keys.length !== 3 ||
    keys.some((key) => {
      const descriptor = descriptors[key as string]
      return (
        typeof key !== 'string' ||
        !['entryVersion', 'fieldKey', 'fieldPath', 'renderer'].includes(key) ||
        !descriptor ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      )
    })
  )
    return null

  const hasKey = Object.hasOwn(descriptors, 'fieldKey')
  const hasPath = Object.hasOwn(descriptors, 'fieldPath')
  if (
    !Object.hasOwn(descriptors, 'entryVersion') ||
    !Object.hasOwn(descriptors, 'renderer') ||
    hasKey === hasPath
  )
    return null

  const entryVersion: unknown = descriptors.entryVersion!.value
  if (
    typeof entryVersion !== 'number' ||
    !Number.isSafeInteger(entryVersion) ||
    entryVersion < 1
  )
    return null

  const renderer: unknown = descriptors.renderer!.value
  if (hasKey) {
    const selectedKey: unknown = descriptors.fieldKey!.value
    if (!fieldKey(selectedKey)) return null

    return { entryVersion, renderer, selector: 'key', fieldKey: selectedKey }
  }

  const selectedPath = fieldPath(descriptors.fieldPath!.value)
  if (!selectedPath) return null

  return { entryVersion, renderer, selector: 'path', fieldPath: selectedPath }
}

function previewField(
  fields: StructField[],
  savedData: EntryData,
  path: readonly (string | number)[],
) {
  let schema: StructSchema = { type: 'object', fields }
  let currentValue: unknown = savedData
  let namedKey: string | undefined

  for (const segment of path) {
    if (schema.type === 'object') {
      if (
        typeof segment !== 'string' ||
        !record(currentValue) ||
        !Object.hasOwn(currentValue, segment)
      )
        return null

      const declared: StructField | undefined = schema.fields.find(
        (field) => field.key === segment,
      )
      if (!declared) return null

      namedKey = declared.key
      schema = declared.schema
      currentValue = currentValue[segment]
    } else if (schema.type === 'array') {
      if (
        typeof segment !== 'number' ||
        !Array.isArray(currentValue) ||
        segment >= currentValue.length ||
        !Object.hasOwn(currentValue, segment)
      )
        return null

      schema = schema.items
      currentValue = currentValue[segment]
    } else {
      return null
    }
  }

  if (!namedKey) return null

  return { fieldKey: namedKey, schema, value: currentValue }
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
    preview(
      actor: string,
      collectionId: string,
      entryId: string,
      value: unknown,
      authorize: () => Member,
    ) {
      return store.db
        .transaction(() => {
          const current = authorize()
          if (current.id !== actor || current.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const input = previewInput(value)
          if (!input)
            throw new ApiError(
              400,
              'Provide the current entry version and rich-text field',
            )

          const collection = collections.get(collectionId)
          const saved = service.get(collectionId, entryId)
          if (saved.version !== input.entryVersion)
            throw new ApiError(
              409,
              'Content entry changed. Reload before previewing.',
            )

          const selected = previewField(
            collection.struct.fields,
            saved.data,
            input.selector === 'key' ? [input.fieldKey] : input.fieldPath,
          )
          if (
            !selected ||
            selected.schema.type !== 'richText' ||
            !(
              (selected.schema.schemaVersion === 1 &&
                selected.schema.astVersion === 1) ||
              (selected.schema.schemaVersion === 2 &&
                selected.schema.astVersion === 2)
            )
          )
            throw new ApiError(400, 'Choose a saved rich-text field')

          const document =
            selected.schema.schemaVersion === 1
              ? parseRichTextDocument(selected.value)
              : parseFormattedRichTextDocument(selected.value)
          if (!document) throw new ApiError(503, 'Content entry is unavailable')

          const rendered = renderRichTextPreview(document, input.renderer)

          return {
            collectionId: collection.id,
            collectionVersion: collection.version,
            structId: collection.struct.id,
            structVersion: collection.struct.version,
            entryId: saved.id,
            entryVersion: saved.version,
            fieldKey: selected.fieldKey,
            ...(input.selector === 'path'
              ? { fieldPath: input.fieldPath }
              : {}),
            schemaVersion: selected.schema.schemaVersion,
            astVersion: document.astVersion,
            ...rendered,
          }
        })
        .immediate()
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
