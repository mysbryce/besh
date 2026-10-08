import process from 'node:process'

const api = Bun.spawn([process.execPath, '--watch', 'src/index.ts'], {
  env: { ...process.env, BESH_WEB_URL: 'http://127.0.0.1:5173' },
  stdout: 'inherit',
  stderr: 'inherit',
})

const web = Bun.spawn(
  [process.execPath, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
  {
    stdout: 'inherit',
    stderr: 'inherit',
  },
)

function stop() {
  api.kill()
  web.kill()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const code = await Promise.race([api.exited, web.exited])
stop()
process.exit(code)
