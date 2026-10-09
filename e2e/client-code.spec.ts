import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clientCodePreviews } from './client-code-preview'

test('members generate saved API client examples without invoking the API', async ({
  page,
}) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-client-code-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4323'
  const headers = { authorization: `Bearer ${owner}` }
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4323',
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
    const created = await page.request.post(`${backend}/api/flows`, {
      headers,
      data: {
        name: 'Client examples',
        method: 'GET',
        path: '/v1/client-customers/:id',
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
            config: { status: 200, body: { id: '$input.params.id' } },
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
          data: { revision: flow.revision },
        })
      ).status(),
    ).toBe(200)
    let runtimeCalls = 0
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (/^\/(run|graphql)\//.test(url.pathname)) runtimeCalls++
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
    await page
      .getByRole('button', { name: 'Use this API', exact: true })
      .click()
    const panel = page.getByRole('region', {
      name: 'Use this API',
      exact: true,
    })
    await expect(
      panel.getByText('Published release · revision 1', { exact: true }),
    ).toBeVisible()
    await panel
      .getByLabel('Path parameter id', { exact: true })
      .fill('Ada Lovelace')
    await panel
      .getByRole('combobox', { name: 'Client language', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'JavaScript — Fetch', exact: true })
      .click()
    await panel
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    await expect(panel.getByLabel('Generated client code')).toContainText(
      '/run/v1/client-customers/Ada%20Lovelace',
    )
    await expect(panel.getByLabel('Generated client code')).toContainText(
      'BESH_RUNTIME_API_KEY',
    )
    expect(runtimeCalls).toBe(0)
    await clientCodePreviews({
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
