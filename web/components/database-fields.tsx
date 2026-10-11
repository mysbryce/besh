import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Select } from './ui/select'
import type {
  DatabaseConnection,
  DatabaseTable,
} from '../../src/databases/model'
import type { DependencyDatabase } from '../../src/workspace/dependency-model'

export type DatabaseSelection = {
  table: string
  columns: string[]
  limit: string
  filtered: boolean
  filterColumn: string
  filterType:
    'text' | 'number' | 'boolean' | 'null' | 'query' | 'body' | 'params'
  filterValue: string
}

export function databaseSelection(
  table?: DatabaseTable | DependencyDatabase['tables'][number],
): DatabaseSelection {
  return {
    table: table?.name ?? '',
    columns: table?.columns.map((column) => column.key) ?? [],
    limit: '25',
    filtered: false,
    filterColumn: table?.columns[0]?.key ?? '',
    filterType:
      table?.columns[0]?.type === 'number'
        ? 'number'
        : table?.columns[0]?.type === 'boolean'
          ? 'boolean'
          : 'text',
    filterValue: table?.columns[0]?.type === 'boolean' ? 'true' : '',
  }
}

export function databaseFilter(selection: DatabaseSelection) {
  if (!selection.filtered) return undefined
  const {
    filterColumn: column,
    filterType: type,
    filterValue: value,
  } = selection
  if (!column) throw new Error('Choose a filter column.')
  if (type === 'number') {
    if (!value.trim() || !Number.isFinite(Number(value)))
      throw new Error('Enter a valid number for the equality filter.')
    return { column, value: Number(value) }
  }
  if (type === 'boolean') return { column, value: value === 'true' }
  if (type === 'null') return { column, value: null }
  if (type === 'query' || type === 'body' || type === 'params') {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,159}$/.test(value))
      throw new Error('Give the filter input a field name.')
    return { column, value: `$input.${type}.${value}` }
  }
  return { column, value }
}

export function DatabaseReadFields({
  connection,
  selection,
  disabled,
  references = false,
  onChange,
}: {
  connection: DatabaseConnection | DependencyDatabase
  selection: DatabaseSelection
  disabled: boolean
  references?: boolean
  onChange: (selection: DatabaseSelection) => void
}) {
  const table = connection.tables.find(
    (table) => table.name === selection.table,
  )
  return (
    <div className="simple-form">
      <label>
        Table
        <Select
          label="Table"
          value={selection.table}
          disabled={disabled || !connection.tables.length}
          options={connection.tables.map((table) => ({
            value: table.name,
            label: table.name,
          }))}
          onValueChange={(name) =>
            onChange(
              databaseSelection(
                connection.tables.find((table) => table.name === name),
              ),
            )
          }
        />
      </label>
      <p className="field-help">
        {table && 'rowCount' in table
          ? `${table.rowCount} rows in this saved table. Choose the columns your API may return.`
          : 'Structure only. Choose the columns your API may return under explicit SQLite USE.'}
      </p>
      <fieldset className="source-fieldset">
        <legend>Returned columns</legend>
        <div className="source-column-choices">
          {table?.columns.map((column) => (
            <label className="source-column-choice" key={column.key}>
              <Checkbox
                aria-label={`Include ${column.key}`}
                checked={selection.columns.includes(column.key)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({
                    ...selection,
                    columns: checked
                      ? [...selection.columns, column.key]
                      : selection.columns.filter((key) => key !== column.key),
                  })
                }
              />
              <span>
                <strong>{column.label}</strong>
                <small className="source-field-mapping">
                  {column.type === 'number'
                    ? 'Number'
                    : column.type === 'boolean'
                      ? 'True or false'
                      : 'Text'}
                  {column.nullable ? ' · may be empty' : ''}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Maximum rows
        <Select
          label="Maximum rows"
          value={selection.limit}
          disabled={disabled}
          options={[
            ...new Set(['1', '10', '25', '50', '100', selection.limit]),
          ].map((value) => ({ value, label: value }))}
          onValueChange={(limit) => onChange({ ...selection, limit })}
        />
      </label>
      <label className="permission-option">
        <Checkbox
          aria-label="Filter rows"
          checked={selection.filtered}
          disabled={disabled}
          onCheckedChange={(filtered) =>
            onChange({ ...selection, filtered: filtered === true })
          }
        />
        <span>
          Match one column
          <small>Optional equality filter. No SQL needed.</small>
        </span>
      </label>
      {selection.filtered ? (
        <div className="source-filter-fields">
          <label>
            Filter column
            <Select
              label="Filter column"
              value={selection.filterColumn}
              disabled={disabled}
              options={(table?.columns ?? []).map((column) => ({
                value: column.key,
                label: column.label,
              }))}
              onValueChange={(filterColumn) => {
                const column = table?.columns.find(
                  (column) => column.key === filterColumn,
                )
                onChange({
                  ...selection,
                  filterColumn,
                  filterType:
                    column?.type === 'number'
                      ? 'number'
                      : column?.type === 'boolean'
                        ? 'boolean'
                        : 'text',
                  filterValue: column?.type === 'boolean' ? 'true' : '',
                })
              }}
            />
          </label>
          <label>
            Equals value type
            <Select
              label="Equals value type"
              value={selection.filterType}
              disabled={disabled}
              onValueChange={(filterType) =>
                onChange({
                  ...selection,
                  filterType: filterType as DatabaseSelection['filterType'],
                  filterValue: filterType === 'boolean' ? 'true' : '',
                })
              }
              options={[
                { value: 'text', label: 'Fixed text' },
                { value: 'number', label: 'Fixed number' },
                { value: 'boolean', label: 'True or false' },
                { value: 'null', label: 'Empty value' },
                ...(references
                  ? [
                      { value: 'query', label: 'From query parameter' },
                      { value: 'params', label: 'From path parameter' },
                      { value: 'body', label: 'From request body' },
                    ]
                  : []),
              ]}
            />
          </label>
          {selection.filterType === 'boolean' ? (
            <label>
              Equals value
              <Select
                label="Equals value"
                value={selection.filterValue}
                disabled={disabled}
                onValueChange={(filterValue) =>
                  onChange({ ...selection, filterValue })
                }
                options={[
                  { value: 'true', label: 'True' },
                  { value: 'false', label: 'False' },
                ]}
              />
            </label>
          ) : selection.filterType !== 'null' ? (
            <label>
              {['query', 'body', 'params'].includes(selection.filterType)
                ? 'Input field name'
                : 'Equals value'}
              <Input
                aria-label="Equals value"
                value={selection.filterValue}
                disabled={disabled}
                maxLength={4096}
                onChange={(event) =>
                  onChange({ ...selection, filterValue: event.target.value })
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
