import { ApiError } from '../errors'
import { createHash } from 'node:crypto'
import type { Store, RuntimeKey } from '../workspace/store'
import type { PreparedCollectionSnapshot } from '../collections/snapshots'
import { ownerManagedFlow } from '../workspace/cms-authority'
import { can } from '../workspace/permissions'
import { assertJsonLimit, executeFlow, validateFlow } from './engine'
import { flowSchema, type Flow, type FlowInput } from './model'
import { executeGraphql, graphqlSchema } from './graphql'
import type { dataSourceService } from '../data/sources'
import { flowOpenapi } from './openapi'
import type { productAuthService } from '../auth/product'
import { decodedRoute, matchRoute, overlappingRoutes } from './routes'
import { flowTransport, websocketRoutesOverlap } from './transport'
import type { databaseConnectionService } from '../databases/service'
import { clientCodeTargets } from './client-code-model'
import { clientCodeSchema, flowClientCode } from './client-code'
import type { RuntimeRelease, RuntimeService } from './runtime'
import { hasCmsSnapshot, readCmsSnapshot } from './cms-snapshot'
import { cmsGraphqlSchema } from './cms-graphql-schema'
import { cmsGraphqlExecution } from './cms-graphql'
import { assertGraphFields } from '../workspace/field-policy'
import { mixedReadGraph } from './read-graph'
import {
  authorizeFlow,
  authorizeGraph,
  type CurrentMember,
} from '../workspace/authorization'
import {
  databaseReadPermit,
  memberRowPrincipal,
  protectedShape,
  rowCheckpoint,
  runtimeRowPrincipal,
  sourceReadPermit,
  type RowPrincipal,
} from '../workspace/row-authority'

