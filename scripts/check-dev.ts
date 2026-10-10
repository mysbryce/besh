import {
  mkdtempSync,
  realpathSync,
  statSync,
  mkdirSync,
  copyFileSync,
  constants,
} from 'node:fs'
import { relative, resolve, sep, join, isAbsolute } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { previewStories } from '../e2e/preview-order'
import { getPreviewWorkers, getBrowserWorkers } from './test-workers'
import type { PreviewRecord } from './preview-report'

const root = fileURLToPath(new URL('..', import.meta.url))
const help = `Focused development checks; full delivery checks remain required.

Usage: bun scripts/check-dev.ts [changed-file ...] [options]
  --test <test/file.test.ts>    Run an explicit backend file; repeatable
  --e2e <e2e/file.spec.ts>     Build fresh, then run one normal browser file
  --grep <expression>         Filter the selected normal browser file
  --preview <story-id>        Build fresh, then capture one isolated story
  --help                     Show this help without running checks

Always checks whole-project types and explicit or Git-changed file formatting.
Positional files override Git discovery. Browser modes are mutually exclusive.
Preview IDs: ${previewStories.map((story) => story.id).join(', ')}
first-task runs its containing core test and captures both story receipts.
Browser output stays in fresh .preview/dev-* folders; latest.json is untouched.`

function repositoryFile(value: string) {
  if (/[\r\n\0]/.test(value)) throw new Error('Invalid file argument')

  const path = realpathSync(resolve(root, value))
  const local = relative(root, path)
  if (
    !local ||
    isAbsolute(local) ||
    local === '..' ||
    local.startsWith(`..${sep}`) ||
    resolve(root, local) !== path ||
    !statSync(path).isFile()
  )
    throw new Error('Files must be regular files inside this repository')

  return local.split(sep).join('/')
}

const formats = new Set<string>()
const tests = new Set<string>()
let explicitFiles = false
let e2e: string | undefined
let grep: string | undefined
let preview: (typeof previewStories)[number] | undefined
const arguments_ = process.argv.slice(2)

try {
  if (arguments_.includes('--help')) {
    if (arguments_.length !== 1) throw new Error('Use --help by itself')

    console.log(help)
    process.exit(0)
  }

  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index]!
    if (!argument.startsWith('-')) {
      formats.add(repositoryFile(argument))
      explicitFiles = true
      continue
    }

    if (!['--test', '--e2e', '--grep', '--preview'].includes(argument))
      throw new Error(`Unsupported option: ${argument}`)

    const value = arguments_[++index]
    if (!value || value.startsWith('-'))
      throw new Error(`${argument} requires a value`)

    if (argument === '--preview') {
      if (preview) throw new Error('Choose only one preview story')

      preview = previewStories.find((story) => story.id === value)
      if (!preview) throw new Error('Unknown preview story; see --help')
    } else if (argument === '--grep') {
      if (grep || value.length > 1024) throw new Error('Invalid --grep option')

      new RegExp(value)
      grep = value
    } else {
      const path = repositoryFile(value)
      const pattern =
        argument === '--test'
          ? /^test\/[a-z0-9/-]+\.test\.ts$/
          : /^e2e\/[a-z0-9-]+\.spec\.ts$/
      if (!pattern.test(path) || path === 'e2e/preview.spec.ts')
        throw new Error(`${argument} requires an existing matching test file`)

      formats.add(path)
      if (argument === '--test') tests.add(path)
      else {
        if (e2e) throw new Error('Choose only one browser file')

        e2e = path
      }
    }
  }

  if (e2e && preview) throw new Error('Choose --e2e or --preview, not both')
  if (grep && !e2e) throw new Error('--grep requires --e2e')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid arguments')
  process.exit(1)
}

const workers = preview ? getPreviewWorkers() : getBrowserWorkers()
if (!explicitFiles) {
  const changed = [
    [
      'diff',
      'HEAD',
      '--name-only',
      '--diff-filter=ACMR',
      '-z',
      '--no-ext-diff',
    ],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ].map((arguments_) =>
    spawnSync('git', ['-c', `safe.directory=${resolve(root)}`, ...arguments_], {
      cwd: root,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }),
  )

  if (changed.some((result) => result.error || result.status !== 0))
    console.warn(
      'Git discovery unavailable. Supply changed files explicitly; only supplied test files receive formatting checks.',
    )
  else
    for (const result of changed)
      for (const path of result.stdout.toString('utf8').split('\0'))
        if (path) formats.add(repositoryFile(path))
}

