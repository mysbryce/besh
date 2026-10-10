import { createApp } from '../src/app'

const { app, close } = createApp({
  databasePath: process.env.BESH_DATABASE_PATH!,
  backupDir: process.env.BESH_BACKUP_DIR!,
  adminToken: process.env.BESH_ADMIN_TOKEN,
  authOrigin: process.env.BESH_WEB_URL,
  updateFetch: async (url) => {
    if (!url.startsWith('https://api.github.com/repos/'))
      throw new Error('Unexpected release fixture target')
    return Response.json([
      {
        tag_name: 'v0.99.0-beta.2',
        name: 'Release status',
        draft: false,
        prerelease: true,
        published_at: '2026-10-08T12:00:00Z',
      },
    ])
  },
})

app.listen({ hostname: '127.0.0.1', port: Number(process.env.PORT) })

async function stop() {
  await app.stop()
  close()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)
