import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
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

// Install as scripts/portable-lifecycle.test.ts with the adjacent owned browser
// fixture source. One public artifact journey; no server internals, control
// secrets, database contents, injected owner key or mocked committed state.

type BrowserEvent = {
  ok?: unknown
  origin?: unknown
  setupChallengePresent?: unknown
  setupChallenge?: unknown
  ownerToken?: unknown
}

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
    let failed = false
    let settled = false
    let deadline: ReturnType<typeof setTimeout> | undefined
    const failClosed = () => {
      if (settled) return
      settled = true
      output = ''
      errorOutput = ''
      clearTimeout(timer)
      clearTimeout(deadline)
      fail(new Error('Portable CLI command failed or timed out'))
    }
    const reject = () => {
      if (settled || failed) return
      failed = true
      output = ''
      errorOutput = ''
      clearTimeout(timer)
      child.kill('SIGKILL')
      deadline = setTimeout(failClosed, 3_000)
    }
    const timer = setTimeout(reject, 12_000)
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled || failed) return
      bytes += chunk.byteLength
      if (bytes > 64 * 1024) {
        reject()
        return
      }
      output += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (settled || failed) return
      bytes += chunk.byteLength
      if (bytes > 64 * 1024) {
        reject()
        return
      }
      errorOutput += chunk.toString('utf8')
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (settled) return
      if (failed) {
        failClosed()
        return
      }
      settled = true
      clearTimeout(timer)
      clearTimeout(deadline)
      done({ code, output, errorOutput })
    })
  })
}

function publicOrigin(output: string) {
  const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(
    output.trim(),
  )
  if (!match)
    throw new Error('Portable command did not report a public address')
  return new URL(match[1]).origin
}

function state(output: string): { state?: unknown; url?: unknown } {
  try {
    const result = JSON.parse(output.trim())
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new Error('Invalid public status')
    if (Object.keys(result).some((key) => key !== 'state' && key !== 'url'))
      throw new Error('Public status contained unexpected private fields')
    if (
      result.url &&
      new URL(result.url).href !== `${new URL(result.url).origin}/`
    )
      throw new Error('Public status URL contained more than an origin')
    return result
  } catch {
    throw new Error(
      'Portable command did not report bounded public status JSON',
    )
  }
}

function browserCallback() {
  const nonce = crypto.randomUUID() + crypto.randomUUID()
  const events: BrowserEvent[] = []
  const waiters: ((event: BrowserEvent) => void)[] = []
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 16 * 1024,
    async fetch(request) {
      if (
        request.method !== 'POST' ||
        new URL(request.url).pathname !== '/browser' ||
        request.headers.has('origin') ||
        request.headers.get('x-besh-browser-fixture') !== nonce
      )
        return new Response(null, { status: 403 })
      let event: BrowserEvent
      try {
        event = await request.json()
        if (!event || typeof event !== 'object')
          return new Response(null, { status: 400 })
      } catch {
        return new Response(null, { status: 400 })
      }
      const waiter = waiters.shift()
      if (waiter) waiter(event)
      else if (events.length < 4) events.push(event)
      else return new Response(null, { status: 429 })
      return new Response(null, { status: 204 })
    },
  })
  return {
    url: new URL('/browser', server.url).href,
    nonce,
    next() {
      const received = events.shift()
      if (received) return Promise.resolve(received)
      return new Promise<BrowserEvent>((done, fail) => {
        const receive = (event: BrowserEvent) => {
          clearTimeout(timer)
          done(event)
        }
        const timer = setTimeout(() => {
          const position = waiters.indexOf(receive)
          if (position !== -1) waiters.splice(position, 1)
          fail(
            new Error('Owned browser fixture did not report a public handoff'),
          )
        }, 12_000)
        waiters.push(receive)
      })
    },
    close() {
      events.length = 0
      return server.stop(true)
    },
  }
}

async function publicJSON(url: URL, owner?: string) {
  try {
    const response = await fetch(url, {
      headers: owner ? { authorization: `Bearer ${owner}` } : {},
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000),
    })
    expect(response.status).toBe(200)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Public response had no body')
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 256 * 1024)
          throw new Error('Public response bound exceeded')
        chunks.push(chunk.value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } catch {
    throw new Error('Compiled public HTTP request did not complete safely')
  }
}

async function stopped(origin: string) {
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
  throw new Error('Stopped portable workspace still accepted public HTTP')
}

