import { expect, test } from 'bun:test'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve, sep } from 'node:path'

const outputLimit = 64 * 1024

function readyOrigin(child: ChildProcessWithoutNullStreams) {
  return new Promise<string>((done, fail) => {
    let pending = ''
    let bytes = 0
    let settled = false

    const reject = (message: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending = ''
      fail(new Error(message))
    }
    const timer = setTimeout(
      () => reject('Portable executable did not become ready in time'),
      12_000,
    )

    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return
      bytes += chunk.byteLength
      if (bytes > outputLimit) {
        reject('Portable startup output exceeded its bound')
        return
      }
      pending += chunk.toString('utf8')
      let newline: number
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline).trim()
        pending = pending.slice(newline + 1)
        const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+\/)$/u.exec(
          line,
        )
        if (!match) continue
        const address = new URL(match[1])
        if (!address.port || Number(address.port) <= 0) {
          reject('Portable ready address did not contain a bound port')
          return
        }
        settled = true
        clearTimeout(timer)
        pending = ''
        done(address.origin)
        return
      }
    })
    child.once('error', () =>
      reject('Portable executable could not be started'),
    )
    child.once('exit', () =>
      reject('Portable executable exited before becoming ready'),
    )
    // Never relay stderr or credential-bearing startup/setup lines to a test
    // failure, assertion, log, snapshot, or persistent file.
    child.stderr.resume()
    child.stdin.on('error', () => {})
  })
}

async function publicResponse(url: URL) {
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(4_000),
    })
  } catch {
    throw new Error('Portable HTTP request failed or timed out')
  }
}

async function boundedBody(response: Response, limit: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Portable HTTP response had no body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) throw new Error('Portable HTTP body exceeded its bound')
      chunks.push(chunk.value)
    }
    return Buffer.concat(chunks)
  } catch {
    throw new Error('Portable HTTP body could not be read within its bound')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function staticURL(reference: string, base: URL) {
  let asset: URL
  try {
    asset = new URL(reference, base)
  } catch {
    throw new Error('Production HTML referenced an invalid asset URL')
  }
  if (
    asset.origin !== base.origin ||
    !asset.pathname.startsWith('/assets/') ||
    asset.username ||
    asset.password ||
    asset.search ||
    asset.hash
  )
    throw new Error('Production asset must use the same-origin assets route')
  return asset
}

function htmlAssets(html: string, base: URL) {
  const assets = new Map<string, 'script' | 'style'>()
  let moduleScripts = 0
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/giu) ?? []) {
    if (/^<script\b/iu.test(tag)) {
      const source = /\bsrc\s*=\s*["']([^"']+)["']/iu.exec(tag)?.[1]
      if (!source) continue
      if (/\btype\s*=\s*["']module["']/iu.test(tag)) moduleScripts++
      assets.set(staticURL(source, base).href, 'script')
    } else {
      const relation = /\brel\s*=\s*["']([^"']+)["']/iu.exec(tag)?.[1]
      if (relation !== 'stylesheet' && relation !== 'modulepreload') continue
      const source = /\bhref\s*=\s*["']([^"']+)["']/iu.exec(tag)?.[1]
      if (!source) throw new Error('Production HTML asset link had no href')
      assets.set(
        staticURL(source, base).href,
        relation === 'stylesheet' ? 'style' : 'script',
      )
    }
  }
  expect(moduleScripts > 0).toBe(true)
  expect([...assets.values()].includes('style')).toBe(true)
  return assets
}

async function stopChild(
  child: ChildProcessWithoutNullStreams,
  exited: Promise<void>,
) {
  if (child.exitCode !== null || child.signalCode !== null) {
    await exited
    return
  }
  child.kill('SIGTERM')
  const force = setTimeout(() => child.kill('SIGKILL'), 3_000)
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      exited,
      new Promise<never>((_, fail) => {
        deadline = setTimeout(
          () => fail(new Error('Portable executable did not stop for cleanup')),
          6_000,
        )
      }),
    ])
  } finally {
    clearTimeout(force)
    clearTimeout(deadline)
  }
}

