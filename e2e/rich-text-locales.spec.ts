import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { richTextLocalePreviews } from './rich-text-locale-previews'

test.use({ locale: 'en-US' })

test('language changes preserve dirty formatted articles and native history before a real save', async ({
  page,
}, info) => {
  const prefix = 'besh-rich-locales-'
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const origin = 'http://127.0.0.1:4393'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const errors: string[] = []
  let captures = 0

  page.on('pageerror', (error) => errors.push(error.message))

  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4393',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'control.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'secrets.key'),
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

    await richTextLocalePreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title, _detail, options) => {
        if (
          ![
            'Dirty formatted article en',
            'Phone Thai light formatted controls',
            'Phone Russian dark table and code',
          ].includes(title)
        )
          return

        await page.screenshot({
          path: info.outputPath(
            `${++captures}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: options?.fullPage ?? true,
          animations: 'disabled',
          style: 'html { scrollbar-gutter: stable !important }',
          mask: [
            page.locator('[data-private]'),
            page.locator('input[type="password"]'),
          ],
        })
      },
    })
    expect(captures).toBe(3)
    expect(errors).toEqual([])
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    if (
      !target
        .toLowerCase()
        .startsWith((resolve(tmpdir()) + sep).toLowerCase()) ||
      !basename(target).startsWith(prefix)
    )
      throw new Error(
        'Rich-text locale cleanup must stay inside its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
