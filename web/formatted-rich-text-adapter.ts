import {
  $createParagraphNode,
  $createLineBreakNode,
  $createTabNode,
  $createTextNode,
  $getRoot,
  $getState,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  $setState,
  createState,
  type LexicalNode,
  type TextNode,
} from 'lexical'
import { $createCodeNode, $isCodeNode, type CodeNode } from '@lexical/code-core'
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from '@lexical/extension'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text'
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListNode,
} from '@lexical/list'
import { $createLinkNode, $isLinkNode } from '@lexical/link'
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  type TableNode,
} from '@lexical/table'
import type {
  FormattedRichTextBlock,
  FormattedRichTextDocument,
  FormattedRichTextList,
  FormattedRichTextListItem,
  FormattedRichTextInline,
  FormattedRichTextMark,
  FormattedRichTextText,
  FormattedRichTextTable,
  FormattedRichTextTableCell,
  FormattedRichTextParagraph,
} from '../src/structs/rich-text-formatted'
import {
  canEditFormattedText,
  canUseFormattedLink,
  unsupportedFormattedText,
} from './formatted-rich-text-value'

export const formattedMarks: readonly FormattedRichTextMark[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
]

function isFormattedMark(value: unknown): value is FormattedRichTextMark {
  return formattedMarks.some((mark) => mark === value)
}

const markOrderState = createState('beshFormattedMarkOrder', {
  parse(value: unknown): FormattedRichTextMark[] {
    if (!Array.isArray(value)) return []

    const marks = value.filter(isFormattedMark)
    if (marks.length !== value.length || new Set(marks).size !== marks.length)
      return []

    return marks
  },
  isEqual: (left, right) =>
    left.length === right.length &&
    left.every((mark, index) => mark === right[index]),
})

function $currentMarkOrder(
  node: TextNode,
  previous: readonly FormattedRichTextMark[],
): FormattedRichTextMark[] {
  const retained = previous.filter((mark) => node.hasFormat(mark))
  const added = formattedMarks.filter(
    (mark) => node.hasFormat(mark) && !retained.includes(mark),
  )

  return [...retained, ...added]
}

export function $preserveFormattedMarkOrder(node: TextNode) {
  // NodeState follows native text splits and history; removed marks leave its order.
  $setState(node, markOrderState, (previous) =>
    $currentMarkOrder(node, previous),
  )
}

const headingTags = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const

const headingLevels = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 } as const
const unsupportedMarks = [
  'highlight',
  'subscript',
  'superscript',
  'lowercase',
  'uppercase',
  'capitalize',
] as const

export function $importFormattedDocument(document: FormattedRichTextDocument) {
  if (!canEditFormattedText(document)) throw new Error(unsupportedFormattedText)

  const root = $getRoot()
  root.clear()

  for (const block of document.children) root.append($importBlock(block))

  // Keep an editable caret surface without changing an untouched empty document.
  if (!document.children.length) root.append($createParagraphNode())
}

function $importBlock(block: FormattedRichTextBlock): LexicalNode {
  if (block.type === 'horizontalRule') return $createHorizontalRuleNode()

  if (block.type === 'code')
    return $createFormattedCode(block.text, block.language)

  if (block.type === 'quote') {
    const quote = $createQuoteNode({ shadowRoot: true })

    for (const paragraph of block.children)
      quote.append($importBlock(paragraph))

    return quote
  }

  if (block.type === 'table') {
    const table = $createTableNode()

    for (const sourceRow of block.children) {
      const row = $createTableRowNode()

      for (const sourceCell of sourceRow.children) {
        const cell = $createTableCellNode(
          sourceCell.header
            ? TableCellHeaderStates.ROW
            : TableCellHeaderStates.NO_STATUS,
        )

        for (const paragraph of sourceCell.children)
          cell.append($importBlock(paragraph))

        row.append(cell)
      }

      table.append(row)
    }

    return table
  }

  if (block.type === 'list') {
    const list = $createListNode(
      block.ordered ? 'number' : 'bullet',
      block.start,
    )

    for (const child of block.children) {
      const item = $createListItemNode()
      const nodes = child.children.flatMap((part, index) => {
        const imported = $importBlock(part)

        // An empty paragraph must remain a node, not become a list-only wrapper.
        if (
          index === 0 &&
          $isParagraphNode(imported) &&
          imported.getChildrenSize() > 0
        )
          return imported.getChildren()

        return [imported]
      })

      // append() would also flatten later paragraphs; keep their reviewed boundaries.
      item.splice(0, 0, nodes)
      list.append(item)
    }

    return list
  }
  if (block.type !== 'paragraph' && block.type !== 'heading')
    throw new Error(unsupportedFormattedText)

  const element =
    block.type === 'paragraph'
      ? $createParagraphNode()
      : $createHeadingNode(headingTags[block.level])

  for (const child of block.children) {
    element.append($importInline(child))
  }

  return element
}