async function run(label: string, arguments_: string[], env = process.env) {
  console.log(`Development check: ${label}`)
  const started = performance.now()
  const child = Bun.spawn([process.execPath, ...arguments_], {
    cwd: root,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const stop = () => child.kill()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  const code = await child.exited
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)

  console.log(`${label}: ${((performance.now() - started) / 1000).toFixed(2)}s`)
  if (code !== 0) process.exit(code)
}

await run('whole-project types', ['run', 'typecheck'])

if (formats.size)
  await run('selected-file formatting', [
    'x',
    '--no-install',
    'prettier',
    '--check',
    '--ignore-unknown',
    ...[...formats].map((path) => resolve(root, path)),
  ])
else console.log('No selected or Git-changed files; formatting was not run.')

if (tests.size)
  await run('selected backend files', [
    'scripts/test.ts',
    ...[...tests].map((path) => `./${path}`),
  ])

if (e2e || preview) {
  await run('fresh dashboard build', ['run', 'build'])
  const parent = join(root, '.preview')
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(join(parent, 'dev-'))
  console.log(`Focused browser output: ${relative(root, directory)}`)

  const selector = preview?.id === 'first-task' ? 'core' : preview?.id
  await run(
    preview ? `preview ${selector}` : 'selected browser file',
    [
      'x',
      '--no-install',
      'playwright',
      'test',
      ...(preview ? ['--config', 'playwright.preview.config.ts'] : [e2e!]),
      `--workers=${workers}`,
      '--output',
      join(directory, 'test-output'),
      ...(selector ? ['--grep', `(?:^|\\s)${selector}$`] : []),
      ...(grep ? ['--grep', grep] : []),
    ],
    {
      ...process.env,
      BESH_E2E_SKIP_PROXY: '',
      BESH_E2E_SKIP_SQLITE: '',
      ...(preview ? { BESH_PREVIEW_DIR: directory } : {}),
    },
  )

  if (preview) {
    const records: PreviewRecord[] = []
    const copies: { source: string; image: string }[] = []
    const receipts = previewStories.filter(
      (story) =>
        story.id === selector ||
        (selector === 'core' && story.id === 'first-task'),
    )
    for (const story of receipts) {
      const folder = join(directory, 'stories', story.id)
      const completed = await Bun.file(join(folder, 'complete.json')).json()
      const images = await Bun.file(join(folder, 'manifest.json')).json()
      if (
        completed?.count !== story.count ||
        !Array.isArray(images) ||
        images.length !== story.count
      )
        throw new Error(`Incomplete focused preview: ${story.id}`)

      for (const record of images) {
        if (
          !record ||
          typeof record.image !== 'string' ||
          !/^images\/[a-z0-9-]+\.png$/.test(record.image) ||
          ![record.page, record.title, record.detail].every(
            (value) => typeof value === 'string',
          )
        )
          throw new Error(`Invalid focused preview entry: ${story.id}`)

        const source = realpathSync(join(folder, record.image))
        if (
          !source.startsWith(realpathSync(folder) + sep) ||
          !statSync(source).isFile()
        )
          throw new Error(`Invalid focused preview image: ${story.id}`)

        const image = `images/${story.id}-${record.image.slice('images/'.length)}`
        copies.push({ source, image })
        records.push({
          page: record.page,
          title: record.title,
          detail: record.detail,
          image,
        })
      }
    }

    mkdirSync(join(directory, 'images'))
    for (const copy of copies)
      copyFileSync(
        copy.source,
        join(directory, copy.image),
        constants.COPYFILE_EXCL,
      )

    const { renderPreview } = await import('./preview-report')
    await Bun.write(
      join(directory, 'manifest.json'),
      JSON.stringify(records, null, 2),
    )
    await Bun.write(join(directory, 'index.html'), renderPreview(records))
    console.log(
      `Focused preview report: ${relative(root, directory)}/index.html`,
    )
  }
}

console.log('Focused checks passed. Full delivery checks remain required.')
