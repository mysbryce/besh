import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { ApiError, allow } from '../errors'
import { hashToken, type Store } from '../workspace/store'
import { prepareAccount } from './sessions'

export type Invitation = {
  id: string
  memberId: string
  memberName: string
  email: string
  createdAt: string
  expiresAt: string
}

const lifetime = 24 * 60 * 60 * 1000
let hashing = 0
const createSchema = z
  .object({
    memberId: z.string().min(1).max(80),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  })
  .strict()
const tokenSchema = z.object({ token: z.string().max(200) }).strict()
const acceptSchema = tokenSchema.extend({
  password: z.string().min(12).max(128),
})
type InvitationRow = {
  id: string
  member_id: string
  email: string
  token_hash: string
  created_at: string
  expires_at: string
}
const unavailable = () => new ApiError(404, 'Invitation unavailable')
function validSchedule(row: InvitationRow) {
  if (
    typeof row.id !== 'string' ||
    typeof row.member_id !== 'string' ||
    typeof row.email !== 'string' ||
    typeof row.token_hash !== 'string' ||
    typeof row.created_at !== 'string' ||
    typeof row.expires_at !== 'string'
  )
    return false
  const created = Date.parse(row.created_at)
  const expires = Date.parse(row.expires_at)
  return (
    Number.isFinite(created) &&
    Number.isFinite(expires) &&
    expires - created === lifetime &&
    new Date(created).toISOString() === row.created_at &&
    new Date(expires).toISOString() === row.expires_at &&
    /^[a-f0-9]{64}$/.test(row.token_hash) &&
    row.email.length <= 254 &&
    row.email === row.email.trim().toLowerCase() &&
    z.email().safeParse(row.email).success
  )
}

export type InvitationPreview = {
  workspaceName: string
  memberName: string
  email: string
  roleName: string
  accessMode: 'all' | 'selected'
  expiresAt: string
}

