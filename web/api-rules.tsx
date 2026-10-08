import { useState } from 'react'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import type { ApiSchema } from '../src/flows/model'
import { useStudio } from './store'
import { can } from '../src/workspace/permissions'
import { api } from './lib/api'
import { Download } from 'lucide-react'
import { routeParameters } from './flow-forms'

const types = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Whole number' },
  { value: 'boolean', label: 'True or false' },
  { value: 'object', label: 'Object with fields' },
  { value: 'array', label: 'List of items' },
]

function newSchema(type: ApiSchema['type']): ApiSchema {
  if (type === 'object') return { type, properties: {} }
  if (type === 'array')
    return { type, items: { type: 'object', properties: {} } }
  return { type }
}

function SchemaEditor({
  schema,
  prefix,
  disabled,
  query = false,
  root = false,
  onChange,
  onError,
}: {
  schema: ApiSchema
  prefix: string
  disabled: boolean
  query?: boolean
  root?: boolean
  onChange: (schema: ApiSchema) => void
  onError: (message: string) => void
}) {
  function limits() {
    const keys =
      schema.type === 'array'
        ? ['minItems', 'maxItems']
        : schema.type === 'string'
          ? ['minLength', 'maxLength']
          : schema.type === 'number' || schema.type === 'integer'
            ? ['minimum', 'maximum']
            : []
    return keys.map((key, index) => (
      <label key={key}>
        {index === 0 ? 'Minimum' : 'Maximum'}
        {schema.type === 'string'
          ? ' characters'
          : schema.type === 'array'
            ? ' items'
            : ''}
        <Input
          aria-label={`${prefix} ${key}`}
          type="number"
          value={(schema as unknown as Record<string, number>)[key] ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...schema,
              [key]:
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
            })
          }
        />
      </label>
    ))
  }

  return (
    <div className="rule-schema">
      {!(query && root) ? (
        <label>
          {root ? 'Shape' : 'Type'}
          <Select
            label={`${prefix} type`}
            value={schema.type}
            disabled={disabled}
            options={query ? types.slice(0, 4) : types}
            onValueChange={(value) => {
              if (
                (schema.type === 'object' &&
                  Object.keys(schema.properties ?? {}).length > 0) ||
                schema.type === 'array'
              ) {
                if (
                  !confirm(
                    'Changing this type removes its current fields and item rules. Continue?',
                  )
                )
                  return
              }
              onChange({
                ...newSchema(value as ApiSchema['type']),
                ...(schema.description
                  ? { description: schema.description }
                  : {}),
                ...(!query && schema.nullable ? { nullable: true } : {}),
              })
            }}
          />
        </label>
      ) : null}
      {!query ? (
        <label className="rule-check">
          <Checkbox
            checked={schema.nullable ?? false}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ ...schema, nullable: checked === true })
            }
          />
          {prefix} allow null
        </label>
      ) : null}
      <details className="rule-details">
        <summary>Limits and description</summary>
        <div className="rule-limits">{limits()}</div>
        <label>
          Description (optional)
          <Input
            aria-label={`${prefix} description`}
            value={schema.description ?? ''}
            maxLength={500}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...schema,
                description: event.target.value || undefined,
              })
            }
          />
        </label>
      </details>
      {schema.type === 'object' ? (
        <>
          <label className="rule-check">
            <Checkbox
              checked={schema.additionalProperties !== false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange({ ...schema, additionalProperties: checked === true })
              }
            />
            {prefix} allow extra fields
          </label>
          {Object.entries(schema.properties ?? {}).map(
            ([name, property], index) => {
              const label = `${prefix} field ${index + 1}`
              const objectSchema = schema
              function updateProperty(value: ApiSchema) {
                onChange({
                  ...objectSchema,
                  properties: { ...objectSchema.properties, [name]: value },
                })
              }
              return (
                <fieldset className="rule-field" key={index}>
                  <legend>{label}</legend>
                  <label>
                    Field name
                    <Input
                      aria-label={`${prefix} field name ${index + 1}`}
                      value={name}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = event.target.value
                        if (
                          (next !== name &&
                            Object.hasOwn(schema.properties ?? {}, next)) ||
                          ['__proto__', 'prototype', 'constructor'].includes(
                            next,
                          )
                        ) {
                          onError(
                            'Choose a unique field name. Reserved names cannot be used.',
                          )
                          return
                        }
                        onChange({
                          ...schema,
                          properties: Object.fromEntries(
                            Object.entries(schema.properties ?? {}).map(
                              ([key, item]) => [
                                key === name ? next : key,
                                item,
                              ],
                            ),
                          ),
                          required: schema.required?.map((key) =>
                            key === name ? next : key,
                          ),
                        })
                      }}
                    />
                  </label>
                  <label className="rule-check">
                    <Checkbox
                      checked={schema.required?.includes(name) ?? false}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...schema,
                          required: checked
                            ? [...(schema.required ?? []), name]
                            : (schema.required ?? []).filter(
                                (key) => key !== name,
                              ),
                        })
                      }
                    />
                    {label} required
                  </label>
                  <SchemaEditor
                    schema={property}
                    prefix={label}
                    disabled={disabled}
                    query={query}
                    onChange={updateProperty}
                    onError={onError}
                  />
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...schema,
                        properties: Object.fromEntries(
                          Object.entries(schema.properties ?? {}).filter(
                            ([key]) => key !== name,
                          ),
                        ),
                        required: schema.required?.filter(
                          (key) => key !== name,
                        ),
                      })
                    }
                  >
                    Remove {label}
                  </Button>
                </fieldset>
              )
            },
          )}
          <Button
            variant="outline"
            disabled={
              disabled || Object.keys(schema.properties ?? {}).length >= 64
            }
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
            Add {prefix} field
          </Button>
        </>
      ) : schema.type === 'array' ? (
        <fieldset className="rule-field">
          <legend>{prefix} item rules</legend>
          <SchemaEditor
            schema={schema.items}
            prefix={`${prefix} item`}
            disabled={disabled}
            onChange={(items) => onChange({ ...schema, items })}
            onError={onError}
          />
        </fieldset>
      ) : null}
    </div>
  )
}

