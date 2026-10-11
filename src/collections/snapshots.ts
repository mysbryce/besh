import { createHash } from 'node:crypto'
import { ApiError } from '../errors'
import { parseRichTextDocument } from '../structs/rich-text'
import { parseFormattedRichTextDocument } from '../structs/rich-text-formatted'
import type { Member, Store } from '../workspace/store'
import {
  parseContentFieldPath,
  selectContentField,
  type contentEntryService,
} from './entries'
import type { collectionService } from './service'

export type PreparedCollectionSnapshot = {
  name: string
  path: string
  payload: string
  sha256: string
}

type SnapshotInput = {
  name: string
  path: string
  collectionVersion: number
  entryVersion: number
  rendererVersion: number
  fieldPath: (string | number)[]
}

const inputKeys = [
  'name',
  'path',
  'collectionVersion',
  'entryVersion',
  'rendererVersion',
  'fieldPath',
]

function safeVersion(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  )
}

function snapshotInput(value: unknown): SnapshotInput | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (
    keys.length !== inputKeys.length ||
    keys.some((key) => {
      if (typeof key !== 'string' || !inputKeys.includes(key)) return true

      const descriptor = descriptors[key]!
      return !descriptor.enumerable || !('value' in descriptor)
    })
  )
    return null

  const name: unknown = descriptors.name!.value
  const path: unknown = descriptors.path!.value
  const collectionVersion: unknown = descriptors.collectionVersion!.value
  const entryVersion: unknown = descriptors.entryVersion!.value
  const rendererVersion: unknown = descriptors.rendererVersion!.value
  if (
    typeof name !== 'string' ||
    name.trim().length < 1 ||
    name.trim().length > 80 ||
    typeof path !== 'string' ||
    path.length > 160 ||
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path) ||
    !safeVersion(collectionVersion, 1) ||
    !safeVersion(entryVersion, 1) ||
    !safeVersion(rendererVersion, 0)
  )
    return null

  const fieldPath = parseContentFieldPath(descriptors.fieldPath!.value)
  if (!fieldPath) return null

  return {
    name: name.trim(),
    path,
    collectionVersion,
    entryVersion,
    rendererVersion,
    fieldPath,
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const fields = Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))

    return '{' + fields.join(',') + '}'
  }

  const encoded = JSON.stringify(value)
  if (encoded === undefined)
    throw new ApiError(503, 'Content snapshot is unavailable')

  return encoded
}

export function collectionSnapshotService(
  store: Store,
  collections: Pick<ReturnType<typeof collectionService>, 'get'>,
  entries: Pick<ReturnType<typeof contentEntryService>, 'get' | 'preview'>,
) {
  return {
    prepare(
      actor: string,
      collectionId: string,
      entryId: string,
      value: unknown,
      authorize: () => Member,
    ): PreparedCollectionSnapshot {
      const current = authorize()
      if (current.id !== actor || current.role !== 'owner')
        throw new ApiError(403, 'Owner access required')

      // Flow creation owns the acquired write transaction and all later effects.
      if (!store.db.inTransaction)
        throw new ApiError(
          503,
          'Content snapshot requires an acquired transaction',
        )

      const input = snapshotInput(value)
      if (!input)
        throw new ApiError(
          400,
          'Provide reviewed collection, entry and renderer versions and one rich-text field',
        )

      const collection = collections.get(collectionId)
      if (collection.version !== input.collectionVersion)
        throw new ApiError(
          409,
          'Collection changed. Review before creating a snapshot.',
        )

      const saved = entries.get(collectionId, entryId)
      const preview = entries.preview(
        actor,
        collectionId,
        entryId,
        {
          entryVersion: input.entryVersion,
          rendererVersion: input.rendererVersion,
          fieldPath: input.fieldPath,
        },
        authorize,
      )
      const selected = selectContentField(
        collection.struct.fields,
        saved.data,
        input.fieldPath,
      )
      if (!selected || selected.schema.type !== 'richText')
        throw new ApiError(503, 'Content snapshot is unavailable')

      const document =
        selected.schema.schemaVersion === 1
          ? parseRichTextDocument(selected.value)
          : parseFormattedRichTextDocument(selected.value)
      if (!document) throw new ApiError(503, 'Content snapshot is unavailable')

      // Validated CMS encoding has its own semantic bounds outside flow JSON.
      const payload = canonical({ schemaVersion: 1, document, preview })
      if (Buffer.byteLength(payload, 'utf8') > 262_144)
        throw new ApiError(
          400,
          'Content snapshot exceeds the response size limit',
        )

      const sha256 = createHash('sha256').update(payload, 'utf8').digest('hex')

      return { name: input.name, path: input.path, payload, sha256 }
    },
  }
}
