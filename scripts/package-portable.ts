import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const root = realpathSync(resolve(import.meta.dir, '..'))
const digest = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')
const git = (...args: string[]) => {
  const result = Bun.spawnSync(
    ['git', '-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { cwd: root, stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0)
    throw new Error('Portable package Git operation failed')
  return result.stdout.toString().trim()
}

if (
  process.platform !== 'win32' ||
  !Bun.semver.satisfies(Bun.version, '>=1.4.2')
)
  throw new Error('Windows packaging requires Windows and Bun >= 1.4.2')
if (git('status', '--porcelain'))
  throw new Error('Commit tested changes before packaging')
const commit = git('rev-parse', 'HEAD')
const version = (await Bun.file(join(root, 'package.json')).json())
  .version as string
if (!/^0\.\d+\.\d+-(?:alpha|beta|rc)\.\d+$/.test(version))
  throw new Error('Portable packages require a reviewed 0.x prerelease version')

const base = join(root, '.cache', 'portable', 'besh-windows-x64.exe')
const metadata = await Bun.file(base + '.build.json').json()
const noticeRoot = join(root, 'assets', 'portable-notices')
const indexBytes = readFileSync(join(noticeRoot, 'index.json'))
const index = JSON.parse(indexBytes.toString('utf8'))
if (
  metadata.version !== version ||
  typeof metadata.bun !== 'string' ||
  !Bun.semver.satisfies(metadata.bun, '>=1.4.2') ||
  metadata.target !== 'bun-windows-x64' ||
  metadata.source?.commit !== commit ||
  metadata.source?.clean !== true ||
  metadata.noticesSha256 !== digest(indexBytes) ||
  metadata.codeInputsSha256 !== index.codeInputsSha256 ||
  index.packageVersion !== version
)
  throw new Error(
    'Rebuild the executable from this clean committed source before packaging',
  )

const inputsPath = base + '.inputs.json'
if (Bun.file(inputsPath).size > 2 * 1024 * 1024)
  throw new Error('Portable code inventory exceeds its bound')
const inputs = await Bun.file(inputsPath).json()
if (
  inputs.schemaVersion !== 1 ||
  !Array.isArray(inputs.inputs) ||
  inputs.codeInputsSha256 !== metadata.codeInputsSha256 ||
  digest(Buffer.from(JSON.stringify(inputs.inputs))) !==
    metadata.codeInputsSha256
)
  throw new Error('Portable code inventory does not match the build')
for (const input of inputs.inputs) {
  if (typeof input.path !== 'string' || isAbsolute(input.path))
    throw new Error('Portable code inventory path is invalid')
  const source = realpathSync(resolve(root, input.path))
  const offset = relative(root, source)
  if (offset.startsWith('..' + sep) || isAbsolute(offset))
    throw new Error('Portable code input escaped its source root')
  const bytes = readFileSync(source)
  const normalized = /\.(?:[cm]?[jt]sx?|json|html|css|lock)$/.test(input.path)
    ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'))
    : bytes
  if (digest(normalized) !== input.sha256)
    throw new Error('Portable code input changed after the build')
}

const directory = join(root, '.cache', `portable-release-${version}`)
const archive = directory + '.zip'
if (existsSync(directory) || existsSync(archive))
  throw new Error('Portable package output already exists')
const files: { path: string; bytes: number; sha256: string }[] = []
function copy(
  source: string,
  path: string,
  limit: number,
  expected?: { bytes: number; sha256: string },
) {
  const stat = lstatSync(source)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit)
    throw new Error('Portable package input must be a bounded regular file')
  const bytes = readFileSync(source)
  const sha256 = digest(bytes)
  if (
    expected &&
    (expected.bytes !== bytes.length || expected.sha256 !== sha256)
  )
    throw new Error('Portable package input bytes changed')
  const target = resolve(directory, path)
  if (!target.startsWith(directory + sep))
    throw new Error('Portable package path escaped its directory')
  mkdirSync(resolve(target, '..'), { recursive: true })
  copyFileSync(source, target)
  files.push({ path, bytes: bytes.length, sha256 })
}

mkdirSync(directory)
copy(
  base,
  `besh-${version}-windows-x64.exe`,
  128 * 1024 * 1024,
  metadata.executable,
)
copy(join(noticeRoot, 'index.json'), 'licenses/index.json', 512 * 1024)
if (!Array.isArray(index.files) || index.files.length > 1024)
  throw new Error('Portable notices inventory exceeds its bound')
const names = new Set(['index.json'])
for (const file of index.files) {
  if (
    typeof file.path !== 'string' ||
    isAbsolute(file.path) ||
    /[\\<>:"|?*\u0000-\u001f]/.test(file.path) ||
    file.path
      .split('/')
      .some(
        (part: string) =>
          !part || part === '.' || part === '..' || /[. ]$/.test(part),
      )
  )
    throw new Error('Portable notice path is invalid')
  if (names.has(file.path.toLowerCase()))
    throw new Error('Portable notice path is duplicated')
  names.add(file.path.toLowerCase())
  const source = resolve(noticeRoot, file.path)
  const offset = relative(realpathSync(noticeRoot), realpathSync(source))
  if (offset.startsWith('..' + sep) || isAbsolute(offset))
    throw new Error('Portable notice escaped its source root')
  copy(source, 'licenses/' + file.path, 2 * 1024 * 1024, file)
}
copy(join(root, 'docs', 'portable.md'), 'README.md', 1024 * 1024)
copy(join(root, 'docs', 'portable-runtime.md'), 'SOURCE.md', 1024 * 1024)
copy(base + '.build.json', 'build.json', 2 * 1024 * 1024)
copy(base + '.inputs.json', 'code-inputs.json', 2 * 1024 * 1024)

const sourceName = `besh-${version}-source.zip`
git(
  'archive',
  '--format=zip',
  '--output=' + join(directory, sourceName),
  commit,
)
const sourceBytes = readFileSync(join(directory, sourceName))
if (sourceBytes.length > 64 * 1024 * 1024)
  throw new Error('Portable source archive exceeds 64 MiB')
files.push({
  path: sourceName,
  bytes: sourceBytes.length,
  sha256: digest(sourceBytes),
})
if (files.reduce((sum, file) => sum + file.bytes, 0) > 160 * 1024 * 1024)
  throw new Error('Portable package exceeds 160 MiB')
writeFileSync(
  join(directory, 'portable-manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      version,
      commit,
      bun: metadata.bun,
      target: metadata.target,
      files,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
)

const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT
if (!systemRoot || !isAbsolute(systemRoot))
  throw new Error('Windows system directory is unavailable')
const zip = Bun.spawnSync(
  [
    join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "$ErrorActionPreference = 'Stop'\nImport-Module (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/Modules/Microsoft.PowerShell.Archive/Microsoft.PowerShell.Archive.psd1')\nMicrosoft.PowerShell.Archive\\Compress-Archive -LiteralPath $env:BESH_PACKAGE_DIR -DestinationPath $env:BESH_PACKAGE_ZIP -CompressionLevel Optimal",
  ],
  {
    env: {
      SystemRoot: systemRoot,
      WINDIR: systemRoot,
      TEMP: process.env.TEMP ?? join(root, '.cache'),
      TMP: process.env.TMP ?? join(root, '.cache'),
      BESH_PACKAGE_DIR: directory,
      BESH_PACKAGE_ZIP: archive,
    },
    stdout: 'ignore',
    stderr: 'ignore',
    windowsHide: true,
    timeout: 120_000,
  },
)
if (zip.exitCode !== 0 || !existsSync(archive))
  throw new Error('Portable ZIP creation failed; retain the prepared directory')
const zipBytes = readFileSync(archive)
writeFileSync(
  archive + '.sha256',
  digest(zipBytes) + '  ' + archive.split(sep).at(-1) + '\n',
  { flag: 'wx' },
)
console.log(`Portable package: ${archive}`)
