import { openApiTools } from './api-tools'
import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generatedBackendPreviews } from './generated-backend-preview'

test('publication provides read-only generated backend code for its actual live route', async ({
  page,
}) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-generated-backend-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4325'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4325',
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
    const headers = { authorization: `Bearer ${owner}` }
    const created = await page.request.post(`${backend}/api/flows`, {
      headers,
      data: {
        name: 'Generated backend customer API',
        method: 'GET',
        path: '/v1/generated-customers/:id',
        nodes: [
          {
            id: 'request',
            type: 'request',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'response',
            type: 'response',
            position: { x: 350, y: 0 },
            config: { status: 200, body: { customer: '$input.params.id' } },
          },
        ],
        edges: [{ id: 'next', source: 'request', target: 'response' }],
      },
    })
    expect(created.status()).toBe(200)
    const flow = await created.json()
    expect(
      (
        await page.request.post(`${backend}/api/flows/${flow.id}/publish`, {
          headers,
          data: { revision: 1 },
        })
      ).status(),
    ).toBe(200)
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
    await page.getByLabel('Workspace token').fill(owner)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Generated backend', exact: true })
      .click()
    const panel = page.getByRole('region', {
      name: 'Generated backend',
      exact: true,
    })
    await expect(panel).toContainText('Published release · revision 1')
    await expect(panel).toContainText('GET /run/v1/generated-customers/:id')
    await expect(panel.getByLabel('Generated backend code')).toBeVisible()
    await generatedBackendPreviews({
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
