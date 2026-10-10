import { openApiTools } from './api-tools'
import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { helloFlow } from '../test/fixtures'

test.describe.configure({ lock: 'native-k6' })

test('owners manage custom roles and account-only members sign in safely', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-roles-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4319'
  const headers = { authorization: `Bearer ${token}` }
  const errors: string[] = []
  const privateReads: string[] = []
  let accountOnly = false
  page.on('pageerror', (error) => errors.push(error.message))
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4319',
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
    const seeded = await (
      await page.request.post(`${backend}/api/flows`, {
        headers,
        data: helloFlow,
      })
    ).json()
    await page.request.post(`${backend}/api/flows/${seeded.id}/publish`, {
      headers,
      data: { revision: 1 },
    })
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (
        accountOnly &&
        /^\/api\/(flows|roles|members|data-sources|auth-connections|runtime-keys|audit|backups|migrations|load-tests)(\/|$)/.test(
          url.pathname,
        )
      )
        privateReads.push(url.pathname)
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
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 640 },
    ]) {
      await page.setViewportSize(viewport)
      const signOut = page.getByRole('button', {
        name: 'Sign out',
        exact: true,
      })
      const fullyVisible = () =>
        signOut.evaluate((button) => {
          const bounds = button.getBoundingClientRect()
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight
        })
      await expect.poll(fullyVisible).toBe(true)
      await page.getByRole('button', { name: 'Updates', exact: true }).click()
      await page.keyboard.press('Tab')
      const lastPage = page.getByRole('button', {
        name: 'What’s next',
        exact: true,
      })
      await expect(lastPage).toBeFocused()
      await expect(lastPage).toBeInViewport()
      await page.keyboard.press('Enter')
      await expect(
        page.getByRole('heading', { name: 'What’s next Planned', exact: true }),
      ).toBeVisible()
      await expect.poll(fullyVisible).toBe(true)
      await signOut.click()
      await expect(page.getByLabel('Workspace token')).toBeVisible()
      await page.getByLabel('Workspace token').fill(token)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await page.getByRole('button', { name: 'New role', exact: true }).click()
    await page.getByLabel('Role name', { exact: true }).fill('Account only')
    await page.getByRole('button', { name: 'Save role', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Role created')
    await expect(
      page.getByRole('region', { name: 'Custom roles' }),
    ).toContainText('Account only')
    await page
      .getByLabel('Member name', { exact: true })
      .fill('Limited teammate')
    await page
      .getByRole('combobox', { name: 'Member role', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Account only · custom role', exact: true })
      .click()
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    const memberToken = await page
      .getByLabel('New member token', { exact: true })
      .inputValue()
    await page.getByRole('button', { name: 'I saved it', exact: true }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    accountOnly = true
    await page.getByLabel('Workspace token').fill(memberToken)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.user-profile')).toContainText('Account only')
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    for (const name of [
      'API Studio',
      'Data sources',
      'Product login',
      'API keys',
      'Audit trail',
      'Data & backups',
      'Load testing',
      'Members',
    ]) {
      await page
        .getByRole('button', {
          name: name === 'API Studio' ? /^API Studio/ : name,
          exact: name !== 'API Studio',
        })
        .click()
      await expect(
        page.getByRole('heading', {
          name: /access required|permission required/i,
        }),
      ).toBeVisible()
    }
    expect(privateReads).toEqual([])
    accountOnly = false
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete Account only', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
    ).toContainText(/assigned|reassign|use/i)
    const guestContext = await page.context().browser()!.newContext()
    const guest = await guestContext.newPage()
    await guest.route('**/*', async (route) => {
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
    try {
      await guest.goto('http://127.0.0.1:5179')
      await guest.getByLabel('Workspace token').fill(memberToken)
      await guest
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(
        guest.getByRole('heading', { name: 'Account & sessions', exact: true }),
      ).toBeVisible()
      await page
        .getByRole('button', { name: 'Edit Account only', exact: true })
        .click()
      await page
        .getByRole('checkbox', { name: 'Read APIs', exact: true })
        .check()
      await page
        .getByRole('checkbox', { name: 'Test drafts', exact: true })
        .check()
      page.once('dialog', (dialog) => dialog.dismiss())
      await page.getByRole('button', { name: 'Save role', exact: true }).click()
      await expect(page.getByLabel('Role name', { exact: true })).toBeVisible()
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Save role', exact: true }).click()
      await expect(page.getByRole('status')).toContainText('Role updated')
      await guest
        .getByRole('button', { name: 'Refresh sessions', exact: true })
        .click()
      await expect(guest.getByLabel('Workspace token')).toBeVisible()
      await guest.getByLabel('Workspace token').fill(memberToken)
      await guest
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(guest.getByTestId('flow-canvas')).toBeVisible()
      await expect(
        guest.getByRole('button', { name: 'Save draft', exact: true }),
      ).toBeDisabled()
      await expect(
        guest.getByRole('button', { name: 'Publish', exact: true }),
      ).toBeDisabled()
      await expect(
        guest.getByRole('button', { name: 'Test flow', exact: true }),
      ).toBeEnabled()
      await guest
        .getByRole('button', { name: 'Test flow', exact: true })
        .click()
      await expect(guest.getByTestId('test-result')).toContainText(
        'Hello, Besh!',
      )
      const roles = await (
        await page.request.get(`${backend}/api/roles`, { headers })
      ).json()
      const custom = roles.find(
        (role: { name: string }) => role.name === 'Account only',
      )
      await page
        .getByRole('button', { name: 'Edit Account only', exact: true })
        .click()
      await page
        .getByLabel('Role name', { exact: true })
        .fill('Stale local name')
      await page.request.put(`${backend}/api/roles/${custom.id}`, {
        headers,
        data: {
          name: 'Draft tester',
          permissions: custom.permissions,
          version: custom.version,
        },
      })
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Save role', exact: true }).click()
      await expect(
        page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
      ).toContainText(/changed|version|conflict/i)
      await expect(page.getByLabel('Role name', { exact: true })).toHaveValue(
        'Stale local name',
      )
      await page
        .getByRole('button', { name: 'Cancel role changes', exact: true })
        .click()
      await page.getByRole('button', { name: 'Refresh', exact: true }).click()
      await expect(
        page.getByRole('button', { name: 'Edit Draft tester', exact: true }),
      ).toBeVisible()
      const memberRow = page
        .getByRole('row')
        .filter({ hasText: 'Limited teammate' })
      await memberRow
        .getByRole('combobox', {
          name: 'Role for Limited teammate',
          exact: true,
        })
        .click()
      await page
        .getByRole('option', { name: 'Viewer · read APIs', exact: true })
        .click()
      page.once('dialog', (dialog) => dialog.dismiss())
      await memberRow
        .getByRole('button', { name: 'Change role', exact: true })
        .click()
      await expect(memberRow).toContainText('Draft tester')
      let deliver!: () => void
      const delivery = new Promise<void>((resolve) => {
        deliver = resolve
      })
      let received!: () => void
      const receipt = new Promise<void>((resolve) => {
        received = resolve
      })
      let assignments = 0
      await page.route('**/api/members/*/role', async (route) => {
        assignments++
        const response = await route.fetch({
          url: `${backend}${new URL(route.request().url()).pathname}`,
        })
        received()
        await delivery
        await route.fulfill({ response })
      })
      page.once('dialog', (dialog) => dialog.accept())
      await memberRow
        .getByRole('button', { name: 'Change role', exact: true })
        .click()
      await receipt
      await expect(
        page.getByRole('button', { name: 'New API', exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByRole('button', { name: 'Sign out', exact: true }),
      ).toBeDisabled()
      await expect(
        memberRow.getByRole('button', { name: 'Change role', exact: true }),
      ).toBeDisabled()
      deliver()
      await expect(page.getByRole('status')).toContainText(
        'Member role updated',
      )
      expect(assignments).toBe(1)
      await page.unroute('**/api/members/*/role')
      await expect(memberRow).toContainText('viewer')
      page.once('dialog', (dialog) => dialog.accept())
      await page
        .getByRole('button', { name: 'Delete Draft tester', exact: true })
        .click()
      await expect(page.getByRole('status')).toContainText('Role deleted')
      for (const theme of ['Light', 'Dark']) {
        await page
          .getByRole('combobox', { name: 'Appearance', exact: true })
          .click()
        await page.getByRole('option', { name: theme, exact: true }).click()
        await page
          .getByRole('button', { name: 'New role', exact: true })
          .click()
        await page
          .getByRole('checkbox', {
            name: 'Manage workspace backups',
            exact: true,
          })
          .focus()
        await page.keyboard.press('Space')
        await page
          .getByRole('checkbox', { name: 'Run load tests', exact: true })
          .check()
        await expect(
          page.getByText(/Backup access exposes the entire workspace/),
        ).toBeVisible()
        await expect(
          page.getByText(/Load testing repeatedly executes live APIs/),
        ).toBeVisible()
        await page
          .getByRole('button', { name: 'Cancel role changes', exact: true })
          .click()
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await page.getByRole('button', { name: 'New role', exact: true }).click()
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
      await page
        .getByRole('button', { name: 'Cancel role changes', exact: true })
        .click()
    } finally {
      await guestContext.close()
    }
    expect(errors).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})

test('delegated operators manage keys and run tests without API read access', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-roles-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4319'
  const headers = { authorization: `Bearer ${token}` }
  const errors: string[] = []
  const privateReads: string[] = []
  const rowAccessReads: {
    path: string
    source: string | null
    metadata: unknown
  }[] = []
  let accountOnly = false
  page.on('pageerror', (error) => errors.push(error.message))
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4319',
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
    const seeded = await (
      await page.request.post(`${backend}/api/flows`, {
        headers,
        data: helloFlow,
      })
    ).json()
    await page.request.post(`${backend}/api/flows/${seeded.id}/publish`, {
      headers,
      data: { revision: 1 },
    })
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const rowAccess = /^\/api\/flows\/[^/]+\/row-access$/.test(url.pathname)
      if (
        accountOnly &&
        !rowAccess &&
        /^\/api\/(flows|roles|members|data-sources|auth-connections|runtime-keys|audit|backups|migrations|load-tests)(\/|$)/.test(
          url.pathname,
        )
      )
        privateReads.push(url.pathname)
      if (
        !/^\/(api\/|auth\/|setup\/|health$|run\/|graphql\/)/.test(url.pathname)
      )
        return route.continue()
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
      })
      if (accountOnly && rowAccess)
        rowAccessReads.push({
          path: url.pathname,
          source: url.searchParams.get('source'),
          metadata: await response.json(),
        })
      await route.fulfill({ response })
    })
    const custom = await (
      await page.request.post(`${backend}/api/roles`, {
        headers,
        data: {
          name: 'Scoped operator',
          permissions: [
            'runtime-keys.manage',
            'sources.read',
            'auth-connections.read',
            'audit.read',
            'migrations.read',
            'load-tests.run',
          ],
        },
      })
    ).json()
    const member = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: 'Operator', role: 'custom', roleId: custom.id },
      })
    ).json()
    const key = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'Operator caller',
          flowId: seeded.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    await page.request.post(`${backend}/api/data-sources/import`, {
      headers,
      multipart: {
        name: 'Operator source',
        file: {
          name: 'rows.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('id,name\n1,Ada\n'),
        },
      },
    })
    accountOnly = true
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(member.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await expect(
      page.getByRole('heading', {
        name: 'API reading needed for new key choices',
        exact: true,
      }),
    ).toBeVisible()
    const keyRow = page.getByRole('row').filter({ hasText: 'Operator caller' })
    await expect(keyRow).toContainText(`API ${seeded.id.slice(0, 8)}`)
    page.once('dialog', (dialog) => dialog.accept())
    await keyRow
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    const replacement = await page
      .getByLabel('New API key', { exact: true })
      .inputValue()
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${key.token}` },
        })
      ).status(),
    ).toBe(401)
    expect(
      await (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${replacement}` },
        })
      ).json(),
    ).toEqual({ message: 'Hello, Besh!' })
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await expect(
      page.getByRole('cell', { name: 'Ada', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Import spreadsheet', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Delete data source', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Create API from data', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /GitHub product login/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Connect GitHub', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Audit trail', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Audit trail', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Data & backups', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Migration history', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create backup', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Load testing', exact: true })
      .click()
    await expect(
      page.getByRole('combobox', { name: 'Published API', exact: true }),
    ).toContainText('Hello API')
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
    expect(
      privateReads.filter((path) =>
        /^\/api\/(flows|backups|roles|members)(\/|$)/.test(path),
      ),
    ).toEqual([])
    expect(rowAccessReads.length).toBeGreaterThan(0)
    for (const read of rowAccessReads)
      expect(read).toEqual({
        path: `/api/flows/${seeded.id}/row-access`,
        source: 'published',
        metadata: {
          source: 'published',
          revision: 1,
          required: false,
          supported: true,
        },
      })
    accountOnly = false
    const publisherRole = await (
      await page.request.post(`${backend}/api/roles`, {
        headers,
        data: {
          name: 'Publisher',
          permissions: ['flows.read', 'flows.publish'],
        },
      })
    ).json()
    const publisher = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: {
          name: 'Publisher teammate',
          role: 'custom',
          roleId: publisherRole.id,
        },
      })
    ).json()
    await page.request.put(`${backend}/api/flows/${seeded.id}`, {
      headers,
      data: { ...helloFlow, path: '/publisher-draft', revision: 1 },
    })
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(publisher.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Save draft', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Test flow', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    expect(
      (
        await page.request.get(`${backend}/run/publisher-draft`, {
          headers: { authorization: `Bearer ${replacement}` },
        })
      ).status(),
    ).toBe(200)
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Release history', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Review release 1', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Confirm rollback', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('Rolled back')
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${replacement}` },
        })
      ).status(),
    ).toBe(200)
    expect(errors).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
