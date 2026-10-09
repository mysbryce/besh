import { useEffect, useRef, useState } from 'react'
import type { ApiSchema } from '../src/flows/contracts'
import type { DataColumn } from '../src/data/sources'
import type {
  DependencyDatabase,
  DependencySource,
} from '../src/workspace/dependency-model'
import { can } from '../src/workspace/permissions'
import { canReadDependencyStructure } from './dependency-access'
import { api } from './lib/api'
import { useStudio, type CanvasNode } from './store'
import { Button } from './components/ui/button'
import { Select } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'

type Read = CanvasNode & { data: { kind: 'data' | 'database' } }
type Review = {
  scope: string
  fields: DataColumn[]
  names: string[]
  schema: ApiSchema
  graphql?: string
  arguments?: ReplyArgument[]
}
type ReplyArgument = {
  name: string
  type: 'String' | 'Float' | 'Int' | 'Boolean' | 'ID'
  required: boolean
}

function graphqlReply(fields: DataColumn[], argumentsList: ReplyArgument[]) {
  const names = { string: 'String', number: 'Float', boolean: 'Boolean' }
  const argumentsText = argumentsList
    .map(
      (argument) =>
        `${argument.name}: ${argument.type}${argument.required ? '!' : ''}`,
    )
    .join(', ')
  return `type Query { rows${argumentsText ? `(${argumentsText})` : ''}: [ProtectedReadRow!]! }\ntype ProtectedReadRow { ${fields.map((field) => `${field.key}: ${names[field.type]}${field.nullable ? '' : '!'}`).join(' ')} }`
}

function graphScope() {
  const state = useStudio.getState()
  return JSON.stringify([
    state.editorSession,
    state.sessionId,
    state.member,
    state.token,
    state.graphql,
    state.websocket,
    state.contract,
    state.nodes.map(({ id, data }) => ({ id, data })),
    state.edges.map(({ source, target, sourceHandle }) => ({
      source,
      target,
      sourceHandle,
    })),
  ])
}

function lastReads(responseId: string): Read[] {
  const state = useStudio.getState()
  const request = state.nodes.filter((node) => node.data.kind === 'request')
  if (request.length !== 1)
    throw new Error('Keep one request before reviewing the reply.')
  const reads = new Map<string, Read>()
  let visits = 0
  function visit(id: string, last: Read | null, path: Set<string>) {
    if (++visits > 256)
      throw new Error(
        'Simplify the connected paths before reviewing reply fields.',
      )
    if (path.has(id))
      throw new Error('Remove graph cycles before reviewing the reply.')
    const node = state.nodes.find((item) => item.id === id)
    if (!node)
      throw new Error('Reconnect missing steps before reviewing the reply.')
    const nextPath = new Set(path).add(id)
    if (node.data.kind === 'data' || node.data.kind === 'database')
      last = node as Read
    if (node.data.kind === 'response') {
      if (node.id !== responseId || !last)
        throw new Error(
          'Every path must reach this response after a data read.',
        )
      reads.set(last.id, last)
      return
    }
    if (node.data.kind === 'social')
      throw new Error(
        'This reply helper supports data reads and input conditions only.',
      )
    const edges = state.edges.filter((edge) => edge.source === id)
    if (
      !edges.length ||
      (node.data.kind === 'condition' &&
        !['true', 'false'].every((handle) =>
          edges.some((edge) => edge.sourceHandle === handle),
        ))
    )
      throw new Error(
        'Connect every path, including both condition branches, before reviewing the reply.',
      )
    for (const edge of edges) visit(edge.target, last, nextPath)
  }
  visit(request[0]!.id, null, new Set())
  return [...reads.values()]
}

