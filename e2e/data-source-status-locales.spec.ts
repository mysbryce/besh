import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { dataSourceStatusLocalePreviews } from './data-source-status-locale-previews'

test.use({ locale: 'en-US', timezoneId: 'UTC' })

test('saved source status and explicit catalog refresh follow language and browser timezone', async ({
  page,
}, info) => {
  const prefix = join(tmpdir(), 'besh-source-status-locales-')
  const directory = mkdtempSync(prefix)
  const origin = 'http://127.0.0.1:4334'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const errors: string[] = []
  let number = 0

  page.on('pageerror', (error) => errors.push(error.message))

  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4334',
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
          return (await page.request.get(`${origin}/health`)).status()
        } catch {
          return 0
        }
      })
      .toBe(200)

    await dataSourceStatusLocalePreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title) => {
        // The complete gallery owns every state; ordinary acceptance keeps three diagnostics.
        if (
          ![
            'Phone light Thai saved source status',
            'Russian explicit catalog refresh pending',
            'Phone dark Thai Excel source status',
          ].includes(title)
        )
          return

        await page.screenshot({
          path: info.outputPath(
            `${++number}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: true,
          style: 'html { scrollbar-gutter: stable !important }',
          animations: 'disabled',
          mask: [
            page.locator('input[type="password"]'),
            page.locator('[data-private]'),
          ],
        })
      },
    })
    expect(errors).toEqual([])
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    if (
      !target.startsWith(resolve(prefix)) ||
      !target.startsWith(resolve(tmpdir()) + sep)
    )
      throw new Error(
        'Source status fixture cleanup must stay inside temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
