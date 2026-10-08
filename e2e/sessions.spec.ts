import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('workspace sign-in restores sessions, supports email, and revokes browser access', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const directory = mkdtempSync(join(tmpdir(), 'besh-session-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4313'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4313',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_ADMIN_TOKEN: token,
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
    const forward = async (target: typeof page) =>
      target.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (!/^\/(auth\/|api\/|setup\/|health$)/.test(url.pathname)) {
          await route.continue()
          return
        }
        const response = await route.fetch({
          url: `${backend}${url.pathname}${url.search}`,
        })
        await route.fulfill({ response })
      })
    await forward(page)
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await page
      .getByLabel('Member name', { exact: true })
      .fill('Session reviewer')
    await expect(
      page.getByLabel('Member email (optional)', { exact: true }),
    ).toBeVisible()
    await page
      .getByLabel('Member email (optional)', { exact: true })
      .fill('viewer@example.test')
    await page
      .getByLabel('Member password', { exact: true })
      .fill('Viewer password 123!')
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    await expect(page.getByLabel('New member token')).toBeVisible()
    const reviewer = await browser.newContext({
      baseURL: 'http://127.0.0.1:5179',
    })
    const otherPage = await reviewer.newPage()
    otherPage.on('pageerror', (error) => errors.push(error.message))
    await forward(otherPage)
    await otherPage.goto('/')
    await otherPage
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await otherPage
      .getByLabel('Email', { exact: true })
      .fill('viewer@example.test')
    await otherPage
      .getByLabel('Password', { exact: true })
      .fill('Viewer password 123!')
    await otherPage
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      otherPage.getByRole('heading', { name: /^API Studio/ }),
    ).toBeVisible()
    await otherPage
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    await expect(
      otherPage.getByRole('row', { name: /Session reviewer.*This device/ }),
    ).toBeVisible()
    await expect(otherPage.getByRole('row', { name: /Owner/ })).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    await expect(
      page.getByRole('row', {
        name: /Session reviewer.*Other browser session/,
      }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', {
        name: 'Revoke session for Session reviewer',
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('row', {
        name: /Session reviewer.*Other browser session/,
      }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', {
        name: 'Revoke session for Session reviewer',
        exact: true,
      })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Browser session revoked',
    )
    await otherPage
      .getByRole('button', { name: 'Refresh sessions', exact: true })
      .click()
    await expect(otherPage.getByLabel('Workspace token')).toBeVisible()
    await expect(otherPage.getByRole('status')).toContainText(
      'session expired or was revoked',
    )
    await otherPage
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await otherPage
      .getByLabel('Email', { exact: true })
      .fill('viewer@example.test')
    await otherPage
      .getByLabel('Password', { exact: true })
      .fill('Viewer password 123!')
    await otherPage
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await otherPage
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    otherPage.once('dialog', (dialog) => dialog.accept())
    await otherPage
      .getByRole('button', {
        name: 'Revoke session for Session reviewer on this device',
        exact: true,
      })
      .click()
    await expect(otherPage.getByLabel('Workspace token')).toBeVisible()
    await otherPage
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await otherPage
      .getByLabel('Email', { exact: true })
      .fill('viewer@example.test')
    await otherPage
      .getByLabel('Password', { exact: true })
      .fill('Viewer password 123!')
    await otherPage
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      otherPage.getByRole('heading', { name: /^API Studio/ }),
    ).toBeVisible()
    await otherPage
      .getByRole('button', { name: 'Sign out', exact: true })
      .click()
    await expect(otherPage.getByLabel('Workspace token')).toBeVisible()
    await reviewer.close()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key !== 'besh-theme'),
      ),
    ).toEqual([])
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([])
    await page
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    await page
      .getByLabel('Account email', { exact: true })
      .fill('owner@example.test')
    await page
      .getByLabel('New password', { exact: true })
      .fill('Owner password 123!')
    await page.getByLabel('Your workspace key', { exact: true }).fill(token)
    await page
      .getByRole('button', { name: 'Save sign-in details', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Sign-in details saved',
    )
    await expect(page.getByText('This device', { exact: true })).toBeVisible()
    await expect(page.getByText(/Session expires/)).toBeVisible()
    expect(
      (await page.context().cookies()).find(
        (cookie) => cookie.name === 'besh_session',
      )?.httpOnly,
    ).toBe(true)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await page.getByLabel('Email', { exact: true }).fill('owner@example.test')
    await page
      .getByLabel('Password', { exact: true })
      .fill('Owner password 123!')
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /^API Studio/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    await page
      .getByLabel('Account email', { exact: true })
      .fill('updated-owner@example.test')
    await page
      .getByLabel('New password', { exact: true })
      .fill('New owner password 123!')
    await page
      .getByRole('combobox', { name: 'Confirm your identity', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Current password', exact: true })
      .click()
    await page
      .getByLabel('Current password', { exact: true })
      .fill('Wrong password 123!')
    await page
      .getByRole('button', { name: 'Save sign-in details', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Current password or member key required',
    )
    const proofError = page
      .getByRole('alert')
      .filter({ hasText: 'Current password or member key required' })
    await expect(proofError).toBeInViewport()
    await page.setViewportSize({ width: 390, height: 844 })
    await page
      .getByRole('button', { name: 'Save sign-in details', exact: true })
      .click()
    await expect(proofError).toBeInViewport()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(
      page.getByLabel('Account email', { exact: true }),
    ).toBeVisible()
    await page
      .getByLabel('Current password', { exact: true })
      .fill('Owner password 123!')
    await page
      .getByRole('button', { name: 'Save sign-in details', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Sign-in details saved',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(
      page.getByLabel('Account email', { exact: true }),
    ).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1000 })
    const rejectLogout = async (route: import('@playwright/test').Route) =>
      route.abort('failed')
    await page.route('**/auth/logout', rejectLogout)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Failed to fetch')
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    expect((await page.request.get(`${backend}/auth/session`)).status()).toBe(
      200,
    )
    await page.unroute('**/auth/logout', rejectLogout)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByLabel('Workspace token')).toBeVisible()
    expect(errors).toEqual([])
    expect((await page.request.get(`${backend}/auth/session`)).status()).toBe(
      401,
    )
    await page.reload()
    await expect(page.getByLabel('Workspace token')).toBeVisible()
    await page
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await page
      .getByLabel('Email', { exact: true })
      .fill('updated-owner@example.test')
    await page
      .getByLabel('Password', { exact: true })
      .fill('Owner password 123!')
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('Invalid credentials')
    await page
      .getByLabel('Password', { exact: true })
      .fill('New owner password 123!')
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    const restored = await (
      await page.request.get(`${backend}/auth/session`)
    ).json()
    expect(
      (
        await page.request.delete(
          `${backend}/api/sessions/${restored.sessionId}`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        )
      ).status(),
    ).toBe(200)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByLabel('Workspace token')).toBeVisible()
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
