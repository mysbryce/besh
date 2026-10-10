import { spawnSync } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { executableIdentity, PortableError } from './cli'

type Ownership = {
  version: 1
  nonce: string
  proof: string
  pid: number
  dataDirectory: string
  executable: string
}

export type Instance = Ownership & {
  controlURL: string
  publicURL: string
}

function paths(dataDirectory: string) {
  const directory = join(dataDirectory, '.besh-instance')

  return {
    directory,
    lock: join(directory, 'lock.json'),
    ready: join(directory, 'ready.json'),
  }
}

function directoryPrivacy(
  directory: string,
  created: boolean,
  newLeaf?: string,
) {
  if (newLeaf && !/^(?:lock\.json|ready-[a-f0-9]{64}\.tmp)$/u.test(newLeaf))
    throw new PortableError('Besh private instance leaf name is invalid.')

  if (process.platform !== 'win32') {
    const info = lstatSync(directory)

    if (info.mode & 0o077 || info.uid !== process.getuid?.())
      throw new PortableError(
        'Besh private instance storage must be owned by the current user.',
      )

    return
  }

  const root = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!root || !isAbsolute(root))
    throw new PortableError(
      'Besh cannot verify private Windows instance storage.',
    )

  // Windows ignores POSIX creation modes. Apply/verify an owner-only DACL on
  // this private folder and its credential leaves through fixed OS code.
  const script = `
$ErrorActionPreference = 'Stop'
try {
  Import-Module -Name ([Environment]::GetEnvironmentVariable('BESH_PRIVATE_SECURITY_MANIFEST')) -Scope Local -ErrorAction Stop
  $path = [Environment]::GetEnvironmentVariable('BESH_PRIVATE_DIRECTORY')
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $leaf = [Environment]::GetEnvironmentVariable('BESH_PRIVATE_NEW_LEAF')
  $targets = @(@{ Path = $path; Directory = $true; Create = ([Environment]::GetEnvironmentVariable('BESH_PRIVATE_CREATE') -eq '1') })
  $leaves = @('lock.json', 'ready.json')
  if ($leaf -and $leaf -ne 'lock.json') { $leaves += $leaf }
  foreach ($name in $leaves) {
    $target = [IO.Path]::Combine($path, $name)
    if ([IO.Directory]::Exists($target)) { throw 'Private leaf is a directory' }
    if ([IO.File]::Exists($target)) {
      $targets += @{ Path = $target; Directory = $false; Create = ($leaf -eq $name) }
    }
  }
  foreach ($target in $targets) {
    $attributes = [IO.File]::GetAttributes($target.Path)
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Private storage is a reparse point' }
    $isDirectory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
    if ($isDirectory -ne $target.Directory) { throw 'Private storage kind mismatch' }
    if (!$target.Directory -and !$target.Create -and [IO.FileInfo]::new($target.Path).Length -eq 0) { continue }
    if ($target.Create) {
      if ($target.Directory) {
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
      } else {
        if ([IO.FileInfo]::new($target.Path).Length -ne 0) { throw 'New private leaf is not empty' }
        $acl = [Security.AccessControl.FileSecurity]::new()
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'Allow')
      }
      $acl.SetOwner($sid)
      $acl.SetAccessRuleProtection($true, $false)
      $acl.AddAccessRule($rule)
      Microsoft.PowerShell.Security\\Set-Acl -LiteralPath $target.Path -AclObject $acl
    }
    $acl = Microsoft.PowerShell.Security\\Get-Acl -LiteralPath $target.Path
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Private storage owner mismatch' }
    if ($target.Directory -and !$acl.AreAccessRulesProtected) { throw 'Private directory inheritance is unprotected' }
    $full = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -eq 'Allow') {
        if ($rule.IdentityReference.Value -ne $sid.Value) { throw 'Private storage grants another identity' }
        if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $full = $true }
      }
    }
    if (!$full) { throw 'Private storage access unavailable' }
  }
  exit 0
} catch { exit 1 }
`

  const result = spawnSync(
    join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 16 * 1024,
      env: {
        SystemRoot: root,
        WINDIR: root,
        PATH: join(root, 'System32'),
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        PSModulePath: join(
          root,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'Modules',
        ),
        BESH_PRIVATE_SECURITY_MANIFEST: join(
          root,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'Modules',
          'Microsoft.PowerShell.Security',
          'Microsoft.PowerShell.Security.psd1',
        ),
        BESH_PRIVATE_DIRECTORY: directory,
        BESH_PRIVATE_CREATE: created ? '1' : '0',
        BESH_PRIVATE_NEW_LEAF: newLeaf,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (result.error || result.status !== 0)
    throw new PortableError(
      'Besh could not secure private Windows instance storage.',
    )
}

export function dataRoot(directory: string, create: boolean) {
  try {
    if (!existsSync(directory)) {
      if (!create) return undefined

      mkdirSync(directory, { recursive: true })
    }

    if (!lstatSync(directory).isDirectory()) throw new Error()

    const root = realpathSync(directory)
    const privateDirectory = paths(root).directory

    if (!existsSync(privateDirectory)) {
      if (!create) return root

      const staging = join(
        root,
        `.besh-instance-${randomBytes(32).toString('hex')}.tmp`,
      )
      mkdirSync(staging, { mode: 0o700 })
      const initial = statSync(staging, { bigint: true })

      try {
        // Publish an already private empty directory. Concurrent callers never
        // encounter a credential folder while its Windows DACL is unfinished.
        directoryPrivacy(staging, true)

        try {
          renameSync(staging, privateDirectory)
        } catch (error) {
          if (!existsSync(privateDirectory)) throw error
        }
      } finally {
        if (existsSync(staging)) {
          const current = lstatSync(staging, { bigint: true })

          if (
            current.isDirectory() &&
            !current.isSymbolicLink() &&
            initial.dev > 0n &&
            initial.ino > 0n &&
            current.dev === initial.dev &&
            current.ino === initial.ino
          )
            rmdirSync(staging)
        }
      }
    }

    const info = lstatSync(privateDirectory)

    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      !sameFilesystemEntry(
        privateDirectory,
        realpathSync(privateDirectory),
        'directory',
      )
    )
      throw new Error()

    directoryPrivacy(privateDirectory, false)

    return root
  } catch (error) {
    if (error instanceof PortableError) throw error

    throw new PortableError(
      'Besh cannot use the selected data directory. Choose a writable --data-dir.',
    )
  }
}