test('standalone default launcher hands off real setup and reopens one owned background workspace until graceful stop', async () => {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'This lifecycle artifact journey requires Windows and Bun >= 1.4.2',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply BESH_TEST_PORTABLE_EXE and the Windows system root')
  const prefix = join(resolve(tmpdir()), 'besh-portable-lifecycle-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'unrelated working folder ภาษาไทย')
  const data = join(installation, 'besh-data')
  const callback = browserCallback()
  let owner = ''
  let setupChallenge = ''
  let mayHaveStarted = false
  let confirmedStopped = false
  let knownOrigin: string | undefined
  const safeOutput = (result: { output: string; errorOutput: string }) => {
    expect(
      [result.output, result.errorOutput].every(
        (output) =>
          (!setupChallenge || !output.includes(setupChallenge)) &&
          (!owner || !output.includes(owner)) &&
          !output.includes('setup='),
      ),
    ).toBe(true)
    expect(result.errorOutput.length === 0).toBe(true)
  }
  try {
    await Promise.all([mkdir(installation), mkdir(cwd)])
    const executable = join(installation, 'besh.exe')
    const browser = join(directory, 'owned browser fixture ภาษาไทย.exe')
    const compiledBrowser = join(directory, 'compiled-browser.exe')
    await copyFile(resolve(artifact), executable)
    await chmod(executable, 0o700)
    // The helper binary contains fixed code only. Per-run callback proof and
    // actual setup receipts remain in memory/environment, never fixture files.
    const fixtureBuild = await Bun.build({
      entrypoints: [join(import.meta.dir, 'portable-browser-fixture.ts')],
      target: 'bun',
      env: 'disable',
      compile: {
        target: 'bun-windows-x64',
        outfile: compiledBrowser,
        autoloadDotenv: false,
        autoloadBunfig: false,
        autoloadTsconfig: false,
        autoloadPackageJson: false,
      },
    })
    expect(fixtureBuild.success).toBe(true)
    await copyFile(compiledBrowser, browser)
    await chmod(browser, 0o700)
    await writeFile(join(cwd, '.env'), 'BESH_WEB_URL=not-an-origin\n')
    await writeFile(join(cwd, 'bunfig.toml'), 'invalid = [\n')
    const env: NodeJS.ProcessEnv = {
      SystemRoot: systemRoot,
      WINDIR: systemRoot,
      PATH: join(systemRoot, 'System32'),
      TEMP: directory,
      TMP: directory,
      BESH_TEST_BROWSER_CALLBACK: callback.url,
      BESH_TEST_BROWSER_NONCE: callback.nonce,
    }
    const flags = ['--port', '0', '--browser', browser]
    mayHaveStarted = true
    const launched = await command(executable, flags, cwd, env)
    expect(launched.code).toBe(0)
    const origin = publicOrigin(launched.output)
    knownOrigin = origin
    const first = await callback.next()
    expect(first.ok === true && first.origin === origin).toBe(true)
    expect(first.setupChallengePresent === true).toBe(true)
    if (typeof first.setupChallenge !== 'string' || !first.setupChallenge)
      throw new Error(
        'Browser handoff did not deliver the real setup challenge',
      )
    if (typeof first.ownerToken !== 'string' || first.ownerToken.length < 32)
      throw new Error('Real compiled setup did not deliver an owner receipt')
    owner = first.ownerToken
    setupChallenge = first.setupChallenge
    first.ownerToken = undefined
    first.setupChallenge = undefined
    safeOutput(launched)
    const setup = await publicJSON(new URL('/setup/status', origin))
    expect(setup.required === false).toBe(true)
    const members = await publicJSON(new URL('/api/members', origin), owner)
    expect(
      Array.isArray(members) &&
        members.some(
          (member) => member.id === 'owner' && member.role === 'owner',
        ),
    ).toBe(true)

    const running = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(running.code).toBe(0)
    safeOutput(running)
    const live = state(running.output)
    expect(live.state === 'running' && live.url === origin).toBe(true)

    const duplicate = await command(executable, ['start', ...flags], cwd, env)
    expect(duplicate.code).toBe(0)
    safeOutput(duplicate)
    expect(publicOrigin(duplicate.output) === origin).toBe(true)
    const second = await callback.next()
    expect(
      second.ok === true &&
        second.origin === origin &&
        second.setupChallengePresent === false &&
        second.setupChallenge === undefined &&
        second.ownerToken === undefined,
    ).toBe(true)
    const opened = await command(
      executable,
      ['open', '--data-dir', data, '--browser', browser],
      cwd,
      env,
    )
    expect(opened.code).toBe(0)
    safeOutput(opened)
    expect(publicOrigin(opened.output) === origin).toBe(true)
    const third = await callback.next()
    expect(
      third.ok === true &&
        third.origin === origin &&
        third.setupChallengePresent === false &&
        third.setupChallenge === undefined &&
        third.ownerToken === undefined,
    ).toBe(true)

    const ended = await command(
      executable,
      ['stop', '--data-dir', data],
      cwd,
      env,
    )
    expect(ended.code).toBe(0)
    safeOutput(ended)
    expect(state(ended.output).state === 'stopped').toBe(true)
    await stopped(origin)
    const idle = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(idle.code).toBe(0)
    safeOutput(idle)
    expect(state(idle.output).state === 'stopped').toBe(true)
    confirmedStopped = true
  } finally {
    try {
      if (mayHaveStarted && !confirmedStopped) {
        const executable = join(installation, 'besh.exe')
        const cleanup = await command(
          executable,
          ['stop', '--data-dir', data],
          cwd,
          {
            SystemRoot: systemRoot,
            WINDIR: systemRoot,
            PATH: join(systemRoot, 'System32'),
            TEMP: directory,
            TMP: directory,
          },
        ).catch(() => null)
        if (cleanup?.code === 0 && knownOrigin) {
          try {
            safeOutput(cleanup)
            if (state(cleanup.output).state === 'stopped') {
              await stopped(knownOrigin)
              confirmedStopped = true
            }
          } catch {
            confirmedStopped = false
          }
        }
      }
    } finally {
      if (mayHaveStarted && confirmedStopped) {
        try {
          if (!knownOrigin)
            throw new Error('Portable public address is unknown')
          await stopped(knownOrigin)
        } catch {
          confirmedStopped = false
        }
      }
      owner = ''
      setupChallenge = ''
      await callback.close()
      // If private ownership/stop cannot be confirmed, retain possible live
      // storage instead of killing a PID or recursively removing its files.
      if (!mayHaveStarted || confirmedStopped) {
        const target = resolve(directory)
        if (
          !target.startsWith(prefix) ||
          !target.startsWith(resolve(tmpdir()) + sep)
        )
          throw new Error('Lifecycle cleanup escaped its temporary root')
        await rm(target, {
          recursive: true,
          force: true,
          maxRetries: 4,
          retryDelay: 100,
        })
      }
    }
  }
}, 90_000)
