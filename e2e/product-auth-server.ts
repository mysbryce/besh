import { createApp } from '../src/app'

// Only the external GitHub transport is simulated. Besh routes, persistence,
// validation, permissions, and execution use the real application.
const { app, close } = createApp({
  adminToken: process.env.BESH_ADMIN_TOKEN || undefined,
  setupKey: process.env.BESH_SETUP_KEY,
  secretKeyPath: process.env.BESH_SECRET_KEY_PATH,
  databasePath: process.env.BESH_DATABASE_PATH!,
  backupDir: process.env.BESH_BACKUP_DIR!,
  authOrigin: process.env.BESH_WEB_URL,
  oauthFetch: async (url) => {
    if (url === 'https://github.com/login/oauth/access_token') {
      return Response.json({
        access_token: 'disposable-provider-token',
        token_type: 'bearer',
        scope: 'read:user',
      })
    }
    if (url === 'https://api.github.com/user') {
      return Response.json({
        id: 4242,
        login: 'simulated-github-user',
        name: 'Simulated GitHub User',
        avatar_url: 'https://avatars.githubusercontent.com/u/4242',
      })
    }
    throw new Error('Unexpected simulated provider request')
  },
})

app.listen({ hostname: '127.0.0.1', port: Number(process.env.PORT) })

const stop = async () => {
  await app.stop()
  close()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)
