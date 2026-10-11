import { LinkNode } from '@lexical/link'

export class FormattedLinkNode extends LinkNode {
  $config() {
    return this.config('besh-formatted-link', { extends: LinkNode })
  }

  // Empty links and adjacent links are distinct authored nodes in the Besh grammar.
  canBeEmpty(): boolean {
    return true
  }

  shouldMergeAdjacentLink(_otherLink: LinkNode): boolean {
    return false
  }
}

export const formattedLinkNodes = [
  FormattedLinkNode,
  {
    replace: LinkNode,
    with: (node: LinkNode) =>
      new FormattedLinkNode(node.getURL(), {
        rel: node.getRel(),
        target: node.getTarget(),
        title: node.getTitle(),
      }),
    withKlass: FormattedLinkNode,
  },
]
