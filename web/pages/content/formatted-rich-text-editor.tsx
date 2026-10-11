import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  $addUpdateTag,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $isParagraphNode,
  $isTextNode,
  $isLineBreakNode,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DROP_COMMAND,
  FORMAT_TEXT_COMMAND,
  HISTORY_PUSH_TAG,
  INDENT_CONTENT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  TextNode,
  defineExtension,
  configExtension,
  mergeRegister,
  type RangeSelection,
  type BaseSelection,
  type LexicalNode,
} from 'lexical'
import { FocusManagerExtension, RovingTabIndexExtension } from '@lexical/a11y'
import { $isCodeNode, CodeExtension, type CodeNode } from '@lexical/code-core'
import {
  $createHorizontalRuleNode,
  HorizontalRuleExtension,
  INSERT_HORIZONTAL_RULE_COMMAND,
  NormalizeInlineElementsExtension,
} from '@lexical/extension'
import { HistoryExtension } from '@lexical/history'
import {
  $createListItemNode,
  $insertList,
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListExtension,
  type ListItemNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { $isLinkNode, LinkExtension, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $createTableNodeWithDimensions,
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
  TableExtension,
  type TableSelection,
} from '@lexical/table'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalFocusManagerRef } from '@lexical/react/useLexicalFocusManagerRef'
import { useLexicalRovingTabIndexRef } from '@lexical/react/useLexicalRovingTabIndexRef'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  RichTextExtension,
  type QuoteNode,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { useTranslation } from '../../i18n'
import type { ContentValue } from '../../stores/content-entry-store'
import {
  $exportFormattedDocument,
  $createFormattedCode,
  $importFormattedDocument,
  $preserveFormattedMarkOrder,
  formattedMarks,
} from './formatted-rich-text-adapter'
import {
  canEditFormattedText,
  canConvertFormattedQuote,
  canConvertFormattedLists,
  canMoveFormattedListItem,
  canGrowFormattedTable,
  canInsertFormattedTable,
  canInsertFormattedDivider,
  canUseFormattedLink,
  unsupportedFormattedText,
} from './formatted-rich-text-value'
import { formattedLinkNodes } from './formatted-rich-text-link'
import { formattedListNodes } from './formatted-rich-text-list'
import type {
  FormattedRichTextMark,
  FormattedRichTextListItem,
} from '../../../src/structs/rich-text-formatted'

type FormattedValue = Extract<ContentValue, { type: 'formattedRichText' }>
type Props = {
  value: FormattedValue
  label: string
  disabled: boolean
  onChange: (value: ContentValue) => void
}

const markLabels = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  code: 'Inline code',
} as const

const blockOptions = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
  { value: 'bullet', label: 'Bullet list' },
  { value: 'number', label: 'Numbered list' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code block' },
] as const

const linkReview = 'Apply or cancel the link before saving this entry.'

function hasTableAncestor(node: LexicalNode): boolean {
  let current: LexicalNode | null = node

  while (current) {
    if ($isTableNode(current) || $isTableCellNode(current)) return true

    current = current.getParent()
  }

  return false
}

function selectionTouchesTable(selection: BaseSelection | null): boolean {
  if (!selection) return false
  if ($isTableSelection(selection)) return true
  if (
    $isRangeSelection(selection) &&
    (hasTableAncestor(selection.anchor.getNode()) ||
      hasTableAncestor(selection.focus.getNode()))
  )
    return true

  return selection.getNodes().some(hasTableAncestor)
}

function quoteAncestor(node: LexicalNode): QuoteNode | null {
  let current: LexicalNode | null = node

  while (current) {
    if ($isQuoteNode(current)) return current

    current = current.getParent()
  }

  return null
}

function selectionTouchesQuote(selection: BaseSelection | null): boolean {
  return !!selection?.getNodes().some((node) => quoteAncestor(node) !== null)
}

function codeAncestor(node: LexicalNode): CodeNode | null {
  let current: LexicalNode | null = node

  while (current) {
    if ($isCodeNode(current)) return current

    current = current.getParent()
  }

  return null
}

function selectionTouchesCode(selection: BaseSelection | null): boolean {
  return !!selection?.getNodes().some((node) => codeAncestor(node) !== null)
}

function rootBlock(node: LexicalNode): LexicalNode {
  let current = node
  let parent = current.getParent()

  while (parent && parent.getType() !== 'root') {
    current = parent
    parent = current.getParent()
  }

  return current
}

function canInsertDivider(selection: BaseSelection | null): boolean {
  if (!$isRangeSelection(selection)) return false

  const block = rootBlock(selection.anchor.getNode())

  return (
    ($isParagraphNode(block) || $isHeadingNode(block)) &&
    block.getParent()?.getType() === 'root' &&
    rootBlock(selection.focus.getNode()).is(block)
  )
}

