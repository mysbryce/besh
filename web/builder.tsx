import { memo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react'
import {
  ArrowDownToLine,
  Braces,
  GitBranch,
  MousePointer2,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Play,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Badge } from './components/ui/badge'
import { flowSchema, type Flow, type FlowNode } from '../src/flows/model'
import { useStudio, type CanvasNode } from './store'

const nodeInfo = {
  request: {
    label: 'HTTP request',
    description: 'Your API starts here',
    icon: ArrowDownToLine,
  },
  condition: {
    label: 'Condition',
    description: 'Choose a path',
    icon: GitBranch,
  },
  response: {
    label: 'JSON response',
    description: 'Send something back',
    icon: Braces,
  },
}

const FlowCard = memo(function FlowCard({
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const info = nodeInfo[data.kind]
  const Icon = info.icon

  return (
    <div className={`flow-card ${data.kind} ${selected ? 'selected' : ''}`}>
      {data.kind !== 'request' ? (
        <Handle type="target" position={Position.Left} />
      ) : null}
      <div className="flow-card-heading">
        <span className="node-icon">
          <Icon size={19} />
        </span>
        <div>
          <strong>{info.label}</strong>
          <small>{info.description}</small>
        </div>
        <span className="node-dot" />
      </div>
      <div className="flow-card-detail">
        {data.kind === 'response' ? (
          <>
            <span>STATUS</span>
            <code>{'status' in data.config ? data.config.status : 200}</code>
            <span className="node-format">application/json</span>
          </>
        ) : data.kind === 'condition' ? (
          <>
            <span>IF</span>
            <code>
              {'field' in data.config ? data.config.field : 'body.active'}
            </code>
          </>
        ) : (
          <>
            <span>TRIGGER</span>
            <code>Incoming request</code>
          </>
        )}
      </div>
      {data.kind === 'request' ? (
        <Handle type="source" position={Position.Right} />
      ) : null}
      {data.kind === 'condition' ? (
        <>
          <span className="branch-label yes">true</span>
          <span className="branch-label no">false</span>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: '38%' }}
          />
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: '78%' }}
          />
        </>
      ) : null}
    </div>
  )
})

const nodeTypes = { besh: FlowCard }

function Inspector({ node }: { node: CanvasNode }) {
  const [config, setConfig] = useState(
    JSON.stringify(node.data.config, null, 2),
  )
  const configure = useStudio((state) => state.configure)
  const message = useStudio((state) => state.message)
  const remove = useStudio((state) => state.onNodesChange)
  const readonly = useStudio(
    (state) => state.member?.role === 'viewer' || state.busy,
  )

  function apply() {
    try {
      const parsed = flowSchema.shape.nodes.element.safeParse({
        id: node.id,
        position: node.position,
        type: node.data.kind,
        config: JSON.parse(config),
      })
      if (!parsed.success)
        throw new Error('Invalid configuration for this node.')
      configure(node.id, parsed.data.config)
      message('Configuration applied. Save draft to keep changes.')
    } catch (error) {
      message(error instanceof Error ? error.message : 'Invalid JSON', true)
    }
  }

  return (
    <aside className="inspector">
      <div className="panel-heading">
        <span>NODE SETTINGS</span>
        <Badge variant="outline">{node.data.kind}</Badge>
      </div>
      <h3>{nodeInfo[node.data.kind].label}</h3>
      <p>
        {node.data.kind === 'condition'
          ? 'Compare an input field with a value. Connect both true and false outputs.'
          : node.data.kind === 'response'
            ? 'Set a status and JSON body. Use $input.body.name or $input.query.name to read input.'
            : 'Connect this node to the first step in your API.'}
      </p>
      <label htmlFor="node-config">Node configuration</label>
      <Textarea
        id="node-config"
        value={config}
        onChange={(event) => setConfig(event.target.value)}
        className="code-input"
        rows={10}
        disabled={readonly}
        spellCheck={false}
      />
      <Button variant="outline" onClick={apply} disabled={readonly}>
        Apply configuration
      </Button>
      <Button
        variant="ghost"
        className="remove-node"
        disabled={readonly}
        onClick={() => remove([{ type: 'remove', id: node.id }])}
      >
        <Trash2 />
        Remove node
      </Button>
    </aside>
  )
}