test('standalone Windows artifact serves production setup and assets from an unrelated working directory', async () => {
  if (process.platform !== 'win32')
    throw new Error('This first portable artifact journey requires Windows')
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  if (!artifact)
    throw new Error('Set BESH_TEST_PORTABLE_EXE to a built portable executable')
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!systemRoot)
    throw new Error('Windows SystemRoot is required for this test')

  const prefix = join(resolve(tmpdir()), 'besh-portable-smoke-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'another working directory ภาษาไทย')
  const data = join(directory, 'explicit data folder ภาษาไทย')
  let child: ChildProcessWithoutNullStreams | undefined
  let exited: Promise<void> | undefined
  try {
    await Promise.all([mkdir(installation), mkdir(cwd), mkdir(data)])
    const executable = join(installation, 'besh.exe')
    // Copy exactly the artifact: no dist, source, Bun, Node or dependencies.
    await copyFile(resolve(artifact), executable)
    await chmod(executable, 0o700)
    // Loading either current-directory decoy is a startup error. The portable
    // build must disable dotenv/bunfig autoload, not depend on a clean cwd.
    await writeFile(join(cwd, '.env'), 'BESH_WEB_URL=not-an-origin\n')
    await writeFile(join(cwd, 'bunfig.toml'), 'invalid = [\n')

    child = spawn(
      executable,
      ['run', '--no-open', '--port', '0', '--data-dir', data],
      {
        cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          SystemRoot: systemRoot,
          WINDIR: systemRoot,
          PATH: [join(systemRoot, 'System32')].join(delimiter),
          TEMP: directory,
          TMP: directory,
        },
      },
    )
    const ownedChild = child
    exited = new Promise<void>((done) => ownedChild.once('close', () => done()))
    const origin = await readyOrigin(child)
    const base = new URL(origin)

    const htmlResponse = await publicResponse(new URL('/', base))
    expect(htmlResponse.status).toBe(200)
    expect(
      /text\/html/iu.test(htmlResponse.headers.get('content-type') ?? ''),
    ).toBe(true)
    const html = (await boundedBody(htmlResponse, 256 * 1024)).toString('utf8')
    // Boolean assertions cannot print an unexpected credential-bearing body.
    expect(/<!doctype html>/iu.test(html)).toBe(true)
    expect(html.includes('<title>Besh — Visual API Studio</title>')).toBe(true)
    expect(/\bid=["']root["']/u.test(html)).toBe(true)
    expect(
      !html.includes('/web/main.tsx') && !html.includes('/@vite/client'),
    ).toBe(true)

    const assets = htmlAssets(html, base)
    let fonts = 0
    for (const [address, kind] of assets) {
      const asset = new URL(address)
      const response = await publicResponse(asset)
      expect(response.status).toBe(200)
      const type = response.headers.get('content-type') ?? ''
      expect(
        kind === 'style' ? /text\/css/iu.test(type) : /javascript/iu.test(type),
      ).toBe(true)
      const bytes = await boundedBody(response, 8 * 1024 * 1024)
      expect(bytes.length > 0).toBe(true)
      if (kind !== 'style') continue
      const css = bytes.toString('utf8')
      for (const match of css.matchAll(
        /url\(\s*["']?([^\s"')]+)["']?\s*\)/giu,
      )) {
        if (match[1].startsWith('data:')) continue
        const font = staticURL(match[1], asset)
        if (!/\.woff2?$/iu.test(font.pathname)) continue
        const fontResponse = await publicResponse(font)
        expect(fontResponse.status).toBe(200)
        expect(
          (await boundedBody(fontResponse, 2 * 1024 * 1024)).length > 0,
        ).toBe(true)
        fonts++
      }
    }
    expect(fonts > 0).toBe(true)

    const setupResponse = await publicResponse(new URL('/setup/status', base))
    expect(setupResponse.status).toBe(200)
    const setupBytes = await boundedBody(setupResponse, 16 * 1024)
    let setupRequired = false
    try {
      setupRequired = JSON.parse(setupBytes.toString('utf8')).required === true
    } catch {
      throw new Error('Portable setup status was not valid JSON')
    }
    expect(setupRequired).toBe(true)
  } finally {
    // If termination fails, retain storage instead of deleting live state.
    if (child && exited) await stopChild(child, exited)
    const target = resolve(directory)
    if (
      !target.startsWith(prefix) ||
      !target.startsWith(resolve(tmpdir()) + sep)
    )
      throw new Error('Portable test cleanup path escaped its temporary root')
    await rm(target, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 100,
    })
  }
}, 45_000)
