import { expect } from 'bun:test'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

export async function request(url: URL, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new Error('Compiled public HTTP request failed or timed out')
  }
}

export async function json(
  response: Response,
): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Public HTTP response had no body')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 256 * 1024) throw new Error('Public JSON exceeded its bound')
      chunks.push(chunk.value)
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new Error('Public JSON was not an object')
    return result as Record<string, unknown>
  } catch {
    throw new Error('Public HTTP response did not contain bounded valid JSON')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function provision(data: string) {
  const setupKey = crypto.randomUUID() + crypto.randomUUID()
  const server = createApp({
    setupKey,
    databasePath: join(data, 'besh.sqlite'),
    backupDir: join(data, 'backups'),
    secretKeyPath: join(data, 'besh-secrets.key'),
    runtimeCodeDir: join(data, 'runtime-code'),
    k6CacheDir: join(data, 'cache', 'k6'),
  })
  try {
    server.app.listen({ hostname: '127.0.0.1', port: 0 })
    const address = server.app.server?.url
    if (!address) throw new Error('Public fixture did not acquire an address')
    const response = await request(new URL('/setup', address), {
      method: 'POST',
      headers: { origin: address.origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Portable protocol workspace',
        key: setupKey,
      }),
    })
    expect(response.status).toBe(200)
    const receipt = await json(response)
    if (typeof receipt.token !== 'string' || receipt.token.length < 32)
      throw new Error('Public setup did not issue an owner credential')
    return receipt.token as string
  } finally {
    server.beginShutdown()
    try {
      if (server.app.server) await server.app.stop()
    } finally {
      await server.close()
    }
  }
}

function captured(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  const child = spawn(executable, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let errorOutput = ''
  let bytes = 0
  let overflow = false
  let closed = false
  let readyDone: ((origin: string) => void) | undefined
  let readyFail: (() => void) | undefined
  const record = (chunk: Buffer, stderr: boolean) => {
    if (overflow) return
    bytes += chunk.byteLength
    if (bytes > 64 * 1024) {
      output = ''
      errorOutput = ''
      overflow = true
      readyFail?.()
      return
    }
    if (stderr) errorOutput += chunk.toString('utf8')
    else output += chunk.toString('utf8')
    if (!stderr && output.includes('\n')) {
      const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(
        output.trim(),
      )
      if (match) readyDone?.(new URL(match[1]).origin)
      else readyFail?.()
    }
  }
  child.stdout.on('data', (chunk: Buffer) => record(chunk, false))
  child.stderr.on('data', (chunk: Buffer) => record(chunk, true))
  const exited = new Promise<number | null>((done) => {
    child.once('error', () => {
      readyFail?.()
      done(null)
    })
    child.once('close', (code) => {
      closed = true
      readyFail?.()
      done(code)
    })
  })
  return {
    child,
    exited,
    ready() {
      return new Promise<string>((done, fail) => {
        let settled = false
        const reject = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          fail(
            new Error('Compiled artifact did not report one public ready line'),
          )
        }
        const timer = setTimeout(reject, 12_000)
        readyFail = reject
        readyDone = (origin) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          done(origin)
        }
        if (closed || overflow) reject()
        else if (output.includes('\n')) record(Buffer.alloc(0), false)
      })
    },
    safe(secrets: string[], readyLine: boolean) {
      expect(!overflow).toBe(true)
      expect(errorOutput.length === 0).toBe(true)
      expect(
        [output, errorOutput].every(
          (text) =>
            !text.includes('setup=') &&
            secrets.every((secret) => !text.includes(secret)),
        ),
      ).toBe(true)
      if (readyLine)
        expect(
          /^Besh API ready at http:\/\/127\.0\.0\.1:\d+\/?$/u.test(
            output.trim(),
          ),
        ).toBe(true)
    },
    output() {
      return output
    },
  }
}

