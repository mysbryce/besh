import { useEffect, useRef, useState } from 'react'
import { Database, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Badge } from './components/ui/badge'
import { api, authenticatedFetch, type SavedFlow } from './lib/api'
import { useStudio } from './store'
import { can, type Permission } from '../src/workspace/permissions'
import type {
  DatabaseConnection,
  DatabasePreview,
  DatabaseCheck,
} from '../src/databases/model'
import {
  DatabaseReadFields,
  databaseFilter,
  databaseSelection,
  type DatabaseSelection,
} from './database-fields'

function DatabaseApiForm({
  connection,
  selection,
  disabled,
  onCreate,
}: {
  connection: DatabaseConnection
  selection: DatabaseSelection
  disabled: boolean
  onCreate: (options: {
    name: string
    path: string
    protocol: 'rest' | 'graphql'
    inputName: string
  }) => void
}) {
  const [name, setName] = useState(
    `${connection.name} ${selection.table} API`.slice(0, 80),
  )
  const [path, setPath] = useState(
    `/v1/${
      selection.table
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sqlite-rows'
    }`,
  )
  const [protocol, setProtocol] = useState<'rest' | 'graphql'>('rest')
  const [inputName, setInputName] = useState(selection.filterColumn || 'match')
  const validPath = /^\/[a-zA-Z0-9/_-]+$/.test(path)
  const validInput =
    /^[a-z][a-zA-Z0-9_]{0,63}$/.test(inputName) &&
    !['constructor', 'prototype', '__proto__'].includes(inputName)
  return (
    <section className="database-api-form">
      <h3>Create an API draft</h3>
      <p className="field-help">
        Use the table, selected columns, and row limit above. Review the
        generated draft before publishing.
      </p>
      <form
        className="simple-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (
            !disabled &&
            name.trim() &&
            validPath &&
            (!selection.filtered || validInput)
          )
            onCreate({ name: name.trim(), path, protocol, inputName })
        }}
      >
        <label>
          API name
          <Input
            aria-label="API name"
            value={name}
            maxLength={80}
            disabled={disabled}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          API type
          <Select
            label="API type"
            value={protocol}
            disabled={disabled}
            onValueChange={(value) => setProtocol(value as 'rest' | 'graphql')}
            options={[
              { value: 'rest', label: 'REST' },
              { value: 'graphql', label: 'GraphQL' },
            ]}
          />
        </label>
        <label>
          Endpoint path
          <Input
            aria-label="Endpoint path"
            value={path}
            disabled={disabled}
            required
            maxLength={160}
            onChange={(event) => setPath(event.target.value)}
          />
        </label>
        {!validPath ? (
          <p className="field-help">
            Start with /. Use letters, digits, /, underscores, or dashes.
          </p>
        ) : null}
        {selection.filtered ? (
          <label>
            Filter input name
            <Input
              aria-label="Filter input name"
              value={inputName}
              disabled={disabled}
              maxLength={64}
              onChange={(event) => setInputName(event.target.value)}
            />
            <span className="field-help">
              Callers supply this{' '}
              {protocol === 'rest' ? 'query parameter' : 'GraphQL argument'} to
              match {selection.filterColumn}. The preview's fixed equality value
              is not saved in the generated API.
            </span>
          </label>
        ) : null}
        {selection.filtered && !validInput ? (
          <p className="field-help">
            Use a letter first, then letters, digits, or underscores.
          </p>
        ) : null}
        <Button
          disabled={
            disabled ||
            !name.trim() ||
            !validPath ||
            !selection.columns.length ||
            (selection.filtered && !validInput)
          }
        >
          Create API draft
        </Button>
      </form>
    </section>
  )
}

