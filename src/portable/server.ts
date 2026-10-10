import { join, resolve, sep } from 'node:path'
import type { createApp } from '../app'
import { openBrowser } from './browser'
import { PortableError, ready, type PortableOptions } from './cli'
import { acquire, dataRoot } from './instance'

export async function serve(options: PortableOptions) {
  const dataDirectory = dataRoot(options.dataDirectory, true)
  if (!dataDirectory)
    throw new PortableError('Besh data directory is unavailable.')

  // Exclusive ownership precedes the application import and every database open.
  const ownership = acquire(dataDirectory)
  let server: ReturnType<typeof createApp> | undefined
  let privateServer: ReturnType<typeof Bun.serve> | undefined
  let shutdown: Promise<void> | undefined
  let stopping = false

  const close = () => {
    if (shutdown) return shutdown

    stopping = true
    shutdown = (async () => {
      if (server) {
        server.beginShutdown()

        try {
          if (server.app.server) await server.app.stop()
        } finally {
          await server.close()
        }
      }

      if (privateServer) await privateServer.stop(true)

      ownership.release()
    })()

    return shutdown
  }

  const stop = () => {
    void close().then(
      () => process.exit(0),
      () => {
        console.error(
          'Besh could not complete shutdown cleanly. Workspace ownership was retained.',
        )

        process.exit(1)
      },
    )
  }

  try {
    const { createApp } = await import('../app')

    const dashboard = Bun.isStandaloneExecutable
      ? join(import.meta.dir, 'dist')
      : resolve(import.meta.dir, '../../dist')
    const html = Bun.file(join(dashboard, 'index.html'))

    if (!(await html.exists()))
      throw new PortableError(
        'Besh dashboard is missing. Rebuild the portable executable with its dashboard.',
      )

    const assets = join(dashboard, 'assets')
    const setupKey = crypto.randomUUID() + crypto.randomUUID()

    server = createApp({
      setupKey,
      databasePath: join(dataDirectory, 'besh.sqlite'),
      backupDir: join(dataDirectory, 'backups'),
      secretKeyPath: join(dataDirectory, 'besh-secrets.key'),
      runtimeCodeDir: join(dataDirectory, 'runtime-code'),
      k6CacheDir: join(dataDirectory, 'cache', 'k6'),
      configureApp: (app) => {
        app
          .get('/assets/*', async ({ params, status }) => {
            const path = resolve(assets, params['*'])

            if (!path.startsWith(assets + sep))
              return status(404, { error: 'Not found' })

            const file = Bun.file(path)

            return (await file.exists())
              ? file
              : status(404, { error: 'Not found' })
          })
          .get('/', () => html)
      },
    })

    server.app.listen({
      hostname: '127.0.0.1',
      port: options.port,
      maxRequestBodySize: 3 * 1024 * 1024,
    })

    const address = server.app.server?.url
    if (!address)
      throw new PortableError('Besh did not acquire a listening address.')

    const publicURL = new URL('/', address).href
    const identity = {
      version: 1,
      nonce: ownership.owner.nonce,
      dataDirectory,
      executable: ownership.owner.executable,
      publicURL,
    }

    const browserURL = async () => {
      // setupRequired is a startup snapshot. Read the current public status so
      // later open/start never delivers a spent setup challenge after setup.
      const response = await fetch(new URL('/setup/status', publicURL), {
        redirect: 'manual',
        signal: AbortSignal.timeout(2_000),
      })

      if (response.status !== 200) throw new Error()

      const reader = response.body?.getReader()
      if (!reader) throw new Error()

      const chunks: Uint8Array[] = []
      let bytes = 0
      let status: { required?: unknown }

      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break

          bytes += part.value.byteLength
          if (bytes > 4096) throw new Error()

          chunks.push(part.value)
        }

        status = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }

      if (typeof status.required !== 'boolean') throw new Error()

      const url = new URL(publicURL)
      if (status.required) url.searchParams.set('setup', setupKey)

      return url.href
    }

    privateServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      maxRequestBodySize: 1024,
      async fetch(request) {
        const url = new URL(request.url)

        if (
          request.method !== 'POST' ||
          url.pathname !== '/control' ||
          url.search ||
          url.hostname !== '127.0.0.1' ||
          request.headers.has('origin') ||
          !ownership.authorize(request.headers.get('authorization'))
        )
          return new Response(null, { status: 403 })

        if (stopping) return new Response(null, { status: 503 })

        try {
          const operation: unknown = await request.json()

          if (
            !operation ||
            typeof operation !== 'object' ||
            Array.isArray(operation) ||
            Object.keys(operation).some(
              (key) => key !== 'action' && key !== 'nonce',
            ) ||
            !('nonce' in operation) ||
            operation.nonce !== identity.nonce ||
            !('action' in operation) ||
            !['identity', 'open', 'stop'].includes(String(operation.action))
          )
            return new Response(null, { status: 400 })

          if (operation.action === 'open')
            return Response.json({ ...identity, openURL: await browserURL() })

          if (operation.action === 'stop') {
            stopping = true

            // Return the private acknowledgement before closing its listener.
            setTimeout(stop, 25)
            return Response.json(identity, { status: 202 })
          }

          return Response.json(identity)
        } catch {
          return new Response(null, { status: 503 })
        }
      },

      error() {
        return new Response(null, { status: 400 })
      },
    })

    const controlURL = new URL('/control', privateServer.url).href
    ownership.publish(controlURL, publicURL)

    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    if (!options.noOpen) await openBrowser(await browserURL(), options.browser)

    ready(publicURL)
  } catch (error) {
    await close().catch(() => {})

    if (error instanceof PortableError) throw error

    throw new PortableError(
      'Besh could not start. Check the selected data directory and port.',
    )
  }
}
