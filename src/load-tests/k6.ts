import { createHash } from 'node:crypto'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { z } from 'zod'
import type { K6Runner } from './model'

const version = 'v2.3.0'
const archives: Record<string, { name: string; sha256: string }> = {
  'win32-x64': {
    name: `k6-${version}-windows-amd64.zip`,
    sha256: '112276d495e5741c968e2bc09ea6196099c1275bd6db9ee0875d173c7148ce43',
  },
  'linux-x64': {
    name: `k6-${version}-linux-amd64.tar.gz`,
    sha256: '39c3117b6af817592dcd0ce4242105c0a7af10948c2a425306f0be8f7a8a8ab1',
  },
  'linux-arm64': {
    name: `k6-${version}-linux-arm64.tar.gz`,
    sha256: '5ca3433e8201da72a284aaa241a1bb5fb47f4abb4e384d39410ddd8062f49b90',
  },
  'darwin-x64': {
    name: `k6-${version}-macos-amd64.zip`,
    sha256: 'c83bb16f54f0676afa4ea235fd757f3892d307dbd1bd201450de83af31986654',
  },
  'darwin-arm64': {
    name: `k6-${version}-macos-arm64.zip`,
    sha256: 'b2417a3038edc5fe81dc178a889237724b595c5c9cfed875822008e46e862c7d',
  },
}

const script = `import http from 'k6/http'
import { check, sleep } from 'k6'

const config = JSON.parse(__ENV.BESH_LOAD_CONFIG)
const expected = config.expectedStatus

http.setResponseCallback(http.expectedStatuses(expected ?? { min: 200, max: 299 }))

export const options = {
  vus: config.vus,
  duration: config.durationSeconds + 's',
  gracefulStop: '2s',
  redirects: 0,
  discardResponseBodies: __ENV.BESH_LOAD_GRAPHQL !== 'true',
  summaryTrendStats: ['avg', 'max', 'p(95)'],
  systemTags: ['status', 'method', 'name', 'check', 'expected_response'],
  thresholds: {
    http_req_duration: ['p(95)<=' + config.p95Ms],
    http_req_failed: ['rate<=' + config.maxErrorRate],
    checks: ['rate>=' + (1 - config.maxErrorRate)],
  },
}

export default function () {
  const response = http.request(
    __ENV.BESH_LOAD_METHOD,
    __ENV.BESH_LOAD_URL,
    __ENV.BESH_LOAD_BODY || null,
    {
      headers: {
        Authorization: 'Bearer ' + __ENV.BESH_LOAD_TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: '2s',
      tags: { name: 'besh-api' },
    },
  )
  let passed = expected === null
    ? response.status >= 200 && response.status < 300
    : response.status === expected

  if (passed && __ENV.BESH_LOAD_GRAPHQL === 'true') {
    try {
      const result = response.json()
      passed = Boolean(result && Object.hasOwn(result, 'data') && !result.errors)
    } catch {
      passed = false
    }
  }

  check(response, { 'API response accepted': () => passed })
  sleep(0.2)
}

export function handleSummary(data) {
  const requests = data.metrics.http_reqs?.values || {}
  const durations = data.metrics.http_req_duration?.values || {}
  const failures = data.metrics.http_req_failed?.values || {}
  const checks = data.metrics.checks?.values || {}
  const thresholds = Object.values(data.metrics)
    .flatMap((metric) => Object.values(metric.thresholds || {}))

  return {
    stdout: JSON.stringify({
      requests: requests.count || 0,
      requestsPerSecond: requests.rate || 0,
      failedRequests: failures.passes || 0,
      checkRate: checks.rate || 0,
      avgMs: durations.avg || 0,
      p95Ms: durations['p(95)'] || 0,
      maxMs: durations.max || 0,
      thresholdsPassed: thresholds.length > 0 && thresholds.every((threshold) => threshold.ok),
    }),
  }
}
`

const finite = z.number().finite().nonnegative()
const summarySchema = z
  .object({
    requests: finite.int().min(1),
    requestsPerSecond: finite,
    failedRequests: finite.int(),
    checkRate: finite.max(1),
    avgMs: finite,
    p95Ms: finite,
    maxMs: finite,
    thresholdsPassed: z.boolean(),
  })
  .strict()

function environment(extra: Record<string, string> = {}) {
  const values: Record<string, string> = {}
  for (const name of [
    'PATH',
    'SystemRoot',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'TMPDIR',
  ]) {
    if (process.env[name]) values[name] = process.env[name]!
  }
  return { ...values, ...extra }
}

async function removeTemporary(path: string, parent: string) {
  if (!resolve(path).startsWith(resolve(parent) + sep))
    throw new Error('Invalid temporary directory')
  await rm(path, { recursive: true, force: true })
}

async function boundedOutput(
  stream: ReadableStream<Uint8Array>,
  limit: number,
) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > limit) throw new Error('k6 output limit exceeded')
      chunks.push(part.value)
    }
    return Buffer.concat(chunks)
  } finally {
    void reader.cancel().catch(() => {})
  }
}

