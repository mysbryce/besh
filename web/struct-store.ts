import { create } from 'zustand'
import type {
  StructDraft,
  StructField,
  StructSchema,
} from '../src/structs/model'

export type EditorField = Omit<StructField, 'schema'> & {
  id: string
  schema: EditorSchema
}

export type EditorSchema =
  | { type: 'text' | 'number' | 'boolean' }
  | { type: 'object'; fields: EditorField[] }
  | { type: 'array'; items: EditorSchema }
  | { type: 'select'; options: { id: string; value: string; label: string }[] }

export function emptySchema(type: StructSchema['type']): EditorSchema {
  if (type === 'object') return { type, fields: [] }
  if (type === 'array') return { type, items: { type: 'text' } }
  if (type === 'select')
    return {
      type,
      options: [{ id: crypto.randomUUID(), value: '', label: '' }],
    }

  return { type }
}

export function emptyField(): EditorField {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    required: false,
    schema: { type: 'text' },
  }
}

function editableSchema(schema: StructSchema): EditorSchema {
  if (schema.type === 'object')
    return { type: schema.type, fields: editableFields(schema.fields) }
  if (schema.type === 'array')
    return { type: schema.type, items: editableSchema(schema.items) }
  if (schema.type === 'select')
    return {
      type: schema.type,
      options: schema.options.map((option) => ({
        ...option,
        id: crypto.randomUUID(),
      })),
    }

  return { type: schema.type }
}

function editableFields(fields: StructField[]): EditorField[] {
  return fields.map((field) => ({
    ...field,
    id: crypto.randomUUID(),
    schema: editableSchema(field.schema),
  }))
}

function savedSchema(schema: EditorSchema): StructSchema {
  if (schema.type === 'object')
    return { type: schema.type, fields: savedFields(schema.fields) }
  if (schema.type === 'array')
    return { type: schema.type, items: savedSchema(schema.items) }
  if (schema.type === 'select')
    return {
      type: schema.type,
      options: schema.options.map(({ value, label }) => ({ value, label })),
    }

  return { type: schema.type }
}

export function savedFields(fields: EditorField[]): StructField[] {
  return fields.map(({ key, label, required, schema }) => ({
    key,
    label,
    required,
    schema: savedSchema(schema),
  }))
}

export function removesStructure(schema: EditorSchema): boolean {
  if (schema.type === 'object') return schema.fields.length > 0
  if (schema.type === 'select')
    return schema.options.some((option) => !!option.value || !!option.label)
  if (schema.type === 'array') return schema.items.type !== 'text'

  return false
}

const nameError = 'Enter a model name with 1 to 80 characters.'
const fieldError =
  'Complete every field with a valid, unique key and a label of 1 to 80 characters.'
const choiceError =
  'Choices need at least one option. Values must be unique. Values and labels use 1 to 80 characters.'
export const structLimits =
  'Use up to 32 fields per group, 32 choices per field, and 6 nesting levels. Each model supports up to 128 fields and nested item types.'

export function definitionError(name: string, fields: EditorField[]) {
  const validText = (value: string) =>
    value.trim().length >= 1 && value.trim().length <= 80
  if (!validText(name)) return nameError

  let nodes = 0
  function inspectSchema(schema: EditorSchema, depth: number): string | null {
    if (++nodes > 128 || depth > 6) return structLimits
    if (schema.type === 'object') return inspectFields(schema.fields, depth + 1)
    if (schema.type === 'array') return inspectSchema(schema.items, depth + 1)
    if (schema.type === 'select') {
      if (!schema.options.length || schema.options.length > 32)
        return choiceError

      const values = new Set<string>()
      for (const option of schema.options) {
        const value = option.value.trim()
        if (!validText(value) || !validText(option.label) || values.has(value))
          return choiceError

        values.add(value)
      }
    }

    return null
  }

  function inspectFields(entries: EditorField[], depth: number): string | null {
    if (entries.length > 32) return structLimits

    const keys = new Set<string>()
    for (const field of entries) {
      if (
        !/^[a-z][a-z0-9_]{0,63}$/.test(field.key) ||
        ['constructor', 'prototype', '__proto__'].includes(field.key) ||
        !validText(field.label) ||
        keys.has(field.key)
      )
        return fieldError

      keys.add(field.key)
      const error = inspectSchema(field.schema, depth)
      if (error) return error
    }

    return null
  }

  return inspectFields(fields, 1)
}

type DraftState = {
  id: string | null
  version: number | null
  name: string
  fields: EditorField[]
  baseline: string
  dirty: boolean
  epoch: number
  edit: (changes: Partial<Pick<DraftState, 'name' | 'fields'>>) => void
  reset: (draft?: StructDraft) => void
}

export const useStructDraft = create<DraftState>((set) => ({
  id: null,
  version: null,
  name: '',
  fields: [],
  baseline: JSON.stringify({ name: '', fields: [] }),
  dirty: false,
  epoch: 0,
  edit(changes) {
    set((current) => {
      const next = { ...current, ...changes }
      const snapshot = JSON.stringify({
        name: next.name,
        fields: savedFields(next.fields),
      })

      return { ...changes, dirty: snapshot !== current.baseline }
    })
  },
  reset(draft) {
    const name = draft?.name ?? ''
    const fields = draft ? editableFields(draft.fields) : []
    const baseline = JSON.stringify({ name, fields: savedFields(fields) })

    set((current) => ({
      id: draft?.id ?? null,
      version: draft?.version ?? null,
      name,
      fields,
      baseline,
      dirty: false,
      epoch: current.epoch + 1,
    }))
  },
}))
