import { resolve, sep } from 'node:path'
import { createApp } from '../src/app'
import type { SheetFetch } from '../src/data/google-sheets'

export const googleSourceLink =
  'https://docs.google.com/spreadsheets/d/besh-disposable-locale-sheet-2026/edit#gid=0'
const exportLink =
  'https://docs.google.com/spreadsheets/d/besh-disposable-locale-sheet-2026/export?format=csv&gid=0'

// Only the external provider is simulated. Besh parses, persists and serves
// the resulting snapshots through its ordinary authenticated management API.
export function googleSourceFetch(): SheetFetch {
  let calls = 0

  return async (url, options) => {
    if (
      url !== exportLink ||
      options.redirect !== 'manual' ||
      options.credentials !== 'omit' ||
      options.signal?.aborted
    )
      throw new Error('Unexpected disposable Google provider request')

    calls++

    if (calls > 2)
      return new Response('Disposable provider unavailable', { status: 503 })

    const csv =
      calls === 1
        ? 'Text,Count,Active\nSave draft,12,true\nPublish,15,false\n'
        : 'Text,Count,Active\nImport Google Sheet,18,true\nSave draft,21,false\n'

    return new Response(csv, { headers: { 'content-type': 'text/csv' } })
  }
}

if (import.meta.main) {
  const port = Number(process.env.PORT)
  const origin = `http://127.0.0.1:${port}`

  if (port !== 4332 || process.env.BESH_WEB_URL !== origin)
    throw new Error('Google language fixture needs its isolated same origin')

  const assets = resolve('dist/assets')
  const server = createApp({
    adminToken: process.env.BESH_ADMIN_TOKEN,
    authOrigin: origin,
    databasePath: process.env.BESH_DATABASE_PATH!,
    backupDir: process.env.BESH_BACKUP_DIR!,
    secretKeyPath: process.env.BESH_SECRET_KEY_PATH,
    runtimeCodeDir: process.env.BESH_RUNTIME_CODE_DIR,
    sheetFetch: googleSourceFetch(),
    configureApp: (app) => {
      app
        .get('/assets/*', ({ params, status }) => {
          const file = resolve(assets, params['*'])

          return file.startsWith(assets + sep)
            ? Bun.file(file)
            : status(404, { error: 'Not found' })
        })
        .get('/', () => Bun.file('dist/index.html'))
    },
  })

  server.app.listen({
    hostname: '127.0.0.1',
    port,
    maxRequestBodySize: 3 * 1024 * 1024,
  })

  let stopping = false

  async function stop() {
    if (stopping) return

    stopping = true
    server.beginShutdown()

    try {
      await server.app.stop()
    } finally {
      await server.close()
    }

    process.exit(0)
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  process.stdin.resume()
  process.stdin.on('end', stop)
}
