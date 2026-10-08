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
  Database,
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
import { Select } from './components/ui/select'
import { Textarea } from './components/ui/textarea'
import { Badge } from './components/ui/badge'
import { GitHubIcon } from './components/github-icon'
import {
  ProductLoginTest,
  LoginResultActions,
  maskedLoginResult,
  loginMutation,
  type LoginInput,
} from './product-login-test'
import { flowSchema, type Flow, type FlowNode } from '../src/flows/model'
import { socialLoginSchema } from '../src/flows/social-schema'
import { useStudio, type CanvasNode } from './store'
import { can } from '../src/permissions'
import { ReleaseHistory } from './release-history'
import { ApiRules, OpenApiDownload } from './api-rules'
import {
  ConditionForm,
  DataNodeForm,
  parseRequestInput,
  RequestForm,
  routeParameters,
  ResponseForm,
  SocialNodeForm,
} from './flow-forms'

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
  data: {
    label: 'Spreadsheet rows',
    description: 'Read selected columns',
    icon: Database,
  },
  social: {
    label: 'GitHub login',
    description: 'Resolve a product identity',
    icon: GitHubIcon,
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
        ) : data.kind === 'social' ? (
          <>
            <span>PROVIDER</span>
            <code>GitHub OAuth</code>
          </>
        ) : data.kind === 'data' ? (
          <>
            <span>ROWS</span>
            <code>
              {'columns' in data.config ? data.config.columns.length : 0}{' '}
              columns
            </code>
          </>
        ) : (
          <>
            <span>TRIGGER</span>
            <code>Incoming request</code>
          </>
        )}
      </div>
      {data.kind === 'request' ||
      data.kind === 'data' ||
      data.kind === 'social' ? (
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
  const [advanced, setAdvanced] = useState(false)
  const [config, setConfig] = useState(
    JSON.stringify(node.data.config, null, 2),
  )
  const configure = useStudio((state) => state.configure)
  const message = useStudio((state) => state.message)
  const token = useStudio((state) => state.token)
  const member = useStudio((state) => state.member)
  const remove = useStudio((state) => state.onNodesChange)
  const readonly = useStudio(
    (state) => !can(state.member, 'flows.write') || state.busy,
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
            ? 'Choose a status and add response fields. Values can be fixed or read from the request.'
            : node.data.kind === 'social'
              ? 'Connect a GitHub app for your product. BEGIN starts login; COMPLETE verifies the callback.'
              : node.data.kind === 'data'
                ? 'Choose which spreadsheet rows and columns your API returns.'
                : 'Connect this node to the first step in your API.'}
      </p>
      {node.data.kind === 'response' &&
      !advanced &&
      'status' in node.data.config &&
      'body' in node.data.config ? (
        <ResponseForm
          config={{
            status: node.data.config.status,
            body: node.data.config.body,
          }}
          disabled={readonly}
          onError={(error) => message(error, true)}
          onApply={(value) => {
            configure(node.id, value as FlowNode['config'])
            message('Configuration applied. Save draft to keep changes.')
          }}
        />
      ) : null}
      {node.data.kind === 'condition' &&
      !advanced &&
      'field' in node.data.config &&
      'equals' in node.data.config ? (
        <ConditionForm
          config={{
            field: node.data.config.field,
            equals: node.data.config.equals,
          }}
          disabled={readonly}
          onError={(error) => message(error, true)}
          onApply={(value) => {
            configure(node.id, value as FlowNode['config'])
            message('Configuration applied. Save draft to keep changes.')
          }}
        />
      ) : null}
      {node.data.kind === 'data' &&
      can(member, 'sources.read') &&
      !advanced &&
      'sourceId' in node.data.config ? (
        <DataNodeForm
          config={
            node.data.config as Extract<FlowNode, { type: 'data' }>['config']
          }
          token={token}
          disabled={readonly}
          onError={(error) => message(error, true)}
          onApply={(value) => {
            configure(node.id, value)
            message('Configuration applied. Save draft to keep changes.')
          }}
        />
      ) : null}
      {node.data.kind === 'social' &&
      can(member, 'auth-connections.read') &&
      !advanced &&
      'connectionId' in node.data.config ? (
        <SocialNodeForm
          config={
            node.data.config as Extract<FlowNode, { type: 'social' }>['config']
          }
          token={token}
          disabled={readonly}
          onError={(error) => message(error, true)}
          onApply={(value) => {
            configure(node.id, value)
            message('Configuration applied. Save draft to keep changes.')
          }}
        />
      ) : null}
      {node.data.kind === 'data' && !can(member, 'sources.read') ? (
        <p>Read data sources access is needed to choose saved source fields.</p>
      ) : null}
      {node.data.kind === 'social' && !can(member, 'auth-connections.read') ? (
        <p>
          Read product login connections access is needed to choose a provider
          connection.
        </p>
      ) : null}
      <Button
        className="advanced-toggle"
        variant="ghost"
        aria-expanded={advanced}
        onClick={() => setAdvanced(!advanced)}
      >
        Advanced configuration
      </Button>
      {advanced ? (
        <>
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
        </>
      ) : null}
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
  const editable = can(member, 'flows.write') && !busy

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
            style: { stroke: 'var(--graph-edge)', strokeWidth: 2 },
          }}
        >
          <Background color="var(--graph-dot)" gap={22} size={1} />
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
  const session = useStudio((state) => state.editorSession)
  return <BuilderSession key={session} />
}

