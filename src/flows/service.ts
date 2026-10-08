import { ApiError } from '../errors'
import type { Store, RuntimeKey } from '../store'
import { assertJsonLimit, executeFlow, validateFlow } from './engine'
import { flowSchema, type Flow, type FlowInput } from './model'
import { executeGraphql, graphqlSchema } from './graphql'
import type { dataSourceService } from '../data-sources'
import { flowOpenapi } from './openapi'
import type { productAuthService } from '../product-auth'

type Row = {
  id: string
  definition: string
  revision: number
  published: string | null
  published_revision: number | null
}

export function flowService(
  store: Store,
  sources: Pick<ReturnType<typeof dataSourceService>, 'validate' | 'read'>,
  productAuth: Pick<
    ReturnType<typeof productAuthService>,
    'validate' | 'social'
  >,
) {
  const { db, query, audit } = store

  function get(id: string) {
    const row = query<Row, [string]>('SELECT * FROM flows WHERE id = ?').get(id)

    if (!row) throw new ApiError(404, 'Flow not found')

    return row
  }

  function draft(value: unknown) {
    try {
      assertJsonLimit(value)
    } catch {
      throw new ApiError(400, 'Flow size or nesting limit exceeded')
    }
    const result = flowSchema.safeParse(value)

    if (!result.success) throw new ApiError(400, 'Invalid flow definition')

    return result.data
  }

  function valid(value: unknown) {
    try {
      const flow = validateFlow(value)
      if (flow.graphql) graphqlSchema(flow)
      sources.validate(flow)
      productAuth.validate(flow)
      return flow
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message.slice(0, 180) : 'Invalid flow',
      )
    }
  }

  function present(row: Row) {
    const published = row.published ? (JSON.parse(row.published) as Flow) : null
    return {
      ...(JSON.parse(row.definition) as Flow),
      id: row.id,
      revision: row.revision,
      publishedRevision: row.published_revision,
      publishedEndpoint: published
        ? {
            method: published.method,
            path: published.path,
            graphql: Boolean(published.graphql),
          }
        : null,
    }
  }

  async function execute(
    actor: string,
    id: string,
    definition: unknown,
    input: FlowInput,
    revision: number,
  ) {
    try {
      return await executeFlow(definition, input, {
        readData: sources.read,
        social: (config, input) =>
          productAuth.social(config, input, {
            flowId: id,
            revision,
            scope: actor,
          }),
      })
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 400 || error.status === 500)
      )
        audit(actor, 'flow.validation-failed', id)
      throw error
    }
  }

  return {
    list() {
      return query<Row, []>('SELECT * FROM flows ORDER BY rowid DESC')
        .all()
        .map(present)
    },
    get(id: string) {
      return present(get(id))
    },
    openapi(id: string, source: unknown) {
      if (source !== undefined && source !== 'draft' && source !== 'published')
        throw new ApiError(400, 'Choose draft or published OpenAPI source')
      const selected = source ?? 'published'
      const row = get(id)
      if (selected === 'published' && !row.published)
        throw new ApiError(404, 'This API has no published release')
      const definition = selected === 'draft' ? row.definition : row.published!
      const flow = draft(JSON.parse(definition))
      if (flow.graphql)
        throw new ApiError(400, 'OpenAPI is available for REST APIs only')
      return flowOpenapi(
        flow,
        row.id,
        selected === 'draft' ? row.revision : row.published_revision!,
        selected,
      )
    },
    create(actor: string, value: unknown) {
      const definition = draft(value)
      const id = crypto.randomUUID()

      db.transaction(() => {
        query(
          'INSERT INTO flows (id, definition, revision) VALUES (?, ?, 1)',
        ).run(id, JSON.stringify(definition))
        audit(actor, 'flow.created', id)
      })()

      return present(get(id))
    },
    update(actor: string, id: string, revision: number, value: unknown) {
      const definition = draft(value)

      db.transaction(() => {
        get(id)
        const change = query(
          'UPDATE flows SET definition = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
        ).run(JSON.stringify(definition), id, revision)
        if (!change.changes)
          throw new ApiError(409, 'Draft changed. Reload before saving.')
        audit(actor, 'flow.updated', id)
      })()

      return present(get(id))
    },
    publish(actor: string, id: string, revision: number) {
      db.transaction(() => {
        const row = get(id)
        if (row.revision !== revision)
          throw new ApiError(409, 'Draft changed. Reload before publishing.')

        const definition = valid(JSON.parse(row.definition))
        const conflict = query(
          "SELECT id FROM flows WHERE id != ? AND json_extract(published, '$.method') = ? AND json_extract(published, '$.path') = ? AND (json_extract(published, '$.graphql') IS NOT NULL) = ?",
        ).get(
          id,
          definition.method,
          definition.path,
          definition.graphql ? 1 : 0,
        )
        if (conflict)
          throw new ApiError(409, 'This method and path are already published')

        query('INSERT OR IGNORE INTO releases VALUES (?, ?, ?, ?)').run(
          id,
          revision,
          row.definition,
          new Date().toISOString(),
        )
        query(
          'UPDATE flows SET published = definition, published_revision = revision WHERE id = ?',
        ).run(id)
        audit(actor, 'flow.published', id)
      })()

      return present(get(id))
    },
    async test(actor: string, id: string, input: FlowInput) {
      const row = get(id)
      const definition = valid(JSON.parse(row.definition))
      if (definition.graphql)
        throw new ApiError(400, 'Use the GraphQL test endpoint')
      const result = await execute(actor, id, definition, input, row.revision)
      audit(actor, 'flow.tested', id)
      return result
    },
    async testGraphql(actor: string, id: string, input: unknown) {
      const row = get(id)
      const definition = valid(JSON.parse(row.definition))
      if (!definition.graphql)
        throw new ApiError(400, 'This API does not have a GraphQL schema')
      const result = await executeGraphql(definition, input, undefined, {
        readData: sources.read,
        social: (config, input) =>
          productAuth.social(config, input, {
            flowId: id,
            revision: row.revision,
            scope: actor,
          }),
      })
      audit(actor, 'graphql.tested', id)
      return result
    },
    async run(key: RuntimeKey, method: string, path: string, input: FlowInput) {
      const row = query<Row, [string, string]>(
        "SELECT * FROM flows WHERE json_extract(published, '$.method') = ? AND json_extract(published, '$.path') = ? AND json_extract(published, '$.graphql') IS NULL",
      ).get(method, path)
      if (!row?.published) throw new ApiError(404, 'Endpoint not found')
      if (row.id !== key.flowId || !key.permissions.includes('rest'))
        throw new ApiError(403, 'Runtime key does not allow this endpoint')

      const result = await execute(
        `runtime:${key.id}`,
        row.id,
        JSON.parse(row.published),
        input,
        row.published_revision!,
      )
      audit(`runtime:${key.id}`, 'flow.executed', row.id)
      return result
    },
    async graphql(key: RuntimeKey, path: string, input: unknown) {
      const row = query<Row, [string]>(
        "SELECT * FROM flows WHERE json_extract(published, '$.path') = ? AND json_extract(published, '$.graphql') IS NOT NULL",
      ).get(path)
      if (!row?.published) throw new ApiError(404, 'Endpoint not found')
      if (row.id !== key.flowId || key.permissions.includes('rest'))
        throw new ApiError(403, 'Runtime key does not allow this endpoint')

      const result = await executeGraphql(
        JSON.parse(row.published),
        input,
        key.permissions,
        {
          readData: sources.read,
          social: (config, input) =>
            productAuth.social(config, input, {
              flowId: row.id,
              revision: row.published_revision!,
              scope: `runtime:${key.id}`,
            }),
        },
      )
      if (result.visited.length)
        audit(`runtime:${key.id}`, 'graphql.executed', row.id)
      return result
    },
  }
}