function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    connect,
    addNode,
    selected,
    select,
    member,
    busy,
  } = useStudio()
  const { screenToFlowPosition } = useReactFlow()
  const node = nodes.find((item) => item.id === selected)
  const editable = member?.role !== 'viewer' && !busy

  return (
    <div className={`canvas-layout ${node ? 'with-inspector' : ''}`}>
      <div
        className="canvas"
        data-testid="flow-canvas"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          event.preventDefault()
          const kind = event.dataTransfer.getData(
            'application/besh-node',
          ) as FlowNode['type']
          if (editable && Object.hasOwn(nodeInfo, kind))
            addNode(
              kind,
              screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            )
        }}
      >
        <div className="node-palette">
          <span>ADD A STEP</span>
          {(['condition', 'response'] as const).map((kind) => {
            const Icon = nodeInfo[kind].icon
            return (
              <button
                key={kind}
                draggable={editable}
                disabled={!editable}
                onDragStart={(event) =>
                  event.dataTransfer.setData('application/besh-node', kind)
                }
                onClick={() => addNode(kind)}
              >
                <Icon size={16} />
                {kind === 'condition' ? 'Condition' : 'Response'}
                <Plus size={13} />
              </button>
            )
          })}
          {!nodes.some((item) => item.data.kind === 'request') ? (
            <button disabled={!editable} onClick={() => addNode('request')}>
              <Plus size={16} />
              Request
            </button>
          ) : null}
        </div>
        <ReactFlow<CanvasNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connect}
          onNodeClick={(_, clicked) => select(clicked.id)}
          onPaneClick={() => select(null)}
          nodesDraggable={editable}
          nodesConnectable={editable}
          edgesReconnectable={false}
          deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: '#7e9b88', strokeWidth: 2 },
          }}
        >
          <Background color="#d8ded8" gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="canvas-hint">
          <MousePointer2 size={13} /> Drag steps. Connect handles. Select to
          configure.
        </div>
      </div>
      {node ? (
        <Inspector
          key={`${node.id}-${JSON.stringify(node.data.config)}`}
          node={node}
        />
      ) : null}
    </div>
  )
}

export function Builder() {
  const state = useStudio()
  const [input, setInput] = useState('{\n  "body": {},\n  "query": {}\n}')
  const writable = state.member?.role !== 'viewer'

  function testFlow() {
    void state.task(async () => {
      const parsed: unknown = JSON.parse(input)
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('body' in parsed) ||
        !('query' in parsed) ||
        !parsed.query ||
        typeof parsed.query !== 'object' ||
        Array.isArray(parsed.query) ||
        Object.values(parsed.query).some((item) => typeof item !== 'string')
      )
        throw new Error('Use { "body": ..., "query": { "key": "value" } }.')
      await state.test(parsed.body, parsed.query as Record<string, string>)
    })
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">BUILD SOMETHING USEFUL</div>
          <h1>
            API Studio{' '}
            <Badge variant="outline">
              {state.publishedRevision
                ? `Live · v${state.publishedRevision}`
                : 'Draft'}
            </Badge>
          </h1>
          <p>Connect the dots. Let your API do the work.</p>
        </div>
        <div className="title-actions">
          <Button
            variant="outline"
            disabled={state.busy || !writable}
            onClick={() =>
              void state.task(async () => {
                await state.save()
              })
            }
          >
            <Save />
            Save draft
          </Button>
          <Button
            disabled={
              state.busy ||
              state.member?.role !== 'owner' ||
              !state.id ||
              state.dirty
            }
            onClick={() => void state.task(state.publish)}
          >
            <Send />
            Publish
          </Button>
        </div>
      </div>
      <div className="endpoint-bar">
        <div className="api-name-field">
          <label htmlFor="api-name">API NAME</label>
          <Input
            id="api-name"
            value={state.name}
            disabled={!writable || state.busy}
            onChange={(event) => state.edit({ name: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="api-method">METHOD</label>
          <select
            id="api-method"
            aria-label="HTTP method"
            value={state.method}
            disabled={!writable || state.busy}
            onChange={(event) =>
              state.edit({ method: event.target.value as Flow['method'] })
            }
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(
              (method) => (
                <option key={method}>{method}</option>
              ),
            )}
          </select>
        </div>
        <div className="path-field">
          <label htmlFor="api-path">ENDPOINT PATH</label>
          <div>
            <span>/run</span>
            <Input
              id="api-path"
              aria-label="Endpoint path"
              value={state.path}
              disabled={!writable || state.busy}
              onChange={(event) => state.edit({ path: event.target.value })}
            />
          </div>
        </div>
        <div className="private-label">
          <ShieldCheck size={16} />
          <span>Token protected</span>
        </div>
      </div>
      <section className="editor-panel">
        <div className="editor-toolbar">
          <div>
            <span className="live-dot" />
            <strong>Flow canvas</strong>
            <span className="muted">
              {state.nodes.length} nodes · {state.edges.length} connections
            </span>
          </div>
          <span className="draft-state">
            {state.dirty
              ? 'Unsaved changes'
              : state.id
                ? `Saved · revision ${state.revision}`
                : 'New draft'}
          </span>
        </div>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </section>
      <section className="test-panel">
        <div className="test-request">
          <div className="panel-heading">
            <strong>Try it out</strong>
            <span>JSON INPUT</span>
          </div>
          <Textarea
            aria-label="Test input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="code-input"
            spellCheck={false}
            rows={4}
          />
          <Button
            variant="outline"
            disabled={state.busy || !writable || !state.id || state.dirty}
            onClick={testFlow}
          >
            <Play />
            Test flow
          </Button>
        </div>
        <div className="test-response">
          <div className="panel-heading">
            <strong>Response</strong>
            {state.result ? (
              <Badge variant="secondary">{state.result.status}</Badge>
            ) : (
              <span>WAITING FOR A RUN</span>
            )}
          </div>
          <pre data-testid="test-result">
            {state.result
              ? JSON.stringify(state.result, null, 2)
              : '// Save your draft, then run a test.\n// Your response will appear here.'}
          </pre>
        </div>
      </section>
    </>
  )
}
