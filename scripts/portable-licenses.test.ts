import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'

type Notice = { path: string; bytes: number; sha256: string }
type Inventory = { files: Notice[] }
const existingTarget = 'License export directory already exists'

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')

function relativeNotice(value: string) {
  if (
    typeof value !== 'string' ||
    isAbsolute(value) ||
    /[\\<>:"|?*\u0000-\u001f]/u.test(value) ||
    value
      .split('/')
      .some(
        (part) => !part || part === '.' || part === '..' || /[. ]$/u.test(part),
      )
  )
    throw new Error('Source notice inventory has an unsafe relative path')
  return value
}

async function bytes(path: string, limit: number) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit)
    throw new Error('Notice fixture is not a bounded regular file')
  const result = await readFile(path)
  if (result.length > limit)
    throw new Error('Notice fixture exceeded its bound')
  return result
}

async function sourceInventory() {
  const root = resolve(import.meta.dir, '../assets/portable-notices')
  const index = await bytes(join(root, 'index.json'), 512 * 1024)
  const value: unknown = JSON.parse(index.toString('utf8'))
  if (
    !value ||
    typeof value !== 'object' ||
    !('files' in value) ||
    !Array.isArray(value.files)
  )
    throw new Error('Source notice inventory is invalid')
  const inventory = value as Inventory
  if (!inventory.files.length || inventory.files.length > 1024)
    throw new Error('Source notice count exceeds its bound')
  const expected = new Map<string, Buffer>([['index.json', index]])
  const seen = new Set(['index.json'])
  let total = index.length
  for (const notice of inventory.files) {
    const path = relativeNotice(notice.path)
    const key = path.toLowerCase()
    if (
      seen.has(key) ||
      !Number.isSafeInteger(notice.bytes) ||
      notice.bytes < 0 ||
      notice.bytes > 2 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/u.test(notice.sha256)
    )
      throw new Error('Source notice descriptor is invalid')
    seen.add(key)
    const original = await bytes(join(root, path), 2 * 1024 * 1024)
    if (original.length !== notice.bytes || sha256(original) !== notice.sha256)
      throw new Error('Source notice descriptor does not match its full bytes')
    total += original.length
    if (total > 16 * 1024 * 1024)
      throw new Error('Source notice total exceeds its bound')
    expected.set(path, original)
  }
  return expected
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
    let size = 0
    let settled = false
    const reject = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      output = ''
      errorOutput = ''
      child.unref()
      child.stdout.destroy()
      child.stderr.destroy()
      fail(new Error('Owned licenses command exit could not be confirmed'))
    }
    const timer = setTimeout(reject, 12_000)
    const record = (chunk: Buffer, stderr: boolean) => {
      if (settled) return
      size += chunk.byteLength
      if (size > 64 * 1024) {
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

type TreeEntry = {
  path: string
  kind: 'directory' | 'file'
  bytes?: number
  sha256?: string
}

async function tree(root: string) {
  const entries: TreeEntry[] = []
  let total = 0
  const walk = async (relative: string) => {
    const directory = join(root, relative)
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Export has an unsafe directory')
    for (const name of (await readdir(directory)).sort()) {
      const path = relative ? `${relative}/${name}` : name
      const target = join(root, relativeNotice(path))
      const entry = await lstat(target)
      if (entry.isSymbolicLink()) throw new Error('Export has a linked entry')
      if (entry.isDirectory()) {
        entries.push({ path, kind: 'directory' })
        if (entries.length > 4096)
          throw new Error('Export tree exceeds its bound')
        await walk(path)
      } else if (entry.isFile()) {
        const content = await bytes(target, 2 * 1024 * 1024)
        total += content.length
        if (total > 17 * 1024 * 1024)
          throw new Error('Export bytes exceed their bound')
        entries.push({
          path,
          kind: 'file',
          bytes: content.length,
          sha256: sha256(content),
        })
        if (entries.length > 4096)
          throw new Error('Export tree exceeds its bound')
      } else throw new Error('Export has an unsupported entry')
    }
  }
  await walk('')
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

async function absent(path: string) {
  try {
    await lstat(path)
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw new Error('Unexpected fixture path could not be inspected safely')
  }
}

test('standalone licenses exports exact indexed notice bytes and preserves an existing target', async () => {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'Licenses artifact journey requires Windows and Bun >= 1.4.2',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply portable artifact and Windows system root')
  const expected = await sourceInventory()
  const prefix = join(resolve(tmpdir()), 'besh-portable-licenses-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'other working folder ภาษาไทย')
  const parent = join(directory, 'license exports ภาษาไทย')
  const output = join(parent, 'full notices ภาษาไทย')
  const poison = join(directory, 'unexpected application storage')
  const noAppPaths = [
    join(installation, 'besh-data'),
    join(cwd, 'besh-data'),
    join(cwd, 'data'),
    poison,
  ]
  const executable = join(installation, 'besh.exe')
  let allCommandsExited = true
  try {
    await Promise.all([mkdir(installation), mkdir(cwd), mkdir(parent)])
    await copyFile(resolve(artifact), executable)
    await writeFile(join(cwd, '.env'), 'BESH_WEB_URL=not-an-origin\n')
    await writeFile(join(cwd, 'bunfig.toml'), 'invalid = [\n')
    const env: NodeJS.ProcessEnv = {
      SystemRoot: systemRoot,
      WINDIR: systemRoot,
      PATH: join(systemRoot, 'System32'),
      TEMP: directory,
      TMP: directory,
      BESH_WEB_URL: 'not-an-origin',
      BESH_DATABASE_PATH: join(poison, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(poison, 'backups'),
      BESH_SECRET_KEY_PATH: join(poison, 'besh-secrets.key'),
      BESH_RUNTIME_CODE_DIR: join(poison, 'runtime-code'),
      BESH_K6_CACHE_DIR: join(poison, 'k6'),
      PORT: 'not-a-port',
    }
    const flags = ['licenses', '--output', output]
    allCommandsExited = false
    const exported = await command(executable, flags, cwd, env)
    allCommandsExited = true
    expect(
      exported.code === 0 &&
        exported.errorOutput === '' &&
        exported.output.trim() === `Exported ${expected.size} license files.`,
    ).toBe(true)
    const files = (await tree(output)).filter((entry) => entry.kind === 'file')
    expect(
      JSON.stringify(files.map((entry) => entry.path).sort()) ===
        JSON.stringify([...expected.keys()].sort()),
    ).toBe(true)
    for (const [path, original] of expected) {
      const actual = await bytes(join(output, path), 2 * 1024 * 1024)
      expect(
        actual.equals(original) &&
          actual.length === original.length &&
          sha256(actual) === sha256(original),
      ).toBe(true)
    }
    expect((await Promise.all(noAppPaths.map(absent))).every(Boolean)).toBe(
      true,
    )
    await writeFile(
      join(output, 'user-marker.txt'),
      'User-owned marker. Keep exactly.\n',
    )
    const before = await tree(output)
    allCommandsExited = false
    const rejected = await command(executable, flags, cwd, env)
    allCommandsExited = true
    expect(
      rejected.code !== null &&
        rejected.code !== 0 &&
        rejected.output === '' &&
        rejected.errorOutput.trim() === existingTarget,
    ).toBe(true)
    expect(JSON.stringify(await tree(output)) === JSON.stringify(before)).toBe(
      true,
    )
    expect((await Promise.all(noAppPaths.map(absent))).every(Boolean)).toBe(
      true,
    )
  } finally {
    // Unknown command exit or any application-storage side effect retains the
    // temporary directory. Never erase possibly live workspace state.
    const noWorkspace = (await Promise.all(noAppPaths.map(absent))).every(
      Boolean,
    )
    if (allCommandsExited && noWorkspace) {
      const target = resolve(directory)
      if (
        !target.startsWith(prefix) ||
        !target.startsWith(resolve(tmpdir()) + sep)
      )
        throw new Error('Licenses cleanup escaped its temporary root')
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 4,
        retryDelay: 100,
      })
    }
  }
}, 60_000)
