import { realpathSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

export class PortableError extends Error {}

export type PortableOptions = {
  command: 'start' | 'run' | 'status' | 'open' | 'stop'
  port: number
  dataDirectory: string
  noOpen: boolean
  browser?: string
}

export function options(args: string[]): PortableOptions {
  let command: PortableOptions['command'] = 'start'
  let port = 3000
  let dataDirectory: string | undefined
  let browser: string | undefined
  let noOpen = false
  let index = 0

  if (args[0] && !args[0].startsWith('--')) {
    if (!['start', 'run', 'status', 'open', 'stop'].includes(args[0]))
      throw new PortableError('Use start, run, status, open or stop.')

    command = args[0] as PortableOptions['command']
    index++
  }

  for (; index < args.length; index++) {
    const argument = args[index]

    if (argument === '--no-open') {
      noOpen = true
      continue
    }

    if (argument === '--port') {
      const value = args[++index]
      if (!value || !/^\d+$/u.test(value))
        throw new PortableError('Use a port number between 0 and 65535.')

      port = Number(value)
      if (!Number.isSafeInteger(port) || port > 65535)
        throw new PortableError('Use a port number between 0 and 65535.')
      continue
    }

    if (argument === '--data-dir' || argument === '--browser') {
      const value = args[++index]
      if (!value?.trim() || value.startsWith('--'))
        throw new PortableError('Provide a path after --data-dir or --browser.')

      if (argument === '--data-dir') dataDirectory = resolve(value)
      else {
        if (!isAbsolute(value))
          throw new PortableError(
            'Use an absolute trusted executable path for --browser.',
          )

        browser = value
      }

      continue
    }

    throw new PortableError(
      'Unsupported option. Use --no-open, --port, --data-dir or --browser.',
    )
  }

  return {
    command,
    port,
    dataDirectory:
      dataDirectory ??
      (Bun.isStandaloneExecutable
        ? resolve(dirname(process.execPath), 'besh-data')
        : resolve(import.meta.dir, '../../besh-data')),
    noOpen,
    browser,
  }
}

export function executableIdentity() {
  return realpathSync(process.execPath)
}

export function ready(url: string) {
  console.log(`Besh API ready at ${new URL(url).origin}/`)
}
