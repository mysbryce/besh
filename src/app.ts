import { Elysia, t, type AnyElysia } from 'elysia'
import { version } from '../package.json'
import { z } from 'zod'
import {
  can,
  permissionCatalog,
  type Permission,
} from './workspace/permissions'
import { flowAccessSchema, memberAccessSchema } from './workspace/access-input'
import { dependencyService } from './workspace/dependencies'
import { rowPolicyService } from './workspace/row-policy'
import { tenantFieldPolicyService } from './workspace/tenant-field-policy'
import { tenantService } from './workspace/tenants'
import { assertRawResource } from './workspace/raw-access'
import { authorizeFlow } from './workspace/authorization'
import { updateService, type ReleaseFetch } from './updates/service'
import { openStore, hashToken, type Member } from './workspace/store'
import { allow, ApiError, requirePermission } from './errors'
import { flowService } from './flows/service'
import { clientCodeTargets } from './flows/client-code-model'
import { currentBackendCode } from './flows/backend-code'
import { runtimeService } from './flows/runtime'
import { websocketService } from './websockets/service'
import { websocketLimits } from './websockets/protocol'
import { backupService } from './workspace/backups'
import { dataSourceService } from './data/sources'
import { databaseConnectionService } from './databases/service'
import { loadTestService } from './load-tests/service'
import { createK6Runner } from './load-tests/k6'
import type { K6Runner } from './load-tests/model'
import type { SheetFetch } from './data/google-sheets'
import { productAuthService, type OAuthFetch } from './auth/product'
import { timingSafeEqual } from 'node:crypto'
import {
  sessionService,
  sessionCookie,
  browserSecurity,
  optionalAccount,
} from './auth/sessions'

const assignmentFields = {
  editor: { role: z.literal('editor') },
  viewer: { role: z.literal('viewer') },
  custom: { role: z.literal('custom'), roleId: z.string().min(1).max(80) },
}
const memberFields = {
  name: z.string().trim().min(1).max(80),
  email: z.string().max(254).optional(),
  password: z.string().max(128).optional(),
  flowAccess: flowAccessSchema.optional(),
  access: memberAccessSchema.optional(),
  tenantId: z.string().min(1).max(80).nullable().optional(),
}
const createMemberSchema = z
  .discriminatedUnion('role', [
    z.object({ ...memberFields, ...assignmentFields.editor }).strict(),
    z.object({ ...memberFields, ...assignmentFields.viewer }).strict(),
    z.object({ ...memberFields, ...assignmentFields.custom }).strict(),
  ])
  .refine(
    (value) => value.access === undefined || value.flowAccess === undefined,
  )
const assignmentSchema = z.discriminatedUnion('role', [
  z.object(assignmentFields.editor).strict(),
  z.object(assignmentFields.viewer).strict(),
  z.object(assignmentFields.custom).strict(),
])

function bearer(request: Request) {
  return (
    request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] ?? ''
  )
}

async function boundRequest(request: Request) {
  if (!request.body) return
  const path = new URL(request.url).pathname
  const upload =
    request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('multipart/form-data') &&
    ((request.method === 'POST' &&
      (path === '/api/data-sources/import' ||
        path === '/api/database-connections')) ||
      (request.method === 'PUT' &&
        /^\/api\/data-sources\/[^/]+\/import$/.test(path)))
  const limit = upload ? 3 * 1024 * 1024 : 262_144
  if (Number(request.headers.get('content-length')) > limit)
    throw new ApiError(413, 'Request body size limit exceeded')
  if (upload) return
  const reader = request.clone().body!.getReader()
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit)
        throw new ApiError(413, 'Request body size limit exceeded')
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}

export type AppOptions = {
  runtimeCodeDir?: string
  configureApp?: (app: AnyElysia) => void
  databasePath: string
  backupDir: string
  adminToken?: string
  setupKey?: string
  sheetFetch?: SheetFetch
  authOrigin?: string
  now?: () => number
  updateFetch?: ReleaseFetch
  oauthFetch?: OAuthFetch
  secretKeyPath?: string
  k6Runner?: K6Runner
  k6BinaryPath?: string
  k6CacheDir?: string
}

