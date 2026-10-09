import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scopedActionsPreviews } from './scoped-actions-preview'

test('selected API operator uses explicit dependencies and bound callers', async ({
  page,
}) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(10_000)
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  const directory = mkdtempSync(join(tmpdir(), 'besh-scoped-actions-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4327'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4327',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: owner,
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
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
    await page.goto('/')
    await scopedActionsPreviews({
      page,
      owner,
      apiOrigin: backend,
      capture: async () => {},
    })
    expect(browserErrors).toEqual([])
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
