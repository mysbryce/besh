import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ApiError } from '../errors'
import { parseRichTextDocument } from '../structs/rich-text'
import { parseFormattedRichTextDocument } from '../structs/rich-text-formatted'
import type { Store } from '../workspace/store'
import type { Flow } from './model'
import { cmsGraphqlSchema } from './cms-graphql-schema'

const maximumBytes = 262_144
const opaqueId = /^[A-Za-z0-9_-]{1,80}$/
const digest = /^[a-f0-9]{64}$/
const version = z.number().int().positive().safe()
const fieldKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/)
  .refine((value) => !['constructor', 'prototype', '__proto__'].includes(value))
const fieldPath = z
  .array(z.union([fieldKey, z.number().int().nonnegative().safe()]))
  .min(1)
  .max(6)

const previewSchema = z
  .object({
    collectionId: z.string().uuid(),
    collectionVersion: version,
    structId: z.string().uuid(),
    structVersion: version,
    entryId: z.string().uuid(),
    entryVersion: version,
    fieldKey,
    fieldPath,
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    astVersion: z.union([z.literal(1), z.literal(2)]),
    rendererSchemaVersion: z.literal(1),
    rendererSha256: z.string().regex(digest),
    rendererVersion: z.number().int().nonnegative().safe(),
    consumerContract: z.literal('besh.fixed-heading-id.v1').nullable(),
    html: z.string().max(maximumBytes),
  })
  .strict()

const payloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    document: z.unknown(),
    preview: previewSchema,
  })
  .strict()

type SnapshotRow = {
  cms: number
  flow_revision: number
  snapshot_id: string
  flow_id: string
  node_id: string
  draft_revision: number
  sha256: string
  payload: string
}

function unavailable(): never {
  throw new ApiError(503, 'Content snapshot is unavailable')
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
  if (encoded === undefined) unavailable()

  return encoded
}

export function hasCmsSnapshot(definition: Flow): boolean {
  return definition.nodes.some((node) => node.type === 'cmsSnapshotResponse')
}

export function readCmsSnapshot(
  store: Store,
  release: { flowId: string; revision: number; definition: Flow },
) {
  const { definition } = release
  const terminal = definition.nodes.find(
    (node) => node.type === 'cmsSnapshotResponse',
  )
  const request = definition.nodes.find((node) => node.type === 'request')
  const edge = definition.edges[0]
  if (
    !Number.isSafeInteger(release.revision) ||
    release.revision < 1 ||
    !terminal ||
    !request ||
    terminal.id === request.id ||
    definition.nodes.length !== 2 ||
    definition.edges.length !== 1 ||
    !(
      (definition.method === 'GET' && !definition.graphql) ||
      (definition.method === 'POST' &&
        definition.graphql?.schema === cmsGraphqlSchema)
    ) ||
    definition.websocket ||
    definition.contract ||
    definition.path.length > 160 ||
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(definition.path) ||
    Object.keys(request.config).length !== 0 ||
    !edge ||
    edge.source !== request.id ||
    edge.target !== terminal.id ||
    edge.sourceHandle != null ||
    Object.keys(terminal.config).length !== 2 ||
    typeof terminal.config.snapshotId !== 'string' ||
    typeof terminal.config.snapshotSha256 !== 'string' ||
    !opaqueId.test(terminal.config.snapshotId) ||
    !digest.test(terminal.config.snapshotSha256)
  )
    unavailable()

  const row = store
    .query<SnapshotRow, [string, string]>(
      `SELECT f.cms, f.revision AS flow_revision, s.*
       FROM cms_snapshots s JOIN flows f ON f.id = s.flow_id
       WHERE s.snapshot_id = ? AND f.id = ?`,
    )
    .get(terminal.config.snapshotId, release.flowId)
  if (
    !row ||
    row.cms !== 1 ||
    row.flow_revision !== release.revision ||
    row.flow_id !== release.flowId ||
    row.snapshot_id !== terminal.config.snapshotId ||
    row.node_id !== terminal.id ||
    row.draft_revision !== release.revision ||
    row.sha256 !== terminal.config.snapshotSha256 ||
    typeof row.payload !== 'string' ||
    Buffer.byteLength(row.payload, 'utf8') > maximumBytes ||
    createHash('sha256').update(row.payload, 'utf8').digest('hex') !==
      row.sha256
  )
    unavailable()

  // Semantic CMS bounds remain separate from the shallow executable graph.
  try {
    const payload = payloadSchema.safeParse(JSON.parse(row.payload))
    if (!payload.success) unavailable()

    const { preview } = payload.data
    const namedKey = preview.fieldPath
      .filter((segment) => typeof segment === 'string')
      .at(-1)
    if (
      preview.schemaVersion !== preview.astVersion ||
      typeof preview.fieldPath[0] !== 'string' ||
      namedKey !== preview.fieldKey ||
      Buffer.byteLength(preview.html, 'utf8') > maximumBytes
    )
      unavailable()

    const document =
      preview.astVersion === 1
        ? parseRichTextDocument(payload.data.document)
        : parseFormattedRichTextDocument(payload.data.document)
    if (!document || canonical(payload.data) !== row.payload) unavailable()

    const { html, ...reviewed } = preview
    const result = {
      document,
      html,
      provenance: {
        ...reviewed,
        flowId: release.flowId,
        releaseRevision: release.revision,
        snapshotId: terminal.config.snapshotId,
        snapshotSha256: terminal.config.snapshotSha256,
      },
    }
    if (Buffer.byteLength(JSON.stringify(result), 'utf8') > maximumBytes)
      unavailable()

    return result
  } catch {
    unavailable()
  }
}
