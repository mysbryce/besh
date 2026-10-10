import { existsSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTestWorkers } from './test-workers'

const arguments_ = process.argv.slice(2)
const workers = getTestWorkers()
const root = realpathSync(fileURLToPath(new URL('../test', import.meta.url)))
const files = new Set<string>()
let selectedPaths = false
const options: string[] = []
const valueOptions = new Set([
  '-t',
  '--test-name-pattern',
  '--timeout',
  '--rerun-each',
  '--retry',
  '--seed',
  '--coverage-reporter',
  '--coverage-dir',
  '--reporter',
  '--reporter-outfile',
  '--max-concurrency',
  '--path-ignore-patterns',
  '--parallel-delay',
  '--shard',
  '--timings',
])

function pathKey(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function backendPath(value: string) {
  const path = realpathSync(resolve(value))
  const local = relative(root, path)
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
    throw new Error('Select existing files or directories inside test/')

  return path
}

for (let index = 0; index < arguments_.length; index++) {
  const argument = arguments_[index]!
  if (argument.startsWith('-')) {
    if (
      /^--(?:parallel|concurrent|no-isolate|test-worker)(?:=|$)/.test(argument)
    )
      throw new Error(
        'Use BESH_TEST_WORKERS to configure isolated file workers',
      )

    options.push(argument)
    if (argument === '--bail' && /^\d+$/.test(arguments_[index + 1] ?? '')) {
      options.push(arguments_[++index]!)
      continue
    }

    if (valueOptions.has(argument)) {
      const value = arguments_[++index]
      if (!value) throw new Error(`${argument} requires a value`)

      options.push(value)
    }
    continue
  }

  selectedPaths = true
  if (!existsSync(resolve(argument)))
    throw new Error('Select existing files or directories inside test/')

  const path = backendPath(argument)

  if (statSync(path).isDirectory()) {
    for (const file of new Bun.Glob('**/*.test.ts').scanSync({
      cwd: path,
      absolute: true,
    }))
      files.add(backendPath(file))
  } else if (path.endsWith('.test.ts')) files.add(path)
  else throw new Error('Select a backend .test.ts file')
}

if (selectedPaths && !files.size)
  throw new Error('No backend test files in the selected paths')

if (!selectedPaths)
  for (const file of new Bun.Glob('**/*.test.ts').scanSync({
    cwd: root,
    absolute: true,
  }))
    files.add(backendPath(file))

// These files spawn real SQLite readers with a production two-second deadline.
const sqliteFiles = new Set(
  [
    'database-connections',
    'field-policy',
    'member-field-corruption',
    'member-field-policy',
    'read-graph',
    'resource-access',
    'row-database',
    'row-protection',
    'tenant-field-policy',
  ].map((name) => pathKey(resolve(root, `${name}.test.ts`))),
)

// The policy-race fixture deliberately performs CPU-heavy copy inspection.
const exclusiveFile = pathKey(resolve(root, 'row-database.test.ts'))

const groups = [
  {
    files: [...files].filter((file) => !sqliteFiles.has(pathKey(file))),
    workers,
  },
  {
    files: [...files].filter(
      (file) =>
        sqliteFiles.has(pathKey(file)) && pathKey(file) !== exclusiveFile,
    ),
    workers: Math.min(workers, 2),
  },
  {
    files: [...files].filter((file) => pathKey(file) === exclusiveFile),
    workers: 1,
  },
]

const started = performance.now()

for (const group of groups) {
  if (!group.files.length) continue

  console.log(
    `Backend tests: ${group.files.length} files, ${group.workers} isolated workers`,
  )
  const child = Bun.spawn(
    [
      process.execPath,
      'test',
      '--no-orphans',
      `--parallel=${group.workers}`,
      ...options,
      ...group.files,
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  )

  const stop = () => child.kill()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  const code = await child.exited
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)

  if (code !== 0) process.exit(code)
}

console.log(
  `Backend total: ${((performance.now() - started) / 1000).toFixed(2)}s`,
)
