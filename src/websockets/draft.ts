import { z } from 'zod'
import { ApiError } from '../errors'
import { sessionCookie, type sessionService } from '../auth/sessions'
import { authorizeFlow, authorizeGraph } from '../workspace/authorization'
import { hashToken, type Store, type Member } from '../workspace/store'
import { memberRowPrincipal } from '../workspace/row-authority'
import type { RuntimeRelease } from '../flows/runtime'
import type { Flow } from '../flows/model'
import type { FlowResult } from '../flows/model'
import { bearerProof } from './protocol'
import type { ticketService, TicketProof, TicketRow } from './tickets'
import type { DraftBinding } from './connections'

export type DraftDependencies = {
  sessions: Pick<ReturnType<typeof sessionService>, 'restore' | 'current'>
  checkOrigin: (request: Request) => void
  snapshot: (id: string) => RuntimeRelease
  validate: (definition: Flow) => Flow
  execute: (
    release: RuntimeRelease,
    body: unknown,
    signal: AbortSignal,
    authorize: () => Member,
    tenantId: string | null,
  ) => Promise<FlowResult>
}

export function draftTicketService(
  store: Store,
  tickets: ReturnType<typeof ticketService>,
  dependencies: DraftDependencies,
) {
  function current(proof: DraftBinding['proof']) {
    const member =
      proof.kind === 'session'
        ? dependencies.sessions.current(proof.sessionId)?.member
        : store.memberKeyAuthority(proof.memberId, proof.keyHash)
    if (!member || member.id !== proof.memberId)
      throw new ApiError(401, 'Authentication required')
    return member
  }

  function authorize(snapshot: RuntimeRelease, binding: DraftBinding) {
    return store.db.transaction(() => {
      const member = current(binding.proof)
      authorizeFlow(member, snapshot.flowId, 'flows.test')
      const saved = dependencies.snapshot(snapshot.flowId)
      if (saved.revision !== snapshot.revision || !saved.definition.websocket)
        throw new ApiError(
          409,
          'Saved draft changed. Review it before connecting.',
        )
      authorizeGraph(member, snapshot.flowId, 'flows.test', snapshot.definition)
      const principal = memberRowPrincipal(
        store,
        member,
        snapshot.definition,
        member.role === 'owner' && binding.tenantId !== null
          ? binding.tenantId
          : undefined,
      )
      if ((principal?.tenantId ?? null) !== binding.tenantId)
        throw new ApiError(403, 'WebSocket identity changed')
      return member
    })()
  }

  return {
    authorize,
    execute: dependencies.execute,
    upgrade(id: string, request: Request, ticket: TicketRow) {
      dependencies.checkOrigin(request)
      if (
        ticket.family !== 'draft' ||
        ticket.flow_id !== id ||
        ticket.origin !== request.headers.get('origin') ||
        !ticket.member_id
      )
        throw new ApiError(
          401,
          'WebSocket ticket is invalid or expired. Request a new ticket.',
        )
      let proof: DraftBinding['proof']
      if (ticket.proof_kind === 'session' && ticket.session_id) {
        const session = dependencies.sessions.restore(sessionCookie(request))
        if (
          !session ||
          session.sessionId !== ticket.session_id ||
          session.member.id !== ticket.member_id
        )
          throw new ApiError(401, 'Original workspace session required')
        if (
          request.headers.has('authorization') &&
          store.authenticate(bearerProof(request))?.id !== ticket.member_id
        )
          throw new ApiError(401, 'Authentication required')
        proof = {
          kind: 'session',
          sessionId: ticket.session_id,
          memberId: ticket.member_id,
        }
      } else if (ticket.proof_kind === 'member-key' && ticket.member_key_hash) {
        if (hashToken(bearerProof(request)) !== ticket.member_key_hash)
          throw new ApiError(401, 'Original workspace key required')
        proof = {
          kind: 'member-key',
          memberId: ticket.member_id,
          keyHash: ticket.member_key_hash,
        }
      } else throw new ApiError(401, 'Authentication required')
      const member = current(proof)
      authorizeFlow(member, id, 'flows.test')
      const snapshot = dependencies.snapshot(id)
      if (snapshot.revision !== ticket.revision)
        throw new ApiError(
          409,
          'Saved draft changed. Review it before connecting.',
        )
      const binding: DraftBinding = { proof, tenantId: ticket.tenant_id }
      authorize(snapshot, binding)
      dependencies.validate(snapshot.definition)
      return { snapshot, binding }
    },
    mint(id: string, request: Request, body: unknown) {
      return tickets.mint(() => {
        dependencies.checkOrigin(request)
        const member = request.headers.has('authorization')
          ? store.authenticate(bearerProof(request))
          : dependencies.sessions.restore(sessionCookie(request))?.member
        if (!member) throw new ApiError(401, 'Authentication required')
        authorizeFlow(member, id, 'flows.test')
        const parsed = z
          .object({
            revision: z.number().int().positive().safe(),
            tenantId: z.string().min(1).max(80).optional(),
          })
          .strict()
          .safeParse(body)
        if (!parsed.success)
          throw new ApiError(
            400,
            'Provide the saved draft revision and an optional owner tenant',
          )
        const snapshot = dependencies.snapshot(id)
        if (snapshot.revision !== parsed.data.revision)
          throw new ApiError(
            409,
            'Saved draft changed. Review it before connecting.',
          )
        authorizeGraph(member, id, 'flows.test', snapshot.definition)
        const principal = memberRowPrincipal(
          store,
          member,
          snapshot.definition,
          parsed.data.tenantId,
        )
        const definition = dependencies.validate(snapshot.definition)
        if (!definition.websocket)
          throw new ApiError(400, 'Choose a WebSocket draft')
        let proof: TicketProof
        let expiresAt = Infinity
        if (request.headers.has('authorization')) {
          proof = {
            kind: 'member-key',
            memberId: member.id,
            keyHash: hashToken(bearerProof(request)),
          }
        } else {
          const session = dependencies.sessions.restore(sessionCookie(request))
          if (!session || session.member.id !== member.id)
            throw new ApiError(401, 'Authentication required')
          proof = {
            kind: 'session',
            memberId: member.id,
            sessionId: session.sessionId,
          }
          expiresAt = Date.parse(session.expiresAt)
        }
        return {
          family: 'draft',
          flowId: id,
          revision: snapshot.revision,
          origin: request.headers.get('origin')!,
          path: `/api/flows/${id}/ws/test`,
          tenantId: principal?.tenantId ?? null,
          proof,
          expiresAt,
          actor: member.id,
        }
      })
    },
  }
}
