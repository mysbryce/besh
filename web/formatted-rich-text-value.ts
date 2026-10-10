import type {
  FormattedRichTextBlock,
  FormattedRichTextDocument,
  FormattedRichTextTable,
  FormattedRichTextList,
  FormattedRichTextListItem,
} from '../src/structs/rich-text-formatted'
import { parseFormattedRichTextDocument } from '../src/structs/rich-text-formatted'

export const unsupportedFormattedText =
  'This content contains formatting this editor cannot edit yet.'

export function canEditFormattedText(document: FormattedRichTextDocument) {
  return document.children.every(canEditBlock)
}

export function canUseFormattedLink(url: string) {
  return (
    parseFormattedRichTextDocument({
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'link', url, children: [] }],
        },
      ],
    }) !== null
  )
}

export function canGrowFormattedTable(
  document: FormattedRichTextDocument,
  tableIndex: number,
  after: number,
  dimension: 'row' | 'column',
) {
  const candidate = structuredClone(document)
  const table = candidate.children[tableIndex]
  if (!table || table.type !== 'table' || !Number.isInteger(after) || after < 0)
    return false

  const columns = table.children[0]?.children.length ?? 0
  if (
    (dimension === 'row' &&
      (table.children.length >= 16 || after >= table.children.length)) ||
    (dimension === 'column' && (columns >= 8 || after >= columns))
  )
    return false

  if (dimension === 'row') {
    table.children.splice(after + 1, 0, {
      type: 'tableRow',
      children: Array.from({ length: columns }, () => ({
        type: 'tableCell',
        header: false,
        children: [{ type: 'paragraph', children: [] }],
      })),
    })
  } else {
    for (const row of table.children) {
      const previous = row.children[after]
      if (!previous) return false

      row.children.splice(after + 1, 0, {
        type: 'tableCell',
        header: previous.header,
        children: [{ type: 'paragraph', children: [] }],
      })
    }
  }

  return parseFormattedRichTextDocument(candidate) !== null
}

export function canInsertFormattedTable(
  document: FormattedRichTextDocument,
  blockIndex: number,
  replacePlaceholder: boolean,
) {
  if (
    !Number.isInteger(blockIndex) ||
    blockIndex < 0 ||
    blockIndex >= document.children.length
  )
    return false

  const table: FormattedRichTextTable = {
    type: 'table',
    children: Array.from({ length: 2 }, (_, row) => ({
      type: 'tableRow',
      children: Array.from({ length: 2 }, () => ({
        type: 'tableCell',
        header: row === 0,
        // Native insertion normalizes its empty caret text out of each paragraph.
        children: [{ type: 'paragraph', children: [] }],
      })),
    })),
  }
  const candidate = { ...document, children: [...document.children] }

  if (replacePlaceholder) candidate.children.splice(blockIndex, 1, table)
  else candidate.children.splice(blockIndex + 1, 0, table)

  return parseFormattedRichTextDocument(candidate) !== null
}

export function canInsertFormattedDivider(
  document: FormattedRichTextDocument,
  blockIndex: number,
) {
  if (
    !Number.isInteger(blockIndex) ||
    blockIndex < 0 ||
    blockIndex >= document.children.length
  )
    return false

  const candidate = { ...document, children: [...document.children] }
  candidate.children.splice(
    blockIndex + 1,
    0,
    { type: 'horizontalRule' },
    { type: 'paragraph', children: [] },
  )

  return parseFormattedRichTextDocument(candidate) !== null
}

export function canConvertFormattedQuote(
  document: FormattedRichTextDocument,
  blockIndex: number,
) {
  if (!Number.isInteger(blockIndex) || blockIndex < 0) return false

  const block = document.children[blockIndex]
  if (!block || (block.type !== 'paragraph' && block.type !== 'heading'))
    return false

  const candidate = { ...document, children: [...document.children] }
  candidate.children[blockIndex] = {
    type: 'quote',
    children: [{ type: 'paragraph', children: block.children }],
  }

  return parseFormattedRichTextDocument(candidate) !== null
}