export function createApp(options: AppOptions) {
  const browser = browserSecurity(options.authOrigin)
  const store = openStore(options.databasePath, options.adminToken)
  const sessions = sessionService(store, options.now)
  const dependencies = dependencyService(store)
  const rowPolicies = rowPolicyService(store)
  const tenantFields = tenantFieldPolicyService(store)
  const tenants = tenantService(store)
  const sources = dataSourceService(store, options.sheetFetch)
  const databases = databaseConnectionService(store)
  let productAuth: ReturnType<typeof productAuthService>
  try {
    productAuth = productAuthService(store, options)
  } catch (error) {
    store.close()
    throw error
  }
  let runtime: ReturnType<typeof runtimeService>
  try {
    runtime = runtimeService(store, options.runtimeCodeDir, {
      rest: (key, release, path, input, signal) =>
        flows.run(key, release, path, input, signal),
      graphql: (key, release, input, signal) =>
        flows.graphql(key, release, input, signal),
      websocket: (release) => websockets.options(release),
      websocketNamespace: (request) => websockets.namespace(request),
      websocketTicket: (release, _epoch, request, body) =>
        websockets.mintPublished(release, request, body),
      websocketHttp: (release, _epoch, request) =>
        websockets.http(release, request),
      publicationCommitted: () => websockets.publicationCommitted(),
    })
  } catch (error) {
    void databases.close()
    store.close()
    throw error
  }
  const flows = flowService(store, sources, productAuth, databases, runtime)
  let websockets: ReturnType<typeof websocketService>
  try {
    websockets = websocketService(
      store,
      runtime,
      (release, body, signal, authorize) =>
        flows.websocket(release, body, signal, authorize),
      {
        sessions,
        checkOrigin: (request) => browser.checkOrigin(request),
        snapshot: (id) => flows.websocketDraft(id),
        validate: (definition) => flows.validateWebSocketDraft(definition),
        execute: (release, body, signal, authorize, tenantId) =>
          flows.testWebSocket(release, body, signal, authorize, tenantId),
      },
    )
  } catch (error) {
    runtime.close()
    flows.close()
    void databases.close()
    store.close()
    throw error
  }
  const backups = backupService(store, options.backupDir, (actor) => {
    const member = store.member(actor)
    if (!member) throw new ApiError(401, 'Authentication required')
    requireBackup(member)
  })
  const updates = updateService(store, {
    fetch: options.updateFetch,
    now: options.now,
  })
  const loadTests = loadTestService(
    store,
    options.k6Runner ??
      createK6Runner({
        binaryPath: options.k6BinaryPath,
        cacheDir: options.k6CacheDir,
      }),
    () =>
      runtime.app.server ? `http://127.0.0.1:${runtime.app.server.port}` : null,
  )

  const managementActors = new WeakMap<Request, string>()
  function requireBackup(member: Member) {
    requirePermission(member, 'backups.manage')
    const state = store
      .query<{ backups_owner_only: number }, []>(
        'SELECT backups_owner_only FROM row_protection_state WHERE id = 1',
      )
      .get()
    if (!state) throw new ApiError(503, 'Row protection state is unavailable')
    if (state.backups_owner_only && member.role !== 'owner')
      throw new ApiError(403, 'Workspace backups require the owner')
  }
  function requireFlowRead(member: Member, id: string) {
    authorizeFlow(member, id, 'flows.read')
  }
  function enforceSelectedAccess(member: Member, request: Request) {
    if (member.flowAccess.mode !== 'selected') return
    const path = new URL(request.url).pathname
    const read = request.method === 'GET' || request.method === 'HEAD'
    const draftSocket = /^\/api\/flows\/([^/]+)\/ws\/test(-ticket)?$/.exec(path)
    if (
      draftSocket &&
      ((request.method === 'POST' && draftSocket[2]) ||
        (read && !draftSocket[2]))
    ) {
      let id = ''
      try {
        id = decodeURIComponent(draftSocket[1]!)
      } catch {}
      authorizeFlow(member, id, 'flows.test')
      return
    }
    if (
      read &&
      /^\/api\/dependencies\/(sources|database-connections|auth-connections)(\/[^/]+)?$/.test(
        path,
      )
    )
      return
    if (
      (path === '/api/load-tests' && (read || request.method === 'POST')) ||
      (path === '/api/load-tests/targets' && read)
    ) {
      requirePermission(member, 'load-tests.run')
      return
    }
    const run = /^\/api\/load-tests\/([^/]+)(\/cancel)?$/.exec(path)
    if (run && ((read && !run[2]) || (request.method === 'POST' && run[2]))) {
      let id = ''
      try {
        id = decodeURIComponent(run[1])
      } catch {}
      loadTests.assertAccess(member, id)
      return
    }
    if (path === '/api/runtime-keys' && (read || request.method === 'POST')) {
      requirePermission(member, 'runtime-keys.manage')
      return
    }
    const key = /^\/api\/runtime-keys\/([^/]+)(\/rotate)?$/.exec(path)
    if (
      key &&
      ((request.method === 'DELETE' && !key[2]) ||
        (request.method === 'POST' && key[2]))
    ) {
      let id = ''
      try {
        id = decodeURIComponent(key[1])
      } catch {}
      store.assertKeyAccess(member, id)
      return
    }
    if (
      (read &&
        [
          '/api/me',
          '/api/account',
          '/api/sessions',
          '/api/permissions',
          '/api/tenant-context',
        ].includes(path)) ||
      (request.method === 'PUT' && path === '/api/account') ||
      (request.method === 'DELETE' && /^\/api\/sessions\/[^/]+$/.test(path))
    )
      return
    if (read && ['/api/flows', '/api/client-code/targets'].includes(path)) {
      requirePermission(member, 'flows.read')
      return
    }
    const operation =
      /^\/api\/flows\/([^/]+)(\/publish|\/rollback|\/test|\/graphql\/test)?$/.exec(
        path,
      )
    if (
      operation &&
      ((request.method === 'PUT' && !operation[2]) ||
        (request.method === 'POST' && operation[2]))
    ) {
      const permission =
        request.method === 'PUT'
          ? 'flows.write'
          : ['/publish', '/rollback'].includes(operation[2])
            ? 'flows.publish'
            : 'flows.test'
      let id = ''
      try {
        id = decodeURIComponent(operation[1])
      } catch {}
      authorizeFlow(member, id, permission)
      return
    }
    const flow =
      /^\/api\/flows\/([^/]+)(\/releases(?:\/[^/]+)?|\/openapi|\/client-code|\/backend-code|\/row-access)?$/.exec(
        path,
      )
    if (
      flow &&
      (read || (request.method === 'POST' && flow[2] === '/client-code'))
    ) {
      let id = ''
      try {
        id = decodeURIComponent(flow[1])
      } catch {}
      if (flow[2] === '/row-access') {
        const permission = (
          [
            'flows.read',
            'flows.write',
            'flows.test',
            'flows.publish',
            'runtime-keys.manage',
            'load-tests.run',
          ] as const
        ).find((permission) => can(member, permission))
        if (!permission) throw new ApiError(403, 'Permission denied')
        authorizeFlow(member, id, permission)
      } else requireFlowRead(member, id)
      return
    }
    throw new ApiError(403, 'Permission denied')
  }
  function currentPermission(request: Request, permission: Permission) {
    const current = currentMember(request)
    requirePermission(current, permission)
  }
  function currentRawPermission(
    request: Request,
    family: 'sources' | 'database-connections',
    id: string,
    permissions: readonly Permission[],
  ) {
    const current = currentMember(request)
    for (const permission of permissions) requirePermission(current, permission)
    assertRawResource(store, current, family, id)
  }
  function currentMember(request: Request) {
    const current = request.headers.has('authorization')
      ? store.authenticate(bearer(request))
      : sessions.restore(sessionCookie(request))?.member
    if (!current) throw new ApiError(401, 'Authentication required')
    return current
  }
  const management = new Elysia({ prefix: '/api' })
    .resolve(({ request, status }) => {
      const token = bearer(request)
      const session = request.headers.has('authorization')
        ? null
        : sessions.restore(sessionCookie(request))
      const member = request.headers.has('authorization')
        ? store.authenticate(token)
        : session?.member

      if (!member) {
        store.audit(store.runtimeActor(token), 'access.denied', 'management')
        return status(401, { error: 'Authentication required' })
      }

      managementActors.set(request, member.id)
      if (member.role !== 'owner') {
        const path = new URL(request.url).pathname
        const key = /^\/api\/runtime-keys\/([^/]+)(\/rotate)?$/.exec(path)
        if (
          key &&
          ((request.method === 'POST' && key[2]) ||
            (request.method === 'DELETE' && !key[2]))
        ) {
          let id = ''
          try {
            id = decodeURIComponent(key[1])
          } catch {}
          store.assertKeyAccess(member, id)
        }
        const job = /^\/api\/load-tests\/([^/]+)(\/cancel)?$/.exec(path)
        if (
          job &&
          job[1] !== 'targets' &&
          ((['GET', 'HEAD'].includes(request.method) && !job[2]) ||
            (request.method === 'POST' && job[2]))
        ) {
          let id = ''
          try {
            id = decodeURIComponent(job[1])
          } catch {}
          loadTests.assertAccess(member, id)
        }
      }
      const raw =
        /^\/api\/(data-sources|database-connections)\/([^/]+)(?:\/(?:import|refresh|preview|check|api))?$/.exec(
          new URL(request.url).pathname,
        )
      if (
        raw &&
        !(
          raw[1] === 'data-sources' &&
          request.method === 'POST' &&
          ['import', 'google-sheets'].includes(raw[2])
        )
      ) {
        let id = ''
        try {
          id = decodeURIComponent(raw[2])
        } catch {}
        assertRawResource(
          store,
          member,
          raw[1] === 'data-sources' ? 'sources' : 'database-connections',
          id,
        )
      }
      enforceSelectedAccess(member, request)

      if (session && !['GET', 'HEAD', 'OPTIONS'].includes(request.method))
        browser.checkWrite(request, session.csrfToken)

      return { member, session }
    })
    .get('/me', ({ member }) => member)
    .post('/flows/:id/ws/test-ticket', ({ member, params, request, body }) => {
      authorizeFlow(member, params.id, 'flows.test')
      return websockets.mintDraft(params.id, request, body)
    })
    .ws('/flows/:id/ws/test', websockets.draftOptions())
    .get('/tenant-context', ({ member }) => tenants.context(member.id))
    .get('/tenants', ({ member }) => {
      allow(member, ['owner'])
      return tenants.list()
    })
    .post('/tenants', ({ member, body, request }) => {
      allow(member, ['owner'])
      return tenants.create(member.id, body, () =>
        allow(currentMember(request), ['owner']),
      )
    })
    .put('/tenants/:id', ({ member, params, body, request }) => {
      allow(member, ['owner'])
      return tenants.update(member.id, params.id, body, () =>
        allow(currentMember(request), ['owner']),
      )
    })
    .put('/members/:id/tenant', ({ member, params, body, request }) => {
      allow(member, ['owner'])
      return tenants.assign(member.id, params.id, body, () =>
        allow(currentMember(request), ['owner']),
      )
    })
    .get('/data-sources/:id/tenant-fields', ({ member, params }) => {
      allow(member, ['owner'])
      return tenantFields.sourceSummary(params.id)
    })
    .get('/data-sources/:id/tenant-fields/:tenantId', ({ member, params }) => {
      allow(member, ['owner'])
      return tenantFields.source(params.id, params.tenantId)
    })
    .put(
      '/data-sources/:id/tenant-fields/:tenantId',
      ({ member, params, body, request }) => {
        allow(member, ['owner'])
        return tenantFields.updateSource(
          member.id,
          params.id,
          params.tenantId,
          body,
          () => allow(currentMember(request), ['owner']),
        )
      },
    )
    .get('/data-sources/:id/row-policy', ({ member, params }) => {
      allow(member, ['owner'])
      return rowPolicies.source(params.id)
    })
    .put(
      '/data-sources/:id/row-policy',
      ({ member, params, body, request }) => {
        allow(member, ['owner'])
        return rowPolicies.updateSource(member.id, params.id, body, () =>
          allow(currentMember(request), ['owner']),
        )
      },
    )
    .get('/database-connections/:id/tenant-fields', ({ member, params }) => {
      allow(member, ['owner'])
      return tenantFields.databaseSummary(params.id)
    })
    .get(
      '/database-connections/:id/tenant-fields/:tenantId',
      ({ member, params }) => {
        allow(member, ['owner'])
        return tenantFields.database(params.id, params.tenantId)
      },
    )
    .put(
      '/database-connections/:id/tenant-fields/:tenantId',
      ({ member, params, body, request }) => {
        allow(member, ['owner'])
        return tenantFields.updateDatabase(
          member.id,
          params.id,
          params.tenantId,
          body,
          () => allow(currentMember(request), ['owner']),
        )
      },
    )
    .get('/database-connections/:id/row-policy', ({ member, params }) => {
      allow(member, ['owner'])
      return rowPolicies.database(params.id)
    })
    .put(
      '/database-connections/:id/row-policy',
      ({ member, params, body, request }) => {
        allow(member, ['owner'])
        return rowPolicies.updateDatabase(member.id, params.id, body, () =>
          allow(currentMember(request), ['owner']),
        )
      },
    )
    .get('/permissions', () => permissionCatalog)
    .get('/dependencies/sources', ({ member }) =>
      dependencies.catalog(member, 'sources'),
    )
    .get('/dependencies/sources/:id', ({ member, params }) =>
      dependencies.catalog(member, 'sources', params.id),
    )
    .get('/dependencies/database-connections', ({ member }) =>
      dependencies.catalog(member, 'database-connections'),
    )
    .get('/dependencies/database-connections/:id', ({ member, params }) =>
      dependencies.catalog(member, 'database-connections', params.id),
    )
    .get('/dependencies/auth-connections', ({ member }) =>
      dependencies.catalog(member, 'auth-connections'),
    )
    .get('/dependencies/auth-connections/:id', ({ member, params }) =>
      dependencies.catalog(member, 'auth-connections', params.id),
    )
    .get('/client-code/targets', ({ member }) => {
      requirePermission(member, 'flows.read')
      return clientCodeTargets
    })
    .get('/flows/:id/client-code', ({ member, params, request }) => {
      requireFlowRead(member, params.id)
      const sources = new URL(request.url).searchParams.getAll('source')
      if (sources.length > 1)
        throw new ApiError(400, 'Choose one example source')
      return flows.clientCodeMetadata(params.id, sources[0])
    })
    .get('/flows/:id/backend-code', ({ member, params, request }) => {
      requireFlowRead(member, params.id)
      const query = new URL(request.url).searchParams
      const revisions = query.getAll('revision')
      if (
        [...query.keys()].some((key) => key !== 'revision') ||
        revisions.length > 1 ||
        (revisions.length &&
          (!/^[1-9][0-9]*$/.test(revisions[0]) ||
            !Number.isSafeInteger(Number(revisions[0]))))
      )
        throw new ApiError(
          400,
          'Choose an optional positive safe expected published revision',
        )
      return currentBackendCode(
        store,
        params.id,
        revisions.length ? Number(revisions[0]) : undefined,
      )
    })
    .post('/flows/:id/client-code', ({ member, params, body }) => {
      requireFlowRead(member, params.id)
      return flows.clientCode(params.id, body)
    })
    .get('/updates', ({ member }) => {
      allow(member, ['owner'])
      return updates.get()
    })
    .put('/updates', ({ member, body }) => {
      allow(member, ['owner'])
      return updates.save(member.id, body)
    })
    .post('/updates/check', ({ member, body }) => {
      allow(member, ['owner'])
      return updates.check(member.id, body)
    })
    .get('/roles', ({ member }) => {
      allow(member, ['owner'])
      return store.listRoles()
    })
    .post('/roles', ({ member, body }) => {
      allow(member, ['owner'])
      return store.createRole(member.id, body)
    })
    .put('/roles/:id', ({ member, params, body }) => {
      allow(member, ['owner'])
      return store.updateRole(member.id, params.id, body)
    })
    .delete('/roles/:id', ({ member, params, body }) => {
      allow(member, ['owner'])
      return store.deleteRole(member.id, params.id, body)
    })
    .get('/load-tests/targets', ({ member }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.targets(member)
    })
    .get('/load-tests', ({ member }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.list(member)
    })
    .get('/load-tests/:id', ({ member, params }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.get(params.id, member)
    })
    .post('/load-tests', ({ member, body, set, request }) => {
      requirePermission(member, 'load-tests.run')
      const run = loadTests.start(member.id, body, () => currentMember(request))
      set.status = 202
      return run
    })
    .post('/load-tests/:id/cancel', ({ member, params, request }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.cancel(params.id, member.id, () =>
        currentMember(request),
      )
    })
    .get('/auth-connections', ({ member }) => {
      requirePermission(member, 'auth-connections.read')
      return productAuth.list()
    })
    .post('/auth-connections', ({ member, body }) => {
      requirePermission(member, 'auth-connections.manage')
      return productAuth.create(member.id, body)
    })
    .put('/auth-connections/:id', ({ member, params, body }) => {
      requirePermission(member, 'auth-connections.manage')
      return productAuth.update(member.id, params.id, body)
    })
    .delete('/auth-connections/:id', ({ member, params }) => {
      requirePermission(member, 'auth-connections.manage')
      return productAuth.delete(member.id, params.id)
    })
    .post('/auth-connections/:id/generate', ({ member, params, body }) => {
      requirePermission(member, 'auth-connections.read')
      requirePermission(member, 'flows.write')
      return store.db.transaction(() =>
        flows.create(member.id, productAuth.template(params.id, body)),
      )()
    })
    .get('/sessions', ({ member, session }) =>
      sessions.list(member, session?.sessionId),
    )
    .delete('/sessions/:id', ({ member, params }) => {
      if (
        member.flowAccess.mode === 'selected' &&
        !sessions.list(member).some((session) => session.id === params.id)
      )
        throw new ApiError(404, 'Session not found')
      return sessions.revoke(member, params.id)
    })
    .get('/account', ({ member }) => sessions.account(member.id))
    .put(
      '/account',
      ({ member, session, body }) =>
        sessions.updateAccount(member, session?.sessionId, body),
      {
        body: t.Object({
          email: t.String({ maxLength: 254 }),
          password: t.String({ maxLength: 128 }),
          currentPassword: t.Optional(t.String({ maxLength: 128 })),
          token: t.Optional(t.String({ maxLength: 200 })),
        }),
      },
    )
    .get('/database-connections', ({ member }) => {
      requirePermission(member, 'database-connections.read')
      return databases.list(member)
    })
    .get('/database-connections/:id', ({ member, params }) => {
      requirePermission(member, 'database-connections.read')
      return databases.get(params.id)
    })
    .post(
      '/database-connections',
      ({ member, body, request }) => {
        requirePermission(member, 'database-connections.manage')
        return databases.create(
          member.id,
          body.name,
          body.file,
          () => {
            currentPermission(request, 'database-connections.manage')
          },
          request.signal,
        )
      },
      {
        body: t.Object(
          { name: t.String({ maxLength: 200 }), file: t.File() },
          { additionalProperties: false },
        ),
      },
    )
    .post(
      '/database-connections/:id/preview',
      ({ member, params, body, request }) => {
        requirePermission(member, 'database-connections.read')
        return databases.preview(params.id, body, request.signal, () =>
          currentRawPermission(request, 'database-connections', params.id, [
            'database-connections.read',
          ]),
        )
      },
    )
    .post(
      '/database-connections/:id/api',
      ({ member, params, body, request }) => {
        requirePermission(member, 'database-connections.read')
        requirePermission(member, 'flows.write')
        return store.db
          .transaction(() => {
            currentRawPermission(request, 'database-connections', params.id, [
              'database-connections.read',
              'flows.write',
            ])
            return flows.create(member.id, databases.api(params.id, body))
          })
          .immediate()
      },
    )
    .post(
      '/database-connections/:id/check',
      ({ member, params, body, request }) => {
        requirePermission(member, 'database-connections.manage')
        return databases.check(
          member.id,
          params.id,
          body,
          () => {
            currentRawPermission(request, 'database-connections', params.id, [
              'database-connections.manage',
            ])
          },
          request.signal,
        )
      },
    )
    .delete(
      '/database-connections/:id',
      ({ member, params, body, request }) => {
        requirePermission(member, 'database-connections.manage')
        return databases.delete(member.id, params.id, body, () =>
          currentRawPermission(request, 'database-connections', params.id, [
            'database-connections.manage',
          ]),
        )
      },
    )
    .get('/data-sources', ({ member }) => {
      requirePermission(member, 'sources.read')
      return sources.list(member)
    })
    .get('/data-sources/:id', ({ member, params }) => {
      requirePermission(member, 'sources.read')
      return sources.get(params.id)
    })
    .post(
      '/data-sources/import',
      ({ member, body, request }) => {
        requirePermission(member, 'sources.write')
        return sources.importFile(
          member.id,
          body.name,
          body.file,
          undefined,
          () => currentPermission(request, 'sources.write'),
        )
      },
      {
        body: t.Object({ name: t.String({ maxLength: 200 }), file: t.File() }),
      },
    )
    .post('/data-sources/:id/api', ({ member, params, body, request }) => {
      requirePermission(member, 'sources.read')
      requirePermission(member, 'flows.write')
      return store.db
        .transaction(() => {
          currentRawPermission(request, 'sources', params.id, [
            'sources.read',
            'flows.write',
          ])
          return flows.create(member.id, sources.api(params.id, body))
        })
        .immediate()
    })
    .post(
      '/data-sources/google-sheets',
      ({ member, body, request }) => {
        requirePermission(member, 'sources.write')
        return sources.importGoogle(member.id, body.name, body.url, () =>
          currentPermission(request, 'sources.write'),
        )
      },
      {
        body: t.Object({
          name: t.String({ maxLength: 200 }),
          url: t.String({ maxLength: 1000 }),
        }),
      },
    )
    .put(
      '/data-sources/:id/import',
      ({ member, params, body, request }) => {
        requirePermission(member, 'sources.write')
        return sources.importFile(
          member.id,
          body.name,
          body.file,
          params.id,
          () => {
            const current = currentMember(request)
            requirePermission(current, 'sources.write')
            assertRawResource(store, current, 'sources', params.id)
          },
        )
      },
      {
        body: t.Object({
          name: t.Optional(t.String({ maxLength: 200 })),
          file: t.File(),
        }),
      },
    )
    .post('/data-sources/:id/refresh', ({ member, params, request }) => {
      requirePermission(member, 'sources.write')
      return sources.refresh(member.id, params.id, () => {
        const current = currentMember(request)
        requirePermission(current, 'sources.write')
        assertRawResource(store, current, 'sources', params.id)
      })
    })
    .delete('/data-sources/:id', ({ member, params, request }) => {
      requirePermission(member, 'sources.write')
      return sources.delete(member.id, params.id, () =>
        currentRawPermission(request, 'sources', params.id, ['sources.write']),
      )
    })
    .get('/flows', ({ member }) => {
      requirePermission(member, 'flows.read')
      return flows.list(
        member.flowAccess.mode === 'selected' ? member.id : undefined,
      )
    })
    .get('/flows/:id', ({ member, params }) => {
      requireFlowRead(member, params.id)
      return flows.get(params.id)
    })
    .get('/flows/:id/row-access', ({ member, params, request }) =>
      flows.rowAccess(member, params.id, new URL(request.url)),
    )
    .get('/flows/:id/releases', ({ member, params }) => {
      requireFlowRead(member, params.id)
      return flows.releases(params.id)
    })
    .get('/flows/:id/releases/:revision', ({ member, params }) => {
      requireFlowRead(member, params.id)
      if (
        !/^[1-9]\d*$/.test(params.revision) ||
        !Number.isSafeInteger(Number(params.revision))
      )
        throw new ApiError(400, 'Choose a positive release revision')
      return flows.release(params.id, Number(params.revision))
    })
    .post('/flows/:id/rollback', ({ member, params, body, request }) => {
      requirePermission(member, 'flows.publish')
      const result = z
        .object({
          revision: z.number().int().positive().safe(),
          publishedRevision: z.number().int().positive().safe(),
        })
        .strict()
        .safeParse(body)
      if (!result.success)
        throw new ApiError(
          400,
          'Provide target and expected published revisions',
        )
      return flows.rollback(
        member.id,
        params.id,
        result.data.revision,
        result.data.publishedRevision,
        () => currentMember(request),
      )
    })
    .get('/flows/:id/openapi', ({ member, params, request }) => {
      requireFlowRead(member, params.id)
      const selections = new URL(request.url).searchParams.getAll('source')
      if (selections.length > 1)
        throw new ApiError(400, 'Choose one OpenAPI source')
      const specification = flows.openapi(params.id, selections[0])
      const safeId = params.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
      return new Response(JSON.stringify(specification, null, 2), {
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="besh-${safeId}-openapi.json"`,
        },
      })
    })
    .post('/flows', ({ member, body }) => {
      requirePermission(member, 'flows.write')
      return flows.create(member.id, body)
    })
    .put(
      '/flows/:id',
      ({ member, body, params, request }) => {
        requirePermission(member, 'flows.write')
        return flows.update(member.id, params.id, body.revision, body, () =>
          currentMember(request),
        )
      },
      {
        body: t.Object(
          { revision: t.Integer({ minimum: 1 }) },
          { additionalProperties: true },
        ),
      },
    )
    .post(
      '/flows/:id/publish',
      ({ member, params, body, request }) => {
        requirePermission(member, 'flows.publish')
        return flows.publish(member.id, params.id, body.revision, () =>
          currentMember(request),
        )
      },
      { body: t.Object({ revision: t.Integer({ minimum: 1 }) }) },
    )
    .post(
      '/flows/:id/test',
      ({ member, params, body, request }) => {
        requirePermission(member, 'flows.test')
        const { tenantId, ...input } = body
        return flows.test(
          member.id,
          params.id,
          input,
          request.signal,
          () => currentMember(request),
          tenantId,
        )
      },
      {
        body: t.Object({
          body: t.Any(),
          query: t.Record(t.String(), t.String()),
          params: t.Optional(t.Record(t.String(), t.String())),
          tenantId: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        }),
      },
    )
    .get('/members', ({ member }) => {
      allow(member, ['owner'])
      return store.listMembers()
    })
    .put('/members/:id/flow-access', ({ member, params, body }) => {
      allow(member, ['owner'])
      return store.updateFlowAccess(member.id, params.id, body)
    })
    .put('/members/:id/access', ({ member, params, body }) => {
      allow(member, ['owner'])
      return store.updateAccess(member.id, params.id, body)
    })
    .put('/members/:id/role', ({ member, params, body }) => {
      allow(member, ['owner'])
      const parsed = assignmentSchema.safeParse(body)
      if (!parsed.success)
        throw new ApiError(400, 'Choose a valid role assignment')
      return store.assignMemberRole(member.id, params.id, parsed.data)
    })
    .post('/flows/:id/graphql/test', ({ member, params, body, request }) => {
      requirePermission(member, 'flows.test')
      const input = z
        .object({ tenantId: z.string().min(1).max(80).optional() })
        .passthrough()
        .safeParse(body)
      if (!input.success)
        throw new ApiError(400, 'Provide a valid GraphQL test request')
      const { tenantId, ...operation } = input.data
      return flows.testGraphql(
        member.id,
        params.id,
        operation,
        request.signal,
        () => currentMember(request),
        tenantId,
      )
    })
    .post('/members', async ({ member, body, request }) => {
      allow(member, ['owner'])
      const parsed = createMemberSchema.safeParse(body)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose a member name and valid role assignment',
        )
      const input = parsed.data
      const account = await optionalAccount(input)
      allow(currentMember(request), ['owner'])
      return store.createMember(
        member.id,
        input.name,
        input.role,
        account,
        input.role === 'custom' ? input.roleId : undefined,
        input.flowAccess,
        input.access,
        input.tenantId,
        () => currentMember(request),
      )
    })
    .delete('/members/:id', ({ member, params }) => {
      allow(member, ['owner'])
      return store.revokeMember(member.id, params.id)
    })
    .get('/audit', ({ member }) => {
      requirePermission(member, 'audit.read')
      return store.listAudit()
    })
    .get('/runtime-keys', ({ member }) => {
      requirePermission(member, 'runtime-keys.manage')
      return store.listRuntimeKeys(member)
    })
    .post('/runtime-keys', ({ member, body, request }) => {
      requirePermission(member, 'runtime-keys.manage')
      return store.createRuntimeKey(member.id, body, () =>
        currentMember(request),
      )
    })
    .delete('/runtime-keys/:id', ({ member, params, request }) => {
      requirePermission(member, 'runtime-keys.manage')
      return store.revokeRuntimeKey(member.id, params.id, () =>
        currentMember(request),
      )
    })
    .post('/runtime-keys/:id/rotate', ({ member, params, body, request }) => {
      requirePermission(member, 'runtime-keys.manage')
      const settings = z
        .object({ graceSeconds: z.number().int().min(0).max(300).default(0) })
        .strict()
        .safeParse(body === undefined ? {} : body)
      if (!settings.success)
        throw new ApiError(
          400,
          'Choose a whole-number handover time from 0 to 300 seconds',
        )

      return store.rotateRuntimeKey(
        member.id,
        params.id,
        () => currentMember(request),
        settings.data.graceSeconds,
      )
    })
    .get('/migrations', ({ member }) => {
      requirePermission(member, 'migrations.read')
      return store.query('SELECT * FROM migrations ORDER BY version').all()
    })
    .get('/backups', ({ member, request }) => {
      requireBackup(member)
      return backups.list(member.id, () =>
        requireBackup(currentMember(request)),
      )
    })
    .post('/backups', ({ member, request }) => {
      requireBackup(member)
      return backups.create(member.id, () =>
        requireBackup(currentMember(request)),
      )
    })
    .get('/backups/:id', ({ member, params, request }) => {
      requireBackup(member)
      return backups.download(member.id, params.id, () =>
        requireBackup(currentMember(request)),
      )
    })

  const buildApp = () => {
    let app: AnyElysia
    app = new Elysia({
      systemRouter: false,
      strictPath: true,
      precompile: true,
      websocket: websocketLimits,
    })
      .onStop(() => {
        websockets.beginShutdown()
        runtime.close()
        loadTests.close()
        updates.close()
        flows.close()
        return databases.close()
      })
      .onRequest(async ({ set, request }) => {
        if (storeClosed) throw new ApiError(503, 'Workspace is shutting down')
        set.headers['cache-control'] = 'no-store'
        set.headers['x-content-type-options'] = 'nosniff'
        set.headers['referrer-policy'] = 'no-referrer'
        set.headers['x-frame-options'] = 'DENY'
        set.headers['content-security-policy'] =
          "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
        await boundRequest(request)
        if (new URL(request.url).pathname.startsWith('/api/')) {
          const member = request.headers.has('authorization')
            ? store.authenticate(bearer(request))
            : sessions.restore(sessionCookie(request))?.member
          if (member?.flowAccess.mode === 'selected') {
            managementActors.set(request, member.id)
            enforceSelectedAccess(member, request)
          }
        }
        return runtime.preflight(request, app)
      })
      .onError(({ error, code, set, request }) => {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) {
            const token = bearer(request)
            store.audit(
              managementActors.get(request) ??
                store.authenticate(token)?.id ??
                store.runtimeActor(token),
              'access.denied',
              'api',
            )
          }
          set.status = error.status
          return new URL(request.url).pathname.startsWith('/graphql/')
            ? { errors: [{ message: error.message }] }
            : { error: error.message }
        }

        set.status =
          code === 'NOT_FOUND'
            ? 404
            : code === 'VALIDATION' || code === 'PARSE'
              ? 400
              : 500
        const message =
          code === 'NOT_FOUND'
            ? 'Not found'
            : code === 'VALIDATION' || code === 'PARSE'
              ? 'Invalid request'
              : 'Internal server error'
        return new URL(request.url).pathname.startsWith('/graphql/')
          ? { errors: [{ message }] }
          : { error: message }
      })
      .get('/health', () => ({ status: 'ok', version }))
      .post(
        '/auth/login',
        async ({ body, set, request }) => {
          browser.checkOrigin(request)
          const result = await sessions.login(body)
          set.headers['set-cookie'] = browser.cookie(request, result.secret)
          return result.session
        },
        {
          body: t.Object({
            token: t.Optional(t.String({ maxLength: 200 })),
            email: t.Optional(t.String({ maxLength: 254 })),
            password: t.Optional(t.String({ maxLength: 128 })),
          }),
        },
      )
      .get('/auth/session', ({ request }) => {
        const session = sessions.restore(sessionCookie(request))
        if (!session) throw new ApiError(401, 'Authentication required')
        return session
      })
      .post('/auth/logout', ({ request, set }) => {
        const session = sessions.restore(sessionCookie(request))
        if (!session) throw new ApiError(401, 'Authentication required')
        browser.checkWrite(request, session.csrfToken)
        const result = sessions.revoke(session.member, session.sessionId)
        set.headers['set-cookie'] = browser.cookie(request)
        return result
      })
      .get('/setup/status', () => store.setupStatus())
      .post(
        '/setup',
        async ({ body }) => {
          if (!store.setupStatus().required)
            throw new ApiError(409, 'Workspace already configured')
          if (
            !options.setupKey ||
            !timingSafeEqual(
              Buffer.from(hashToken(body.key)),
              Buffer.from(hashToken(options.setupKey)),
            )
          )
            throw new ApiError(
              403,
              'Open the setup link from your server terminal',
            )
          return store.setup(body.name.trim(), await optionalAccount(body))
        },
        {
          body: t.Object({
            key: t.String({ maxLength: 200 }),
            name: t.String({ minLength: 1, maxLength: 80, pattern: '\\S' }),
            email: t.Optional(t.String({ maxLength: 254 })),
            password: t.Optional(t.String({ maxLength: 128 })),
          }),
        },
      )
      .use(management)

    options.configureApp?.(app)
    return app
  }
  try {
    runtime.attach(buildApp)
  } catch (error) {
    websockets.close()
    runtime.close()
    loadTests.close()
    updates.close()
    flows.close()
    void databases.close()
    store.close()
    throw error
  }

  let storeClosed = false
  let shutdown: Promise<void> | undefined
  return {
    get app() {
      return runtime.app
    },
    beginShutdown() {
      websockets.beginShutdown()
    },
    close() {
      if (storeClosed) return shutdown!
      websockets.close()
      runtime.close()
      loadTests.close()
      updates.close()
      flows.close()
      shutdown = databases.close()
      store.close()
      storeClosed = true
      return shutdown
    },
    setupRequired: store.setupStatus().required,
  }
}
