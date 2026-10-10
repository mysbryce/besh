import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { renderPreview, type PreviewRecord } from './preview-report'
import { previewStories } from '../e2e/preview-order'
import { getPreviewWorkers } from './test-workers'

const root = resolve('.preview')
let directory: string

if (process.argv.includes('--open')) {
  const latest = Bun.file(join(root, 'latest.json'))
  if (!(await latest.exists())) throw new Error('Run bun run preview:all first')

  directory = resolve((await latest.json()).directory)
  if (!directory.startsWith(root + sep)) throw new Error('Invalid preview path')
} else {
  const workersArgument = process.argv.find((argument) =>
    argument.startsWith('--workers='),
  )
  const workers = getPreviewWorkers(workersArgument?.slice('--workers='.length))

  directory = join(root, `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`)
  mkdirSync(directory, { recursive: true })

  // Build once; every isolated workspace serves these exact dashboard bytes.
  const build = Bun.spawn([process.execPath, 'run', 'build'], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const stopBuild = () => build.kill()
  process.on('SIGINT', stopBuild)
  process.on('SIGTERM', stopBuild)
  const buildExit = await build.exited
  process.off('SIGINT', stopBuild)
  process.off('SIGTERM', stopBuild)
  if (buildExit !== 0) process.exit(buildExit)

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
      `--workers=${workers}`,
    ],
    {
      env: {
        ...process.env,
        BESH_PREVIEW_DIR: directory,
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

  const records: PreviewRecord[] = []
  mkdirSync(join(directory, 'images'), { recursive: true })
  for (const story of previewStories) {
    const storyDirectory = join(directory, 'stories', story.id)
    const completed = await Bun.file(
      join(storyDirectory, 'complete.json'),
    ).json()
    const part = (await Bun.file(
      join(storyDirectory, 'manifest.json'),
    ).json()) as PreviewRecord[]
    if (completed.count !== story.count || part.length !== story.count)
      throw new Error(`Incomplete preview story: ${story.id}`)

    const canonicalPart: PreviewRecord[] = []
    for (const record of part) {
      if (!/^images\/[a-z0-9-]+\.png$/.test(record.image))
        throw new Error(`Invalid preview image: ${story.id}`)
      if (
        ![record.page, record.title, record.detail].every(
          (text) => typeof text === 'string',
        )
      )
        throw new Error(`Invalid preview caption: ${story.id}`)
      const image = record.image.replace(
        /^images\/\d+-/,
        `images/${String(records.length + 1).padStart(2, '0')}-`,
      )
      renameSync(join(storyDirectory, record.image), join(directory, image))
      const canonical = { ...record, image }
      canonicalPart.push(canonical)
      records.push(canonical)
    }
    await Bun.write(
      join(storyDirectory, 'manifest.json'),
      JSON.stringify(canonicalPart, null, 2),
    )
  }

  // Existing canonical identities and captions must survive the parallel split.
  const latest = Bun.file(join(root, 'latest.json'))
  if (await latest.exists()) {
    const previousDirectory = resolve((await latest.json()).directory)
    if (!previousDirectory.startsWith(root + sep))
      throw new Error('Invalid previous preview path')
    const previous = (await Bun.file(
      join(previousDirectory, 'manifest.json'),
    ).json()) as PreviewRecord[]
    if (previous.length >= 862) {
      for (let index = 0; index < 862; index++) {
        const before = previous[index]
        const expected =
          before.title === 'Drag a response from palette'
            ? {
                ...before,
                title: 'Add and position a response from picker',
                detail:
                  'Choose JSON response in the step picker, then drag its node to a new canvas position.',
                image: before.image.replace(
                  'drag-a-response-from-palette',
                  'add-and-position-a-response-from-picker',
                ),
              }
            : before
        if (JSON.stringify(records[index]) !== JSON.stringify(expected))
          throw new Error(`Legacy preview identity changed at ${index + 1}`)
      }
    }
  }

  await Bun.write(
    join(directory, 'manifest.json'),
    JSON.stringify(records, null, 2),
  )
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