function $selectedRootListBlocks(selection: RangeSelection): number[] {
  const indices = new Set<number>()
  const [start] = selection.getStartEndPoints()
  const nodes =
    start.getNode().getType() === 'root'
      ? [$getRoot().getFirstChild()]
      : selection.getNodes()

  for (const selected of nodes) {
    let node: LexicalNode | null = selected

    while (node && node.getType() !== 'root') {
      const parent = node.getParent()

      if ($isListNode(node)) {
        if (parent?.getType() === 'root')
          indices.add(node.getIndexWithinParent())
        break
      }
      if (parent?.getType() === 'root') {
        if ($isParagraphNode(node) || $isHeadingNode(node))
          indices.add(node.getIndexWithinParent())
        break
      }

      node = parent
    }
  }

  return [...indices]
}

function listItemAncestor(node: LexicalNode): ListItemNode | null {
  let current: LexicalNode | null = node

  while (current) {
    if ($isListItemNode(current)) return current

    current = current.getParent()
  }

  return null
}

function isListWrapper(node: LexicalNode | null): boolean {
  return $isListItemNode(node) && $isListNode(node.getFirstChild())
}

function nestedListStart(selection: BaseSelection | null): boolean {
  if (
    !$isRangeSelection(selection) ||
    !selection.isCollapsed() ||
    selection.anchor.offset !== 0
  )
    return false

  let node: LexicalNode | null = selection.anchor.getNode()

  while (node && !$isListItemNode(node)) {
    if (
      node.getPreviousSibling() ||
      node.getType() === 'root' ||
      ($isElementNode(node) && node.isShadowRoot())
    )
      return false

    node = node.getParent()
  }

  if (!node || isListWrapper(node)) return false

  const list = node.getParent()
  return $isListNode(list) && $isListItemNode(list.getParent())
}

function listMoveContext(selection: BaseSelection | null) {
  if (!$isRangeSelection(selection)) return null

  const item = listItemAncestor(selection.anchor.getNode())
  const focus = listItemAncestor(selection.focus.getNode())
  const list = item?.getParent()
  if (!item || !focus?.is(item) || !$isListNode(list) || isListWrapper(item))
    return null

  const previous = item.getPreviousSibling()
  const parentItem = list.getParent()
  const outerList = parentItem?.getParent()
  const wrapperOwner = parentItem?.getPreviousSibling()
  const indent =
    $isListItemNode(previous) &&
    !isListWrapper(previous) &&
    !isListWrapper(item.getNextSibling())
  const outdent =
    list.getChildrenSize() === 1 &&
    $isListItemNode(parentItem) &&
    $isListNode(outerList) &&
    ((isListWrapper(parentItem) &&
      parentItem.getChildrenSize() === 1 &&
      $isListItemNode(wrapperOwner) &&
      !isListWrapper(wrapperOwner)) ||
      (!isListWrapper(parentItem) && parentItem.getLastChild()?.is(list)))

  return { item, list, parentItem, indent, outdent }
}

function removableTableDimensions(
  selection: RangeSelection | TableSelection | null,
) {
  if (!selection) return { row: false, column: false }

  const anchor = $getTableCellNodeFromLexicalNode(selection.anchor.getNode())
  const focus = $getTableCellNodeFromLexicalNode(selection.focus.getNode())
  const anchorRow = anchor?.getParent()
  const focusRow = focus?.getParent()
  const table = focusRow?.getParent()
  if (
    !anchor ||
    !focus ||
    !$isTableRowNode(anchorRow) ||
    !$isTableRowNode(focusRow) ||
    !$isTableNode(table) ||
    !anchorRow.getParent()?.is(table)
  )
    return { row: false, column: false }

  const selectedRows =
    Math.abs(
      anchorRow.getIndexWithinParent() - focusRow.getIndexWithinParent(),
    ) + 1
  const selectedColumns =
    Math.abs(anchor.getIndexWithinParent() - focus.getIndexWithinParent()) + 1

  return {
    row: selectedRows < table.getChildrenSize(),
    column: selectedColumns < focusRow.getChildrenSize(),
  }
}

