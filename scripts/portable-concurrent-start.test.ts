import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

async function command(
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
  return await new Promise<{
    code: number | null
    output: string
    errorOutput: string
  }>((done, fail) => {
    let output = ''
    let errorOutput = ''
    let bytes = 0
    let settled = false
    const reject = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      output = ''
      errorOutput = ''
      // Unknown ownership means retained storage, never a forced daemon kill.
      child.unref()
      child.stdout.destroy()
      child.stderr.destroy()
      fail(new Error('Concurrent portable command did not complete safely'))
    }
    const timer = setTimeout(reject, 15_000)
    const record = (chunk: Buffer, stderr: boolean) => {
      if (settled) return
      bytes += chunk.byteLength
      if (bytes > 64 * 1024) {
        reject()
        return
      }
      if (stderr) errorOutput += chunk.toString('utf8')
      else output += chunk.toString('utf8')
    }
    child.stdout.on('data', (chunk: Buffer) => record(chunk, false))
    child.stderr.on('data', (chunk: Buffer) => record(chunk, true))
    child.once('error', reject)
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done({ code, output, errorOutput })
    })
  })
}

function ready(result: Awaited<ReturnType<typeof command>>) {
  const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(
    result.output.trim(),
  )
  if (!match || result.code !== 0 || result.errorOutput !== '')
    throw new Error('Concurrent launcher did not report one public ready line')
  const origin = new URL(match[1])
  if (!origin.port || Number(origin.port) < 1)
    throw new Error('Concurrent launcher did not report a bound public port')
  return origin.origin
}

function publicState(
  output: string,
  expected: 'running' | 'stopped',
  origin?: string,
) {
  try {
    const value: unknown = JSON.parse(output.trim())
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false
    const state = value as Record<string, unknown>
    const keys = Object.keys(state)
    return expected === 'running'
      ? keys.length === 2 && state.state === 'running' && state.url === origin
      : keys.length === 1 && state.state === 'stopped'
  } catch {
    return false
  }
}

async function publicJSON(origin: string, path: string) {
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000),
    })
    if (response.status !== 200) throw new Error('Unexpected public status')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Missing public body')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 16 * 1024) throw new Error('Public body exceeded its bound')
        chunks.push(chunk.value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } catch {
    throw new Error(
      'Concurrent portable public request did not complete safely',
    )
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
  throw new Error('Concurrent portable workspace still accepted public HTTP')
}

test('two concurrent portable starts own one workspace and one public listener', async () => {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'Concurrent artifact journey requires Windows and Bun >= 1.4.2',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply portable artifact and Windows system root')

  const prefix = join(resolve(tmpdir()), 'besh-portable-concurrent-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'other working folder ภาษาไทย')
  const data = join(directory, 'shared workspace ภาษาไทย')
  const executable = join(installation, 'besh.exe')
  const env: NodeJS.ProcessEnv = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: join(systemRoot, 'System32'),
    TEMP: directory,
    TMP: directory,
  }
  const origins = new Set<string>()
  let mayHaveStarted = false
  let allStartsKnown = false
  let confirmedStopped = false
  const stop = async () => {
    if (!allStartsKnown || origins.size !== 1)
      throw new Error(
        'Concurrent ownership uncertain; retain temporary workspace',
      )
    const result = await command(
      executable,
      ['stop', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      result.code === 0 &&
        result.errorOutput === '' &&
        publicState(result.output, 'stopped'),
    ).toBe(true)
    for (const origin of origins) await ceased(origin)
    confirmedStopped = true
  }

  try {
    await Promise.all([mkdir(installation), mkdir(cwd)])
    await copyFile(resolve(artifact), executable)
    const flags = ['start', '--no-open', '--port', '0', '--data-dir', data]
    mayHaveStarted = true
    const starts = await Promise.allSettled([
      command(executable, flags, cwd, env).then((result) => {
        const origin = ready(result)
        origins.add(origin)
        return origin
      }),
      command(executable, flags, cwd, env).then((result) => {
        const origin = ready(result)
        origins.add(origin)
        return origin
      }),
    ])
    allStartsKnown = starts.every((result) => result.status === 'fulfilled')
    expect(allStartsKnown && origins.size === 1).toBe(true)
    if (!allStartsKnown || origins.size !== 1)
      throw new Error(
        'Concurrent launchers did not identify one owned workspace',
      )
    const origin = [...origins][0]!
    const status = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      status.code === 0 &&
        status.errorOutput === '' &&
        publicState(status.output, 'running', origin),
    ).toBe(true)
    const health = await publicJSON(origin, '/health')
    expect(
      Boolean(
        health &&
        typeof health === 'object' &&
        'status' in health &&
        health.status === 'ok',
      ),
    ).toBe(true)
    const setup = await publicJSON(origin, '/setup/status')
    expect(
      Boolean(
        setup &&
        typeof setup === 'object' &&
        'required' in setup &&
        setup.required === true,
      ),
    ).toBe(true)
    await stop()
    const idle = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      idle.code === 0 &&
        idle.errorOutput === '' &&
        publicState(idle.output, 'stopped'),
    ).toBe(true)
  } finally {
    if (
      mayHaveStarted &&
      !confirmedStopped &&
      allStartsKnown &&
      origins.size === 1
    )
      await stop().catch(() => {})
    if (mayHaveStarted && confirmedStopped) {
      try {
        for (const origin of origins) await ceased(origin)
      } catch {
        confirmedStopped = false
      }
    }
    if (!mayHaveStarted || confirmedStopped) {
      const target = resolve(directory)
      if (
        !target.startsWith(prefix) ||
        !target.startsWith(resolve(tmpdir()) + sep)
      )
        throw new Error('Concurrent cleanup escaped its temporary root')
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 100,
      })
    }
  }
}, 75_000)
