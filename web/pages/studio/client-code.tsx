import { useEffect, useRef, useState } from 'react'
import { Copy, Download, RefreshCw } from 'lucide-react'
import type { ApiSchema } from '../../../src/flows/model'
import type {
  ClientCodeMetadata,
  ClientCodeRequest,
  ClientCodeResult,
  ClientCodeSource,
  ClientCodeTarget,
} from '../../../src/flows/client-code-model'
import { can } from '../../../src/workspace/permissions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { RequestForm, parseRequestInput, ValueFields } from './flow-forms'
import { api } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'

function example(schema?: ApiSchema, budget = { remaining: 256 }): unknown {
  if (--budget.remaining < 0) return null
  if (!schema) return {}
  if (schema.type === 'object')
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([name, field]) => [
        name,
        example(field, budget),
      ]),
    )
  if (schema.type === 'array')
    return Array.from({ length: Math.min(schema.minItems ?? 1, 10) }, () =>
      example(schema.items, budget),
    )
  if (schema.type === 'boolean') return true
  if (schema.type === 'number' || schema.type === 'integer')
    return schema.minimum ?? 1
  if (schema.type === 'string')
    return 'example'
      .repeat(Math.ceil(Math.min(schema.minLength ?? 1, 4096) / 7))
      .slice(0, schema.maxLength)
  return 1
}

async function graphqlExample(sdl: string) {
  const gql = await import('graphql')
  const schema = gql.buildSchema(sdl)
  const root = schema.getQueryType() ?? schema.getMutationType()
  const field = root && Object.values(root.getFields())[0]
  if (!field)
    throw new Error('No GraphQL operation available. Review the saved schema.')
  function value(type: import('graphql').GraphQLInputType, depth = 0): unknown {
    if (depth > 6)
      throw new Error('GraphQL input needs a manually reviewed example.')
    if (gql.isNonNullType(type)) return value(type.ofType, depth + 1)
    if (gql.isListType(type)) return [value(type.ofType, depth + 1)]
    if (gql.isEnumType(type)) return type.getValues()[0]?.name
    if (gql.isInputObjectType(type))
      return Object.fromEntries(
        Object.values(type.getFields())
          .filter(
            (item) =>
              gql.isNonNullType(item.type) && item.defaultValue === undefined,
          )
          .map((item) => [item.name, value(item.type, depth + 1)]),
      )
    return type.name === 'Boolean'
      ? true
      : ['Int', 'Float'].includes(type.name)
        ? 1
        : 'example'
  }
  function selection(
    type: import('graphql').GraphQLOutputType,
    depth = 0,
  ): string {
    const named = gql.getNamedType(type)
    if (gql.isLeafType(named)) return ''
    if (!gql.isObjectType(named) || depth >= 4) return ' { __typename }'
    const fields = Object.values(named.getFields())
      .filter(
        (item) =>
          !item.args.some(
            (arg) =>
              gql.isNonNullType(arg.type) && arg.defaultValue === undefined,
          ),
      )
      .slice(0, 8)
    return ` { ${fields.length ? fields.map((item) => `${item.name}${selection(item.type, depth + 1)}`).join(' ') : '__typename'} }`
  }
  const args = field.args.filter(
    (item) => gql.isNonNullType(item.type) && item.defaultValue === undefined,
  )
  return {
    operation: `${schema.getQueryType() ? 'query' : 'mutation'} Example${args.length ? `(${args.map((arg) => `$${arg.name}: ${arg.type}`).join(', ')})` : ''} { ${field.name}${args.length ? `(${args.map((arg) => `${arg.name}: $${arg.name}`).join(', ')})` : ''}${selection(field.type)} }`,
    variables: Object.fromEntries(
      args.map((arg) => [arg.name, value(arg.type)]),
    ),
  }
}

