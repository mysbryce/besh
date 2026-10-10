import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
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
import { join, resolve, sep } from 'node:path'
import { createApp } from '../src/app'

// Public setup provisions the fixture before the compiled process owns it.

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
      if (bytes > 64 * 1024) {
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
    // Never relay process output into failures or logs. A later browser-handoff
    // implementation may handle credentials privately; this parser ignores them.
    child.stderr.resume()
    child.stdin.on('error', () => {})
  })
}

async function request(url: URL, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    throw new Error('Portable public HTTP request failed or timed out')
  }
}

async function json(response: Response): Promise<Record<string, unknown>> {
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
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
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
      headers: {
        origin: address.origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Portable SQLite workspace',
        key: setupKey,
      }),
    })
    expect(response.status).toBe(200)
    const receipt = await json(response)
    const owner = receipt.token
    if (typeof owner !== 'string' || owner.length < 32)
      throw new Error('Public setup did not issue an owner credential')
    return owner
  } finally {
    server.beginShutdown()
    try {
      if (server.app.server) await server.app.stop()
    } finally {
      await server.close()
    }
  }
}

function sqliteBytes() {
  const database = new Database(':memory:')
  try {
    database.run(
      'CREATE TABLE people (Name TEXT NOT NULL, Age INTEGER NOT NULL, Active BOOLEAN NOT NULL, Note TEXT)',
    )
    const insert = database.query('INSERT INTO people VALUES (?, ?, ?, ?)')
    insert.run('Save draft', 12, 1, null)
    insert.run('Publish', 15, 0, 'Literal row value')
    return new Uint8Array(database.serialize())
  } finally {
    database.close()
  }
}

function upload(bytes: ReturnType<typeof sqliteBytes>) {
  const form = new FormData()
  form.append('name', 'Portable authored copy')
  form.append('file', new File([bytes], 'people.sqlite'))
  return form
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

test('standalone Windows artifact uploads and previews a real SQLite copy through its trusted child', async () => {
  if (process.platform !== 'win32')
    throw new Error('This compiled SQLite artifact journey requires Windows')
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  if (!artifact)
    throw new Error('Set BESH_TEST_PORTABLE_EXE to a built portable executable')
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!systemRoot)
    throw new Error('Windows SystemRoot is required for this test')

  const prefix = join(resolve(tmpdir()), 'besh-portable-sqlite-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'unrelated working folder ภาษาไทย')
  const data = join(directory, 'persisted fixture data ภาษาไทย')
  let child: ChildProcessWithoutNullStreams | undefined
  let exited: Promise<void> | undefined
  let owner = ''
  try {
    await Promise.all([mkdir(installation), mkdir(cwd), mkdir(data)])
    owner = await provision(data)
    const executable = join(installation, 'besh.exe')
    await copyFile(resolve(artifact), executable)
    await chmod(executable, 0o700)
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
          PATH: join(systemRoot, 'System32'),
          TEMP: directory,
          TMP: directory,
        },
      },
    )
    const ownedChild = child
    exited = new Promise<void>((done) => ownedChild.once('close', () => done()))
    const base = new URL(await readyOrigin(child))
    const bytes = sqliteBytes()
    const collection = new URL('/api/database-connections', base)
    const denied = await request(collection, {
      method: 'POST',
      body: upload(bytes),
    })
    expect(denied.status).toBe(401)
    await denied.body?.cancel()

    const headers = { authorization: `Bearer ${owner}`, origin: base.origin }
    const response = await request(collection, {
      method: 'POST',
      headers,
      body: upload(bytes),
    })
    expect(response.status).toBe(200)
    const connection = await json(response)
    const id = connection.id
    expect(typeof id === 'string' && /^[a-f0-9-]{36}$/u.test(id)).toBe(true)
    if (typeof id !== 'string')
      throw new Error('Upload did not issue a copy ID')
    expect(
      connection.name === 'Portable authored copy' &&
        connection.kind === 'sqlite' &&
        connection.mode === 'uploaded-copy' &&
        connection.version === 1,
    ).toBe(true)
    const expectedTables = [
      {
        name: 'people',
        columns: [
          { key: 'name', label: 'Name', type: 'string', nullable: false },
          { key: 'age', label: 'Age', type: 'number', nullable: false },
          { key: 'active', label: 'Active', type: 'boolean', nullable: false },
          { key: 'note', label: 'Note', type: 'string', nullable: true },
        ],
        rowCount: 2,
      },
    ]
    expect(
      JSON.stringify(connection.tables) === JSON.stringify(expectedTables),
    ).toBe(true)

    const detailURL = new URL(`/api/database-connections/${id}`, base)
    const detail = await request(detailURL, { headers })
    expect(detail.status).toBe(200)
    expect(
      JSON.stringify(await json(detail)) === JSON.stringify(connection),
    ).toBe(true)
    const previewURL = new URL(`/api/database-connections/${id}/preview`, base)
    const preview = await request(previewURL, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        table: 'people',
        columns: ['name', 'age', 'active', 'note'],
        filter: { column: 'active', value: true },
        limit: 10,
      }),
    })
    expect(preview.status).toBe(200)
    expect(
      JSON.stringify(await json(preview)) ===
        JSON.stringify({
          version: 1,
          table: 'people',
          columns: ['name', 'age', 'active', 'note'],
          rows: [{ name: 'Save draft', age: 12, active: true, note: null }],
        }),
    ).toBe(true)
    const deniedRead = await request(detailURL)
    expect(deniedRead.status).toBe(401)
    await deniedRead.body?.cancel()
  } finally {
    owner = ''
    // If termination fails, retain storage instead of deleting live state.
    if (child && exited) await stopChild(child, exited)
    const target = resolve(directory)
    if (
      !target.startsWith(prefix) ||
      !target.startsWith(resolve(tmpdir()) + sep)
    )
      throw new Error('Portable SQLite cleanup escaped its temporary root')
    await rm(target, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 100,
    })
  }
}, 60_000)
