import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { PortableError } from './cli'

export async function openBrowser(url: string, browser?: string) {
  let executable: string
  let args: string[]

  if (browser) {
    try {
      if (!isAbsolute(browser) || !statSync(browser).isFile()) throw new Error()
    } catch {
      throw new PortableError(
        'The selected browser must be an existing absolute executable path.',
      )
    }

    executable = browser
    args = [url]
  } else if (process.platform === 'win32') {
    const root = process.env.SystemRoot ?? process.env.SYSTEMROOT
    if (!root || !isAbsolute(root))
      throw new PortableError(
        'Windows browser handoff is unavailable. Use an absolute --browser path.',
      )

    executable = join(root, 'System32', 'rundll32.exe')
    args = ['url.dll,FileProtocolHandler', url]
  } else if (process.platform === 'darwin') {
    executable = '/usr/bin/open'
    args = [url]
  } else {
    executable = '/usr/bin/xdg-open'
    args = [url]
  }

  await new Promise<void>((done, fail) => {
    const child = spawn(executable, args, {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
      env: process.env,
    })

    child.once('error', () =>
      fail(new PortableError('Besh could not open the selected browser.')),
    )
    child.once('spawn', () => {
      child.unref()
      done()
    })
  })
}
