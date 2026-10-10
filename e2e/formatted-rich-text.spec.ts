import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { formattedRichTextPreviews } from './formatted-rich-text-previews'

test.use({ locale: 'en-US' })

test('owner formats article headings and saves typed content without writing JSON', async ({
  page,
}, info) => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-formatted-browser-'))
  const origin = 'http://127.0.0.1:4339'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const errors: string[] = []

  page.on('pageerror', (error) => errors.push(error.message))

  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4339',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
      BESH_RUNTIME_CODE_DIR: join(directory, 'runtime'),
    },
  })
  const stopped = new Promise<void>((done) => {
    server.once('close', () => done())
    server.once('error', () => done())
  })

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(origin + '/health')).status()
        } catch {
          return 0
        }
      })
      .toBe(200)

    let captures = 0
    await formattedRichTextPreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title) => {
        await page.screenshot({
          path: info.outputPath(
            String(++captures) +
              '-' +
              title.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
              '.png',
          ),
          fullPage: true,
          animations: 'disabled',
          mask: [page.locator('[data-private]')],
        })
      },
    })
    expect(captures).toBe(7)
    expect(errors).toEqual([])
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    const parent = resolve(tmpdir()) + sep
    if (
      !target.toLowerCase().startsWith(parent.toLowerCase()) ||
      !basename(target).startsWith('besh-formatted-browser-')
    )
      throw new Error(
        'Formatted editor cleanup must stay inside its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
