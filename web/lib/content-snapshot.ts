import type { FlowNode } from '../../src/flows/model'

export function hasContentSnapshot(
  nodes: readonly { data: { kind: FlowNode['type'] } }[],
) {
  return nodes.some((node) => node.data.kind === 'cmsSnapshotResponse')
}
