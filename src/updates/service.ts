import { version } from '../../package.json'
import { ApiError } from '../errors'
import type { Store } from '../workspace/store'
import type { ReleaseNotice, UpdateCheck, UpdateState } from './model'
import { z } from 'zod'

function repository(value: string) {
  try {
    const url = new URL(value)
    const match = url.pathname.match(
      /^\/([a-zA-Z0-9-]{1,39})\/([a-zA-Z0-9_.-]{1,100})\/?$/,
    )
    if (
      url.origin !== 'https://github.com' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !match
    )
      throw new Error()
    const name = match[2].replace(/\.git$/i, '')
    if (!name || name === '.' || name === '..') throw new Error()
    return `https://github.com/${match[1]}/${name}`
  } catch {
    throw new ApiError(
      400,
      'Use a GitHub repository URL without credentials, query or fragment',
    )
  }
}

const settingsInput = z
  .object({
    repositoryUrl: z.string().trim().min(1).max(300),
    includePrereleases: z.boolean(),
    revision: z.number().int().min(1),
  })
  .strict()
type SavedState = Pick<UpdateState, 'settings' | 'lastCheck'> & {
  nextCheckAt?: number
  lease?: { id: string; expiresAt: number }
}
const checkInput = z.object({ revision: z.number().int().positive() }).strict()

function semanticVersion(value: string) {
  if (value.length > 128) return null
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
  )
  if (!match) return null
  const prerelease = match[4]?.split('.') ?? []
  if (
    prerelease.some(
      (part) => /^\d+$/.test(part) && part.length > 1 && part[0] === '0',
    )
  )
    return null
  return { core: match.slice(1, 4).map(BigInt), prerelease }
}

function compareVersions(left: string, right: string) {
  const a = semanticVersion(left)!
  const b = semanticVersion(right)!
  for (let index = 0; index < 3; index++) {
    if (a.core[index] !== b.core[index])
      return a.core[index] > b.core[index] ? 1 : -1
  }
  if (!a.prerelease.length || !b.prerelease.length)
    return a.prerelease.length === b.prerelease.length
      ? 0
      : a.prerelease.length
        ? -1
        : 1
  for (
    let index = 0;
    index < Math.max(a.prerelease.length, b.prerelease.length);
    index++
  ) {
    const first = a.prerelease[index]
    const second = b.prerelease[index]
    if (first === second) continue
    if (first === undefined || second === undefined)
      return first === undefined ? -1 : 1
    const firstNumeric = /^\d+$/.test(first)
    const secondNumeric = /^\d+$/.test(second)
    if (firstNumeric && secondNumeric)
      return BigInt(first) > BigInt(second) ? 1 : -1
    if (firstNumeric !== secondNumeric) return firstNumeric ? -1 : 1
    return first > second ? 1 : -1
  }
  return 0
}

function latestRelease(
  value: unknown,
  settings: SavedState['settings'],
): ReleaseNotice | null {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error('Invalid release list')
  let latest: ReleaseNotice | null = null
  for (const item of value.slice(0, 20)) {
    if (
      !item ||
      typeof item !== 'object' ||
      item.draft !== false ||
      typeof item.tag_name !== 'string'
    )
      continue
    const tag = item.tag_name
    const version = tag.replace(/^v/, '')
    const parsed = semanticVersion(version)
    if (!parsed) continue
    const prerelease = item.prerelease === true || parsed.prerelease.length > 0
    if (prerelease && !settings.includePrereleases) continue
    if (latest && compareVersions(version, latest.version) <= 0) continue
    const date =
      typeof item.published_at === 'string'
        ? Date.parse(item.published_at)
        : NaN
    latest = {
      version,
      tag,
      name: typeof item.name === 'string' ? item.name.slice(0, 160) : tag,
      url: `${settings.repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`,
      publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
      prerelease,
    }
  }
  return latest
}

export type ReleaseFetch = (url: string, init: RequestInit) => Promise<Response>

