import { create } from 'zustand'
import { can } from '../src/permissions'
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
import {
  api,
  apiRulesError,
  ApiError,
  onSessionExpired,
  setSessionCredential,
  type Member,
  type SavedFlow,
  type WorkspaceSession,
} from './lib/api'

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
  editorSession: string
  token: string
  member: Member | null
  authReady: boolean
  sessionId: string | null
  expiresAt: string | null
  flows: SavedFlow[]
  id: string | null
  name: string
  method: Flow['method']
  path: string
  graphql: Flow['graphql']
  contract: Flow['contract']
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
  login: (
    credentials: string | { email: string; password: string },
  ) => Promise<void>
  restoreSession: () => Promise<void>
  logout: () => Promise<void>
  clearSession: (notice?: string) => void
  fresh: () => void
  load: (flow: SavedFlow) => void
  openCreated: (flow: SavedFlow) => void
  edit: (
    fields: Partial<
      Pick<Studio, 'name' | 'path' | 'method' | 'graphql' | 'contract'>
    >,
  ) => void
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  connect: (connection: Connection) => void
  addNode: (kind: FlowNode['type'], position?: { x: number; y: number }) => void
  configure: (id: string, config: FlowNode['config']) => void
  select: (id: string | null) => void
  save: () => Promise<SavedFlow>
  test: (
    body: unknown,
    query: Record<string, string>,
    params?: Record<string, string>,
  ) => Promise<void>
  testGraphql: (input: unknown) => Promise<void>
  publish: () => Promise<void>
  task: (work: () => Promise<void>) => Promise<void>
  message: (notice: string, failed?: boolean) => void
}

function editState(flow?: SavedFlow) {
  return {
    editorSession: crypto.randomUUID(),
    id: flow?.id ?? null,
    name: flow?.name ?? 'Untitled API',
    method: flow?.method ?? ('GET' as Flow['method']),
    path: flow?.path ?? '/hello',
    graphql: flow?.graphql,
    contract: flow?.contract,
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

let restoration: Promise<void> | null = null

export const useStudio = create<Studio>((set, get) => ({
  ...editState(),
  token: '',
  member: null,
  authReady: false,
  sessionId: null,
  expiresAt: null,
  flows: [],
  busy: false,
  notice: 'Connect your first idea.',
  failed: false,

  async login(credentials) {
    const session = await api<WorkspaceSession>(
      '/auth/login',
      '',
      'POST',
      typeof credentials === 'string' ? { token: credentials } : credentials,
    )
    setSessionCredential(session.csrfToken)
    const flows = can(session.member, 'flows.read')
      ? await api<SavedFlow[]>('/api/flows')
      : []
    set({
      token: '',
      member: session.member,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      authReady: true,
      flows,
      ...editState(flows[0]),
      notice: 'Workspace ready.',
      failed: false,
    })
  },

  restoreSession() {
    if (restoration) return restoration
    restoration = (async () => {
      try {
        const session = await api<WorkspaceSession>('/auth/session')
        setSessionCredential(session.csrfToken)
        const flows = can(session.member, 'flows.read')
          ? await api<SavedFlow[]>('/api/flows')
          : []
        set({
          member: session.member,
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          flows,
          ...editState(flows[0]),
          notice: 'Workspace ready.',
          failed: false,
        })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401)
          set({
            notice:
              error instanceof Error
                ? error.message
                : 'Could not restore session.',
            failed: true,
          })
      } finally {
        set({ authReady: true })
      }
    })()
    return restoration
  },

  async logout() {
    try {
      await api('/auth/logout', '', 'POST')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        get().clearSession('This session has already ended. Sign in again.')
        return
      }
      throw error
    }
    get().clearSession('Signed out. This session was revoked.')
  },

  clearSession(notice = '') {
    setSessionCredential('')
    set({
      token: '',
      member: null,
      sessionId: null,
      expiresAt: null,
      flows: [],
      ...editState(),
      notice,
      failed: false,
    })
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
  openCreated(flow) {
    set((state) => ({
      ...editState(flow),
      flows: [flow, ...state.flows.filter((item) => item.id !== flow.id)],
      notice:
        'API draft created from your data. Test it, then publish when ready.',
      failed: false,
    }))
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
    const ruleError = await apiRulesError(state.contract)
    if (ruleError) throw new Error(ruleError)
    const definition = {
      name: state.name,
      method: state.method,
      path: state.path,
      graphql: state.graphql,
      contract: state.graphql ? undefined : state.contract,
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

  async test(body, query, params) {
    const state = get()
    if (!state.id || state.dirty) throw new Error('Save draft before testing.')
    const result = await api<FlowResult>(
      `/api/flows/${state.id}/test`,
      state.token,
      'POST',
      { body, query, ...(params ? { params } : {}) },
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
      notice: `Published · ${flow.method} ${flow.graphql ? '/graphql' : '/run'}${flow.path}`,
      failed: false,
    }))
  },

  async testGraphql(input) {
    const state = get()
    if (!state.id || state.dirty) throw new Error('Save draft before testing.')
    const result = await api<FlowResult>(
      `/api/flows/${state.id}/graphql/test`,
      state.token,
      'POST',
      input,
    )
    set({
      result,
      notice: `GraphQL test complete · ${result.status} response`,
      failed: result.status >= 400,
    })
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

onSessionExpired(() => {
  useStudio
    .getState()
    .clearSession('Your session expired or was revoked. Sign in again.')
})
