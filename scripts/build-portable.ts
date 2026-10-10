import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { buildPortableDashboard } from './portable-dashboard'

const root = resolve(import.meta.dir, '..')
const targets = [
  'bun-windows-x64',
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-darwin-x64',
  'bun-darwin-arm64',
] as const

type PortableTarget = (typeof targets)[number]

if (!Bun.semver.satisfies(Bun.version, '>=1.4.2'))
  throw new Error('Portable builds require Bun >= 1.4.2.')

let target: PortableTarget = 'bun-windows-x64'
let requestedOutput: string | undefined
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--target') {
    const value = args[++index]
    if (!targets.some((candidate) => candidate === value))
      throw new Error(
        'Choose a supported Windows, Linux or macOS build target.',
      )
    target = value as PortableTarget
    continue
  }
  if (args[index] === '--outfile') {
    const value = args[++index]
    if (!value?.trim() || value.startsWith('--'))
      throw new Error('Provide an output file after --outfile.')
    requestedOutput = resolve(value)
    continue
  }
  throw new Error('Unsupported build option. Use --target or --outfile.')
}

const platform = target.slice('bun-'.length)
const extension = target.startsWith('bun-windows-') ? '.exe' : ''
const selectedOutput =
  requestedOutput ??
  resolve(root, '.cache', 'portable', `besh-${platform}${extension}`)
const outfile =
  extension && !selectedOutput.toLowerCase().endsWith(extension)
    ? selectedOutput + extension
    : selectedOutput

mkdirSync(dirname(outfile), { recursive: true })
// Asset paths are relative to the reviewed repository so their embedded name
// remains dist, independent of the invoking shell's working directory.
process.chdir(root)

const initialSource = sourceStamp()
const dashboard = await buildPortableDashboard(root)
await Bun.write(outfile + '.dashboard.json', JSON.stringify(dashboard, null, 2))

const compile = () =>
  Bun.build({
    entrypoints: ['src/portable/index.ts'],
    target: 'bun',
    env: 'disable',
    metafile: true,
    minify: true,
    compile: {
      target,
      outfile,
      assets: ['dist', 'assets/portable-notices'],
      autoloadDotenv: false,
      autoloadBunfig: false,
      autoloadTsconfig: false,
      autoloadPackageJson: false,
    },
  })
const first = await compile()
if (!first.success || !first.metafile)
  throw new Error('Portable executable compilation failed.')

function codeInputs(metafile: typeof first.metafile) {
  const paths = new Set([
    ...Object.keys(metafile!.inputs),
    ...dashboard.inputs
      .filter((input) => input.sha256)
      .map((input) => input.path),
    'package.json',
    'bun.lock',
    'index.html',
    'vite.config.ts',
    'scripts/build-portable.ts',
    'scripts/portable-dashboard.ts',
  ])
  return [...paths].sort().map((path) => {
    const file = realpathSync(resolve(root, path))
    const offset = relative(root, file).replaceAll('\\', '/')
    if (offset.startsWith('../') || isAbsolute(offset))
      throw new Error('Portable code input escaped the repository.')
    const bytes = readFileSync(file)
    const text = /\.(?:[cm]?[jt]sx?|json|html|css|lock)$/.test(path)
    const normalized = text
      ? bytes.toString('utf8').replaceAll('\r\n', '\n')
      : bytes
    return {
      path: offset,
      sha256: createHash('sha256').update(normalized).digest('hex'),
    }
  })
}

const inputs = codeInputs(first.metafile)
for (const input of dashboard.inputs) {
  if (
    input.sha256 &&
    createHash('sha256')
      .update(readFileSync(resolve(root, input.path)))
      .digest('hex') !== input.sha256
  )
    throw new Error('Dashboard input changed during compilation.')
}
const codeInputsSha256 = createHash('sha256')
  .update(JSON.stringify(inputs))
  .digest('hex')
const noticePath = resolve(root, 'assets/portable-notices/index.json')
const notices = await Bun.file(noticePath).json()
const manifest = await Bun.file(resolve(root, 'package.json')).json()
notices.packageVersion = manifest.version
notices.bunVersion = Bun.version
notices.bunUpstreamSourceCommit = Bun.revision
notices.noticeBaseline = {
  bunVersion: '1.4.2',
  sourceCommit: '744846f844374847c902b5e7fd59b4342a51ef99',
}
notices.lockSha256 = createHash('sha256')
  .update(readFileSync(resolve(root, 'bun.lock')))
  .digest('hex')
notices.codeInputsSha256 = codeInputsSha256
notices.codeInputsDefinition =
  'SHA-256 of sorted actual Bun/Vite module inputs plus package, lock, HTML, Vite configuration and build scripts; text CRLF normalized to LF. Exact executable bytes are hashed in external build metadata.'
delete notices.codeInputsFinalization
for (const component of notices.components) {
  if (component.id === 'besh') component.version = manifest.version
}
await Bun.write(noticePath, JSON.stringify(notices, null, 2) + '\n')

// The second compilation embeds the final input digest without a self-hash cycle.
const result = await compile()
if (!result.success) throw new Error('Portable executable compilation failed.')
if (JSON.stringify(codeInputs(result.metafile)) !== JSON.stringify(inputs))
  throw new Error('Portable code inputs changed during compilation.')
if (!(await Bun.file(outfile).exists()))
  throw new Error(
    'Portable compilation did not produce the requested artifact.',
  )

await Bun.write(
  outfile + '.metafile.json',
  JSON.stringify(result.metafile, null, 2),
)
await Bun.write(
  outfile + '.inputs.json',
  JSON.stringify({ schemaVersion: 1, codeInputsSha256, inputs }, null, 2) +
    '\n',
)

function sourceStamp() {
  try {
    const git = (...args: string[]) =>
      Bun.spawnSync(
        ['git', '-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
        { cwd: root, stdout: 'pipe', stderr: 'ignore' },
      )
    const commit = git('rev-parse', 'HEAD')
    const status = git('status', '--porcelain')
    if (commit.exitCode !== 0 || status.exitCode !== 0) return null
    return {
      commit: commit.stdout.toString().trim(),
      clean: !status.stdout.toString().trim(),
    }
  } catch {
    return null
  }
}

const finalSource = sourceStamp()
const source = finalSource
  ? {
      commit: finalSource.commit,
      clean: Boolean(
        initialSource?.clean &&
        finalSource.clean &&
        initialSource.commit === finalSource.commit,
      ),
    }
  : null
await Bun.write(
  outfile + '.build.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      version: manifest.version,
      bun: Bun.version,
      bunRevision: Bun.revision,
      target,
      source,
      codeInputsSha256,
      noticesSha256: createHash('sha256')
        .update(readFileSync(noticePath))
        .digest('hex'),
      executable: {
        bytes: Bun.file(outfile).size,
        sha256: createHash('sha256')
          .update(new Uint8Array(await Bun.file(outfile).arrayBuffer()))
          .digest('hex'),
      },
    },
    null,
    2,
  ) + '\n',
)

console.log(`Portable artifact: ${outfile}`)
