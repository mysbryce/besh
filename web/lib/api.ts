import type { Flow } from '../../src/flows/model'

export type SavedFlow = Flow & {
  id: string
  revision: number
  publishedRevision: number | null
}
export type Member = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
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

export async function api<T>(
  path: string,
  token = '',
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()

  if (!response.ok)
    throw new Error(result.error ?? `Request failed (${response.status})`)

  return result as T
}
