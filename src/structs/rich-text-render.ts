import { createHash } from 'node:crypto'
import { ApiError } from '../errors'
import type {
  RichTextDocument,
  RichTextParagraph,
  RichTextText,
} from './rich-text'
import type {
  FormattedRichTextBlock,
  FormattedRichTextDocument,
  FormattedRichTextInline,
  FormattedRichTextListItem,
  FormattedRichTextMark,
  FormattedRichTextTableCell,
  FormattedRichTextTableRow,
} from './rich-text-formatted'

type RendererElement = {
  classes?: string[]
  attributes?: Record<string, string>
}

export type RichTextRenderer = {
  schemaVersion: 1
  elements: Record<string, RendererElement>
  consumerContract?: 'besh.fixed-heading-id.v1'
}

type RendererConfiguration = Omit<RichTextRenderer, 'consumerContract'> & {
  consumerContract: 'besh.fixed-heading-id.v1' | null
}

const tags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'u',
  's',
  'code',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'br',
  'table',
  'tbody',
  'tr',
  'th',
  'td',
])
const attributes = new Set(['title', 'aria-label', 'x-data'])
const invalidConfiguration = 'Provide a bounded reviewed HTML renderer'
const markTags: Record<FormattedRichTextMark, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strikethrough: 's',
  code: 'code',
}

type RenderNode =
  | RichTextParagraph
  | RichTextText
  | FormattedRichTextBlock
  | FormattedRichTextInline
  | FormattedRichTextListItem
  | FormattedRichTextTableCell
  | FormattedRichTextTableRow

function dataRecord(value: unknown, maximum: number) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (
    keys.length > maximum ||
    keys.some((key) => {
      const descriptor = descriptors[key as string]
      return (
        typeof key !== 'string' ||
        !descriptor ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      )
    })
  )
    return null

  const result: Record<string, unknown> = Object.create(null)
  for (const key of keys as string[]) result[key] = descriptors[key]!.value

  return result
}

function classTokens(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 8) return null

  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(descriptors).length !== value.length + 1) return null

  const result: string[] = []
  for (let index = 0; index < value.length; index++) {
    const descriptor = descriptors[String(index)]
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'string' ||
      descriptor.value.length < 1 ||
      descriptor.value.length > 64 ||
      !/^[A-Za-z_]/.test(descriptor.value) ||
      /[^A-Za-z0-9_-]/.test(descriptor.value)
    )
      return null

    result.push(descriptor.value)
  }

  return result
}

function configuration(value: unknown): RendererConfiguration {
  const input = dataRecord(value, 3)
  if (
    !input ||
    input.schemaVersion !== 1 ||
    !Object.hasOwn(input, 'elements') ||
    Object.keys(input).some(
      (key) => !['schemaVersion', 'elements', 'consumerContract'].includes(key),
    ) ||
    (Object.hasOwn(input, 'consumerContract') &&
      input.consumerContract !== 'besh.fixed-heading-id.v1')
  )
    throw new ApiError(400, invalidConfiguration)

  const elements = dataRecord(input.elements, 25)
  if (!elements) throw new ApiError(400, invalidConfiguration)

  const result: RendererConfiguration = {
    schemaVersion: 1,
    elements: {},
    consumerContract:
      input.consumerContract === 'besh.fixed-heading-id.v1'
        ? input.consumerContract
        : null,
  }
  for (const [tag, value] of Object.entries(elements)) {
    const element = dataRecord(value, 2)
    if (
      !tags.has(tag) ||
      !element ||
      Object.keys(element).some(
        (key) => key !== 'classes' && key !== 'attributes',
      )
    )
      throw new ApiError(400, invalidConfiguration)

    const reviewed: RendererElement = {}
    if (Object.hasOwn(element, 'classes')) {
      const classes = classTokens(element.classes)
      if (!classes) throw new ApiError(400, invalidConfiguration)

      reviewed.classes = classes
    }

    if (Object.hasOwn(element, 'attributes')) {
      const values = dataRecord(element.attributes, 4)
      if (!values) throw new ApiError(400, invalidConfiguration)

      reviewed.attributes = {}
      for (const [name, value] of Object.entries(values)) {
        if (
          !attributes.has(name) ||
          typeof value !== 'string' ||
          value.length > 160 ||
          Buffer.byteLength(value, 'utf8') > 160 ||
          (name === 'x-data' &&
            (tag !== 'h1' ||
              value !== 'h1' ||
              result.consumerContract !== 'besh.fixed-heading-id.v1'))
        )
          throw new ApiError(400, invalidConfiguration)

        reviewed.attributes[name] = value
      }
    }

    result.elements[tag] = reviewed
  }

  const bounded = Object.hasOwn(input, 'consumerContract')
    ? result
    : { schemaVersion: result.schemaVersion, elements: result.elements }
  if (Buffer.byteLength(JSON.stringify(bounded), 'utf8') > 1024)
    throw new ApiError(400, invalidConfiguration)

  return result
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      '{' +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))
        .join(',') +
      '}'
    )
  }

  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new ApiError(400, invalidConfiguration)

  return encoded
}

