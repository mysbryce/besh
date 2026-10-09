import { useEffect, useRef, useState } from 'react'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'

type Argument = {
  name: string
  type: string
  required: boolean
  supplied: boolean
  value: string
  values?: string[]
}
type QueryReview = {
  schema: string
  fields: string[]
  selected: string[]
  arguments: Argument[]
}

export function RowsQuery({
  schema,
  disabled,
  onUse,
}: {
  schema: string
  disabled: boolean
  onUse: (query: string) => void
}) {
  const [review, setReview] = useState<QueryReview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const active = useRef(true)
  const request = useRef(0)
  const liveSchema = useRef(schema)
  liveSchema.current = schema
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const current = review?.schema === schema ? review : null

  async function build() {
    if (disabled || loading) return
    const sequence = ++request.current
    setError('')
    setLoading(true)
    try {
      const gql = await import('graphql')
      const parsed = gql.buildASTSchema(gql.parse(schema, { maxTokens: 2_000 }))
      const rows = parsed.getQueryType()?.getFields().rows
      const row = rows && gql.getNamedType(rows.type)
      if (!rows || !row || !gql.isObjectType(row))
        throw new Error(
          'Review a flat Query.rows reply before building this query.',
        )
      const fields = Object.values(row.getFields())
      if (
        !fields.length ||
        fields.some(
          (field) =>
            field.args.length || !gql.isLeafType(gql.getNamedType(field.type)),
        )
      )
        throw new Error(
          'This query form supports flat reply fields without field arguments.',
        )
      const argumentsList = rows.args.map((argument): Argument => {
        const type = gql.getNamedType(argument.type)
        const plain = gql.isNonNullType(argument.type)
          ? argument.type.ofType
          : argument.type
        if (
          gql.isListType(plain) ||
          (!gql.isScalarType(type) && !gql.isEnumType(type))
        )
          throw new Error(
            'Nested arguments need a reviewed advanced operation.',
          )
        const values = gql.isEnumType(type)
          ? type.getValues().map((item) => item.name)
          : undefined
        const required =
          gql.isNonNullType(argument.type) &&
          argument.defaultValue === undefined
        return {
          name: argument.name,
          type: type.name,
          required,
          supplied: required,
          value:
            values?.[0] ??
            (type.name === 'Boolean'
              ? 'true'
              : ['Int', 'Float'].includes(type.name)
                ? '0'
                : ''),
          values,
        }
      })
      if (
        active.current &&
        sequence === request.current &&
        liveSchema.current === schema
      )
        setReview({
          schema,
          fields: fields.map((field) => field.name),
          selected: fields.map((field) => field.name),
          arguments: argumentsList,
        })
    } catch (reason) {
      if (
        active.current &&
        sequence === request.current &&
        liveSchema.current === schema
      )
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not build the rows query.',
        )
    } finally {
      if (active.current && sequence === request.current) setLoading(false)
    }
  }

  function argumentValue(argument: Argument) {
    if (argument.values) return argument.value
    if (argument.type === 'Boolean') return argument.value
    if (argument.type === 'Int' || argument.type === 'Float') {
      const value = Number(argument.value)
      if (
        !argument.value.trim() ||
        !Number.isFinite(value) ||
        (argument.type === 'Int' &&
          (!Number.isInteger(value) ||
            value < -2147483648 ||
            value > 2147483647))
      )
        throw new Error(
          `Enter a valid ${argument.type === 'Int' ? 'whole number' : 'number'} for ${argument.name}.`,
        )
      return String(value)
    }
    if (!['String', 'ID'].includes(argument.type))
      throw new Error('This argument type needs a reviewed advanced operation.')
    return JSON.stringify(argument.value)
  }

  function updateArgument(name: string, patch: Partial<Argument>) {
    if (current)
      setReview({
        ...current,
        arguments: current.arguments.map((argument) =>
          argument.name === name ? { ...argument, ...patch } : argument,
        ),
      })
  }

  return (
    <section className="simple-form" aria-label="Rows query builder">
      <Button
        variant="outline"
        disabled={disabled || loading}
        onClick={() => void build()}
      >
        {loading ? 'Reading query fields…' : 'Build rows query'}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      {current ? (
        <section className="simple-form" aria-label="Review rows query">
          <h3>Review rows query</h3>
          <p>
            One rows query. Business arguments enter the request body; they
            never choose the protected tenant. Selecting fewer reply fields does
            not permit blocked reads.
          </p>
          {current.arguments.map((argument) => (
            <div key={argument.name} className="simple-form">
              {!argument.required ? (
                <label className="permission-option">
                  <Checkbox
                    aria-label={`Supply argument ${argument.name}`}
                    checked={argument.supplied}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateArgument(argument.name, {
                        supplied: checked === true,
                      })
                    }
                  />
                  Supply {argument.name} (optional)
                </label>
              ) : null}
              <label>
                Argument {argument.name} · {argument.type}
                {argument.required ? ' · Required' : ''}
                {argument.values || argument.type === 'Boolean' ? (
                  <Select
                    label={`Argument ${argument.name}`}
                    value={argument.value}
                    disabled={disabled || !argument.supplied}
                    onValueChange={(value) =>
                      updateArgument(argument.name, { value })
                    }
                    options={(argument.values ?? ['true', 'false']).map(
                      (value) => ({ value, label: value }),
                    )}
                  />
                ) : (
                  <Input
                    aria-label={`Argument ${argument.name}`}
                    value={argument.value}
                    disabled={disabled || !argument.supplied}
                    onChange={(event) =>
                      updateArgument(argument.name, {
                        value: event.target.value,
                      })
                    }
                  />
                )}
              </label>
            </div>
          ))}
          {current.fields.map((field) => (
            <label className="permission-option" key={field}>
              <Checkbox
                aria-label={`Query reply field ${field}`}
                disabled={disabled}
                checked={current.selected.includes(field)}
                onCheckedChange={(checked) =>
                  setReview({
                    ...current,
                    selected: checked
                      ? [...current.selected, field]
                      : current.selected.filter((name) => name !== field),
                  })
                }
              />
              {field}
            </label>
          ))}
          <Button
            disabled={disabled || !current.selected.length}
            onClick={() => {
              if (liveSchema.current !== current.schema) return
              try {
                const values = current.arguments
                  .filter((argument) => argument.supplied)
                  .map(
                    (argument) =>
                      `${argument.name}: ${argumentValue(argument)}`,
                  )
                onUse(
                  `{ rows${values.length ? `(${values.join(', ')})` : ''} { ${current.selected.join(' ')} } }`,
                )
                setError('')
              } catch (reason) {
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'Check query arguments.',
                )
              }
            }}
          >
            Use rows query
          </Button>
        </section>
      ) : null}
    </section>
  )
}
