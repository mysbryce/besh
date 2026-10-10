import { resolve, sep } from 'node:path'
import { createApp } from '../src/app'

const port = Number(process.env.PORT)
const origin = `http://127.0.0.1:${port}`
if (!Number.isInteger(port) || port < 4340 || port > 4343)
  throw new Error('Invalid isolated preview port')
if (process.env.BESH_WEB_URL !== origin)
  throw new Error('Preview must use its exact same origin')

const assets = resolve('dist/assets')
const server = createApp({
  adminToken: process.env.BESH_ADMIN_TOKEN || undefined,
  setupKey: process.env.BESH_SETUP_KEY,
  secretKeyPath: process.env.BESH_SECRET_KEY_PATH,
  databasePath: process.env.BESH_DATABASE_PATH!,
  backupDir: process.env.BESH_BACKUP_DIR!,
  runtimeCodeDir: process.env.BESH_RUNTIME_CODE_DIR,
  authOrigin: origin,
  k6BinaryPath: process.env.BESH_K6_PATH,
  k6CacheDir: process.env.BESH_K6_CACHE_DIR,
  // Preserve the existing preview's external-provider simulation. All Besh
  // authentication, routes, execution, storage and browser traffic are real.
  oauthFetch: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token')
      return Response.json({
        access_token: 'disposable-provider-token',
        token_type: 'bearer',
        scope: 'read:user',
      })
    if (url === 'https://api.github.com/user')
      return Response.json({
        id: 4242,
        login: 'simulated-github-user',
        name: 'Simulated GitHub User',
        avatar_url: 'https://avatars.githubusercontent.com/u/4242',
      })
    throw new Error('Unexpected simulated provider request')
  },
  configureApp: (app) => {
    app
      .get('/assets/*', ({ params, status }) => {
        const path = resolve(assets, params['*'])
        return path.startsWith(assets + sep)
          ? Bun.file(path)
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
// Node's Windows signal termination is abrupt. Pipe closure gives the fixture
// an ordinary, awaited application shutdown before it releases this port.
process.stdin.resume()
process.stdin.on('end', stop)
console.log('Isolated preview ready')
