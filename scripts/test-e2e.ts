import { getTestWorkers } from './test-workers'

const arguments_ = process.argv.slice(2)
const workers = getTestWorkers()

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

  if (valueOptions.has(argument)) index++
}

const started = performance.now()

if (focused) await run(arguments_, env)
else {
  // Cold Vite startup competes with browser workers and short-lived WS proofs.
  await run([`--workers=${workers}`, ...arguments_], {
    ...env,
    BESH_E2E_SKIP_PROXY: '1',
  })
  await run([...arguments_, 'e2e/websocket-proxy.spec.ts', '--workers=1'], env)
}

console.log(
  `Browser total: ${((performance.now() - started) / 1000).toFixed(2)}s`,
)
