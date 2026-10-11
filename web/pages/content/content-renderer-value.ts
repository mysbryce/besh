import type { Collection, CollectionRenderer } from '../../types/api'
import {
  canonicalHtmlRenderer,
  emptyElement,
  htmlElements,
  type HtmlRenderer,
  type HtmlSettings,
} from './content-html-mapping'

function record(value: unknown, maximum: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

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
        !descriptor?.enumerable ||
        !('value' in descriptor)
      )
    })
  )
    return null

  return value as Record<string, unknown>
}

export function rendererWire(value: unknown): value is HtmlRenderer {
  const input = record(value, 3)
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
    return false

  const elements = record(input.elements, 25)
  if (!elements) return false

  const encoder = new TextEncoder()
  for (const [tag, value] of Object.entries(elements)) {
    const element = record(value, 2)
    if (
      !htmlElements.some((item) => item.tag === tag) ||
      !element ||
      Object.keys(element).some(
        (key) => key !== 'classes' && key !== 'attributes',
      )
    )
      return false

    if (Object.hasOwn(element, 'classes')) {
      const classes = element.classes
      if (
        !Array.isArray(classes) ||
        classes.length > 8 ||
        Reflect.ownKeys(classes).length !== classes.length + 1
      )
        return false

      for (let index = 0; index < classes.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(
          classes,
          String(index),
        )
        if (
          !descriptor?.enumerable ||
          !('value' in descriptor) ||
          typeof descriptor.value !== 'string' ||
          !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(descriptor.value)
        )
          return false
      }
    }

    if (Object.hasOwn(element, 'attributes')) {
      const attributes = record(element.attributes, 3)
      if (!attributes) return false

      for (const [name, value] of Object.entries(attributes)) {
        if (
          !['title', 'aria-label', 'x-data'].includes(name) ||
          typeof value !== 'string' ||
          encoder.encode(value).byteLength > 160 ||
          (name === 'x-data' &&
            (tag !== 'h1' ||
              value !== 'h1' ||
              input.consumerContract !== 'besh.fixed-heading-id.v1'))
        )
          return false
      }
    }
  }

  return encoder.encode(JSON.stringify(value)).byteLength <= 1024
}

export function rendererSettings(renderer: HtmlRenderer): HtmlSettings {
  const settings: HtmlSettings = {}

  for (const { tag } of htmlElements) {
    const element = renderer.elements[tag]
    if (!element) continue

    settings[tag] = {
      classes: element.classes?.join(' ') ?? '',
      title: element.attributes?.title ?? '',
      ariaLabel: element.attributes?.['aria-label'] ?? '',
      fixedHeading: element.attributes?.['x-data'] === 'h1',
    }
  }

  return settings
}

export function sameRendererSettings(left: HtmlSettings, right: HtmlSettings) {
  return htmlElements.every(({ tag }) => {
    const before = left[tag] ?? emptyElement
    const after = right[tag] ?? emptyElement

    return (
      before.classes === after.classes &&
      before.title === after.title &&
      before.ariaLabel === after.ariaLabel &&
      before.fixedHeading === after.fixedHeading
    )
  })
}

export function patchRendererSettings(
  wire: HtmlRenderer,
  previous: HtmlSettings,
  settings: HtmlSettings,
) {
  const renderer = structuredClone(wire)

  // Edit only the property changed by its control; untouched wire stays exact.
  for (const { tag } of htmlElements) {
    const before = previous[tag] ?? emptyElement
    const after = settings[tag] ?? emptyElement
    const changed =
      before.classes !== after.classes ||
      before.title !== after.title ||
      before.ariaLabel !== after.ariaLabel ||
      before.fixedHeading !== after.fixedHeading
    if (!changed) continue

    const element = renderer.elements[tag] ?? {}
    const attributes = element.attributes ?? {}
    let attributesChanged = false

    if (before.classes !== after.classes) {
      const classes = after.classes.trim()
        ? after.classes.trim().split(/\s+/)
        : []

      if (classes.length) element.classes = classes
      else delete element.classes
    }

    for (const [control, attribute] of [
      ['title', 'title'],
      ['ariaLabel', 'aria-label'],
    ] as const) {
      if (before[control] === after[control]) continue

      attributesChanged = true
      if (after[control] !== '') attributes[attribute] = after[control]
      else delete attributes[attribute]
    }

    if (tag === 'h1' && before.fixedHeading !== after.fixedHeading) {
      attributesChanged = true

      if (after.fixedHeading) {
        attributes['x-data'] = 'h1'
        renderer.consumerContract = 'besh.fixed-heading-id.v1'
      } else {
        delete attributes['x-data']
        delete renderer.consumerContract
      }
    }

    if (attributesChanged) {
      if (Object.keys(attributes).length) element.attributes = attributes
      else delete element.attributes
    }

    if (Object.keys(element).length) renderer.elements[tag] = element
    else delete renderer.elements[tag]
  }

  const encoder = new TextEncoder()
  for (const value of Object.values(settings)) {
    if (!value) continue

    const classes = value.classes.trim()
      ? value.classes.trim().split(/\s+/)
      : []
    if (
      classes.length > 8 ||
      classes.some((token) => !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(token))
    )
      return {
        renderer,
        error:
          'Check class names: up to 8 names, each 1 to 64 ASCII characters.',
      }

    if (
      encoder.encode(value.title).byteLength > 160 ||
      encoder.encode(value.ariaLabel).byteLength > 160
    )
      return {
        renderer,
        error: 'Shorten the title or accessibility label to 160 UTF-8 bytes.',
      }
  }

  if (!rendererWire(renderer))
    return {
      renderer,
      error: 'These settings are too large. Remove some settings.',
    }

  return { renderer, error: '' }
}

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const parsed = Date.parse(value)

  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

export async function verifyCollectionRenderer(
  value: unknown,
  collection: Collection,
): Promise<CollectionRenderer | null> {
  const result = record(value, 10)
  const keys = [
    'collectionId',
    'collectionVersion',
    'structId',
    'structVersion',
    'version',
    'renderer',
    'rendererSha256',
    'consumerContract',
    'createdAt',
    'updatedAt',
  ]
  if (
    !result ||
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key)) ||
    result.collectionId !== collection.id ||
    result.collectionVersion !== collection.version ||
    result.structId !== collection.struct.id ||
    result.structVersion !== collection.struct.version ||
    typeof result.version !== 'number' ||
    !Number.isSafeInteger(result.version) ||
    result.version < 0 ||
    !rendererWire(result.renderer) ||
    typeof result.rendererSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(result.rendererSha256) ||
    result.consumerContract !== (result.renderer.consumerContract ?? null)
  )
    return null

  if (result.version === 0) {
    if (
      result.createdAt !== null ||
      result.updatedAt !== null ||
      Object.keys(result.renderer.elements).length !== 0 ||
      Object.hasOwn(result.renderer, 'consumerContract')
    )
      return null
  } else if (!timestamp(result.createdAt) || !timestamp(result.updatedAt)) {
    return null
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalHtmlRenderer(result.renderer)),
  )
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (hash !== result.rendererSha256) return null

  // Validation keeps accepted wire shapes and ordering instead of rebuilding them.
  return value as CollectionRenderer
}
