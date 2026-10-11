import type { FlowNode } from '../../../src/flows/model'
import type { FlowTransport } from '../../../src/flows/transport'

export type BuiltinNodeKind = FlowNode['type']
export type NodeCategory = 'api' | 'logic' | 'data' | 'product-login'
export type BuiltinNodeId = `builtin.${BuiltinNodeKind}`
export type NodeCatalogEntry = {
  id: BuiltinNodeId
  nodeType: BuiltinNodeKind
  category: NodeCategory
  label: string
  description: string
  keywords: readonly string[]
}

export const nodeCategories = [
  { id: 'api', label: 'API' },
  { id: 'logic', label: 'Logic' },
  { id: 'data', label: 'Data' },
  { id: 'product-login', label: 'Product login' },
] as const satisfies readonly { id: NodeCategory; label: string }[]

export const nodeCatalog = [
  {
    id: 'builtin.request',
    nodeType: 'request',
    category: 'api',
    label: 'HTTP request',
    description: 'Start the API and receive its input.',
    keywords: ['start', 'input', 'receive', 'request', 'message'],
  },
  {
    id: 'builtin.response',
    nodeType: 'response',
    category: 'api',
    label: 'JSON response',
    description: 'Send the API result back to its caller.',
    keywords: ['reply', 'output', 'send', 'result', 'response'],
  },
  {
    id: 'builtin.condition',
    nodeType: 'condition',
    category: 'logic',
    label: 'Condition',
    description: 'Compare an input value and choose the next path.',
    keywords: ['if', 'branch', 'true', 'false', 'compare', 'condition'],
  },
  {
    id: 'builtin.data',
    nodeType: 'data',
    category: 'data',
    label: 'Spreadsheet rows',
    description:
      'Read chosen fields from an imported spreadsheet or saved Google Sheet.',
    keywords: ['csv', 'excel', 'xlsx', 'google sheets', 'source', 'rows'],
  },
  {
    id: 'builtin.database',
    nodeType: 'database',
    category: 'data',
    label: 'SQLite rows',
    description: 'Read chosen fields from an uploaded SQLite copy.',
    keywords: ['database', 'sqlite', 'table', 'copy', 'rows'],
  },
  {
    id: 'builtin.social',
    nodeType: 'social',
    category: 'product-login',
    label: 'GitHub login',
    description: 'Add GitHub sign-in to the product API.',
    keywords: ['github', 'social', 'oauth', 'sign in', 'identity', 'login'],
  },
] as const satisfies readonly NodeCatalogEntry[]

export function catalogForTransport(
  transport: FlowTransport,
): readonly NodeCatalogEntry[] {
  if (transport !== 'websocket') return nodeCatalog
  return nodeCatalog.map((entry) => {
    if (entry.nodeType === 'request')
      return {
        ...entry,
        label: 'Receive message',
        description: 'Receive one typed WebSocket message.',
      }
    if (entry.nodeType === 'response')
      return {
        ...entry,
        label: 'Send reply',
        description: 'Send one typed WebSocket reply.',
      }
    return entry
  })
}

export function nodeUnavailableReason(
  kind: BuiltinNodeKind,
  context: {
    editable: boolean
    transport: FlowTransport
    nodeKinds: readonly BuiltinNodeKind[]
  },
): string | null {
  if (!context.editable) return 'API editing is unavailable.'
  if (context.nodeKinds.length >= 64) return 'This API already has 64 steps.'
  if (kind === 'request' && context.nodeKinds.includes('request'))
    return 'This API already has a starting step.'
  if (context.transport !== 'websocket') return null
  if (kind === 'condition' || kind === 'social')
    return 'This step is unavailable for WebSocket request/reply.'
  if (kind === 'response' && context.nodeKinds.includes('response'))
    return 'This WebSocket API already has a reply step.'
  if (
    (kind === 'data' || kind === 'database') &&
    context.nodeKinds.some((node) => node === 'data' || node === 'database')
  )
    return 'WebSocket request/reply supports one data read.'
  return null
}
