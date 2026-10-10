import { ElementNode } from 'lexical'
import { $isListItemNode, $isListNode, ListNode } from '@lexical/list'

function $updateListNumbers(list: ListNode) {
  let value = list.getStart()

  for (const child of list.getChildren()) {
    if (!$isListItemNode(child)) continue

    if (child.getValue() !== value) child.setValue(value)

    // Native indentation wrappers do not consume an ordered-list number.
    if (!$isListNode(child.getFirstChild())) value++
  }
}

class PreservedListNode extends ListNode {
  $config() {
    const native = super.$config().list
    if (!native)
      throw new Error('The native list configuration is unavailable.')

    // Retain native serialization and cloning, but exclude its sibling merger.
    // Extending ListNode here would register both transforms and lose boundaries.
    return this.config('list', {
      ...native,
      extends: ElementNode,
      $transform: $updateListNumbers,
    })
  }
}

export class FormattedListNode extends PreservedListNode {
  $config() {
    // The unregistered base keeps ListNode's typed config identity intact.
    return this.config('besh-formatted-list', { extends: PreservedListNode })
  }
}

export const formattedListNodes = [
  FormattedListNode,
  {
    replace: ListNode,
    with: (node: ListNode) =>
      new FormattedListNode(node.getListType(), node.getStart()),
    withKlass: FormattedListNode,
  },
]
