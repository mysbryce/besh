import { ApiError } from '../errors'
import type { Store } from '../store'
import { assertJsonLimit, executeFlow, validateFlow } from './engine'
import { flowSchema, type Flow, type FlowInput } from './model'
import { executeGraphql, graphqlSchema } from './graphql'

type Row = {
  id: string
  definition: string
  revision: number
  published: string | null
  published_revision: number | null
}

export function flowService(store: Store) {
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
      return flow
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message.slice(0, 180) : 'Invalid flow',
      )
    }
  }

  function present(row: Row) {
    return {
      ...(JSON.parse(row.definition) as Flow),
      id: row.id,
      revision: row.revision,
      publishedRevision: row.published_revision,
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
    test(actor: string, id: string, input: FlowInput) {
      const definition = valid(JSON.parse(get(id).definition))
      if (definition.graphql)
        throw new ApiError(400, 'Use the GraphQL test endpoint')
      const result = executeFlow(definition, input)
      audit(actor, 'flow.tested', id)
      return result
    },
    testGraphql(actor: string, id: string, input: unknown) {
      const definition = valid(JSON.parse(get(id).definition))
      if (!definition.graphql)
        throw new ApiError(400, 'This API does not have a GraphQL schema')
      const result = executeGraphql(definition, input)
      audit(actor, 'graphql.tested', id)
      return result
    },
    run(actor: string, method: string, path: string, input: FlowInput) {
      const row = query<Row, [string, string]>(
        "SELECT * FROM flows WHERE json_extract(published, '$.method') = ? AND json_extract(published, '$.path') = ? AND json_extract(published, '$.graphql') IS NULL",
      ).get(method, path)
      if (!row?.published) throw new ApiError(404, 'Endpoint not found')

      const result = executeFlow(JSON.parse(row.published), input)
      audit(actor, 'flow.executed', row.id)
      return result
    },
    graphql(actor: string, path: string, input: unknown) {
      const row = query<Row, [string]>(
        "SELECT * FROM flows WHERE json_extract(published, '$.path') = ? AND json_extract(published, '$.graphql') IS NOT NULL",
      ).get(path)
      if (!row?.published) throw new ApiError(404, 'Endpoint not found')

      const result = executeGraphql(JSON.parse(row.published), input)
      audit(actor, 'graphql.executed', row.id)
      return result
    },
  }
}