export function ClientCode() {
  const state = useStudio()
  const [source, setSource] = useState<ClientCodeSource>('published')
  const [metadata, setMetadata] = useState<ClientCodeMetadata | null>(null)
  const [target, setTarget] = useState<ClientCodeTarget>('javascript-fetch')
  const [baseUrl, setBaseUrl] = useState(location.origin)
  const [request, setRequest] = useState('{"body":{},"query":{}}')
  const [operation, setOperation] = useState('')
  const [operationName, setOperationName] = useState('')
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [variablesJson, setVariablesJson] = useState('{}')
  const [inputError, setInputError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [advanced, setAdvanced] = useState(false)
  const [result, setResult] = useState<ClientCodeResult | null>(null)
  const [copied, setCopied] = useState(false)
  const active = useRef(false)
  const sequence = useRef(0)
  const pending = useRef(false)
  const allowed = can(state.member, 'flows.read')

  function current() {
    const live = useStudio.getState()
    return (
      active.current &&
      live.editorSession === state.editorSession &&
      live.sessionId === state.sessionId &&
      live.member?.id === state.member?.id &&
      can(live.member, 'flows.read')
    )
  }

  useEffect(() => {
    if (!allowed || !state.id) return
    active.current = true
    let alive = true
    const seq = ++sequence.current
    setLoading(true)
    setMetadata(null)
    setResult(null)
    setError('')
    setInputError('')
    setAdvanced(false)
    void api<ClientCodeMetadata>(
      `/api/flows/${state.id}/client-code?source=${source}`,
      state.token,
    )
      .then(async (value) => {
        const seeded = value.graphql
          ? await graphqlExample(value.graphql.schema)
          : null
        if (!alive || seq !== sequence.current || !current()) return
        setMetadata(value)
        const params = example(value.contract?.params) as Record<
          string,
          unknown
        >
        setRequest(
          JSON.stringify({
            params: Object.fromEntries(
              Object.entries(params).map(([name, input]) => [
                name,
                String(input),
              ]),
            ),
            query: Object.fromEntries(
              Object.entries(
                example(value.contract?.query) as Record<string, unknown>,
              ).map(([name, input]) => [name, String(input)]),
            ),
            body: example(value.contract?.body),
          }),
        )
        setOperation(seeded?.operation ?? '')
        setOperationName('')
        setVariables(seeded?.variables ?? {})
        setVariablesJson(JSON.stringify(seeded?.variables ?? {}, null, 2))
      })
      .catch((reason: Error) => {
        if (alive && seq === sequence.current && current())
          setError(reason.message)
      })
      .finally(() => {
        if (alive && seq === sequence.current && current()) setLoading(false)
      })
    return () => {
      alive = false
      active.current = false
      sequence.current++
    }
  }, [
    allowed,
    state.id,
    state.editorSession,
    state.sessionId,
    state.member?.id,
    state.token,
    state.revision,
    state.publishedRevision,
    source,
    refresh,
  ])

  function invalidate() {
    setResult(null)
    setCopied(false)
    setError('')
  }

  function generate() {
    if (!metadata || !current() || state.busy || pending.current) return
    const seq = sequence.current
    pending.current = true
    void state
      .task(async () => {
        if (!current()) return
        invalidate()
        try {
          if (inputError && !advanced) throw new Error(inputError)
          let values: ClientCodeRequest['request']
          if (metadata.graphql) {
            const parsed: unknown = advanced
              ? JSON.parse(variablesJson)
              : variables
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
              throw new Error('GraphQL variables must be an object.')
            values = {
              graphql: {
                query: operation,
                variables: parsed as Record<string, unknown>,
                ...(operationName.trim()
                  ? { operationName: operationName.trim() }
                  : {}),
              },
            }
          } else {
            const parsed = parseRequestInput(request)
            values = {
              params: parsed.params,
              query: parsed.query,
              ...(!['GET', 'HEAD'].includes(metadata.method)
                ? { body: parsed.body }
                : {}),
            }
          }
          const generated = await api<ClientCodeResult>(
            `/api/flows/${state.id}/client-code`,
            state.token,
            'POST',
            {
              target,
              source,
              revision: metadata.revision,
              baseUrl: baseUrl.trim() || location.origin,
              request: values,
            },
          )
          if (current() && seq === sequence.current) setResult(generated)
        } catch (reason) {
          if (current() && seq === sequence.current)
            setError(
              reason instanceof Error
                ? reason.message
                : 'Could not generate example.',
            )
        }
      })
      .finally(() => {
        pending.current = false
      })
  }

  if (!allowed) return null
  const disabled = state.busy || loading
  return (
    <section
      className="client-code-panel release-history"
      aria-label="Use this API"
    >
      <div className="panel-heading">
        <strong>Use this API</strong>
        <span>CLIENT EXAMPLE</span>
      </div>
      <p>
        Generate code for your application. This does not call your API. Keep
        its runtime key on your application server in{' '}
        <code>BESH_RUNTIME_API_KEY</code>; never put it in browser code.
      </p>
      {state.dirty ? (
        <p className="credential-note">
          Unsaved edits are excluded. Examples use only the selected saved draft
          or published release.
        </p>
      ) : null}
      <div className="simple-form">
        <label>
          Example source
          <Select
            label="Example source"
            value={source}
            disabled={state.busy}
            onValueChange={(value) => {
              invalidate()
              setMetadata(null)
              setSource(value as ClientCodeSource)
            }}
            options={[
              { value: 'published', label: 'Published release' },
              { value: 'draft', label: 'Saved draft' },
            ]}
          />
        </label>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw /> Refresh saved source
        </Button>
        {loading ? <p>Loading saved API…</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error} Refresh the saved source to retry. An unpublished API can
            use Saved draft.
          </p>
        ) : null}
        {metadata ? (
          <>
            <p>
              <strong>
                {source === 'published' ? 'Published release' : 'Saved draft'} ·
                revision {metadata.revision}
              </strong>
              <br />
              <code>
                {metadata.method} {metadata.graphql ? '/graphql' : '/run'}
                {metadata.path}
              </code>
            </p>
            {source === 'draft' ? (
              <p className="credential-note">
                Publish this saved revision before using its example. The
                current live release may have a different route or contract.
              </p>
            ) : null}
            <label>
              Client language
              <Select
                label="Client language"
                value={target}
                disabled={disabled}
                options={metadata.targets.map((entry) => ({
                  value: entry.id,
                  label: entry.label,
                }))}
                onValueChange={(value) => {
                  invalidate()
                  setTarget(value as ClientCodeTarget)
                }}
              />
            </label>
            <label>
              Base URL (optional override)
              <Input
                aria-label="Client base URL"
                value={baseUrl}
                disabled={disabled}
                placeholder={location.origin}
                onChange={(event) => {
                  invalidate()
                  setBaseUrl(event.target.value)
                }}
              />
            </label>
            <p>
              Use your server address, with an optional deployment prefix. No
              credentials, query string, or fragment.
            </p>
            {metadata.graphql ? (
              <>
                <label>
                  GraphQL operation
                  <Textarea
                    aria-label="Client GraphQL operation"
                    className="code-input"
                    rows={4}
                    value={operation}
                    disabled={disabled}
                    onChange={(event) => {
                      invalidate()
                      setOperation(event.target.value)
                    }}
                  />
                </label>
                <label>
                  Operation name (optional)
                  <Input
                    aria-label="Client operation name"
                    value={operationName}
                    disabled={disabled}
                    onChange={(event) => {
                      invalidate()
                      setOperationName(event.target.value)
                    }}
                  />
                </label>
                {!advanced ? (
                  <>
                    <h3>GraphQL variables</h3>
                    <ValueFields
                      key={`${source}:${metadata.revision}:${refresh}`}
                      value={variables}
                      disabled={disabled}
                      onChange={(value, issue) => {
                        invalidate()
                        setVariables(value)
                        setInputError(issue)
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : !advanced ? (
              <RequestForm
                key={`${source}:${metadata.revision}:${refresh}`}
                input={request}
                path={metadata.path}
                includeBody={!['GET', 'HEAD'].includes(metadata.method)}
                disabled={disabled}
                onChange={(value, issue) => {
                  invalidate()
                  setRequest(value)
                  setInputError(issue)
                }}
              />
            ) : null}
            <Button
              variant="ghost"
              aria-expanded={advanced}
              disabled={disabled}
              onClick={() => {
                invalidate()
                if (!advanced)
                  setVariablesJson(JSON.stringify(variables, null, 2))
                else {
                  try {
                    if (metadata.graphql) {
                      const parsed = JSON.parse(variablesJson)
                      if (
                        !parsed ||
                        typeof parsed !== 'object' ||
                        Array.isArray(parsed)
                      )
                        throw new Error('GraphQL variables must be an object.')
                      setVariables(parsed)
                    } else parseRequestInput(request)
                    setInputError('')
                  } catch (reason) {
                    setError(
                      reason instanceof Error ? reason.message : 'Review JSON.',
                    )
                    return
                  }
                }
                setAdvanced(!advanced)
              }}
            >
              Advanced request JSON
            </Button>
            {advanced ? (
              <label>
                {metadata.graphql ? 'GraphQL variables JSON' : 'Request JSON'}
                <Textarea
                  aria-label="Client request JSON"
                  className="code-input"
                  rows={7}
                  value={metadata.graphql ? variablesJson : request}
                  disabled={disabled}
                  onChange={(event) => {
                    invalidate()
                    metadata.graphql
                      ? setVariablesJson(event.target.value)
                      : setRequest(event.target.value)
                  }}
                />
              </label>
            ) : null}
            <Button disabled={disabled} onClick={generate}>
              Generate example
            </Button>
          </>
        ) : null}
        {result ? (
          <div className="client-code-result">
            <p>
              <strong>{result.method}</strong> <code>{result.url}</code>
            </p>
            {result.warnings.map((warning) => (
              <p className="credential-note" key={warning}>
                {warning}
              </p>
            ))}
            <h3>Requirements</h3>
            <ul>
              {result.dependencies.map((dependency) => (
                <li key={dependency}>{dependency}</li>
              ))}
            </ul>
            <pre
              aria-label="Generated client code"
              tabIndex={0}
              className="code-input"
            >
              {result.code}
            </pre>
            <div className="title-actions">
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(result.code)
                    .then(() => {
                      if (current()) setCopied(true)
                    })
                    .catch(() => {
                      if (current())
                        setError(
                          'Copy unavailable. Select the code or download it.',
                        )
                    })
                }
              >
                <Copy /> {copied ? 'Code copied' : 'Copy code'}
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([result.code], { type: result.contentType }),
                  )
                  const link = document.createElement('a')
                  link.href = url
                  link.download = result.filename
                  link.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download /> Download code
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
