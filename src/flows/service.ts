import { ApiError } from '../errors'
import type { Store, RuntimeKey } from '../workspace/store'
import { can } from '../workspace/permissions'
import { assertJsonLimit, executeFlow, validateFlow } from './engine'
import { flowSchema, type Flow, type FlowInput } from './model'
import { executeGraphql, graphqlSchema } from './graphql'
import type { dataSourceService } from '../data/sources'
import { flowOpenapi } from './openapi'
import type { productAuthService } from '../auth/product'
import { decodedRoute, matchRoute, overlappingRoutes } from './routes'
import type { databaseConnectionService } from '../databases/service'
import { clientCodeTargets } from './client-code-model'
import { clientCodeSchema, flowClientCode } from './client-code'
import type { RuntimeRelease, RuntimeService } from './runtime'
import {
  authorizeFlow,
  authorizeGraph,
  type CurrentMember,
} from '../workspace/authorization'

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
  runtime: RuntimeService,
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

  function publicationResult(id: string, currentMember?: CurrentMember) {
    const row = get(id)
    const member = currentMember?.()
    if (
      member?.access.mode === 'selected' &&
      (!can(member, 'flows.read') || !member.access.flowIds.includes(id))
    ) {
      const published = JSON.parse(row.published!) as Flow
      return {
        id: row.id,
        revision: row.revision,
        publishedRevision: row.published_revision,
        publishedEndpoint: {
          method: published.method,
          path: published.path,
          graphql: Boolean(published.graphql),
        },
      }
    }
    return present(row)
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

  function codeSource(id: string, source: unknown) {
    if (source !== undefined && source !== 'draft' && source !== 'published')
      throw new ApiError(400, 'Choose draft or published example source')
    const selected: 'draft' | 'published' = source ?? 'published'
    const row = get(id)
    if (selected === 'published' && !row.published)
      throw new ApiError(404, 'This API has no published release')
    return {
      source: selected,
      revision: selected === 'draft' ? row.revision : row.published_revision!,
      flow: draft(
        JSON.parse(selected === 'draft' ? row.definition : row.published!),
      ),
    }
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
    checkpoint: () => void = () => {},
  ) {
    try {
      return await executeFlow(
        definition,
        input,
        executionContext(actor, id, revision, signal, checkpoint),
      )
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

  function executionContext(
    actor: string,
    id: string,
    revision: number,
    signal?: AbortSignal,
    checkpoint: () => void = () => {},
  ) {
    return {
      readData: (config: Parameters<typeof sources.read>[0]) =>
        db.transaction(() => {
          checkpoint()
          const rows = sources.read(config)
          checkpoint()
          return rows
        })(),
      readDatabase: async (config: Parameters<typeof databases.read>[0]) => {
        checkpoint()
        const rows = await databases.read(config, signal)
        checkpoint()
        return rows
      },
      social: async (
        config: Parameters<typeof productAuth.social>[0],
        input: Parameters<typeof productAuth.social>[1],
      ) => {
        checkpoint()
        const result = await productAuth.social(config, input, {
          flowId: id,
          revision,
          scope: actor,
          authorize: checkpoint,
        })
        checkpoint()
        return result
      },
    }
  }

  return {
    clientCodeMetadata(id: string, source: unknown) {
      return db
        .transaction(() => {
          const selected = codeSource(id, source)
          const { name, method, path, graphql, contract } = selected.flow
          return {
            source: selected.source,
            revision: selected.revision,
            name,
            method,
            path,
            graphql: graphql ?? null,
            contract: contract ?? null,
            targets: clientCodeTargets,
          }
        })
        .immediate()
    },
    clientCode(id: string, value: unknown) {
      const parsed = clientCodeSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide a supported target, source revision, base URL, and bounded example input',
        )
      const selected = db
        .transaction(() => codeSource(id, parsed.data.source))
        .immediate()
      if (selected.revision !== parsed.data.revision)
        throw new ApiError(
          409,
          'Selected API revision changed. Reload before generating an example.',
        )
      return flowClientCode(selected.flow, selected.source, parsed.data)
    },
    list(selectedMemberId?: string) {
      const rows =
        selectedMemberId === undefined
          ? query<Row, []>('SELECT * FROM flows ORDER BY rowid DESC').all()
          : query<Row, [string]>(
              'SELECT flows.* FROM flows JOIN member_flow_grants ON member_flow_grants.flow_id = flows.id WHERE member_flow_grants.member_id = ? ORDER BY flows.rowid DESC',
            ).all(selectedMemberId)
      return rows.map(present)
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
      currentMember?: CurrentMember,
    ) {
      active()
      let stage: ReturnType<RuntimeService['stage']> | undefined
      try {
        db.transaction(() => {
          if (currentMember) authorizeFlow(currentMember(), id, 'flows.publish')
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
          const saved = draft(JSON.parse(target.definition))
          if (currentMember)
            authorizeGraph(currentMember(), id, 'flows.publish', saved)
          const definition = valid(saved)
          routeAvailable(id, definition)
          stage = runtime.stage({ flowId: id, revision, definition })
          query(
            'UPDATE flows SET published = ?, published_revision = ? WHERE id = ?',
          ).run(target.definition, revision, id)
          audit(actor, 'flow.rolled-back', id)
          stage.persist()
          stage.activate()
        }).immediate()
        stage!.commit()
      } catch (error) {
        stage?.rollback()
        throw error
      }
      return publicationResult(id, currentMember)
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
    update(
      actor: string,
      id: string,
      revision: number,
      value: unknown,
      currentMember?: CurrentMember,
    ) {
      const definition = draft(value)

      return db
        .transaction(() => {
          if (currentMember)
            authorizeGraph(currentMember(), id, 'flows.write', definition)
          get(id)
          const change = query(
            'UPDATE flows SET definition = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
          ).run(JSON.stringify(definition), id, revision)
          if (!change.changes)
            throw new ApiError(409, 'Draft changed. Reload before saving.')
          audit(actor, 'flow.updated', id)
          return present(get(id))
        })
        .immediate()
    },
    publish(
      actor: string,
      id: string,
      revision: number,
      currentMember?: CurrentMember,
    ) {
      active()
      let stage: ReturnType<RuntimeService['stage']> | undefined
      try {
        db.transaction(() => {
          if (currentMember) authorizeFlow(currentMember(), id, 'flows.publish')
          const row = get(id)
          publicationUnlocked(id)
          if (row.revision !== revision)
            throw new ApiError(409, 'Draft changed. Reload before publishing.')

          const saved = draft(JSON.parse(row.definition))
          if (currentMember)
            authorizeGraph(currentMember(), id, 'flows.publish', saved)
          const definition = valid(saved)
          routeAvailable(id, definition)
          stage = runtime.stage({ flowId: id, revision, definition })

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
          stage.persist()
          stage.activate()
        }).immediate()
        stage!.commit()
      } catch (error) {
        stage?.rollback()
        throw error
      }

      return publicationResult(id, currentMember)
    },
    async test(
      actor: string,
      id: string,
      input: FlowInput,
      signal?: AbortSignal,
      currentMember?: CurrentMember,
    ) {
      const row = get(id)
      const saved = draft(JSON.parse(row.definition))
      const checkpoint = () => {
        if (currentMember)
          authorizeGraph(currentMember(), id, 'flows.test', saved)
      }
      checkpoint()
      const definition = valid(saved)
      if (definition.graphql)
        throw new ApiError(400, 'Use the GraphQL test endpoint')
      const result = await execute(
        actor,
        id,
        definition,
        input,
        row.revision,
        signal,
        checkpoint,
      )
      checkpoint()
      active()
      audit(actor, 'flow.tested', id)
      return result
    },
    async testGraphql(
      actor: string,
      id: string,
      input: unknown,
      signal?: AbortSignal,
      currentMember?: CurrentMember,
    ) {
      const row = get(id)
      const saved = draft(JSON.parse(row.definition))
      const checkpoint = () => {
        if (currentMember)
          authorizeGraph(currentMember(), id, 'flows.test', saved)
      }
      checkpoint()
      const definition = valid(saved)
      if (!definition.graphql)
        throw new ApiError(400, 'This API does not have a GraphQL schema')
      const result = await executeGraphql(
        definition,
        input,
        undefined,
        executionContext(actor, id, row.revision, signal, checkpoint),
      )
      checkpoint()
      active()
      audit(actor, 'graphql.tested', id)
      return result
    },
    async run(
      key: RuntimeKey,
      release: RuntimeRelease,
      path: string,
      input: FlowInput,
      signal?: AbortSignal,
    ) {
      const segments = decodedRoute(path)
      if (release.flowId !== key.flowId || !key.permissions.includes('rest'))
        throw new ApiError(403, 'Runtime key does not allow this endpoint')
      if (
        key.releaseRevision !== null &&
        key.releaseRevision !== release.revision
      )
        throw new ApiError(
          403,
          'Runtime key is pinned to a release that is not currently published',
        )

      const result = await execute(
        `runtime:${key.id}`,
        release.flowId,
        release.definition,
        {
          ...input,
          params: matchRoute(release.definition.path, segments)!,
        },
        release.revision,
        signal,
        () => store.checkRuntimeAuthority(key, release.definition),
      )
      store.checkRuntimeAuthority(key, release.definition)
      active()
      audit(`runtime:${key.id}`, 'flow.executed', release.flowId)
      return result
    },
    async graphql(
      key: RuntimeKey,
      release: RuntimeRelease,
      input: unknown,
      signal?: AbortSignal,
    ) {
      if (release.flowId !== key.flowId || key.permissions.includes('rest'))
        throw new ApiError(403, 'Runtime key does not allow this endpoint')
      if (
        key.releaseRevision !== null &&
        key.releaseRevision !== release.revision
      )
        throw new ApiError(
          403,
          'Runtime key is pinned to a release that is not currently published',
        )

      const result = await executeGraphql(
        release.definition,
        input,
        key.permissions,
        executionContext(
          `runtime:${key.id}`,
          release.flowId,
          release.revision,
          signal,
          () => store.checkRuntimeAuthority(key, release.definition),
        ),
      )
      store.checkRuntimeAuthority(key, release.definition)
      active()
      if (result.visited.length)
        audit(`runtime:${key.id}`, 'graphql.executed', release.flowId)
      return result
    },
    close() {
      closed = true
    },
  }
}