export function reviewRichTextRenderer(value: unknown) {
  const normalized = configuration(value)
  const { consumerContract, ...base } = normalized
  const renderer: RichTextRenderer =
    consumerContract === null ? base : { ...base, consumerContract }

  return {
    renderer,
    rendererSchemaVersion: normalized.schemaVersion,
    rendererSha256: createHash('sha256')
      .update(canonical(normalized), 'utf8')
      .digest('hex'),
    consumerContract,
  }
}

function escapeText(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function renderRichTextPreview(
  document: RichTextDocument | FormattedRichTextDocument,
  value: unknown,
) {
  const reviewed = reviewRichTextRenderer(value)
  const renderer = reviewed.renderer
  const parts: string[] = []
  let bytes = 0

  function append(part: string) {
    bytes += Buffer.byteLength(part, 'utf8')
    if (bytes > 262_144)
      throw new ApiError(400, 'Rendered HTML exceeds its preview limit')

    parts.push(part)
  }

  function open(tag: string, semanticAttributes: Record<string, string> = {}) {
    const element = renderer.elements[tag]
    append('<' + tag)

    for (const [name, value] of Object.entries(semanticAttributes))
      append(' ' + name + '="' + escapeAttribute(value) + '"')

    if (element?.classes?.length)
      append(' class="' + escapeAttribute(element.classes.join(' ')) + '"')

    const mappedAttributes = element?.attributes ?? {}
    for (const name of Object.keys(mappedAttributes).sort())
      append(' ' + name + '="' + escapeAttribute(mappedAttributes[name]!) + '"')

    append('>')
  }

  function close(tag: string) {
    append('</' + tag + '>')
  }

  function children(nodes: readonly RenderNode[]) {
    for (const node of nodes) render(node)
  }

  function render(node: RenderNode) {
    switch (node.type) {
      case 'text': {
        const marks = 'marks' in node ? node.marks : []

        // Authored mark order determines nesting; the first mark stays outermost.
        for (const mark of marks) open(markTags[mark])

        append(escapeText(node.text))
        for (const mark of [...marks].reverse()) close(markTags[mark])

        return
      }
      case 'lineBreak':
        open('br')
        return
      case 'horizontalRule':
        open('hr')
        return
      case 'link':
        open('a', { href: node.url })
        children(node.children)
        close('a')

        return
      case 'paragraph':
        open('p')
        children(node.children)
        close('p')

        return
      case 'heading': {
        const tag = 'h' + node.level

        open(tag)
        children(node.children)
        close(tag)

        return
      }
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul'
        const semanticAttributes: Record<string, string> =
          node.ordered && node.start !== 1 ? { start: String(node.start) } : {}

        open(tag, semanticAttributes)
        children(node.children)
        close(tag)

        return
      }
      case 'listItem':
        open('li')
        children(node.children)
        close('li')

        return
      case 'table':
        open('table')
        open('tbody')
        children(node.children)
        close('tbody')
        close('table')

        return
      case 'tableRow':
        open('tr')
        children(node.children)
        close('tr')

        return
      case 'tableCell': {
        const tag = node.header ? 'th' : 'td'

        open(tag)
        children(node.children)
        close(tag)

        return
      }
      case 'quote':
        open('blockquote')
        children(node.children)
        close('blockquote')

        return
      case 'code':
        open('pre')
        open('code')
        append(escapeText(node.text))
        close('code')
        close('pre')

        return
      default:
        throw new ApiError(503, 'Content entry is unavailable')
    }
  }

  children(document.children)

  return {
    rendererSchemaVersion: reviewed.rendererSchemaVersion,
    rendererSha256: reviewed.rendererSha256,
    consumerContract: reviewed.consumerContract,
    html: parts.join(''),
  }
}
