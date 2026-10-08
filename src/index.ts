import { resolve, sep } from 'node:path'
import { createApp } from './app'

const token = process.env.BESH_ADMIN_TOKEN || undefined

const setupKey =
  process.env.BESH_SETUP_KEY ?? crypto.randomUUID() + crypto.randomUUID()

const assets = resolve('dist/assets')
const server = createApp({
  adminToken: token,
  setupKey,
  authOrigin: process.env.BESH_WEB_URL,
  secretKeyPath: process.env.BESH_SECRET_KEY_PATH,
  k6BinaryPath: process.env.BESH_K6_PATH,
  k6CacheDir: process.env.BESH_K6_CACHE_DIR,
  databasePath: process.env.BESH_DATABASE_PATH ?? 'data/besh.sqlite',
  backupDir: process.env.BESH_BACKUP_DIR ?? 'data/backups',
  runtimeCodeDir: process.env.BESH_RUNTIME_CODE_DIR,
  configureApp: (app) => {
    app
      .get('/assets/*', ({ params, status }) => {
        const file = resolve(assets, params['*'])
        if (!file.startsWith(assets + sep))
          return status(404, { error: 'Not found' })
        return Bun.file(file)
      })
      .get('/', async ({ status }) => {
        const file = Bun.file('dist/index.html')
        return (await file.exists())
          ? file
          : status(404, { error: 'Run bun run dev or bun run build first' })
      })
  },
})

server.app.listen({
  hostname: process.env.BESH_HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: 3 * 1024 * 1024,
})

console.log(`Besh API ready at ${server.app.server?.url}`)

if (server.setupRequired) {
  const base = process.env.BESH_WEB_URL ?? server.app.server!.url.origin
  console.log(`First-run setup: ${base}/?setup=${setupKey}`)
}

const stop = async () => {
  await server.app.stop()
  await server.close()
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