export default function FormattedRichTextEditor(props: Props) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const current = useRef(props)
  const supported = canEditFormattedText(props.value.document)

  useLayoutEffect(() => {
    current.current = props
  }, [props])

  const [extension] = useState(() =>
    defineExtension({
      name: 'besh/formatted-content',
      namespace: 'besh-formatted-content',
      nodes: () => [...formattedLinkNodes, ...formattedListNodes],
      dependencies: [
        RichTextExtension,
        CodeExtension,
        HorizontalRuleExtension,
        ListExtension,
        configExtension(LinkExtension, {
          validateUrl: canUseFormattedLink,
          attributes: { rel: null, target: null, title: null },
        }),
        configExtension(TableExtension, {
          hasCellMerge: false,
          hasCellBackgroundColor: false,
          hasNestedTables: false,
          hasHorizontalScroll: true,
          hasStickyScrollbar: false,
        }),
        // Besh permits empty link nodes; the default inline transform discards them.
        configExtension(NormalizeInlineElementsExtension, { disabled: true }),
        configExtension(HistoryExtension, { maxDepth: 50 }),
        FocusManagerExtension,
        RovingTabIndexExtension,
      ],
      theme: {
        hr: 'formatted-divider',
        hrSelected: 'formatted-divider-selected',
        code: 'formatted-code-block',
        tableScrollableWrapper: 'formatted-table-scroll',
        list: { nested: { listitem: 'formatted-list-wrapper' } },
        text: {
          bold: 'formatted-text-bold',
          italic: 'formatted-text-italic',
          underline: 'formatted-text-underline',
          strikethrough: 'formatted-text-strikethrough',
          code: 'formatted-text-code',
        },
      },
      $initialEditorState: () => {
        if (supported) $importFormattedDocument(props.value.document)
      },
      onError: () => {
        setFailed(true)
        current.current.onChange({
          ...current.current.value,
          error: 'Could not open text editor.',
        })
      },
    }),
  )

  if (!supported || failed)
    return (
      <p className="form-error" role="alert">
        {t(failed ? 'Could not open text editor.' : unsupportedFormattedText)}
      </p>
    )

  return (
    <section className="formatted-text-field">
      <h4>{props.label}</h4>
      <p className="field-help">
        {t(
          'Formatted text supports headings and emphasis. Pasted content is plain text.',
        )}
      </p>
      <LexicalExtensionComposer extension={extension} contentEditable={null}>
        <EditorSurface {...props} />
      </LexicalExtensionComposer>
    </section>
  )
}

