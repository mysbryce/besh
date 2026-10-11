import type { FieldPolicy } from '../../../src/workspace/tenant-model'
import type { DataColumn } from '../../../src/data/sources'
import { Checkbox } from '../ui/checkbox'
import { Select } from '../ui/select'

export function fieldPolicyWidens(previous: FieldPolicy, next: FieldPolicy) {
  return (
    previous.mode === 'selected' &&
    (next.mode === 'all' ||
      next.columns.some((key) => !previous.columns.includes(key)))
  )
}

export function FieldPolicyEditor({
  fields,
  columns,
  label = 'API field access',
  disabled,
  onChange,
}: {
  fields: FieldPolicy
  columns: DataColumn[]
  label?: string
  disabled: boolean
  onChange: (fields: FieldPolicy) => void
}) {
  return (
    <fieldset className="form-stack min-w-0" disabled={disabled}>
      <legend>{label}</legend>
      <Select
        label={label}
        value={fields.mode}
        disabled={disabled}
        onValueChange={(mode) =>
          onChange({ mode: mode as FieldPolicy['mode'], columns: [] })
        }
        options={[
          { value: 'all', label: 'All fields' },
          { value: 'selected', label: 'Selected fields' },
        ]}
      />
      <p className="field-help">
        This is the shared ceiling for API reads of this source or table,
        including owner tests. Tenant-specific choices can narrow it; member
        action grants remain separate. Names and schema remain visible under
        existing access grants; owner raw previews remain full.
      </p>
      {fields.mode === 'all' ? (
        <p>All fields includes future columns.</p>
      ) : (
        <>
          <p>
            Only selected fields may be returned or used in API filters. New
            columns stay excluded.
          </p>
          {columns.map((column) => (
            <label key={column.key} className="flex min-w-0 items-start gap-3">
              <Checkbox
                aria-label={`Allow API field ${column.label}`}
                disabled={disabled}
                checked={fields.columns.includes(column.key)}
                onCheckedChange={(checked) =>
                  onChange({
                    mode: 'selected',
                    columns:
                      checked === true
                        ? [...fields.columns, column.key]
                        : fields.columns.filter((key) => key !== column.key),
                  })
                }
              />
              <span className="min-w-0 break-words">{column.label}</span>
            </label>
          ))}
          {!fields.columns.length ? (
            <p className="form-error">
              No API fields shared. API reads using this empty field selection
              stop.
            </p>
          ) : null}
        </>
      )}
      <p className="field-help">
        The private tenant column is still used to find permitted rows.
        Selecting it here separately allows APIs to return or filter on that
        field.
      </p>
    </fieldset>
  )
}

export function FieldPolicySummary({
  fields,
  columns = [],
}: {
  fields: FieldPolicy
  columns?: DataColumn[]
}) {
  return (
    <p className="break-words">
      API fields:{' '}
      {fields.mode === 'all'
        ? 'All fields, including future columns'
        : fields.columns.length
          ? fields.columns
              .map((key) => {
                const label = columns.find(
                  (column) => column.key === key,
                )?.label
                return label && label !== key ? `${label} (${key})` : key
              })
              .join(', ')
          : 'No API fields shared'}
    </p>
  )
}
