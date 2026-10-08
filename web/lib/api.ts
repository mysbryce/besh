import type { Flow } from '../../src/flows/model'
import type { Permission } from '../../src/permissions'

export async function apiRulesError(
  contract: Flow['contract'],
): Promise<string | null> {
  if (!contract) return null

  function inspect(
    schema: NonNullable<Flow['contract']>['body'],
    path: string,
  ): string | null {
    if (!schema) return null
    if (schema.type === 'object') {
      for (const [name, property] of Object.entries(schema.properties ?? {})) {
        if (
          !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) ||
          ['__proto__', 'prototype', 'constructor'].includes(name)
        )
          return `${path}: field names need a letter or underscore first, then letters, digits or underscores (up to 64 characters).`
        const error = inspect(property, `${path}.${name}`)
        if (error) return error
      }
    } else if (schema.type === 'array') {
      if (
        schema.minItems !== undefined &&
        schema.maxItems !== undefined &&
        schema.minItems > schema.maxItems
      )
        return `${path}: minimum items must not exceed maximum items.`
      return inspect(schema.items, `${path} items`)
    } else if (schema.type === 'string') {
      if (
        schema.minLength !== undefined &&
        schema.maxLength !== undefined &&
        schema.minLength > schema.maxLength
      )
        return `${path}: minimum characters must not exceed maximum characters.`
    } else if (schema.type === 'number' || schema.type === 'integer') {
      if (
        schema.minimum !== undefined &&
        schema.maximum !== undefined &&
        schema.minimum > schema.maximum
      )
        return `${path}: minimum must not exceed maximum.`
    }
    return null
  }

  for (const [key, schema] of Object.entries(contract)) {
    const error = inspect(schema, `${key} rules`)
    if (error) return error
  }
  const { contractSchema } = await import('../../src/flows/contracts')
  if (!contractSchema.safeParse(contract).success)
    return 'Check API rules: lengths and item counts must be whole, nonnegative numbers. Keep rules within 8 levels, 64 fields per object and 256 shapes; query fields must be scalar and cannot allow null.'
  return null
}

export type SavedFlow = Flow & {
  id: string
  revision: number
  publishedRevision: number | null
  publishedEndpoint: {
    method: Flow['method']
    path: string
    graphql: boolean
  } | null
}
export type RuntimePermission = 'rest' | 'query' | 'mutation'
export type RuntimeKey = {
  id: string
  name: string
  flowId: string
  permissions: RuntimePermission[]
  expiresAt: string
  createdAt: string
  revokedAt: string | null
  managedBy?: 'load-test'
}
export type Member = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer' | 'custom'
  permissions: Permission[]
  roleId?: string
  roleName?: string
}
export type Role = {
  id: string
  name: string
  permissions: Permission[]
  version: number
  createdAt: string
  updatedAt: string
}
export function memberRoleName(member: Member | null | undefined) {
  return member?.role === 'custom'
    ? (member.roleName ?? 'Custom role')
    : (member?.role ?? 'Unknown role')
}
export type DataSource = {
  id: string
  name: string
  kind: 'upload' | 'google-sheets'
  columns: {
    key: string
    label: string
    type: 'string' | 'number' | 'boolean'
    nullable: boolean
  }[]
  rowCount: number
  version: number
  createdAt: string
  updatedAt: string
  sheetName?: string
  sourceUrl?: string
}
export type DataSourceDetail = DataSource & { rows: Record<string, unknown>[] }
export type AuthConnection = {
  id: string
  name: string
  provider: 'github'
  clientId: string
  redirectUri: string
  version: number
  createdAt: string
  updatedAt: string
}
export type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}
export type Backup = { id: string; bytes: number; createdAt: string }
export type Migration = { version: number; name: string; applied_at: string }

export type WorkspaceSession = {
  member: Member
  csrfToken: string
  sessionId: string
  expiresAt: string
}

export type SessionRecord = {
  id: string
  memberId: string
  memberName: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  current: boolean
}

let csrfToken = ''
let sessionRequests = new AbortController()
let sessionExpired = () => {}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function setSessionCredential(value: string) {
  sessionRequests.abort()
  sessionRequests = new AbortController()
  csrfToken = value
}

export function onSessionExpired(handler: () => void) {
  sessionExpired = handler
}

export async function authenticatedFetch(
  path: string,
  token = '',
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  else if (
    csrfToken &&
    !['GET', 'HEAD', 'OPTIONS'].includes(options.method ?? 'GET')
  )
    headers.set('X-Besh-CSRF', csrfToken)

  const requestScope = sessionRequests
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
    signal: options.signal ?? requestScope.signal,
  })
  if (requestScope !== sessionRequests)
    throw new Error('Session changed. Try again.')
  if (
    response.status === 401 &&
    !token &&
    path.startsWith('/api/') &&
    csrfToken
  ) {
    sessionExpired()
    throw new ApiError(
      'Your session expired or was revoked. Sign in again.',
      401,
    )
  }

  return response
}

export async function api<T>(
  path: string,
  token = '',
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await authenticatedFetch(path, token, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()

  if (!response.ok)
    throw new ApiError(
      result.error ?? `Request failed (${response.status})`,
      response.status,
    )

  return result as T
}
