import { ApiError } from '../errors'
import type { Store, RuntimeKey } from '../workspace/store'
import { assertJsonLimit, executeFlow, validateFlow } from './engine'
import { flowSchema, type Flow, type FlowInput } from './model'
import { executeGraphql, graphqlSchema } from './graphql'
import type { dataSourceService } from '../data/sources'
import { flowOpenapi } from './openapi'
import type { productAuthService } from '../auth/product'
import { decodedRoute, matchRoute, overlappingRoutes } from './routes'
import type { databaseConnectionService } from '../databases/service'

type Row = {
  id: string
  definition: string
  revision: number
  published: string | null
  published_revision: number | null
}

type ReleaseRow = { revision: number; definition: string; created_at: string }

export function flowService(
  store: Store,
  sources: Pick<ReturnType<typeof dataSourceService>, 'validate' | 'read'>,
  productAuth: Pick<
    ReturnType<typeof productAuthService>,
    'validate' | 'social'
  >,
  databases: Pick<
    ReturnType<typeof databaseConnectionService>,
    'validate' | 'read'
  >,
) {
  const { db, query, audit } = store
  let closed = false
  function active() {
    if (closed) throw new ApiError(503, 'Flow executor is shutting down')
  }

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
      databases.validate(flow)
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

  function routeAvailable(id: string, definition: Flow) {
    const candidates = query<Row, [string, string]>(
      "SELECT * FROM flows WHERE id != ? AND json_extract(published, '$.method') = ?",
    ).all(id, definition.method)
    if (
      candidates.some((row) => {
        const published = JSON.parse(row.published!) as Flow
        return (
          Boolean(published.graphql) === Boolean(definition.graphql) &&
          (definition.graphql
            ? definition.path === published.path
            : overlappingRoutes(definition.path, published.path))
        )
      })
    )
      throw new ApiError(
        409,
        'This method and path overlap an already published endpoint',
      )
  }

  function release(id: string, revision: number) {
    const row = query<ReleaseRow, [string, number]>(
      'SELECT * FROM releases WHERE flow_id = ? AND revision = ?',
    ).get(id, revision)
    if (!row) throw new ApiError(404, 'Release not found')
    return row
  }

  function publicationUnlocked(id: string) {
    if (
      query(
        "SELECT id FROM load_tests WHERE status = 'running' AND json_extract(metadata, '$.flowId') = ?",
      ).get(id)
    )
      throw new ApiError(
        409,
        'Wait for this API load test to finish before changing its published release',
      )
  }

  async function execute(
    actor: string,
    id: string,
    definition: unknown,
    input: FlowInput,
    revision: number,
    signal?: AbortSignal,
  ) {
    try {
      return await executeFlow(definition, input, {
        readData: sources.read,
        readDatabase: (config) => databases.read(config, signal),
        social: (config, input) =>
          productAuth.social(config, input, {
            flowId: id,
            revision,
            scope: actor,
          }),
      })
    } catch (error) {
      if (
        !closed &&
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
    releases(id: string) {
      const flow = get(id)
      return query<ReleaseRow, [string]>(
        'SELECT * FROM releases WHERE flow_id = ? ORDER BY revision DESC',
      )
        .all(id)
        .map((row) => {
          const definition = JSON.parse(row.definition) as Flow
          return {
            revision: row.revision,
            createdAt: row.created_at,
            endpoint: {
              method: definition.method,
              path: definition.path,
              graphql: Boolean(definition.graphql),
            },
            current: row.revision === flow.published_revision,
          }
        })
    },
    release(id: string, revision: number) {
      const flow = get(id)
      const row = release(id, revision)
      return {
        revision: row.revision,
        createdAt: row.created_at,
        definition: JSON.parse(row.definition) as Flow,
        current: row.revision === flow.published_revision,
      }
    },
    rollback(
      actor: string,
      id: string,
      revision: number,
      publishedRevision: number,
    ) {
      db.transaction(() => {
        const row = get(id)
        if (row.published_revision !== publishedRevision)
          throw new ApiError(
            409,
            'Published release changed. Reload before rolling back.',
          )
        if (revision === publishedRevision)
          throw new ApiError(409, 'This release is already published')
        publicationUnlocked(id)
        const target = release(id, revision)
        const definition = valid(JSON.parse(target.definition))
        routeAvailable(id, definition)
        query(
          'UPDATE flows SET published = ?, published_revision = ? WHERE id = ?',
        ).run(target.definition, revision, id)
        audit(actor, 'flow.rolled-back', id)
      }).immediate()
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
        publicationUnlocked(id)
        if (row.revision !== revision)
          throw new ApiError(409, 'Draft changed. Reload before publishing.')

        const definition = valid(JSON.parse(row.definition))
        routeAvailable(id, definition)

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
      }).immediate()

      return present(get(id))
    },
    async test(
      actor: string,
      id: string,
      input: FlowInput,
      signal?: AbortSignal,
    ) {
      const row = get(id)
      const definition = valid(JSON.parse(row.definition))
      if (definition.graphql)
        throw new ApiError(400, 'Use the GraphQL test endpoint')
      const result = await execute(
        actor,
        id,
        definition,
        input,
        row.revision,
        signal,
      )
      active()
      audit(actor, 'flow.tested', id)
      return result
    },
    async testGraphql(
      actor: string,
      id: string,
      input: unknown,
      signal?: AbortSignal,
    ) {
      const row = get(id)
      const definition = valid(JSON.parse(row.definition))
      if (!definition.graphql)
        throw new ApiError(400, 'This API does not have a GraphQL schema')
      const result = await executeGraphql(definition, input, undefined, {
        readData: sources.read,
        readDatabase: (config) => databases.read(config, signal),
        social: (config, input) =>
          productAuth.social(config, input, {
            flowId: id,
            revision: row.revision,
            scope: actor,
          }),
      })
      active()
      audit(actor, 'graphql.tested', id)
      return result
    },
    async run(
      key: RuntimeKey,
      method: string,
      path: string,
      input: FlowInput,
      signal?: AbortSignal,
    ) {
      const segments = decodedRoute(path)
      const row = query<Row, [string]>(
        "SELECT * FROM flows WHERE json_extract(published, '$.method') = ? AND json_extract(published, '$.graphql') IS NULL",
      )
        .all(method)
        .find(
          (candidate) =>
            matchRoute(JSON.parse(candidate.published!).path, segments) !==
            null,
        )
      if (!row?.published) throw new ApiError(404, 'Endpoint not found')
      if (row.id !== key.flowId || !key.permissions.includes('rest'))
        throw new ApiError(403, 'Runtime key does not allow this endpoint')

      const result = await execute(
        `runtime:${key.id}`,
        row.id,
        JSON.parse(row.published),
        {
          ...input,
          params: matchRoute(JSON.parse(row.published).path, segments)!,
        },
        row.published_revision!,
        signal,
      )
      active()
      audit(`runtime:${key.id}`, 'flow.executed', row.id)
      return result
    },
    async graphql(
      key: RuntimeKey,
      path: string,
      input: unknown,
      signal?: AbortSignal,
    ) {
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
          readDatabase: (config) => databases.read(config, signal),
          social: (config, input) =>
            productAuth.social(config, input, {
              flowId: row.id,
              revision: row.published_revision!,
              scope: `runtime:${key.id}`,
            }),
        },
      )
      active()
      if (result.visited.length)
        audit(`runtime:${key.id}`, 'graphql.executed', row.id)
      return result
    },
    close() {
      closed = true
    },
  }
}
