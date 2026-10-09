import type { AnyWSLocalHook } from 'elysia/ws/types'
import { z } from 'zod'
import { ApiError } from '../errors'
import type { Store, RuntimeKey } from '../workspace/store'
import type { RuntimeRelease, RuntimeService } from '../flows/runtime'
import type { FlowResult } from '../flows/model'
import { checkValue } from '../flows/contracts'
import { connectionRegistry, type Connection } from './connections'
import { ticketService } from './tickets'
import { draftTicketService, type DraftDependencies } from './draft'
import { websocketPolicies } from './policy'
import {
  bearerProof,
  messageEnvelope,
  requireUpgrade,
  scrubUpgrade,
  ticketProtocol,
} from './protocol'

export function websocketService(
  store: Store,
  runtime: RuntimeService,
  execute: (
    release: RuntimeRelease,
    body: unknown,
    signal: AbortSignal,
    authorize: () => RuntimeKey,
  ) => Promise<FlowResult>,
  draftDependencies: DraftDependencies,
) {
  const registry = connectionRegistry()
  const tickets = ticketService(store)
  const drafts = draftTicketService(store, tickets, draftDependencies)
  let closed = false

  function authorized<T>(
    release: RuntimeRelease,
    keyId: string,
    complete: (key: RuntimeKey) => T,
  ) {
    if (closed) throw new ApiError(503, 'WebSocket service is shutting down')
    return runtime.readAdmission(release, () => {
      const key = store.runtimeCredential(keyId)
      if (!key) throw new ApiError(401, 'Authentication required')
      if (
        key.flowId !== release.flowId ||
        key.permissions.length !== 1 ||
        key.permissions[0] !== 'ws' ||
        key.releaseRevision !== release.revision
      )
        throw new ApiError(403, 'Runtime key does not allow this endpoint')
      store.checkRuntimeAuthority(key, release.definition)
      return complete(key)
    })
  }

  function authorize(release: RuntimeRelease, keyId: string) {
    return authorized(release, keyId, (key) => key)
  }

  function policyAuthority(connection: Connection) {
    if (
      websocketPolicies(store, connection.release.definition) !==
      connection.policies
    )
      throw new ApiError(403, 'WebSocket resource policy changed')
  }

  function send(connection: Connection, value: unknown) {
    if (!connection.socket) return
    const text = JSON.stringify(value)
    if (Buffer.byteLength(text) > 65_536) {
      registry.close(connection, 1009)
      return
    }
    check(connection)
    const sent = connection.socket.raw.send(text)
    if (sent <= 0) registry.close(connection, 1013)
  }

  function check(connection: Connection) {
    if (closed) throw new ApiError(503, 'WebSocket service is shutting down')
    if (
      registry.connections.get(connection.id) !== connection ||
      connection.abort.signal.aborted
    )
      throw new ApiError(403, 'WebSocket connection ended')
    const now = Date.now()
    if (
      now - connection.createdAt >= 300_000 ||
      now - connection.lastActivity >= 30_000
    )
      throw new ApiError(403, 'WebSocket connection expired')
    if (connection.draft) {
      return store.db.transaction(() => {
        const member = drafts.authorize(connection.release, connection.draft!)
        policyAuthority(connection)
        return member
      })()
    }
    return authorized(connection.release, connection.keyId, (key) => {
      policyAuthority(connection)
      return key
    })
  }

  function publishedKey(connection: Connection) {
    const current = check(connection)
    if (!('flowId' in current))
      throw new ApiError(503, 'Invalid WebSocket authority')
    return current
  }

  function draftMember(connection: Connection) {
    const current = check(connection)
    if (!('role' in current))
      throw new ApiError(503, 'Invalid WebSocket authority')
    return current
  }

  function sweep() {
    for (const connection of [...registry.connections.values()]) {
      try {
        check(connection)
      } catch {
        registry.close(connection)
      }
    }
  }
  const timer = setInterval(sweep, 1000)
  timer.unref()

  function callbacks(): AnyWSLocalHook {
    return {
      open(socket) {
        registry.open(socket.data.beshConnection, socket)
      },
      async message(socket, value: unknown) {
        const connection = registry.connections.get(socket.data.beshConnection)
        if (!connection) return
        const release = connection.release
        try {
          check(connection)
        } catch {
          registry.close(connection)
          return
        }
        let id: string | null = null
        let started = false
        try {
          const now = Date.now()
          if (now - connection.rateStartedAt >= 1000) {
            connection.rateStartedAt = now
            connection.messages = 0
          }
          if (++connection.messages > 5)
            throw new ApiError(429, 'WebSocket message rate exceeded')
          const envelope = messageEnvelope(value)
          id = envelope.id
          if (connection.busy)
            throw new ApiError(429, 'WebSocket execution is busy')
          checkValue(release.definition.websocket!.input, envelope.body, 'body')
          connection.busy = true
          started = true
          connection.lastActivity = now
          const result = connection.draft
            ? await drafts.execute(
                release,
                envelope.body,
                connection.abort.signal,
                () => draftMember(connection),
                connection.draft.tenantId,
              )
            : await execute(
                release,
                envelope.body,
                connection.abort.signal,
                () => publishedKey(connection),
              )
          check(connection)
          checkValue(
            release.definition.websocket!.output,
            result.body,
            'response',
          )
          if (Array.isArray(result.body) && result.body.length > 100)
            throw new ApiError(500, 'WebSocket reply exceeds its row limit')
          if (
            Buffer.byteLength(JSON.stringify({ id, result: result.body })) >
            65_536
          )
            throw new ApiError(500, 'WebSocket reply exceeds its size limit')
          check(connection)
          store.audit(
            connection.draft
              ? connection.draft.proof.memberId
              : `runtime:${connection.keyId}`,
            connection.draft ? 'websocket.tested' : 'websocket.executed',
            release.flowId,
          )
          check(connection)
          send(connection, { id, result: result.body })
        } catch (error) {
          try {
            check(connection)
          } catch {
            registry.close(connection)
            return
          }
          send(connection, {
            id,
            error:
              error instanceof ApiError && error.status === 429
                ? 'WebSocket request limit reached'
                : 'WebSocket message failed',
          })
        } finally {
          if (started) connection.busy = false
        }
      },
      close(socket) {
        const connection = registry.connections.get(socket.data.beshConnection)
        if (connection) registry.remove(connection)
      },
    }
  }

  return {
    mintDraft: drafts.mint,
    draftOptions(): AnyWSLocalHook {
      return {
        ...callbacks(),
        upgrade(context) {
          requireUpgrade(context.request)
          let connection: Connection | undefined
          try {
            tickets.consume(ticketProtocol(context.request), (ticket) => {
              const { snapshot, binding } = drafts.upgrade(
                context.params.id!,
                context.request,
                ticket,
              )
              const proofKey =
                binding.proof.kind === 'session'
                  ? `session:${binding.proof.sessionId}`
                  : `member-key:${binding.proof.memberId}:${binding.proof.keyHash}`
              connection = registry.reserve(
                snapshot,
                proofKey,
                websocketPolicies(store, snapshot.definition),
                binding,
              )
            })
            if (!connection) throw new ApiError(503, 'WebSocket upgrade failed')
            Reflect.set(context, 'beshConnection', connection.id)
            scrubUpgrade(context)
          } catch (error) {
            if (connection) registry.remove(connection)
            throw error instanceof ApiError
              ? error
              : new ApiError(503, 'WebSocket upgrade failed')
          }
        },
      }
    },
    namespace(request: Request) {
      if (request.headers.has('authorization')) {
        if (!store.authenticateRuntime(bearerProof(request)))
          throw new ApiError(401, 'Authentication required')
        return
      }
      const ticket = tickets.lookup(ticketProtocol(request))
      if (
        ticket.family !== 'published' ||
        ticket.proof_kind !== 'runtime' ||
        !ticket.runtime_key_id ||
        !store.runtimeCredential(ticket.runtime_key_id)
      )
        throw new ApiError(401, 'Authentication required')
    },
    http(release: RuntimeRelease, request: Request) {
      const origin = request.headers.get('origin')
      if (request.headers.has('authorization')) {
        const key = store.authenticateRuntime(bearerProof(request))
        if (!key) throw new ApiError(401, 'Authentication required')
        authorize(release, key.id)
        if (
          origin !== null &&
          !release.definition.websocket!.allowedOrigins.includes(origin)
        )
          throw new ApiError(403, 'WebSocket origin is not allowed')
      } else {
        const ticket = tickets.lookup(ticketProtocol(request))
        if (
          ticket.family !== 'published' ||
          ticket.proof_kind !== 'runtime' ||
          !ticket.runtime_key_id ||
          ticket.flow_id !== release.flowId ||
          ticket.revision !== release.revision ||
          !origin ||
          ticket.origin !== origin ||
          !release.definition.websocket!.allowedOrigins.includes(origin)
        )
          throw new ApiError(
            401,
            'WebSocket ticket is invalid or expired. Request a new ticket.',
          )
        const key = authorize(release, ticket.runtime_key_id)
        if (key.tenantId !== ticket.tenant_id)
          throw new ApiError(403, 'WebSocket identity changed')
      }
      return Response.json(
        { error: 'WebSocket upgrade required' },
        { status: 426 },
      )
    },
    mintPublished(release: RuntimeRelease, request: Request, body: unknown) {
      const receipt = tickets.mint(() => {
        const key = store.authenticateRuntime(bearerProof(request))
        if (!key) throw new ApiError(401, 'Authentication required')
        authorize(release, key.id)
        const parsed = z
          .object({
            revision: z.number().int().positive().safe(),
            origin: z.string().max(2048),
          })
          .strict()
          .safeParse(body)
        if (!parsed.success)
          throw new ApiError(
            400,
            'Provide a release revision and approved browser origin',
          )
        if (parsed.data.revision !== release.revision)
          throw new ApiError(
            409,
            'Published release changed. Review the current release.',
          )
        if (
          !release.definition.websocket!.allowedOrigins.includes(
            parsed.data.origin,
          )
        )
          throw new ApiError(400, 'Choose an approved browser origin')
        return {
          family: 'published',
          flowId: release.flowId,
          revision: release.revision,
          origin: parsed.data.origin,
          path: `/ws${release.definition.path}`,
          tenantId: key.tenantId,
          proof: { kind: 'runtime', keyId: key.id },
          expiresAt: Date.parse(key.acceptUntil),
          actor: `runtime:${key.id}`,
        }
      })
      return Response.json(receipt)
    },
    options(release: RuntimeRelease): AnyWSLocalHook {
      return {
        ...callbacks(),
        upgrade(context) {
          requireUpgrade(context.request)
          const origin = context.request.headers.get('origin')
          let connection: Connection | undefined
          try {
            if (context.request.headers.has('authorization')) {
              const key = store.authenticateRuntime(
                bearerProof(context.request),
              )
              if (!key) throw new ApiError(401, 'Authentication required')
              connection = authorized(release, key.id, (current) => {
                if (
                  origin !== null &&
                  !release.definition.websocket!.allowedOrigins.includes(origin)
                )
                  throw new ApiError(403, 'WebSocket origin is not allowed')
                return registry.reserve(
                  release,
                  current.id,
                  websocketPolicies(store, release.definition),
                )
              })
            } else {
              tickets.consume(ticketProtocol(context.request), (ticket) => {
                if (
                  ticket.family !== 'published' ||
                  ticket.proof_kind !== 'runtime' ||
                  !ticket.runtime_key_id ||
                  ticket.flow_id !== release.flowId ||
                  ticket.revision !== release.revision ||
                  !origin ||
                  ticket.origin !== origin ||
                  !release.definition.websocket!.allowedOrigins.includes(origin)
                )
                  throw new ApiError(
                    401,
                    'WebSocket ticket is invalid or expired. Request a new ticket.',
                  )
                connection = authorized(
                  release,
                  ticket.runtime_key_id,
                  (key) => {
                    if (key.tenantId !== ticket.tenant_id)
                      throw new ApiError(403, 'WebSocket identity changed')
                    return registry.reserve(
                      release,
                      key.id,
                      websocketPolicies(store, release.definition),
                    )
                  },
                )
              })
            }
            if (!connection) throw new ApiError(503, 'WebSocket upgrade failed')
            Reflect.set(context, 'beshConnection', connection.id)
            scrubUpgrade(context)
          } catch (error) {
            if (connection) registry.remove(connection)
            throw error instanceof ApiError
              ? error
              : new ApiError(503, 'WebSocket upgrade failed')
          }
        },
      }
    },
    publicationCommitted: sweep,
    beginShutdown() {
      closed = true
      clearInterval(timer)
      registry.shutdown()
    },
    close() {
      closed = true
      clearInterval(timer)
      registry.shutdown()
    },
  }
}