export function $createFormattedCode(
  text: string,
  language: 'plaintext' | 'javascript',
): CodeNode {
  const code = $createCodeNode(language)

  for (const part of text.split(/([\n\t])/)) {
    if (part === '\n') code.append($createLineBreakNode())
    else if (part === '\t') code.append($createTabNode())
    else if (part) code.append($createTextNode(part))
  }

  return code
}

function $importInline(child: FormattedRichTextInline): LexicalNode {
  if (child.type === 'lineBreak') return $createLineBreakNode()

  if (child.type === 'link') {
    if (!canUseFormattedLink(child.url))
      throw new Error(unsupportedFormattedText)

    const link = $createLinkNode(child.url, {
      rel: null,
      target: null,
      title: null,
    })
    for (const text of child.children) link.append($importInline(text))

    return link
  }
  if (child.type !== 'text') throw new Error(unsupportedFormattedText)

  const text = $createTextNode(child.text)
  text.toggleUnmergeable()
  for (const mark of child.marks) text.toggleFormat(mark)

  $setState(text, markOrderState, [...child.marks])

  return text
}

function $exportText(node: LexicalNode): FormattedRichTextText {
  if (!$isTextNode(node)) throw new Error(unsupportedFormattedText)
  if (node.getStyle() || unsupportedMarks.some((mark) => node.hasFormat(mark)))
    throw new Error(unsupportedFormattedText)

  return {
    type: 'text',
    text: node.getTextContent(),
    marks: $currentMarkOrder(node, $getState(node, markOrderState)),
  }
}

function $exportInline(node: LexicalNode): FormattedRichTextInline {
  if ($isLineBreakNode(node)) return { type: 'lineBreak' }

  if (!$isLinkNode(node)) return $exportText(node)
  if (
    !canUseFormattedLink(node.getURL()) ||
    node.getTarget() ||
    node.getTitle() ||
    node.getRel()
  )
    throw new Error(unsupportedFormattedText)

  return {
    type: 'link',
    url: node.getURL(),
    children: node.getChildren().map($exportText),
  }
}

export function $exportFormattedDocument(
  listItems?: Map<string, FormattedRichTextListItem>,
): FormattedRichTextDocument {
  return {
    type: 'document',
    astVersion: 2,
    children: $getRoot()
      .getChildren()
      .map((block) => $exportBlock(block, listItems)),
  }
}

function $exportBlock(
  block: LexicalNode,
  listItems?: Map<string, FormattedRichTextListItem>,
): FormattedRichTextBlock {
  if ($isHorizontalRuleNode(block)) {
    if (block.getParent()?.getType() !== 'root')
      throw new Error(unsupportedFormattedText)

    return { type: 'horizontalRule' }
  }

  if ($isCodeNode(block)) {
    const language = block.getLanguage()
    if (
      block.getParent()?.getType() !== 'root' ||
      (language !== 'plaintext' && language !== 'javascript') ||
      block.getStyle() ||
      block.getFormat() ||
      block.getIndent() ||
      block.getTheme() !== undefined ||
      block.getIsSyntaxHighlightSupported()
    )
      throw new Error(unsupportedFormattedText)

    let text = ''

    for (const child of block.getChildren()) {
      if ($isLineBreakNode(child)) {
        text += '\n'
      } else if (
        $isTextNode(child) &&
        (child.getType() === 'text' || child.getType() === 'tab') &&
        !child.getStyle() &&
        child.getFormat() === 0 &&
        child.getMode() === 'normal'
      ) {
        text += child.getTextContent()
      } else {
        throw new Error(unsupportedFormattedText)
      }
    }

    return { type: 'code', language, text }
  }

  if ($isQuoteNode(block)) {
    if (
      block.getParent()?.getType() !== 'root' ||
      !block.isShadowRoot() ||
      block.getStyle() ||
      block.getFormat() ||
      block.getIndent()
    )
      throw new Error(unsupportedFormattedText)

    const children: FormattedRichTextParagraph[] = []

    for (const child of block.getChildren()) {
      const paragraph = $exportBlock(child)
      if (paragraph.type !== 'paragraph')
        throw new Error(unsupportedFormattedText)

      children.push(paragraph)
    }

    if (!children.length) throw new Error(unsupportedFormattedText)

    return { type: 'quote', children }
  }

  if ($isTableNode(block)) return $exportTable(block)
  if ($isListNode(block)) return $exportList(block, listItems)
  if (!$isParagraphNode(block) && !$isHeadingNode(block))
    throw new Error(unsupportedFormattedText)
  if (block.getIndent() || block.getStyle() || block.getFormat())
    throw new Error(unsupportedFormattedText)

  const children = block.getChildren().map($exportInline)

  return $isHeadingNode(block)
    ? { type: 'heading', level: headingLevels[block.getTag()], children }
    : { type: 'paragraph', children }
}

