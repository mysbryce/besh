import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { releasePinPreviews } from './release-pins-preview'

test('release-pinned caller keys stay separate from keys following publication', async ({
  page,
}) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-release-pins-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4324'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4324',
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
    await releasePinPreviews({
      page,
      owner,
      apiOrigin: backend,
      capture: async () => {},
    })
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
