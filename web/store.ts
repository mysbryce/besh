import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { Flow, FlowNode, FlowResult } from '../src/flows/model'
import { api, type Member, type SavedFlow } from './lib/api'

export type CanvasNode = Node<
  { kind: FlowNode['type']; config: FlowNode['config'] },
  'besh'
>

const initialNodes: CanvasNode[] = [
  {
    id: 'request',
    type: 'besh',
    position: { x: 60, y: 130 },
    data: { kind: 'request', config: {} },
  },
  {
    id: 'response',
    type: 'besh',
    position: { x: 390, y: 130 },
    data: {
      kind: 'response',
      config: { status: 200, body: { message: 'Hello, Besh!' } },
    },
  },
]

const initialEdges: Edge[] = [
  { id: 'request-response', source: 'request', target: 'response' },
]

type Studio = {
  token: string
  member: Member | null
  flows: SavedFlow[]
  id: string | null
  name: string
  method: Flow['method']
  path: string
  revision: number
  publishedRevision: number | null
  nodes: CanvasNode[]
  edges: Edge[]
  selected: string | null
  dirty: boolean
  busy: boolean
  notice: string
  failed: boolean
  result: FlowResult | null
  login: (token: string) => Promise<void>
  logout: () => void
  fresh: () => void
  load: (flow: SavedFlow) => void
  edit: (fields: Partial<Pick<Studio, 'name' | 'path' | 'method'>>) => void
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  connect: (connection: Connection) => void
  addNode: (kind: FlowNode['type'], position?: { x: number; y: number }) => void
  configure: (id: string, config: FlowNode['config']) => void
  select: (id: string | null) => void
  save: () => Promise<SavedFlow>
  test: (body: unknown, query: Record<string, string>) => Promise<void>
  publish: () => Promise<void>
  task: (work: () => Promise<void>) => Promise<void>
  message: (notice: string, failed?: boolean) => void
}

function editState(flow?: SavedFlow) {
  return {
    id: flow?.id ?? null,
    name: flow?.name ?? 'Untitled API',
    method: flow?.method ?? ('GET' as Flow['method']),
    path: flow?.path ?? '/hello',
    revision: flow?.revision ?? 0,
    publishedRevision: flow?.publishedRevision ?? null,
    nodes: flow
      ? flow.nodes.map((node): CanvasNode => ({
          id: node.id,
          type: 'besh',
          position: node.position,
          data: { kind: node.type, config: node.config },
        }))
      : structuredClone(initialNodes),
    edges: flow
      ? flow.edges.map((edge) => ({
          ...edge,
          sourceHandle: edge.sourceHandle ?? undefined,
        }))
      : structuredClone(initialEdges),
    selected: null,
    result: null,
    dirty: false,
  }
}

export const useStudio = create<Studio>((set, get) => ({
  ...editState(),
  token: '',
  member: null,
  flows: [],
  busy: false,
  notice: 'Connect your first idea.',
  failed: false,

  async login(token) {
    const [member, flows] = await Promise.all([
      api<Member>('/api/me', token),
      api<SavedFlow[]>('/api/flows', token),
    ])
    set({
      token,
      member,
      flows,
      ...editState(flows[0]),
      notice: 'Workspace ready.',
      failed: false,
    })
  },

  logout() {
    set({ token: '', member: null, flows: [], ...editState(), notice: '' })
  },
  fresh() {
    set({
      ...editState(),
      notice: 'New draft. Give your API a name.',
      failed: false,
    })
  },
  load(flow) {
    set({ ...editState(flow), notice: 'Draft loaded.', failed: false })
  },
  edit(fields) {
    set({ ...fields, dirty: true })
  },
  select(selected) {
    set({ selected })
  },
  message(notice, failed = false) {
    set({ notice, failed })
  },

  onNodesChange(changes) {
    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes)
      return {
        nodes,
        edges: state.edges.filter(
          (edge) =>
            nodes.some((node) => node.id === edge.source) &&
            nodes.some((node) => node.id === edge.target),
        ),
        dirty:
          state.dirty ||
          changes.some(
            (change) =>
              change.type !== 'select' && change.type !== 'dimensions',
          ),
      }
    })
  },

  onEdgesChange(changes) {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      dirty: state.dirty || changes.some((change) => change.type !== 'select'),
    }))
  },

  connect(connection) {
    set((state) => ({ edges: addEdge(connection, state.edges), dirty: true }))
  },

  addNode(kind, position) {
    const id = crypto.randomUUID()
    const config: FlowNode['config'] =
      kind === 'condition'
        ? { field: 'body.active', equals: true }
        : kind === 'response'
          ? { status: 200, body: { message: 'Hello, Besh!' } }
          : {}
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id,
          type: 'besh',
          position: position ?? { x: 240, y: 320 + state.nodes.length * 10 },
          data: { kind, config },
        },
      ],
      selected: id,
      dirty: true,
    }))
  },

  configure(id, config) {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, config } } : node,
      ),
      dirty: true,
    }))
  },

  async save() {
    const state = get()
    const definition = {
      name: state.name,
      method: state.method,
      path: state.path,
      nodes: state.nodes.map((node) => ({
        id: node.id,
        type: node.data.kind,
        position: node.position,
        config: node.data.config,
      })),
      edges: state.edges.map(({ id, source, target, sourceHandle }) => ({
        id,
        source,
        target,
        sourceHandle,
      })),
      revision: state.revision,
    }
    const flow = await api<SavedFlow>(
      state.id ? `/api/flows/${state.id}` : '/api/flows',
      state.token,
      state.id ? 'PUT' : 'POST',
      definition,
    )
    set((current) => ({
      id: flow.id,
      revision: flow.revision,
      dirty: false,
      flows: [flow, ...current.flows.filter((item) => item.id !== flow.id)],
      notice: 'Draft saved.',
      failed: false,
    }))
    return flow
  },

  async test(body, query) {
    const state = get()
    if (!state.id || state.dirty) throw new Error('Save draft before testing.')
    const result = await api<FlowResult>(
      `/api/flows/${state.id}/test`,
      state.token,
      'POST',
      { body, query },
    )
    set({
      result,
      notice: `Test complete · ${result.status} response`,
      failed: false,
    })
  },

  async publish() {
    const state = get()
    if (!state.id || state.dirty)
      throw new Error('Save draft before publishing.')
    const flow = await api<SavedFlow>(
      `/api/flows/${state.id}/publish`,
      state.token,
      'POST',
      { revision: state.revision },
    )
    set((current) => ({
      publishedRevision: flow.publishedRevision,
      flows: current.flows.map((item) => (item.id === flow.id ? flow : item)),
      notice: `Published · ${flow.method} /run${flow.path}`,
      failed: false,
    }))
  },

  async task(work) {
    if (get().busy) return
    set({ busy: true, failed: false })
    try {
      await work()
    } catch (error) {
      set({
        notice: error instanceof Error ? error.message : 'Request failed',
        failed: true,
      })
    } finally {
      set({ busy: false })
    }
  },
}))
