import { Elysia, t } from 'elysia'
import { version } from '../package.json'
import { z } from 'zod'
import { permissionCatalog } from './permissions'
import { updateService, type ReleaseFetch } from './updates'
import { openStore, hashToken } from './store'
import { allow, ApiError, requirePermission } from './errors'
import { flowService } from './flows/service'
import { backupService } from './backups'
import { dataSourceService } from './data-sources'
import { loadTestService } from './load-tests'
import { createK6Runner } from './k6'
import type { K6Runner } from './load-test-model'
import type { SheetFetch } from './google-sheets'
import { productAuthService, type OAuthFetch } from './product-auth'
import { timingSafeEqual } from 'node:crypto'
import {
  sessionService,
  sessionCookie,
  browserSecurity,
  optionalAccount,
} from './sessions'

const assignmentFields = {
  editor: { role: z.literal('editor') },
  viewer: { role: z.literal('viewer') },
  custom: { role: z.literal('custom'), roleId: z.string().min(1).max(80) },
}
const memberFields = {
  name: z.string().trim().min(1).max(80),
  email: z.string().max(254).optional(),
  password: z.string().max(128).optional(),
}
const createMemberSchema = z.discriminatedUnion('role', [
  z.object({ ...memberFields, ...assignmentFields.editor }).strict(),
  z.object({ ...memberFields, ...assignmentFields.viewer }).strict(),
  z.object({ ...memberFields, ...assignmentFields.custom }).strict(),
])
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
    ((request.method === 'POST' && path === '/api/data-sources/import') ||
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
  const sources = dataSourceService(store, options.sheetFetch)
  let productAuth: ReturnType<typeof productAuthService>
  try {
    productAuth = productAuthService(store, options)
  } catch (error) {
    store.close()
    throw error
  }
  const flows = flowService(store, sources, productAuth)
  const backups = backupService(store, options.backupDir)
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
    () => (app.server ? `http://127.0.0.1:${app.server.port}` : null),
  )

  const managementActors = new WeakMap<Request, string>()
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

      if (session && !['GET', 'HEAD', 'OPTIONS'].includes(request.method))
        browser.checkWrite(request, session.csrfToken)

      return { member, session }
    })
    .get('/me', ({ member }) => member)
    .get('/permissions', () => permissionCatalog)
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
      return loadTests.targets()
    })
    .get('/load-tests', ({ member }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.list()
    })
    .get('/load-tests/:id', ({ member, params }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.get(params.id)
    })
    .post('/load-tests', ({ member, body, set }) => {
      requirePermission(member, 'load-tests.run')
      const run = loadTests.start(member.id, body)
      set.status = 202
      return run
    })
    .post('/load-tests/:id/cancel', ({ member, params }) => {
      requirePermission(member, 'load-tests.run')
      return loadTests.cancel(params.id)
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
    .delete('/sessions/:id', ({ member, params }) =>
      sessions.revoke(member, params.id),
    )
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
    .get('/data-sources', ({ member }) => {
      requirePermission(member, 'sources.read')
      return sources.list()
    })
    .get('/data-sources/:id', ({ member, params }) => {
      requirePermission(member, 'sources.read')
      return sources.get(params.id)
    })
    .post(
      '/data-sources/import',
      ({ member, body }) => {
        requirePermission(member, 'sources.write')
        return sources.importFile(member.id, body.name, body.file)
      },
      {
        body: t.Object({ name: t.String({ maxLength: 200 }), file: t.File() }),
      },
    )
    .post('/data-sources/:id/api', ({ member, params, body }) => {
      requirePermission(member, 'sources.read')
      requirePermission(member, 'flows.write')
      return flows.create(member.id, sources.api(params.id, body))
    })
    .post(
      '/data-sources/google-sheets',
      ({ member, body }) => {
        requirePermission(member, 'sources.write')
        return sources.importGoogle(member.id, body.name, body.url)
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
      ({ member, params, body }) => {
        requirePermission(member, 'sources.write')
        return sources.importFile(member.id, body.name, body.file, params.id)
      },
      {
        body: t.Object({
          name: t.Optional(t.String({ maxLength: 200 })),
          file: t.File(),
        }),
      },
    )
    .post('/data-sources/:id/refresh', ({ member, params }) => {
      requirePermission(member, 'sources.write')
      return sources.refresh(member.id, params.id)
    })
    .delete('/data-sources/:id', ({ member, params }) => {
      requirePermission(member, 'sources.write')
      return sources.delete(member.id, params.id)
    })
    .get('/flows', ({ member }) => {
      requirePermission(member, 'flows.read')
      return flows.list()
    })
    .get('/flows/:id', ({ member, params }) => {
      requirePermission(member, 'flows.read')
      return flows.get(params.id)
    })
    .get('/flows/:id/releases', ({ member, params }) => {
      requirePermission(member, 'flows.read')
      return flows.releases(params.id)
    })
    .get('/flows/:id/releases/:revision', ({ member, params }) => {
      requirePermission(member, 'flows.read')
      if (
        !/^[1-9]\d*$/.test(params.revision) ||
        !Number.isSafeInteger(Number(params.revision))
      )
        throw new ApiError(400, 'Choose a positive release revision')
      return flows.release(params.id, Number(params.revision))
    })
    .post('/flows/:id/rollback', ({ member, params, body }) => {
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
      )
    })
    .get('/flows/:id/openapi', ({ member, params, request }) => {
      requirePermission(member, 'flows.read')
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
      ({ member, body, params }) => {
        requirePermission(member, 'flows.write')
        return flows.update(member.id, params.id, body.revision, body)
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
      ({ member, params, body }) => {
        requirePermission(member, 'flows.publish')
        return flows.publish(member.id, params.id, body.revision)
      },
      { body: t.Object({ revision: t.Integer({ minimum: 1 }) }) },
    )
    .post(
      '/flows/:id/test',
      ({ member, params, body }) => {
        requirePermission(member, 'flows.test')
        return flows.test(member.id, params.id, body)
      },
      {
        body: t.Object({
          body: t.Any(),
          query: t.Record(t.String(), t.String()),
          params: t.Optional(t.Record(t.String(), t.String())),
        }),
      },
    )
    .get('/members', ({ member }) => {
      allow(member, ['owner'])
      return store.listMembers()
    })
    .put('/members/:id/role', ({ member, params, body }) => {
      allow(member, ['owner'])
      const parsed = assignmentSchema.safeParse(body)
      if (!parsed.success)
        throw new ApiError(400, 'Choose a valid role assignment')
      return store.assignMemberRole(member.id, params.id, parsed.data)
    })
    .post('/flows/:id/graphql/test', ({ member, params, body }) => {
      requirePermission(member, 'flows.test')
      return flows.testGraphql(member.id, params.id, body)
    })
    .post('/members', async ({ member, body }) => {
      allow(member, ['owner'])
      const parsed = createMemberSchema.safeParse(body)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose a member name and valid role assignment',
        )
      const input = parsed.data
      return store.createMember(
        member.id,
        input.name,
        input.role,
        await optionalAccount(input),
        input.role === 'custom' ? input.roleId : undefined,
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
      return store.listRuntimeKeys()
    })
    .post(
      '/runtime-keys',
      ({ member, body }) => {
        requirePermission(member, 'runtime-keys.manage')
        return store.createRuntimeKey(member.id, body)
      },
      {
        body: t.Object({
          name: t.String({ maxLength: 500 }),
          flowId: t.String({ minLength: 1, maxLength: 80 }),
          permissions: t.Array(
            t.Union([
              t.Literal('rest'),
              t.Literal('query'),
              t.Literal('mutation'),
            ]),
            { minItems: 1, maxItems: 3 },
          ),
          expiresAt: t.String({ maxLength: 100 }),
        }),
      },
    )
    .delete('/runtime-keys/:id', ({ member, params }) => {
      requirePermission(member, 'runtime-keys.manage')
      return store.revokeRuntimeKey(member.id, params.id)
    })
    .post('/runtime-keys/:id/rotate', ({ member, params, body }) => {
      requirePermission(member, 'runtime-keys.manage')
      if (
        body !== undefined &&
        (body === null ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length > 0)
      )
        throw new ApiError(400, 'Replacement does not accept settings')

      return store.rotateRuntimeKey(member.id, params.id)
    })
    .get('/migrations', ({ member }) => {
      requirePermission(member, 'migrations.read')
      return store.query('SELECT * FROM migrations ORDER BY version').all()
    })
    .get('/backups', ({ member }) => {
      requirePermission(member, 'backups.manage')
      return backups.list()
    })
    .post('/backups', ({ member }) => {
      requirePermission(member, 'backups.manage')
      return backups.create(member.id)
    })
    .get('/backups/:id', ({ member, params }) => {
      requirePermission(member, 'backups.manage')
      return backups.download(member.id, params.id)
    })

  const app = new Elysia()
    .onStop(() => {
      loadTests.close()
      updates.close()
    })
    .onRequest(async ({ set, request }) => {
      set.headers['cache-control'] = 'no-store'
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['referrer-policy'] = 'no-referrer'
      set.headers['x-frame-options'] = 'DENY'
      set.headers['content-security-policy'] =
        "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
      await boundRequest(request)
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
    .all('/graphql/*', async ({ request, params, body }) => {
      const key = store.authenticateRuntime(bearer(request))
      if (!key) throw new ApiError(401, 'Authentication required')
      if (request.method !== 'POST')
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

      const result = await flows.graphql(key, `/${params['*']}`, body)
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/graphql-response+json' },
      })
    })
    .all('/run/*', async ({ request, body, query }) => {
      const token = bearer(request)
      const key = store.authenticateRuntime(token)
      if (!key) throw new ApiError(401, 'Authentication required')

      const result = await flows.run(
        key,
        request.method,
        new URL(request.url).pathname.slice(4),
        {
          body: body ?? null,
          query,
        },
      )
      const empty =
        request.method === 'HEAD' ||
        result.status === 204 ||
        result.status === 205 ||
        result.status === 304
      return new Response(empty ? null : JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/json' },
      })
    })

  let storeClosed = false
  return {
    app,
    close() {
      if (storeClosed) return
      loadTests.close()
      updates.close()
      store.close()
      storeClosed = true
    },
    setupRequired: store.setupStatus().required,
  }
}
