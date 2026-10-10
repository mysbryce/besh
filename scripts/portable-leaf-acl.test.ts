import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const denial = 'Besh could not secure private Windows instance storage.'

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
  let size = 0
  let overflow = false
  let closed = false
  let readyDone: ((origin: string) => void) | undefined
  let readyFail: (() => void) | undefined
  const record = (chunk: Buffer, stderr: boolean) => {
    if (overflow) return
    size += chunk.byteLength
    if (size > 64 * 1024) {
      overflow = true
      output = ''
      errorOutput = ''
      readyFail?.()
      return
    }
    if (stderr) errorOutput += chunk.toString('utf8')
    else output += chunk.toString('utf8')
    if (!stderr && output.includes('\n')) {
      const match = /^Besh API ready at (http:\/\/127\.0\.0\.1:\d+)\/?$/u.exec(
        output.trim(),
      )
      if (match && new URL(match[1]).port) readyDone?.(new URL(match[1]).origin)
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
    async ready() {
      return await new Promise<string>((done, fail) => {
        let settled = false
        const reject = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          fail(new Error('Owned foreground artifact did not become ready'))
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
    result() {
      if (overflow) throw new Error('Owned process output exceeded its bound')
      return { output, errorOutput }
    },
    detach() {
      // Do not terminate an instance whose graceful stop could not be proven.
      child.unref()
      child.stdout.destroy()
      child.stderr.destroy()
      output = ''
      errorOutput = ''
    },
  }
}

async function boundedExit(process: ReturnType<typeof captured>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      process.exited,
      new Promise<never>((_, fail) => {
        timer = setTimeout(() => {
          process.detach()
          fail(new Error('Owned process exit could not be confirmed'))
        }, 12_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function command(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  const process = captured(executable, args, cwd, env)
  const code = await boundedExit(process)
  return { code, ...process.result() }
}

function state(
  output: string,
  expected: 'running' | 'stopped',
  origin?: string,
) {
  try {
    const value: unknown = JSON.parse(output.trim())
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false
    const record = value as Record<string, unknown>
    return expected === 'running'
      ? Object.keys(record).length === 2 &&
          record.state === 'running' &&
          record.url === origin
      : Object.keys(record).length === 1 && record.state === 'stopped'
  } catch {
    return false
  }
}

// Fixed PowerShell code. The checked temporary file path and add/remove mode
// travel through the environment, never shell interpolation. Get-Acl inspects
// permissions only; no file contents or private instance values are accessed.
const aclScript = `
$ErrorActionPreference = 'Stop'
try {
  $root = [IO.Path]::GetFullPath([Environment]::GetEnvironmentVariable('BESH_ACL_TEST_ROOT'))
  $path = [IO.Path]::GetFullPath([Environment]::GetEnvironmentVariable('BESH_ACL_TEST_FILE'))
  $expected = [IO.Path]::Combine($root, 'workspace', '.besh-instance', 'ready.json')
  if (![string]::Equals($path, $expected, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected fixture leaf' }
  $file = Get-Item -LiteralPath $path -Force
  if ($file.PSIsContainer -or (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'Unsafe fixture leaf' }
  $sid = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, [Security.AccessControl.FileSystemRights]::Read, [Security.AccessControl.AccessControlType]::Allow)
  $acl = Get-Acl -LiteralPath $path
  $explicit = @($acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq $sid.Value })
  $mode = [Environment]::GetEnvironmentVariable('BESH_ACL_TEST_MODE')
  if ($mode -eq 'inspect') {
    if ($explicit.Count -ne 0) { throw 'Fixture already has a Users rule' }
    exit 0
  }
  if ($mode -eq 'add') {
    if ($explicit.Count -ne 0) { throw 'Fixture already has a Users rule' }
    $acl.AddAccessRule($rule)
  } elseif ($mode -eq 'remove') {
    foreach ($current in $explicit) {
      if ($current.AccessControlType -ne $rule.AccessControlType -or $current.FileSystemRights -ne $rule.FileSystemRights -or $current.InheritanceFlags -ne $rule.InheritanceFlags -or $current.PropagationFlags -ne $rule.PropagationFlags -or $current.IsInherited) { throw 'Fixture Users rule changed' }
    }
    $acl.RemoveAccessRuleSpecific($rule)
  } else { throw 'Unsupported fixture mode' }
  Set-Acl -LiteralPath $path -AclObject $acl
  $verified = Get-Acl -LiteralPath $path
  $rules = @($verified.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq $sid.Value })
  if ($mode -eq 'add') {
    if ($rules.Count -ne 1 -or $rules[0].AccessControlType -ne $rule.AccessControlType -or $rules[0].FileSystemRights -ne $rule.FileSystemRights -or $rules[0].InheritanceFlags -ne $rule.InheritanceFlags -or $rules[0].PropagationFlags -ne $rule.PropagationFlags -or $rules[0].IsInherited) { throw 'Fixture Users rule not applied exactly' }
  } elseif ($rules.Count -ne 0) { throw 'Fixture Users rule not removed' }
  exit 0
} catch { exit 1 }
`

async function healthy(origin: string) {
  try {
    const response = await fetch(new URL('/health', origin), {
      redirect: 'manual',
      signal: AbortSignal.timeout(3_000),
    })
    const ok = response.status === 200
    await response.body?.cancel()
    expect(ok).toBe(true)
  } catch {
    throw new Error('Owned public server no longer answers health requests')
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
  throw new Error('Owned public listener cessation could not be confirmed')
}

test('portable Windows status and stop reject an explicitly readable private readiness leaf', async () => {
  if (
    process.platform !== 'win32' ||
    !Bun.semver.satisfies(Bun.version, '>=1.4.2')
  )
    throw new Error(
      'Leaf ACL artifact journey requires Windows and Bun >= 1.4.2',
    )
  const artifact = process.env.BESH_TEST_PORTABLE_EXE
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
  if (!artifact || !systemRoot)
    throw new Error('Supply portable artifact and Windows system root')
  const prefix = join(resolve(tmpdir()), 'besh-portable-leaf-acl-')
  const directory = await mkdtemp(prefix)
  const installation = join(directory, 'executable folder ภาษาไทย')
  const cwd = join(directory, 'other working folder ภาษาไทย')
  const data = join(directory, 'workspace')
  const executable = join(installation, 'besh.exe')
  const env: NodeJS.ProcessEnv = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: join(systemRoot, 'System32'),
    TEMP: directory,
    TMP: directory,
  }
  let running: ReturnType<typeof captured> | undefined
  let origin: string | undefined
  let aclMayBeChanged = false
  let confirmedStopped = false
  const changeACL = async (mode: 'inspect' | 'add' | 'remove') => {
    const result = await command(
      join(
        systemRoot,
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', aclScript],
      cwd,
      {
        ...env,
        BESH_ACL_TEST_ROOT: directory,
        BESH_ACL_TEST_FILE: join(data, '.besh-instance', 'ready.json'),
        BESH_ACL_TEST_MODE: mode,
      },
    )
    if (result.code !== 0 || result.output !== '' || result.errorOutput !== '')
      throw new Error(
        'Owned temporary leaf ACL fixture did not complete safely',
      )
  }
  const stop = async () => {
    if (!running || !origin || aclMayBeChanged)
      throw new Error(
        'Owned instance cannot be safely stopped; retain workspace',
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
        state(result.output, 'stopped'),
    ).toBe(true)
    await ceased(origin)
    expect(await boundedExit(running)).toBe(0)
    const final = running.result()
    expect(
      final.errorOutput === '' &&
        /^Besh API ready at http:\/\/127\.0\.0\.1:\d+\/?$/u.test(
          final.output.trim(),
        ),
    ).toBe(true)
    confirmedStopped = true
  }
  try {
    await Promise.all([mkdir(installation), mkdir(cwd)])
    await copyFile(resolve(artifact), executable)
    running = captured(
      executable,
      ['run', '--no-open', '--port', '0', '--data-dir', data],
      cwd,
      env,
    )
    origin = await running.ready()
    await healthy(origin)
    // Establish the ACE was absent before allowing best-effort removal after
    // an unconfirmed add. Never remove an already existing fixture permission.
    await changeACL('inspect')
    aclMayBeChanged = true
    await changeACL('add')
    const deniedStatus = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      deniedStatus.code !== null &&
        deniedStatus.code !== 0 &&
        deniedStatus.output === '' &&
        deniedStatus.errorOutput.trim() === denial,
    ).toBe(true)
    await healthy(origin)
    const deniedStop = await command(
      executable,
      ['stop', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      deniedStop.code !== null &&
        deniedStop.code !== 0 &&
        deniedStop.output === '' &&
        deniedStop.errorOutput.trim() === denial,
    ).toBe(true)
    await healthy(origin)
    await changeACL('remove')
    aclMayBeChanged = false
    const restored = await command(
      executable,
      ['status', '--data-dir', data],
      cwd,
      env,
    )
    expect(
      restored.code === 0 &&
        restored.errorOutput === '' &&
        state(restored.output, 'running', origin),
    ).toBe(true)
    await healthy(origin)
    await stop()
  } finally {
    try {
      if (aclMayBeChanged) {
        try {
          await changeACL('remove')
          aclMayBeChanged = false
        } catch {
          // An uncertain ACL mutation leaves all possibly live storage intact.
        }
      }
      if (running && origin && !aclMayBeChanged && !confirmedStopped)
        await stop().catch(() => {})
      if (running && confirmedStopped && origin) {
        try {
          await ceased(origin)
        } catch {
          confirmedStopped = false
        }
      }
      if (!running || confirmedStopped) {
        const target = resolve(directory)
        if (
          !target.startsWith(prefix) ||
          !target.startsWith(resolve(tmpdir()) + sep)
        )
          throw new Error('Leaf ACL cleanup escaped its temporary root')
        await rm(target, {
          recursive: true,
          force: true,
          maxRetries: 4,
          retryDelay: 100,
        })
      }
    } finally {
      if (running && !confirmedStopped) running.detach()
    }
  }
}, 120_000)