function $exportTable(table: TableNode): FormattedRichTextTable {
  if (
    table.getParent()?.getType() !== 'root' ||
    table.getStyle() ||
    table.getFormat() ||
    table.getIndent() ||
    table.getColWidths() !== undefined ||
    table.getRowStriping() ||
    table.getFrozenRows() ||
    table.getFrozenColumns()
  )
    throw new Error(unsupportedFormattedText)

  const rows = table.getChildren()
  if (!rows.length || rows.length > 16)
    throw new Error(unsupportedFormattedText)

  let columns: number | null = null
  const children: FormattedRichTextTable['children'] = []

  for (const row of rows) {
    if (
      !$isTableRowNode(row) ||
      row.getHeight() !== undefined ||
      row.getStyle() ||
      row.getFormat() ||
      row.getIndent()
    )
      throw new Error(unsupportedFormattedText)

    const cells = row.getChildren()
    if (
      !cells.length ||
      cells.length > 8 ||
      (columns !== null && cells.length !== columns)
    )
      throw new Error(unsupportedFormattedText)

    columns = cells.length
    const exportedCells: FormattedRichTextTableCell[] = []

    for (const cell of cells) {
      if (
        !$isTableCellNode(cell) ||
        cell.getColSpan() !== 1 ||
        cell.getRowSpan() !== 1 ||
        cell.getWidth() !== undefined ||
        cell.getBackgroundColor() !== null ||
        cell.getVerticalAlign() !== undefined ||
        cell.getStyle() ||
        cell.getFormat() ||
        cell.getIndent()
      )
        throw new Error(unsupportedFormattedText)

      const paragraphs: FormattedRichTextParagraph[] = []

      for (const paragraph of cell.getChildren()) {
        const exported = $exportBlock(paragraph)
        if (exported.type !== 'paragraph')
          throw new Error(unsupportedFormattedText)

        paragraphs.push(exported)
      }

      if (!paragraphs.length) throw new Error(unsupportedFormattedText)

      exportedCells.push({
        type: 'tableCell',
        header: cell.hasHeader(),
        children: paragraphs,
      })
    }

    children.push({ type: 'tableRow', children: exportedCells })
  }

  return { type: 'table', children }
}

function $exportList(
  list: ListNode,
  listItems?: Map<string, FormattedRichTextListItem>,
): FormattedRichTextList {
  const listType = list.getListType()
  if (
    (listType !== 'bullet' && listType !== 'number') ||
    list.getStyle() ||
    list.getFormat()
  )
    throw new Error(unsupportedFormattedText)

  const items: FormattedRichTextListItem[] = []

  for (const item of list.getChildren()) {
    if (!$isListItemNode(item) || item.getStyle() || item.getFormat())
      throw new Error(unsupportedFormattedText)

    const nodes = item.getChildren()
    // Lexical indentation creates a list-only wrapper after its owning item.
    if (nodes.length && nodes.every($isListNode)) {
      let previous = items[items.length - 1]
      if (!previous) {
        previous = {
          type: 'listItem',
          children: [{ type: 'paragraph', children: [] }],
        }
        items.push(previous)
      }

      for (const node of nodes)
        previous.children.push($exportList(node, listItems))
      continue
    }

    const children: FormattedRichTextListItem['children'] = []
    let inline: FormattedRichTextInline[] = []

    function flushInline() {
      if (!inline.length) return

      children.push({ type: 'paragraph', children: inline })
      inline = []
    }

    for (const node of nodes) {
      if ($isListNode(node)) {
        flushInline()
        if (!children.length) children.push({ type: 'paragraph', children: [] })

        children.push($exportList(node, listItems))
      } else if ($isParagraphNode(node)) {
        flushInline()
        if (node.getStyle() || node.getFormat() || node.getIndent())
          throw new Error(unsupportedFormattedText)

        children.push({
          type: 'paragraph',
          children: node.getChildren().map($exportInline),
        })
      } else {
        inline.push($exportInline(node))
      }
    }

    flushInline()
    if (!children.length) children.push({ type: 'paragraph', children: [] })

    const exported: FormattedRichTextListItem = { type: 'listItem', children }
    items.push(exported)
    listItems?.set(item.getKey(), exported)
  }

  return {
    type: 'list',
    ordered: listType === 'number',
    start: listType === 'number' ? list.getStart() : 1,
    children: items,
  }
}
