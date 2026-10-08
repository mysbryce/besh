import { useEffect, useRef, useState } from 'react'
import { Gauge, Play, RefreshCw, ShieldCheck, Square } from 'lucide-react'
import type {
  LoadTestConfig,
  LoadTestRequest,
  LoadTestRun,
  LoadTestStart,
  LoadTestTarget,
} from '../src/load-test-model'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Textarea } from './components/ui/textarea'
import { parseRequestInput, RequestForm, routeParameters } from './flow-forms'
import { api } from './lib/api'
import { useStudio } from './store'
import { can } from '../src/permissions'

const defaults: LoadTestConfig = {
  vus: 1,
  durationSeconds: 5,
  p95Ms: 1000,
  maxErrorRate: 0.01,
  expectedStatus: null,
}

const statusLabels: Record<LoadTestRun['status'], string> = {
  running: 'Preparing k6 or running',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
  interrupted: 'Interrupted',
}

function endpointPath(target: { path: string; graphql: unknown }) {
  return `${target.graphql ? '/graphql' : '/run'}${target.path}`
}

export function LoadTests() {
  const token = useStudio((state) => state.token)
  const member = useStudio((state) => state.member)
  const sessionId = useStudio((state) => state.sessionId)
  const busy = useStudio((state) => state.busy)
  const [targets, setTargets] = useState<LoadTestTarget[]>([])
  const [runs, setRuns] = useState<LoadTestRun[]>([])
  const [targetId, setTargetId] = useState('')
  const [runId, setRunId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readError, setReadError] = useState('')
  const active = useRef(false)
  const pending = useRef(false)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)
  const selected =
    targets.find((target) => target.id === targetId) ?? targets[0]
  const running = runs.find((run) => run.status === 'running')
  const result = runs.find((run) => run.id === runId) ?? running ?? runs[0]

  function current() {
    const state = useStudio.getState()
    return (
      active.current &&
      state.token === token &&
      state.member?.id === member?.id &&
      can(state.member, 'load-tests.run') &&
      state.sessionId === sessionId
    )
  }

  useEffect(() => {
    if (!can(member, 'load-tests.run')) return
    active.current = true
    let alive = true
    let timer: number | undefined
    let refreshing = false
    setLoading(true)
    setTargets([])
    setRuns([])
    setError('')
    setReadError('')

    async function refresh() {
      if (refreshing) return
      refreshing = true
      try {
        const [available, history] = await Promise.all([
          api<LoadTestTarget[]>('/api/load-tests/targets', token),
          api<LoadTestRun[]>('/api/load-tests', token),
        ])
        if (!alive) return
        setTargets(available)
        setRuns(history)
        setReadError('')
      } catch (reason) {
        if (alive)
          setReadError(
            reason instanceof Error
              ? reason.message
              : 'Could not refresh load tests.',
          )
      } finally {
        refreshing = false
        if (alive) setLoading(false)
      }
    }

    async function poll() {
      await refresh()
      if (alive) timer = window.setTimeout(poll, 1000)
    }

    refreshRef.current = refresh
    void poll()
    return () => {
      alive = false
      active.current = false
      refreshRef.current = null
      window.clearTimeout(timer)
    }
  }, [token, member?.id, member?.role, member?.permissions, sessionId])

  async function perform(path: string, body?: LoadTestStart) {
    if (pending.current || useStudio.getState().busy || !current()) return
    pending.current = true
    await useStudio.getState().task(async () => {
      if (!current()) return
      setError('')
      try {
        const record = await api<LoadTestRun>(path, token, 'POST', body)
        if (!current()) return
        setRuns((history) => [
          record,
          ...history.filter((run) => run.id !== record.id),
        ])
        setRunId(record.id)
        useStudio
          .getState()
          .message(
            record.status === 'running'
              ? 'Load test started. You can leave this page.'
              : 'Load test canceled.',
          )
      } catch (reason) {
        if (!current()) return
        await refreshRef.current?.()
        if (!current()) return
        setError(
          `${reason instanceof Error ? reason.message : 'Request failed.'} Check recent runs before starting again.`,
        )
        throw reason
      }
    })
    pending.current = false
  }

  if (!can(member, 'load-tests.run'))
    return (
      <div className="empty-panel">
        <ShieldCheck />
        <h1>Owner access required</h1>
        <p>
          Your {member?.role} role cannot run or view workspace load tests. Ask
          an owner to test the published API.
        </p>
      </div>
    )

  return (
    <div className="load-tests-page">
      <div className="page-title">
        <div>
          <div className="eyebrow">SEE HOW YOUR LIVE API PERFORMS</div>
          <h1>
            Load testing <Badge variant="outline">k6</Badge>
          </h1>
          <p>
            Choose a published API. Run a small test. See requests, errors, and
            response times.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || loading}
          onClick={() => void refreshRef.current?.()}
        >
          <RefreshCw /> Refresh
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {readError ? (
        <p className="form-error" role="alert">
          {readError} Use Refresh to try again.
        </p>
      ) : null}
      {loading ? (
        <p role="status">Loading published APIs and recent tests…</p>
      ) : null}
      {!loading && !readError && !targets.length ? (
        <div className="empty-panel">
          <Gauge />
          <h2>Publish an API first</h2>
          <p>
            Save and publish an API in API Studio, then return here to test its
            live release.
          </p>
        </div>
      ) : selected ? (
        <section className="load-test-card" aria-label="New load test">
          <label className="load-test-field">
            Published API
            <Select
              label="Published API"
              value={selected.id}
              disabled={busy || loading || !!running}
              onValueChange={setTargetId}
              options={targets.map((target) => ({
                value: target.id,
                label: `${target.name} · ${target.graphql ? 'GraphQL' : target.method}`,
              }))}
            />
          </label>
          <p className="load-test-endpoint">
            <Badge variant="outline">{selected.method}</Badge>{' '}
            <code>{endpointPath(selected)}</code>{' '}
            <span>Published v{selected.revision}</span>
          </p>
          <p>
            Uses the published release. Besh prepares k6 and temporary API
            access automatically.
          </p>
          {selected.unavailableReason ? (
            <p role="alert" className="form-error">
              {selected.unavailableReason}
            </p>
          ) : null}
          <StartForm
            key={`${selected.id}:${selected.revision}`}
            target={selected}
            disabled={
              busy || loading || !!running || !!selected.unavailableReason
            }
            onRun={(request, config) => {
              if (pending.current || useStudio.getState().busy || !current())
                return
              if (
                !window.confirm(
                  `Send repeated LIVE ${selected.method} requests to ${endpointPath(selected)}? This can change data for writes and mutations. Run ${config.vus} virtual user${config.vus === 1 ? '' : 's'} for ${config.durationSeconds} second${config.durationSeconds === 1 ? '' : 's'}.`,
                )
              )
                return
              void perform('/api/load-tests', {
                flowId: selected.id,
                config,
                request,
              })
            }}
          />
          {running ? (
            <p role="status">
              One test is already running. You can leave this page and return to
              its results.
            </p>
          ) : null}
        </section>
      ) : null}
      {result ? (
        <Results
          run={result}
          busy={busy}
          onCancel={() => void perform(`/api/load-tests/${result.id}/cancel`)}
        />
      ) : null}
      <section className="load-test-card" aria-label="Recent load tests">
        <h2>Recent load tests</h2>
        <p>
          Latest 100 tests. Results survive leaving this page and reloading.
          Request values and credentials are not saved in test history.
        </p>
        {runs.length ? (
          <div className="load-test-history">
            {runs.map((run) => (
              <button
                key={run.id}
                className={result?.id === run.id ? 'selected' : ''}
                aria-pressed={result?.id === run.id}
                onClick={() => setRunId(run.id)}
                disabled={busy}
              >
                <strong>{run.flowName}</strong>
                <span>{statusLabels[run.status]}</span>
                <small>
                  {new Date(run.createdAt).toLocaleString()} · v{run.revision} ·{' '}
                  {run.config.vus} VU · {run.config.durationSeconds}s
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p>No load tests yet.</p>
        )}
      </section>
    </div>
  )
}

function StartForm({
  target,
  disabled,
  onRun,
}: {
  target: LoadTestTarget
  disabled: boolean
  onRun: (request: LoadTestRequest, config: LoadTestConfig) => void
}) {
  const [config, setConfig] = useState(defaults)
  const [settings, setSettings] = useState(false)
  const [inputs, setInputs] = useState(routeParameters(target.path).length > 0)
  const [advanced, setAdvanced] = useState(false)
  const [request, setRequest] = useState(
    JSON.stringify({
      body: ['GET', 'HEAD'].includes(target.method) ? null : {},
      query: {},
    }),
  )
  const [requestError, setRequestError] = useState('')
  const [requestTouched, setRequestTouched] = useState(false)
  const [error, setError] = useState('')
  const [operation, setOperation] = useState('')
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [variablesJson, setVariablesJson] = useState('{}')
  const [operationName, setOperationName] = useState('')
  const [seeding, setSeeding] = useState(!!target.graphql)

  useEffect(() => {
    if (!target.graphql) return
    let alive = true
    void seedOperation(target.graphql.schema)
      .then((query) => {
        if (alive) setOperation(query)
      })
      .catch(() => {
        if (alive)
          setError(
            'Could not prepare an example. Enter a GraphQL query or mutation matching this published schema.',
          )
      })
      .finally(() => {
        if (alive) setSeeding(false)
      })
    return () => {
      alive = false
    }
  }, [target.graphql?.schema])

  function start(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      if (
        !Number.isInteger(config.vus) ||
        config.vus < 1 ||
        config.vus > 10 ||
        !Number.isInteger(config.durationSeconds) ||
        config.durationSeconds < 1 ||
        config.durationSeconds > 30 ||
        !Number.isFinite(config.p95Ms) ||
        config.p95Ms < 1 ||
        config.p95Ms > 60000 ||
        !Number.isFinite(config.maxErrorRate) ||
        config.maxErrorRate < 0 ||
        config.maxErrorRate > 1 ||
        (config.expectedStatus !== null &&
          (!Number.isInteger(config.expectedStatus) ||
            config.expectedStatus < 200 ||
            config.expectedStatus > 599))
      )
        throw new Error(
          'Check Load settings. Keep values within the displayed limits.',
        )
      if (requestError && !advanced) throw new Error(requestError)
      const input = target.graphql
        ? {
            body: null,
            query: {},
            graphql: {
              query: operation,
              variables: advanced ? JSON.parse(variablesJson) : variables,
              ...(operationName.trim()
                ? { operationName: operationName.trim() }
                : {}),
            },
          }
        : requestTouched || advanced || routeParameters(target.path).length > 0
          ? parseRequestInput(request)
          : { body: null, query: {} }
      if (target.graphql && !operation.trim())
        throw new Error('Enter a GraphQL query or mutation.')
      if (
        !target.graphql &&
        routeParameters(target.path).some(
          (name) => !('params' in input) || !input.params?.[name]?.trim(),
        )
      )
        throw new Error(
          'Enter a value for every path parameter in Request inputs.',
        )
      onRun(input, config)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Check request inputs.',
      )
    }
  }

  function setting(name: keyof LoadTestConfig, value: string) {
    setConfig((previous) => ({
      ...previous,
      [name]: name === 'maxErrorRate' ? Number(value) / 100 : Number(value),
    }))
  }

  return (
    <form onSubmit={start}>
      <p className="load-test-defaults">
        {config.vus} virtual user{config.vus === 1 ? '' : 's'} ·{' '}
        {config.durationSeconds} second{config.durationSeconds === 1 ? '' : 's'}
      </p>
      <p>
        A virtual user repeatedly calls your API. Defaults check 95% of
        responses finish within 1,000 ms, with at most 1% HTTP errors.
      </p>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={settings}
        onClick={() => setSettings(!settings)}
      >
        Load settings
      </Button>
      {settings ? (
        <div className="load-test-settings">
          <label>
            Virtual users (1–10)
            <Input
              aria-label="Virtual users"
              type="number"
              min={1}
              max={10}
              required
              value={config.vus}
              disabled={disabled}
              onChange={(event) => setting('vus', event.target.value)}
            />
          </label>
          <label>
            Duration in seconds (1–30)
            <Input
              aria-label="Duration in seconds"
              type="number"
              min={1}
              max={30}
              required
              value={config.durationSeconds}
              disabled={disabled}
              onChange={(event) =>
                setting('durationSeconds', event.target.value)
              }
            />
          </label>
          <label>
            95th percentile limit (ms)
            <Input
              aria-label="95th percentile limit (ms)"
              type="number"
              min={1}
              max={60000}
              required
              value={config.p95Ms}
              disabled={disabled}
              onChange={(event) => setting('p95Ms', event.target.value)}
            />
          </label>
          <label>
            Maximum HTTP error rate (%)
            <Input
              aria-label="Maximum HTTP error rate (%)"
              type="number"
              min={0}
              max={100}
              step={0.1}
              required
              value={config.maxErrorRate * 100}
              disabled={disabled}
              onChange={(event) => setting('maxErrorRate', event.target.value)}
            />
          </label>
          <label>
            Expected response
            <Select
              label="Expected response"
              value={config.expectedStatus === null ? 'any' : 'specific'}
              disabled={disabled}
              onValueChange={(value) =>
                setConfig((previous) => ({
                  ...previous,
                  expectedStatus: value === 'any' ? null : 200,
                }))
              }
              options={[
                { value: 'any', label: 'Any successful status (200–299)' },
                { value: 'specific', label: 'A specific status' },
              ]}
            />
          </label>
          {config.expectedStatus !== null ? (
            <label>
              Expected status (200–599)
              <Input
                aria-label="Expected status"
                type="number"
                min={200}
                max={599}
                required
                value={config.expectedStatus}
                disabled={disabled}
                onChange={(event) =>
                  setting('expectedStatus', event.target.value)
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {target.graphql ? (
        <div className="load-test-inputs">
          <label>
            GraphQL query or mutation
            <Textarea
              aria-label="GraphQL query or mutation"
              rows={5}
              value={operation}
              disabled={disabled || seeding}
              onChange={(event) => setOperation(event.target.value)}
              spellCheck={false}
            />
          </label>
          <p>
            {seeding
              ? 'Preparing an example from the published schema…'
              : 'Example uses the published schema. Edit arguments and selected fields as needed.'}
          </p>
          {!advanced ? (
            <VariableFields
              values={variables}
              disabled={disabled}
              onChange={setVariables}
            />
          ) : null}
          <label>
            Operation name (optional)
            <Input
              aria-label="Operation name (optional)"
              value={operationName}
              disabled={disabled}
              onChange={(event) => setOperationName(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          aria-expanded={inputs}
          onClick={() => setInputs(!inputs)}
        >
          Request inputs
        </Button>
      )}
      {inputs && !target.graphql && !advanced ? (
        <RequestForm
          input={request}
          path={target.path}
          disabled={disabled}
          onChange={(value, issue) => {
            setRequest(value)
            setRequestTouched(true)
            setRequestError(issue)
          }}
        />
      ) : null}
      {inputs || target.graphql ? (
        <>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={advanced}
            onClick={() => {
              if (!advanced)
                setVariablesJson(JSON.stringify(variables, null, 2))
              else {
                try {
                  if (target.graphql) {
                    const parsed = JSON.parse(variablesJson)
                    if (
                      !parsed ||
                      Array.isArray(parsed) ||
                      typeof parsed !== 'object'
                    )
                      throw new Error('Variables must be an object.')
                    setVariables(parsed)
                  } else parseRequestInput(request)
                  setError('')
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : 'Check advanced inputs.',
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
            <label className="load-test-field">
              {target.graphql ? 'GraphQL variables JSON' : 'Request JSON'}
              <Textarea
                aria-label={
                  target.graphql ? 'GraphQL variables JSON' : 'Request JSON'
                }
                rows={7}
                value={target.graphql ? variablesJson : request}
                disabled={disabled}
                onChange={(event) => {
                  if (target.graphql) setVariablesJson(event.target.value)
                  else {
                    setRequest(event.target.value)
                    setRequestTouched(true)
                  }
                }}
                spellCheck={false}
              />
            </label>
          ) : null}
        </>
      ) : null}
      {requestError && !advanced ? (
        <p className="form-error" role="alert">
          {requestError}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="load-test-actions">
        <Button disabled={disabled || seeding} type="submit">
          <Play /> Run load test
        </Button>
        <span>Live requests. Writes and mutations can change data.</span>
      </div>
    </form>
  )
}

function VariableFields({
  values,
  disabled,
  onChange,
}: {
  values: Record<string, unknown>
  disabled: boolean
  onChange: (values: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [issue, setIssue] = useState('')
  return (
    <div className="load-test-variables">
      <h3>Variables (optional)</h3>
      {Object.entries(values).map(([key, value]) => (
        <div className="load-test-variable" key={key}>
          <label>
            {key}
            <Input
              aria-label={`Variable ${key}`}
              value={
                typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)
              }
              type={typeof value === 'number' ? 'number' : 'text'}
              disabled={
                disabled ||
                typeof value === 'object' ||
                typeof value === 'boolean'
              }
              onChange={(event) =>
                onChange({
                  ...values,
                  [key]:
                    typeof value === 'number'
                      ? Number(event.target.value)
                      : event.target.value,
                })
              }
            />
          </label>
          <Select
            label={`Variable ${key} type`}
            value={
              value === null
                ? 'null'
                : typeof value === 'object'
                  ? 'nested'
                  : typeof value
            }
            disabled={disabled || (typeof value === 'object' && value !== null)}
            options={[
              { value: 'string', label: 'Text' },
              { value: 'number', label: 'Number' },
              { value: 'boolean', label: 'True or false' },
              { value: 'null', label: 'Empty value' },
              ...(typeof value === 'object' && value !== null
                ? [{ value: 'nested', label: 'Nested data' }]
                : []),
            ]}
            onValueChange={(type) =>
              onChange({
                ...values,
                [key]:
                  type === 'number'
                    ? 1
                    : type === 'boolean'
                      ? true
                      : type === 'null'
                        ? null
                        : '',
              })
            }
          />
          {typeof value === 'boolean' ? (
            <Select
              label={`Variable ${key} value`}
              value={String(value)}
              disabled={disabled}
              options={[
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' },
              ]}
              onValueChange={(next) =>
                onChange({ ...values, [key]: next === 'true' })
              }
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-label={`Remove variable ${key}`}
            onClick={() => {
              const next = { ...values }
              delete next[key]
              onChange(next)
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="load-test-variable">
        <label>
          New variable name
          <Input
            aria-label="New variable name"
            value={name}
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. name"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (
              !/^[_A-Za-z][_0-9A-Za-z]*$/.test(name) ||
              Object.hasOwn(values, name)
            ) {
              setIssue('Use a unique GraphQL variable name.')
              return
            }
            onChange({ ...values, [name]: '' })
            setName('')
            setIssue('')
          }}
        >
          Add variable
        </Button>
      </div>
      {issue ? (
        <p role="alert" className="form-error">
          {issue}
        </p>
      ) : null}
    </div>
  )
}

function Results({
  run,
  busy,
  onCancel,
}: {
  run: LoadTestRun
  busy: boolean
  onCancel: () => void
}) {
  const summary = run.summary
  return (
    <section className="load-test-card" aria-label="Load test results">
      <div className="load-test-result-title">
        <h2>{run.flowName}</h2>
        <Badge variant="outline">{statusLabels[run.status]}</Badge>
      </div>
      <p className="load-test-endpoint">
        <code>
          {run.method} {endpointPath(run)}
        </code>
        <span>Published v{run.revision}</span>
      </p>
      <p>
        {run.config.vus} virtual user{run.config.vus === 1 ? '' : 's'} ·{' '}
        {run.config.durationSeconds} second
        {run.config.durationSeconds === 1 ? '' : 's'}
      </p>
      {run.status === 'running' ? (
        <>
          <p role="status">
            Preparing k6 or running. First use may need a download. You can
            leave and return while this test runs.
          </p>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            <Square /> Cancel run
          </Button>
        </>
      ) : null}
      {run.error ? (
        <p className="form-error" role="alert">
          {run.error}
        </p>
      ) : null}
      {run.status === 'canceled' || run.status === 'interrupted' ? (
        <p>
          Test stopped. Requests already sent can still have effects. Start
          another test when ready.
        </p>
      ) : null}
      {summary ? (
        <>
          <p
            className={
              summary.thresholdsPassed ? 'load-test-pass' : 'form-error'
            }
          >
            <strong>
              {summary.thresholdsPassed
                ? 'All limits passed'
                : 'Some limits failed'}
            </strong>
          </p>
          <dl className="load-test-metrics">
            {[
              ['Requests', summary.requests.toLocaleString()],
              ['Requests / second', summary.requestsPerSecond.toFixed(1)],
              [
                'HTTP errors',
                `${summary.failedRequests.toLocaleString()} (${summary.requests ? ((summary.failedRequests / summary.requests) * 100).toFixed(1) : '0'}%)`,
              ],
              [
                'Response checks passed',
                `${(summary.checkRate * 100).toFixed(1)}%`,
              ],
              ['Average response', `${summary.avgMs.toFixed(1)} ms`],
              ['95th percentile', `${summary.p95Ms.toFixed(1)} ms`],
              ['Slowest response', `${summary.maxMs.toFixed(1)} ms`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="load-test-limits">
            <li>
              95th percentile: 95% of responses should finish within{' '}
              {run.config.p95Ms.toLocaleString()} ms.
            </li>
            <li>
              HTTP errors: at most {run.config.maxErrorRate * 100}% of requests
              {run.config.maxErrorRate === 0 ? ' (zero errors allowed)' : ''}.
            </li>
            <li>
              Response checks: at least {100 - run.config.maxErrorRate * 100}%
              must have{' '}
              {run.config.expectedStatus === null
                ? 'a successful status (200–299)'
                : `status ${run.config.expectedStatus}`}
              {run.graphql ? ' and valid GraphQL data without errors' : ''}.
            </li>
          </ul>
          <p>
            A small test is a starting point. It does not predict production
            capacity.
          </p>
        </>
      ) : null}
    </section>
  )
}

async function seedOperation(sdl: string) {
  const gql = await import('graphql')
  const schema = gql.buildSchema(sdl)
  const root = schema.getQueryType() ?? schema.getMutationType()
  if (!root) throw new Error('No operation available.')
  const field = Object.values(root.getFields())[0]
  if (!field) throw new Error('No operation available.')

  function argument(
    type: import('graphql').GraphQLInputType,
    depth = 0,
  ): string {
    if (depth > 6) throw new Error('Input needs manual values.')
    if (gql.isNonNullType(type)) return argument(type.ofType, depth + 1)
    if (gql.isListType(type)) return `[${argument(type.ofType, depth + 1)}]`
    if (gql.isEnumType(type)) return type.getValues()[0]?.name ?? 'null'
    if (gql.isInputObjectType(type))
      return `{ ${Object.values(type.getFields())
        .filter(
          (item) =>
            gql.isNonNullType(item.type) && item.defaultValue === undefined,
        )
        .map((item) => `${item.name}: ${argument(item.type, depth + 1)}`)
        .join(', ')} }`
    return type.name === 'Boolean'
      ? 'true'
      : ['Int', 'Float'].includes(type.name)
        ? '1'
        : '"example"'
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

  const args = field.args
    .filter(
      (item) => gql.isNonNullType(item.type) && item.defaultValue === undefined,
    )
    .map((item) => `${item.name}: ${argument(item.type)}`)
  return `${schema.getQueryType() ? 'query' : 'mutation'} { ${field.name}${args.length ? `(${args.join(', ')})` : ''}${selection(field.type)} }`
}
