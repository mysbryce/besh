import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/select'
import { api } from '../../lib/api'
import { useStudio } from '../../stores/studio-store'
import { canReadDependencyStructure } from '../../lib/dependency-access'
import type { DependencyDatabase } from '../../../src/workspace/dependency-model'
import type {
  DatabaseConnection,
  DatabaseReadConfig,
} from '../../../src/databases/model'
import {
  DatabaseReadFields,
  databaseFilter,
  databaseSelection,
  type DatabaseSelection,
} from '../../components/database-fields'

export function DatabaseNodeForm({
  config,
  token,
  disabled,
  onApply,
  onError,
}: {
  config: DatabaseReadConfig
  token: string
  disabled: boolean
  onApply: (config: DatabaseReadConfig) => void
  onError: (message: string) => void
}) {
  const state = useStudio()
  const selectedAccess = state.member?.access.mode === 'selected'
  const structuralOnly = selectedAccess || state.member?.role !== 'owner'
  const [connections, setConnections] = useState<
    (DatabaseConnection | DependencyDatabase)[]
  >([])
  const [connectionId, setConnectionId] = useState(config.connectionId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const reference =
    typeof config.filter?.value === 'string'
      ? config.filter.value.match(/^\$input\.(query|body|params)\.(.+)$/)
      : null
  const [selection, setSelection] = useState<DatabaseSelection>(() => ({
    table: config.table,
    columns: config.columns,
    limit: String(config.limit),
    filtered: !!config.filter,
    filterColumn: config.filter?.column ?? config.columns[0] ?? '',
    filterType: reference
      ? (reference[1] as 'query' | 'body' | 'params')
      : config.filter?.value === null
        ? 'null'
        : typeof config.filter?.value === 'number'
          ? 'number'
          : typeof config.filter?.value === 'boolean'
            ? 'boolean'
            : 'text',
    filterValue: reference ? reference[2]! : String(config.filter?.value ?? ''),
  }))
  useEffect(() => {
    if (!canReadDependencyStructure(state.member, 'database-connections.read'))
      return
    let active = true
    const session = state.sessionId
    const memberId = state.member?.id
    const current = () => {
      const live = useStudio.getState()
      return (
        active &&
        live.sessionId === session &&
        live.member?.id === memberId &&
        canReadDependencyStructure(live.member, 'database-connections.read')
      )
    }
    setLoading(true)
    setError('')
    void api<(DatabaseConnection | DependencyDatabase)[]>(
      structuralOnly
        ? '/api/dependencies/database-connections'
        : '/api/database-connections',
      token,
    )
      .then((value) => {
        if (!current()) return
        setConnections(value)
        if (!config.connectionId && value[0]) {
          setConnectionId(value[0].id)
          setSelection(databaseSelection(value[0].tables[0]))
        }
      })
      .catch((reason: Error) => {
        if (current()) setError(reason.message)
      })
      .finally(() => {
        if (current()) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [
    token,
    state.sessionId,
    state.member?.id,
    retry,
    selectedAccess,
    structuralOnly,
  ])
  const connection = connections.find((item) => item.id === connectionId)
  return (
    <div className="simple-form">
      <p className="field-help">
        Changing read settings does not rewrite API rules or the GraphQL schema.
        {selectedAccess
          ? 'Review the matching API rules or schema before testing and publishing. Ask the owner for additional dependency USE; selected access cannot generate new APIs.'
          : 'Recreate a draft from Database connections with the intended fields, or review its matching contract before testing and publishing.'}
      </p>
      <p className="field-help">
        Read only from a saved SQLite copy. Changes to the original file are not
        synced.
      </p>
      {loading ? <p>Loading database connections…</p> : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry database choices
          </Button>
        </p>
      ) : null}
      <label>
        Database connection
        <Select
          label="Database connection"
          value={connectionId}
          disabled={disabled || loading || !connections.length}
          options={connections.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onValueChange={(id) => {
            setConnectionId(id)
            setSelection(
              databaseSelection(
                connections.find((item) => item.id === id)?.tables[0],
              ),
            )
          }}
        />
      </label>
      {!loading && !connection ? (
        <p>
          {selectedAccess
            ? 'No allowed copy selected. Ask the owner to review SQLite USE for your selected APIs.'
            : 'No readable copy selected. Upload a SQLite copy in Database connections, then return here.'}
        </p>
      ) : null}
      {connection ? (
        <DatabaseReadFields
          connection={connection}
          selection={selection}
          disabled={disabled || loading}
          references
          onChange={setSelection}
        />
      ) : null}
      <Button
        variant="outline"
        disabled={
          disabled || loading || !connection || !selection.columns.length
        }
        onClick={() => {
          try {
            const table = connection?.tables.find(
              (item) => item.name === selection.table,
            )
            if (
              !table ||
              selection.columns.some(
                (key) => !table.columns.some((column) => column.key === key),
              )
            )
              throw new Error('Choose an inspected table and returned columns.')
            const filter = databaseFilter(selection)
            onApply({
              connectionId,
              table: selection.table,
              columns: selection.columns,
              limit: Number(selection.limit),
              ...(filter ? { filter } : {}),
            })
          } catch (reason) {
            onError(
              reason instanceof Error
                ? reason.message
                : 'Check SQLite read choices.',
            )
          }
        }}
      >
        Apply configuration
      </Button>
    </div>
  )
}