export function canConvertFormattedLists(
  document: FormattedRichTextDocument,
  blockIndices: readonly number[],
  ordered: boolean,
) {
  const candidate = structuredClone(document)
  const targets = blockIndices.map((index) => candidate.children[index])
  if (targets.some((block) => !block)) return false

  for (const block of targets) {
    const index = candidate.children.indexOf(block)
    if (index < 0) continue

    if (block.type === 'list') {
      block.ordered = ordered
      if (!ordered) block.start = 1
      continue
    }
    if (block.type !== 'paragraph' && block.type !== 'heading') return false

    const item: FormattedRichTextListItem = {
      type: 'listItem',
      children: [{ type: 'paragraph', children: block.children }],
    }
    const previous = candidate.children[index - 1]
    const next = candidate.children[index + 1]

    // Native conversion explicitly reuses neighbouring lists of the requested kind.
    if (previous?.type === 'list' && previous.ordered === ordered) {
      previous.children.push(item)
      if (next?.type === 'list' && next.ordered === ordered) {
        previous.children.push(...next.children)
        candidate.children.splice(index, 2)
      } else {
        candidate.children.splice(index, 1)
      }
    } else if (next?.type === 'list' && next.ordered === ordered) {
      next.children.unshift(item)
      candidate.children.splice(index, 1)
    } else {
      const list: FormattedRichTextList = {
        type: 'list',
        ordered,
        start: 1,
        children: [item],
      }
      candidate.children.splice(index, 1, list)
    }
  }

  return parseFormattedRichTextDocument(candidate) !== null
}

type ListItemLocation = {
  list: FormattedRichTextList
  index: number
  parentList: FormattedRichTextList | null
  parentItem: FormattedRichTextListItem | null
}

function findListItem(
  list: FormattedRichTextList,
  target: FormattedRichTextListItem,
  parentList: FormattedRichTextList | null = null,
  parentItem: FormattedRichTextListItem | null = null,
): ListItemLocation | null {
  for (const [index, item] of list.children.entries()) {
    if (item === target) return { list, index, parentList, parentItem }

    for (const child of item.children) {
      if (child.type !== 'list') continue

      const found = findListItem(child, target, list, item)
      if (found) return found
    }
  }

  return null
}

export function canMoveFormattedListItem(
  document: FormattedRichTextDocument,
  item: FormattedRichTextListItem,
  direction: 'indent' | 'outdent',
) {
  // Clone both together so their shared identity survives without a position cache.
  const candidate = structuredClone({ document, item })
  let location: ListItemLocation | null = null

  for (const block of candidate.document.children) {
    if (block.type !== 'list') continue

    location = findListItem(block, candidate.item)
    if (location) break
  }

  if (!location) return false

  const { list, index, parentList, parentItem } = location

  if (direction === 'indent') {
    const previous = list.children[index - 1]
    if (!previous) return false

    list.children.splice(index, 1)
    previous.children.push({
      type: 'list',
      ordered: list.ordered,
      start: list.start,
      children: [candidate.item],
    })
  } else {
    if (
      !parentList ||
      !parentItem ||
      list.children.length !== 1 ||
      parentItem.children[parentItem.children.length - 1] !== list
    )
      return false

    parentItem.children.pop()
    parentList.children.splice(
      parentList.children.indexOf(parentItem) + 1,
      0,
      candidate.item,
    )
  }

  return parseFormattedRichTextDocument(candidate.document) !== null
}

function canEditBlock(block: FormattedRichTextBlock): boolean {
  if (block.type === 'code' || block.type === 'horizontalRule') return true

  if (block.type === 'paragraph' || block.type === 'heading')
    return block.children.every(
      (child) =>
        child.type === 'text' ||
        child.type === 'lineBreak' ||
        (child.type === 'link' &&
          child.children.every((text) => text.type === 'text')),
    )
  if (block.type === 'list')
    return block.children.every((item) => item.children.every(canEditBlock))
  if (block.type === 'table')
    return block.children.every((row) =>
      row.children.every((cell) => cell.children.every(canEditBlock)),
    )
  if (block.type === 'quote') return block.children.every(canEditBlock)

  return false
}