async function boundedExit(
  child: ChildProcess,
  exited: Promise<number | null>,
  ownCommand: boolean,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      exited,
      new Promise<never>((_, fail) => {
        timer = setTimeout(() => {
          // This handle was spawned by this test. Never read or kill a PID from
          // the portable workspace's private instance files.
          if (ownCommand) child.kill('SIGKILL')
          fail(
            new Error('Owned portable process did not exit within its bound'),
          )
        }, 12_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function ceased(origin: string) {
  const deadline = Date.now() + 6_000
  while (Date.now() < deadline) {
    const signal = AbortSignal.timeout(1_000)
    try {
      const response = await fetch(new URL('/health', origin), {
        redirect: 'manual',
        signal,
      })
      await response.body?.cancel()
    } catch {
      if (!signal.aborted) return
    }
    await Bun.sleep(100)
  }
  throw new Error('Stopped compiled workspace still accepted public HTTP')
}

export type PortablePublicWorkspace = {
  owner: string
  origin: () => string
  remember: (secret: string) => void
  api: (
    path: string,
    method?: string,
    body?: unknown,
    token?: string,
  ) => Promise<Response>
  restart: () => Promise<void>
}

export async function withPortablePublication(
  journey: (workspace: PortablePublicWorkspace) => Promise<void>,
) {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'Portable protocol journeys require Windows and Bun >= 1.4.2',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply portable artifact and Windows system root')
  const prefix = join(resolve(tmpdir()), 'besh-portable-publication-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'unrelated working folder ภาษาไทย')
  const data = join(directory, 'persisted protocol workspace ภาษาไทย')
  const executable = join(installation, 'besh.exe')
  const secrets: string[] = []
  let running: ReturnType<typeof captured> | undefined
  let origin: string | undefined
  let mayHaveStarted = false
  let confirmedStopped = false
  const env: NodeJS.ProcessEnv = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: join(systemRoot, 'System32'),
    TEMP: directory,
    TMP: directory,
  }
  const stop = async () => {
    if (!running || !origin)
      throw new Error('Compiled public address is unknown; retain workspace')
    const command = captured(executable, ['stop', '--data-dir', data], cwd, env)
    expect(await boundedExit(command.child, command.exited, true)).toBe(0)
    command.safe(secrets, false)
    let result: unknown
    try {
      result = JSON.parse(command.output().trim())
    } catch {
      throw new Error('Portable stop did not return bounded public JSON')
    }
    expect(
      JSON.stringify(result) === JSON.stringify({ state: 'stopped' }),
    ).toBe(true)
    await ceased(origin)
    expect(await boundedExit(running.child, running.exited, false)).toBe(0)
    running.safe(secrets, true)
    confirmedStopped = true
    running = undefined
  }
  const launch = async () => {
    confirmedStopped = false
    origin = undefined
    mayHaveStarted = true
    running = captured(
      executable,
      ['run', '--no-open', '--port', '0', '--data-dir', data],
      cwd,
      env,
    )
    origin = await running.ready()
    running.safe(secrets, true)
  }
  try {
    await Promise.all([mkdir(installation), mkdir(cwd), mkdir(data)])
    const owner = await provision(data)
    secrets.push(owner)
    await copyFile(resolve(artifact), executable)
    await chmod(executable, 0o700)
    await writeFile(join(cwd, '.env'), 'BESH_WEB_URL=not-an-origin\n')
    await writeFile(join(cwd, 'bunfig.toml'), 'invalid = [\n')
    await launch()
    await journey({
      owner,
      origin: () => {
        if (!origin) throw new Error('Compiled public address is unavailable')
        return origin
      },
      remember(secret) {
        if (!secret) throw new Error('Public credential receipt was empty')
        secrets.push(secret)
      },
      api(path, method = 'GET', body, token = owner) {
        if (!origin) throw new Error('Compiled public address is unavailable')
        return request(new URL(path, origin), {
          method,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(body === undefined
              ? {}
              : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      },
      async restart() {
        await stop()
        await launch()
      },
    })
  } finally {
    try {
      if (running && origin) await stop()
      if (mayHaveStarted && confirmedStopped && origin) await ceased(origin)
      if (mayHaveStarted && !confirmedStopped)
        throw new Error(
          'Portable stop cannot be proven; temporary workspace retained',
        )
      const target = resolve(directory)
      if (
        !target.startsWith(prefix) ||
        !target.startsWith(resolve(tmpdir()) + sep)
      )
        throw new Error('Publication cleanup escaped its temporary root')
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 100,
      })
    } finally {
      secrets.length = 0
    }
  }
}
