import { expect, test } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { databasePreviews } from './database-preview'

test('owners upload a read-only SQLite copy and preview real table rows', async ({
  page,
}) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-database-browser-'))
  const file = join(directory, 'customers.sqlite')
  const fixture = spawnSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    import { writeFileSync } from 'node:fs'
    const database = new Database(':memory:')
    database.exec('CREATE TABLE customers (id INTEGER, name TEXT, city TEXT NOT NULL)')
    database.query('INSERT INTO customers VALUES (?, ?, ?)').run(1, 'Ada', 'London')
    database.query('INSERT INTO customers VALUES (?, ?, ?)').run(2, 'Grace', 'New York')
    database.exec('CREATE TABLE empty_rows (id INTEGER, name TEXT)')
    database.exec('CREATE TABLE flags (enabled BOOLEAN, label TEXT)')
    database.query('INSERT INTO flags VALUES (?, ?)').run(1, 'Enabled flag')
    database.query('INSERT INTO flags VALUES (?, ?)').run(0, 'Disabled flag')
    writeFileSync(process.argv[1], database.serialize())
    database.close()
  `,
      file,
    ],
    { windowsHide: true },
  )
  expect(fixture.status).toBe(0)
  expect(readFileSync(file).subarray(0, 16).toString()).toBe(
    'SQLite format 3\0',
  )
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4321'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4321',
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
      await route.continue({ url: `${backend}${url.pathname}${url.search}` })
    })
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    let releaseMetadata!: () => void
    const metadataGate = new Promise<void>((resolve) => {
      releaseMetadata = resolve
    })
    let initialList = true
    await page.route('**/api/database-connections', async (route) => {
      if (route.request().method() !== 'GET' || !initialList)
        return route.fallback()
      initialList = false
      const response = await route.fetch({
        url: `${backend}/api/database-connections`,
      })
      await metadataGate
      await route.fulfill({ response })
    })
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Database connections', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'This is an uploaded read-only copy. Changes to your original database are not synced.',
      ),
    ).toBeVisible()
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Customer copy')
    await page.getByLabel('SQLite file', { exact: true }).setInputFiles(file)
    await page
      .getByRole('button', { name: 'Upload read-only copy', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('SQLite copy uploaded')
    await expect(
      page.getByRole('button', { name: 'Preview rows', exact: true }),
    ).toBeEnabled()
    releaseMetadata()
    await page.unroute('**/api/database-connections')
    await expect(
      page.getByRole('combobox', { name: 'Table', exact: true }),
    ).toContainText('customers')
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    const rows = page.getByRole('region', {
      name: 'Database row preview',
      exact: true,
    })
    await expect(rows).toContainText('Ada')
    await expect(rows).toContainText('Grace')
    await expect(rows).toContainText('London')
    await page
      .getByRole('checkbox', { name: 'Filter rows', exact: true })
      .click()
    await page
      .getByRole('combobox', { name: 'Filter column', exact: true })
      .click()
    await page.getByRole('option', { name: 'city', exact: true }).click()
    await page.getByLabel('Equals value', { exact: true }).fill('London')
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await expect(rows).toContainText('Ada')
    await expect(rows).not.toContainText('Grace')
    await page
      .getByRole('checkbox', { name: 'Include id', exact: true })
      .click()
    await page.getByLabel('API name', { exact: true }).fill('Customer REST')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v1/database-customers')
    await page.getByLabel('Filter input name', { exact: true }).fill('city')
    await page
      .getByRole('button', { name: 'Create API draft', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /^API Studio/ }),
    ).toBeVisible()
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'Customer REST',
    )
    await page
      .getByRole('button', { name: 'Add query parameter', exact: true })
      .click()
    await page.getByLabel('Query name 1', { exact: true }).fill('city')
    await page.getByLabel('Query value 1', { exact: true }).fill('London')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Test complete')
    const result = page.getByTestId('test-result')
    await expect(result).toContainText('Ada')
    await expect(result).not.toContainText('Grace')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    const headers = { authorization: `Bearer ${token}` }
    const saved = (
      await (await page.request.get(`${backend}/api/flows`, { headers })).json()
    ).find((flow: { name: string }) => flow.name === 'Customer REST')
    const issued = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'Database reader',
          flowId: saved.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    ).json()
    const live = await page.request.get(
      `${backend}/run/v1/database-customers?city=London`,
      { headers: { authorization: `Bearer ${issued.token}` } },
    )
    expect(live.status()).toBe(200)
    expect(await live.json()).toEqual([{ name: 'Ada', city: 'London' }])
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await page.getByRole('combobox', { name: 'Table', exact: true }).click()
    await page.getByRole('option', { name: 'empty_rows', exact: true }).click()
    await expect(
      page.getByRole('checkbox', { name: 'Filter rows', exact: true }),
    ).not.toBeChecked()
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await expect(rows).toContainText('No matching rows')
    await page.getByRole('combobox', { name: 'Table', exact: true }).click()
    await page.getByRole('option', { name: 'flags', exact: true }).click()
    await page
      .getByRole('checkbox', { name: 'Filter rows', exact: true })
      .click()
    await expect(
      page.getByRole('combobox', { name: 'Equals value', exact: true }),
    ).toContainText('True')
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await expect(rows).toContainText('Enabled flag')
    await expect(rows).not.toContainText('Disabled flag')
    await page.getByRole('combobox', { name: 'Table', exact: true }).click()
    await page.getByRole('option', { name: 'customers', exact: true }).click()
    await page.getByLabel('API name', { exact: true }).fill('Customer GraphQL')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v1/database-graphql')
    await page.getByRole('combobox', { name: 'API type', exact: true }).click()
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await page
      .getByRole('button', { name: 'Create API draft', exact: true })
      .click()
    await expect(
      page.getByLabel('GraphQL operation', { exact: true }),
    ).toHaveValue('{ rows { id name city } }')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      'GraphQL test complete',
    )
    await expect(result).toContainText('Grace')
    await expect(
      page.getByRole('button', { name: 'SQLite rows', exact: true }),
    ).toBeVisible()
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'SQLite rows' })
      .click()
    const inspector = page.locator('.inspector')
    await expect(
      inspector.getByRole('combobox', {
        name: 'Database connection',
        exact: true,
      }),
    ).toContainText('Customer copy')
    await expect(
      inspector.getByRole('combobox', { name: 'Table', exact: true }),
    ).toContainText('customers')
    await inspector
      .getByRole('checkbox', { name: 'Include city', exact: true })
      .click()
    await inspector
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Configuration applied',
    )
    await expect(inspector).toContainText(
      'does not rewrite API rules or the GraphQL schema',
    )
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(result).toContainText('GraphQL field could not be resolved')
    await inspector
      .getByRole('checkbox', { name: 'Include city', exact: true })
      .click()
    await inspector
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(result).toContainText('Grace')
    await expect(result).not.toContainText(
      'GraphQL field could not be resolved',
    )
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'JSON response' })
      .click()
    await expect(
      inspector.getByRole('combobox', {
        name: 'Response contents',
        exact: true,
      }),
    ).toContainText('Rows from data step')
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Check SQLite copy', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('SQLite copy checked')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete database connection', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('referenced')
    const databaseReads: string[] = []
    let recordReads = false
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname
      if (
        recordReads &&
        request.method() === 'GET' &&
        /^\/api\/(database-connections|flows)(\/|$)/.test(path)
      )
        databaseReads.push(path)
    })
    async function member(name: string, permissions: string[]) {
      const role = await (
        await page.request.post(`${backend}/api/roles`, {
          headers,
          data: { name, permissions },
        })
      ).json()
      return await (
        await page.request.post(`${backend}/api/members`, {
          headers,
          data: { name, role: 'custom', roleId: role.id },
        })
      ).json()
    }
    async function login(key: string) {
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByLabel('Workspace token').fill(key)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Sign out', exact: true }),
      ).toBeVisible()
    }
    const reader = await member('SQLite reader', ['database-connections.read'])
    await login(reader.token)
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Upload read-only copy', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Check SQLite copy', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', {
        name: 'Delete database connection',
        exact: true,
      }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Create API draft', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await expect(rows).toContainText('Ada')
    const manager = await member('SQLite manager', [
      'database-connections.manage',
    ])
    await login(manager.token)
    recordReads = true
    databaseReads.length = 0
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Manage-only uploaded copy')
    await page.getByLabel('SQLite file', { exact: true }).setInputFiles(file)
    await page
      .getByRole('button', { name: 'Upload read-only copy', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('SQLite copy uploaded')
    await expect(
      page.getByRole('button', { name: 'Preview rows', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Check SQLite copy', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('SQLite copy checked')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Delete database connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: 'Manage-only uploaded copy',
        exact: true,
      }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete database connection', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Database connection deleted',
    )
    expect(databaseReads).toEqual([])
    recordReads = false
    const generator = await member('SQLite generator', [
      'database-connections.read',
      'flows.write',
    ])
    await login(generator.token)
    recordReads = true
    databaseReads.length = 0
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await page
      .getByLabel('API name', { exact: true })
      .fill('Readless generated draft')
    await page
      .getByRole('button', { name: 'Create API draft', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Read APIs access is needed',
    )
    await expect(
      page.getByRole('heading', { name: 'Database connections', exact: true }),
    ).toBeVisible()
    expect(databaseReads.some((path) => path.startsWith('/api/flows'))).toBe(
      false,
    )
    recordReads = false
    const tester = await member('SQLite configured-flow tester', [
      'flows.read',
      'flows.test',
    ])
    await login(tester.token)
    recordReads = true
    databaseReads.length = 0
    await page
      .getByRole('button', { name: 'Customer REST', exact: false })
      .click()
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'SQLite rows' })
      .click()
    await expect(page.locator('.inspector')).toContainText(
      'Read database connections access is needed',
    )
    await page
      .getByRole('button', { name: 'Add query parameter', exact: true })
      .click()
    await page.getByLabel('Query name 1', { exact: true }).fill('city')
    await page.getByLabel('Query value 1', { exact: true }).fill('London')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(result).toContainText('Ada')
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Permission required', exact: true }),
    ).toBeVisible()
    expect(
      databaseReads.filter((path) =>
        path.startsWith('/api/database-connections'),
      ),
    ).toEqual([])
    recordReads = false
    const editor = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: 'Built-in editor', role: 'editor' },
      })
    ).json()
    await login(editor.token)
    recordReads = true
    databaseReads.length = 0
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Permission required', exact: true }),
    ).toBeVisible()
    expect(databaseReads).toEqual([])
    recordReads = false
    await login(token)
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Check SQLite copy', exact: true }),
    ).toBeEnabled()
    let deliverCheck!: () => void
    let receiveCheck!: () => void
    const checkDelivery = new Promise<void>((resolve) => {
      deliverCheck = resolve
    })
    const checkReceipt = new Promise<void>((resolve) => {
      receiveCheck = resolve
    })
    await page.route('**/api/database-connections/*/check', async (route) => {
      const path = new URL(route.request().url()).pathname
      const response = await route.fetch({ url: `${backend}${path}` })
      receiveCheck()
      await checkDelivery
      await route.fulfill({ response })
    })
    await page
      .getByRole('button', { name: 'Check SQLite copy', exact: true })
      .click()
    await checkReceipt
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', {
        name: 'Delete database connection',
        exact: true,
      }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Check SQLite copy', exact: true }),
    ).toBeDisabled()
    deliverCheck()
    await expect(page.getByRole('status')).toContainText('SQLite copy checked')
    await page.unroute('**/api/database-connections/*/check')
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Invalid local copy')
    await page.getByLabel('SQLite file', { exact: true }).setInputFiles({
      name: 'invalid.sqlite',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('ordinary text, not a SQLite database'),
    })
    await page
      .getByRole('button', { name: 'Upload read-only copy', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('SQLite')
    await expect(
      page.getByLabel('Connection name', { exact: true }),
    ).toHaveValue('Invalid local copy')
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Stale removable copy')
    await page.getByLabel('SQLite file', { exact: true }).setInputFiles(file)
    await page
      .getByRole('button', { name: 'Upload read-only copy', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('SQLite copy uploaded')
    const copies = await (
      await page.request.get(`${backend}/api/database-connections`, { headers })
    ).json()
    const stale = copies.find(
      (copy: { name: string }) => copy.name === 'Stale removable copy',
    )
    expect(
      (
        await page.request.delete(
          `${backend}/api/database-connections/${stale.id}`,
          {
            headers,
            data: { version: stale.version },
          },
        )
      ).status(),
    ).toBe(200)
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('not found')
    await expect(
      page.getByRole('combobox', { name: 'Database connection', exact: true }),
    ).toContainText('Stale removable copy')
    await page
      .getByRole('button', { name: 'Refresh connections', exact: true })
      .click()
    await expect(
      page.getByRole('combobox', { name: 'Database connection', exact: true }),
    ).toContainText('Customer copy')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText(
      'Database connections refreshed',
    )
    await page.getByRole('button', { name: /^API Studio/ }).click()
    await page
      .getByLabel('API name', { exact: true })
      .fill('Unsaved SQLite idea')
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Discard unsaved draft changes')
      return dialog.dismiss()
    })
    await page
      .getByRole('button', { name: 'Create API draft', exact: true })
      .click()
    await page.getByRole('button', { name: /^API Studio/ }).click()
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'Unsaved SQLite idea',
    )
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Preview rows', exact: true })
      .click()
    await page.setViewportSize({ width: 390, height: 640 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await expect(rows).toContainText('Ada')
    await page.getByRole('button', { name: 'What’s next', exact: true }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByLabel('Workspace token')).toBeVisible()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()
    await databasePreviews({
      page,
      directory,
      owner: token,
      apiOrigin: backend,
      capture: async () => {},
    })
  } finally {
    server.kill()
    await stopped
    await page.close()
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    })
  }
})
