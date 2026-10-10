import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { navigationPreviews } from './navigation-preview'

test.describe.configure({ lock: 'port-4330' })
test.use({
  actionTimeout: 10_000,
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
})

test('compact navigation and menus preserve keyboard and phone access', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-navigation-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const origin = 'http://127.0.0.1:4330'
  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4330',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
    },
  })
  const closed = new Promise<void>((done) => server.once('close', () => done()))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let captureNumber = 0
  const mask = () => [
    page.locator('input[type="password"]'),
    page.locator('[data-private]'),
  ]
  const menuCloseups = new Set([
    'Compact dark role menu with many choices',
    'Complete long role label at the end of a menu',
    'Phone long role choice without clipping',
  ])

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
    await navigationPreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title, _detail, options) => {
        const path = info.outputPath(
          `${++captureNumber}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
        )
        const menu = page.getByRole('listbox')
        const bytes =
          options?.region === 'listbox'
            ? await page.screenshot({
                path,
                clip: (await menu.boundingBox())!,
                animations: 'disabled',
                mask: [
                  menu.locator('input[type="password"]'),
                  menu.locator('[data-private]'),
                ],
              })
            : await page.screenshot({
                path,
                fullPage: options?.fullPage ?? true,
                animations: 'disabled',
                mask: mask(),
              })
        if (menuCloseups.has(title)) {
          const bounds = await page.getByRole('listbox').boundingBox()
          expect(bounds).not.toBeNull()
          expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(
            Math.ceil(bounds!.width) + 1,
          )
        }
      },
    })
    expect(errors).toEqual([])
  } catch (error) {
    await page
      .screenshot({
        path: info.outputPath('navigation-failure-masked.png'),
        fullPage: true,
        animations: 'disabled',
        mask: mask(),
      })
      .catch(() => {})
    throw error
  } finally {
    await page.close()
    server.kill()
    await closed
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep))
      throw new Error(
        'Navigation fixture must remain inside the temporary root',
      )
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
})
