import { create } from 'zustand'
import type { StructField, StructSchema } from '../src/structs/model'
import type { EntryData, EntryValue } from '../src/collections/model'
import type { Collection, ContentEntry } from './lib/api'

export type ContentValue =
  | { type: 'text' | 'number' | 'select'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'object'; fields: ContentFields }
  | { type: 'array'; items: { id: string; value: ContentValue }[] }

export type ContentFields = Record<
  string,
  { included: boolean; value: ContentValue }
>

export function contentValue(
  schema: StructSchema,
  value?: EntryValue,
): ContentValue {
  switch (schema.type) {
    case 'text':
    case 'select':
      return {
        type: schema.type,
        value: typeof value === 'string' ? value : '',
      }
    case 'number':
      return {
        type: schema.type,
        value: typeof value === 'number' ? String(value) : '',
      }
    case 'boolean':
      return {
        type: schema.type,
        value: typeof value === 'boolean' ? value : false,
      }
    case 'object':
      return {
        type: schema.type,
        fields: contentFields(
          schema.fields,
          value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : undefined,
        ),
      }
    case 'array':
      return {
        type: schema.type,
        items: Array.isArray(value)
          ? value.map((item) => ({
              id: crypto.randomUUID(),
              value: contentValue(schema.items, item),
            }))
          : [],
      }
  }
}

function contentFields(fields: StructField[], data?: EntryData): ContentFields {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      {
        included: data ? Object.hasOwn(data, field.key) : field.required,
        value: contentValue(field.schema, data?.[field.key]),
      },
    ]),
  )
}

const encoder = new TextEncoder()
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
export const contentBounds =
  'This entry is too large. Shorten text or remove list items.'

type ContentProblem = { key: string; values?: Record<string, string | number> }
type PreparedEntry =
  { data: EntryData; error: null } | { data: null; error: ContentProblem }

export function prepareEntry(
  fields: StructField[],
  values: ContentFields,
): PreparedEntry {
  let visited = 1
  let error: ContentProblem | null = null

  function fail(key: string, values?: Record<string, string | number>) {
    error ??= { key, values }
    return undefined
  }

  function readValue(
    schema: StructSchema,
    value: ContentValue,
    path: string,
    depth: number,
  ): EntryValue | undefined {
    if (++visited > 1024 || depth > 6) return fail(contentBounds)
    if (schema.type !== value.type)
      return fail('Check the value for {field}.', { field: path })

    if (schema.type === 'object' && value.type === 'object')
      return readFields(schema.fields, value.fields, path, depth)
    if (schema.type === 'array' && value.type === 'array') {
      if (value.items.length > 128) return fail(contentBounds)

      const items: EntryValue[] = []
      for (const item of value.items) {
        const saved = readValue(
          schema.items,
          item.value,
          `${path} · ${items.length + 1}`,
          depth + 1,
        )
        if (saved === undefined) return undefined

        items.push(saved)
      }

      return items
    }
    if (schema.type === 'boolean' && value.type === 'boolean')
      return value.value
    if (schema.type === 'number' && value.type === 'number') {
      const raw = value.value.trim()
      if (!raw || !numberPattern.test(raw) || !Number.isFinite(Number(raw)))
        return fail('Enter a finite number for {field}.', { field: path })

      return Number(raw)
    }
    if (
      (schema.type === 'text' || schema.type === 'select') &&
      (value.type === 'text' || value.type === 'select')
    ) {
      if (encoder.encode(value.value).length > 4096) return fail(contentBounds)
      if (
        schema.type === 'select' &&
        !schema.options.some((option) => option.value === value.value)
      )
        return fail('Choose a value for {field}.', { field: path })

      return value.value
    }

    return fail('Check the value for {field}.', { field: path })
  }

  function readFields(
    definitions: StructField[],
    current: ContentFields,
    parent: string,
    depth: number,
  ): EntryData | undefined {
    const data: EntryData = {}

    for (const field of definitions) {
      const entry = current[field.key]
      const path = parent ? `${parent} · ${field.label}` : field.label

      if (!entry || (field.required && !entry.included))
        return fail('Include the required field {field}.', { field: path })
      if (!entry.included) continue

      const value = readValue(field.schema, entry.value, path, depth + 1)
      if (value === undefined) return undefined

      data[field.key] = value
    }

    return data
  }

  const data = readFields(fields, values, '', 0)

  if (!data || error)
    return { data: null, error: error ?? { key: contentBounds } }
  if (encoder.encode(JSON.stringify(data)).length > 16_384)
    return { data: null, error: { key: contentBounds } }

  return { data, error: null }
}

type ContentEntryDraft = {
  collectionId: string | null
  active: boolean
  entry: ContentEntry | null
  editing: boolean
  fields: ContentFields
  baseline: string
  dirty: boolean
  epoch: number
  begin: (collection: Collection) => void
  show: (collection: Collection, entry: ContentEntry) => void
  startEditing: () => void
  edit: (fields: ContentFields) => void
  reset: (collectionId?: string) => void
}

export const useContentEntryDraft = create<ContentEntryDraft>((set) => ({
  collectionId: null,
  active: false,
  entry: null,
  editing: false,
  fields: {},
  baseline: '',
  dirty: false,
  epoch: 0,
  begin(collection) {
    set((current) => ({
      collectionId: collection.id,
      active: true,
      entry: null,
      editing: false,
      fields: contentFields(collection.struct.fields),
      baseline: '',
      dirty: true,
      epoch: current.epoch + 1,
    }))
  },
  show(collection, entry) {
    const fields = contentFields(collection.struct.fields, entry.data)

    set((current) => ({
      collectionId: collection.id,
      active: true,
      entry,
      editing: false,
      fields,
      baseline: JSON.stringify(fields),
      dirty: false,
      epoch: current.epoch + 1,
    }))
  },
  startEditing() {
    set((current) =>
      current.active && current.entry && !current.editing
        ? {
            editing: true,
            baseline: JSON.stringify(current.fields),
            dirty: false,
            epoch: current.epoch + 1,
          }
        : current,
    )
  },
  edit(fields) {
    set((current) =>
      current.active && (!current.entry || current.editing)
        ? {
            fields,
            dirty:
              !current.entry || JSON.stringify(fields) !== current.baseline,
          }
        : current,
    )
  },
  reset(collectionId) {
    set((current) => ({
      collectionId: collectionId ?? null,
      active: false,
      entry: null,
      editing: false,
      fields: {},
      baseline: '',
      dirty: false,
      epoch: current.epoch + 1,
    }))
  },
}))
