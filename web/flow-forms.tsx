import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { api, type DataSource, type AuthConnection } from './lib/api'
import type { DataReadConfig } from '../src/flows/model'
import type {
  DependencyAuth,
  DependencySource,
} from '../src/workspace/dependency-model'
import { useStudio } from './store'
import { canReadDependencyStructure } from './dependency-access'

type ValueType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'null'
  | 'body'
  | 'query'
  | 'params'
  | 'nested'
type FieldRow = {
  id: string
  name: string
  type: ValueType
  value: string
  original?: unknown
}

function fieldRows(value: unknown, references = true): FieldRow[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  return Object.entries(value).map(([name, original]) => {
    const reference =
      references && typeof original === 'string'
        ? original.match(/^\$input\.(body|query|params)\.(.+)$/)
        : null
    const type: ValueType = reference
      ? (reference[1] as 'body' | 'query' | 'params')
      : original === null
        ? 'null'
        : typeof original === 'number'
          ? 'number'
          : typeof original === 'boolean'
            ? 'boolean'
            : typeof original === 'string'
              ? 'text'
              : 'nested'

    return {
      id: crypto.randomUUID(),
      name,
      type,
      original,
      value: reference
        ? reference[2]
        : type === 'nested'
          ? ''
          : original === null
            ? ''
            : String(original),
    }
  })
}

function rowValue(row: FieldRow): unknown {
  if (row.type === 'nested') return row.original
  if (row.type === 'null') return null
  if (row.type === 'boolean') return row.value === 'true'
  if (row.type === 'number') {
    if (!row.value.trim() || !Number.isFinite(Number(row.value)))
      throw new Error(`Enter a valid number for ${row.name || 'this field'}.`)
    return Number(row.value)
  }
  if (row.type === 'body' || row.type === 'query' || row.type === 'params') {
    if (!/^[a-zA-Z0-9_.-]+$/.test(row.value))
      throw new Error(`Choose an input field for ${row.name || 'this value'}.`)
    return `$input.${row.type}.${row.value}`
  }
  return row.value
}

function rowsObject(rows: FieldRow[]) {
  const result: Record<string, unknown> = Object.create(null)

  for (const row of rows) {
    const name = row.name.trim()
    if (!name) throw new Error('Give each field a name.')
    if (Object.hasOwn(result, name))
      throw new Error(`Field ${name} appears more than once.`)
    result[name] = rowValue(row)
  }

  return result
}

