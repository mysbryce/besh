import { ApiError } from '../errors'
import type { Store, RuntimePermission } from '../workspace/store'
import type { Flow } from '../flows/model'
import { assertJsonLimit } from '../flows/engine'
import { z } from 'zod'
import {
  getOperationAST,
  getVariableValues,
  Kind,
  NoSchemaIntrospectionCustomRule,
  parse,
  specifiedRules,
  validate,
  type SelectionSetNode,
} from 'graphql'
import { graphqlSchema } from '../flows/graphql'
import { prepareInput } from '../flows/contracts'
import { concreteRoute } from '../flows/routes'
import type {
  K6Runner,
  LoadTestRun,
  LoadTestStart,
  LoadTestSummary,
  LoadTestTarget,
} from './model'

type ReleaseRow = { id: string; published: string; published_revision: number }
type RunRow = {
  id: string
  metadata: string
  status: LoadTestRun['status']
  runtime_key_id: string
  actor: string
}

const startSchema = z
  .object({
    flowId: z.string().min(1).max(100),
    config: z
      .object({
        vus: z.number().int().min(1).max(10).optional(),
        durationSeconds: z.number().int().min(1).max(30).optional(),
        p95Ms: z.number().min(1).max(60_000).optional(),
        maxErrorRate: z.number().min(0).max(1).optional(),
        expectedStatus: z
          .number()
          .int()
          .min(200)
          .max(599)
          .nullable()
          .optional(),
      })
      .strict()
      .optional(),
    request: z
      .object({
        params: z
          .record(z.string(), z.string().max(4096))
          .refine((params) => Object.keys(params).length <= 64)
          .optional(),
        body: z.unknown().optional(),
        query: z
          .record(z.string().min(1).max(256), z.string().max(4096))
          .refine((query) => Object.keys(query).length <= 64)
          .optional(),
        graphql: z
          .object({
            query: z.string().min(1).max(16_384),
            variables: z.record(z.string(), z.unknown()).optional(),
            operationName: z.string().min(1).max(100).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

function graphqlPermission(
  flow: Flow,
  request: LoadTestStart['request'],
): RuntimePermission {
  const input = request?.graphql
  if (!input)
    throw new ApiError(400, 'Provide a GraphQL operation for this API')
  if (
    request?.body != null ||
    Object.keys(request?.query ?? {}).length ||
    Object.keys(request?.params ?? {}).length
  )
    throw new ApiError(400, 'Choose GraphQL input for this API')
  try {
    const schema = graphqlSchema(flow)
    const document = parse(input.query, { maxTokens: 2000 })
    if (
      validate(
        schema,
        document,
        [...specifiedRules, NoSchemaIntrospectionCustomRule],
        { maxErrors: 10 },
      ).length
    )
      throw new Error('Invalid operation')
    const operation = getOperationAST(document, input.operationName)
    if (!operation || operation.operation === 'subscription')
      throw new Error('Invalid operation')
    if (
      getVariableValues(
        schema,
        operation.variableDefinitions ?? [],
        input.variables ?? {},
        { maxErrors: 10 },
      ).errors
    )
      throw new Error('Invalid variables')
    const fragments = new Map(
      document.definitions
        .filter((node) => node.kind === Kind.FRAGMENT_DEFINITION)
        .map((node) => [node.name.value, node]),
    )
    let fields = 0
    let roots = 0
    function walk(set: SelectionSetNode, depth: number) {
      if (depth > 12) throw new Error('Depth limit')
      for (const node of set.selections) {
        if (node.kind === Kind.FIELD) {
          fields++
          if (depth === 1) roots++
          if (fields > 200 || roots > 16) throw new Error('Field limit')
          if (node.selectionSet) walk(node.selectionSet, depth + 1)
        } else if (node.kind === Kind.INLINE_FRAGMENT)
          walk(node.selectionSet, depth)
        else {
          const fragment = fragments.get(node.name.value)
          if (fragment) walk(fragment.selectionSet, depth)
        }
      }
    }
    walk(operation.selectionSet, 1)
    return operation.operation
  } catch {
    throw new ApiError(
      400,
      'GraphQL operation or variables are invalid or exceed execution limits',
    )
  }
}

export function loadTestService(
  store: Store,
  runner: K6Runner,
  getOrigin: () => string | null,
) {
  const active = new Map<string, AbortController>()
  let closed = false

  function get(id: string) {
    const row = store
      .query<RunRow, [string]>('SELECT * FROM load_tests WHERE id = ?')
      .get(id)
    if (!row) throw new ApiError(404, 'Load test not found')
    return row
  }

  function finish(
    id: string,
    status: LoadTestRun['status'],
    summary: LoadTestSummary | null = null,
    error: string | null = null,
  ) {
    if (closed) return
    store.db
      .transaction(() => {
        const row = get(id)
        if (row.status !== 'running') return
        const run: LoadTestRun = {
          ...JSON.parse(row.metadata),
          status,
          summary,
          error,
          finishedAt: new Date().toISOString(),
        }
        store.revokeRuntimeKey(row.actor, row.runtime_key_id)
        store
          .query(
            'UPDATE load_tests SET metadata = ?, status = ? WHERE id = ? AND status = ?',
          )
          .run(JSON.stringify(run), status, id, 'running')
        store.audit(row.actor, `load-test.${status}`, id)
      })
      .immediate()
    active.delete(id)
  }

  // A persisted running job cannot survive the process that owned its child.
  store.db
    .transaction(() => {
      for (const row of store
        .query<RunRow, []>("SELECT * FROM load_tests WHERE status = 'running'")
        .all())
        finish(
          row.id,
          'interrupted',
          null,
          'Server restarted before the load test finished',
        )
    })
    .immediate()

  return {
    targets(): LoadTestTarget[] {
      return store
        .query<ReleaseRow, []>(
          'SELECT id, published, published_revision FROM flows WHERE published IS NOT NULL ORDER BY rowid DESC',
        )
        .all()
        .map((row) => {
          const flow = JSON.parse(row.published) as Flow
          return {
            id: row.id,
            name: flow.name,
            revision: row.published_revision,
            method: flow.graphql ? 'POST' : flow.method,
            path: flow.path,
            graphql: flow.graphql ?? null,
            unavailableReason: flow.nodes.some((node) => node.type === 'social')
              ? 'Product login APIs cannot be load tested automatically'
              : null,
          }
        })
    },
    list(): LoadTestRun[] {
      return store
        .query<{ metadata: string }, []>(
          'SELECT metadata FROM load_tests ORDER BY rowid DESC LIMIT 100',
        )
        .all()
        .map((row) => JSON.parse(row.metadata))
    },
    get(id: string): LoadTestRun {
      return JSON.parse(get(id).metadata)
    },
    start(actor: string, input: unknown): LoadTestRun {
      const parsed = startSchema.safeParse(input)
      if (!parsed.success)
        throw new ApiError(400, 'Invalid load test configuration or request')
      const value: LoadTestStart = parsed.data
      try {
        assertJsonLimit(value.request ?? {})
      } catch {
        throw new ApiError(
          400,
          'Load test input size or nesting limit exceeded',
        )
      }
      if (Buffer.byteLength(JSON.stringify(value.request ?? {})) > 16_384)
        throw new ApiError(400, 'Load test request exceeds 16 KiB')
      const origin = getOrigin()
      if (!origin)
        throw new ApiError(
          409,
          'Start the local server before running a load test',
        )
      const { run, token, body, url } = store.db
        .transaction(() => {
          if (
            store
              .query("SELECT id FROM load_tests WHERE status = 'running'")
              .get()
          )
            throw new ApiError(409, 'A load test is already running')
          const row = store
            .query<ReleaseRow, [string]>(
              'SELECT id, published, published_revision FROM flows WHERE id = ? AND published IS NOT NULL',
            )
            .get(value.flowId)
          if (!row) throw new ApiError(400, 'Choose a published API')
          const flow = JSON.parse(row.published) as Flow
          if (flow.nodes.some((node) => node.type === 'social'))
            throw new ApiError(
              400,
              'Product login APIs cannot be load tested automatically',
            )
          if (!flow.graphql && value.request?.graphql)
            throw new ApiError(400, 'Choose REST input for this API')
          if (
            !flow.graphql &&
            ['GET', 'HEAD'].includes(flow.method) &&
            value.request?.body != null
          )
            throw new ApiError(
              400,
              'GET and HEAD APIs do not accept a request body',
            )
          if (!flow.graphql)
            prepareInput(flow.contract, {
              body: value.request?.body ?? null,
              query: value.request?.query ?? {},
              params: value.request?.params ?? {},
            })
          const permission: RuntimePermission = flow.graphql
            ? graphqlPermission(flow, value.request)
            : 'rest'
          const query = new URLSearchParams(value.request?.query).toString()
          const path = flow.graphql
            ? flow.path
            : concreteRoute(flow.path, value.request?.params)
          const url = `${origin}/${flow.graphql ? 'graphql' : 'run'}${path}${query ? `?${query}` : ''}`
          if (Buffer.byteLength(url) > 8192)
            throw new ApiError(400, 'Load test URL exceeds 8 KiB')
          const config = {
            vus: 1,
            durationSeconds: 5,
            p95Ms: 1000,
            maxErrorRate: 0.01,
            expectedStatus: null,
            ...value.config,
          }
          const run: LoadTestRun = {
            id: crypto.randomUUID(),
            flowId: row.id,
            flowName: flow.name,
            revision: row.published_revision,
            method: flow.graphql ? 'POST' : flow.method,
            path: flow.path,
            graphql: Boolean(flow.graphql),
            config,
            status: 'running',
            createdAt: new Date().toISOString(),
            finishedAt: null,
            summary: null,
            error: null,
          }
          const key = store.createRuntimeKey(actor, {
            name: `Load test ${run.id}`,
            flowId: row.id,
            permissions: [permission],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          })
          store
            .query('INSERT INTO load_tests VALUES (?, ?, ?, ?, ?)')
            .run(run.id, JSON.stringify(run), 'running', key.id, actor)
          store.audit(actor, 'load-test.started', run.id)
          return {
            run,
            token: key.token,
            body: flow.graphql
              ? value.request!.graphql
              : (value.request?.body ?? null),
            url,
          }
        })
        .immediate()
      const controller = new AbortController()
      active.set(run.id, controller)
      void Promise.resolve()
        .then(() =>
          runner(
            {
              url,
              method: run.method,
              token,
              body,
              graphql: run.graphql,
              config: run.config,
            },
            controller.signal,
          ),
        )
        .then((result) => finish(run.id, 'completed', result))
        .catch(() =>
          finish(
            run.id,
            'failed',
            null,
            'Load test failed. Automatic k6 download needs internet access; retry or set BESH_K6_PATH to an installed binary.',
          ),
        )
      return run
    },
    cancel(id: string): LoadTestRun {
      const row = get(id)
      if (row.status !== 'running' && row.status !== 'canceled')
        throw new ApiError(409, 'This load test has already finished')
      const controller = active.get(id)
      finish(id, 'canceled')
      controller?.abort()
      return JSON.parse(get(id).metadata)
    },
    close() {
      if (closed) return
      const controllers = [...active.values()]
      for (const id of active.keys())
        finish(
          id,
          'interrupted',
          null,
          'Server stopped before the load test finished',
        )
      closed = true
      for (const controller of controllers) controller.abort()
    },
  }
}
