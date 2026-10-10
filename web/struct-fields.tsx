import { Plus, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { useTranslation } from './i18n'
import {
  emptyField,
  emptySchema,
  removesStructure,
  type EditorField,
  type EditorSchema,
} from './struct-store'

const typeLabels = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True or false' },
  { value: 'object', label: 'Group' },
  { value: 'array', label: 'List' },
  { value: 'select', label: 'Choice' },
  { value: 'richText', label: 'Rich text' },
  { value: 'formattedRichText', label: 'Formatted rich text' },
] as const

export function StructFields({
  fields,
  onChange,
  disabled,
  parent = '',
  depth = 1,
}: {
  fields: EditorField[]
  onChange: (fields: EditorField[]) => void
  disabled: boolean
  parent?: string
  depth?: number
}) {
  const { t } = useTranslation()
  const addField = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const addLabel = parent
    ? t('Add field to {path}', { path: parent })
    : t('Add field')

  useLayoutEffect(() => {
    if (!returnFocus.current) return

    returnFocus.current = false
    addField.current?.focus()
  }, [fields.length])

  return (
    <div className="struct-fields">
      {fields.length ? (
        fields.map((field, index) => {
          const path = parent ? `${parent}.${index + 1}` : String(index + 1)
          const update = (changes: Partial<EditorField>) => {
            if (disabled) return

            onChange(
              fields.map((entry) =>
                entry.id === field.id ? { ...entry, ...changes } : entry,
              ),
            )
          }

          return (
            <section
              className="struct-field-card"
              key={field.id}
              aria-label={t('Field {path}', { path })}
            >
              <div className="struct-card-heading">
                <h3>{t('Field {path}', { path })}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('Remove field {path}', { path })}
                  disabled={disabled}
                  onClick={() => {
                    returnFocus.current = true
                    onChange(fields.filter((entry) => entry.id !== field.id))
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="struct-field-grid">
                <label>
                  {t('Field {path} label', { path })}
                  <Input
                    aria-label={t('Field {path} label', { path })}
                    value={field.label}
                    maxLength={80}
                    disabled={disabled}
                    onChange={(event) => update({ label: event.target.value })}
                  />
                </label>
                <label>
                  {t('Field {path} key', { path })}
                  <Input
                    aria-label={t('Field {path} key', { path })}
                    value={field.key}
                    maxLength={64}
                    spellCheck={false}
                    disabled={disabled}
                    onChange={(event) => update({ key: event.target.value })}
                  />
                </label>
              </div>
              <label
                className="struct-required"
                htmlFor={`struct-required-${field.id}`}
              >
                <Checkbox
                  id={`struct-required-${field.id}`}
                  aria-label={t('Field {path} required', { path })}
                  checked={field.required}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    update({ required: checked === true })
                  }
                />
                {t('Field {path} required', { path })}
              </label>
              <SchemaEditor
                schema={field.schema}
                path={path}
                depth={depth}
                disabled={disabled}
                onChange={(schema) => update({ schema })}
              />
            </section>
          )
        })
      ) : (
        <p className="field-help">{t('No fields yet')}</p>
      )}
      <Button
        ref={addField}
        type="button"
        variant="outline"
        disabled={disabled || fields.length >= 32 || depth > 6}
        onClick={() => onChange([...fields, emptyField()])}
      >
        <Plus size={16} />
        {addLabel}
      </Button>
    </div>
  )
}