function FieldRows({
  rows,
  onChange,
  disabled,
  prefix = 'Field',
  addLabel = 'Add response field',
  references = true,
  textOnly = false,
}: {
  rows: FieldRow[]
  onChange: (rows: FieldRow[]) => void
  disabled: boolean
  prefix?: string
  addLabel?: string
  references?: boolean
  textOnly?: boolean
}) {
  function update(id: string, patch: Partial<FieldRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  return (
    <div className="field-rows">
      {rows.map((row, index) => (
        <div className="field-row" key={row.id}>
          <label>
            {prefix} name {index + 1}
            <Input
              aria-label={`${prefix} name ${index + 1}`}
              value={row.name}
              disabled={disabled}
              onChange={(event) => update(row.id, { name: event.target.value })}
            />
          </label>
          {!textOnly ? (
            <label>
              {prefix} type {index + 1}
              <Select
                label={`${prefix} type ${index + 1}`}
                value={row.type}
                disabled={disabled || row.type === 'nested'}
                onValueChange={(type) =>
                  update(row.id, {
                    type: type as ValueType,
                    value:
                      type === 'boolean'
                        ? 'true'
                        : type === 'number'
                          ? '0'
                          : '',
                  })
                }
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'number', label: 'Number' },
                  { value: 'boolean', label: 'True or false' },
                  { value: 'null', label: 'Empty value' },
                  ...(references
                    ? [
                        { value: 'body', label: 'From request body' },
                        { value: 'query', label: 'From query parameter' },
                        { value: 'params', label: 'From path parameter' },
                      ]
                    : []),
                  ...(row.type === 'nested'
                    ? [{ value: 'nested', label: 'Nested data (preserved)' }]
                    : []),
                ]}
              />
            </label>
          ) : null}
          {row.type === 'boolean' ? (
            <label>
              {prefix} value {index + 1}
              <Select
                label={`${prefix} value ${index + 1}`}
                value={row.value}
                disabled={disabled}
                onValueChange={(value) => update(row.id, { value })}
                options={[
                  { value: 'true', label: 'True' },
                  { value: 'false', label: 'False' },
                ]}
              />
            </label>
          ) : row.type === 'nested' ? (
            <p>
              Nested data stays unchanged. Use Advanced configuration to edit
              it.
            </p>
          ) : row.type !== 'null' ? (
            <label>
              {row.type === 'body' ||
              row.type === 'query' ||
              row.type === 'params'
                ? 'Input field'
                : `${prefix} value`}{' '}
              {index + 1}
              <Input
                aria-label={`${prefix} value ${index + 1}`}
                value={row.value}
                disabled={disabled}
                onChange={(event) =>
                  update(row.id, { value: event.target.value })
                }
                placeholder={
                  row.type === 'body' ||
                  row.type === 'query' ||
                  row.type === 'params'
                    ? 'name'
                    : undefined
                }
              />
            </label>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            aria-label={`Remove field ${index + 1}`}
            disabled={disabled}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...rows,
            { id: crypto.randomUUID(), name: '', type: 'text', value: '' },
          ])
        }
      >
        <Plus />
        {addLabel}
      </Button>
    </div>
  )
}

export function ResponseForm({
  config,
  disabled,
  onApply,
  onError,
}: {
  config: { status: number; body: unknown }
  disabled: boolean
  onApply: (config: { status: number; body: unknown }) => void
  onError: (message: string) => void
}) {
  const [status, setStatus] = useState(String(config.status))
  const [rows, setRows] = useState(() => fieldRows(config.body))
  const [contents, setContents] = useState(
    config.body === '$data'
      ? 'data'
      : config.body === '$auth'
        ? 'auth'
        : rows
          ? 'fields'
          : 'structured',
  )
  const statuses = [200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 500, 503]
  if (!statuses.includes(config.status)) statuses.push(config.status)

  return (
    <div className="simple-form">
      <label>
        Response status
        <Select
          label="Response status"
          value={status}
          onValueChange={setStatus}
          disabled={disabled}
          options={statuses
            .sort((a, b) => a - b)
            .map((code) => ({
              value: String(code),
              label: `${code}${code === 200 ? ' · OK' : code === 201 ? ' · Created' : code === 204 ? ' · No content' : ''}`,
            }))}
        />
      </label>
      <label>
        Response contents
        <Select
          label="Response contents"
          value={contents}
          disabled={disabled}
          options={[
            { value: 'fields', label: 'Response fields' },
            { value: 'data', label: 'Rows from data step' },
            { value: 'auth', label: 'GitHub login result' },
            ...(contents === 'structured'
              ? [{ value: 'structured', label: 'Structured value (preserved)' }]
              : []),
          ]}
          onValueChange={(value) => {
            setContents(value)
            if (value === 'fields' && !rows) setRows([])
          }}
        />
      </label>
      {contents === 'data' ? (
        <p>Return rows selected by the spreadsheet or SQLite data step.</p>
      ) : contents === 'auth' ? (
        <p>
          Return the GitHub login result: authorization URL for BEGIN, or
          verified identity for COMPLETE. The proof belongs on your product
          server.
        </p>
      ) : contents === 'fields' && rows ? (
        <FieldRows rows={rows} onChange={setRows} disabled={disabled} />
      ) : (
        <p>
          This response uses structured data or a direct reference. Its value is
          preserved; use Advanced configuration to edit it.
        </p>
      )}
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          try {
            onApply({
              status: Number(status),
              body:
                contents === 'data'
                  ? '$data'
                  : contents === 'auth'
                    ? '$auth'
                    : contents === 'fields' && rows
                      ? rowsObject(rows)
                      : config.body,
            })
          } catch (error) {
            onError(
              error instanceof Error ? error.message : 'Check response fields.',
            )
          }
        }}
      >
        Apply configuration
      </Button>
    </div>
  )
}