export function invitationService(store: Store, now = Date.now) {
  const { query, db, audit } = store
  let closed = false
  function active() {
    if (closed) throw new ApiError(503, 'Workspace is shutting down')
  }
  function throttle(token: string) {
    active()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw unavailable()
    db.transaction(() => {
      query('DELETE FROM login_limits WHERE reset_at <= ?').run(now())
      for (const key of [
        'invitations:global',
        'invitations:token:' + hashToken(token),
      ]) {
        const row = query<{ attempts: number }, [string]>(
          'SELECT attempts FROM login_limits WHERE identity_hash = ?',
        ).get(key)
        if ((row?.attempts ?? 0) >= (key === 'invitations:global' ? 100 : 10))
          throw new ApiError(429, 'Too many invitation attempts')
        query(
          'INSERT INTO login_limits VALUES (?, 1, ?) ON CONFLICT(identity_hash) DO UPDATE SET attempts = attempts + 1',
        ).run(key, now() + 5 * 60 * 1000)
      }
    }).immediate()
  }
  function current(token: string) {
    active()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw unavailable()
    const invitation = query<InvitationRow, [string]>(
      'SELECT * FROM invitations WHERE token_hash = ?',
    ).get(hashToken(token))
    if (
      !invitation ||
      !validSchedule(invitation) ||
      Date.parse(invitation.expires_at) <= now()
    )
      throw unavailable()
    const member = store.member(invitation.member_id)
    if (
      !member ||
      member.role === 'owner' ||
      query('SELECT member_id FROM accounts WHERE member_id = ?').get(member.id)
    )
      throw unavailable()
    return { invitation, member }
  }
  return {
    close() {
      closed = true
    },
    async accept(value: unknown) {
      const parsed = acceptSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide an invitation token and password of 12 to 128 characters',
        )
      throttle(parsed.data.token)
      const original = current(parsed.data.token).invitation
      if (hashing >= 4) throw new ApiError(429, 'Too many invitation attempts')
      hashing++
      try {
        const account = await prepareAccount({
          email: original.email,
          password: parsed.data.password,
        })
        active()
        return db
          .transaction(() => {
            const { invitation, member } = current(parsed.data.token)
            if (
              invitation.id !== original.id ||
              invitation.member_id !== original.member_id ||
              invitation.email !== original.email ||
              invitation.created_at !== original.created_at ||
              invitation.expires_at !== original.expires_at
            )
              throw unavailable()
            if (
              query('SELECT member_id FROM accounts WHERE email = ?').get(
                account.email,
              )
            )
              throw new ApiError(409, 'Email address unavailable')
            query('INSERT INTO accounts VALUES (?, ?, ?)').run(
              member.id,
              account.email,
              account.passwordHash,
            )
            query('DELETE FROM invitations WHERE id = ?').run(invitation.id)
            store.revokeMemberSessions('system', member.id)
            audit('system', 'invitation.accepted', invitation.id)
            return { ok: true, email: account.email }
          })
          .immediate()
      } finally {
        hashing--
      }
    },
    preview(value: unknown): InvitationPreview {
      const parsed = tokenSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Provide an invitation token')
      throttle(parsed.data.token)
      return db.transaction(() => {
        const { invitation, member } = current(parsed.data.token)
        return {
          workspaceName: store.setupStatus().name,
          memberName: member.name,
          email: invitation.email,
          roleName:
            member.roleName ?? (member.role === 'editor' ? 'Editor' : 'Viewer'),
          accessMode: member.access.mode,
          expiresAt: invitation.expires_at,
        }
      })()
    },
    revoke(actor: string, id: string, value: unknown, authorize: () => void) {
      if (
        !z
          .object({})
          .strict()
          .safeParse(value === undefined ? {} : value).success
      )
        throw new ApiError(400, 'Invitation revocation takes no fields')
      return db
        .transaction(() => {
          authorize()
          const member = store.member(actor)
          if (!member) throw new ApiError(401, 'Authentication required')
          allow(member, ['owner'])
          if (!query('DELETE FROM invitations WHERE id = ?').run(id).changes)
            throw unavailable()
          audit(actor, 'invitation.revoked', id)
          return { ok: true }
        })
        .immediate()
    },
    list(): Invitation[] {
      active()
      const rows = query<
        InvitationRow & { memberName: string },
        [string]
      >(`SELECT i.*, m.name AS memberName FROM invitations i JOIN members m ON m.id = i.member_id
        WHERE i.expires_at > ? AND m.role != 'owner' AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.member_id = i.member_id)
        ORDER BY i.created_at DESC, i.id LIMIT 257`).all(
        new Date(now()).toISOString(),
      )
      if (rows.length > 256 || rows.some((row) => !validSchedule(row)))
        throw new ApiError(503, 'Invitation state unavailable')
      return rows.map((row) => ({
        id: row.id,
        memberId: row.member_id,
        memberName: row.memberName,
        email: row.email,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }))
    },
    create(actor: string, value: unknown, authorize: () => void) {
      const parsed = createSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Choose a member and valid email address')
      return db
        .transaction(() => {
          authorize()
          const owner = store.member(actor)
          if (!owner) throw new ApiError(401, 'Authentication required')
          allow(owner, ['owner'])
          const member = store.member(parsed.data.memberId)
          if (
            !member ||
            member.role === 'owner' ||
            query('SELECT member_id FROM accounts WHERE member_id = ?').get(
              member.id,
            )
          )
            throw new ApiError(
              409,
              'Choose an existing member without an account',
            )
          if (
            query('SELECT member_id FROM accounts WHERE email = ?').get(
              parsed.data.email,
            )
          )
            throw new ApiError(409, 'Email address unavailable')
          const issuedAt = now()
          const createdAt = new Date(issuedAt).toISOString()
          query('DELETE FROM invitations WHERE expires_at <= ?').run(createdAt)
          const previous = query<{ id: string }, [string]>(
            'SELECT id FROM invitations WHERE member_id = ?',
          ).get(member.id)
          if (previous) {
            query('DELETE FROM invitations WHERE id = ?').run(previous.id)
            audit(actor, 'invitation.revoked', previous.id)
          }
          if (
            query<{ count: number }, []>(
              'SELECT COUNT(*) AS count FROM invitations',
            ).get()!.count >= 256
          )
            throw new ApiError(409, 'Pending invitation limit reached')
          const token = randomBytes(32).toString('base64url')
          const invitation = {
            id: crypto.randomUUID(),
            memberId: member.id,
            memberName: member.name,
            email: parsed.data.email,
            createdAt,
            expiresAt: new Date(issuedAt + lifetime).toISOString(),
          }
          query('INSERT INTO invitations VALUES (?, ?, ?, ?, ?, ?)').run(
            invitation.id,
            member.id,
            invitation.email,
            hashToken(token),
            invitation.createdAt,
            invitation.expiresAt,
          )
          audit(actor, 'invitation.created', invitation.id)
          return { ...invitation, token }
        })
        .immediate()
    },
  }
}
