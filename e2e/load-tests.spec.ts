import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { graphqlFlow, helloFlow } from '../test/fixtures'
import type { LoadTestRun } from '../src/load-tests/model'

test('owner tests live REST and GraphQL APIs, reviews limits, cancels, and restores history', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-load-browser-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4317'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4317',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((resolve) => {
    server.once('exit', () => resolve())
    server.once('error', () => resolve())
  })
  const headers = { authorization: `Bearer ${owner}` }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let starts = 0
  let loseList = false
  let delayStart = false
  let releaseStart = () => {}
  const startDelivered = new Promise<void>((resolve) => {
    releaseStart = resolve
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
      data: helloFlow,
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
      if (!/^\/(auth\/|api\/|setup\/|health$)/.test(url.pathname)) {
        await route.continue()
        return
      }
      if (
        url.pathname === '/api/load-tests' &&
        route.request().method() === 'POST'
      )
        starts++
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
      })
      if (
        loseList &&
        url.pathname === '/api/load-tests' &&
        route.request().method() === 'GET'
      ) {
        await route.abort('failed')
        return
      }
      if (
        delayStart &&
        url.pathname === '/api/load-tests' &&
        route.request().method() === 'POST'
      )
        await startDelivered
      await route.fulfill({ response })
    })
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(owner)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await page
      .getByRole('button', { name: 'Load testing', exact: true })
      .click()
    await expect(
      page.getByRole('combobox', { name: 'Published API', exact: true }),
    ).toContainText('Hello API')
    await expect(
      page.getByText('1 virtual user · 5 seconds', { exact: true }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    expect(starts).toBe(0)
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('LIVE')
      await dialog.accept()
    })
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    const results = page.getByRole('region', {
      name: 'Load test results',
      exact: true,
    })
    await expect(results).toContainText('Preparing k6 or running')
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeEnabled()
    await expect(results).toContainText('Completed', { timeout: 45_000 })
    const runs = await (
      await page.request.get(`${backend}/api/load-tests`, { headers })
    ).json()
    expect(runs).toHaveLength(1)
    expect(runs[0].config).toEqual({
      vus: 1,
      durationSeconds: 5,
      p95Ms: 1000,
      maxErrorRate: 0.01,
      expectedStatus: null,
    })
    expect(runs[0].summary.requests).toBeGreaterThan(0)
    expect(runs[0].summary.thresholdsPassed).toBe(true)
    expect(starts).toBe(1)
    await page.reload()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await page
      .getByRole('button', { name: 'Load testing', exact: true })
      .click()
    await expect(results).toContainText('Completed')
    await expect(
      page.getByRole('region', { name: 'Recent load tests', exact: true }),
    ).toContainText('Hello API')
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    const expected = page.getByRole('combobox', {
      name: 'Expected response',
      exact: true,
    })
    await expect(expected).toHaveJSProperty('tagName', 'BUTTON')
    await expected.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(expected).toBeFocused()
    await expected.click()
    await page
      .getByRole('option', { name: 'A specific status', exact: true })
      .click()
    await page.getByLabel('Expected status', { exact: true }).fill('201')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(results).toContainText('Some limits failed', {
      timeout: 15_000,
    })
    await expect(results).toContainText('status 201')
    await expect(results).toContainText('0.0%')

    const gqlCreated = await page.request.post(`${backend}/api/flows`, {
      headers,
      data: { ...graphqlFlow, path: '/load-greeting' },
    })
    expect(gqlCreated.status()).toBe(200)
    const gqlFlow = await gqlCreated.json()
    expect(
      (
        await page.request.post(`${backend}/api/flows/${gqlFlow.id}/publish`, {
          headers,
          data: { revision: 1 },
        })
      ).status(),
    ).toBe(200)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    const target = page.getByRole('combobox', {
      name: 'Published API',
      exact: true,
    })
    await target.click()
    await page
      .getByRole('option', { name: 'GraphQL greeting · GraphQL', exact: true })
      .click()
    const query = page.getByLabel('GraphQL query or mutation', { exact: true })
    await expect(query).toHaveValue(/greet\(name: "example"\)/)
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(results).toContainText('GraphQL greeting')
    await expect(results).toContainText('All limits passed', {
      timeout: 15_000,
    })
    await query.fill(
      'mutation Greeting($name: String!) { greet(name: $name) { message name } }',
    )
    await page.getByLabel('New variable name', { exact: true }).fill('name')
    await page
      .getByRole('button', { name: 'Add variable', exact: true })
      .click()
    await page.getByLabel('Variable name', { exact: true }).fill('Ada')
    await page
      .getByLabel('Operation name (optional)', { exact: true })
      .fill('Greeting')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(results).toContainText('Preparing k6 or running')
    await expect(results).toContainText('All limits passed', {
      timeout: 15_000,
    })
    const gqlRuns = await (
      await page.request.get(`${backend}/api/load-tests`, { headers })
    ).json()
    expect(gqlRuns[0].summary.requests).toBeGreaterThan(0)
    expect(gqlRuns[0].summary.checkRate).toBe(1)

    await query.fill('query { missing }')
    const beforeInvalid = starts
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('GraphQL')
    expect(starts).toBe(beforeInvalid + 1)
    expect(
      (
        await (
          await page.request.get(`${backend}/api/load-tests`, { headers })
        ).json()
      ).length,
    ).toBe(4)

    const restCreated = await page.request.post(`${backend}/api/flows`, {
      headers,
      data: {
        ...helloFlow,
        name: 'Body and query API',
        method: 'POST',
        path: '/load-inputs',
        contract: {
          body: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
          query: {
            type: 'object',
            properties: { mode: { type: 'string' } },
            required: ['mode'],
            additionalProperties: false,
          },
        },
      },
    })
    expect(restCreated.status()).toBe(200)
    const rest = await restCreated.json()
    expect(
      (
        await page.request.post(`${backend}/api/flows/${rest.id}/publish`, {
          headers,
          data: { revision: 1 },
        })
      ).status(),
    ).toBe(200)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await target.click()
    await page
      .getByRole('option', { name: 'Body and query API · POST', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Request inputs', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Add body field', exact: true })
      .click()
    await page.getByLabel('Body name 1', { exact: true }).fill('name')
    await page.getByLabel('Body value 1', { exact: true }).fill('Ada')
    await page
      .getByRole('button', { name: 'Add query parameter', exact: true })
      .click()
    await page.getByLabel('Query name 1', { exact: true }).fill('mode')
    await page.getByLabel('Query value 1', { exact: true }).fill('test')
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(results).toContainText('Body and query API')
    await expect(results).toContainText('All limits passed', {
      timeout: 15_000,
    })
    const restRuns = await (
      await page.request.get(`${backend}/api/load-tests`, { headers })
    ).json()
    expect(restRuns[0].summary.requests).toBeGreaterThan(0)
    expect(restRuns[0].summary.failedRequests).toBe(0)
    await page
      .getByRole('button', { name: 'Advanced request JSON', exact: true })
      .click()
    await page.getByLabel('Request JSON', { exact: true }).fill('{ broken')
    const beforeBroken = starts
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('body and query')
    expect(starts).toBe(beforeBroken)
    await target.click()
    await page
      .getByRole('option', { name: 'GraphQL greeting · GraphQL', exact: true })
      .click()
    await expect(query).toBeEnabled()
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()

    await query.fill('query { greet(name: "Ada") { message name } }')
    await page.getByLabel('Operation name (optional)', { exact: true }).fill('')
    await page.getByLabel('Duration in seconds', { exact: true }).fill('30')
    delayStart = true
    const beforePending = starts
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .evaluate((button) => (button as HTMLButtonElement).click())
    expect(starts).toBe(beforePending + 1)
    releaseStart()
    await expect(results).toContainText('Preparing k6 or running')
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'API Studio', exact: true }).click()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    const activeRuns = await (
      await page.request.get(`${backend}/api/load-tests`, { headers })
    ).json()
    const activeRun = activeRuns.find(
      (run: LoadTestRun) => run.status === 'running',
    )
    expect(activeRun).toBeTruthy()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    const managedKey = page
      .getByRole('row')
      .filter({ hasText: `Load test ${activeRun.id}` })
    await expect(managedKey).toContainText('Managed by load testing')
    await expect(
      managedKey.getByRole('button', { name: 'Replace key', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Load testing', exact: true })
      .click()
    await expect(results).toContainText('Preparing k6 or running')
    await page.getByRole('button', { name: 'Cancel run', exact: true }).click()
    await expect(results).toContainText('Canceled')
    const canceled = await (
      await page.request.get(`${backend}/api/load-tests`, { headers })
    ).json()
    expect(canceled[0].status).toBe('canceled')

    loseList = true
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Refresh')
    loseList = false
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)

    for (const theme of ['Light', 'Dark', 'System']) {
      await page
        .getByRole('combobox', { name: 'Appearance', exact: true })
        .click()
      await page.getByRole('option', { name: theme, exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Load testing k6', exact: true }),
      ).toBeVisible()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      page.locator(
        'select:visible, input[type="checkbox"]:visible, input[type="radio"]:visible',
      ),
    ).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const audit = await (
      await page.request.get(`${backend}/api/audit`, { headers })
    ).json()
    expect(
      audit.some(
        (event: { action: string }) => event.action === 'load-test.started',
      ),
    ).toBe(true)
    expect(
      audit.some(
        (event: { action: string }) => event.action === 'load-test.completed',
      ),
    ).toBe(true)
    expect(
      audit.some(
        (event: { action: string }) => event.action === 'load-test.canceled',
      ),
    ).toBe(true)

    for (const role of ['editor', 'viewer']) {
      const memberResponse = await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: `Load ${role}`, role },
      })
      expect(memberResponse.status()).toBe(200)
      const member = await memberResponse.json()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByLabel('Workspace token').fill(member.token)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(page.getByTestId('flow-canvas')).toBeVisible()
      await page
        .getByRole('button', { name: 'Load testing', exact: true })
        .click()
      await expect(
        page.getByRole('heading', {
          name: 'Owner access required',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByText(
          `Your ${role} role cannot run or view workspace load tests. Ask an owner to test the published API.`,
          { exact: true },
        ),
      ).toBeVisible()
      expect(
        (
          await page.request.get(`${backend}/api/load-tests`, {
            headers: { authorization: `Bearer ${member.token}` },
          })
        ).status(),
      ).toBe(403)
    }
    expect(errors).toEqual([])
  } finally {
    server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
