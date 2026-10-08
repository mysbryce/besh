import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { open, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { ApiError, requirePermission } from '../errors'
import type { Store } from './store'

const backupId = /^[a-f0-9-]{36}\.sqlite$/

export function backupService(
  store: Store,
  directory: string,
  authorizeBackup = (actor: string) => {
    const member = store.member(actor)
    if (!member) throw new ApiError(401, 'Authentication required')
    requirePermission(member, 'backups.manage')
  },
) {
  mkdirSync(directory, { recursive: true })

  function guard(actor: string, requestAuthorize?: () => void) {
    authorizeBackup(actor)
    requestAuthorize?.()
  }

  function metadata(id: string) {
    const stat = statSync(join(directory, id))
    return { id, bytes: stat.size, createdAt: stat.mtime.toISOString() }
  }

  return {
    list(actor: string, requestAuthorize?: () => void) {
      guard(actor, requestAuthorize)
      const result = readdirSync(directory)
        .filter((id) => backupId.test(id))
        .map(metadata)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      guard(actor, requestAuthorize)
      return result
    },
    create(actor: string, requestAuthorize?: () => void) {
      guard(actor, requestAuthorize)
      const id = `${crypto.randomUUID()}.sqlite`
      store.audit(actor, 'backup.requested', id)

      try {
        // VACUUM INTO includes WAL data and creates a standalone, consistent copy.
        store.query('VACUUM INTO ?').run(join(directory, id))
        return store.db
          .transaction(() => {
            guard(actor, requestAuthorize)
            const result = metadata(id)
            store.audit(actor, 'backup.created', id)
            return result
          })
          .immediate()
      } catch (error) {
        try {
          unlinkSync(join(directory, id))
        } catch {}
        store.audit(actor, 'backup.failed', id)
        if (error instanceof ApiError) throw error
        throw new ApiError(500, 'Backup failed')
      }
    },
    download(actor: string, id: string, requestAuthorize?: () => void) {
      guard(actor, requestAuthorize)
      if (!backupId.test(id) || !readdirSync(directory).includes(id))
        throw new ApiError(404, 'Backup not found')
      const info = metadata(id)
      guard(actor, requestAuthorize)
      store.audit(actor, 'backup.downloaded', id)

      let handle: FileHandle | undefined
      let position = 0
      let closed = false
      let closing: Promise<void> | undefined

      function close() {
        closed = true
        if (handle) {
          closing = handle.close()
          handle = undefined
        }
        return closing ?? Promise.resolve()
      }

      const body = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            try {
              guard(actor, requestAuthorize)
              if (!handle) {
                const opened = await open(join(directory, id), 'r')
                if (closed) {
                  await opened.close()
                  return
                }
                handle = opened
              }
              guard(actor, requestAuthorize)
              if (position === info.bytes) {
                await close()
                controller.close()
                return
              }

              const chunk = Buffer.allocUnsafe(
                Math.min(65_536, info.bytes - position),
              )
              const { bytesRead } = await handle.read(
                chunk,
                0,
                chunk.byteLength,
                position,
              )
              if (closed) return
              guard(actor, requestAuthorize)
              if (!bytesRead) throw new ApiError(503, 'Backup unavailable')
              position += bytesRead
              controller.enqueue(chunk.subarray(0, bytesRead))
            } catch (error) {
              const cancelled = closed
              await close().catch(() => {})
              if (!cancelled) controller.error(error)
            }
          },
          cancel: close,
        },
        // Never read ahead of demand: a later chunk needs a fresh authority check.
        { highWaterMark: 0 },
      )

      return new Response(body, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(info.bytes),
          'content-disposition': `attachment; filename="${id}"`,
        },
      })
    },
  }
}