async function releaseBody(response: Response, signal: AbortSignal) {
  let headerBytes = 0
  let headerCount = 0
  for (const [name, value] of response.headers) {
    headerBytes += new TextEncoder().encode(name + value).byteLength
    headerCount++
    if (headerBytes > 32 * 1024 || headerCount > 64) {
      void response.body?.cancel().catch(() => {})
      throw new Error('Release headers too large')
    }
  }
  if (!response.ok || !response.body) {
    void response.body?.cancel().catch(() => {})
    throw new Error('GitHub release request failed')
  }
  const length = response.headers.get('content-length')
  if (length && Number(length) > 256 * 1024) {
    void response.body.cancel().catch(() => {})
    throw new Error('Release response too large')
  }
  const reader = response.body.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 256 * 1024) throw new Error('Release response too large')
      chunks.push(value)
    }
    const body = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    signal.throwIfAborted()
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(body),
    ) as unknown
  } finally {
    signal.removeEventListener('abort', cancel)
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function updateService(
  store: Store,
  options: { fetch?: ReleaseFetch; now?: () => number } = {},
) {
  const now = options.now ?? Date.now
  const transport = options.fetch ?? fetch
  const active = new Set<AbortController>()
  let closed = false

  function read(): SavedState {
    const row = store
      .query<{ value: string }, []>(
        "SELECT value FROM settings WHERE key = 'updates'",
      )
      .get()
    if (row) return JSON.parse(row.value) as SavedState
    return {
      settings: {
        repositoryUrl: 'https://github.com/mysbryce/besh',
        includePrereleases: true,
        revision: 1,
        updatedAt: null,
      },
      lastCheck: null,
    }
  }

  function write(state: SavedState) {
    store
      .query(
        "INSERT INTO settings (key, value) VALUES ('updates', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(JSON.stringify(state))
  }

  function get(): UpdateState {
    const { settings, lastCheck } = read()
    const check =
      lastCheck?.release && ['available', 'current'].includes(lastCheck.status)
        ? {
            ...lastCheck,
            status:
              compareVersions(lastCheck.release.version, version) > 0
                ? ('available' as const)
                : ('current' as const),
          }
        : lastCheck
    return { currentVersion: version, settings, lastCheck: check }
  }

  return {
    get,
    close() {
      closed = true
      for (const controller of active) controller.abort()
      active.clear()
    },
    save(actor: string, value: unknown): UpdateState {
      const parsed = settingsInput.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose a repository, prerelease setting and current revision',
        )
      const repositoryUrl = repository(parsed.data.repositoryUrl)
      store.db
        .transaction(() => {
          const state = read()
          if (parsed.data.revision !== state.settings.revision)
            throw new ApiError(
              409,
              'Update settings changed. Refresh before saving.',
            )
          write({
            ...state,
            settings: {
              repositoryUrl,
              includePrereleases: parsed.data.includePrereleases,
              revision: state.settings.revision + 1,
              updatedAt: new Date(now()).toISOString(),
            },
            lastCheck: null,
          })
          store.audit(actor, 'update.settings.saved', 'updates')
        })
        .immediate()
      return get()
    },
    async check(actor: string, value: unknown): Promise<UpdateState> {
      if (closed) throw new ApiError(503, 'Update checking is shutting down')
      const parsed = checkInput.safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Use the current update settings revision')
      const leaseId = crypto.randomUUID()
      const state = store.db
        .transaction(() => {
          const state = read()
          if (parsed.data.revision !== state.settings.revision)
            throw new ApiError(
              409,
              'Update settings changed. Refresh before checking.',
            )
          if (state.lease && state.lease.expiresAt > now())
            throw new ApiError(409, 'An update check is already running')
          if (state.nextCheckAt && state.nextCheckAt > now())
            throw new ApiError(429, 'Wait one minute between update checks')
          const next = {
            ...state,
            nextCheckAt: now() + 60_000,
            lease: { id: leaseId, expiresAt: now() + 10_000 },
          }
          write(next)
          store.audit(actor, 'update.check.started', 'updates')
          return next
        })
        .immediate()
      const path = new URL(state.settings.repositoryUrl).pathname
      let lastCheck: UpdateCheck
      const controller = new AbortController()
      active.add(controller)
      const timeout = setTimeout(() => controller.abort(), 5000)
      let aborted!: () => void
      const deadline = new Promise<never>((_resolve, reject) => {
        aborted = () => reject(new Error('Update check aborted'))
        controller.signal.addEventListener('abort', aborted, { once: true })
      })
      try {
        const work = async () => {
          const response = await transport(
            `https://api.github.com/repos${path}/releases?per_page=20`,
            {
              headers: {
                accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2026-03-10',
                'user-agent': `Besh/${version}`,
              },
              redirect: 'error',
              signal: controller.signal,
            },
          )
          return latestRelease(
            await releaseBody(response, controller.signal),
            state.settings,
          )
        }
        const release = await Promise.race([work(), deadline])
        lastCheck = {
          checkedAt: new Date(now()).toISOString(),
          status: release
            ? compareVersions(release.version, version) > 0
              ? 'available'
              : 'current'
            : 'no-releases',
          release,
          error: null,
        }
      } catch {
        lastCheck = {
          checkedAt: new Date(now()).toISOString(),
          status: 'error',
          release: null,
          error:
            'GitHub releases could not be checked. Confirm the public repository and try again later.',
        }
      } finally {
        clearTimeout(timeout)
        active.delete(controller)
        controller.signal.removeEventListener('abort', aborted)
      }
      if (closed) throw new ApiError(503, 'Update checking is shutting down')
      const saved = store.db
        .transaction(() => {
          const current = read()
          if (
            current.lease?.id !== leaseId ||
            current.settings.revision !== state.settings.revision
          ) {
            if (current.lease?.id === leaseId)
              write({ ...current, lease: undefined })
            store.audit(actor, 'update.check.discarded', 'updates')
            return false
          }
          write({ ...current, lastCheck, lease: undefined })
          store.audit(
            actor,
            lastCheck.status === 'error'
              ? 'update.check.failed'
              : 'update.check.completed',
            'updates',
          )
          return true
        })
        .immediate()
      if (!saved)
        throw new ApiError(
          409,
          'Update settings changed. Check again after refreshing.',
        )
      return get()
    },
  }
}