type Row = {
  id: string
  definition: string
  revision: number
  published: string | null
  published_revision: number | null
  cms: number
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

  function ordinaryDraft(value: unknown) {
    const definition = draft(value)
    if (definition.nodes.some((node) => node.type === 'cmsSnapshotResponse'))
      throw new ApiError(400, 'CMS snapshot nodes are server-owned')

    return definition
  }

  function ordinaryFlow(id: string) {
    if (ownerManagedFlow(store, id))
      throw new ApiError(503, 'CMS snapshot operation is not available')
  }

  function valid(value: unknown) {
    assertGraphFields(store, draft(value), 403, true)
    try {
      const flow = validateFlow(value)
      if (flow.graphql) graphqlSchema(flow)
      sources.validate(flow)
      productAuth.validate(flow)
      databases.validate(flow)
      if (!protectedShape(store, flow).supported)
        throw new ApiError(
          400,
          'Protected APIs require a bounded protected read graph returning typed rows',
        )
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
            transport: flowTransport(published),
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
          transport: flowTransport(published),
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
          flowTransport(published) === flowTransport(definition) &&
          (flowTransport(definition) === 'websocket'
            ? websocketRoutesOverlap(definition.path, published.path)
            : flowTransport(definition) === 'graphql'
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
    ordinaryFlow(id)

    if (source !== undefined && source !== 'draft' && source !== 'published')
      throw new ApiError(400, 'Choose draft or published example source')
    const selected: 'draft' | 'published' = source ?? 'published'
    const row = get(id)
    if (selected === 'published' && !row.published)
      throw new ApiError(404, 'This API has no published release')
    const flow = draft(
      JSON.parse(selected === 'draft' ? row.definition : row.published!),
    )
    if (flowTransport(flow) === 'websocket')
      throw new ApiError(
        400,
        'HTTP client examples are unavailable for WebSocket APIs',
      )
    return {
      source: selected,
      revision: selected === 'draft' ? row.revision : row.published_revision!,
      flow,
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
    principal: () => RowPrincipal | null = () => null,
  ) {
    try {
      return await executeFlow(
        definition,
        input,
        executionContext(actor, id, revision, signal, checkpoint, principal),
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
    principal: () => RowPrincipal | null = () => null,
  ) {
    return {
      readData: (config: Parameters<typeof sources.read>[0]) =>
        db.transaction(() => {
          checkpoint()
          const rows = sources.read(
            config,
            sourceReadPermit(store, config.sourceId, principal()),
          )
          checkpoint()
          return rows
        })(),
      readDatabase: async (config: Parameters<typeof databases.read>[0]) => {
        checkpoint()
        const permit = databaseReadPermit(
          store,
          config.connectionId,
          config.table,
          principal(),
        )
        const rows = await databases.read(config, signal, permit)
        checkpoint()
        const current = databaseReadPermit(
          store,
          config.connectionId,
          config.table,
          principal(),
        )
        if (JSON.stringify(current) !== JSON.stringify(permit))
          throw new ApiError(403, 'Row policy changed during this read')
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

  function createSnapshot(
    actor: string,
    currentMember: CurrentMember,
    prepare: () => PreparedCollectionSnapshot,
    transport: 'rest' | 'graphql',
  ) {
    return db
      .transaction(() => {
        const member = currentMember()
        if (member.id !== actor || member.role !== 'owner')
          throw new ApiError(403, 'Permission denied')

        active()
        const prepared = prepare()
        const bytes = Buffer.byteLength(prepared.payload, 'utf8')
        const sha256 = createHash('sha256')
          .update(prepared.payload, 'utf8')
          .digest('hex')
        if (bytes > 262_144 || sha256 !== prepared.sha256)
          throw new ApiError(503, 'Prepared CMS snapshot is invalid')

        const id = crypto.randomUUID()
        const snapshotId = crypto.randomUUID()
        const requestId = crypto.randomUUID()
        const nodeId = crypto.randomUUID()
        const definition = validateFlow({
          name: prepared.name,
          method: transport === 'graphql' ? 'POST' : 'GET',
          path: prepared.path,
          ...(transport === 'graphql'
            ? { graphql: { schema: cmsGraphqlSchema } }
            : {}),
          nodes: [
            {
              id: requestId,
              type: 'request',
              position: { x: 0, y: 0 },
              config: {},
            },
            {
              id: nodeId,
              type: 'cmsSnapshotResponse',
              position: { x: 360, y: 0 },
              config: { snapshotId, snapshotSha256: sha256 },
            },
          ],
          edges: [
            { id: crypto.randomUUID(), source: requestId, target: nodeId },
          ],
        })
        if (definition.graphql) graphqlSchema(definition)

        query(
          'INSERT INTO flows (id, definition, revision, cms) VALUES (?, ?, 1, 1)',
        ).run(id, JSON.stringify(definition))
        query(`INSERT INTO cms_snapshots
          (snapshot_id, flow_id, node_id, draft_revision, sha256, payload)
          VALUES (?, ?, ?, 1, ?, ?)`).run(
          snapshotId,
          id,
          nodeId,
          sha256,
          prepared.payload,
        )
        audit(actor, 'flow.created', id)

        return present(get(id))
      })
      .immediate()
  }

  return {
    websocketDraft(id: string): RuntimeRelease {
      ordinaryFlow(id)

      const row = get(id)
      return {
        flowId: id,
        revision: row.revision,
        definition: draft(JSON.parse(row.definition)),
      }
    },
    validateWebSocketDraft: valid,
    rowAccess(
      member: import('../workspace/store').Member,
      id: string,
      url: URL,
    ) {
      const permissions = [
        'flows.read',
        'flows.write',
        'flows.test',
        'flows.publish',
        'runtime-keys.manage',
        'load-tests.run',
      ] as const
      const permitted = permissions.filter((permission) =>
        can(member, permission),
      )
      if (!permitted.length) throw new ApiError(403, 'Permission denied')
      authorizeFlow(store, member, id, permitted[0]!)
      const row = get(id)
      if (
        url.searchParams.getAll('source').length > 1 ||
        [...url.searchParams.keys()].some((key) => key !== 'source')
      )
        throw new ApiError(400, 'Choose draft or published row-access source')
      const source = url.searchParams.get('source') ?? 'published'
      if (source !== 'draft' && source !== 'published')
        throw new ApiError(400, 'Choose draft or published row-access source')
      const allowed =
        source === 'draft'
          ? ['flows.read', 'flows.write', 'flows.test', 'flows.publish']
          : ['flows.read', 'runtime-keys.manage', 'load-tests.run']
      const permission = permitted.find((value) => allowed.includes(value))
      if (!permission) throw new ApiError(403, 'Permission denied')
      if (source === 'published' && !row.published)
        throw new ApiError(404, 'This API has no published release')
      const definition = draft(
        JSON.parse(source === 'draft' ? row.definition : row.published!),
      )
      authorizeGraph(store, member, id, permission, definition)
      return {
        source,
        revision: source === 'draft' ? row.revision : row.published_revision!,
        ...protectedShape(store, definition),
      }
    },
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
      ordinaryFlow(id)

      const parsed = clientCodeSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide a supported target, source revision, base URL, and bounded example input',
        )
      const selected = db
        .transaction(() => {
          const selected = codeSource(id, parsed.data.source)
          return {
            ...selected,
            mixedProtectedRead:
              protectedShape(store, selected.flow).required &&
              mixedReadGraph(selected.flow),
          }
        })
        .immediate()
      if (selected.revision !== parsed.data.revision)
        throw new ApiError(
          409,
          'Selected API revision changed. Reload before generating an example.',
        )
      return flowClientCode(
        selected.flow,
        selected.source,
        parsed.data,
        selected.mixedProtectedRead,
      )
    },
    list(memberId?: string) {
      const member = memberId === undefined ? undefined : store.member(memberId)
      if (member === null) throw new ApiError(401, 'Authentication required')

      const rows =
        member?.access.mode !== 'selected'
          ? query<Row, []>('SELECT * FROM flows ORDER BY rowid DESC').all()
          : query<Row, [string]>(
              'SELECT flows.* FROM flows JOIN member_flow_grants ON member_flow_grants.flow_id = flows.id WHERE member_flow_grants.member_id = ? ORDER BY flows.rowid DESC',
            ).all(member.id)

      return rows
        .filter((row) => {
          if (row.cms !== 0 && row.cms !== 1)
            throw new ApiError(503, 'Flow classification is invalid')

          return row.cms === 0 || !member || member.role === 'owner'
        })
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
              transport: flowTransport(definition),
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
          if (currentMember)
            authorizeFlow(store, currentMember(), id, 'flows.publish')
          ordinaryFlow(id)

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
            authorizeGraph(store, currentMember(), id, 'flows.publish', saved)
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
      ordinaryFlow(id)

      if (source !== undefined && source !== 'draft' && source !== 'published')
        throw new ApiError(400, 'Choose draft or published OpenAPI source')
      const selected = source ?? 'published'
      const row = get(id)
      if (selected === 'published' && !row.published)
        throw new ApiError(404, 'This API has no published release')
      const definition = selected === 'draft' ? row.definition : row.published!
      const flow = draft(JSON.parse(definition))
      if (flowTransport(flow) !== 'rest')
        throw new ApiError(400, 'OpenAPI is available for REST APIs only')
      return flowOpenapi(
        flow,
        row.id,
        selected === 'draft' ? row.revision : row.published_revision!,
        selected,
      )
    },
    create(actor: string, value: unknown) {
      const definition = ordinaryDraft(value)
      const id = crypto.randomUUID()

      db.transaction(() => {
        query(
          'INSERT INTO flows (id, definition, revision) VALUES (?, ?, 1)',
        ).run(id, JSON.stringify(definition))
        audit(actor, 'flow.created', id)
      })()

      return present(get(id))
    },
    createContentSnapshot(
      actor: string,
      currentMember: CurrentMember,
      prepare: () => PreparedCollectionSnapshot,
    ) {
      return createSnapshot(actor, currentMember, prepare, 'rest')
    },
    createContentGraphqlSnapshot(
      actor: string,
      currentMember: CurrentMember,
      prepare: () => PreparedCollectionSnapshot,
    ) {
      return createSnapshot(actor, currentMember, prepare, 'graphql')
    },
    update(
      actor: string,
      id: string,
      revision: number,
      value: unknown,
      currentMember?: CurrentMember,
    ) {
      return db
        .transaction(() => {
          if (currentMember)
            authorizeFlow(store, currentMember(), id, 'flows.write')
          ordinaryFlow(id)

          const definition = ordinaryDraft(value)
          if (currentMember)
            authorizeGraph(
              store,
              currentMember(),
              id,
              'flows.write',
              definition,
            )
          assertGraphFields(store, definition, 403, true)
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
          const member = currentMember?.()
          if (member) authorizeFlow(store, member, id, 'flows.publish')

          const cms = ownerManagedFlow(store, id)
          if (
            cms &&
            (!member || member.id !== actor || member.role !== 'owner')
          )
            throw new ApiError(403, 'Permission denied')

          const row = get(id)
          publicationUnlocked(id)
          if (row.revision !== revision)
            throw new ApiError(409, 'Draft changed. Reload before publishing.')

          const saved = draft(JSON.parse(row.definition))
          if (cms !== hasCmsSnapshot(saved))
            throw new ApiError(503, 'CMS snapshot classification is invalid')

          if (currentMember)
            authorizeGraph(store, currentMember(), id, 'flows.publish', saved)
          const definition = cms ? validateFlow(saved) : valid(saved)
          if (cms) readCmsSnapshot(store, { flowId: id, revision, definition })

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
      tenantId?: string,
    ) {
      if (currentMember) authorizeFlow(store, currentMember(), id, 'flows.test')

      ordinaryFlow(id)

      const row = get(id)
      const saved = draft(JSON.parse(row.definition))
      const principal = () =>
        memberRowPrincipal(
          store,
          currentMember ? currentMember() : store.member(actor)!,
          saved,
          tenantId,
        )
      const checkpoint = rowCheckpoint(
        store,
        saved,
        () => {
          active()
          if (currentMember)
            authorizeGraph(store, currentMember(), id, 'flows.test', saved)
          principal()
        },
        principal,
      )
      checkpoint()
      const definition = valid(saved)
      if (flowTransport(definition) === 'websocket')
        throw new ApiError(
          400,
          'Use the saved-draft WebSocket connection tester',
        )
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
        principal,
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
      tenantId?: string,
    ) {
      if (currentMember) authorizeFlow(store, currentMember(), id, 'flows.test')

      ordinaryFlow(id)

      const row = get(id)
      const saved = draft(JSON.parse(row.definition))
      const principal = () =>
        memberRowPrincipal(
          store,
          currentMember ? currentMember() : store.member(actor)!,
          saved,
          tenantId,
        )
      const checkpoint = rowCheckpoint(
        store,
        saved,
        () => {
          active()
          if (currentMember)
            authorizeGraph(store, currentMember(), id, 'flows.test', saved)
          principal()
        },
        principal,
      )
      checkpoint()
      const definition = valid(saved)
      if (flowTransport(definition) === 'websocket')
        throw new ApiError(
          400,
          'Use the saved-draft WebSocket connection tester',
        )
      if (!definition.graphql)
        throw new ApiError(400, 'This API does not have a GraphQL schema')
      const result = await executeGraphql(definition, input, undefined, {
        ...executionContext(
          actor,
          id,
          row.revision,
          signal,
          checkpoint,
          principal,
        ),
        mixedProtectedRead:
          protectedShape(store, definition).required &&
          mixedReadGraph(definition),
      })
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

      const cms = ownerManagedFlow(store, release.flowId)
      if (cms !== hasCmsSnapshot(release.definition))
        throw new ApiError(503, 'CMS snapshot classification is invalid')

      if (cms) {
        return runtime.readAdmission(release, () => {
          active()
          if (signal?.aborted)
            throw new ApiError(503, 'CMS snapshot read was cancelled')

          const current = store.runtimeCredential(key.id)
          if (!current) throw new ApiError(401, 'Authentication required')
          if (
            current.flowId !== release.flowId ||
            !current.permissions.includes('rest') ||
            (current.releaseRevision !== null &&
              current.releaseRevision !== release.revision)
          )
            throw new ApiError(403, 'Runtime key does not allow this endpoint')

          store.checkRuntimeAuthority(current, release.definition)
          if (!matchRoute(release.definition.path, segments))
            throw new ApiError(404, 'Endpoint not found')

          try {
            assertJsonLimit(input)
          } catch {
            throw new ApiError(400, 'Request size or nesting limit exceeded')
          }

          const body = readCmsSnapshot(store, release)
          active()
          if (signal?.aborted)
            throw new ApiError(503, 'CMS snapshot read was cancelled')

          store.checkRuntimeAuthority(current, release.definition)
          audit(`runtime:${current.id}`, 'flow.executed', release.flowId)

          return {
            status: 200,
            body,
            visited: release.definition.nodes.map((node) => node.id),
          }
        })
      }

      const checkpoint = rowCheckpoint(store, release.definition, () => {
        active()
        store.checkRuntimeAuthority(key, release.definition)
      })
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
        checkpoint,
        () => runtimeRowPrincipal(store, key, release.definition),
      )
      checkpoint()
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

      const cms = ownerManagedFlow(store, release.flowId)
      if (cms !== hasCmsSnapshot(release.definition))
        throw new ApiError(503, 'CMS snapshot classification is invalid')

      if (cms) {
        const generation = runtime.assertCurrent(release)
        const authorize = () => {
          active()
          if (signal?.aborted)
            throw new ApiError(503, 'CMS snapshot read was cancelled')
          if (runtime.assertCurrent(release) !== generation)
            throw new ApiError(
              503,
              'Published runtime changed. Retry this request.',
            )
          if (
            !ownerManagedFlow(store, release.flowId) ||
            !hasCmsSnapshot(release.definition)
          )
            throw new ApiError(503, 'CMS snapshot classification is invalid')

          const current = store.runtimeCredential(key.id)
          if (!current) throw new ApiError(401, 'Authentication required')
          if (
            current.flowId !== release.flowId ||
            !current.permissions.includes('query') ||
            current.permissions.includes('rest') ||
            current.releaseRevision !== release.revision
          )
            throw new ApiError(403, 'Runtime key does not allow this endpoint')

          store.checkRuntimeAuthority(current, release.definition)

          return current
        }

        const snapshot = runtime.readAdmission(release, () => {
          authorize()

          return readCmsSnapshot(store, release)
        })
        const result = await executeGraphql(
          release.definition,
          input,
          key.permissions,
          {},
          cmsGraphqlExecution(snapshot, release.definition),
        )

        return runtime.readAdmission(release, () => {
          const current = authorize()
          if (result.visited.length)
            audit(`runtime:${current.id}`, 'graphql.executed', release.flowId)

          return result
        })
      }

      const checkpoint = rowCheckpoint(store, release.definition, () => {
        active()
        store.checkRuntimeAuthority(key, release.definition)
      })
      const result = await executeGraphql(
        release.definition,
        input,
        key.permissions,
        {
          ...executionContext(
            `runtime:${key.id}`,
            release.flowId,
            release.revision,
            signal,
            checkpoint,
            () => runtimeRowPrincipal(store, key, release.definition),
          ),
          mixedProtectedRead:
            protectedShape(store, release.definition).required &&
            mixedReadGraph(release.definition),
        },
      )
      checkpoint()
      active()
      if (result.visited.length)
        audit(`runtime:${key.id}`, 'graphql.executed', release.flowId)
      return result
    },
    async websocket(
      release: RuntimeRelease,
      body: unknown,
      signal: AbortSignal,
      authorize: () => RuntimeKey,
    ) {
      const principal = () =>
        runtimeRowPrincipal(store, authorize(), release.definition)
      const checkpoint = rowCheckpoint(
        store,
        release.definition,
        () => {
          active()
          authorize()
        },
        principal,
      )
      checkpoint()
      const result = await execute(
        `runtime:${authorize().id}`,
        release.flowId,
        release.definition,
        { body, query: {}, params: {} },
        release.revision,
        signal,
        checkpoint,
        principal,
      )
      checkpoint()
      return result
    },
    async testWebSocket(
      release: RuntimeRelease,
      body: unknown,
      signal: AbortSignal,
      authorize: () => import('../workspace/store').Member,
      tenantId: string | null,
    ) {
      const principal = () => {
        const member = authorize()
        return memberRowPrincipal(
          store,
          member,
          release.definition,
          member.role === 'owner' && tenantId !== null ? tenantId : undefined,
        )
      }
      const checkpoint = rowCheckpoint(
        store,
        release.definition,
        () => {
          active()
          authorize()
        },
        principal,
      )
      checkpoint()
      const result = await execute(
        authorize().id,
        release.flowId,
        release.definition,
        { body, query: {}, params: {} },
        release.revision,
        signal,
        checkpoint,
        principal,
      )
      checkpoint()
      return result
    },
    close() {
      closed = true
    },
  }
}
