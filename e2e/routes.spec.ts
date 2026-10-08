import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('versioned route forms and rollback preserve the edited draft', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-routes-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4318'
  const headers = { authorization: `Bearer ${token}` }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4318',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: token,
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
      await route.fulfill({
        response: await route.fetch({
          url: `${backend}${url.pathname}${url.search}`,
        }),
      })
    })
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v1/customers/:id')
    await expect(
      page.getByLabel('Path parameter id', { exact: true }),
    ).toBeVisible()
    await page.getByLabel('Path parameter id', { exact: true }).fill('42')
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await page
      .getByRole('checkbox', { name: 'Validate path parameters', exact: true })
      .check()
    await page
      .getByRole('combobox', { name: 'Path id type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'JSON response' })
      .click()
    await page.getByLabel('Field name 1', { exact: true }).fill('id')
    await page
      .getByRole('combobox', { name: 'Field type 1', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'From path parameter', exact: true })
      .click()
    await page.getByLabel('Field value 1', { exact: true }).fill('id')
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText('"id": 42')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    const flow = (
      await (await page.request.get(`${backend}/api/flows`, { headers })).json()
    )[0]
    const key = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'Route caller',
          flowId: flow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    const runtimeHeaders = { authorization: `Bearer ${key.token}` }
    expect(
      await (
        await page.request.get(`${backend}/run/v1/customers/42`, {
          headers: runtimeHeaders,
        })
      ).json(),
    ).toEqual({ id: 42 })
    await page
      .getByRole('button', { name: 'Load testing', exact: true })
      .click()
    await expect(
      page.getByLabel('Path parameter id', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Enter a value for every path parameter',
    )
    await page.getByLabel('Path parameter id', { exact: true }).fill('42')
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Load test results' }),
    ).toContainText('All limits passed', { timeout: 20_000 })
    await page.getByRole('button', { name: /^API Studio/ }).click()
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v2/customers/:id')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    await page.getByLabel('API name', { exact: true }).fill('Unsaved name')
    await page
      .getByRole('button', { name: 'Release history', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Review release 1', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Release review' }),
    ).toContainText('/run/v1/customers/:id')
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Confirm rollback' }),
    ).toContainText('/run/v1/customers/:id')
    await page
      .getByRole('button', { name: 'Cancel rollback', exact: true })
      .click()
    expect(
      (
        await page.request.get(`${backend}/run/v2/customers/42`, {
          headers: runtimeHeaders,
        })
      ).status(),
    ).toBe(200)
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Confirm rollback', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('Rolled back')
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'Unsaved name',
    )
    await expect(page.getByLabel('Endpoint path', { exact: true })).toHaveValue(
      '/v2/customers/:id',
    )
    await expect(
      page.getByText('Unsaved changes', { exact: true }),
    ).toBeVisible()
    expect(
      await (
        await page.request.get(`${backend}/run/v1/customers/7`, {
          headers: runtimeHeaders,
        })
      ).json(),
    ).toEqual({ id: 7 })
    expect(
      (
        await page.request.get(`${backend}/run/v2/customers/7`, {
          headers: runtimeHeaders,
        })
      ).status(),
    ).toBe(404)
    const saved = await (
      await page.request.get(`${backend}/api/flows/${flow.id}`, { headers })
    ).json()
    expect(saved.path).toBe('/v2/customers/:id')
    await page
      .getByRole('button', { name: 'Review release 2', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Roll back to release 2', exact: true })
      .click()
    await page.request.post(`${backend}/api/flows/${flow.id}/publish`, {
      headers,
      data: { revision: 2 },
    })
    await page
      .getByRole('button', { name: 'Confirm rollback', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Confirm rollback' }).getByRole('alert'),
    ).toContainText(/changed|current|published/i)
    await page
      .getByRole('button', { name: 'Cancel rollback', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Refresh releases', exact: true })
      .click()
    await expect(
      page.getByLabel('Published endpoint URL', { exact: true }),
    ).toHaveValue(/\/run\/v2\/customers\/:id$/)
    let deliver!: () => void
    const delivery = new Promise<void>((resolve) => {
      deliver = resolve
    })
    let received!: () => void
    const receipt = new Promise<void>((resolve) => {
      received = resolve
    })
    let rollbackRequests = 0
    await page.route('**/api/flows/*/rollback', async (route) => {
      rollbackRequests++
      const response = await route.fetch({
        url: `${backend}${new URL(route.request().url()).pathname}`,
      })
      received()
      await delivery
      await route.fulfill({ response })
    })
    await page
      .getByRole('button', { name: 'Review release 1', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Cancel rollback', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(
      page.getByRole('button', { name: 'Confirm rollback', exact: true }),
    ).toBeFocused()
    await page
      .getByRole('button', { name: 'Confirm rollback', exact: true })
      .click()
    await receipt
    await expect(
      page.getByRole('button', { name: 'Rolling back…', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Cancel rollback', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'New API', exact: true }),
    ).toBeDisabled()
    deliver()
    await expect(page.getByRole('status')).toContainText('Rolled back')
    expect(rollbackRequests).toBe(1)
    await page.unroute('**/api/flows/*/rollback')
    for (const theme of ['Light', 'Dark']) {
      await page
        .getByRole('combobox', { name: 'Appearance', exact: true })
        .click()
      await page.getByRole('option', { name: theme, exact: true }).click()
      await expect(
        page.getByRole('button', { name: 'Review release 1', exact: true }),
      ).toBeVisible()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await expect(
      page.locator(
        'select:visible, input[type="checkbox"]:visible, input[type="radio"]:visible',
      ),
    ).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v2/customers')
    const pathRules = page.getByRole('checkbox', {
      name: 'Validate path parameters',
      exact: true,
    })
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await expect(pathRules).toBeEnabled()
    page.once('dialog', (dialog) => dialog.accept())
    await pathRules.uncheck()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    for (const role of ['editor', 'viewer']) {
      const member = await (
        await page.request.post(`${backend}/api/members`, {
          headers,
          data: { name: `Route ${role}`, role },
        })
      ).json()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByLabel('Workspace token').fill(member.token)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Release history', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Review release 2', exact: true })
        .click()
      await expect(
        page.getByRole('region', { name: 'Release review' }),
      ).toContainText('/run/v2/customers/:id')
      await expect(
        page.getByRole('button', { name: /^Roll back to release/ }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Publish', exact: true }),
      ).toBeDisabled()
      expect(
        (
          await page.request.post(`${backend}/api/flows/${flow.id}/rollback`, {
            headers: { authorization: `Bearer ${member.token}` },
            data: { revision: 2, publishedRevision: 1 },
          })
        ).status(),
      ).toBe(403)
    }
    expect(errors).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
