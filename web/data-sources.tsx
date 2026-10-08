import { useEffect, useRef, useState } from 'react'
import {
  Database,
  FileSpreadsheet,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import {
  api,
  authenticatedFetch,
  type DataSource,
  type DataSourceDetail,
  type SavedFlow,
} from './lib/api'
import { useStudio } from './store'
import { can } from '../src/permissions'

async function uploadSpreadsheet(
  path: string,
  token: string,
  name: string,
  file: File,
  method = 'POST',
): Promise<DataSourceDetail> {
  const body = new FormData()
  body.set('name', name)
  body.set('file', file)

  const response = await authenticatedFetch(path, token, {
    method,
    body,
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.error ?? `Import failed (${response.status})`)

  return result as DataSourceDetail
}

const columnTypes = {
  string: 'Text',
  number: 'Number',
  boolean: 'True or false',
}

type ApiOptions = {
  name: string
  path: string
  protocol: 'rest' | 'graphql'
  columns: string[]
  limit: number
  filter?: { column: string; inputName: string }
}

function ApiFromData({
  source,
  busy,
  onCreate,
}: {
  source: DataSource
  busy: boolean
  onCreate: (options: ApiOptions) => void
}) {
  const [name, setName] = useState(`${source.name} API`.slice(0, 80))
  const [path, setPath] = useState(
    `/${
      source.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100) || 'spreadsheet'
    }`,
  )
  const [protocol, setProtocol] = useState<'rest' | 'graphql'>('rest')
  const [columns, setColumns] = useState(
    source.columns.map((column) => column.key),
  )
  const [limit, setLimit] = useState('25')
  const [filtered, setFiltered] = useState(false)
  const [filterColumn, setFilterColumn] = useState(source.columns[0]?.key ?? '')
  const [filterInput, setFilterInput] = useState(
    source.columns[0]?.key ?? 'match',
  )
  const validPath = /^\/[a-zA-Z0-9/_-]+$/.test(path)
  const validFilter = /^[a-z][a-zA-Z0-9_]{0,63}$/.test(filterInput)
  const ready = Boolean(
    name.trim() &&
    validPath &&
    columns.length &&
    (!filtered || (filterColumn && validFilter)),
  )

  return (
    <section className="data-mapping">
      <div className="eyebrow">YOUR DATA, YOUR API</div>
      <h2>Create an API</h2>
      <p className="source-note">
        Choose the fields people can receive. We will create a draft you can
        test and publish in API Studio.
      </p>
      <form
        className="simple-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy || !ready) return

          onCreate({
            name: name.trim(),
            path,
            protocol,
            columns,
            limit: Number(limit),
            ...(filtered
              ? { filter: { column: filterColumn, inputName: filterInput } }
              : {}),
          })
        }}
      >
        <label htmlFor="data-api-name">
          API name
          <Input
            id="data-api-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            disabled={busy}
          />
        </label>
        <label htmlFor="data-api-type">
          API type
          <Select
            id="data-api-type"
            label="API type"
            value={protocol}
            onValueChange={(value) => setProtocol(value as 'rest' | 'graphql')}
            options={[
              { value: 'rest', label: 'REST' },
              { value: 'graphql', label: 'GraphQL' },
            ]}
            disabled={busy}
          />
        </label>
        <label htmlFor="data-api-path">
          Endpoint path
          <Input
            id="data-api-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            maxLength={160}
            required
            disabled={busy}
            aria-invalid={!validPath}
            aria-describedby="data-path-help"
          />
        </label>
        <p className="field-help" id="data-path-help">
          {validPath
            ? `${protocol === 'rest' ? 'GET /run' : 'POST /graphql'}${path} after publication. Use letters, numbers, slashes, hyphens, or underscores.`
            : 'Start with / and use letters, numbers, slashes, hyphens, or underscores.'}
        </p>
        <fieldset className="source-fieldset">
          <legend>Fields to return</legend>
          <p className="field-help">Original column → API field</p>
          <div className="source-column-choices">
            {source.columns.map((column) => (
              <label className="source-column-choice" key={column.key}>
                <Checkbox
                  aria-label={`Return ${column.label}`}
                  checked={columns.includes(column.key)}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    setColumns((current) =>
                      checked
                        ? [...current, column.key]
                        : current.filter((key) => key !== column.key),
                    )
                  }
                />
                <span>
                  <strong>{column.label}</strong>
                  <span className="source-field-mapping">
                    → <code>{column.key}</code> · {columnTypes[column.type]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {!columns.length ? (
            <p className="field-help">Choose at least one field to continue.</p>
          ) : null}
        </fieldset>
        <label htmlFor="data-api-limit">
          Rows per request
          <Select
            id="data-api-limit"
            label="Rows per request"
            value={limit}
            onValueChange={setLimit}
            options={['10', '25', '50', '100'].map((value) => ({
              value,
              label: `Up to ${value} rows`,
            }))}
            disabled={busy}
          />
        </label>
        <label className="permission-option">
          <Checkbox
            aria-label="Filter by input"
            checked={filtered}
            disabled={busy}
            onCheckedChange={(checked) => setFiltered(checked === true)}
          />
          <span>
            Filter by input
            <small>
              Match a supplied value, or return all rows when it is omitted.
            </small>
          </span>
        </label>
        {filtered ? (
          <div className="source-filter-fields">
            <label htmlFor="data-filter-column">
              Filter column
              <Select
                id="data-filter-column"
                label="Filter column"
                value={filterColumn}
                onValueChange={setFilterColumn}
                options={source.columns.map((column) => ({
                  value: column.key,
                  label: column.label,
                }))}
                disabled={busy}
              />
            </label>
            <label htmlFor="data-filter-input">
              Filter input name
              <Input
                id="data-filter-input"
                value={filterInput}
                onChange={(event) => setFilterInput(event.target.value)}
                maxLength={64}
                disabled={busy}
                aria-invalid={!validFilter}
                aria-describedby="data-filter-help"
              />
            </label>
            <p className="field-help" id="data-filter-help">
              {!validFilter
                ? 'Start with a lowercase letter. Use letters, numbers, or underscores.'
                : protocol === 'rest'
                  ? `Callers send ?${filterInput}=value in the URL. Omit it to return all rows. API keys control access to the API.`
                  : `Callers supply ${filterInput} as an optional GraphQL query argument. Its type is created from the selected column. Omit it to return all rows; API keys control access.`}
            </p>
          </div>
        ) : null}
        <Button disabled={busy || !ready}>
          <ArrowUpRight />
          Create API from data
        </Button>
      </form>
    </section>
  )
}

function SourceActions({
  source,
  busy,
  onReplace,
  onDelete,
  onRefresh,
}: {
  source: DataSource
  busy: boolean
  onReplace: (file: File) => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const [file, setFile] = useState<File | null>(null)

  return (
    <div className="source-actions">
      {source.kind === 'upload' ? (
        <form
          className="source-replace-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy && file) onReplace(file)
          }}
        >
          <label htmlFor="replacement-spreadsheet">
            Replacement spreadsheet
            <Input
              id="replacement-spreadsheet"
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button variant="outline" disabled={busy || !file}>
            <Upload />
            Replace spreadsheet
          </Button>
          <p className="field-help">
            Replaces saved rows used by your APIs. Keep published columns and
            their types compatible.
          </p>
        </form>
      ) : (
        <>
          {source.sourceUrl ? (
            <a
              className="source-sheet-link"
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Google Sheet <ArrowUpRight size={15} />
            </a>
          ) : null}
          <Button variant="outline" disabled={busy} onClick={onRefresh}>
            <RefreshCw />
            Refresh saved data
          </Button>
          <p className="field-help">
            This is a saved snapshot. Refresh imports changes from Google Sheets
            for APIs using this source.
          </p>
        </>
      )}
      <Button
        variant="outline"
        className="source-delete"
        disabled={busy}
        onClick={onDelete}
      >
        <Trash2 />
        Delete data source
      </Button>
      <p className="field-help">
        Data sources used by a draft or published API cannot be deleted.
      </p>
    </div>
  )
}

export function DataSources({ onOpenApi }: { onOpenApi: () => void }) {
  const token = useStudio((state) => state.token)
  const member = useStudio((state) => state.member)
  const busy = useStudio((state) => state.busy)
  const task = useStudio((state) => state.task)
  const message = useStudio((state) => state.message)
  const [sources, setSources] = useState<DataSource[]>([])
  const [detail, setDetail] = useState<DataSourceDetail | null>(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [importMethod, setImportMethod] = useState('file')
  const [sheetUrl, setSheetUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const readable = can(member, 'sources.read')
  const writable = can(member, 'sources.write')
  const allowed = readable || writable

  useEffect(() => {
    if (!readable) {
      setLoading(false)
      return
    }
    let active = true

    api<DataSource[]>('/api/data-sources', token)
      .then(async (records) => {
        if (!active) return
        setSources(records)

        if (records[0]) {
          const preview = await api<DataSourceDetail>(
            `/api/data-sources/${records[0].id}`,
            token,
          )
          if (active) setDetail(preview)
        }
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [readable, token, member?.id])

  function perform(work: () => Promise<void>) {
    void task(async () => {
      setError('')

      try {
        await work()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Request failed')
        throw reason
      }
    })
  }

  function savePreview(preview: DataSourceDetail) {
    const { rows, ...metadata } = preview

    setSources((current) =>
      current.some((source) => source.id === metadata.id)
        ? current.map((source) =>
            source.id === metadata.id ? metadata : source,
          )
        : [metadata, ...current],
    )
    setDetail({ ...metadata, rows })
  }

  if (!allowed)
    return (
      <div className="empty-panel">
        <ShieldCheck />
        <h1>Editor access required</h1>
        <p>Owners and editors can import data and build APIs from it.</p>
      </div>
    )

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">FROM SPREADSHEET TO API</div>
          <h1>Data sources</h1>
          <p>
            Bring your data. Preview its columns. Build an API without writing
            JSON.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy || loading || !readable}
          onClick={() =>
            perform(async () => {
              setSources(await api<DataSource[]>('/api/data-sources', token))
              if (detail)
                setDetail(
                  await api<DataSourceDetail>(
                    `/api/data-sources/${detail.id}`,
                    token,
                  ),
                )
              message('Data sources refreshed.')
            })
          }
        >
          <RefreshCw />
          Refresh list
        </Button>
      </div>
      <div className="getting-started-steps">
        <span>
          <strong>1</strong> Import a spreadsheet
        </span>
        <span>
          <strong>2</strong> Check your data
        </span>
        <span>
          <strong>3</strong> Choose API fields
        </span>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>Loading data sources…</p> : null}
      <fieldset className="source-write-fields" disabled={!writable || busy}>
        <legend className="sr-only">Manage data sources</legend>
        <section className="source-preview source-import">
          <div className="panel-heading">
            <h2>Add a data source</h2>
            <FileSpreadsheet size={20} />
          </div>
          <div className="source-import-method">
            <label htmlFor="import-method">Import method</label>
            <Select
              id="import-method"
              label="Import method"
              value={importMethod}
              onValueChange={(value) => {
                setImportMethod(value)
                setFile(null)
                if (fileInput.current) fileInput.current.value = ''
                setError('')
              }}
              options={[
                { value: 'file', label: 'Spreadsheet file' },
                { value: 'google', label: 'Public Google Sheet' },
              ]}
              disabled={busy}
            />
          </div>
          <form
            className="source-import-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                busy ||
                loading ||
                !name.trim() ||
                (importMethod === 'file' ? !file : !sheetUrl.trim())
              )
                return

              perform(async () => {
                const imported =
                  importMethod === 'file'
                    ? await uploadSpreadsheet(
                        '/api/data-sources/import',
                        token,
                        name.trim(),
                        file!,
                      )
                    : await api<DataSourceDetail>(
                        '/api/data-sources/google-sheets',
                        token,
                        'POST',
                        { name: name.trim(), url: sheetUrl.trim() },
                      )
                savePreview(imported)
                setName('')
                setFile(null)
                setSheetUrl('')
                if (fileInput.current) fileInput.current.value = ''
                message(
                  'Spreadsheet imported. Check your data before creating an API.',
                )
              })
            }}
          >
            <label htmlFor="source-name">
              Source name
              <Input
                id="source-name"
                value={name}
                maxLength={80}
                required
                disabled={busy}
                placeholder="Products"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {importMethod === 'file' ? (
              <label key="file" htmlFor="spreadsheet-file">
                Spreadsheet file
                <Input
                  id="spreadsheet-file"
                  ref={fileInput}
                  type="file"
                  accept=".csv,.xlsx"
                  disabled={busy}
                  required
                  onChange={(event) => {
                    const chosen = event.target.files?.[0] ?? null
                    setFile(chosen)
                    if (chosen && !name.trim())
                      setName(
                        chosen.name
                          .replace(/\.[^.]+$/, '')
                          .replace(/[_-]+/g, ' ')
                          .slice(0, 80),
                      )
                  }}
                />
              </label>
            ) : (
              <label key="google" htmlFor="google-sheet-link">
                Google Sheets link
                <Input
                  id="google-sheet-link"
                  type="url"
                  value={sheetUrl}
                  onChange={(event) => setSheetUrl(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                  required
                  disabled={busy}
                  aria-describedby="import-source-help"
                />
              </label>
            )}
            <Button
              disabled={
                busy ||
                loading ||
                !name.trim() ||
                (importMethod === 'file' ? !file : !sheetUrl.trim())
              }
            >
              <Upload />
              {importMethod === 'file'
                ? 'Import spreadsheet'
                : 'Import Google Sheet'}
            </Button>
          </form>
          <p className="source-note" id="import-source-help">
            {importMethod === 'file'
              ? 'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.'
              : 'Share the sheet for anyone with the link to view. We save its current rows; changes are imported only when you refresh saved data. For a private sheet, upload Excel or CSV instead.'}
          </p>
        </section>
      </fieldset>
      {!writable ? (
        <p>
          Manage data sources access is needed to import or change saved rows.
        </p>
      ) : null}
      {!readable ? (
        <p>Read data sources access is needed to browse saved sources.</p>
      ) : null}
      {sources.length ? (
        <div className="source-selector">
          <label htmlFor="saved-source">Saved data source</label>
          <Select
            id="saved-source"
            label="Saved data source"
            value={detail?.id ?? ''}
            placeholder="Choose a data source"
            disabled={busy || loading || !readable}
            options={sources.map((source) => ({
              value: source.id,
              label: `${source.name} · ${source.rowCount} rows`,
            }))}
            onValueChange={(id) =>
              perform(async () => {
                setDetail(
                  await api<DataSourceDetail>(`/api/data-sources/${id}`, token),
                )
              })
            }
          />
        </div>
      ) : !loading ? (
        <div className="runtime-key-empty">
          <Database />
          <h2>No data sources yet.</h2>
          <p>Import a spreadsheet to see your data here.</p>
        </div>
      ) : null}
      {detail ? (
        <div className="data-source-grid">
          <section className="source-preview">
            <div className="panel-heading">
              <h2>{detail.name}</h2>
              <Badge variant="secondary">{detail.rowCount} rows</Badge>
            </div>
            <p className="source-note">
              Showing {detail.rows.length} of {detail.rowCount} rows. Version{' '}
              {detail.version} · Saved{' '}
              {new Date(detail.updatedAt).toLocaleString()}
              {detail.sheetName ? ` · Sheet: ${detail.sheetName}` : ''}.
            </p>
            <div className="data-table source-table">
              <table>
                <thead>
                  <tr>
                    {detail.columns.map((column) => (
                      <th key={column.key}>
                        {column.label}
                        <span className="column-type">
                          {columnTypes[column.type]}
                          {column.nullable ? ' · Empty cells allowed' : ''}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((row, index) => (
                    <tr key={index}>
                      {detail.columns.map((column) => (
                        <td key={column.key}>
                          {row[column.key] === null ||
                          row[column.key] === undefined ? (
                            <span className="empty-cell">Empty</span>
                          ) : (
                            String(row[column.key])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SourceActions
              key={`${detail.id}:${detail.version}`}
              source={detail}
              busy={busy || loading || !writable}
              onReplace={(replacement) => {
                if (
                  !window.confirm(
                    `Replace saved data for ${detail.name}? APIs using this source will read the new snapshot.`,
                  )
                )
                  return

                perform(async () => {
                  savePreview(
                    await uploadSpreadsheet(
                      `/api/data-sources/${detail.id}/import`,
                      token,
                      detail.name,
                      replacement,
                      'PUT',
                    ),
                  )
                  message(
                    'Spreadsheet replaced. Your APIs now use the saved data.',
                  )
                })
              }}
              onRefresh={() => {
                if (
                  !window.confirm(
                    `Refresh saved data for ${detail.name}? APIs using this source will read the new Google Sheets snapshot.`,
                  )
                )
                  return

                perform(async () => {
                  savePreview(
                    await api<DataSourceDetail>(
                      `/api/data-sources/${detail.id}/refresh`,
                      token,
                      'POST',
                    ),
                  )
                  message(
                    'Google Sheet refreshed. Your APIs now use the saved data.',
                  )
                })
              }}
              onDelete={() => {
                if (
                  !window.confirm(
                    `Delete data source ${detail.name}? This cannot be undone.`,
                  )
                )
                  return

                perform(async () => {
                  await api(`/api/data-sources/${detail.id}`, token, 'DELETE')
                  const remaining = sources.filter(
                    (source) => source.id !== detail.id,
                  )
                  setSources(remaining)
                  setDetail(null)
                  if (readable && remaining[0])
                    setDetail(
                      await api<DataSourceDetail>(
                        `/api/data-sources/${remaining[0].id}`,
                        token,
                      ),
                    )
                  message('Data source deleted.')
                })
              }}
            />
          </section>
          <ApiFromData
            key={`${detail.id}:${detail.version}`}
            source={detail}
            busy={busy || loading || !readable || !can(member, 'flows.write')}
            onCreate={(options) => {
              if (
                useStudio.getState().dirty &&
                !window.confirm(
                  'Discard unsaved draft changes and create this API?',
                )
              )
                return

              perform(async () => {
                const flow = await api<SavedFlow>(
                  `/api/data-sources/${detail.id}/api`,
                  token,
                  'POST',
                  options,
                )

                if (can(member, 'flows.read')) {
                  useStudio.getState().openCreated(flow)
                  message('API draft created. Test your data, then publish it.')
                  onOpenApi()
                } else
                  message(
                    'API draft created. Read APIs access is needed to open API Studio.',
                  )
              })
            }}
          />
        </div>
      ) : null}
    </>
  )
}
