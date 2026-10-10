import { getBrowserWorkers } from './test-workers'
import { sqlitePreviewStories } from '../e2e/preview-order'
import { cpus } from 'node:os'

const arguments_ = process.argv.slice(2)
const workers = getBrowserWorkers()

async function run(arguments_: string[], env: NodeJS.ProcessEnv) {
  const child = Bun.spawn(
    [
      process.execPath,
      'x',
      '--no-install',
      'playwright',
      'test',
      ...arguments_,
    ],
    { env, stdout: 'inherit', stderr: 'inherit' },
  )

  const stop = () => child.kill()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  const code = await child.exited
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)

  if (code !== 0) process.exit(code)
}

const env = { ...process.env }
delete env.BESH_E2E_SKIP_PROXY
delete env.BESH_E2E_SKIP_SQLITE

const valueOptions = new Set([
  '-j',
  '--workers',
  '-c',
  '--config',
  '--add-reporter',
  '--browser',
  '--global-timeout',
  '--last-failed-file',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--run-agents',
  '--shard',
  '--timeout',
  '--trace',
  '--tsconfig',
  '--ui-host',
  '--ui-port',
  '--update-source-method',
])
let focused = false
let workerOverride: string | undefined

for (let index = 0; index < arguments_.length; index++) {
  const argument = arguments_[index]!
  if (
    !argument.startsWith('-') ||
    ['-g', '-G', '--list', '--help', '-h'].includes(argument) ||
    /^--(?:grep|grep-invert|only-changed|last-failed|test-list)(?:=|$)/.test(
      argument,
    )
  ) {
    focused = true
    break
  }

  if (argument === '--workers' || argument === '-j')
    workerOverride = arguments_[index + 1] ?? ''
  else {
    const override = argument.match(/^--workers=(.*)$|^-j(.+)$/)

    if (override) workerOverride = override[1] ?? override[2]
  }

  if (valueOptions.has(argument)) index++
}

const started = performance.now()

if (focused) await run(arguments_, env)
else {
  let nativeWorkers = workers

  if (workerOverride !== undefined) {
    const selected = Number.parseInt(workerOverride, 10)

    if (!Number.isSafeInteger(selected) || selected < 1)
      throw new Error('Workers must be a positive number or percentage')

    nativeWorkers = workerOverride.endsWith('%')
      ? Math.max(1, Math.floor((cpus().length * selected) / 100))
      : selected
  }

  const sqliteFiles = sqlitePreviewStories
    .filter((story) => story !== 'member-field-profiles')
    .map((story) => `e2e/${story}.spec.ts`)

  // Native reader work finishes before the CPU-adaptive dashboard phase.
  await run(
    [...arguments_, ...sqliteFiles, `--workers=${Math.min(nativeWorkers, 2)}`],
    env,
  )

  await run([`--workers=${workers}`, ...arguments_], {
    ...env,
    BESH_E2E_SKIP_PROXY: '1',
    BESH_E2E_SKIP_SQLITE: '1',
  })

  // This native fixture's short readiness check failed under parallel startup.
  await run(
    [...arguments_, 'e2e/member-field-profiles.spec.ts', '--workers=1'],
    env,
  )

  // Cold Vite startup competes with browser workers and short-lived WS proofs.
  await run([...arguments_, 'e2e/websocket-proxy.spec.ts', '--workers=1'], env)
}

console.log(
  `Browser total: ${((performance.now() - started) / 1000).toFixed(2)}s`,
)