export function LastReadReply({ responseId }: { responseId: string }) {
  const state = useStudio()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const scope = graphScope()
  const disabled = state.busy || !can(state.member, 'flows.write')
  const currentReview = review?.scope === scope ? review : null

  async function inspect() {
    if (disabled || loading) return
    const sequence = ++request.current
    const expected = graphScope()
    const current = () =>
      active.current &&
      sequence === request.current &&
      graphScope() === expected
    setLoading(true)
    setReview(null)
    setError('')
    try {
      if (state.graphql) {
        for (const node of state.nodes) {
          const config = node.data.config
          const reference =
            node.data.kind === 'condition' && 'field' in config
              ? config.field
              : 'filter' in config &&
                  typeof config.filter?.value === 'string' &&
                  config.filter.value.startsWith('$input.')
                ? config.filter.value.slice('$input.'.length)
                : null
          if (reference && !/^body\.[_A-Za-z][_0-9A-Za-z]*$/.test(reference))
            throw new Error(
              'GraphQL arguments use request body fields. Explicitly choose a simple request body field in each condition and read form; query, path and nested references are not remapped.',
            )
        }
      }
      const reads = lastReads(responseId)
      const needsSources = state.nodes.some((node) => node.data.kind === 'data')
      const needsCopies = state.nodes.some(
        (node) => node.data.kind === 'database',
      )
      if (
        (needsSources &&
          !canReadDependencyStructure(state.member, 'sources.read')) ||
        (needsCopies &&
          !canReadDependencyStructure(
            state.member,
            'database-connections.read',
          ))
      )
        throw new Error(
          'Source or SQLite structure access is needed to review the reply fields.',
        )
      const [sources, copies] = await Promise.all([
        needsSources
          ? api<DependencySource[]>('/api/dependencies/sources', state.token)
          : Promise.resolve([]),
        needsCopies
          ? api<DependencyDatabase[]>(
              '/api/dependencies/database-connections',
              state.token,
            )
          : Promise.resolve([]),
      ])
      if (!current()) return
      const selected = reads.map((read) => {
        const config = read.data.config
        if (!('columns' in config) || !config.columns.length)
          throw new Error('Choose returned fields in each final read.')
        const source =
          'sourceId' in config
            ? sources.find((item) => item.id === config.sourceId)
            : null
        const copy =
          'connectionId' in config
            ? copies.find((item) => item.id === config.connectionId)
            : null
        const table =
          copy && 'table' in config
            ? copy.tables.find((item) => item.name === config.table)
            : null
        const columns = source?.columns ?? table?.columns
        if (!columns)
          throw new Error(
            'A final read is no longer available. Review its resource and table.',
          )
        const fields = config.columns.map((key) => {
          const column = columns.find((item) => item.key === key)
          if (!column)
            throw new Error(
              'A returned field changed. Review the final read before generating rules.',
            )
          return column
        })
        return {
          fields,
          name: source?.name ?? `${copy!.name} · ${table!.name}`,
          limit: config.limit,
        }
      })
      const fields = selected[0]!.fields.map((field) => ({ ...field }))
      for (const read of selected) {
        if (
          read.fields.length !== fields.length ||
          read.fields.some(
            (field) =>
              !fields.some(
                (item) => item.key === field.key && item.type === field.type,
              ),
          )
        )
          throw new Error(
            'Every possible final read must return the same field names and types. Review those read steps first.',
          )
        for (const field of fields)
          field.nullable ||= read.fields.find(
            (item) => item.key === field.key,
          )!.nullable
      }
      const limit = Math.max(...selected.map((read) => read.limit))
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new Error('Set each final read limit between 1 and 100 rows.')
      const schema: ApiSchema = {
        type: 'array',
        maxItems: limit,
        items: {
          type: 'object',
          additionalProperties: false,
          required: fields.map((field) => field.key),
          properties: Object.fromEntries(
            fields.map((field) => [
              field.key,
              { type: field.type, nullable: field.nullable },
            ]),
          ),
        },
      }
      let graphql: string | undefined
      let argumentsList: ReplyArgument[] | undefined
      if (state.graphql) {
        if (
          fields.some(
            (field) =>
              !/^[_A-Za-z][_0-9A-Za-z]*$/.test(field.key) ||
              field.key.startsWith('__'),
          )
        )
          throw new Error(
            'GraphQL field names must be safe identifiers. Review mapped fields before generating the reply.',
          )
        const argumentsByName = new Map<string, ReplyArgument>()
        function declare(reference: string, type: ReplyArgument['type']) {
          const name = reference.slice('body.'.length)
          if (name.startsWith('__'))
            throw new Error(
              'Choose a business argument name without the reserved __ prefix.',
            )
          const previous = argumentsByName.get(name)
          if (previous && previous.type !== type)
            throw new Error(
              'One business argument is used with different types. Review its condition and read references before generating the schema.',
            )
          argumentsByName.set(name, { name, type, required: true })
        }
        for (const node of state.nodes) {
          const config = node.data.config
          if (
            node.data.kind === 'condition' &&
            'field' in config &&
            'equals' in config
          )
            declare(
              config.field,
              typeof config.equals === 'boolean'
                ? 'Boolean'
                : typeof config.equals === 'number'
                  ? 'Float'
                  : 'String',
            )
          if (
            'filter' in config &&
            typeof config.filter?.value === 'string' &&
            config.filter.value.startsWith('$input.body.')
          ) {
            const source =
              'sourceId' in config
                ? sources.find((item) => item.id === config.sourceId)
                : null
            const copy =
              'connectionId' in config
                ? copies.find((item) => item.id === config.connectionId)
                : null
            const columns =
              source?.columns ??
              (copy && 'table' in config
                ? copy.tables.find((item) => item.name === config.table)
                    ?.columns
                : undefined)
            const column = columns?.find(
              (item) => item.key === config.filter!.column,
            )
            if (!column)
              throw new Error(
                'Review the filtered field before generating business arguments.',
              )
            declare(
              config.filter.value.slice('$input.'.length),
              column.type === 'boolean'
                ? 'Boolean'
                : column.type === 'number'
                  ? 'Float'
                  : 'String',
            )
          }
        }
        argumentsList = [...argumentsByName.values()]
        if (argumentsList.length > 64)
          throw new Error('Use at most 64 flat business arguments.')
        graphql = graphqlReply(fields, argumentsList)
      }
      setReview({
        scope: expected,
        fields,
        names: selected.map((read) => read.name),
        schema,
        graphql,
        arguments: argumentsList,
      })
    } catch (reason) {
      if (current())
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not review reply fields.',
        )
    } finally {
      if (active.current && sequence === request.current) setLoading(false)
    }
  }

  return (
    <section className="simple-form" aria-label="Last-read reply rules">
      <Button
        variant="outline"
        disabled={disabled || loading}
        onClick={() => void inspect()}
      >
        {loading ? 'Reviewing reply fields…' : 'Use last read fields'}
      </Button>
      <p>
        Each data step replaces the earlier rows. This reply returns only the
        last read on the chosen path; it does not combine data.
      </p>
      <p>
        Protected REST and GraphQL graphs can use up to four reads and three
        input conditions. Every path needs a read, and every resource on every
        branch must allow the same trusted tenant. WebSocket reads remain a
        single read without conditions.
      </p>
      {error ? (
        <p role="alert">{error} Correct the read steps, then review again.</p>
      ) : null}
      {currentReview ? (
        <section className="simple-form" aria-label="Review last-read reply">
          <h4>Review last-read reply</h4>
          <p>Possible final reads: {currentReview.names.join('; ')}.</p>
          <p>
            List of rows · Maximum{' '}
            {currentReview.schema.type === 'array'
              ? currentReview.schema.maxItems
              : 0}{' '}
            · Every row includes these fields:
          </p>
          <ul>
            {currentReview.fields.map((field) => (
              <li key={field.key}>
                {field.label} ·{' '}
                {field.type === 'string'
                  ? 'Text'
                  : field.type === 'number'
                    ? 'Number'
                    : 'True or false'}
                {field.nullable ? ' · Empty cells allowed' : ''} · API field:{' '}
                {field.key}
              </li>
            ))}
          </ul>
          {currentReview.arguments?.length ? (
            <>
              <h4>Business arguments</h4>
              <p>
                These names come from your explicit request body references.
                Review their types and whether a caller must supply them.
                Arguments cannot choose the protected tenant.
              </p>
              {currentReview.arguments.map((argument) => (
                <div className="simple-form" key={argument.name}>
                  <label>
                    Argument {argument.name} type
                    <Select
                      label={`Reply argument ${argument.name} type`}
                      value={argument.type}
                      disabled={disabled}
                      options={[
                        { value: 'String', label: 'Text' },
                        { value: 'Float', label: 'Number' },
                        { value: 'Int', label: 'Whole number' },
                        { value: 'Boolean', label: 'True or false' },
                        { value: 'ID', label: 'Text identifier' },
                      ]}
                      onValueChange={(value) => {
                        const argumentsList = currentReview.arguments!.map(
                          (item) =>
                            item.name === argument.name
                              ? {
                                  ...item,
                                  type: value as ReplyArgument['type'],
                                }
                              : item,
                        )
                        setReview({
                          ...currentReview,
                          arguments: argumentsList,
                          graphql: graphqlReply(
                            currentReview.fields,
                            argumentsList,
                          ),
                        })
                      }}
                    />
                  </label>
                  <label className="permission-option">
                    <Checkbox
                      aria-label={`Require argument ${argument.name}`}
                      checked={argument.required}
                      disabled={disabled}
                      onCheckedChange={(checked) => {
                        const argumentsList = currentReview.arguments!.map(
                          (item) =>
                            item.name === argument.name
                              ? { ...item, required: checked === true }
                              : item,
                        )
                        setReview({
                          ...currentReview,
                          arguments: argumentsList,
                          graphql: graphqlReply(
                            currentReview.fields,
                            argumentsList,
                          ),
                        })
                      }}
                    />
                    Require {argument.name}
                  </label>
                </div>
              ))}
            </>
          ) : null}
          <p>
            {currentReview.graphql
              ? 'Replace this draft’s GraphQL schema with a flat Query.rows reply. Existing operations and arguments must be reviewed again.'
              : 'Replace this draft’s response rules. Request rules stay unchanged.'}{' '}
            Return status 200 with the final data rows. Saving does not change
            the published API. Resource and tenant field policies still apply to
            every read, including other branches.
          </p>
          <Button
            disabled={disabled}
            onClick={() => {
              if (graphScope() !== currentReview.scope) return
              state.edit(
                currentReview.graphql
                  ? {
                      graphql: { schema: currentReview.graphql },
                      contract: undefined,
                    }
                  : {
                      contract: {
                        ...state.contract,
                        response: currentReview.schema,
                      },
                    },
              )
              state.configure(responseId, { status: 200, body: '$data' })
              setReview(null)
              state.message(
                'Last-read reply rules applied. Save and test the draft before publishing.',
              )
            }}
          >
            Apply last-read reply
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => setReview(null)}
          >
            Cancel reply review
          </Button>
        </section>
      ) : null}
    </section>
  )
}
