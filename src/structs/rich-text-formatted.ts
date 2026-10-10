export type FormattedRichTextMark =
  'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'

export type FormattedRichTextText = {
  type: 'text'
  text: string
  marks: FormattedRichTextMark[]
}

export type FormattedRichTextLineBreak = {
  type: 'lineBreak'
}

export type FormattedRichTextParagraph = {
  type: 'paragraph'
  children: FormattedRichTextInline[]
}

export type FormattedRichTextHeading = {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: FormattedRichTextInline[]
}

export type FormattedRichTextLink = {
  type: 'link'
  url: string
  children: FormattedRichTextText[]
}

export type FormattedRichTextList = {
  type: 'list'
  ordered: boolean
  start: number
  children: FormattedRichTextListItem[]
}

export type FormattedRichTextListItem = {
  type: 'listItem'
  children: (FormattedRichTextParagraph | FormattedRichTextList)[]
}

export type FormattedRichTextTable = {
  type: 'table'
  children: FormattedRichTextTableRow[]
}

export type FormattedRichTextTableRow = {
  type: 'tableRow'
  children: FormattedRichTextTableCell[]
}

export type FormattedRichTextTableCell = {
  type: 'tableCell'
  header: boolean
  children: FormattedRichTextParagraph[]
}

export type FormattedRichTextQuote = {
  type: 'quote'
  children: FormattedRichTextParagraph[]
}

export const formattedRichTextCodeLanguages = [
  'plaintext',
  'javascript',
] as const

export type FormattedRichTextCodeLanguage =
  (typeof formattedRichTextCodeLanguages)[number]

export type FormattedRichTextCode = {
  type: 'code'
  language: FormattedRichTextCodeLanguage
  text: string
}

export type FormattedRichTextHorizontalRule = {
  type: 'horizontalRule'
}

export type FormattedRichTextInline =
  FormattedRichTextText | FormattedRichTextLink | FormattedRichTextLineBreak
export type FormattedRichTextBlock =
  | FormattedRichTextParagraph
  | FormattedRichTextHeading
  | FormattedRichTextList
  | FormattedRichTextTable
  | FormattedRichTextQuote
  | FormattedRichTextCode
  | FormattedRichTextHorizontalRule

export type FormattedRichTextDocument = {
  type: 'document'
  astVersion: 2
  children: FormattedRichTextBlock[]
}

type NodeContext =
  | 'document'
  | 'block'
  | 'inline'
  | 'text'
  | 'listItem'
  | 'itemBlock'
  | 'tableRow'
  | 'tableCell'
  | 'cellParagraph'
  | 'quoteParagraph'

const encoder = new TextEncoder()
const marks = new Set(['bold', 'italic', 'underline', 'strikethrough', 'code'])
const codeLanguages = new Set<string>(formattedRichTextCodeLanguages)
const contextTypes: Record<NodeContext, ReadonlySet<string>> = {
  document: new Set(['document']),
  block: new Set([
    'paragraph',
    'heading',
    'list',
    'table',
    'quote',
    'code',
    'horizontalRule',
  ]),
  inline: new Set(['text', 'link', 'lineBreak']),
  text: new Set(['text']),
  listItem: new Set(['listItem']),
  itemBlock: new Set(['paragraph', 'list']),
  tableRow: new Set(['tableRow']),
  tableCell: new Set(['tableCell']),
  cellParagraph: new Set(['paragraph']),
  quoteParagraph: new Set(['paragraph']),
}

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

function safeLink(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    encoder.encode(value).length > 2048 ||
    /[\\\u0000-\u0020\u007f]/.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)
  )
    return false

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.href === value
    )
  } catch {
    return false
  }
}

