import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve, sep } from 'node:path'

const root = process.cwd()
const realRoot = realpathSync(root)
const destination = resolve(root, '.cache/release-candidate')
const rootFiles = new Set([
  'package.json',
  'bun.lock',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'SECURITY.md',
  'AI_POLICY.md',
  'CODE_OF_CONDUCT.md',
  'AGENTS.md',
  'GLOSSARY.md',
  '.env.example',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
])

function git(...args: string[]) {
  const result = Bun.spawnSync(
    ['git', '-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0)
    throw new Error('Could not read release Git metadata')
  return result.stdout.toString()
}

function inside(path: string, directory: string) {
  const offset = relative(directory, path)
  if (
    !offset ||
    offset.startsWith(`..${sep}`) ||
    offset === '..' ||
    resolve(path) === directory
  )
    throw new Error('Release path must stay inside its directory')
  if (offset.startsWith(sep) || /^[a-zA-Z]:/.test(offset))
    throw new Error('Release path must stay inside its directory')
}

try {
  inside(destination, root)
  if (
    existsSync(join(root, '.cache')) &&
    lstatSync(join(root, '.cache')).isSymbolicLink()
  )
    throw new Error(
      'Release cache must be a local directory, not a symbolic link',
    )
  if (git('status', '--porcelain').trim())
    throw new Error('Commit tested changes before creating a release candidate')
  const policy = Bun.spawnSync([process.execPath, 'scripts/release-check.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (policy.exitCode !== 0) throw new Error('Release policy failed')
  if (existsSync(destination))
    throw new Error('Release output already exists; choose a fresh checkout')
  if (!existsSync('dist/index.html'))
    throw new Error('Build the dashboard before creating a release candidate')

  const tracked = git('ls-files', '-z').split('\0').filter(Boolean)
  const paths = tracked.filter(
    (path) =>
      rootFiles.has(path) ||
      /^(src|web|docs|scripts)\//.test(path) ||
      path.startsWith('assets/portable-notices/'),
  )
  function assets(directory: string) {
    const stat = lstatSync(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(
        'Release build directories must be local directories, not symbolic links',
      )
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name)
      if (item.isDirectory()) assets(path)
      else paths.push(path.replaceAll('\\', '/'))
    }
  }
  assets('dist')

  const files = paths.sort().map((path) => {
    const source = resolve(root, path)
    inside(source, root)
    inside(realpathSync(source), realRoot)
    const stat = lstatSync(source)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_777_216)
      throw new Error(
        'Release files must be regular files no larger than 16 MiB',
      )
    return {
      path,
      bytes: stat.size,
      sha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
    }
  })
  if (files.reduce((sum, file) => sum + file.bytes, 0) > 67_108_864)
    throw new Error('Release candidate exceeds 64 MiB')

  mkdirSync(destination, { recursive: true })
  for (const file of files) {
    const target = resolve(destination, file.path)
    inside(target, destination)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(resolve(root, file.path), target)
  }
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
  writeFileSync(
    join(destination, '.besh-release.json'),
    JSON.stringify(
      {
        version: manifest.version,
        commit: git('rev-parse', 'HEAD').trim(),
        bun: Bun.version,
        files,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Release candidate prepared: ${manifest.version} (${files.length} files)`,
  )
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Release candidate failed',
  )
  process.exitCode = 1
}