function objectFile(path: string): Record<string, unknown> | undefined {
  let descriptor: number | undefined

  try {
    if (!existsSync(path)) return undefined

    const info = lstatSync(path)
    if (!info.isFile() || info.isSymbolicLink()) throw new Error()

    descriptor = openSync(path, 'r')
    const opened = fstatSync(descriptor)
    if (opened.size > 4096 || !opened.isFile()) throw new Error()

    if (
      process.platform !== 'win32' &&
      (opened.mode & 0o077 || opened.uid !== process.getuid?.())
    )
      throw new Error()

    const result: unknown = JSON.parse(readFileSync(descriptor, 'utf8'))
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new Error()

    return result as Record<string, unknown>
  } catch {
    throw new PortableError(
      'Besh instance metadata is invalid. Workspace ownership is uncertain.',
    )
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function sameFilesystemEntry(
  actual: unknown,
  expected: string,
  kind: 'file' | 'directory',
) {
  if (typeof actual !== 'string' || !isAbsolute(actual)) return false

  try {
    // Windows 8.3 paths and long names can identify the same entry. Compare
    // actual filesystem IDs; case folding or normalized text cannot prove it.
    const left = statSync(actual, { bigint: true })
    const right = statSync(expected, { bigint: true })
    const correctKind =
      kind === 'file'
        ? left.isFile() && right.isFile()
        : left.isDirectory() && right.isDirectory()

    return (
      correctKind &&
      left.dev > 0n &&
      left.ino > 0n &&
      right.dev > 0n &&
      right.ino > 0n &&
      left.dev === right.dev &&
      left.ino === right.ino
    )
  } catch {
    return false
  }
}

function ownership(
  record: Record<string, unknown>,
  dataDirectory: string,
): Ownership {
  if (
    record.version !== 1 ||
    typeof record.nonce !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(record.nonce) ||
    typeof record.proof !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(record.proof) ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    !sameFilesystemEntry(record.dataDirectory, dataDirectory, 'directory') ||
    !sameFilesystemEntry(record.executable, executableIdentity(), 'file')
  )
    throw new PortableError(
      'Besh instance identity does not match this workspace and executable.',
    )

  return record as Ownership
}

function localURL(value: unknown, control: boolean) {
  if (typeof value !== 'string') throw new Error()

  const url = new URL(value)

  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    Number(url.port) <= 0 ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== (control ? '/control' : '/') ||
    url.href !== value
  )
    throw new Error()

  return value
}

export function readInstance(
  dataDirectory: string,
): Instance | 'starting' | undefined {
  const files = paths(dataDirectory)

  try {
    const lock = lstatSync(files.lock)
    if (lock.isFile() && !lock.isSymbolicLink() && lock.size === 0) {
      if (existsSync(files.ready))
        throw new PortableError(
          'Besh readiness has no committed workspace lock.',
        )

      return 'starting'
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const lock = objectFile(files.lock)
  const ready = objectFile(files.ready)

  if (!lock) {
    if (ready)
      throw new PortableError('Besh readiness has no matching workspace lock.')

    return undefined
  }

  const owner = ownership(lock, dataDirectory)
  if (!ready) return 'starting'

  const instance = ownership(ready, dataDirectory)

  if (
    instance.nonce !== owner.nonce ||
    instance.proof !== owner.proof ||
    instance.pid !== owner.pid
  )
    throw new PortableError('Besh readiness and workspace lock disagree.')

  try {
    return {
      ...instance,
      controlURL: localURL(ready.controlURL, true),
      publicURL: localURL(ready.publicURL, false),
    }
  } catch {
    throw new PortableError('Besh private control address is invalid.')
  }
}

export function acquire(dataDirectory: string) {
  const files = paths(dataDirectory)
  const owner: Ownership = {
    version: 1,
    nonce: randomBytes(32).toString('hex'),
    proof: randomBytes(32).toString('hex'),
    pid: process.pid,
    dataDirectory,
    executable: executableIdentity(),
  }
  let descriptor: number | undefined

  try {
    if (existsSync(files.ready))
      throw new PortableError(
        'Besh readiness has no matching workspace lock. Ownership is uncertain.',
      )

    descriptor = openSync(files.lock, 'wx', 0o600)
    directoryPrivacy(files.directory, false, 'lock.json')
    writeFileSync(descriptor, JSON.stringify(owner))
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor)

    if (error instanceof PortableError) throw error

    throw new PortableError(
      'Besh workspace is already starting or owned. Verify status before retrying.',
    )
  }

  let released = false
  const matches = (path: string) => {
    const current = objectFile(path)

    return current?.nonce === owner.nonce && current?.proof === owner.proof
  }

  return {
    owner,
    authorize(header: string | null) {
      const value = header?.match(/^Bearer ([a-f0-9]{64})$/u)?.[1]

      return Boolean(
        value &&
        timingSafeEqual(
          Buffer.from(value, 'hex'),
          Buffer.from(owner.proof, 'hex'),
        ),
      )
    },

    publish(controlURL: string, publicURL: string) {
      if (!matches(files.lock))
        throw new PortableError(
          'Besh lost workspace ownership before readiness.',
        )

      const instance: Instance = { ...owner, controlURL, publicURL }
      const temporary = join(files.directory, `ready-${owner.nonce}.tmp`)

      try {
        const file = openSync(temporary, 'wx', 0o600)

        try {
          directoryPrivacy(files.directory, false, `ready-${owner.nonce}.tmp`)
          writeFileSync(file, JSON.stringify(instance))
        } finally {
          closeSync(file)
        }

        if (existsSync(files.ready)) throw new Error()

        renameSync(temporary, files.ready)
      } catch {
        try {
          unlinkSync(temporary)
        } catch {}

        throw new PortableError(
          'Besh could not publish owned instance readiness.',
        )
      }

      return instance
    },

    release() {
      if (released) return

      if (!matches(files.lock))
        throw new PortableError(
          'Besh workspace ownership changed during shutdown.',
        )

      if (existsSync(files.ready)) {
        if (!matches(files.ready))
          throw new PortableError('Besh readiness changed during shutdown.')

        unlinkSync(files.ready)
      }

      if (descriptor !== undefined) closeSync(descriptor)
      released = true

      if (!matches(files.lock))
        throw new PortableError('Besh workspace lock changed during shutdown.')

      unlinkSync(files.lock)
    },
  }
}

export async function control(
  instance: Instance,
  action: 'identity' | 'open' | 'stop',
) {
  try {
    const response = await fetch(instance.controlURL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${instance.proof}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action, nonce: instance.nonce }),
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000),
    })

    if (response.status !== (action === 'stop' ? 202 : 200)) throw new Error()

    const reader = response.body?.getReader()
    if (!reader) throw new Error()

    const chunks: Uint8Array[] = []
    let size = 0
    let result: Record<string, unknown>

    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break

        size += part.value.byteLength
        if (size > 4096) throw new Error()

        chunks.push(part.value)
      }

      result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }

    if (
      result.version !== 1 ||
      result.nonce !== instance.nonce ||
      result.dataDirectory !== instance.dataDirectory ||
      result.executable !== instance.executable ||
      result.publicURL !== instance.publicURL
    )
      throw new Error()

    if (action === 'open') {
      if (typeof result.openURL !== 'string') throw new Error()

      const url = new URL(result.openURL)

      if (
        url.origin !== new URL(instance.publicURL).origin ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.hash ||
        [...url.searchParams.keys()].some((key) => key !== 'setup') ||
        url.searchParams.getAll('setup').length > 1
      )
        throw new Error()
    }

    return result
  } catch {
    throw new PortableError(
      'Besh could not verify the owned instance. No process or workspace was changed.',
    )
  }
}

export async function waitStopped(instance: Instance) {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    const current = readInstance(instance.dataDirectory)

    if (current === 'starting') {
      const lock = objectFile(paths(instance.dataDirectory).lock)

      if (
        !lock ||
        ownership(lock, instance.dataDirectory).nonce !== instance.nonce
      )
        throw new PortableError(
          'Besh workspace ownership changed while stopping.',
        )
    } else if (current && current.nonce !== instance.nonce)
      throw new PortableError(
        'Besh workspace ownership changed while stopping.',
      )

    if (!current) {
      const signal = AbortSignal.timeout(1_000)

      try {
        const response = await fetch(new URL('/health', instance.publicURL), {
          redirect: 'manual',
          signal,
        })

        await response.body?.cancel()
      } catch {
        if (!signal.aborted) return
      }
    }

    await Bun.sleep(100)
  }

  throw new PortableError(
    'Besh could not confirm graceful shutdown. Workspace files were retained.',
  )
}
