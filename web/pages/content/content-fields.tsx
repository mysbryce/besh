import { lazy, Suspense, useId, useLayoutEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { StructField, StructSchema } from '../../../src/structs/model'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { useTranslation } from '../../i18n'
import { RichTextFields } from './rich-text-fields'
import {
  contentValue,
  type ContentFields as ContentFieldValues,
  type ContentValue,
} from '../../stores/content-entry-store'

const FormattedRichTextEditor = lazy(
  () => import('./formatted-rich-text-editor'),
)

export function ContentFields({
  fields,
  values,
  disabled,
  onChange,
  parent = '',
}: {
  fields: StructField[]
  values: ContentFieldValues
  disabled: boolean
  onChange: (values: ContentFieldValues) => void
  parent?: string
}) {
  const { t } = useTranslation()

  return (
    <div className="content-fields">
      {fields.length ? (
        fields.map((field) => {
          const current = values[field.key]
          const label = parent ? `${parent} · ${field.label}` : field.label
          const update = (changes: Partial<typeof current>) => {
            if (disabled) return

            onChange({ ...values, [field.key]: { ...current, ...changes } })
          }

          return (
            <section className="content-field" key={field.key}>
              {!field.required ? (
                <BooleanControl
                  label={t('Include {field}', { field: label })}
                  checked={current.included}
                  disabled={disabled}
                  onChange={(included) => update({ included })}
                />
              ) : null}
              <ValueControl
                schema={field.schema}
                value={current.value}
                label={label}
                disabled={disabled || !current.included}
                onChange={(value) => update({ value })}
              />
            </section>
          )
        })
      ) : (
        <p className="field-help">{t('No fields yet')}</p>
      )}
    </div>
  )
}

function BooleanControl({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <label className="content-checkbox" htmlFor={id}>
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  )
}

function ValueControl({
  schema,
  value,
  label,
  disabled,
  onChange,
}: {
  schema: StructSchema
  value: ContentValue
  label: string
  disabled: boolean
  onChange: (value: ContentValue) => void
}) {
  const { t } = useTranslation()

  if (
    schema.type === 'richText' &&
    schema.schemaVersion === 2 &&
    value.type === 'formattedRichText'
  )
    return (
      <Suspense
        fallback={<p className="field-help">{t('Opening text editor…')}</p>}
      >
        <FormattedRichTextEditor
          key={value.id}
          value={value}
          label={label}
          disabled={disabled}
          onChange={onChange}
        />
      </Suspense>
    )

  if (
    schema.type === 'richText' &&
    schema.schemaVersion === 1 &&
    value.type === 'richText'
  )
    return (
      <RichTextFields
        value={value}
        label={label}
        disabled={disabled}
        onChange={onChange}
      />
    )

  if (schema.type === 'boolean' && value.type === 'boolean')
    return (
      <BooleanControl
        label={label}
        checked={value.value}
        disabled={disabled}
        onChange={(next) => onChange({ type: 'boolean', value: next })}
      />
    )
  if (schema.type === 'object' && value.type === 'object')
    return (
      <div className="content-group">
        <h4>{label}</h4>
        <ContentFields
          fields={schema.fields}
          values={value.fields}
          disabled={disabled}
          parent={label}
          onChange={(fields) => onChange({ type: 'object', fields })}
        />
      </div>
    )
  if (schema.type === 'array' && value.type === 'array')
    return (
      <ListControl
        schema={schema}
        value={value}
        label={label}
        disabled={disabled}
        onChange={onChange}
      />
    )
  if (schema.type === 'select' && value.type === 'select')
    return (
      <label>
        {label}
        <Select
          label={label}
          value={value.value}
          placeholder={t('Choose a value')}
          disabled={disabled}
          options={schema.options.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onValueChange={(next) => onChange({ type: 'select', value: next })}
        />
      </label>
    )

  if (
    (schema.type === 'text' || schema.type === 'number') &&
    (value.type === 'text' || value.type === 'number')
  ) {
    const type = schema.type

    return (
      <label>
        {label}
        <Input
          aria-label={label}
          className="disabled:opacity-100"
          value={value.value}
          type="text"
          inputMode={type === 'number' ? 'decimal' : 'text'}
          disabled={disabled}
          maxLength={4096}
          onChange={(event) => onChange({ type, value: event.target.value })}
        />
      </label>
    )
  }

  return null
}

function ListControl({
  schema,
  value,
  label,
  disabled,
  onChange,
}: {
  schema: Extract<StructSchema, { type: 'array' }>
  value: Extract<ContentValue, { type: 'array' }>
  label: string
  disabled: boolean
  onChange: (value: ContentValue) => void
}) {
  const { t } = useTranslation()
  const addButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useLayoutEffect(() => {
    if (!returnFocus.current) return

    returnFocus.current = false
    addButton.current?.focus()
  }, [value.items.length])

  return (
    <div className="content-group">
      <h4>{label}</h4>
      {value.items.length ? (
        value.items.map((item, index) => {
          const itemLabel = t('{field} item {index}', {
            field: label,
            index: index + 1,
          })

          return (
            <div className="content-list-item" key={item.id}>
              <ValueControl
                schema={schema.items}
                value={item.value}
                label={itemLabel}
                disabled={disabled}
                onChange={(next) => {
                  if (disabled) return

                  onChange({
                    type: 'array',
                    items: value.items.map((entry) =>
                      entry.id === item.id ? { ...entry, value: next } : entry,
                    ),
                  })
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('Remove {field} item {index}', {
                  field: label,
                  index: index + 1,
                })}
                disabled={disabled}
                onClick={() => {
                  returnFocus.current = true
                  onChange({
                    type: 'array',
                    items: value.items.filter((entry) => entry.id !== item.id),
                  })
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        })
      ) : (
        <p className="field-help">{t('Empty list')}</p>
      )}
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        disabled={disabled || value.items.length >= 128}
        onClick={() =>
          onChange({
            type: 'array',
            items: [
              ...value.items,
              { id: crypto.randomUUID(), value: contentValue(schema.items) },
            ],
          })
        }
      >
        <Plus size={16} />
        {t('Add item to {field}', { field: label })}
      </Button>
    </div>
  )
}
