import { randomBytes, timingSafeEqual } from 'node:crypto'
import { ApiError } from './errors'
import { hashToken, type Member, type Store } from './store'
import { z } from 'zod'

export const sessionLifetime = 12 * 60 * 60 * 1000

type SessionRow = {
  id: string
  member_id: string
  created_at: string
  expires_at: string
}

export type AccountInput = { email: string; password: string }
type AccountRow = { member_id: string; email: string; password_hash: string }

export async function prepareAccount(value: AccountInput) {
  const email = value.email.trim().toLowerCase()
  if (email.length > 254 || !z.email().safeParse(email).success)
    throw new ApiError(400, 'Enter a valid email address')
  if (value.password.length < 12 || value.password.length > 128)
    throw new ApiError(400, 'Password must contain 12 to 128 characters')
  const passwordHash = await Bun.password.hash(value.password, {
    algorithm: 'argon2id',
    memoryCost: 19456,
    timeCost: 2,
  })
  return { email, passwordHash }
}

export async function optionalAccount(value: {
  email?: string
  password?: string
}) {
  if (value.email === undefined && value.password === undefined)
    return undefined
  if (value.email === undefined || value.password === undefined)
    throw new ApiError(400, 'Email and password must be provided together')
  return prepareAccount({ email: value.email, password: value.password })
}

const missingPasswordHash = Bun.password.hash(randomBytes(32).toString('hex'), {
  algorithm: 'argon2id',
  memoryCost: 19456,
  timeCost: 2,
})

