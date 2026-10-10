export type RichTextText = {
  type: 'text'
  text: string
}

export type RichTextParagraph = {
  type: 'paragraph'
  children: RichTextText[]
}

export type RichTextDocument = {
  type: 'document'
  astVersion: 1
  children: RichTextParagraph[]
}

const encoder = new TextEncoder()

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const keys = Reflect.ownKeys(value)
  return (
    keys.length === expected.length &&
    keys.every((key) => typeof key === 'string' && expected.includes(key))
  )
}

export function parseRichTextDocument(value: unknown): RichTextDocument | null {
  const pending = [{ value, depth: 0 }]
  let nodes = 0

  while (pending.length) {
    const current = pending.pop()!
    if (++nodes > 128 || current.depth > 2 || !record(current.value))
      return null

    const node = current.value
    if (current.depth === 2) {
      if (
        node.type !== 'text' ||
        !exactKeys(node, ['type', 'text']) ||
        typeof node.text !== 'string' ||
        node.text.length > 4096 ||
        encoder.encode(node.text).length > 4096
      )
        return null

      continue
    }

    if (current.depth === 0) {
      if (
        node.type !== 'document' ||
        node.astVersion !== 1 ||
        !exactKeys(node, ['type', 'astVersion', 'children'])
      )
        return null
    } else if (
      node.type !== 'paragraph' ||
      !exactKeys(node, ['type', 'children'])
    ) {
      return null
    }

    if (
      !Array.isArray(node.children) ||
      nodes + pending.length + node.children.length > 128
    )
      return null

    for (const child of node.children)
      pending.push({ value: child, depth: current.depth + 1 })
  }

  return value as RichTextDocument
}