export function parseFormattedRichTextDocument(
  value: unknown,
): FormattedRichTextDocument | null {
  const pending: {
    value: unknown
    depth: number
    context: NodeContext
    columns?: number
  }[] = [{ value, depth: 0, context: 'document' }]
  let nodes = 0

  while (pending.length) {
    const current = pending.pop()!
    if (++nodes > 128 || current.depth > 6 || !record(current.value))
      return null

    const node = current.value
    if (
      typeof node.type !== 'string' ||
      !contextTypes[current.context].has(node.type)
    )
      return null

    if (node.type === 'text') {
      if (
        !exactKeys(node, ['type', 'text', 'marks']) ||
        typeof node.text !== 'string' ||
        node.text.length > 4096 ||
        encoder.encode(node.text).length > 4096 ||
        !Array.isArray(node.marks) ||
        node.marks.length > 5 ||
        new Set(node.marks).size !== node.marks.length ||
        !node.marks.every((mark) => typeof mark === 'string' && marks.has(mark))
      )
        return null

      continue
    }

    if (node.type === 'lineBreak') {
      if (!exactKeys(node, ['type'])) return null

      continue
    }

    if (node.type === 'horizontalRule') {
      if (!exactKeys(node, ['type'])) return null

      continue
    }

    if (node.type === 'code') {
      if (
        !exactKeys(node, ['type', 'language', 'text']) ||
        typeof node.language !== 'string' ||
        !codeLanguages.has(node.language) ||
        typeof node.text !== 'string' ||
        node.text.length > 4096 ||
        encoder.encode(node.text).length > 4096
      )
        return null

      continue
    }

    let childContext: NodeContext
    switch (node.type) {
      case 'document':
        if (
          node.astVersion !== 2 ||
          !exactKeys(node, ['type', 'astVersion', 'children'])
        )
          return null

        childContext = 'block'
        break
      case 'paragraph':
        if (!exactKeys(node, ['type', 'children'])) return null

        childContext = 'inline'
        break
      case 'heading':
        if (
          !exactKeys(node, ['type', 'level', 'children']) ||
          typeof node.level !== 'number' ||
          !Number.isInteger(node.level) ||
          node.level < 1 ||
          node.level > 6
        )
          return null

        childContext = 'inline'
        break
      case 'link':
        if (
          !exactKeys(node, ['type', 'url', 'children']) ||
          !safeLink(node.url)
        )
          return null

        childContext = 'text'
        break
      case 'list':
        if (
          !exactKeys(node, ['type', 'ordered', 'start', 'children']) ||
          typeof node.ordered !== 'boolean' ||
          typeof node.start !== 'number' ||
          !Number.isInteger(node.start) ||
          node.start < 1 ||
          node.start > 1_000_000 ||
          (!node.ordered && node.start !== 1)
        )
          return null

        childContext = 'listItem'
        break
      case 'listItem':
        if (!exactKeys(node, ['type', 'children'])) return null

        childContext = 'itemBlock'
        break
      case 'table':
        if (!exactKeys(node, ['type', 'children'])) return null

        childContext = 'tableRow'
        break
      case 'tableRow':
        if (!exactKeys(node, ['type', 'children'])) return null

        childContext = 'tableCell'
        break
      case 'tableCell':
        if (
          !exactKeys(node, ['type', 'header', 'children']) ||
          typeof node.header !== 'boolean'
        )
          return null

        childContext = 'cellParagraph'
        break
      case 'quote':
        if (!exactKeys(node, ['type', 'children'])) return null

        childContext = 'quoteParagraph'
        break
      default:
        return null
    }

    if (
      !Array.isArray(node.children) ||
      nodes + pending.length + node.children.length > 128
    )
      return null

    if (
      node.type === 'listItem' &&
      (!node.children.length ||
        !record(node.children[0]) ||
        node.children[0].type !== 'paragraph')
    )
      return null

    let childColumns: number | undefined
    if (node.type === 'table') {
      if (
        !node.children.length ||
        node.children.length > 16 ||
        !record(node.children[0]) ||
        !Array.isArray(node.children[0].children) ||
        !node.children[0].children.length ||
        node.children[0].children.length > 8
      )
        return null

      childColumns = node.children[0].children.length
    } else if (node.type === 'tableRow') {
      if (
        !node.children.length ||
        node.children.length > 8 ||
        node.children.length !== current.columns
      )
        return null
    } else if (
      (node.type === 'tableCell' || node.type === 'quote') &&
      !node.children.length
    ) {
      return null
    }

    for (const child of node.children)
      pending.push({
        value: child,
        depth: current.depth + 1,
        context: childContext,
        columns: childColumns,
      })
  }

  return value as FormattedRichTextDocument
}
