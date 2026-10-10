import { z } from 'zod'
import { parseStructDefinition, type StructField } from '../structs/model'

export type CollectionStruct = {
  id: string
  version: number
  name: string
  fields: StructField[]
}

export type CollectionSummary = {
  id: string
  name: string
  version: number
  structId: string
  structVersion: number
  createdAt: string
  updatedAt: string
}

export type Collection = Omit<
  CollectionSummary,
  'structId' | 'structVersion'
> & {
  struct: CollectionStruct
}

export type EntryValue = string | number | boolean | EntryData | EntryValue[]
export type EntryData = { [key: string]: EntryValue }
export type ContentEntry = {
  id: string
  collectionId: string
  version: number
  data: EntryData
  createdAt: string
  updatedAt: string
}

export type ContentEntryPage = {
  entries: ContentEntry[]
  total: number
  offset: number
  limit: number
}

const id = z.string().uuid()
const version = z.number().int().positive().safe()
const name = z.string().trim().min(1).max(80)
const createSchema = z
  .object({ name, structId: id, structVersion: version })
  .strict()
const metadataSchema = createSchema.extend({ id, version })
const snapshotSchema = z
  .object({ id, version, name: z.string().min(1).max(80), fields: z.unknown() })
  .strict()

export function parseCollectionInput(value: unknown) {
  const result = createSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCollectionMetadata(value: unknown) {
  const result = metadataSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCollectionSnapshot(
  value: unknown,
): CollectionStruct | null {
  const result = snapshotSchema.safeParse(value)
  if (!result.success) return null

  const definition = parseStructDefinition({
    name: result.data.name,
    fields: result.data.fields,
  })
  if (!definition || definition.name !== result.data.name) return null

  return {
    id: result.data.id,
    version: result.data.version,
    ...definition,
  }
}
