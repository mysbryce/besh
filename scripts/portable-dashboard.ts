import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative } from 'node:path'
import { build, type Plugin } from 'vite'
import dashboardConfig from '../vite.config'

export async function buildPortableDashboard(root: string) {
  const digest = (bytes: Uint8Array | string) =>
    createHash('sha256').update(bytes).digest('hex')
  const inputs: {
    path: string
    renderedLength: number
    bytes?: number
    sha256?: string
    chunks: string[]
  }[] = []
  const assets: { path: string; bytes: number; sha256: string }[] = []
  const inventory: Plugin = {
    name: 'besh-portable-inputs',
    // Hash final assets after output transforms, not the earlier CSS payload.
    writeBundle(_, bundle) {
      const modules = new Map<string, (typeof inputs)[number]>()
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset') {
          const bytes =
            typeof output.source === 'string'
              ? Buffer.from(output.source)
              : output.source
          assets.push({
            path: output.fileName,
            bytes: bytes.byteLength,
            sha256: digest(bytes),
          })
          continue
        }

        for (const [id, module] of Object.entries(output.modules)) {
          const clean = id.split('?')[0]
          const offset = relative(root, clean).replaceAll('\\', '/')
          const contained =
            isAbsolute(clean) &&
            !offset.startsWith('../') &&
            !isAbsolute(offset)
          const path = contained
            ? offset
            : id
                .replaceAll(root.replaceAll('\\', '/'), '<root>')
                .replaceAll(root, '<root>')
          let input = modules.get(path)
          if (!input) {
            input = { path, renderedLength: 0, chunks: [] }
            if (contained) {
              const bytes = readFileSync(clean)
              input.bytes = bytes.byteLength
              input.sha256 = digest(bytes)
            }
            modules.set(path, input)
          }
          input.renderedLength += module.renderedLength
          input.chunks.push(output.fileName)
        }
      }
      inputs.push(...modules.values())
    },
  }

  await build({
    ...dashboardConfig,
    root,
    configFile: false,
    plugins: [...(dashboardConfig.plugins ?? []), inventory],
  })

  return {
    schemaVersion: 1,
    inputs: inputs.sort((a, b) => a.path.localeCompare(b.path, 'en')),
    assets: assets.sort((a, b) => a.path.localeCompare(b.path, 'en')),
  }
}
