export const htmlElements = [
  { tag: 'p', label: 'Paragraph' },
  { tag: 'h1', label: 'Heading 1' },
  { tag: 'h2', label: 'Heading 2' },
  { tag: 'h3', label: 'Heading 3' },
  { tag: 'h4', label: 'Heading 4' },
  { tag: 'h5', label: 'Heading 5' },
  { tag: 'h6', label: 'Heading 6' },
  { tag: 'strong', label: 'Bold' },
  { tag: 'em', label: 'Italic' },
  { tag: 'u', label: 'Underline' },
  { tag: 's', label: 'Strikethrough' },
  { tag: 'code', label: 'Inline code' },
  { tag: 'a', label: 'Link' },
  { tag: 'ul', label: 'Bullet list' },
  { tag: 'ol', label: 'Numbered list' },
  { tag: 'li', label: 'List item' },
  { tag: 'blockquote', label: 'Quote' },
  { tag: 'pre', label: 'Code block' },
  { tag: 'hr', label: 'Divider' },
  { tag: 'br', label: 'Line break' },
  { tag: 'table', label: 'Table' },
  { tag: 'tbody', label: 'Table body' },
  { tag: 'tr', label: 'Table row' },
  { tag: 'th', label: 'Header cell' },
  { tag: 'td', label: 'Table cell' },
] as const

export type HtmlElement = (typeof htmlElements)[number]['tag']
export type ElementSettings = {
  classes: string
  title: string
  ariaLabel: string
  fixedHeading: boolean
}
export type HtmlSettings = Partial<Record<HtmlElement, ElementSettings>>
type RendererElement = {
  classes?: string[]
  attributes?: Record<string, string>
}
export type HtmlRenderer = {
  schemaVersion: 1
  elements: Record<string, RendererElement>
  consumerContract?: 'besh.fixed-heading-id.v1'
}

type PreparedRenderer =
  | {
      renderer: HtmlRenderer
      error: null
    }
  | {
      renderer: null
      error: string
    }

export const emptyElement: ElementSettings = {
  classes: '',
  title: '',
  ariaLabel: '',
  fixedHeading: false,
}

export function prepareHtmlRenderer(settings: HtmlSettings): PreparedRenderer {
  const renderer: HtmlRenderer = { schemaVersion: 1, elements: {} }
  const encoder = new TextEncoder()

  for (const { tag } of htmlElements) {
    const value = settings[tag]
    if (!value) continue

    const tokens = value.classes.trim() ? value.classes.trim().split(/\s+/) : []
    if (
      tokens.length > 8 ||
      tokens.some((token) => !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(token))
    )
      return {
        renderer: null,
        error:
          'Check class names: up to 8 names, each 1 to 64 ASCII characters.',
      }

    if (
      encoder.encode(value.title).byteLength > 160 ||
      encoder.encode(value.ariaLabel).byteLength > 160
    )
      return {
        renderer: null,
        error: 'Shorten the title or accessibility label to 160 UTF-8 bytes.',
      }

    const element: HtmlRenderer['elements'][string] = {}
    const attributes: Record<string, string> = {}

    if (tokens.length) element.classes = tokens
    if (value.title !== '') attributes.title = value.title
    if (value.ariaLabel !== '') attributes['aria-label'] = value.ariaLabel

    if (tag === 'h1' && value.fixedHeading) {
      attributes['x-data'] = 'h1'
      renderer.consumerContract = 'besh.fixed-heading-id.v1'
    }

    if (Object.keys(attributes).length) element.attributes = attributes
    if (Object.keys(element).length) renderer.elements[tag] = element
  }

  if (encoder.encode(JSON.stringify(renderer)).byteLength > 1024)
    return {
      renderer: null,
      error: 'These settings are too large. Remove some settings.',
    }

  return { renderer, error: null }
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

  return JSON.stringify(value) ?? 'null'
}

export function canonicalHtmlRenderer(renderer: HtmlRenderer) {
  return canonical({
    ...renderer,
    consumerContract: renderer.consumerContract ?? null,
  })
}
