import { existsSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { renderPreview, type PreviewRecord } from './preview-report'

const root = resolve('.preview')
let directory: string

if (process.argv.includes('--open')) {
  const latest = Bun.file(join(root, 'latest.json'))
  if (!(await latest.exists())) throw new Error('Run bun run preview:all first')

  directory = resolve((await latest.json()).directory)
  if (!directory.startsWith(root + sep)) throw new Error('Invalid preview path')
} else {
  directory = join(root, `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`)
  mkdirSync(directory, { recursive: true })

  const channel =
    process.env.PLAYWRIGHT_CHANNEL ??
    (process.platform === 'win32' &&
    existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? 'chrome'
      : undefined)
  const check = Bun.spawn(
    [
      process.execPath,
      'x',
      'playwright',
      'test',
      '--config',
      'playwright.preview.config.ts',
    ],
    {
      env: {
        ...process.env,
        BESH_PREVIEW_DIR: directory,
        BESH_PREVIEW_SETUP_KEY: crypto.randomUUID() + crypto.randomUUID(),
        ...(channel ? { PLAYWRIGHT_CHANNEL: channel } : {}),
      },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )

  const stopCheck = () => check.kill()
  process.on('SIGINT', stopCheck)
  process.on('SIGTERM', stopCheck)

  const exitCode = await check.exited
  process.off('SIGINT', stopCheck)
  process.off('SIGTERM', stopCheck)
  if (exitCode !== 0) process.exit(exitCode)

  const records = (await Bun.file(
    join(directory, 'manifest.json'),
  ).json()) as PreviewRecord[]
  await Bun.write(join(directory, 'index.html'), renderPreview(records))
  await Bun.write(join(root, 'latest.json'), JSON.stringify({ directory }))

  console.log(`Preview complete: ${records.length} screenshots in ${directory}`)
}

if (process.argv.includes('--no-serve')) process.exit(0)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.BESH_PREVIEW_PORT ?? 4174),
  async fetch(request) {
    const path = new URL(request.url).pathname
    const allowed =
      path === '/' ||
      path === '/manifest.json' ||
      /^\/images\/[a-z0-9-]+\.png$/.test(path)
    if (!allowed) return new Response('Not found', { status: 404 })

    const filePath = resolve(
      directory,
      path === '/' ? 'index.html' : path.slice(1),
    )
    if (!filePath.startsWith(directory + sep))
      return new Response('Not found', { status: 404 })

    const file = Bun.file(filePath)
    if (!(await file.exists()))
      return new Response('Not found', { status: 404 })

    return new Response(file, {
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  },
})

function stop() {
  server.stop(true)
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`Preview gallery: ${server.url}`)
console.log(
  'Press Ctrl+C to stop. Reopen later with bun run preview:all --open',
)