export function DatabaseConnections({ onOpenApi }: { onOpenApi: () => void }) {
  const state = useStudio()
  const readable = can(state.member, 'database-connections.read')
  const manageable = can(state.member, 'database-connections.manage')
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [detail, setDetail] = useState<DatabaseConnection | null>(null)
  const [selection, setSelection] =
    useState<DatabaseSelection>(databaseSelection())
  const [preview, setPreview] = useState<DatabasePreview | null>(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(readable)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const request = useRef(0)
  const noticedRefresh = useRef(0)

  function current(permission?: Permission) {
    const live = useStudio.getState()
    return (
      mounted.current &&
      live.sessionId === state.sessionId &&
      live.member?.id === state.member?.id &&
      (!permission || can(live.member, permission))
    )
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  function show(connection: DatabaseConnection) {
    setDetail(connection)
    setSelection(databaseSelection(connection.tables[0]))
    setPreview(null)
  }

  useEffect(() => {
    if (!readable) {
      setLoading(false)
      return
    }
    let active = true
    const id = ++request.current
    const explicitRefresh = refresh > noticedRefresh.current
    noticedRefresh.current = refresh
    setLoading(true)
    setError('')
    void api<DatabaseConnection[]>('/api/database-connections', state.token)
      .then(async (records) => {
        if (
          !active ||
          !current('database-connections.read') ||
          id !== request.current
        )
          return
        setConnections(records)
        const chosen =
          records.find((item) => item.id === detail?.id) ?? records[0]
        if (!chosen) {
          setDetail(null)
          setPreview(null)
          if (explicitRefresh) state.message('Database connections refreshed.')
          return
        }
        const value = await api<DatabaseConnection>(
          `/api/database-connections/${chosen.id}`,
          state.token,
        )
        if (
          active &&
          current('database-connections.read') &&
          id === request.current
        ) {
          show(value)
          if (explicitRefresh) state.message('Database connections refreshed.')
        }
      })
      .catch((reason: Error) => {
        if (active && current() && id === request.current)
          setError(reason.message)
      })
      .finally(() => {
        if (active && current() && id === request.current) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [readable, state.token, state.sessionId, state.member?.id, refresh])

  function perform(permission: Permission, work: () => Promise<void>) {
    if (!current(permission) || state.busy) return
    void state.task(async () => {
      setError('')
      try {
        await work()
      } catch (reason) {
        if (current())
          setError(reason instanceof Error ? reason.message : 'Request failed.')
        throw reason
      }
    })
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">READ A SAVED DATABASE COPY</div>
          <h1>Database connections</h1>
          <p>Choose a SQLite copy, review its tables, then build a read API.</p>
        </div>
        <Button
          variant="outline"
          disabled={state.busy || loading || !readable}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw />
          Refresh connections
        </Button>
      </div>
      <div className="product-login-guide">
        <Database />
        <div>
          <strong>SQLite uploaded copy · read-only</strong>
          <p>
            This is an uploaded read-only copy. Changes to your original
            database are not synced.
          </p>
          <p>
            Upload an ordinary SQLite file up to 2 MiB. No database address,
            server credentials, or SQL is needed.
          </p>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error} Refresh connections to load current metadata before retrying a
          stale action.
        </p>
      ) : null}
      {loading ? <p>Loading SQLite copies…</p> : null}
      <section className="source-preview source-import">
        <div className="panel-heading">
          <h2>Upload a SQLite copy</h2>
          <Upload size={20} />
        </div>
        {!manageable ? (
          <p className="field-help">
            Manage database connections access is needed to upload, check, or
            delete copies.
          </p>
        ) : null}
        <form
          className="source-import-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!file || !name.trim() || state.busy || !manageable) return
            if (file.size > 2 * 1024 * 1024) {
              setError('Choose a SQLite file no larger than 2 MiB.')
              return
            }
            perform('database-connections.manage', async () => {
              const body = new FormData()
              body.set('name', name.trim())
              body.set('file', file)
              const response = await authenticatedFetch(
                '/api/database-connections',
                state.token,
                { method: 'POST', body },
              )
              const value = await response.json()
              if (!response.ok)
                throw new Error(value.error ?? 'Could not upload SQLite copy.')
              if (!current('database-connections.manage')) return
              const connection = value as DatabaseConnection
              ++request.current
              setLoading(false)
              setConnections((items) => [connection, ...items])
              show(connection)
              setName('')
              setFile(null)
              if (fileInput.current) fileInput.current.value = ''
              state.message(
                'SQLite copy uploaded. Review its table and returned columns.',
              )
            })
          }}
        >
          <label>
            Connection name
            <Input
              aria-label="Connection name"
              value={name}
              maxLength={80}
              disabled={state.busy || !manageable}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            SQLite file
            <Input
              ref={fileInput}
              aria-label="SQLite file"
              type="file"
              accept=".sqlite,.sqlite3,.db"
              disabled={state.busy || !manageable}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button disabled={state.busy || !manageable || !file || !name.trim()}>
            <Upload />
            Upload read-only copy
          </Button>
        </form>
      </section>
      {!readable ? (
        <p className="field-help">
          Read database connections access is needed to list saved copies,
          preview rows, or choose API fields.
        </p>
      ) : null}
      {readable && !loading && !connections.length ? (
        <section className="source-preview">
          <h2>No SQLite copies yet</h2>
          <p>Upload a copy to review its ordinary tables and saved rows.</p>
        </section>
      ) : null}
      {detail ? (
        <section className="source-preview">
          <div className="panel-heading">
            <h2>Saved SQLite copies</h2>
            <Badge variant="outline">Read-only · v{detail.version}</Badge>
          </div>
          <div className="simple-form">
            {readable ? (
              <label>
                Database connection
                <Select
                  label="Database connection"
                  value={detail.id}
                  disabled={state.busy || loading}
                  options={connections.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onValueChange={(id) =>
                    perform('database-connections.read', async () => {
                      const seq = ++request.current
                      const value = await api<DatabaseConnection>(
                        `/api/database-connections/${id}`,
                        state.token,
                      )
                      if (
                        current('database-connections.read') &&
                        seq === request.current
                      )
                        show(value)
                    })
                  }
                />
              </label>
            ) : (
              <h3>{detail.name}</h3>
            )}
            <p className="field-help">
              {detail.tables.length} tables · {(detail.bytes / 1024).toFixed(1)}{' '}
              KiB saved copy. Published APIs read this copy.
            </p>
          </div>
          {readable ? (
            <>
              <DatabaseReadFields
                connection={detail}
                selection={selection}
                disabled={state.busy || loading}
                onChange={(value) => {
                  setSelection(value)
                  setPreview(null)
                }}
              />
              <Button
                variant="outline"
                disabled={state.busy || loading || !selection.columns.length}
                onClick={() =>
                  perform('database-connections.read', async () => {
                    const filter = databaseFilter(selection)
                    const value = await api<DatabasePreview>(
                      `/api/database-connections/${detail.id}/preview`,
                      state.token,
                      'POST',
                      {
                        version: detail.version,
                        table: selection.table,
                        columns: selection.columns,
                        ...(filter ? { filter } : {}),
                        limit: Number(selection.limit),
                      },
                    )
                    if (current('database-connections.read')) {
                      setPreview(value)
                      state.message('Database row preview ready.')
                    }
                  })
                }
              >
                Preview rows
              </Button>
              {preview ? (
                <section
                  aria-label="Database row preview"
                  className="database-row-preview"
                >
                  <h3>Database row preview</h3>
                  <p className="field-help">
                    {preview.rows.length} returned rows from {preview.table} ·
                    copy version {preview.version}
                  </p>
                  {preview.rows.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {preview.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, index) => (
                            <tr key={index}>
                              {preview.columns.map((column) => (
                                <td key={column}>
                                  {row[column] === null ? (
                                    <span className="empty-cell">Empty</span>
                                  ) : (
                                    String(row[column] ?? '')
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>
                      No matching rows. Try another equality value or table.
                    </p>
                  )}
                </section>
              ) : null}
              <DatabaseApiForm
                key={`${detail.id}:${detail.version}:${selection.table}`}
                connection={detail}
                selection={selection}
                disabled={
                  state.busy || loading || !can(state.member, 'flows.write')
                }
                onCreate={(options) => {
                  if (
                    useStudio.getState().dirty &&
                    !confirm(
                      'Discard unsaved draft changes and create this API?',
                    )
                  )
                    return
                  perform('database-connections.read', async () => {
                    if (!current('flows.write')) return
                    const flow = await api<SavedFlow>(
                      `/api/database-connections/${detail.id}/api`,
                      state.token,
                      'POST',
                      {
                        version: detail.version,
                        table: selection.table,
                        columns: selection.columns,
                        limit: Number(selection.limit),
                        name: options.name,
                        path: options.path,
                        protocol: options.protocol,
                        ...(selection.filtered
                          ? {
                              filter: {
                                column: selection.filterColumn,
                                inputName: options.inputName,
                              },
                            }
                          : {}),
                      },
                    )
                    if (
                      !current('database-connections.read') ||
                      !current('flows.write')
                    )
                      return
                    if (current('flows.read')) {
                      useStudio.getState().openCreated(flow)
                      state.message(
                        'Database API draft created. Test it, then publish when ready.',
                      )
                      onOpenApi()
                    } else
                      state.message(
                        'Database API draft created. Read APIs access is needed to open API Studio.',
                      )
                  })
                }}
              />
              {!can(state.member, 'flows.write') ? (
                <p className="field-help">
                  Edit APIs access is needed to generate a saved draft.
                </p>
              ) : null}
            </>
          ) : null}
          <div className="source-actions">
            <Button
              variant="outline"
              disabled={state.busy || loading || !manageable}
              onClick={() =>
                perform('database-connections.manage', async () => {
                  const result = await api<DatabaseCheck>(
                    `/api/database-connections/${detail.id}/check`,
                    state.token,
                    'POST',
                    { version: detail.version },
                  )
                  if (current('database-connections.manage'))
                    state.message(
                      `SQLite copy checked. ${result.tables.length} ordinary tables are readable; the saved copy is unchanged.`,
                    )
                })
              }
            >
              <RefreshCw />
              Check SQLite copy
            </Button>
            <Button
              variant="outline"
              disabled={state.busy || loading || !manageable}
              onClick={() => {
                if (
                  !confirm(
                    `Delete database connection ${detail.name}, version ${detail.version}? This permanently removes the uploaded copy. Drafts and all historical releases must stop referencing it first.`,
                  )
                )
                  return
                perform('database-connections.manage', async () => {
                  await api(
                    `/api/database-connections/${detail.id}`,
                    state.token,
                    'DELETE',
                    { version: detail.version },
                  )
                  if (!current('database-connections.manage')) return
                  ++request.current
                  const remaining = connections.filter(
                    (connection) => connection.id !== detail.id,
                  )
                  setConnections(remaining)
                  setDetail(null)
                  setPreview(null)
                  if (readable && remaining[0]) {
                    const next = await api<DatabaseConnection>(
                      `/api/database-connections/${remaining[0].id}`,
                      state.token,
                    )
                    if (current('database-connections.read')) show(next)
                  }
                  state.message('Database connection deleted.')
                })
              }}
            >
              <Trash2 />
              Delete database connection
            </Button>
            <p className="field-help">
              Copies referenced by any saved draft or historical release cannot
              be deleted. Checking does not refresh or replace the uploaded
              copy.
            </p>
          </div>
        </section>
      ) : null}
    </>
  )
}
