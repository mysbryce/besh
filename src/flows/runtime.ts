import type { AnyElysia } from 'elysia'
import type { AnyWSLocalHook } from 'elysia/ws/types'
import {
  mkdtempSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { ApiError } from '../errors'
import type { RuntimeKey, Store } from '../workspace/store'
import type { Flow, FlowInput, FlowResult } from './model'
import { decodedRoute, overlappingRoutes } from './routes'
import { flowTransport, websocketRoutesOverlap } from './transport'
import { validateFlow } from './engine'
import {
  generateBackendCode,
  saveBackendCode,
  verifyBackendCode,
} from './backend-code'
import type { BackendCodeArtifact } from './backend-code-model'

export type RuntimeRelease = {
  flowId: string
  revision: number
  definition: Flow
}
type Row = { id: string; published_revision: number; published: string }
type Executors = {
  websocket?: (release: RuntimeRelease, generation: number) => AnyWSLocalHook
  websocketHttp?: (
    release: RuntimeRelease,
    generation: number,
    request: Request,
  ) => Response
  websocketTicket?: (
    release: RuntimeRelease,
    generation: number,
    request: Request,
    body: unknown,
  ) => Response | Promise<Response>
  websocketNamespace?: (request: Request) => void
  publicationCommitted?: () => void
  rest: (
    key: RuntimeKey,
    release: RuntimeRelease,
    path: string,
    input: FlowInput,
    signal: AbortSignal,
  ) => Promise<FlowResult>
  graphql: (
    key: RuntimeKey,
    release: RuntimeRelease,
    body: unknown,
    signal: AbortSignal,
  ) => Promise<FlowResult>
}

export function runtimeService(
  store: Store,
  codeDir: string | undefined,
  executors: Executors,
) {
  const defaultDir = codeDir === undefined
  const directory = codeDir ?? mkdtempSync(join(tmpdir(), 'besh-runtime-code-'))
  let current!: AnyElysia
  let currentGeneration = -1
  let currentReleases = new Map<string, RuntimeRelease>()
  let factory!: () => AnyElysia
  let closed = false
  let blocked = false
  const attempts = new WeakMap<Request, number>()
  const appGenerations = new WeakMap<AnyElysia, number>()
  const cleanups = new Set<string>()

  function drainCleanup() {
    for (const staging of cleanups) {
      try {
        try {
          unlinkSync(join(staging, 'runtime.cjs'))
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        rmdirSync(staging)
        cleanups.delete(staging)
      } catch {
        throw new ApiError(503, 'Generated runtime cleanup failed')
      }
    }
  }

  function generation() {
    const row = store
      .query<{ generation: number }, []>(
        'SELECT generation FROM runtime_publication WHERE id = 1',
      )
      .get()
    if (!row)
      throw new ApiError(503, 'Runtime publication state is unavailable')
    return row.generation
  }

  function active() {
    if (closed) throw new ApiError(503, 'Runtime is shutting down')
  }

  function token(request: Request) {
    return (
      request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] ?? ''
    )
  }

  function admit(release: RuntimeRelease, expected: number, request: Request) {
    active()
    return store.db.transaction(() => {
      if (blocked || generation() !== expected)
        throw new ApiError(
          503,
          'Published runtime changed. Retry this request.',
        )
      const key = store.authenticateRuntime(token(request))
      if (!key) throw new ApiError(401, 'Authentication required')
      if (
        key.flowId !== release.flowId ||
        (release.definition.graphql
          ? key.permissions.includes('rest')
          : !key.permissions.includes('rest'))
      )
        throw new ApiError(403, 'Runtime key does not allow this endpoint')
      if (
        key.releaseRevision !== null &&
        key.releaseRevision !== release.revision
      )
        throw new ApiError(
          403,
          'Runtime key is pinned to a release that is not currently published',
        )
      store.checkRuntimeAuthority(key, release.definition)
      return key
    })()
  }

  const helpers = {
    websocketHttp(release: RuntimeRelease, expected: number, request: Request) {
      active()
      if (!executors.websocketHttp)
        throw new ApiError(503, 'WebSocket runtime is unavailable')
      return executors.websocketHttp(release, expected, request)
    },
    websocket(release: RuntimeRelease, expected: number) {
      active()
      if (!executors.websocket)
        throw new ApiError(503, 'WebSocket runtime is unavailable')
      return executors.websocket(release, expected)
    },
    websocketTicket(
      release: RuntimeRelease,
      expected: number,
      request: Request,
      body: unknown,
    ) {
      active()
      if (!executors.websocketTicket)
        throw new ApiError(503, 'WebSocket runtime is unavailable')
      return executors.websocketTicket(release, expected, request, body)
    },
    async rest(
      release: RuntimeRelease,
      expected: number,
      request: Request,
      body: unknown,
      query: Record<string, string>,
    ) {
      if (request.method !== release.definition.method)
        throw new ApiError(404, 'Endpoint not found')
      const key = admit(release, expected, request)
      const result = await executors.rest(
        key,
        release,
        new URL(request.url).pathname.slice(4),
        { body: body ?? null, query },
        request.signal,
      )
      const empty =
        request.method === 'HEAD' || [204, 205, 304].includes(result.status)
      return new Response(empty ? null : JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/json' },
      })
    },
    async graphql(
      release: RuntimeRelease,
      expected: number,
      request: Request,
      body: unknown,
    ) {
      const key = admit(release, expected, request)
      const result = await executors.graphql(key, release, body, request.signal)
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/graphql-response+json' },
      })
    },
    graphqlMethod(release: RuntimeRelease, expected: number, request: Request) {
      admit(release, expected, request)
      return new Response(
        JSON.stringify({
          errors: [{ message: 'GraphQL endpoints accept POST requests' }],
        }),
        {
          status: 405,
          headers: {
            allow: 'POST',
            'content-type': 'application/graphql-response+json',
          },
        },
      )
    },
  }

  function register(
    app: AnyElysia,
    artifact: BackendCodeArtifact,
    epoch: number,
  ) {
    drainCleanup()
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const staging = mkdtempSync(join(directory, 'stage-'))
    const path = join(staging, 'runtime.cjs')
    const require = createRequire(path)
    let written = false
    try {
      writeFileSync(path, artifact.code, { flag: 'wx', mode: 0o600 })
      written = true
      const load = require(path)
      if (typeof load !== 'function')
        throw new Error('Invalid generated registration module')
      load(app, helpers, epoch)
    } finally {
      delete require.cache[path]
      try {
        if (written) unlinkSync(path)
        rmdirSync(staging)
      } catch {
        cleanups.add(staging)
        throw new ApiError(503, 'Generated runtime cleanup failed')
      }
    }
  }

  function build(rows: Row[], epoch: number) {
    const app = factory()
    const artifacts = rows.map((row) =>
      generateBackendCode(
        row.id,
        row.published_revision,
        JSON.parse(row.published),
      ),
    )
    for (let index = 0; index < artifacts.length; index++) {
      const endpoint = artifacts[index].endpoint
      if (
        artifacts
          .slice(index + 1)
          .some(
            (other) =>
              other.endpoint.graphql === endpoint.graphql &&
              other.endpoint.method === endpoint.method &&
              (endpoint.transport === 'websocket' &&
              other.endpoint.transport === 'websocket'
                ? websocketRoutesOverlap(other.endpoint.path, endpoint.path)
                : endpoint.graphql
                  ? other.endpoint.path === endpoint.path
                  : overlappingRoutes(other.endpoint.path, endpoint.path)),
          )
      )
        throw new ApiError(503, 'Published runtime routes overlap')
    }
    for (const [index, artifact] of artifacts.entries()) {
      verifyBackendCode(store, artifact, JSON.parse(rows[index]!.published))
      register(app, artifact, epoch)
    }
    appGenerations.set(app, epoch)
    app.compile()
    const releases = new Map(
      rows.map((row) => [
        row.id,
        {
          flowId: row.id,
          revision: row.published_revision,
          definition: validateFlow(JSON.parse(row.published)),
        },
      ]),
    )
    return { app, artifacts, releases }
  }

  function rows() {
    return store
      .query<Row, []>(
        'SELECT id, published_revision, published FROM flows WHERE published IS NOT NULL',
      )
      .all()
  }

  function replacement(built: ReturnType<typeof build>, epoch: number) {
    const previous = current
    const native = previous?.server
    let attempted = false
    return {
      persist() {
        for (const artifact of built.artifacts) saveBackendCode(store, artifact)
        store
          .query('UPDATE runtime_publication SET generation = ? WHERE id = 1')
          .run(epoch)
      },
      activate() {
        active()
        blocked = true
        if (native) {
          if (native.port === 0)
            throw new ApiError(503, 'Native runtime listener is unavailable')
          attempted = true
          built.app.server = native
          built.app.compile()
          if (native.port === 0)
            throw new ApiError(503, 'Native runtime listener is unavailable')
          previous.server = null
        }
      },
      commit() {
        current = built.app
        currentGeneration = epoch
        currentReleases = built.releases
        blocked = false
        try {
          executors.publicationCommitted?.()
        } catch {}
      },
      rollback() {
        if (attempted && native) {
          previous.server = native
          built.app.server = null
          try {
            previous.compile()
            blocked = native.port === 0
          } catch {
            blocked = true
          }
        } else blocked = native?.port === 0
      },
    }
  }

  function refreshPublished() {
    active()
    if (blocked) throw new ApiError(503, 'Published runtime is unavailable')
    if (generation() === currentGeneration) return
    let stage: ReturnType<typeof replacement> | undefined
    try {
      const snapshot = store.db.transaction(() => ({
        rows: rows(),
        epoch: generation(),
      }))()
      stage = replacement(build(snapshot.rows, snapshot.epoch), snapshot.epoch)
      stage.activate()
      stage.commit()
    } catch {
      stage?.rollback()
      blocked = true
      throw new ApiError(503, 'Published runtime is unavailable')
    }
  }

  function assertCurrent(release: RuntimeRelease) {
    refreshPublished()
    const selected = currentReleases.get(release.flowId)
    if (
      !selected ||
      selected.revision !== release.revision ||
      flowTransport(selected.definition) !== flowTransport(release.definition)
    )
      throw new ApiError(403, 'Published release changed')
    return currentGeneration
  }

  return {
    refreshPublished,
    currentPublished(flowId: string) {
      return currentReleases.get(flowId) ?? null
    },
    assertCurrent,
    readAdmission<T>(release: RuntimeRelease, authorize: () => T): T {
      const expected = assertCurrent(release)
      return store.db.transaction(() => {
        active()
        if (blocked || generation() !== expected)
          throw new ApiError(
            503,
            'Published runtime changed. Retry this request.',
          )
        const selected = currentReleases.get(release.flowId)
        if (
          !selected ||
          selected.revision !== release.revision ||
          flowTransport(selected.definition) !==
            flowTransport(release.definition)
        )
          throw new ApiError(403, 'Published release changed')
        return authorize()
      })()
    },
    get app() {
      return current
    },
    attach(create: () => AnyElysia) {
      factory = create
      try {
        store.db
          .transaction(() => {
            const epoch = generation()
            const built = build(rows(), epoch)
            for (const artifact of built.artifacts)
              saveBackendCode(store, artifact)
            current = built.app
            currentGeneration = epoch
            currentReleases = built.releases
          })
          .immediate()
      } catch {
        throw new ApiError(503, 'Published runtime could not be generated')
      }
    },
    stage(release: RuntimeRelease) {
      active()
      try {
        const epoch = generation() + 1
        if (!Number.isSafeInteger(epoch))
          throw new Error('Runtime generation limit exceeded')
        const snapshots = rows().filter((row) => row.id !== release.flowId)
        snapshots.push({
          id: release.flowId,
          published_revision: release.revision,
          published: JSON.stringify(release.definition),
        })
        return replacement(build(snapshots, epoch), epoch)
      } catch (error) {
        throw error instanceof ApiError
          ? error
          : new ApiError(503, 'Published runtime could not be generated')
      }
    },
    preflight(request: Request, app: AnyElysia) {
      const url = new URL(request.url)
      const websocket = url.pathname.startsWith('/ws/')
      if (
        !websocket &&
        !url.pathname.startsWith('/run/') &&
        !url.pathname.startsWith('/graphql/')
      )
        return
      // Namespace authentication also applies before the first publication.
      if (websocket && executors.websocketNamespace)
        executors.websocketNamespace(request)
      else if (!store.authenticateRuntime(token(request)))
        throw new ApiError(401, 'Authentication required')
      active()
      if (blocked) throw new ApiError(503, 'Published runtime is unavailable')
      const canonical = decodedRoute(url.pathname)
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      if (websocket && canonical !== url.pathname)
        throw new ApiError(404, 'Endpoint not found')
      refreshPublished()
      if (
        canonical !== url.pathname ||
        app !== current ||
        appGenerations.get(app) !== currentGeneration
      ) {
        const count = (attempts.get(request) ?? 0) + 1
        if (count > 4)
          throw new ApiError(
            503,
            'Published runtime changed. Retry this request.',
          )
        url.pathname = canonical
        const replay =
          canonical === new URL(request.url).pathname
            ? request
            : new Request(url, request)
        attempts.set(replay, count)
        return current.handle(replay)
      }
    },
    close() {
      closed = true
      blocked = true
      try {
        drainCleanup()
      } catch {}
      if (defaultDir) {
        try {
          rmdirSync(directory)
        } catch {}
      }
    },
  }
}

export type RuntimeService = ReturnType<typeof runtimeService>
