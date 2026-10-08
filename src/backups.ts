import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from './errors'
import type { Store } from './store'

const backupId = /^[a-f0-9-]{36}\.sqlite$/

export function backupService(store: Store, directory: string) {
  mkdirSync(directory, { recursive: true })

  function metadata(id: string) {
    const stat = statSync(join(directory, id))
    return { id, bytes: stat.size, createdAt: stat.mtime.toISOString() }
  }

  return {
    list() {
      return readdirSync(directory)
        .filter((id) => backupId.test(id))
        .map(metadata)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    create(actor: string) {
      const id = `${crypto.randomUUID()}.sqlite`
      store.audit(actor, 'backup.requested', id)

      try {
        // VACUUM INTO includes WAL data and creates a standalone, consistent copy.
        store.query('VACUUM INTO ?').run(join(directory, id))
        store.audit(actor, 'backup.created', id)
        return metadata(id)
      } catch {
        store.audit(actor, 'backup.failed', id)
        throw new ApiError(500, 'Backup failed')
      }
    },
    download(actor: string, id: string) {
      if (!backupId.test(id) || !readdirSync(directory).includes(id))
        throw new ApiError(404, 'Backup not found')
      store.audit(actor, 'backup.downloaded', id)

      return new Response(Bun.file(join(directory, id)), {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': `attachment; filename="${id}"`,
        },
      })
    },
  }
}
