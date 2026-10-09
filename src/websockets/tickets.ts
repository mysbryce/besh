import { randomBytes } from 'node:crypto'
import { ApiError } from '../errors'
import { hashToken, type Store } from '../workspace/store'
import type { WebSocketTicket } from './model'

export type TicketProof =
  | { kind: 'runtime'; keyId: string }
  | { kind: 'member-key'; memberId: string; keyHash: string }
  | { kind: 'session'; memberId: string; sessionId: string }

export type TicketBinding = {
  family: 'published' | 'draft'
  flowId: string
  revision: number
  origin: string
  path: string
  tenantId: string | null
  proof: TicketProof
  expiresAt: number
  actor: string
}

export type TicketRow = {
  ticket_hash: string
  family: 'published' | 'draft'
  flow_id: string
  revision: number
  origin: string
  proof_kind: 'runtime' | 'member-key' | 'session'
  runtime_key_id: string | null
  member_id: string | null
  member_key_hash: string | null
  session_id: string | null
  tenant_id: string | null
  expires_at: number
}

export function ticketService(store: Store) {
  // Router reconstruction must never purge tickets. Service initialization does.
  store.db
    .transaction(() => store.query('DELETE FROM websocket_tickets').run())
    .immediate()

  function lookup(secret: string) {
    const row = /^[A-Za-z0-9_-]{43}$/.test(secret)
      ? store
          .query<TicketRow, [string]>(
            'SELECT * FROM websocket_tickets WHERE ticket_hash = ?',
          )
          .get(hashToken(secret))
      : null
    if (!row || row.expires_at <= Date.now())
      throw new ApiError(
        401,
        'WebSocket ticket is invalid or expired. Request a new ticket.',
      )
    return row
  }

  return {
    lookup,
    consume<T>(secret: string, authorize: (row: TicketRow) => T): T {
      return store.db
        .transaction(() => {
          const row = lookup(secret)
          const result = authorize(row)
          const removed = store
            .query('DELETE FROM websocket_tickets WHERE ticket_hash = ?')
            .run(row.ticket_hash)
          if (removed.changes !== 1)
            throw new ApiError(
              401,
              'WebSocket ticket is invalid or expired. Request a new ticket.',
            )
          store.audit(
            row.proof_kind === 'runtime'
              ? `runtime:${row.runtime_key_id}`
              : row.member_id!,
            'websocket-ticket.consumed',
            row.flow_id,
          )
          return result
        })
        .immediate()
    },
    mint(authorize: () => TicketBinding): WebSocketTicket {
      return store.db
        .transaction(() => {
          const binding = authorize()
          const now = Date.now()
          const expiry = Math.min(now + 30_000, binding.expiresAt)
          if (!Number.isFinite(expiry) || expiry <= now)
            throw new ApiError(401, 'Authentication required')
          store
            .query('DELETE FROM websocket_tickets WHERE expires_at <= ?')
            .run(now)
          const proof = binding.proof
          const proofKey =
            proof.kind === 'runtime'
              ? `runtime:${proof.keyId}`
              : proof.kind === 'session'
                ? `session:${proof.sessionId}`
                : `member-key:${proof.memberId}:${proof.keyHash}`
          const count = store
            .query<{ total: number; proof: number }, [string]>(
              'SELECT COUNT(*) AS total, COALESCE(SUM(proof_key = ?), 0) AS proof FROM websocket_tickets',
            )
            .get(proofKey)!
          if (count.total >= 256 || count.proof >= 8)
            throw new ApiError(429, 'WebSocket ticket limit reached')
          const secret = randomBytes(32).toString('base64url')
          store
            .query(
              `INSERT INTO websocket_tickets
          (ticket_hash, family, flow_id, revision, origin, proof_kind, proof_key, runtime_key_id,
            member_id, member_key_hash, session_id, tenant_id, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              hashToken(secret),
              binding.family,
              binding.flowId,
              binding.revision,
              binding.origin,
              proof.kind,
              proofKey,
              proof.kind === 'runtime' ? proof.keyId : null,
              proof.kind === 'runtime' ? null : proof.memberId,
              proof.kind === 'member-key' ? proof.keyHash : null,
              proof.kind === 'session' ? proof.sessionId : null,
              binding.tenantId,
              expiry,
            )
          store.audit(binding.actor, 'websocket-ticket.created', binding.flowId)
          return {
            ticket: secret,
            expiresAt: new Date(expiry).toISOString(),
            revision: binding.revision,
            path: binding.path,
            protocol: 'besh.ws.v1' as const,
          }
        })
        .immediate()
    },
  }
}