async function extract(
  archive: string,
  destination: string,
  signal: AbortSignal,
) {
  const command =
    process.platform === 'win32'
      ? [
          'powershell.exe',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Expand-Archive -LiteralPath $env:BESH_K6_ARCHIVE -DestinationPath $env:BESH_K6_DESTINATION -ErrorAction Stop',
        ]
      : process.platform === 'darwin'
        ? ['/usr/bin/ditto', '-x', '-k', archive, destination]
        : ['tar', '-xzf', archive, '-C', destination]
  await mkdir(destination, { recursive: true })
  signal.throwIfAborted()
  const child = Bun.spawn(command, {
    env: environment({
      BESH_K6_ARCHIVE: archive,
      BESH_K6_DESTINATION: destination,
    }),
    stdout: 'ignore',
    stderr: 'ignore',
  })
  const stop = () => child.kill()
  signal.addEventListener('abort', stop, { once: true })
  const timer = setTimeout(stop, 30_000)
  try {
    signal.throwIfAborted()
    if ((await child.exited) !== 0) throw new Error('Could not unpack k6')
    signal.throwIfAborted()
  } catch (error) {
    stop()
    await child.exited
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', stop)
  }
}

async function provision(cacheDir: string, signal: AbortSignal) {
  const platform = `${process.platform}-${process.arch}`
  const archive = archives[platform]
  if (!archive)
    throw new Error(
      'Automatic k6 setup is unavailable on this platform. Set BESH_K6_PATH to an existing k6 binary.',
    )
  const directory = resolve(cacheDir, version, platform)
  const binaryName = process.platform === 'win32' ? 'k6.exe' : 'k6'
  const binary = join(directory, binaryName)
  if (await Bun.file(binary).exists()) return binary

  await mkdir(directory, { recursive: true })
  const temporary = await mkdtemp(join(directory, 'download-'))
  try {
    const response = await fetch(
      `https://github.com/grafana/k6/releases/download/${version}/${archive.name}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]) },
    )
    if (!response.ok || !response.body)
      throw new Error(
        'Could not download k6. Check internet access or set BESH_K6_PATH.',
      )
    const bytes = await boundedOutput(response.body, 64 * 1024 * 1024)
    if (createHash('sha256').update(bytes).digest('hex') !== archive.sha256)
      throw new Error('k6 download failed its checksum check. Try again.')
    const path = join(temporary, archive.name)
    await Bun.write(path, bytes)
    const extracted = join(temporary, 'extracted')
    await extract(path, extracted, signal)
    const folder = archive.name.replace(/\.(zip|tar\.gz)$/, '')
    const source = join(extracted, folder, binaryName)
    const details = await stat(source)
    if (!details.isFile() || details.size > 128 * 1024 * 1024)
      throw new Error('Invalid k6 binary')
    const staged = join(temporary, binaryName)
    await copyFile(source, staged)
    await chmod(staged, 0o700)
    signal.throwIfAborted()
    await rename(staged, binary)
    return binary
  } finally {
    await removeTemporary(temporary, directory)
  }
}

export function createK6Runner(
  options: {
    binaryPath?: string
    cacheDir?: string
  } = {},
): K6Runner {
  return async (input, signal) => {
    signal.throwIfAborted()
    const binary = options.binaryPath
      ? resolve(options.binaryPath)
      : await provision(options.cacheDir ?? '.cache/k6', signal)
    if (!(await Bun.file(binary).exists()))
      throw new Error('k6 binary was not found. Check BESH_K6_PATH.')
    const temporary = await mkdtemp(join(tmpdir(), 'besh-k6-'))
    try {
      const path = join(temporary, 'test.js')
      const config = join(temporary, 'config.json')
      await Bun.write(path, script)
      await Bun.write(config, '{}')
      const child = Bun.spawn(
        [
          binary,
          'run',
          '--quiet',
          '--no-color',
          '--log-output=none',
          '--address=127.0.0.1:0',
          '--config',
          config,
          path,
        ],
        {
          cwd: temporary,
          env: environment({
            BESH_LOAD_CONFIG: JSON.stringify(input.config),
            BESH_LOAD_METHOD: input.method,
            BESH_LOAD_URL: input.url,
            BESH_LOAD_TOKEN: input.token,
            BESH_LOAD_BODY:
              input.body === null ? '' : JSON.stringify(input.body),
            BESH_LOAD_GRAPHQL: String(input.graphql),
            K6_NO_USAGE_REPORT: 'true',
            K6_AUTO_EXTENSION_RESOLUTION: 'false',
          }),
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )
      const stop = () => child.kill()
      signal.addEventListener('abort', stop, { once: true })
      const timer = setTimeout(stop, (input.config.durationSeconds + 10) * 1000)
      try {
        signal.throwIfAborted()
        const [output, , code] = await Promise.all([
          boundedOutput(child.stdout, 64 * 1024),
          boundedOutput(child.stderr, 64 * 1024),
          child.exited,
        ])
        signal.throwIfAborted()
        if (code !== 0 && code !== 99)
          throw new Error(
            'k6 could not finish. Check the local server and k6 installation.',
          )
        let summary
        try {
          summary = summarySchema.parse(JSON.parse(output.toString('utf8')))
        } catch {
          throw new Error(
            'k6 did not return a valid report. Use the managed k6 version or a compatible binary.',
          )
        }
        if (code === 99) summary.thresholdsPassed = false
        return summary
      } catch (error) {
        stop()
        await child.exited
        throw error
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', stop)
      }
    } finally {
      await removeTemporary(temporary, tmpdir())
    }
  }
}
