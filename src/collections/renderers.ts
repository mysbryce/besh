import { ApiError } from '../errors'
import {
  reviewRichTextRenderer,
  type RichTextRenderer,
} from '../structs/rich-text-render'
import type { Member, Store } from '../workspace/store'
import type { Collection } from './model'
import type { collectionService } from './service'

export type CollectionRenderer = {
  collectionId: string
  collectionVersion: number
  structId: string
  structVersion: number
  version: number
  renderer: RichTextRenderer
  rendererSha256: string
  consumerContract: 'besh.fixed-heading-id.v1' | null
  createdAt: string | null
  updatedAt: string | null
}

type RendererRow = {
  collection_id: string
  version: number
  schema_version: number
  renderer: string
  renderer_sha256: string
  created_at: string
  updated_at: string
}

const unavailable = 'Collection renderer is unavailable'
const changed = 'Collection renderer changed. Reload before saving.'

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function saveInput(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (
    keys.length !== 2 ||
    keys.some((key) => key !== 'version' && key !== 'renderer') ||
    !descriptors.version?.enumerable ||
    !('value' in descriptors.version) ||
    !descriptors.renderer?.enumerable ||
    !('value' in descriptors.renderer)
  )
    return null

  const version: unknown = descriptors.version.value
  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    return null

  const renderer: unknown = descriptors.renderer.value
  return { version, renderer }
}

function provenance(collection: Collection) {
  return {
    collectionId: collection.id,
    collectionVersion: collection.version,
    structId: collection.struct.id,
    structVersion: collection.struct.version,
  }
}

export function collectionRendererService(
  store: Store,
  collections: ReturnType<typeof collectionService>,
) {
  function read(collection: Collection): CollectionRenderer {
    const row = store
      .query<RendererRow, [string]>(
        'SELECT * FROM collection_renderers WHERE collection_id = ?',
      )
      .get(collection.id)

    if (!row) {
      const reviewed = reviewRichTextRenderer({
        schemaVersion: 1,
        elements: {},
      })

      return {
        ...provenance(collection),
        version: 0,
        renderer: reviewed.renderer,
        rendererSha256: reviewed.rendererSha256,
        consumerContract: reviewed.consumerContract,
        createdAt: null,
        updatedAt: null,
      }
    }

    if (
      row.collection_id !== collection.id ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      row.schema_version !== 1 ||
      typeof row.renderer !== 'string' ||
      Buffer.byteLength(row.renderer, 'utf8') > 1024 ||
      typeof row.renderer_sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.renderer_sha256) ||
      !timestamp(row.created_at) ||
      !timestamp(row.updated_at)
    )
      throw new ApiError(503, unavailable)

    let reviewed: ReturnType<typeof reviewRichTextRenderer>
    try {
      const value: unknown = JSON.parse(row.renderer)
      reviewed = reviewRichTextRenderer(value)
    } catch {
      throw new ApiError(503, unavailable)
    }

    if (reviewed.rendererSha256 !== row.renderer_sha256)
      throw new ApiError(503, unavailable)

    return {
      ...provenance(collection),
      version: row.version,
      renderer: reviewed.renderer,
      rendererSha256: reviewed.rendererSha256,
      consumerContract: reviewed.consumerContract,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  return {
    get(collectionId: string): CollectionRenderer {
      return store.db.transaction(() => read(collections.get(collectionId)))()
    },
    save(
      actor: string,
      collectionId: string,
      value: unknown,
      authorize: () => Member,
    ): CollectionRenderer {
      return store.db
        .transaction(() => {
          const current = authorize()
          if (current.id !== actor || current.role !== 'owner')
            throw new ApiError(403, 'Owner access required')

          const input = saveInput(value)
          if (!input)
            throw new ApiError(
              400,
              'Provide the current renderer version and reviewed HTML settings',
            )

          const collection = collections.get(collectionId)
          const original = read(collection)
          const reviewed = reviewRichTextRenderer(input.renderer)
          if (
            original.version !== input.version ||
            original.version === Number.MAX_SAFE_INTEGER
          )
            throw new ApiError(409, changed)

          const version = original.version + 1
          const renderer = JSON.stringify(reviewed.renderer)
          const now = new Date().toISOString()

          const result =
            original.version === 0
              ? store
                  .query(
                    'INSERT INTO collection_renderers (collection_id, version, schema_version, renderer, renderer_sha256, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?)',
                  )
                  .run(
                    collection.id,
                    version,
                    renderer,
                    reviewed.rendererSha256,
                    now,
                    now,
                  )
              : store
                  .query(
                    'UPDATE collection_renderers SET version = ?, schema_version = 1, renderer = ?, renderer_sha256 = ?, updated_at = ? WHERE collection_id = ? AND version = ?',
                  )
                  .run(
                    version,
                    renderer,
                    reviewed.rendererSha256,
                    now,
                    collection.id,
                    original.version,
                  )
          if (result.changes !== 1) throw new ApiError(409, changed)

          store.audit(actor, 'collection.renderer.saved', collection.id)

          return read(collection)
        })
        .immediate()
    },
  }
}