export function SocialNodeForm({
  config,
  token,
  disabled,
  onApply,
  onError,
}: {
  config: { connectionId: string }
  token: string
  disabled: boolean
  onApply: (config: { connectionId: string }) => void
  onError: (message: string) => void
}) {
  const state = useStudio()
  const selectedAccess = state.member?.access.mode === 'selected'
  const [connections, setConnections] = useState<
    (AuthConnection | DependencyAuth)[]
  >([])
  const [selected, setSelected] = useState(config.connectionId)

  useEffect(() => {
    if (!canReadDependencyStructure(state.member, 'auth-connections.read'))
      return
    let active = true
    const sessionId = state.sessionId
    const memberId = state.member?.id
    function current() {
      const live = useStudio.getState()
      return (
        active &&
        live.sessionId === sessionId &&
        live.member?.id === memberId &&
        live.token === token &&
        canReadDependencyStructure(live.member, 'auth-connections.read')
      )
    }
    api<(AuthConnection | DependencyAuth)[]>(
      selectedAccess
        ? '/api/dependencies/auth-connections'
        : '/api/auth-connections',
      token,
    )
      .then((value) => {
        if (current()) setConnections(value)
      })
      .catch((error: Error) => {
        if (current()) onError(error.message)
      })
    return () => {
      active = false
    }
  }, [token, state.sessionId, state.member?.id, selectedAccess])

  return (
    <div className="simple-form">
      <label>
        GitHub connection
        <Select
          label="GitHub connection"
          value={selected}
          onValueChange={setSelected}
          options={connections.map((connection) => ({
            value: connection.id,
            label: connection.name,
          }))}
          disabled={disabled || !connections.length}
          placeholder="Choose a connection"
        />
      </label>
      <p className="field-help">
        {selectedAccess
          ? 'Structure only. Explicit USE permits this API to trigger the chosen product login. Credentials stay on the server; ask the owner for additional connections.'
          : 'Credentials stay on the server. Configure provider apps in Product login.'}
      </p>
      <Button
        variant="outline"
        disabled={
          disabled ||
          !connections.some((connection) => connection.id === selected)
        }
        onClick={() => onApply({ connectionId: selected })}
      >
        Apply configuration
      </Button>
    </div>
  )
}

export function ConditionForm({
  config,
  disabled,
  onApply,
  onError,
}: {
  config: { field: string; equals: string | number | boolean | null }
  disabled: boolean
  onApply: (config: { field: string; equals: unknown }) => void
  onError: (message: string) => void
}) {
  const [source, setSource] = useState(
    config.field.startsWith('params.')
      ? 'params'
      : config.field.startsWith('query.')
        ? 'query'
        : 'body',
  )
  const [field, setField] = useState(
    config.field.replace(/^(body|query|params)\./, ''),
  )
  const [type, setType] = useState<ValueType>(
    config.equals === null
      ? 'null'
      : typeof config.equals === 'boolean'
        ? 'boolean'
        : typeof config.equals === 'number'
          ? 'number'
          : 'text',
  )
  const [value, setValue] = useState(
    config.equals === null ? '' : String(config.equals),
  )

  return (
    <div className="simple-form">
      <label>
        Input source
        <Select
          label="Input source"
          value={source}
          disabled={disabled}
          onValueChange={setSource}
          options={[
            { value: 'body', label: 'Request body' },
            { value: 'query', label: 'Query parameter' },
            { value: 'params', label: 'Path parameter' },
          ]}
        />
      </label>
      <label>
        Input field
        <Input
          aria-label="Input field"
          value={field}
          disabled={disabled}
          onChange={(event) => setField(event.target.value)}
          placeholder="active"
        />
      </label>
      <label>
        Comparison
        <Select
          label="Comparison"
          value="equals"
          disabled={disabled}
          onValueChange={() => {}}
          options={[{ value: 'equals', label: 'Equals' }]}
        />
      </label>
      <label>
        Expected type
        <Select
          label="Expected type"
          value={type}
          disabled={disabled}
          onValueChange={(next) => {
            setType(next as ValueType)
            setValue(next === 'boolean' ? 'true' : next === 'number' ? '0' : '')
          }}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'True or false' },
            { value: 'null', label: 'Empty value' },
          ]}
        />
      </label>
      {type === 'boolean' ? (
        <label>
          Expected value
          <Select
            label="Expected value"
            value={value}
            disabled={disabled}
            onValueChange={setValue}
            options={[
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' },
            ]}
          />
        </label>
      ) : type !== 'null' ? (
        <label>
          Expected value
          <Input
            aria-label="Expected value"
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      ) : null}
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          try {
            const path = `${source}.${field.trim()}`
            if (!field.trim() || path.length > 160)
              throw new Error(
                'Choose an input field of at most 155 characters.',
              )
            onApply({
              field: path,
              equals: rowValue({ id: '', name: 'expected value', type, value }),
            })
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : 'Check condition fields.',
            )
          }
        }}
      >
        Apply configuration
      </Button>
    </div>
  )
}