function EditorSurface({ value, label, disabled, onChange }: Props) {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const latest = useRef({ value, disabled, onChange })
  const original = useRef(value.document)
  const initialSignature = useRef<string | null>(null)
  const lastSent = useRef(JSON.stringify(value.document))
  const savedSelection = useRef<RangeSelection | null>(null)
  const savedTableSelection = useRef<RangeSelection | TableSelection | null>(
    null,
  )
  const [blockStyle, setBlockStyle] = useState('paragraph')
  const [activeMarks, setActiveMarks] = useState<FormattedRichTextMark[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [currentLink, setCurrentLink] = useState<string | null>(null)
  const [tableSelected, setTableSelected] = useState(false)
  const [quoteSelected, setQuoteSelected] = useState(false)
  const [codeSelected, setCodeSelected] = useState(false)
  const [codeLanguage, setCodeLanguage] = useState('plaintext')
  const [dividerAllowed, setDividerAllowed] = useState(false)
  const [listMovement, setListMovement] = useState({
    indent: false,
    outdent: false,
  })
  const [removableDimensions, setRemovableDimensions] = useState({
    row: false,
    column: false,
  })
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkURL, setLinkURL] = useState('')
  const [linkProblem, setLinkProblem] = useState<string | null>(null)
  const linkSelection = useRef<RangeSelection | null>(null)
  const linkPending = useRef(false)
  const restoreFocus = useRef(false)
  const linkInput = useRef<HTMLInputElement>(null)
  const linkInputId = useId()
  const focusRef = useLexicalFocusManagerRef()
  const rovingRef = useLexicalRovingTabIndexRef()

  useLayoutEffect(() => {
    latest.current = { value, disabled, onChange }
    editor.setEditable(!disabled && !linkOpen)

    if (!disabled && !linkOpen && restoreFocus.current) {
      restoreFocus.current = false
      editor.focus()
    }
  }, [editor, value, disabled, onChange, linkOpen])

  useLayoutEffect(() => {
    if (linkOpen) linkInput.current?.focus()
  }, [linkOpen])

  const toolbarRef = useCallback(
    (element: HTMLDivElement | null) => {
      focusRef(element)
      rovingRef(element)
    },
    [focusRef, rovingRef],
  )

  function readToolbar() {
    const selection = $getSelection()
    const movement = listMoveContext(selection)
    setListMovement({
      indent: movement?.indent ?? false,
      outdent: movement?.outdent ?? false,
    })

    setTableSelected(selectionTouchesTable(selection))
    setQuoteSelected(selectionTouchesQuote(selection))
    setCodeSelected(selectionTouchesCode(selection))
    setDividerAllowed(canInsertDivider(selection))
    savedTableSelection.current =
      $isRangeSelection(selection) || $isTableSelection(selection)
        ? selection.clone()
        : null
    setRemovableDimensions(
      removableTableDimensions(savedTableSelection.current),
    )

    if (!$isRangeSelection(selection)) {
      savedSelection.current = null
      setCurrentLink(null)
      setActiveMarks([])
      return
    }

    savedSelection.current = selection.clone()
    setActiveMarks(formattedMarks.filter((mark) => selection.hasFormat(mark)))

    let linkNode = selection.anchor.getNode()
    let linkParent = linkNode.getParent()
    while (!$isLinkNode(linkNode) && linkParent) {
      linkNode = linkParent
      linkParent = linkNode.getParent()
    }

    setCurrentLink($isLinkNode(linkNode) ? linkNode.getURL() : null)

    const code = codeAncestor(selection.anchor.getNode())
    if (code) {
      setBlockStyle('code')
      setCodeLanguage(code.getLanguage() ?? 'plaintext')
      return
    }

    if (quoteAncestor(selection.anchor.getNode())) {
      setBlockStyle('quote')
      return
    }

    let block = selection.anchor.getNode()
    let parent = block.getParent()
    while (parent && parent.getType() !== 'root') {
      if ($isListNode(parent)) {
        setBlockStyle(parent.getListType() === 'number' ? 'number' : 'bullet')
        return
      }

      block = parent
      parent = block.getParent()
    }

    setBlockStyle($isHeadingNode(block) ? block.getTag() : 'paragraph')
  }

  function publishDocument() {
    const current = latest.current
    if (current.disabled || linkPending.current) return

    try {
      const exported = $exportFormattedDocument()
      const signature = JSON.stringify(exported)
      const document =
        signature === initialSignature.current ? original.current : exported
      const wire = JSON.stringify(document)

      if (wire === lastSent.current && !current.value.error) return

      setProblem(null)
      lastSent.current = wire
      current.onChange({ ...current.value, document, error: undefined })
    } catch {
      setProblem(unsupportedFormattedText)
      current.onChange({ ...current.value, error: unsupportedFormattedText })
    }
  }

  useEffect(() => {
    initialSignature.current = editor.read('force-commit', () =>
      JSON.stringify($exportFormattedDocument()),
    )

    function guardBlockCommand() {
      return (
        latest.current.disabled ||
        linkPending.current ||
        selectionTouchesTable($getSelection()) ||
        selectionTouchesQuote($getSelection()) ||
        selectionTouchesCode($getSelection())
      )
    }

    function insertListCommand(ordered: boolean) {
      if (guardBlockCommand() || !$canConvertLists($getSelection(), ordered))
        return true

      $insertList(ordered ? 'number' : 'bullet')

      if (!ordered) {
        const pending = $getRoot().getChildren()

        while (pending.length) {
          const node = pending.pop()!
          if ($isListNode(node) && node.getListType() === 'bullet')
            node.setStart(1)

          if ($isElementNode(node)) pending.push(...node.getChildren())
        }
      }

      setProblem(null)
      return true
    }

    function handleNestedListBackspace(): boolean {
      const selection = $getSelection()
      if (!nestedListStart(selection)) return false

      if (latest.current.disabled || linkPending.current) return true

      if (!listMoveContext(selection)?.outdent) {
        setProblem('This list item cannot be outdented safely.')
        return true
      }

      // Native Backspace bypasses outdent commands and can remove an imported item's owner.
      $moveListItem(selection, 'outdent')
      return true
    }

    return mergeRegister(
      editor.registerNodeTransform(TextNode, $preserveFormattedMarkOrder),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          if (!handleNestedListBackspace()) return false

          event.preventDefault()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (backward) => backward && handleNestedListBackspace(),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          if (!latest.current.disabled && !linkPending.current)
            $moveListItem($getSelection(), 'indent')

          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        OUTDENT_CONTENT_COMMAND,
        () => {
          if (!latest.current.disabled && !linkPending.current)
            $moveListItem($getSelection(), 'outdent')

          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_HORIZONTAL_RULE_COMMAND,
        () => {
          if (latest.current.disabled || linkPending.current) return true

          // Native commands and the toolbar use the same bounded insertion.
          $insertValidatedDivider($getSelection())
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        FORMAT_TEXT_COMMAND,
        () => selectionTouchesCode($getSelection()),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        () => selectionTouchesCode($getSelection()),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_TABLE_COMMAND,
        guardBlockCommand,
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_ORDERED_LIST_COMMAND,
        () => insertListCommand(true),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_UNORDERED_LIST_COMMAND,
        () => insertListCommand(false),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        REMOVE_LIST_COMMAND,
        guardBlockCommand,
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerUpdateListener(
        ({ editorState, dirtyElements, dirtyLeaves }) => {
          editorState.read(
            () => {
              readToolbar()
              if (dirtyElements.size || dirtyLeaves.size) publishDocument()
            },
            { editor },
          )
        },
      ),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          readToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (enabled) => {
          setCanUndo(enabled)
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (enabled) => {
          setCanRedo(enabled)
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          event.preventDefault()
          if (latest.current.disabled) return true

          const selection = $getSelection()
          const clipboard =
            'clipboardData' in event ? event.clipboardData : null
          if (
            $isRangeSelection(selection) &&
            clipboard &&
            !clipboard.files.length
          )
            selection.insertRawText(clipboard.getData('text/plain'))

          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          event.preventDefault()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CONTROLLED_TEXT_INSERTION_COMMAND,
        (event) => {
          if (typeof event === 'string' || !event.dataTransfer) return false

          event.preventDefault()
          if (latest.current.disabled) return true

          const selection = $getSelection()
          if ($isRangeSelection(selection) && !event.dataTransfer.files.length)
            selection.insertRawText(event.dataTransfer.getData('text/plain'))

          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor])

  function selectBlock(next: string) {
    if (disabled || linkOpen) return

    editor.update(() => {
      const selection = savedSelection.current?.clone() ?? $getSelection()
      if (!$isRangeSelection(selection) || selectionTouchesTable(selection))
        return

      if (next !== 'quote' && next !== 'bullet' && next !== 'number')
        $setSelection(selection)

      const code = codeAncestor(selection.anchor.getNode())
      if (selectionTouchesCode(selection)) {
        if (
          next !== 'paragraph' ||
          !code ||
          !codeAncestor(selection.focus.getNode())?.is(code)
        )
          return

        const paragraph = $createParagraphNode()
        paragraph.append(...code.getChildren())
        code.replace(paragraph)
        setProblem(null)
        return
      }

      const quote = quoteAncestor(selection.anchor.getNode())
      if (selectionTouchesQuote(selection)) {
        if (
          next !== 'paragraph' ||
          !quote ||
          !quoteAncestor(selection.focus.getNode())?.is(quote) ||
          !quote.getChildren().every($isParagraphNode)
        )
          return

        for (const paragraph of quote.getChildren())
          quote.insertBefore(paragraph)
        quote.remove()
        setProblem(null)
        return
      }

      if (next === 'quote') {
        const block = rootBlock(selection.anchor.getNode())
        if (
          (!$isParagraphNode(block) && !$isHeadingNode(block)) ||
          block.getParent()?.getType() !== 'root' ||
          !rootBlock(selection.focus.getNode()).is(block)
        ) {
          setProblem(
            'Choose a single paragraph outside lists and tables to create a quote.',
          )
          return
        }

        try {
          if (
            !canConvertFormattedQuote(
              $exportFormattedDocument(),
              block.getIndexWithinParent(),
            )
          ) {
            setProblem(
              'This document cannot fit a quote. Remove some content first.',
            )
            return
          }
        } catch {
          setProblem(unsupportedFormattedText)
          return
        }

        $setSelection(selection)

        const paragraph = $createParagraphNode()
        paragraph.append(...block.getChildren())

        const container = $createQuoteNode({ shadowRoot: true })
        container.append(paragraph)
        block.replace(container)
        setProblem(null)
        return
      }

      if (next === 'code') {
        const block = rootBlock(selection.anchor.getNode())
        if (
          (!$isParagraphNode(block) && !$isHeadingNode(block)) ||
          block.getParent()?.getType() !== 'root' ||
          !rootBlock(selection.focus.getNode()).is(block) ||
          block.getStyle() ||
          block.getFormat() ||
          !block
            .getChildren()
            .every(
              (child) =>
                $isLineBreakNode(child) ||
                ($isTextNode(child) &&
                  !child.getStyle() &&
                  child.getFormat() === 0),
            )
        ) {
          setProblem(
            'Choose an unformatted paragraph outside lists and tables to create a code block.',
          )
          return
        }

        const codeBlock = $createFormattedCode(
          block.getTextContent(),
          'plaintext',
        )
        block.replace(codeBlock)
        codeBlock.selectStart()
        setProblem(null)
        return
      }

      if (next === 'bullet' || next === 'number') {
        if (!$canConvertLists(selection, next === 'number')) return

        $setSelection(selection)
        editor.dispatchCommand(
          next === 'bullet'
            ? INSERT_UNORDERED_LIST_COMMAND
            : INSERT_ORDERED_LIST_COMMAND,
          undefined,
        )

        return
      }

      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
      if (next === 'paragraph') {
        $setBlocksType($getSelection(), $createParagraphNode)
      } else {
        const option = blockOptions.find((entry) => entry.value === next)
        if (
          option &&
          option.value !== 'paragraph' &&
          option.value !== 'bullet' &&
          option.value !== 'number' &&
          option.value !== 'quote' &&
          option.value !== 'code'
        ) {
          const tag = option.value

          $setBlocksType($getSelection(), () => $createHeadingNode(tag))
        }
      }
    })
    editor.focus()
  }

  function $canConvertLists(selection: BaseSelection | null, ordered: boolean) {
    if (!$isRangeSelection(selection)) return false

    try {
      if (
        !canConvertFormattedLists(
          $exportFormattedDocument(),
          $selectedRootListBlocks(selection),
          ordered,
        )
      ) {
        setProblem(
          'This document cannot fit a list. Remove some content first.',
        )
        return false
      }
    } catch {
      setProblem(unsupportedFormattedText)
      return false
    }

    return true
  }

  function $reviewListMove(
    selection: BaseSelection | null,
    direction: 'indent' | 'outdent',
  ) {
    const context = listMoveContext(selection)
    if (!context || !context[direction]) return null

    try {
      const items = new Map<string, FormattedRichTextListItem>()
      const document = $exportFormattedDocument(items)
      const item = items.get(context.item.getKey())
      if (!item || !canMoveFormattedListItem(document, item, direction)) {
        setProblem('This list item cannot be nested further.')
        return null
      }
    } catch {
      setProblem(unsupportedFormattedText)
      return null
    }

    return context
  }

  function $moveListItem(
    selection: BaseSelection | null,
    direction: 'indent' | 'outdent',
  ) {
    const context = $reviewListMove(selection, direction)
    if (!context) return

    // A structural list move must remain a separate native undo step after loading.
    $addUpdateTag(HISTORY_PUSH_TAG)

    if (
      direction === 'outdent' &&
      $isListItemNode(context.parentItem) &&
      !isListWrapper(context.parentItem)
    ) {
      // Imported last-child nesting needs the native wrapper ownership, not removal of its owner.
      const wrapper = $createListItemNode()
      context.parentItem.insertAfter(wrapper)
      wrapper.append(context.list)
    }

    context.item.setIndent(
      context.item.getIndent() + (direction === 'indent' ? 1 : -1),
    )
    setProblem(null)
  }

  function moveList(direction: 'indent' | 'outdent') {
    if (disabled || linkOpen) return

    editor.update(() => {
      const selection = savedSelection.current?.clone() ?? null
      if (!$reviewListMove(selection, direction) || !selection) return

      $setSelection(selection)
      editor.dispatchCommand(
        direction === 'indent'
          ? INDENT_CONTENT_COMMAND
          : OUTDENT_CONTENT_COMMAND,
        undefined,
      )
    })
    editor.focus()
  }

  function insertTable() {
    if (disabled || linkOpen) return

    editor.update(() => {
      const selection = savedSelection.current?.clone() ?? $getSelection()
      if (
        !$isRangeSelection(selection) ||
        selectionTouchesTable(selection) ||
        selectionTouchesQuote(selection) ||
        selectionTouchesCode(selection)
      )
        return

      let block = selection.anchor.getNode()
      let parent = block.getParent()
      while (parent && parent.getType() !== 'root') {
        block = parent
        parent = block.getParent()
      }

      if (!parent || parent.getType() !== 'root') return

      const root = $getRoot()
      const placeholder =
        !latest.current.value.document.children.length &&
        root.getChildrenSize() === 1 &&
        $isParagraphNode(block) &&
        block.isEmpty()

      try {
        if (
          !canInsertFormattedTable(
            $exportFormattedDocument(),
            block.getIndexWithinParent(),
            placeholder,
          )
        ) {
          setProblem(
            'This document cannot fit a table. Remove some content first.',
          )
          return
        }
      } catch {
        setProblem(unsupportedFormattedText)
        return
      }

      const table = $createTableNodeWithDimensions(2, 2, {
        rows: true,
        columns: false,
      })

      // Replace only the untouched empty-document caret surface, never authored blocks.
      if (placeholder) block.replace(table)
      else block.insertAfter(table)

      const firstRow = table.getFirstChild()
      const firstCell = $isTableRowNode(firstRow)
        ? firstRow.getFirstChild()
        : null
      if ($isTableCellNode(firstCell)) firstCell.getFirstChild()?.selectStart()

      setProblem(null)
    })
    editor.focus()
  }

  function $insertValidatedDivider(selection: BaseSelection | null) {
    if (!$isRangeSelection(selection) || !canInsertDivider(selection)) return

    const block = rootBlock(selection.anchor.getNode())

    try {
      if (
        !canInsertFormattedDivider(
          $exportFormattedDocument(),
          block.getIndexWithinParent(),
        )
      ) {
        setProblem(
          'This document cannot fit a divider. Remove some content first.',
        )
        return
      }
    } catch {
      setProblem(unsupportedFormattedText)
      return
    }

    const divider = $createHorizontalRuleNode()
    const paragraph = $createParagraphNode()

    $setSelection(selection)
    block.insertAfter(divider)
    divider.insertAfter(paragraph)
    paragraph.selectStart()
    setProblem(null)
  }

  function insertDivider() {
    if (disabled || linkOpen) return

    editor.update(() =>
      $insertValidatedDivider(savedSelection.current?.clone() ?? null),
    )
    editor.focus()
  }

  function selectCodeLanguage(language: string) {
    if (
      disabled ||
      linkOpen ||
      (language !== 'plaintext' && language !== 'javascript')
    )
      return

    editor.update(() => {
      const selection = savedSelection.current?.clone()
      if (!selection) return

      const code = codeAncestor(selection.anchor.getNode())
      if (!code || !codeAncestor(selection.focus.getNode())?.is(code)) return

      $setSelection(selection)
      code.setLanguage(language)
    })
    editor.focus()
  }

  function growTable(dimension: 'row' | 'column') {
    if (disabled || linkOpen) return

    editor.update(() => {
      const selection = savedTableSelection.current?.clone()
      if (!selection) return

      const anchor = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode(),
      )
      const focus = $getTableCellNodeFromLexicalNode(selection.focus.getNode())
      const anchorRow = anchor?.getParent()
      const focusRow = focus?.getParent()
      const table = focusRow?.getParent()
      if (
        !anchor ||
        !focus ||
        !$isTableRowNode(anchorRow) ||
        !$isTableRowNode(focusRow) ||
        !$isTableNode(table) ||
        !anchorRow.getParent()?.is(table)
      )
        return

      const after =
        dimension === 'row'
          ? Math.max(
              anchorRow.getIndexWithinParent(),
              focusRow.getIndexWithinParent(),
            )
          : Math.max(
              anchor.getIndexWithinParent(),
              focus.getIndexWithinParent(),
            )

      try {
        const document = $exportFormattedDocument()
        if (
          !canGrowFormattedTable(
            document,
            table.getIndexWithinParent(),
            after,
            dimension,
          )
        ) {
          setProblem('This table cannot grow further.')
          return
        }
      } catch {
        setProblem(unsupportedFormattedText)
        return
      }

      $setSelection(selection)
      if (dimension === 'row') {
        const row = $insertTableRowAtSelection(true)
        const firstCell = row?.getFirstChild()
        if ($isTableCellNode(firstCell)) firstCell.selectStart()
      } else {
        $insertTableColumnAtSelection(true)
      }

      setProblem(null)
    })
    editor.focus()
  }

  function removeTableDimension(dimension: 'row' | 'column') {
    if (disabled || linkOpen) return

    editor.update(() => {
      const selection = savedTableSelection.current?.clone() ?? null
      if (!selection || !removableTableDimensions(selection)[dimension]) return

      try {
        $exportFormattedDocument()
      } catch {
        setProblem(unsupportedFormattedText)
        return
      }

      $setSelection(selection)
      if (dimension === 'row') $deleteTableRowAtSelection()
      else $deleteTableColumnAtSelection()

      setProblem(null)
    })
    editor.focus()
  }

  function openLink() {
    if (disabled || linkOpen) return

    const selection = savedSelection.current?.clone()
    if (!selection || (selection.isCollapsed() && !currentLink)) {
      setProblem('Select text to add a link.')
      return
    }

    linkSelection.current = selection
    linkPending.current = true
    setLinkURL(currentLink ?? '')
    setLinkProblem(null)
    setProblem(null)
    setLinkOpen(true)
    onChange({ ...value, error: linkReview })
  }

  function applyLink() {
    const selection = linkSelection.current
    if (disabled || !selection) return
    if (!canUseFormattedLink(linkURL)) {
      setLinkProblem('Enter a complete HTTPS URL without credentials.')
      return
    }

    linkPending.current = false
    editor.update(() => {
      $setSelection(selection.clone())
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkURL)
    })
    editor.read('force-commit', publishDocument)

    restoreFocus.current = true
    setLinkOpen(false)
    setLinkProblem(null)
  }

  function cancelLink() {
    if (disabled) return

    linkPending.current = false
    editor.read('force-commit', publishDocument)

    restoreFocus.current = true
    setLinkOpen(false)
    setLinkProblem(null)
  }

  return (
    <>
      <div
        className="formatted-text-toolbar"
        role="toolbar"
        aria-label={t('{field} formatting', { field: label })}
        ref={toolbarRef}
      >
        <Select
          label={t('{field} block style', { field: label })}
          value={blockStyle}
          options={blockOptions
            .filter(
              (option) =>
                (!quoteSelected && !codeSelected) ||
                option.value === 'paragraph' ||
                (quoteSelected && option.value === 'quote') ||
                (codeSelected && option.value === 'code'),
            )
            .map((option) => ({
              ...option,
              label: t(option.label),
            }))}
          disabled={disabled || linkOpen || tableSelected}
          onValueChange={selectBlock}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !listMovement.indent}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveList('indent')}
        >
          {t('Indent list')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !listMovement.outdent}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveList('outdent')}
        >
          {t('Outdent list')}
        </Button>
        {formattedMarks.map((mark) => (
          <Button
            key={mark}
            type="button"
            variant="outline"
            aria-pressed={activeMarks.includes(mark)}
            disabled={disabled || linkOpen || codeSelected}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (disabled || linkOpen || codeSelected) return

              editor.update(() => {
                if (savedSelection.current)
                  $setSelection(savedSelection.current.clone())

                editor.dispatchCommand(FORMAT_TEXT_COMMAND, mark)
              })
              editor.focus()
            }}
          >
            {t(markLabels[mark])}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={
            disabled ||
            linkOpen ||
            tableSelected ||
            quoteSelected ||
            codeSelected
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertTable}
        >
          {t('Insert table')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !dividerAllowed}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertDivider}
        >
          {t('Insert divider')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !tableSelected}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => growTable('row')}
        >
          {t('Add row')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !tableSelected}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => growTable('column')}
        >
          {t('Add column')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !removableDimensions.row}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => removeTableDimension('row')}
        >
          {t('Remove row')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !removableDimensions.column}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => removeTableDimension('column')}
        >
          {t('Remove column')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || codeSelected}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLink}
        >
          {t(currentLink ? 'Edit link' : 'Add link')}
        </Button>
        {currentLink ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || linkOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (disabled || linkOpen) return

              editor.update(() => {
                if (savedSelection.current)
                  $setSelection(savedSelection.current.clone())

                editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
              })
              editor.focus()
            }}
          >
            {t('Remove link')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !canUndo}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          {t('Undo')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkOpen || !canRedo}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          {t('Redo')}
        </Button>
      </div>
      {codeSelected ? (
        <Select
          label={t('{field} code language', { field: label })}
          value={codeLanguage}
          options={[
            { value: 'plaintext', label: t('Plain text') },
            { value: 'javascript', label: t('JavaScript') },
          ]}
          disabled={disabled || linkOpen}
          onValueChange={selectCodeLanguage}
        />
      ) : null}
      {linkOpen ? (
        <div
          className="formatted-link-review"
          role="group"
          aria-label={t('Link URL')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelLink()
            } else if (
              event.key === 'Enter' &&
              event.target === linkInput.current
            ) {
              event.preventDefault()
              applyLink()
            }
          }}
        >
          <label htmlFor={linkInputId}>
            {t('Link URL')}
            <Input
              ref={linkInput}
              id={linkInputId}
              value={linkURL}
              disabled={disabled}
              maxLength={2048}
              spellCheck={false}
              aria-invalid={!!linkProblem}
              onChange={(event) => setLinkURL(event.target.value)}
            />
          </label>
          <div className="collection-actions">
            <Button type="button" disabled={disabled} onClick={applyLink}>
              {t('Apply link')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={cancelLink}
            >
              {t('Cancel')}
            </Button>
          </div>
          {linkProblem ? (
            <p className="form-error" role="alert">
              {t(linkProblem)}
            </p>
          ) : null}
        </div>
      ) : null}
      <ContentEditable
        aria-label={label}
        aria-disabled={disabled || linkOpen}
        className="formatted-text-surface"
        onBlur={() => editor.read('force-commit', publishDocument)}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a'))
            event.preventDefault()
        }}
        onAuxClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a'))
            event.preventDefault()
        }}
      />
      {problem ? (
        <p className="form-error" role="alert">
          {t(problem)}
        </p>
      ) : null}
    </>
  )
}
