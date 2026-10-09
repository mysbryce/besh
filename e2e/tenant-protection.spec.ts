import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantProtectionPreviews } from './tenant-protection-preview'

test('owner reviews exact tenant identity before row protection', async ({
  page,
}) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(10_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  const directory = mkdtempSync(join(tmpdir(), 'besh-tenant-protection-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4328'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4328',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: owner,
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((resolve) => {
    server.once('exit', () => resolve())
    server.once('error', () => resolve())
  })
  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(`${backend}/health`)).status()
        } catch {
          return 0
        }
      })
      .toBe(200)
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (
        !/^\/(api\/|auth\/|setup\/|health$|run\/|graphql\/)/.test(url.pathname)
      )
        return route.continue()
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
        maxRedirects: 0,
      })
      await route.fulfill({ response })
    })
    await page.goto('/', { timeout: 30_000 })
    await tenantProtectionPreviews({
      page,
      owner,
      apiOrigin: backend,
      capture: async () => {},
    })
    expect(browserErrors).toEqual([])
  } catch (error) {
    await test.info().attach('tenant-failure-semantics', {
      contentType: 'application/json',
      body: JSON.stringify(
        await page.evaluate(() => {
          const appearance = document.querySelector(
            '[role="combobox"][aria-label="Appearance"]',
          )
          const ancestors = []
          for (
            let element = appearance;
            element;
            element = element.parentElement
          ) {
            const style = getComputedStyle(element)
            ancestors.push({
              tag: element.tagName,
              className: element.className,
              ariaHidden: element.getAttribute('aria-hidden'),
              inert: element.hasAttribute('inert'),
              display: style.display,
              visibility: style.visibility,
              bounds: element.getBoundingClientRect().toJSON(),
            })
          }
          return {
            viewport: { width: innerWidth, height: innerHeight },
            appearancePresent: !!appearance,
            navigationPresent: !!document.querySelector(
              '[aria-label="Workspace navigation"]',
            ),
            focusedRole: document.activeElement?.getAttribute('role'),
            ancestors,
          }
        }),
      ),
    })
    await page.screenshot({
      path: test.info().outputPath('tenant-failure-masked.png'),
      fullPage: false,
      animations: 'disabled',
      mask: [page.locator('input, code, pre')],
    })
    throw error
  } finally {
    await page.close()
    server.kill()
    await stopped
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
})