export function DataNodeForm({
  config,
  token,
  disabled,
  onApply,
  onError,
}: {
  config: DataReadConfig
  token: string
  disabled: boolean
  onApply: (config: DataReadConfig) => void
  onError: (message: string) => void
}) {
  const state = useStudio()
  const selectedAccess = state.member?.access.mode === 'selected'
  const [sources, setSources] = useState<(DataSource | DependencySource)[]>([])
  const [error, setError] = useState('')
  const [sourceId, setSourceId] = useState(config.sourceId)
  const [columns, setColumns] = useState(config.columns)
  const [limit, setLimit] = useState(String(config.limit))
  const [filtered, setFiltered] = useState(!!config.filter)
  const [column, setColumn] = useState(
    config.filter?.column ?? config.columns[0] ?? '',
  )
  const initialFilter = fieldRows({ value: config.filter?.value ?? '' })![0]!
  const [filterType, setFilterType] = useState(initialFilter.type)
  const [filterValue, setFilterValue] = useState(initialFilter.value)

  useEffect(() => {
    if (!canReadDependencyStructure(state.member, 'sources.read')) return
    let active = true
    const sessionId = state.sessionId
    const memberId = state.member?.id
    function current() {
      const live = useStudio.getState()
      return (
        active &&
        live.sessionId === sessionId &&
        live.member?.id === memberId &&
        live.token === token &&
        canReadDependencyStructure(live.member, 'sources.read')
      )
    }
    setError('')
    void api<(DataSource | DependencySource)[]>(
      selectedAccess ? '/api/dependencies/sources' : '/api/data-sources',
      token,
    )
      .then((result) => {
        if (current()) setSources(result)
      })
      .catch((reason: unknown) => {
        if (current())
          setError(
            reason instanceof Error
              ? reason.message
              : 'Cannot load data sources.',
          )
      })
    return () => {
      active = false
    }
  }, [token, state.sessionId, state.member?.id, selectedAccess])

  const source = sources.find((item) => item.id === sourceId)
  const limits = [...new Set([1, 10, 25, 50, 100, Number(limit)])].sort(
    (left, right) => left - right,
  )

  return (
    <div className="simple-form">
      {error ? <p role="alert">{error}</p> : null}
      <label>
        Data source
        <Select
          label="Data source"
          value={sourceId}
          disabled={disabled || !sources.length}
          options={sources.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onValueChange={(value) => {
            setSourceId(value)
            const next = sources.find((item) => item.id === value)
            setColumns(next?.columns.map((item) => item.key) ?? [])
            setColumn(next?.columns[0]?.key ?? '')
            setFiltered(false)
          }}
        />
      </label>
      <p>
        {source
          ? 'rowCount' in source
            ? `${source.rowCount} saved rows. Published APIs read the latest saved snapshot.`
            : 'Structure only. Explicit USE allows this API to read the latest saved snapshot; it does not grant source previews.'
          : selectedAccess
            ? 'No allowed source selected. Ask the owner to review source USE for your selected APIs.'
            : 'Loading saved source details…'}
      </p>
      {source?.columns.map((item) => (
        <label key={item.key} className="permission-option">
          <Checkbox
            aria-label={`Include ${item.label}`}
            checked={columns.includes(item.key)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              setColumns(
                checked
                  ? [...columns, item.key]
                  : columns.filter((key) => key !== item.key),
              )
            }
          />
          <span>
            {item.label}
            <small>
              API field: {item.key} ·{' '}
              {item.type === 'string'
                ? 'Text'
                : item.type === 'number'
                  ? 'Number'
                  : 'True or false'}
            </small>
          </span>
        </label>
      ))}
      <label>
        Maximum rows
        <Select
          label="Maximum rows"
          value={limit}
          disabled={disabled}
          onValueChange={setLimit}
          options={limits.map((value) => ({
            value: String(value),
            label: String(value),
          }))}
        />
      </label>
      <label className="permission-option">
        <Checkbox
          aria-label="Filter rows"
          checked={filtered}
          disabled={disabled}
          onCheckedChange={(checked) => setFiltered(checked === true)}
        />
        Match one column
      </label>
      {filtered ? (
        <>
          <label>
            Match column
            <Select
              label="Match column"
              value={column}
              disabled={disabled}
              onValueChange={setColumn}
              options={(source?.columns ?? []).map((item) => ({
                value: item.key,
                label: item.label,
              }))}
            />
          </label>
          <label>
            Match value type
            <Select
              label="Match value type"
              value={filterType}
              disabled={disabled}
              onValueChange={(value) => {
                setFilterType(value as ValueType)
                setFilterValue(
                  value === 'boolean' ? 'true' : value === 'number' ? '0' : '',
                )
              }}
              options={[
                { value: 'text', label: 'Fixed text' },
                { value: 'number', label: 'Fixed number' },
                { value: 'boolean', label: 'True or false' },
                { value: 'null', label: 'Empty value' },
                { value: 'query', label: 'From query parameter' },
                { value: 'params', label: 'From path parameter' },
                { value: 'body', label: 'From request body' },
              ]}
            />
          </label>
          {filterType === 'boolean' ? (
            <label>
              Match value
              <Select
                label="Match value"
                value={filterValue}
                disabled={disabled}
                onValueChange={setFilterValue}
                options={[
                  { value: 'true', label: 'True' },
                  { value: 'false', label: 'False' },
                ]}
              />
            </label>
          ) : filterType !== 'null' ? (
            <label>
              {filterType === 'query' ||
              filterType === 'body' ||
              filterType === 'params'
                ? 'Input field name'
                : 'Match value'}
              <Input
                aria-label="Match value"
                value={filterValue}
                disabled={disabled}
                onChange={(event) => setFilterValue(event.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : null}
      <Button
        variant="outline"
        disabled={disabled || !source}
        onClick={() => {
          try {
            if (!columns.length)
              throw new Error('Choose at least one column to return.')
            if (
              columns.some(
                (key) => !source?.columns.some((item) => item.key === key),
              )
            )
              throw new Error(
                'Some selected columns are no longer in this source. Review the columns before applying.',
              )
            onApply({
              sourceId,
              columns,
              limit: Number(limit),
              ...(filtered
                ? {
                    filter: {
                      column,
                      value: rowValue({
                        id: '',
                        name: 'match value',
                        type: filterType,
                        value: filterValue,
                      }) as NonNullable<DataReadConfig['filter']>['value'],
                    },
                  }
                : {}),
            })
          } catch (reason) {
            onError(
              reason instanceof Error
                ? reason.message
                : 'Review data settings.',
            )
          }
        }}
      >
        Apply configuration
      </Button>
    </div>
  )
}

export function routeParameters(path: string) {
  return path
    .split('/')
    .filter((segment) => /^:[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(segment))
    .map((segment) => segment.slice(1))
}

export function RequestForm({
  input,
  path = '',
  disabled,
  onChange,
  includeBody = true,
}: {
  input: string
  path?: string
  disabled: boolean
  onChange: (input: string, error: string) => void
  includeBody?: boolean
}) {
  const [initial] = useState(() => parseRequestInput(input))
  const [body, setBody] = useState(() => fieldRows(initial.body, false))
  const [query, setQuery] = useState(
    () => fieldRows(initial.query, false) ?? [],
  )

  const names = routeParameters(path)
  const [params, setParams] = useState<Record<string, string>>(
    initial.params ?? {},
  )

  function update(
    nextBody: FieldRow[] | null,
    nextQuery: FieldRow[],
    nextParams = params,
  ) {
    setParams(nextParams)
    setBody(nextBody)
    setQuery(nextQuery)
    try {
      onChange(
        JSON.stringify({
          body: nextBody ? rowsObject(nextBody) : initial.body,
          query: rowsObject(nextQuery),
          ...(names.length
            ? {
                params: Object.fromEntries(
                  names.map((name) => [name, nextParams[name] ?? '']),
                ),
              }
            : {}),
        }),
        '',
      )
    } catch (error) {
      onChange(
        input,
        error instanceof Error ? error.message : 'Check request fields.',
      )
    }
  }

  return (
    <div className="simple-form">
      {names.length ? (
        <fieldset className="path-inputs">
          <legend>Path parameters</legend>
          <p>Replace each named part of the route with a concrete value.</p>
          {names.map((name) => (
            <label key={name}>
              Path parameter {name}
              <Input
                aria-label={`Path parameter ${name}`}
                value={params[name] ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  update(body, query, { ...params, [name]: event.target.value })
                }
                placeholder={`Value for :${name}`}
              />
            </label>
          ))}
        </fieldset>
      ) : null}
      <h3>Query parameters</h3>
      <p>
        Values sent in the endpoint address, such as a name or product code.
      </p>
      <FieldRows
        prefix="Query"
        addLabel="Add query parameter"
        rows={query}
        onChange={(rows) => update(body, rows)}
        disabled={disabled}
        references={false}
        textOnly
      />
      {includeBody ? <h3>Request body fields</h3> : null}
      {includeBody && body ? (
        <FieldRows
          prefix="Body"
          addLabel="Add body field"
          rows={body}
          onChange={(rows) => update(rows, query)}
          disabled={disabled}
          references={false}
        />
      ) : includeBody ? (
        <p>
          Structured request data is preserved. Use Advanced test input to edit
          it.
        </p>
      ) : null}
    </div>
  )
}

export function ValueFields({
  value,
  disabled,
  onChange,
}: {
  value: Record<string, unknown>
  disabled: boolean
  onChange: (value: Record<string, unknown>, error: string) => void
}) {
  const [rows, setRows] = useState(() => fieldRows(value, false) ?? [])
  return (
    <FieldRows
      rows={rows}
      prefix="Variable"
      addLabel="Add variable"
      references={false}
      disabled={disabled}
      onChange={(next) => {
        setRows(next)
        try {
          onChange(rowsObject(next), '')
        } catch (reason) {
          onChange(
            value,
            reason instanceof Error ? reason.message : 'Review variables.',
          )
        }
      }}
    />
  )
}

const requestInputSchema = z.object({
  body: z.json(),
  query: z.record(z.string(), z.string()),
  params: z.record(z.string(), z.string()).optional(),
})

export function parseRequestInput(value: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(
      'Use a request with body and query fields. Query and path parameter values must be text.',
    )
  }
  const result = requestInputSchema.safeParse(parsed)
  if (!result.success)
    throw new Error(
      'Use a request with body and query fields. Query and path parameter values must be text.',
    )
  return result.data
}
