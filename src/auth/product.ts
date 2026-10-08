import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { ApiError } from '../errors'
import { hashToken, type Store } from '../workspace/store'
import type { ApiSchema, Flow, SocialConfig } from '../flows/model'
import { socialLoginSchema } from './social-schema'

export type OAuthFetch = (url: string, init: RequestInit) => Promise<Response>

type ConnectionRow = {
  id: string
  name: string
  provider: 'github'
  client_id: string
  secret: string
  redirect_uri: string
  version: number
  created_at: string
  updated_at: string
}

type AttemptRow = {
  state_hash: string
  proof_hash: string
  verifier: string
  flow_id: string
  revision: number
  scope: string
  connection_id: string
  connection_version: number
  expires_at: number
}

const fields = {
  name: z.string().trim().min(1).max(80),
  clientId: z.string().trim().min(1).max(200),
  clientSecret: z.string().min(1).max(4096),
  redirectUri: z
    .string()
    .max(1000)
    .url()
    .refine((value) => {
      const url = new URL(value)
      return (
        !url.username &&
        !url.password &&
        !url.hash &&
        !url.search &&
        (url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      )
    }, 'Use an HTTPS callback or HTTP loopback callback without query or fragment'),
}

function metadata(row: ConnectionRow) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const loginResponse: ApiSchema = {
  type: 'object',
  required: ['authorizationUrl', 'state', 'proof', 'expiresAt', 'identity'],
  additionalProperties: false,
  properties: {
    authorizationUrl: { type: 'string', nullable: true, maxLength: 4096 },
    state: { type: 'string', nullable: true, maxLength: 43 },
    proof: { type: 'string', nullable: true, maxLength: 43 },
    expiresAt: { type: 'string', nullable: true, maxLength: 100 },
    identity: {
      type: 'object',
      nullable: true,
      required: ['provider', 'subject', 'username', 'name', 'avatarUrl'],
      additionalProperties: false,
      properties: {
        provider: { type: 'string', maxLength: 20 },
        subject: { type: 'string', maxLength: 64 },
        username: { type: 'string', maxLength: 39 },
        name: { type: 'string', nullable: true, maxLength: 200 },
        avatarUrl: { type: 'string', nullable: true, maxLength: 1000 },
      },
    },
  },
}

export function productAuthService(
  store: Store,
  options: {
    databasePath: string
    secretKeyPath?: string
    oauthFetch?: OAuthFetch
    now?: () => number
  },
) {
  const { query, db, audit } = store
  const now = options.now ?? Date.now
  const transport = options.oauthFetch ?? fetch
  let exchanges = 0
  const keyPath =
    options.secretKeyPath ??
    join(dirname(options.databasePath), 'besh-secrets.key')
  let key: Buffer | undefined

  function encryptionKey() {
    if (key) return key
    if (!existsSync(keyPath)) {
      if (query('SELECT id FROM auth_connections LIMIT 1').get())
        throw new Error(
          'OAuth encryption key missing. Restore the original secret key file.',
        )
      mkdirSync(dirname(keyPath), { recursive: true })
      writeFileSync(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 })
    }
    key = readFileSync(keyPath)
    if (key.length !== 32)
      throw new Error('OAuth encryption key must contain 32 bytes')
    return key
  }

  function encrypt(value: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64',
    )
  }

  function decrypt(value: string) {
    const bytes = Buffer.from(value, 'base64')
    const cipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      bytes.subarray(0, 12),
    )
    cipher.setAuthTag(bytes.subarray(12, 28))
    return Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString('utf8')
  }

  const encrypted = query<{ secret: string }, []>(
    'SELECT secret FROM auth_connections',
  ).all()
  if (encrypted.length) {
    encryptionKey()
    try {
      for (const row of encrypted) decrypt(row.secret)
    } catch {
      throw new Error(
        'OAuth encryption key does not match. Restore the original secret key file.',
      )
    }
  }

  function get(id: string) {
    const row = query<ConnectionRow, [string]>(
      'SELECT * FROM auth_connections WHERE id = ?',
    ).get(id)
    if (!row) throw new ApiError(404, 'Auth connection not found')
    return row
  }

  function parse(value: unknown, update = false) {
    const schema = update
      ? z
          .object({ ...fields, clientSecret: fields.clientSecret.optional() })
          .strict()
      : z.object({ ...fields, provider: z.literal('github') }).strict()
    const result = schema.safeParse(value)
    if (!result.success)
      throw new ApiError(400, 'Invalid GitHub auth connection settings')
    return result.data
  }

  function validate(flow: Flow) {
    for (const node of flow.nodes) {
      if (node.type !== 'social') continue
      if (flow.method !== 'POST')
        throw new ApiError(400, 'Product login APIs use POST')
      get(node.config.connectionId)
    }
  }

  async function providerJson(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
  ) {
    const response = await transport(url, {
      ...init,
      redirect: 'error',
      signal,
    })
    if (
      !response.ok ||
      response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(
        response.headers.get('content-type') ?? '',
      ) ||
      Number(response.headers.get('content-length')) > 65_536 ||
      !response.body
    )
      throw new Error('Provider response rejected')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 65_536 || signal.aborted)
          throw new Error('Provider response limit exceeded')
        chunks.push(chunk.value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    } finally {
      void reader.cancel().catch(() => {})
    }
  }

  async function exchange(
    connection: ConnectionRow,
    code: string,
    verifier: string,
  ) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        (async () => {
          const tokenValue = await providerJson(
            'https://github.com/login/oauth/access_token',
            {
              method: 'POST',
              headers: {
                accept: 'application/json',
                'content-type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: connection.client_id,
                client_secret: decrypt(connection.secret),
                redirect_uri: connection.redirect_uri,
                code,
                code_verifier: verifier,
              }).toString(),
            },
            controller.signal,
          )
          const token = z
            .object({
              access_token: z
                .string()
                .min(1)
                .max(4096)
                .regex(/^[A-Za-z0-9._~-]+$/),
              token_type: z
                .string()
                .refine((value) => value.toLowerCase() === 'bearer'),
            })
            .parse(tokenValue)
          const userValue = await providerJson(
            'https://api.github.com/user',
            {
              method: 'GET',
              headers: {
                accept: 'application/json',
                authorization: `Bearer ${token.access_token}`,
                'user-agent': 'Besh-product-login',
                'x-github-api-version': '2022-11-28',
              },
            },
            controller.signal,
          )
          const user = z
            .object({
              id: z.union([
                z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
                z.string().regex(/^[1-9][0-9]{0,63}$/),
              ]),
              login: z
                .string()
                .min(1)
                .max(39)
                .regex(/^[A-Za-z0-9-]+$/),
              name: z.string().max(200).nullable(),
              avatar_url: z.string().max(1000).url().nullable(),
            })
            .parse(userValue)
          if (user.avatar_url) {
            const avatar = new URL(user.avatar_url)
            if (
              avatar.protocol !== 'https:' ||
              avatar.hostname !== 'avatars.githubusercontent.com' ||
              avatar.username ||
              avatar.password ||
              avatar.port ||
              avatar.hash
            )
              throw new Error('Provider avatar rejected')
          }
          if (get(connection.id).version !== connection.version)
            throw new Error('Provider configuration changed')
          return {
            authorizationUrl: null,
            state: null,
            proof: null,
            expiresAt: null,
            identity: {
              provider: 'github' as const,
              subject: String(user.id),
              username: user.login,
              name: user.name,
              avatarUrl: user.avatar_url,
            },
          }
        })(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('Provider timeout'))
          }, 5000)
        }),
      ])
    } catch {
      throw new ApiError(502, 'GitHub login could not be completed')
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }

  async function social(
    config: SocialConfig,
    input: { body: unknown },
    binding: { flowId: string; revision: number; scope: string },
  ) {
    const action = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('BEGIN') }).strict(),
        z
          .object({
            action: z.literal('COMPLETE'),
            code: z.string().min(1).max(1024),
            state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            proof: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          })
          .strict(),
      ])
      .safeParse(input.body)
    if (!action.success)
      throw new ApiError(
        400,
        'Use BEGIN or COMPLETE with code, state, and server proof',
      )
    const connection = get(config.connectionId)
    if (action.data.action === 'COMPLETE') {
      if (exchanges >= 4)
        throw new ApiError(429, 'Product login exchange limit exceeded')
      const completion = action.data
      const attempt = db.transaction(() => {
        const stored = query<AttemptRow, [string]>(
          'SELECT * FROM oauth_attempts WHERE state_hash = ?',
        ).get(hashToken(completion.state))
        if (
          !stored ||
          stored.proof_hash !== hashToken(completion.proof) ||
          stored.flow_id !== binding.flowId ||
          stored.revision !== binding.revision ||
          stored.scope !== binding.scope ||
          stored.connection_id !== connection.id ||
          stored.connection_version !== connection.version ||
          stored.expires_at <= now()
        )
          throw new ApiError(400, 'Invalid or expired product login attempt')
        query('DELETE FROM oauth_attempts WHERE state_hash = ?').run(
          stored.state_hash,
        )
        audit(binding.scope, 'product-login.consumed', binding.flowId)
        return stored
      })()
      exchanges++
      try {
        const result = await exchange(
          connection,
          completion.code,
          decrypt(attempt.verifier),
        )
        audit(binding.scope, 'product-login.completed', binding.flowId)
        return result
      } catch (error) {
        audit(binding.scope, 'product-login.failed', binding.flowId)
        throw error
      } finally {
        exchanges--
      }
    }
    const state = randomBytes(32).toString('base64url')
    const proof = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const expiration = now() + 600_000
    const encryptedVerifier = encrypt(verifier)
    db.transaction(() => {
      query('DELETE FROM oauth_attempts WHERE expires_at <= ?').run(now())
      const total = query<{ count: number }, []>(
        'SELECT count(*) AS count FROM oauth_attempts',
      ).get()!.count
      const pending = query<{ count: number }, [string, string]>(
        'SELECT count(*) AS count FROM oauth_attempts WHERE scope = ? AND flow_id = ?',
      ).get(binding.scope, binding.flowId)!.count
      if (total >= 1000 || pending >= 10)
        throw new ApiError(429, 'Product login attempt limit exceeded')
      query(
        'INSERT INTO oauth_attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        hashToken(state),
        hashToken(proof),
        encryptedVerifier,
        binding.flowId,
        binding.revision,
        binding.scope,
        connection.id,
        connection.version,
        expiration,
      )
      audit(binding.scope, 'product-login.started', binding.flowId)
    })()
    const url = new URL('https://github.com/login/oauth/authorize')
    url.search = new URLSearchParams({
      client_id: connection.client_id,
      redirect_uri: connection.redirect_uri,
      scope: 'read:user',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString()
    return {
      authorizationUrl: url.href,
      state,
      proof,
      expiresAt: new Date(expiration).toISOString(),
      identity: null,
    }
  }

  return {
    validate,
    social,
    template(id: string, value: unknown): Flow {
      get(id)
      const parsed = z
        .object({
          name: fields.name,
          path: z
            .string()
            .max(160)
            .regex(/^\/[a-zA-Z0-9/_-]+$/),
          kind: z.enum(['rest', 'graphql']),
        })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Choose a name, API path, and REST or GraphQL')
      const { name, path, kind } = parsed.data
      return {
        name,
        path,
        method: 'POST',
        ...(kind === 'graphql'
          ? {
              graphql: {
                schema: socialLoginSchema,
              },
            }
          : {
              contract: {
                body: {
                  type: 'object' as const,
                  required: ['action'],
                  additionalProperties: false,
                  properties: {
                    action: { type: 'string' as const, maxLength: 8 },
                    code: { type: 'string' as const, maxLength: 1024 },
                    state: { type: 'string' as const, maxLength: 43 },
                    proof: { type: 'string' as const, maxLength: 43 },
                  },
                },
                response: loginResponse,
              },
            }),
        nodes: [
          {
            id: 'request',
            type: 'request',
            position: { x: 80, y: 100 },
            config: {},
          },
          {
            id: 'social',
            type: 'social',
            position: { x: 350, y: 100 },
            config: { connectionId: id },
          },
          {
            id: 'response',
            type: 'response',
            position: { x: 620, y: 100 },
            config: { status: 200, body: '$auth' },
          },
        ],
        edges: [
          { id: 'request-social', source: 'request', target: 'social' },
          { id: 'social-response', source: 'social', target: 'response' },
        ],
      }
    },
    list() {
      return query<ConnectionRow, []>(
        'SELECT * FROM auth_connections ORDER BY rowid DESC',
      )
        .all()
        .map(metadata)
    },
    create(actor: string, value: unknown) {
      const settings = parse(value)
      const id = crypto.randomUUID()
      const secret = encrypt(settings.clientSecret!)
      const timestamp = new Date().toISOString()
      db.transaction(() => {
        query(
          'INSERT INTO auth_connections VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
        ).run(
          id,
          settings.name,
          'github',
          settings.clientId,
          secret,
          settings.redirectUri,
          timestamp,
          timestamp,
        )
        audit(actor, 'auth-connection.created', id)
      })()
      return metadata(get(id))
    },
    update(actor: string, id: string, value: unknown) {
      const settings = parse(value, true)
      db.transaction(() => {
        const previous = get(id)
        const secret =
          settings.clientSecret === undefined
            ? previous.secret
            : encrypt(settings.clientSecret)
        query(
          'UPDATE auth_connections SET name = ?, client_id = ?, secret = ?, redirect_uri = ?, version = version + 1, updated_at = ? WHERE id = ?',
        ).run(
          settings.name,
          settings.clientId,
          secret,
          settings.redirectUri,
          new Date().toISOString(),
          id,
        )
        query('DELETE FROM oauth_attempts WHERE connection_id = ?').run(id)
        audit(actor, 'auth-connection.updated', id)
      })()
      return metadata(get(id))
    },
    delete(actor: string, id: string) {
      db.transaction(() => {
        get(id)
        const references = query<{ definition: string }, []>(
          'SELECT definition FROM flows UNION ALL SELECT definition FROM releases',
        ).all()
        if (
          references.some((row) =>
            JSON.parse(row.definition).nodes.some(
              (node: { type: string; config: { connectionId?: string } }) =>
                node.type === 'social' && node.config.connectionId === id,
            ),
          )
        )
          throw new ApiError(
            409,
            'Auth connection is referenced by a draft or release',
          )
        query('DELETE FROM oauth_attempts WHERE connection_id = ?').run(id)
        query('DELETE FROM auth_connections WHERE id = ?').run(id)
        audit(actor, 'auth-connection.deleted', id)
      })()
      return { ok: true }
    },
  }
}