function SchemaEditor({
  schema,
  path,
  depth,
  disabled,
  onChange,
  item = false,
}: {
  schema: EditorSchema
  path: string
  depth: number
  disabled: boolean
  onChange: (schema: EditorSchema) => void
  item?: boolean
}) {
  const { t } = useTranslation()
  const addOption = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const optionCount = schema.type === 'select' ? schema.options.length : 0
  const selectedType =
    schema.type === 'richText' && schema.schemaVersion === 2
      ? 'formattedRichText'
      : schema.type
  const label = t(item ? 'Field {path} item type' : 'Field {path} type', {
    path,
  })

  useLayoutEffect(() => {
    if (!returnFocus.current) return

    returnFocus.current = false
    addOption.current?.focus()
  }, [optionCount])

  function switchType(value: string) {
    if (disabled || value === selectedType) return
    if (value === 'richText' && (depth !== 1 || item)) return

    if (
      removesStructure(schema) &&
      !window.confirm(
        t('Changing this type removes its nested fields or choices. Continue?'),
      )
    )
      return

    if (value === 'formattedRichText') {
      onChange(emptySchema('formattedRichText'))
      return
    }

    onChange(emptySchema(value as EditorSchema['type']))
  }

  return (
    <div className="struct-schema">
      <label>
        {label}
        <Select
          label={label}
          value={selectedType}
          disabled={disabled}
          options={typeLabels
            .filter((entry) => depth < 6 || entry.value !== 'array')
            .filter(
              (entry) => entry.value !== 'richText' || (depth === 1 && !item),
            )
            .map((entry) => ({ value: entry.value, label: t(entry.label) }))}
          onValueChange={switchType}
        />
      </label>
      {schema.type === 'richText' ? (
        <p className="field-help">
          {t(
            schema.schemaVersion === 1
              ? 'Paragraph text only. Text is stored literally; preview saved HTML from Content.'
              : 'Formatted text supports headings and emphasis. Pasted content is plain text.',
          )}
        </p>
      ) : null}
      {schema.type === 'object' ? (
        <div className="struct-nested">
          <StructFields
            fields={schema.fields}
            parent={path}
            depth={depth + 1}
            disabled={disabled}
            onChange={(fields) => onChange({ type: 'object', fields })}
          />
        </div>
      ) : schema.type === 'array' ? (
        <div className="struct-nested">
          <SchemaEditor
            schema={schema.items}
            path={item ? `${path}[]` : path}
            depth={depth + 1}
            disabled={disabled}
            item
            onChange={(items) => onChange({ type: 'array', items })}
          />
        </div>
      ) : schema.type === 'select' ? (
        <div className="struct-choices">
          <h4>{t('Choices for {path}', { path })}</h4>
          {schema.options.map((option, index) => {
            const optionPath = `${path}.${index + 1}`
            const update = (
              changes: Partial<Pick<typeof option, 'value' | 'label'>>,
            ) => {
              if (disabled) return

              onChange({
                type: 'select',
                options: schema.options.map((entry) =>
                  entry.id === option.id ? { ...entry, ...changes } : entry,
                ),
              })
            }

            return (
              <div className="struct-option" key={option.id}>
                <label>
                  {t('Option {path} value', { path: optionPath })}
                  <Input
                    aria-label={t('Option {path} value', { path: optionPath })}
                    value={option.value}
                    maxLength={80}
                    disabled={disabled}
                    onChange={(event) => update({ value: event.target.value })}
                  />
                </label>
                <label>
                  {t('Option {path} label', { path: optionPath })}
                  <Input
                    aria-label={t('Option {path} label', { path: optionPath })}
                    value={option.label}
                    maxLength={80}
                    disabled={disabled}
                    onChange={(event) => update({ label: event.target.value })}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('Remove option {path}', { path: optionPath })}
                  disabled={disabled}
                  onClick={() => {
                    returnFocus.current = true
                    onChange({
                      type: 'select',
                      options: schema.options.filter(
                        (entry) => entry.id !== option.id,
                      ),
                    })
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            )
          })}
          <Button
            ref={addOption}
            type="button"
            variant="outline"
            disabled={disabled || schema.options.length >= 32}
            onClick={() =>
              onChange({
                type: 'select',
                options: [
                  ...schema.options,
                  { id: crypto.randomUUID(), value: '', label: '' },
                ],
              })
            }
          >
            <Plus size={16} />
            {t('Add option to {path}', { path })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
