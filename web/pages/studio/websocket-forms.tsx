import type { ApiSchema } from '../../../src/flows/model'
import type { WebSocketDefinition } from '../../../src/websockets/model'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'

const fieldTypes = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Whole number' },
  { value: 'boolean', label: 'True or false' },
]

function MessageFields({
  schema,
  prefix,
  disabled,
  onChange,
  onError,
}: {
  schema: ApiSchema
  prefix: string
  disabled: boolean
  onChange: (schema: ApiSchema) => void
  onError: (message: string) => void
}) {
  if (schema.type !== 'object') return null
  const fields = Object.entries(schema.properties ?? {})
  return (
    <div className="form-stack">
      {fields.map(([name, field], index) => (
        <fieldset className="rule-field" key={index}>
          <legend>
            {prefix} field {index + 1}
          </legend>
          <label>
            Field name
            <Input
              aria-label={`${prefix} field name ${index + 1}`}
              value={name}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value
                if (
                  ['__proto__', 'prototype', 'constructor'].includes(next) ||
                  (next !== name &&
                    Object.hasOwn(schema.properties ?? {}, next))
                ) {
                  onError(
                    'Choose a unique field name. Reserved names cannot be used.',
                  )
                  return
                }
                onChange({
                  ...schema,
                  properties: Object.fromEntries(
                    fields.map(([key, value]) => [
                      key === name ? next : key,
                      value,
                    ]),
                  ),
                  required: schema.required?.map((key) =>
                    key === name ? next : key,
                  ),
                })
              }}
            />
          </label>
          <label>
            Value type
            <Select
              label={`${prefix} field ${index + 1} type`}
              value={field.type}
              disabled={disabled}
              options={fieldTypes}
              onValueChange={(type) =>
                onChange({
                  ...schema,
                  properties: {
                    ...schema.properties,
                    [name]: {
                      type: type as 'string' | 'number' | 'integer' | 'boolean',
                      ...(field.nullable ? { nullable: true } : {}),
                    },
                  },
                })
              }
            />
          </label>
          <label className="rule-check">
            <Checkbox
              checked={schema.required?.includes(name) ?? false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({
                  ...schema,
                  required:
                    checked === true
                      ? [
                          ...(schema.required ?? []).filter(
                            (key) => key !== name,
                          ),
                          name,
                        ]
                      : (schema.required ?? []).filter((key) => key !== name),
                })
              }
            />
            {prefix} field {index + 1} required
          </label>
          <label className="rule-check">
            <Checkbox
              checked={field.nullable ?? false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({
                  ...schema,
                  properties: {
                    ...schema.properties,
                    [name]: { ...field, nullable: checked === true },
                  },
                })
              }
            />
            {prefix} field {index + 1} allow null
          </label>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...schema,
                properties: Object.fromEntries(
                  fields.filter(([key]) => key !== name),
                ),
                required: schema.required?.filter((key) => key !== name),
              })
            }
          >
            Remove {prefix.toLowerCase()} field {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        disabled={disabled || fields.length >= 64}
        onClick={() => {
          let index = 1
          while (Object.hasOwn(schema.properties ?? {}, `field${index}`))
            index++
          onChange({
            ...schema,
            properties: {
              ...schema.properties,
              [`field${index}`]: { type: 'string' },
            },
          })
        }}
      >
        Add {prefix.toLowerCase()} field
      </Button>
    </div>
  )
}

export function WebSocketForms({
  definition,
  disabled,
  onChange,
  onError,
}: {
  definition: WebSocketDefinition
  disabled: boolean
  onChange: (definition: WebSocketDefinition) => void
  onError: (message: string) => void
}) {
  const reply =
    definition.output.type === 'array'
      ? definition.output.items
      : definition.output
  return (
    <section
      className="load-test-card form-stack"
      aria-label="WebSocket message rules"
    >
      <h2>WebSocket message rules</h2>
      <p>
        Receive one typed message and send one typed reply. Fields contain text,
        numbers or true/false values; nested objects, branches and login effects
        are not supported.
      </p>
      <h3>Received fields</h3>
      <p>
        Messages contain an object with these fields. Extra fields are rejected.
      </p>
      <MessageFields
        schema={definition.input}
        prefix="Received"
        disabled={disabled}
        onChange={(input) => onChange({ ...definition, input })}
        onError={onError}
      />
      <h3>Reply fields</h3>
      <label>
        Reply shape
        <Select
          label="WebSocket reply shape"
          value={definition.output.type === 'array' ? 'rows' : 'object'}
          disabled={disabled}
          options={[
            { value: 'object', label: 'Object with fields' },
            { value: 'rows', label: 'List of flat rows' },
          ]}
          onValueChange={(shape) =>
            onChange({
              ...definition,
              output:
                shape === 'rows'
                  ? { type: 'array', items: reply, maxItems: 100 }
                  : reply,
            })
          }
        />
      </label>
      <p>
        Echo replies must match the received fields. Row replies must match the
        selected spreadsheet or SQLite fields. Changing rules does not rewrite
        data settings.
      </p>
      <MessageFields
        schema={reply}
        prefix="Reply"
        disabled={disabled}
        onChange={(schema) =>
          onChange({
            ...definition,
            output:
              definition.output.type === 'array'
                ? { ...definition.output, items: schema }
                : schema,
          })
        }
        onError={onError}
      />
      <h3>Allowed browser origins</h3>
      <p>
        Published browser connections need an exact approved origin, such as
        https://app.example. No wildcard or path. This never replaces caller
        credentials.
      </p>
      {!definition.allowedOrigins.length ? (
        <p>
          No browser origin approved. Published native clients may connect
          without an Origin header. Draft testing uses workspace sign-in
          separately.
        </p>
      ) : null}
      {definition.allowedOrigins.map((origin, index) => (
        <div className="field-row" key={index}>
          <label>
            Browser origin {index + 1}
            <Input
              aria-label={`Browser origin ${index + 1}`}
              value={origin}
              disabled={disabled}
              placeholder="https://app.example"
              onChange={(event) =>
                onChange({
                  ...definition,
                  allowedOrigins: definition.allowedOrigins.map(
                    (value, item) =>
                      item === index ? event.target.value : value,
                  ),
                })
              }
            />
          </label>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...definition,
                allowedOrigins: definition.allowedOrigins.filter(
                  (_, item) => item !== index,
                ),
              })
            }
          >
            Remove origin {index + 1}
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        disabled={disabled || definition.allowedOrigins.length >= 16}
        onClick={() =>
          onChange({
            ...definition,
            allowedOrigins: [
              ...definition.allowedOrigins,
              window.location.origin,
            ],
          })
        }
      >
        Add browser origin
      </Button>
    </section>
  )
}
