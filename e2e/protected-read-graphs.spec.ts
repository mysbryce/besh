import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { protectedReadGraphPreviews } from './protected-read-graphs-preview'

test('owner reviews the last protected read reply', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-protected-reads-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4330'
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4330',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: owner,
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((finish) => {
    server.once('exit', () => finish())
    server.once('error', () => finish())
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
      if (!/^\/(api\/|auth\/|setup\/|health$)/.test(url.pathname))
        return route.continue()
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
        maxRedirects: 0,
      })
      await route.fulfill({ response })
    })
    await page.goto('/', { timeout: 30_000 })
    let firstCapture = true
    await protectedReadGraphPreviews({
      page,
      owner,
      apiOrigin: backend,
      capture: async (_group, title, _detail, options) => {
        const initial = firstCapture
        if (
          !initial &&
          ![
            'Pending reply metadata cannot apply stale rules',
            'Review exact draft reply replacement actions',
          ].includes(title)
        )
          return
        firstCapture = false
        if (options?.fullPage !== false)
          await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: testInfo.outputPath(
            initial
              ? 'initial-last-read-canonical-capture.png'
              : title === 'Pending reply metadata cannot apply stale rules'
                ? 'pending-last-read-canonical-capture.png'
                : 'actions-last-read-canonical-capture.png',
          ),
          fullPage: options?.fullPage ?? true,
          animations: 'disabled',
          mask: [
            page.getByLabel('Workspace token', { exact: true }),
            page.getByLabel('Your owner key', { exact: true }),
            page.getByLabel('New API key', { exact: true }),
          ],
          maskColor: '#dfe4ec',
        })
      },
    })
    expect(browserErrors).toEqual([])
  } finally {
    await page.close()
    server.kill()
    await stopped
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture directory must remain inside the temporary root.',
      )
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
})
