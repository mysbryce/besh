import type { StructField, StructSchema } from '../../../src/structs/model'

export type HtmlField = {
  id: string
  key: string
  path: (string | number)[]
  labels: (string | number)[]
  schema: Extract<StructSchema, { type: 'richText' }>
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function savedHtmlFields(fields: StructField[], data: unknown) {
  const result: HtmlField[] = []
  let visited = 0

  function visit(
    schema: StructSchema,
    value: unknown,
    path: (string | number)[],
    labels: (string | number)[],
    key: string,
  ) {
    if (path.length > 6 || ++visited > 1024) return

    if (schema.type === 'richText') {
      const paired =
        (schema.schemaVersion === 1 && schema.astVersion === 1) ||
        (schema.schemaVersion === 2 && schema.astVersion === 2)

      if (
        paired &&
        record(value) &&
        value.type === 'document' &&
        value.astVersion === schema.astVersion
      )
        result.push({ id: JSON.stringify(path), key, path, labels, schema })

      // Rich-text nodes are content, never additional selectable Struct fields.
      return
    }

    if (schema.type === 'object' && record(value)) {
      for (const field of schema.fields) {
        if (!Object.hasOwn(value, field.key)) continue

        visit(
          field.schema,
          value[field.key],
          [...path, field.key],
          [...labels, field.label],
          field.key,
        )
      }

      return
    }

    if (schema.type !== 'array' || !Array.isArray(value)) return

    for (let index = 0; index < Math.min(value.length, 128); index++) {
      if (!Object.hasOwn(value, index)) continue

      visit(
        schema.items,
        value[index],
        [...path, index],
        [...labels, index + 1],
        key,
      )
    }
  }

  visit({ type: 'object', fields }, data, [], [], '')

  return result
}