export function ApiRules() {
  const [expanded, setExpanded] = useState(false)
  const state = useStudio()
  const disabled = !can(state.member, 'flows.write') || state.busy
  const pathNames = routeParameters(state.path)
  const sections = [
    { key: 'query', prefix: 'Query', label: 'Validate query parameters' },
    { key: 'body', prefix: 'Body', label: 'Validate request body' },
    { key: 'response', prefix: 'Response', label: 'Validate response' },
  ] as const

  return (
    <section className="api-rules">
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        API rules
      </Button>
      {expanded ? (
        <>
          <p>
            Choose which request and response values your REST API accepts.
            Rules are optional.
          </p>
          <p>
            Required fields must be present. Allow null permits an explicit
            empty value. GET and HEAD have no request body. Saving changes the
            draft; publish to update callers.
          </p>
          <div className="api-rule-groups">
            <div className="api-rule-group">
              <label className="rule-check">
                <Checkbox
                  checked={!!state.contract?.params}
                  disabled={
                    disabled || (!pathNames.length && !state.contract?.params)
                  }
                  onCheckedChange={(checked) => {
                    if (
                      !checked &&
                      !confirm('Remove path parameter rules from this draft?')
                    )
                      return
                    state.edit({
                      contract: {
                        ...state.contract,
                        params: checked
                          ? {
                              type: 'object',
                              properties: Object.fromEntries(
                                pathNames.map((name) => [
                                  name,
                                  { type: 'string' },
                                ]),
                              ),
                              required: pathNames,
                              additionalProperties: false,
                            }
                          : undefined,
                      },
                    })
                  }}
                />
                Validate path parameters
              </label>
              <p>
                Names come from the endpoint path. Every path parameter is
                required and accepts a scalar value.
              </p>
              {!pathNames.length ? (
                <p>Add a route segment such as :id to configure path rules.</p>
              ) : null}
              {state.contract?.params?.type === 'object'
                ? Object.entries(state.contract.params.properties ?? {}).map(
                    ([name, schema]) => (
                      <fieldset className="rule-field" key={name}>
                        <legend>Path parameter {name} · required</legend>
                        <SchemaEditor
                          schema={schema}
                          prefix={`Path ${name}`}
                          query
                          disabled={disabled}
                          onChange={(value) =>
                            state.edit({
                              contract: {
                                ...state.contract,
                                params: {
                                  ...state.contract!.params!,
                                  type: 'object',
                                  properties: {
                                    ...(state.contract!.params!.type ===
                                    'object'
                                      ? state.contract!.params!.properties
                                      : {}),
                                    [name]: value,
                                  },
                                },
                              },
                            })
                          }
                          onError={(message) => state.message(message, true)}
                        />
                      </fieldset>
                    ),
                  )
                : null}
              {state.contract?.params?.type === 'object' &&
              (pathNames.length !==
                Object.keys(state.contract.params.properties ?? {}).length ||
                pathNames.some(
                  (name) =>
                    !Object.hasOwn(
                      state.contract!.params!.type === 'object'
                        ? (state.contract!.params!.properties ?? {})
                        : {},
                      name,
                    ),
                )) ? (
                <p role="alert">
                  Path rules no longer match this route. Remove and enable path
                  rules again to use its current names.
                </p>
              ) : null}
            </div>
            {sections.map(({ key, prefix, label }) => {
              const schema = state.contract?.[key]
              const bodyUnavailable =
                key === 'body' && ['GET', 'HEAD'].includes(state.method)
              return (
                <div className="api-rule-group" key={key}>
                  <label className="rule-check">
                    <Checkbox
                      checked={!!schema}
                      disabled={disabled || bodyUnavailable}
                      onCheckedChange={(checked) => {
                        if (
                          !checked &&
                          schema &&
                          !confirm(
                            `Remove ${prefix.toLowerCase()} rules? This removes the configured shape from this draft.`,
                          )
                        )
                          return
                        const contract = {
                          ...state.contract,
                          [key]: checked ? newSchema('object') : undefined,
                        }
                        state.edit({
                          contract: Object.values(contract).some(Boolean)
                            ? contract
                            : undefined,
                        })
                      }}
                    />
                    {label}
                  </label>
                  {bodyUnavailable ? (
                    <p>{state.method} requests have no body rules.</p>
                  ) : null}
                  {schema ? (
                    <SchemaEditor
                      schema={schema}
                      prefix={prefix}
                      disabled={disabled || bodyUnavailable}
                      query={key === 'query'}
                      root
                      onChange={(value) =>
                        state.edit({
                          contract: { ...state.contract, [key]: value },
                        })
                      }
                      onError={(message) => state.message(message, true)}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}

export function OpenApiDownload() {
  const state = useStudio()
  const [source, setSource] = useState('published')
  const saved = state.flows.find((flow) => flow.id === state.id)
  const available =
    source === 'draft'
      ? !!saved && !saved.graphql
      : !!saved?.publishedEndpoint && !saved.publishedEndpoint.graphql

  if (
    state.graphql &&
    (!saved?.publishedEndpoint || saved.publishedEndpoint.graphql)
  )
    return null

  return (
    <div className="openapi-download">
      <div>
        <label htmlFor="openapi-source">OpenAPI document</label>
        <Select
          id="openapi-source"
          label="OpenAPI source"
          value={source}
          disabled={state.busy}
          onValueChange={setSource}
          options={[
            {
              value: 'published',
              label: saved?.publishedRevision
                ? `Published release · v${saved.publishedRevision}`
                : 'Published release · not published',
            },
            {
              value: 'draft',
              label: saved
                ? `Saved draft · revision ${saved.revision}`
                : 'Saved draft · not saved',
            },
          ]}
        />
      </div>
      <Button
        variant="outline"
        disabled={state.busy || !available}
        onClick={() =>
          void state.task(async () => {
            if (!saved || !available) return
            const specification = await api<unknown>(
              `/api/flows/${saved.id}/openapi?source=${source}`,
              state.token,
            )
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(specification, null, 2)], {
                type: 'application/json',
              }),
            )
            const link = document.createElement('a')
            link.href = url
            link.download = `besh-${source}-${source === 'published' ? saved.publishedRevision : saved.revision}.openapi.json`
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 0)
            state.message(
              `${source === 'published' ? 'Published release' : 'Saved draft'} OpenAPI downloaded.`,
            )
          })
        }
      >
        <Download />
        Download OpenAPI
      </Button>
      <p>
        {!saved
          ? 'Save this REST API to download its document.'
          : !available
            ? source === 'published' && !saved.publishedRevision
              ? 'Publish this API to download its release document.'
              : 'This saved version uses GraphQL. OpenAPI documents describe REST APIs.'
            : state.dirty
              ? 'Downloads use saved versions. Save your draft to include current edits.'
              : 'Choose a saved draft or an immutable published release. Published documents describe the live endpoint.'}
      </p>
    </div>
  )
}