export function sessionService(store: Store, now = Date.now) {
  let loginWork = 0

  function throttle(identity: string) {
    store.db.transaction(() => {
      store.query('DELETE FROM login_limits WHERE reset_at <= ?').run(now())
      for (const key of ['global', identity]) {
        const row = store
          .query<{ attempts: number }, [string]>(
            'SELECT attempts FROM login_limits WHERE identity_hash = ?',
          )
          .get(key)
        if ((row?.attempts ?? 0) >= (key === 'global' ? 100 : 10))
          throw new ApiError(429, 'Too many login attempts')
        store
          .query(
            'INSERT INTO login_limits VALUES (?, 1, ?) ON CONFLICT(identity_hash) DO UPDATE SET attempts = attempts + 1',
          )
          .run(key, now() + 5 * 60 * 1000)
      }
    })()
  }

  function restore(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
    const row = store
      .query<SessionRow, [string]>(
        'SELECT id, member_id, created_at, expires_at FROM sessions WHERE token_hash = ?',
      )
      .get(hashToken(token))
    if (!row || Date.parse(row.expires_at) <= now()) return null
    const member = store
      .query<Member, [string]>(
        'SELECT id, name, role FROM members WHERE id = ?',
      )
      .get(row.member_id)
    if (!member) return null

    store
      .query('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
      .run(new Date(now()).toISOString(), row.id)
    return {
      member,
      csrfToken: hashToken(`csrf:${token}`),
      sessionId: row.id,
      expiresAt: row.expires_at,
    }
  }

  return {
    restore,
    account(memberId: string) {
      const account = store
        .query<AccountRow, [string]>(
          'SELECT member_id, email, password_hash FROM accounts WHERE member_id = ?',
        )
        .get(memberId)
      return { email: account?.email ?? null }
    },
    async updateAccount(
      member: Member,
      sessionId: string | undefined,
      value: AccountInput & { token?: string; currentPassword?: string },
    ) {
      const previous = store
        .query<AccountRow, [string]>(
          'SELECT member_id, email, password_hash FROM accounts WHERE member_id = ?',
        )
        .get(member.id)
      const validKey =
        value.token && store.authenticate(value.token)?.id === member.id
      const validPassword =
        value.currentPassword &&
        previous &&
        (await Bun.password.verify(
          value.currentPassword,
          previous.password_hash,
        ))
      if (!validKey && !validPassword)
        throw new ApiError(403, 'Current password or member key required')
      const account = await prepareAccount(value)

      store.db.transaction(() => {
        const current = store
          .query<AccountRow, [string]>(
            'SELECT member_id, email, password_hash FROM accounts WHERE member_id = ?',
          )
          .get(member.id)
        if (
          current?.password_hash !== previous?.password_hash ||
          (validKey && store.authenticate(value.token!)?.id !== member.id)
        )
          throw new ApiError(403, 'Current password or member key required')
        const duplicate = store
          .query<{ member_id: string }, [string]>(
            'SELECT member_id FROM accounts WHERE email = ?',
          )
          .get(account.email)
        if (duplicate && duplicate.member_id !== member.id)
          throw new ApiError(409, 'Email address unavailable')
        store
          .query(
            'INSERT INTO accounts VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash',
          )
          .run(member.id, account.email, account.passwordHash)
        store
          .query('DELETE FROM sessions WHERE member_id = ? AND id != ?')
          .run(member.id, sessionId ?? '')
        store.audit(member.id, 'account.updated', member.id)
      })()
      return { email: account.email }
    },
    list(member: Member, currentId?: string) {
      const rows = store
        .query<
          {
            id: string
            memberId: string
            memberName: string
            createdAt: string
            expiresAt: string
            lastSeenAt: string
          },
          [string, string, string]
        >(
          `SELECT s.id, s.member_id AS memberId, m.name AS memberName,
        s.created_at AS createdAt, s.expires_at AS expiresAt, s.last_seen_at AS lastSeenAt
        FROM sessions s JOIN members m ON m.id = s.member_id
        WHERE s.expires_at > ? AND (? = 'owner' OR s.member_id = ?)
        ORDER BY s.created_at DESC, s.id`,
        )
        .all(new Date(now()).toISOString(), member.role, member.id)
      return rows.map((row) => ({ ...row, current: row.id === currentId }))
    },
    revoke(member: Member, id: string) {
      store.db.transaction(() => {
        const row = store
          .query<{ member_id: string }, [string]>(
            'SELECT member_id FROM sessions WHERE id = ?',
          )
          .get(id)
        if (!row) throw new ApiError(404, 'Session not found')
        if (member.role !== 'owner' && row.member_id !== member.id)
          throw new ApiError(403, 'Permission denied')
        store.query('DELETE FROM sessions WHERE id = ?').run(id)
        store.audit(member.id, 'session.revoked', id)
      })()
      return { ok: true }
    },
    async login(value: { token?: string; email?: string; password?: string }) {
      const identity = hashToken(
        value.email
          ? `email:${value.email.trim().toLowerCase()}`
          : `key:${value.token ?? ''}`,
      )
      throttle(identity)
      if (loginWork >= 4) throw new ApiError(429, 'Too many login attempts')
      loginWork++
      try {
        let member: Member | null = null
        let checkedAccount: AccountRow | null = null
        if (value.token && !value.email && !value.password)
          member = store.authenticate(value.token)
        else if (!value.token && value.email && value.password) {
          const account = store
            .query<AccountRow, [string]>(
              'SELECT member_id, email, password_hash FROM accounts WHERE email = ?',
            )
            .get(value.email.trim().toLowerCase())
          checkedAccount = account
          const valid = await Bun.password.verify(
            value.password,
            account?.password_hash ?? (await missingPasswordHash),
          )
          if (valid && account)
            member = store
              .query<Member, [string]>(
                'SELECT id, name, role FROM members WHERE id = ?',
              )
              .get(account.member_id)
        }
        if (!member) throw new ApiError(401, 'Invalid credentials')
        const secret = randomBytes(32).toString('base64url')
        const id = crypto.randomUUID()
        const createdAt = new Date(now()).toISOString()
        const expiresAt = new Date(now() + sessionLifetime).toISOString()
        store.db.transaction(() => {
          if (checkedAccount) {
            const current = store
              .query<AccountRow, [string]>(
                'SELECT member_id, email, password_hash FROM accounts WHERE member_id = ?',
              )
              .get(checkedAccount.member_id)
            if (
              current?.password_hash !== checkedAccount.password_hash ||
              current.email !== checkedAccount.email
            )
              throw new ApiError(401, 'Invalid credentials')
          } else if (store.authenticate(value.token ?? '')?.id !== member.id) {
            throw new ApiError(401, 'Invalid credentials')
          }
          store
            .query('DELETE FROM sessions WHERE expires_at <= ?')
            .run(createdAt)
          const evicted = store
            .query<{ id: string }, [string]>(
              'SELECT id FROM sessions WHERE member_id = ? ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET 19',
            )
            .all(member.id)
          for (const old of evicted) {
            store.query('DELETE FROM sessions WHERE id = ?').run(old.id)
            store.audit(member.id, 'session.evicted', old.id)
          }
          store
            .query('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)')
            .run(
              id,
              member.id,
              hashToken(secret),
              createdAt,
              expiresAt,
              createdAt,
            )
          store.audit(member.id, 'session.created', id)
          store
            .query('DELETE FROM login_limits WHERE identity_hash = ?')
            .run(identity)
        })()
        return { secret, session: restore(secret)! }
      } finally {
        loginWork--
      }
    },
  }
}

export function sessionCookie(request: Request) {
  const values = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.startsWith('besh_session='))
  return values.length === 1 ? values[0]!.slice('besh_session='.length) : ''
}

export function browserSecurity(authOrigin?: string) {
  const configured = authOrigin ? new URL(authOrigin) : undefined
  if (
    configured &&
    (configured.origin !== authOrigin ||
      configured.username ||
      configured.password ||
      !secureOrigin(configured))
  )
    throw new Error(
      'BESH_WEB_URL must be an exact HTTPS origin or loopback HTTP origin',
    )

  function origin(request: Request) {
    const target = configured ?? new URL(new URL(request.url).origin)
    if (!secureOrigin(target))
      throw new ApiError(403, 'HTTPS browser origin required')
    return target
  }

  return {
    checkOrigin(request: Request) {
      if (request.headers.get('origin') !== origin(request).origin)
        throw new ApiError(403, 'Browser origin rejected')
    },
    checkWrite(request: Request, csrfToken: string) {
      this.checkOrigin(request)
      if (
        !timingSafeEqual(
          Buffer.from(hashToken(request.headers.get('x-besh-csrf') ?? '')),
          Buffer.from(hashToken(csrfToken)),
        )
      )
        throw new ApiError(403, 'Session verification required')
    },
    cookie(request: Request, secret = '') {
      return `besh_session=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${secret ? 43200 : 0}${origin(request).protocol === 'https:' ? '; Secure' : ''}`
    },
  }
}

function secureOrigin(url: URL) {
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  )
}
