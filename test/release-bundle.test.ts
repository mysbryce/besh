import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'

const repository = resolve(import.meta.dir, '..')

test('release candidate retains its referenced dependency patch and checksum', () => {
  const temporaryRoot = realpathSync(tmpdir())
  const directory = mkdtempSync(join(temporaryRoot, 'besh-release-bundle-'))
  const environment = { ...process.env }

  // The isolated repository must not inherit another checkout or CI release base.
  for (const key of Object.keys(environment)) {
    if (key.startsWith('GIT_') || key.startsWith('BESH_RELEASE_'))
      delete environment[key]
  }

  environment.GIT_CONFIG_NOSYSTEM = '1'
  environment.GIT_CONFIG_GLOBAL = join(directory, 'absent-global-config')
  environment.GIT_TERMINAL_PROMPT = '0'

  function command(args: string[]) {
    const result = Bun.spawnSync(args, {
      cwd: directory,
      env: environment,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 5_000,
    })

    expect(result.exitCode).toBe(0)
    return result.stdout.toString()
  }

  function git(...args: string[]) {
    return command([
      'git',
      '-c',
      `safe.directory=${directory.replaceAll('\\', '/')}`,
      '-c',
      'core.autocrlf=false',
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${join(directory, 'absent-hooks')}`,
      ...args,
    ])
  }

  try {
    const manifest = JSON.parse(
      readFileSync(join(repository, 'package.json'), 'utf8'),
    )
    const patchPath = manifest.patchedDependencies['@lexical/history@0.52.0']
    expect(patchPath).toBe('patches/@lexical%2Fhistory@0.52.0.patch')

    const patchBytes = readFileSync(join(repository, patchPath))
    const patchTarget = join(directory, patchPath)
    mkdirSync(dirname(patchTarget), { recursive: true })
    writeFileSync(patchTarget, patchBytes)

    mkdirSync(join(directory, 'scripts'))
    for (const name of ['release-bundle.ts', 'release-check.ts']) {
      copyFileSync(
        join(repository, 'scripts', name),
        join(directory, 'scripts', name),
      )
    }

    manifest.version = '0.1.1-alpha.0'
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    )
    copyFileSync(join(repository, 'bun.lock'), join(directory, 'bun.lock'))
    writeFileSync(
      join(directory, 'CHANGELOG.md'),
      '# Changelog\n\n## 0.1.1-alpha.0 — 2026-10-11\n\n### Fixed\n\n- Preserve dependency patches in source releases.\n',
    )
    writeFileSync(join(directory, '.gitignore'), 'dist/\n.cache/\n')

    git('init')
    git('config', '--local', 'user.name', 'Besh release test')
    git('config', '--local', 'user.email', 'release-test@example.invalid')
    git('add', '--', '.')
    git('commit', '-m', 'fix(release): retain dependency patch')

    mkdirSync(join(directory, 'dist'))
    writeFileSync(join(directory, 'dist', 'index.html'), '<!doctype html>\n')
    command([process.execPath, 'scripts/release-bundle.ts'])

    const candidate = join(directory, '.cache', 'release-candidate')
    const bundledPatch = join(candidate, patchPath)
    expect(existsSync(bundledPatch)).toBe(true)
    expect(readFileSync(bundledPatch)).toEqual(patchBytes)

    const receipt: {
      files: { path: string; bytes: number; sha256: string }[]
    } = JSON.parse(readFileSync(join(candidate, '.besh-release.json'), 'utf8'))
    expect(receipt.files.find((file) => file.path === patchPath)).toEqual({
      path: patchPath,
      bytes: patchBytes.length,
      sha256: createHash('sha256').update(patchBytes).digest('hex'),
    })
  } finally {
    const actual = realpathSync(directory)
    const offset = relative(temporaryRoot, actual)
    if (
      dirname(actual) !== temporaryRoot ||
      !offset.startsWith('besh-release-bundle-') ||
      offset.includes(sep)
    )
      throw new Error(
        'Release fixture cleanup must stay inside its temporary root',
      )

    rmSync(actual, { recursive: true, force: true, maxRetries: 5 })
  }
}, 15_000)
