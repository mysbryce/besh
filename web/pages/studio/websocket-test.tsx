import { useEffect, useRef, useState } from 'react'
import type { ApiSchema } from '../../../src/flows/model'
import { can } from '../../../src/workspace/permissions'
import { api, ApiError } from '../../lib/api'
import type { SavedFlow } from '../../types/api'
import { useStudio } from '../../stores/studio-store'
import { TenantReview, useTenantReview } from '../../components/tenant-review'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'

type TicketReceipt = {
  ticket: string
  expiresAt: string
  revision: number
  path: string
  protocol: 'besh.ws.v1'
}
type Reply = { id: string; result?: unknown; error?: string }

function ReplyFields({ reply, schema }: { reply: Reply; schema: ApiSchema }) {
  const object = schema.type === 'array' ? schema.items : schema
  const names =
    object.type === 'object' ? Object.keys(object.properties ?? {}) : []
  const cell = (row: Record<string, unknown>, name: string) => {
    const value = row[name]
    return value === null
      ? 'Empty (null)'
      : value === undefined
        ? 'Not included'
        : typeof value === 'boolean'
          ? value
            ? 'True'
            : 'False'
          : typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : 'Unsupported value'
  }
  const isRow = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value)
  if (reply.error)
    return (
      <p className="form-error" role="alert">
        {reply.error}
      </p>
    )
  if (schema.type === 'array' && Array.isArray(reply.result)) {
    const rows = reply.result.filter(isRow).slice(0, 100)
    return (
      <div className="form-stack">
        <h3>Reply rows</h3>
        <p>
          {rows.length} {rows.length === 1 ? 'row' : 'rows'} returned.
        </p>
        <div className="data-table source-table">
          <table aria-label="WebSocket reply rows">
            <thead>
              <tr>
                {names.map((name) => (
                  <th key={name} className="[overflow-wrap:anywhere]">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {names.map((name) => (
                    <td key={name} className="[overflow-wrap:anywhere]">
                      {cell(row, name)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? <p>No matching rows.</p> : null}
      </div>
    )
  }
  if (isRow(reply.result)) {
    const row = reply.result
    return (
      <div className="form-stack" aria-label="WebSocket reply fields">
        <h3>Reply fields</h3>
        <dl className="form-stack">
          {names.map((name) => (
            <div className="rule-field [overflow-wrap:anywhere]" key={name}>
              <dt className="font-semibold">{name}</dt>
              <dd className="m-0">{cell(row, name)}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
  return <p>Reply received. Open Advanced reply JSON to inspect its format.</p>
}

function MessageFields({
  schema,
  disabled,
  onSend,
}: {
  schema: ApiSchema
  disabled: boolean
  onSend: (body: Record<string, unknown>) => void
}) {
  const fields =
    schema.type === 'object' ? Object.entries(schema.properties ?? {}) : []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map(([name, field]) => [
        name,
        field.type === 'boolean'
          ? 'true'
          : field.type === 'number' || field.type === 'integer'
            ? '0'
            : '',
      ]),
    ),
  )
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [nulls, setNulls] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  return (
    <form
      className="simple-form form-stack"
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        try {
          const body = Object.fromEntries(
            fields
              .filter(
                ([name]) =>
                  schema.type === 'object' &&
                  (schema.required?.includes(name) || included[name]),
              )
              .map(([name, field]) => {
                if (field.nullable && nulls[name]) return [name, null]
                const text = values[name] ?? ''
                if (field.type === 'boolean') return [name, text === 'true']
                if (field.type === 'number' || field.type === 'integer') {
                  const number = Number(text)
                  if (
                    !text.trim() ||
                    !Number.isFinite(number) ||
                    (field.type === 'integer' && !Number.isInteger(number))
                  )
                    throw new Error(
                      `Enter a ${field.type === 'integer' ? 'whole number' : 'number'} for ${name}.`,
                    )
                  return [name, number]
                }
                return [name, text]
              }),
          )
          setError('')
          onSend(body)
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : 'Check message fields.',
          )
        }
      }}
    >
      <h3>Message fields</h3>
      {!fields.length ? (
        <p>This message has no fields. Send an empty typed object.</p>
      ) : null}
      {fields.map(([name, field]) => {
        const required =
          schema.type === 'object' && !!schema.required?.includes(name)
        const omitted = !required && !included[name]
        return (
          <fieldset className="rule-field form-stack" key={name}>
            <legend className="[overflow-wrap:anywhere]">
              {name} · {required ? 'Required' : 'Optional'}
            </legend>
            {!required ? (
              <label className="rule-check">
                <Checkbox
                  checked={!!included[name]}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    setIncluded((previous) => ({
                      ...previous,
                      [name]: checked === true,
                    }))
                  }
                />
                Include optional field {name}
              </label>
            ) : null}
            <label className="[overflow-wrap:anywhere]">
              {name}
              {field.type === 'boolean' ? (
                <Select
                  label={`Message field: ${name}`}
                  value={values[name] ?? 'true'}
                  disabled={disabled || omitted || !!nulls[name]}
                  options={[
                    { value: 'true', label: 'True' },
                    { value: 'false', label: 'False' },
                  ]}
                  onValueChange={(value) =>
                    setValues((previous) => ({ ...previous, [name]: value }))
                  }
                />
              ) : (
                <Input
                  aria-label={`Message field: ${name}`}
                  value={values[name] ?? ''}
                  disabled={disabled || omitted || !!nulls[name]}
                  inputMode={
                    field.type === 'number' || field.type === 'integer'
                      ? 'decimal'
                      : undefined
                  }
                  onChange={(event) =>
                    setValues((previous) => ({
                      ...previous,
                      [name]: event.target.value,
                    }))
                  }
                />
              )}
            </label>
            {field.nullable ? (
              <label className="rule-check">
                <Checkbox
                  checked={!!nulls[name]}
                  disabled={disabled || omitted}
                  onCheckedChange={(checked) =>
                    setNulls((previous) => ({
                      ...previous,
                      [name]: checked === true,
                    }))
                  }
                />
                Send null for {name}
              </label>
            ) : null}
          </fieldset>
        )
      })}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={disabled}>
        Send message
      </Button>
    </form>
  )
}

export function WebSocketTest() {
  const state = useStudio()
  const permitted =
    can(state.member, 'flows.read') && can(state.member, 'flows.test')
  const enabled = permitted && !!state.id && !state.dirty && !!state.websocket
  const tenantReview = useTenantReview(
    state.id,
    'draft',
    enabled,
    state.revision,
  )
  const [status, setStatus] = useState('Disconnected')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [replies, setReplies] = useState<Reply[]>([])
  const [refreshRequired, setRefreshRequired] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const socketScope = useRef('')
  const active = useRef(false)
  const pendingId = useRef('')
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scope = JSON.stringify([
    state.editorSession,
    state.id,
    state.revision,
    enabled,
    state.member,
    state.sessionId,
    state.token,
    tenantReview.requestTenantId,
  ])
  const latestScope = useRef(scope)
  latestScope.current = scope

  function current() {
    const live = useStudio.getState()
    return (
      active.current &&
      latestScope.current === scope &&
      live.editorSession === state.editorSession &&
      live.id === state.id &&
      live.revision === state.revision &&
      !live.dirty &&
      live.sessionId === state.sessionId &&
      live.token === state.token &&
      live.member === state.member &&
      can(live.member, 'flows.read') &&
      can(live.member, 'flows.test')
    )
  }

  function clearWaiting() {
    if (replyTimer.current) clearTimeout(replyTimer.current)
    replyTimer.current = null
    pendingId.current = ''
    setWaiting(false)
  }

  function disconnect() {
    socket.current?.close(1000)
    socket.current = null
    socketScope.current = ''
    clearWaiting()
    setConnected(false)
    setReplies([])
    setStatus('Disconnected')
    setError('')
  }

  useEffect(() => {
    active.current = true
    setConnected(false)
    setWaiting(false)
    setReplies([])
    setStatus('Disconnected')
    setError('')
    setRefreshRequired(false)
    return () => {
      active.current = false
      if (replyTimer.current) clearTimeout(replyTimer.current)
      pendingId.current = ''
      socket.current?.close(1000)
      socket.current = null
      socketScope.current = ''
    }
  }, [scope])

  function connect() {
    if (
      !enabled ||
      !tenantReview.ready ||
      refreshRequired ||
      state.busy ||
      socket.current
    )
      return
    void state.task(async () => {
      if (!current()) return
      setError('')
      setStatus('Connecting…')
      try {
        const receipt = await api<TicketReceipt>(
          `/api/flows/${state.id}/ws/test-ticket`,
          state.token,
          'POST',
          {
            revision: state.revision,
            ...(tenantReview.requestTenantId
              ? { tenantId: tenantReview.requestTenantId }
              : {}),
          },
        )
        if (!current()) return
        if (
          receipt.revision !== state.revision ||
          receipt.protocol !== 'besh.ws.v1' ||
          receipt.path !== `/api/flows/${state.id}/ws/test` ||
          !/^[A-Za-z0-9_-]{43}$/.test(receipt.ticket) ||
          !Number.isFinite(Date.parse(receipt.expiresAt)) ||
          Date.parse(receipt.expiresAt) <= Date.now()
        )
          throw new Error(
            'Draft connection could not be reviewed. Reconnect to request a fresh ticket.',
          )
        const url = new URL(receipt.path, location.origin)
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        await new Promise<void>((resolve, reject) => {
          let connection: WebSocket
          try {
            connection = new WebSocket(url.href, [
              'besh.ws.v1',
              `besh.ticket.${receipt.ticket}`,
            ])
          } finally {
            // Connection callbacks keep no raw one-use ticket.
            receipt.ticket = ''
          }
          socket.current = connection
          socketScope.current = scope
          let opened = false
          const deadline = setTimeout(() => {
            connection.close()
            reject(
              new Error(
                'Connection timed out. Review the saved draft and reconnect.',
              ),
            )
          }, 10_000)
          connection.onopen = () => {
            clearTimeout(deadline)
            if (
              !current() ||
              socket.current !== connection ||
              connection.protocol !== 'besh.ws.v1'
            ) {
              connection.close()
              reject(
                new Error(
                  'Connection changed. Reconnect to request a fresh ticket.',
                ),
              )
              return
            }
            opened = true
            setConnected(true)
            setStatus('Connected')
            resolve()
          }
          connection.onerror = () => {
            clearTimeout(deadline)
            reject(
              new Error(
                'Could not open the draft connection. Review the saved draft, sign-in and tenant access, then reconnect.',
              ),
            )
          }
          connection.onclose = () => {
            clearTimeout(deadline)
            if (!opened)
              reject(
                new Error(
                  'Could not open the draft connection. Reconnect to request a fresh ticket.',
                ),
              )
            if (socket.current !== connection) return
            socket.current = null
            socketScope.current = ''
            if (!current()) return
            clearWaiting()
            setConnected(false)
            setReplies([])
            setStatus('Disconnected')
            if (opened)
              setError(
                'Connection ended. Review the saved draft and current access before reconnecting.',
              )
            else
              reject(
                new Error(
                  'Could not open the draft connection. Reconnect to request a fresh ticket.',
                ),
              )
          }
          connection.onmessage = (event) => {
            if (!current() || socket.current !== connection) return
            try {
              if (
                typeof event.data !== 'string' ||
                new TextEncoder().encode(event.data).byteLength > 65_536
              )
                throw new Error()
              const reply = JSON.parse(event.data) as Reply
              if (
                !reply ||
                typeof reply !== 'object' ||
                Array.isArray(reply) ||
                reply.id !== pendingId.current ||
                Object.keys(reply).length !== 2 ||
                !(
                  Object.hasOwn(reply, 'result') ||
                  (Object.hasOwn(reply, 'error') &&
                    typeof reply.error === 'string')
                )
              )
                throw new Error()
              clearWaiting()
              setReplies((previous) => [reply, ...previous].slice(0, 5))
              setStatus(reply.error ? 'Message failed' : 'Reply received')
            } catch {
              disconnect()
              setError('Invalid reply. Reconnect to request a fresh ticket.')
            }
          }
        })
      } catch (reason) {
        if (!current()) return
        disconnect()
        if (reason instanceof ApiError && reason.status === 409)
          setRefreshRequired(true)
        setError(
          reason instanceof Error
            ? `${reason.message}${reason instanceof ApiError && reason.status === 409 ? ' Refresh the saved draft before reconnecting.' : ''}`
            : 'Could not connect. Reconnect to request a fresh ticket.',
        )
      }
    })
  }

  function refreshDraft() {
    if (!enabled || state.busy || !refreshRequired || socket.current) return
    void state.task(async () => {
      if (!current()) return
      try {
        const flow = await api<SavedFlow>(`/api/flows/${state.id}`, state.token)
        if (!current() || flow.id !== state.id) return
        state.load(flow)
        state.message('Current saved draft loaded. Review before connecting.')
      } catch (reason) {
        if (!current()) return
        setError(
          reason instanceof Error
            ? `${reason.message} Refresh the saved draft before reconnecting.`
            : 'Could not refresh the saved draft. Try explicit refresh again.',
        )
      }
    })
  }

  function send(body: Record<string, unknown>) {
    const connection = socket.current
    if (
      !current() ||
      state.busy ||
      waiting ||
      !!pendingId.current ||
      !connected ||
      socketScope.current !== scope ||
      connection?.readyState !== WebSocket.OPEN
    )
      return
    const id = crypto.randomUUID()
    const text = JSON.stringify({ id, body })
    if (new TextEncoder().encode(text).byteLength > 32_768) {
      setError('Message is too large. Keep the complete message within 32 KiB.')
      return
    }
    if (connection.bufferedAmount > 131_072) {
      disconnect()
      setError(
        'Connection cannot keep up. Reconnect before sending another message.',
      )
      return
    }
    setError('')
    pendingId.current = id
    setWaiting(true)
    setStatus('Waiting for reply…')
    replyTimer.current = setTimeout(() => {
      if (!current()) return
      disconnect()
      setError('Reply timed out. Reconnect before sending another message.')
    }, 10_000)
    try {
      connection.send(text)
    } catch {
      disconnect()
      setError('Message could not be sent. Reconnect before trying again.')
    }
  }

  if (!state.websocket) return null
  const connectedNow = connected && socketScope.current === scope
  const currentReplies = socketScope.current === scope ? replies : []
  return (
    <section
      className="load-test-card form-stack"
      aria-label="WebSocket draft test"
    >
      <h2>Try WebSocket messages</h2>
      <p>
        Tests use only saved draft revision {state.revision}. Workspace sign-in
        supplies a one-use connection ticket in memory; no runtime key is
        entered. Published browser origins are separate from this workspace
        draft test.
      </p>
      {!permitted ? (
        <p>
          Read APIs and Test APIs access are required to connect this saved
          draft.
        </p>
      ) : state.dirty || !state.id ? (
        <p>
          Save your draft before connecting. Editing or leaving this API closes
          its draft connection.
        </p>
      ) : null}
      {enabled ? (
        <TenantReview
          review={tenantReview}
          disabled={state.busy || connectedNow}
        />
      ) : null}
      <p aria-live="polite">{status}</p>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="title-actions">
        <Button
          variant="outline"
          disabled={
            !enabled ||
            !tenantReview.ready ||
            refreshRequired ||
            state.busy ||
            connectedNow
          }
          onClick={connect}
        >
          Connect draft
        </Button>
        <Button variant="outline" disabled={!connectedNow} onClick={disconnect}>
          Disconnect draft
        </Button>
        {refreshRequired ? (
          <Button
            variant="outline"
            disabled={!enabled || state.busy || connectedNow}
            onClick={refreshDraft}
          >
            Refresh saved draft
          </Button>
        ) : null}
      </div>
      <MessageFields
        key={`${state.id}-${state.revision}-${JSON.stringify(state.websocket.input)}`}
        schema={state.websocket.input}
        disabled={!enabled || !connectedNow || waiting || state.busy}
        onSend={send}
      />
      <p>
        One request is in flight at a time. Keep at most five replies in memory;
        disconnecting clears them. Submitted values and replies are not saved to
        the API definition.
      </p>
      {currentReplies.length ? (
        <>
          <ReplyFields
            reply={currentReplies[0]}
            schema={state.websocket.output}
          />
          <details>
            <summary>Advanced reply JSON</summary>
            <pre className="code-output" aria-label="Latest WebSocket reply">
              {JSON.stringify(currentReplies[0], null, 2)}
            </pre>
          </details>
        </>
      ) : null}
      {currentReplies.length > 1 ? (
        <details>
          <summary>Earlier replies ({currentReplies.length - 1})</summary>
          {currentReplies.slice(1).map((reply) => (
            <pre className="code-output" key={reply.id}>
              {JSON.stringify(reply, null, 2)}
            </pre>
          ))}
        </details>
      ) : null}
    </section>
  )
}
