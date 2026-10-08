import { fileURLToPath } from 'node:url'
import { ApiError } from '../errors'

const processReaders = new Set<AbortController>()

export function databaseProcesses() {
  const active = new Map<AbortController, Promise<void>>()
  let closed = false
  return {
    async run(
      bytes: Uint8Array,
      operation: unknown,
      signal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
      if (closed) throw new ApiError(503, 'SQLite reader is shutting down')
      if (processReaders.size >= 2)
        throw new ApiError(429, 'SQLite readers are busy. Try again shortly.')
      const controller = new AbortController()
      let finished!: () => void
      const completion = new Promise<void>((resolve) => {
        finished = resolve
      })
      active.set(controller, completion)
      processReaders.add(controller)
      const timer = setTimeout(() => controller.abort(), 2000)
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) controller.abort()
      let child: ReturnType<typeof Bun.spawn> | undefined
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      const kill = () => {
        try {
          child?.kill('SIGKILL')
        } catch {}
      }
      controller.signal.addEventListener('abort', kill, { once: true })
      try {
        if (controller.signal.aborted)
          throw new ApiError(503, 'SQLite read was cancelled')
        child = Bun.spawn(
          [
            process.execPath,
            '--no-env-file',
            '--no-install',
            fileURLToPath(new URL('./worker.ts', import.meta.url)),
            JSON.stringify(operation),
          ],
          {
            env: {
              ...(process.env.SystemRoot
                ? { SystemRoot: process.env.SystemRoot }
                : {}),
              ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
            },
            stdin: bytes,
            stdout: 'pipe',
            stderr: 'ignore',
          },
        )
        reader = (child.stdout as ReadableStream<Uint8Array>).getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        while (true) {
          const item = await reader.read()
          if (item.done) break
          size += item.value.length
          if (size > 262144)
            throw new ApiError(413, 'SQLite response size limit exceeded')
          chunks.push(item.value)
        }
        const code = await child.exited
        if (controller.signal.aborted)
          throw new ApiError(
            503,
            'SQLite read exceeded its deadline or was cancelled',
          )
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (code !== 0 || result.error)
          throw new ApiError(
            400,
            typeof result.error === 'string'
              ? result.error
              : 'SQLite copy could not be read',
          )
        return result
      } catch (error) {
        if (error instanceof ApiError) throw error
        throw new ApiError(400, 'SQLite copy could not be read')
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        kill()
        if (reader) {
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
        if (child) await child.exited
        active.delete(controller)
        processReaders.delete(controller)
        finished()
      }
    },
    close() {
      closed = true
      const completions = [...active.values()]
      for (const controller of active.keys()) controller.abort()
      return Promise.all(completions).then(() => {})
    },
  }
}
