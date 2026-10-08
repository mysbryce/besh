import { Elysia, t } from 'elysia'
import { openStore, hashToken } from './store'
import { allow, ApiError } from './errors'
import { flowService } from './flows/service'
import { backupService } from './backups'
import { timingSafeEqual } from 'node:crypto'

function bearer(request: Request) {
  return (
    request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1] ?? ''
  )
}

export type AppOptions = {
  databasePath: string
  backupDir: string
  adminToken?: string
  setupKey?: string
}

export function createApp(options: AppOptions) {
  const store = openStore(options.databasePath, options.adminToken)
  const flows = flowService(store)
  const backups = backupService(store, options.backupDir)

  const management = new Elysia({ prefix: '/api' })
    .resolve(({ request, status }) => {
      const token = bearer(request)
      const member = store.authenticate(token)

      if (!member) {
        store.audit('anonymous', 'access.denied', 'management')
        return status(401, { error: 'Authentication required' })
      }

      return { member }
    })
    .get('/me', ({ member }) => member)
    .get('/flows', () => flows.list())
    .get('/flows/:id', ({ params }) => flows.get(params.id))
    .post('/flows', ({ member, body }) => {
      allow(member, ['owner', 'editor'])
      return flows.create(member.id, body)
    })
    .put(
      '/flows/:id',
      ({ member, body, params }) => {
        allow(member, ['owner', 'editor'])
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
        allow(member, ['owner'])
        return flows.publish(member.id, params.id, body.revision)
      },
      { body: t.Object({ revision: t.Integer({ minimum: 1 }) }) },
    )
    .post(
      '/flows/:id/test',
      ({ member, params, body }) => {
        allow(member, ['owner', 'editor'])
        return flows.test(member.id, params.id, body)
      },
      {
        body: t.Object({
          body: t.Any(),
          query: t.Record(t.String(), t.String()),
        }),
      },
    )
    .get('/members', ({ member }) => {
      allow(member, ['owner'])
      return store.listMembers()
    })
    .post('/flows/:id/graphql/test', ({ member, params, body }) => {
      allow(member, ['owner', 'editor'])
      return flows.testGraphql(member.id, params.id, body)
    })
    .post(
      '/members',
      ({ member, body }) => {
        allow(member, ['owner'])
        return store.createMember(member.id, body.name, body.role)
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 80 }),
          role: t.Union([t.Literal('editor'), t.Literal('viewer')]),
        }),
      },
    )
    .delete('/members/:id', ({ member, params }) => {
      allow(member, ['owner'])
      return store.revokeMember(member.id, params.id)
    })
    .get('/audit', ({ member }) => {
      allow(member, ['owner'])
      return store.listAudit()
    })
    .get('/migrations', ({ member }) => {
      allow(member, ['owner'])
      return store.query('SELECT * FROM migrations ORDER BY version').all()
    })
    .get('/backups', ({ member }) => {
      allow(member, ['owner'])
      return backups.list()
    })
    .post('/backups', ({ member }) => {
      allow(member, ['owner'])
      return backups.create(member.id)
    })
    .get('/backups/:id', ({ member, params }) => {
      allow(member, ['owner'])
      return backups.download(member.id, params.id)
    })

  const app = new Elysia()
    .onRequest(({ set }) => {
      set.headers['cache-control'] = 'no-store'
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['referrer-policy'] = 'no-referrer'
      set.headers['x-frame-options'] = 'DENY'
      set.headers['content-security-policy'] =
        "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    })
    .onError(({ error, code, set, request }) => {
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          const token = bearer(request)
          store.audit(
            store.authenticate(token)?.id ?? 'anonymous',
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
    .get('/health', () => ({ status: 'ok', version: '0.1.0' }))
    .get('/setup/status', () => store.setupStatus())
    .post(
      '/setup',
      ({ body }) => {
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
        return store.setup(body.name.trim())
      },
      {
        body: t.Object({
          key: t.String({ maxLength: 200 }),
          name: t.String({ minLength: 1, maxLength: 80, pattern: '\\S' }),
        }),
      },
    )
    .use(management)
    .all('/graphql/*', ({ request, params, body }) => {
      const member = store.authenticate(bearer(request))
      if (!member) throw new ApiError(401, 'Authentication required')
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

      const result = flows.graphql(member.id, `/${params['*']}`, body)
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/graphql-response+json' },
      })
    })
    .all('/run/*', ({ request, params, body, query }) => {
      const token = bearer(request)
      const member = store.authenticate(token)
      if (!member) throw new ApiError(401, 'Authentication required')

      const result = flows.run(member.id, request.method, `/${params['*']}`, {
        body: body ?? null,
        query,
      })
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

  return {
    app,
    close: store.close,
    setupRequired: store.setupStatus().required,
  }
}
