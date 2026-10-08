import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('owners save release settings and check notices without installing updates', async ({
  page,
}) => {
  test.setTimeout(60_000)
  page.setDefaultTimeout(5000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-updates-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4318'
  const headers = { authorization: `Bearer ${token}` }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const server = spawn('bun', ['e2e/updates-server.ts'], {
    env: {
      ...process.env,
      PORT: '4318',
      BESH_ADMIN_TOKEN: token,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_WEB_URL: 'http://127.0.0.1:5179',
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
      if (!/^\/(api\/|auth\/|setup\/|health$)/.test(url.pathname))
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
    await page.getByRole('button', { name: 'Updates', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Besh updates', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('No release check yet', { exact: true }),
    ).toBeVisible()
    await page
      .getByLabel('GitHub repository', { exact: true })
      .fill('https://github.com/example/besh.git')
    await page
      .getByRole('checkbox', { name: 'Include preview releases', exact: true })
      .uncheck()
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Update settings saved',
    )
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/besh')
    await page
      .getByRole('checkbox', { name: 'Include preview releases', exact: true })
      .check()
    await expect(
      page.getByRole('button', { name: 'Check releases', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Update settings saved',
    )
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(
      page.getByText('Update available', { exact: true }),
    ).toBeVisible()
    const release = page.getByRole('link', {
      name: 'View GitHub release',
      exact: true,
    })
    await expect(release).toHaveAttribute(
      'href',
      'https://github.com/example/besh/releases/tag/v0.99.0-beta.2',
    )
    await expect(release).toHaveAttribute('rel', /noopener/)
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('Wait one minute')
    await expect(
      page.getByText('Update available', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Updates', exact: true }).click()
    await expect(
      page.getByText('Update available', { exact: true }),
    ).toBeVisible()
    const settings = await (
      await page.request.get(`${backend}/api/updates`, { headers })
    ).json()
    await page.request.put(`${backend}/api/updates`, {
      headers,
      data: {
        ...settings.settings,
        updatedAt: undefined,
        repositoryUrl: 'https://github.com/example/changed',
      },
    })
    await page
      .getByLabel('GitHub repository', { exact: true })
      .fill('https://github.com/example/local')
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Update settings changed',
    )
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/local')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Refresh update settings', exact: true })
      .click()
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/changed')
    await expect(
      page.getByText('No release check yet', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByRole('heading', { name: 'Besh updates', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    expect(
      await page
        .locator(
          'input[type=checkbox]:visible, select:visible, input[type=radio]:visible',
        )
        .count(),
    ).toBe(0)
    expect(errors).toEqual([])
  } finally {
    await page.context().unrouteAll({ behavior: 'ignoreErrors' })
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
