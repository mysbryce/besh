import { expect, test as base, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { localeFallbackPreviews, localePreviews } from './locale-previews'
import {
  localeBootstrapPreviews,
  localeStartupPreviews,
} from './locale-startup-previews'

const test = base.extend<{ workspace: { origin: string; owner: string } }>({
  workspace: async ({ page }, use) => {
    const directory = mkdtempSync(join(tmpdir(), 'besh-locales-'))
    const origin = 'http://127.0.0.1:4331'
    const owner = crypto.randomUUID() + crypto.randomUUID()
    const server = spawn('bun', ['src/index.ts'], {
      env: {
        ...process.env,
        PORT: '4331',
        BESH_HOST: '127.0.0.1',
        BESH_ADMIN_TOKEN: owner,
        BESH_WEB_URL: origin,
        BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
        BESH_BACKUP_DIR: join(directory, 'backups'),
        BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
      },
      windowsHide: true,
      stdio: 'ignore',
    })
    const stopped = new Promise<void>((finish) => {
      server.once('exit', () => finish())
      server.once('error', () => finish())
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
      await use({ origin, owner })
    } finally {
      await page.close()
      server.kill()
      await stopped
      if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
        throw new Error(
          'Language fixture must remain inside the temporary root.',
        )
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      })
    }
  },
})

function masked(page: Page) {
  return [
    page.locator('input[type="password"]'),
    page.locator('[data-private]'),
  ]
}

for (const locale of ['th-TH', 'es-MX']) {
  test.describe(locale, () => {
    test.use({ locale })
    test('device language, choices and authored data remain independent', async ({
      page,
      workspace,
    }, info) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      try {
        const helper =
          locale === 'th-TH' ? localePreviews : localeFallbackPreviews
        let captureNumber = 0
        await helper({
          page,
          owner: workspace.owner,
          apiOrigin: workspace.origin,
          capture: async (_group, title, _detail, options) => {
            await page.screenshot({
              path: info.outputPath(
                `${++captureNumber}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
              ),
              fullPage: options?.fullPage ?? true,
              animations: 'disabled',
              mask: masked(page),
            })
          },
        })
        expect(errors).toEqual([])
      } catch (error) {
        await page.screenshot({
          path: info.outputPath('language-failure-masked.png'),
          fullPage: true,
          animations: 'disabled',
          mask: masked(page),
        })
        throw error
      }
    })
  })
}

test.describe('Thai startup delivery', () => {
  test.use({ locale: 'th-TH' })
  test('stalled startup language falls back and retries explicitly', async ({
    page,
    workspace,
  }, info) => {
    await localeStartupPreviews({
      page,
      owner: workspace.owner,
      apiOrigin: workspace.origin,
      capture: async (_group, title, _detail, options) => {
        await page.screenshot({
          path: info.outputPath(
            `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: options?.fullPage ?? true,
          animations: 'disabled',
          mask: masked(page),
        })
      },
    })
  })
  test('invitation arriving during language startup is captured before restore', async ({
    page,
    workspace,
  }, info) => {
    await localeBootstrapPreviews({
      page,
      owner: workspace.owner,
      apiOrigin: workspace.origin,
      capture: async (_group, title, _detail, options) => {
        await page.screenshot({
          path: info.outputPath(
            `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: options?.fullPage ?? true,
          animations: 'disabled',
          mask: masked(page),
        })
      },
    })
  })
})