function BuilderSession() {
  const state = useStudio()
  const socialFlow = state.nodes.some((node) => node.data.kind === 'social')
  const [loginInput, setLoginInput] = useState<LoginInput>({
    action: 'BEGIN',
    code: '',
    state: '',
    proof: '',
  })
  const [input, setInput] = useState('{\n  "body": {},\n  "query": {}\n}')
  const [advancedInput, setAdvancedInput] = useState(false)
  const [inputError, setInputError] = useState('')
  const [advancedSchema, setAdvancedSchema] = useState(false)
  const [advancedGraphql, setAdvancedGraphql] = useState(false)
  const [operation, setOperation] = useState(() => {
    if (socialFlow && state.graphql) return loginMutation
    const data = state.nodes.find((node) => node.data.kind === 'data')
    if (
      state.graphql &&
      data &&
      'columns' in data.data.config &&
      /\brows\s*(?:\([^)]*\))?\s*:/.test(state.graphql.schema)
    ) {
      return `{ rows { ${data.data.config.columns.join(' ')} } }`
    }
    return '{ hello { message } }'
  })
  const [variables, setVariables] = useState(
    socialFlow ? '{"action":"BEGIN"}' : '{}',
  )
  const [operationName, setOperationName] = useState('')
  const writable = can(state.member, 'flows.write')
  const testable = can(state.member, 'flows.test')
  const publishedEndpoint = state.flows.find(
    (flow) => flow.id === state.id,
  )?.publishedEndpoint

  function testFlow() {
    void state.task(async () => {
      if (socialFlow) {
        const values =
          loginInput.action === 'BEGIN' ? { action: 'BEGIN' } : loginInput
        if (state.graphql)
          await state.testGraphql({ query: loginMutation, variables: values })
        else await state.test(values, {})
        return
      }
      if (state.graphql) {
        await state.testGraphql({
          query: operation,
          variables: JSON.parse(variables),
          ...(operationName.trim()
            ? { operationName: operationName.trim() }
            : {}),
        })
        return
      }
      if (inputError && !advancedInput) throw new Error(inputError)
      const parsed = parseRequestInput(input)
      await state.test(parsed.body, parsed.query, parsed.params)
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
              !can(state.member, 'flows.publish') ||
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
            aria-label="API name"
            value={state.name}
            disabled={!writable || state.busy}
            onChange={(event) => state.edit({ name: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="api-type">API TYPE</label>
          <Select
            id="api-type"
            label="API type"
            value={state.graphql ? 'graphql' : 'rest'}
            disabled={!writable || state.busy}
            onValueChange={(value) => {
              if (value === 'graphql' && routeParameters(state.path).length) {
                state.message(
                  'GraphQL needs an exact endpoint path. Remove named segments such as :id before switching; GraphQL arguments carry those values.',
                  true,
                )
                return
              }
              if (
                value === 'graphql' &&
                state.contract &&
                Object.values(state.contract).some(Boolean) &&
                !confirm(
                  'Switch to GraphQL? This removes REST API rules from this draft. GraphQL uses its own typed schema.',
                )
              )
                return
              state.edit({
                graphql:
                  value === 'graphql'
                    ? {
                        schema: socialFlow
                          ? socialLoginSchema
                          : 'type Query {\n  hello: Greeting!\n}\n\ntype Greeting {\n  message: String!\n}',
                      }
                    : undefined,
                ...(value === 'graphql' ? { method: 'POST' } : {}),
                ...(value === 'graphql' ? { contract: undefined } : {}),
              })
            }}
            options={[
              { value: 'rest', label: 'REST' },
              { value: 'graphql', label: 'GraphQL' },
            ]}
          />
        </div>
        <div>
          <label htmlFor="api-method">METHOD</label>
          <Select
            id="api-method"
            label="HTTP method"
            value={state.method}
            disabled={!writable || state.busy || !!state.graphql}
            onValueChange={(value) => {
              if (['GET', 'HEAD'].includes(value) && state.contract?.body) {
                if (
                  !confirm(
                    `${value} requests have no body. Remove request body rules from this draft?`,
                  )
                )
                  return
                state.edit({
                  method: value as Flow['method'],
                  contract: { ...state.contract, body: undefined },
                })
                return
              }
              state.edit({ method: value as Flow['method'] })
            }}
            options={[
              'GET',
              'POST',
              'PUT',
              'PATCH',
              'DELETE',
              'HEAD',
              'OPTIONS',
            ].map((method) => ({ value: method, label: method }))}
          />
        </div>
        <div className="path-field">
          <label htmlFor="api-path">ENDPOINT PATH</label>
          <div>
            <span>{state.graphql ? '/graphql' : '/run'}</span>
            <Input
              id="api-path"
              aria-label="Endpoint path"
              placeholder={
                state.graphql ? '/v1/customers' : '/v1/customers/:id'
              }
              value={state.path}
              disabled={!writable || state.busy}
              onChange={(event) => state.edit({ path: event.target.value })}
            />
          </div>
        </div>
        <div className="private-label">
          <ShieldCheck size={16} />
          <span>API key protected</span>
        </div>
      </div>
      <p className="field-help">
        {state.graphql
          ? 'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.'
          : 'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.'}
      </p>
      <p className="credential-note endpoint-credential-note">
        Owner and member keys manage drafts. Create an API key in API keys to
        call a published endpoint.
      </p>
      {publishedEndpoint ? (
        <div className="runtime-endpoint studio-runtime-endpoint">
          <label htmlFor="studio-endpoint-url">
            {publishedEndpoint.method} · Published endpoint URL
          </label>
          <Input
            id="studio-endpoint-url"
            aria-label="Published endpoint URL"
            readOnly
            value={
              new URL(
                `${publishedEndpoint.graphql ? '/graphql' : '/run'}${publishedEndpoint.path}`,
                location.origin,
              ).href
            }
          />
        </div>
      ) : null}
      {state.graphql ? (
        <section className="graphql-schema">
          <div className="panel-heading">
            <strong>Typed API contract</strong>
            <span>TYPED CONTRACT</span>
          </div>
          <p>
            {socialFlow
              ? 'A typed login mutation starts or completes GitHub login. BEGIN returns an authorization URL; COMPLETE returns the verified product identity.'
              : state.nodes.some((node) => node.data.kind === 'data')
                ? 'Returns selected spreadsheet fields as typed rows. Test the generated query below before publishing.'
                : 'Response fields must match your typed contract. Open Advanced schema to review or customize it.'}
          </p>
          <Button
            variant="ghost"
            className="advanced-toggle"
            aria-expanded={advancedSchema}
            onClick={() => setAdvancedSchema(!advancedSchema)}
          >
            Advanced schema
          </Button>
          {advancedSchema ? (
            <>
              <label htmlFor="graphql-schema">GraphQL schema</label>
              <Textarea
                id="graphql-schema"
                aria-label="GraphQL schema"
                className="code-input"
                rows={7}
                spellCheck={false}
                value={state.graphql.schema}
                disabled={!writable || state.busy}
                onChange={(event) =>
                  state.edit({ graphql: { schema: event.target.value } })
                }
              />
              <p>
                Each query or mutation field runs this flow. Read arguments with{' '}
                <code>$input.body.name</code>. Branch on{' '}
                <code>query.field</code> or <code>query.operation</code> for
                different operations.
              </p>
            </>
          ) : null}
        </section>
      ) : (
        <ApiRules />
      )}
      <OpenApiDownload />
      <ReleaseHistory />
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
            <span>
              {state.graphql ? 'GRAPHQL OPERATION' : 'REQUEST DETAILS'}
            </span>
          </div>
          {socialFlow ? (
            <ProductLoginTest
              input={loginInput}
              onChange={setLoginInput}
              disabled={!testable || state.busy}
            />
          ) : state.graphql ? (
            <div className="graphql-inputs">
              <label htmlFor="graphql-operation">Operation</label>
              <Textarea
                id="graphql-operation"
                aria-label="GraphQL operation"
                className="code-input"
                spellCheck={false}
                rows={5}
                disabled={!testable || state.busy}
                value={operation}
                onChange={(event) => setOperation(event.target.value)}
              />
              <Button
                variant="ghost"
                className="advanced-toggle"
                aria-expanded={advancedGraphql}
                onClick={() => setAdvancedGraphql(!advancedGraphql)}
              >
                Advanced GraphQL input
              </Button>
              {advancedGraphql ? (
                <>
                  <label htmlFor="graphql-variables">Variables (JSON)</label>
                  <Textarea
                    id="graphql-variables"
                    aria-label="GraphQL variables"
                    className="code-input"
                    spellCheck={false}
                    rows={3}
                    disabled={!testable || state.busy}
                    value={variables}
                    onChange={(event) => setVariables(event.target.value)}
                  />
                  <label htmlFor="graphql-operation-name">
                    Operation name (optional)
                  </label>
                  <Input
                    id="graphql-operation-name"
                    aria-label="GraphQL operation name"
                    disabled={!testable || state.busy}
                    value={operationName}
                    onChange={(event) => setOperationName(event.target.value)}
                  />
                </>
              ) : null}
            </div>
          ) : (
            <>
              {advancedInput ? (
                <Textarea
                  aria-label="Test input"
                  disabled={!testable || state.busy}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="code-input"
                  spellCheck={false}
                  rows={4}
                />
              ) : (
                <RequestForm
                  input={input}
                  path={state.path}
                  disabled={!testable || state.busy}
                  onChange={(value, error) => {
                    setInput(value)
                    setInputError(error)
                  }}
                />
              )}
              <Button
                variant="ghost"
                className="advanced-toggle"
                aria-expanded={advancedInput}
                onClick={() => {
                  if (advancedInput) {
                    try {
                      parseRequestInput(input)
                    } catch (error) {
                      state.message(
                        error instanceof Error
                          ? error.message
                          : 'Check body and query fields.',
                        true,
                      )
                      return
                    }
                  }
                  setAdvancedInput(!advancedInput)
                  setInputError('')
                }}
              >
                Advanced test input
              </Button>
            </>
          )}
          <Button
            variant="outline"
            disabled={state.busy || !testable || !state.id || state.dirty}
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
              ? JSON.stringify(maskedLoginResult(state.result), null, 2)
              : '// Save your draft, then run a test.\n// Your response will appear here.'}
          </pre>
          {socialFlow && state.result ? (
            <LoginResultActions
              value={state.result}
              onMessage={state.message}
            />
          ) : null}
        </div>
      </section>
    </>
  )
}
