import { createHash } from 'node:crypto'
import { PortableError } from './cli'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'

type EmbeddedIndex = {
  schemaVersion: number
  packageVersion: string
  bunVersion: string
  bunUpstreamSourceCommit: string
  lockSha256: string
  codeInputsSha256: string
  files: {
    path: string
    bytes: number
    sha256: string
  }[]
}

const fileLimit = 2 * 1024 * 1024
const indexLimit = 512 * 1024
const totalLimit = 16 * 1024 * 1024
const countLimit = 1024

function trustedRelative(path: string) {
  if (
    typeof path !== 'string' ||
    isAbsolute(path) ||
    /[\\<>:"|?*\u0000-\u001f]/.test(path) ||
    path
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[. ]$/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  ) {
    throw new PortableError('Embedded notice path is invalid')
  }

  return path
}

async function embeddedBytes(root: string, path: string, limit: number) {
  const file = Bun.file(join(root, trustedRelative(path)))

  if (!(await file.exists()) || file.size > limit) {
    throw new PortableError(
      'Embedded notice file is missing or exceeds its bound',
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > limit)
    throw new PortableError('Embedded notice file exceeds its bound')

  return bytes
}

export async function exportPortableLicenses(
  assetRoot: string,
  outputArgument: string,
) {
  if (!outputArgument?.trim())
    throw new PortableError('Provide a fresh directory after --output')

  const requested = resolve(outputArgument)
  if (existsSync(requested))
    throw new PortableError('License export directory already exists')

  const parent = realpathSync(dirname(requested))
  if (!lstatSync(parent).isDirectory())
    throw new PortableError('License export parent must be a directory')

  const output = join(parent, basename(requested))
  if (existsSync(output))
    throw new PortableError('License export directory already exists')

  const indexBytes = await embeddedBytes(assetRoot, 'index.json', indexLimit)
  const index = JSON.parse(indexBytes.toString('utf8')) as EmbeddedIndex

  if (
    index.schemaVersion !== 1 ||
    !Array.isArray(index.files) ||
    index.files.length > countLimit ||
    !/^[a-f0-9]{40}$/.test(index.bunUpstreamSourceCommit) ||
    !/^[a-f0-9]{64}$/.test(index.lockSha256) ||
    !/^[a-f0-9]{64}$/.test(index.codeInputsSha256) ||
    !Bun.semver.satisfies(index.bunVersion, '>=1.4.2')
  ) {
    throw new PortableError('Embedded notice index is invalid')
  }

  const payload: {
    path: string
    bytes: Buffer
  }[] = [{ path: 'index.json', bytes: indexBytes }]
  const seen = new Set(['index.json'])
  let total = indexBytes.length

  for (const file of index.files) {
    const path = trustedRelative(file.path)
    const key = path.toLowerCase()

    if (
      seen.has(key) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > fileLimit ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      throw new PortableError(
        'Embedded notice inventory has invalid or duplicate files',
      )
    }

    seen.add(key)

    total += file.bytes
    if (total > totalLimit)
      throw new PortableError(
        'Embedded notice inventory exceeds its total bound',
      )

    const bytes = await embeddedBytes(assetRoot, path, fileLimit)
    if (
      bytes.length !== file.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    ) {
      throw new PortableError(
        'Embedded notice bytes do not match the trusted inventory',
      )
    }

    payload.push({ path, bytes })
  }

  // All embedded bytes are checked before creating the fresh target. EEXIST fails.
  mkdirSync(output)

  for (const file of payload) {
    const target = resolve(output, file.path)
    const offset = relative(output, target)

    if (offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
      throw new PortableError('License export path escaped its directory')
    }

    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.bytes, { flag: 'wx' })
  }

  return { directory: output, files: payload.length }
}

export async function dispatchPortableLicenses(
  args: string[],
  trustedAssetRoot: string,
) {
  if (args[0] !== 'licenses') return false

  if (args.length !== 3 || args[1] !== '--output' || !args[2]?.trim()) {
    throw new PortableError('Use licenses --output <fresh-directory>')
  }

  const result = await exportPortableLicenses(trustedAssetRoot, args[2])
  console.log(`Exported ${result.files} license files.`)

  return true
}
