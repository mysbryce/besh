import { expect, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import type { DatabaseConnection } from '../src/databases/model'
import type {
  AuthConnection,
  DataSource,
  Member,
  Role,
  RuntimeKey,
  SavedFlow,
} from '../web/lib/api'
import { helloFlow } from '../test/fixtures'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function scopedActionsPreviews({
  page,
  owner,
  capture,
  apiOrigin = '',
}: {
  page: Page
  owner: string
  capture: Capture
  apiOrigin?: string
}) {
  async function appearance(mode: 'Light' | 'Dark') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      mode.toLowerCase(),
    )
  }
  async function fitGraph() {
    await page.getByRole('button', { name: 'Fit View', exact: true }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
    await expect
      .poll(() =>
        page.locator('.canvas').evaluate((canvas) => {
          const bounds = canvas.getBoundingClientRect()
          return [...canvas.querySelectorAll('.react-flow__node')].every(
            (node) => {
              const box = node.getBoundingClientRect()
              return (
                box.left >= bounds.left &&
                box.right <= bounds.right &&
                box.top >= bounds.top &&
                box.bottom <= bounds.bottom
              )
            },
          )
        }),
      )
      .toBe(true)
  }
  async function management<T>(path: string, data: unknown) {
    const response = await page.request.post(`${apiOrigin}${path}`, {
      headers: { authorization: `Bearer ${owner}` },
      data,
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as T
  }
  const upload = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers: { authorization: `Bearer ${owner}` },
      multipart: {
        name: 'Selected customer spreadsheet',
        file: {
          name: 'customers.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('name,city\nAda,London\nGrace,New York\n'),
        },
      },
    },
  )
  expect(upload.status()).toBe(200)
  const source = (await upload.json()) as DataSource
  const flow = await management<SavedFlow>('/api/flows', {
    ...helloFlow,
    name: 'Selected operations customer API',
    path: `/v1/selected-operations-${crypto.randomUUID().slice(0, 8)}`,
    nodes: [
      helloFlow.nodes[0],
      {
        id: 'data',
        type: 'data',
        position: { x: 400, y: 100 },
        config: { sourceId: source.id, columns: ['name', 'city'], limit: 10 },
      },
      {
        ...helloFlow.nodes[1],
        position: { x: 720, y: 100 },
        config: { status: 200, body: '$data' },
      },
    ],
    edges: [
      { id: 'read', source: 'request', target: 'data' },
      { id: 'respond', source: 'data', target: 'response' },
    ],
  })
  await management(`/api/flows/${flow.id}/publish`, { revision: 1 })
  const sqlite = spawnSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const database = new Database(':memory:')
    database.run('CREATE TABLE customers (name TEXT NOT NULL, city TEXT NOT NULL)')
    database.query('INSERT INTO customers VALUES (?, ?)').run('Ada', 'London')
    database.query('INSERT INTO customers VALUES (?, ?)').run('Grace', 'New York')
    process.stdout.write(Buffer.from(database.serialize()))
    database.close()
  `,
    ],
    { windowsHide: true, timeout: 10000, maxBuffer: 2 * 1024 * 1024 },
  )
  expect(sqlite.status).toBe(0)
  const databaseUpload = await page.request.post(
    `${apiOrigin}/api/database-connections`,
    {
      headers: { authorization: `Bearer ${owner}` },
      multipart: {
        name: 'Selected customer SQLite copy',
        file: {
          name: 'customers.sqlite',
          mimeType: 'application/x-sqlite3',
          buffer: sqlite.stdout,
        },
      },
    },
  )
  expect(databaseUpload.status()).toBe(200)
  const database = (await databaseUpload.json()) as DatabaseConnection
  const databaseFlow = await management<SavedFlow>(
    `/api/database-connections/${database.id}/api`,
    {
      version: database.version,
      table: 'customers',
      name: 'Selected SQLite GraphQL API',
      path: `${flow.path}/graphql`,
      protocol: 'graphql',
      columns: ['name', 'city'],
      limit: 10,
    },
  )
  await management(`/api/flows/${databaseFlow.id}/publish`, {
    revision: databaseFlow.revision,
  })
  const auth = await management<AuthConnection>('/api/auth-connections', {
    name: 'Selected product GitHub app',
    provider: 'github',
    clientId: 'selected-demo-client',
    clientSecret: 'selected-demo-provider-secret',
    redirectUri: 'https://product.example/oauth/github',
  })
  const authFlow = await management<SavedFlow>(
    `/api/auth-connections/${auth.id}/generate`,
    {
      name: 'Selected product login API',
      path: `${flow.path}/login`,
      kind: 'rest',
    },
  )
  await management(`/api/flows/${authFlow.id}/publish`, {
    revision: authFlow.revision,
  })
  await management<Role>('/api/roles', {
    name: 'Selected API operator',
    permissions: [
      'flows.read',
      'flows.write',
      'flows.test',
      'flows.publish',
      'runtime-keys.manage',
      'load-tests.run',
    ],
  })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible({
    timeout: 10000,
  })
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await expect(
    page.getByText('Loading workspace records…', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  await page
    .getByRole('option', {
      name: 'Selected API operator · custom role',
      exact: true,
    })
    .click()
  await page
    .getByRole('combobox', { name: 'New member API access', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Selected APIs only', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', { name: `Share ${flow.name}`, exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('checkbox', { name: `Share ${flow.name}`, exact: true })
    .check()
  await page
    .getByRole('checkbox', { name: `Share ${databaseFlow.name}`, exact: true })
    .check()
  await page
    .getByRole('checkbox', { name: `Share ${authFlow.name}`, exact: true })
    .check()
  await capture(
    'Members',
    'Selected API action role',
    'Selected sharing supports explicit existing-API action grants without granting creation or global resource management.',
  )
  await page
    .getByLabel('Member name', { exact: true })
    .fill('Selected API collaborator')
  await expect(
    page.getByRole('checkbox', {
      name: `Use spreadsheet ${source.name}`,
      exact: true,
    }),
  ).toBeEnabled()
  await page
    .getByRole('checkbox', {
      name: `Use spreadsheet ${source.name}`,
      exact: true,
    })
    .check()
  await page
    .getByRole('checkbox', {
      name: `Use SQLite copy ${database.name}`,
      exact: true,
    })
    .check()
  await page
    .getByRole('checkbox', {
      name: `Use product login ${auth.name}`,
      exact: true,
    })
    .check()
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Member created')
  const response = await page.request.get(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  const collaborator = ((await response.json()) as Member[]).find(
    (member) => member.name === 'Selected API collaborator',
  )!
  expect(collaborator.access).toMatchObject({
    mode: 'selected',
    flowIds: [flow.id, databaseFlow.id, authFlow.id].sort(),
    dependencyUse: {
      sources: [source.id],
      databaseConnections: [database.id],
      authConnections: [auth.id],
    },
    version: 1,
  })
  const token = await page
    .getByLabel('New member token', { exact: true })
    .inputValue()
  await capture(
    'Members',
    'Selected operator member receipt',
    'The one-time member credential is masked; API actions and explicit dependency USE are assigned atomically.',
  )
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'New API', exact: true }),
  ).toBeDisabled()
  for (const name of [
    'Data sources',
    'Database connections',
    'Product login',
    'Members',
    'Audit trail',
    'Data & backups',
    'Updates',
  ])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  const privateReads: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      /^\/api\/(data-sources|database-connections|auth-connections)(\/|$)/.test(
        path,
      )
    )
      privateReads.push(path)
  })
  await page.locator('.api-list button').filter({ hasText: flow.name }).click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Data source', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('combobox', { name: 'Maximum rows', exact: true })
    .click()
  await page.getByRole('option', { name: '1', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await expect(page.getByTestId('test-result')).not.toContainText('Grace')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  expect(privateReads).toEqual([])
  await capture(
    'API Studio',
    'Selected spreadsheet USE and draft test',
    'A chosen existing API uses only an explicitly allowed structural source choice. Testing executes its real saved graph without granting global source previews.',
  )
  await page
    .locator('.api-list button')
    .filter({ hasText: databaseFlow.name })
    .click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'SQLite rows' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Database connection', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  expect(privateReads).toEqual([])
  await capture(
    'API Studio',
    'Selected SQLite USE and GraphQL test',
    'An allowed uploaded-copy schema supplies table/column choices without rows or file metadata. The real shared GraphQL draft test executes the chosen read.',
  )
  await page
    .locator('.api-list button')
    .filter({ hasText: authFlow.name })
    .click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'GitHub login' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'GitHub connection', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Test complete')
  expect(privateReads).toEqual([])
  await capture(
    'API Studio',
    'Selected product login USE',
    'Only the explicitly allowed provider name and structure are loaded. BEGIN prepares a real login attempt without contacting the provider; proofs are masked and no provider management is granted.',
  )
  await appearance('Dark')
  await fitGraph()
  await capture(
    'Appearance',
    'Dark selected login structure',
    'The provider selector contains only explicitly allowed structural names. Credentials stay on the server and generated login proofs remain masked.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await fitGraph()
  await capture(
    'Mobile dark',
    'Selected login USE phone',
    'All three graph nodes fit the phone canvas; the custom provider selector and USE explanation remain readable below it.',
  )
  await page.getByRole('combobox', { name: 'Saved API', exact: true }).click()
  await page
    .getByRole('option', { name: databaseFlow.name, exact: true })
    .click()
  await fitGraph()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'SQLite rows' })
    .click()
  await fitGraph()
  await capture(
    'Mobile dark',
    'Selected SQLite structure phone',
    'Allowed table and column choices expose structural metadata only. The SQLite reader remains separate from connection management.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light selected SQLite structure phone',
    'SQLite USE guidance and custom table/column controls stay contained in the light phone layout.',
  )
  await page.getByRole('combobox', { name: 'Saved API', exact: true }).click()
  await page.getByRole('option', { name: flow.name, exact: true }).click()
  await fitGraph()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await fitGraph()
  await capture(
    'Mobile',
    'Selected spreadsheet structure phone',
    'The shared existing API keeps its explicit source choice; no imported rows or private source metadata are fetched by the selector.',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page.getByRole('option', { name: flow.name, exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Release access', exact: true }),
  ).toContainText('Only this release')
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Selected bound customer key')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('Only release 2')
  await expect(page.getByRole('dialog')).toContainText(
    'Linked to member Selected API collaborator',
  )
  await capture(
    'API keys',
    'Selected member-linked release review',
    'Selected issuance always requires a reviewed current pin. Runtime access retains the original member action and dependency USE boundary.',
  )
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key created')
  const caller = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  await expect(
    page.getByRole('region', { name: 'Save API key', exact: true }),
  ).toContainText('Linked to member Selected API collaborator')
  const keysResponse = await page.request.get(`${apiOrigin}/api/runtime-keys`, {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(keysResponse.status()).toBe(200)
  const key = ((await keysResponse.json()) as RuntimeKey[]).find(
    (item) => item.name === 'Selected bound customer key',
  )!
  expect(key.releaseRevision).toBe(2)
  expect(key.issuerBinding).toEqual({
    memberId: collaborator.id,
    action: 'runtime-keys.manage',
  })
  const called = await page.request.get(`${apiOrigin}/run${flow.path}`, {
    headers: { authorization: `Bearer ${caller}` },
  })
  expect(called.status()).toBe(200)
  expect(await called.json()).toEqual([{ name: 'Ada', city: 'London' }])
  await capture(
    'API keys',
    'Selected bound caller receipt',
    'The masked key is pinned and issuer-bound. Its actual REST call returned the saved allowed projection.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const keyRole = await management<Role>('/api/roles', {
    name: 'Selected key manager without API reading',
    permissions: ['runtime-keys.manage'],
  })
  const keyManager = await management<Member & { token: string }>(
    '/api/members',
    {
      name: 'Selected key-only member',
      role: 'custom',
      roleId: keyRole.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateFlowReads = 0
  let noReadSession = true
  const rowAccessPath = `/api/flows/${flow.id}/row-access`
  const rowAccessReads: Promise<{
    path: string
    source: string | null
    metadata: unknown
  }>[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      noReadSession &&
      path.startsWith('/api/flows') &&
      path !== rowAccessPath
    )
      privateFlowReads++
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (noReadSession && url.pathname === rowAccessPath)
      rowAccessReads.push(
        response.json().then((metadata: unknown) => ({
          path: url.pathname,
          source: url.searchParams.get('source'),
          metadata,
        })),
      )
  })
  async function assertRowAccessReads() {
    expect(rowAccessReads.length).toBeGreaterThan(0)
    for (const read of await Promise.all(rowAccessReads))
      expect(read).toEqual({
        path: rowAccessPath,
        source: 'published',
        metadata: {
          source: 'published',
          revision: 2,
          required: false,
          supported: true,
        },
      })
  }
  await page.getByLabel('Workspace token').fill(keyManager.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Account & sessions', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('combobox', { name: 'Shared API ID', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.sidebar')).not.toContainText('No APIs shared')
  await page
    .getByLabel('Key name', { exact: true })
    .fill('No-read member linked caller')
  await page.getByLabel('Known published release', { exact: true }).fill('2')
  await capture(
    'Permissions',
    'Selected key-only supplied release',
    'A key manager without Read APIs supplies a known current revision for a shared API ID. Only action-authorized minimal row-protection review is read; private definitions, endpoints and schemas stay unread.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key created')
  const noReadCaller = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const noReadResult = await page.request.get(`${apiOrigin}/run${flow.path}`, {
    headers: { authorization: `Bearer ${noReadCaller}` },
  })
  expect(noReadResult.status()).toBe(200)
  expect(privateFlowReads).toBe(0)
  await assertRowAccessReads()
  await expect(
    page.getByRole('region', { name: 'Save API key', exact: true }),
  ).toContainText('Current release unknown')
  await capture(
    'API keys',
    'No-read member linked key receipt',
    'The server validates the supplied publication before issuing a masked pinned key. Current release status stays unknown without API reading; the actual caller works.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Stale supplied release')
  await page.getByLabel('Known published release', { exact: true }).fill('999')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    /release|publication|published/i,
  )
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByLabel('Known published release', { exact: true }),
  ).toHaveValue('999')
  await capture(
    'API keys',
    'No-read supplied release conflict',
    'A real publication conflict keeps the name and supplied revision. New issuance waits for explicit input review; current release status remains unknown.',
  )
  await page.getByLabel('Known published release', { exact: true }).fill('2')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('Only release 2')
  await capture(
    'API keys',
    'No-read supplied release review recovery',
    'The member supplies the owner-provided revision and reviews it explicitly. Endpoint metadata remains unread; server validation still controls issuance.',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark no-read supplied release',
    'A key manager without Read APIs supplies a known revision and operation type. No endpoint or current publication metadata is claimed.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'No-read pinned key form phone',
    'Shared IDs and owner-provided revision inputs remain contained. Minimal row-protection review is action-authorized; private API definitions, endpoints and schemas stay unread.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light no-read pinned key form phone',
    'Labels, validation and explicit review stay legible at phone width without private API reads.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  expect(privateFlowReads).toBe(0)
  await assertRowAccessReads()
  noReadSession = false
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: databaseFlow.name, exact: true })
    .click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Selected member-linked GraphQL key')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key created')
  const graphqlCaller = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const graphqlCall = await page.request.post(
    `${apiOrigin}/graphql${databaseFlow.path}`,
    {
      headers: { authorization: `Bearer ${graphqlCaller}` },
      data: { query: 'query { rows { name city } }' },
    },
  )
  expect(graphqlCall.status()).toBe(200)
  expect(await graphqlCall.json()).toEqual({
    data: {
      rows: [
        { name: 'Ada', city: 'London' },
        { name: 'Grace', city: 'New York' },
      ],
    },
  })
  await capture(
    'API keys',
    'Member-linked GraphQL caller receipt',
    'A query-only key pins the current SQLite-backed GraphQL release and retains the original member action/USE. The actual HTTP query returned the allowed rows.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const restRow = page
    .getByRole('row')
    .filter({ hasText: 'Selected bound customer key' })
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('member link')
    void dialog.accept()
  })
  await restRow
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key replaced')
  const replacementCaller = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const replacedResponse = await page.request.get(
    `${apiOrigin}/api/runtime-keys`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  const replacement = ((await replacedResponse.json()) as RuntimeKey[]).find(
    (item) => item.name === key.name && !item.revokedAt,
  )!
  expect(replacement.issuerBinding).toEqual(key.issuerBinding)
  expect(replacement.releaseRevision).toBe(key.releaseRevision)
  expect(replacement.expiresAt).toBe(key.expiresAt)
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${caller}` },
      })
    ).status(),
  ).toBe(401)
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${replacementCaller}` },
      })
    ).status(),
  ).toBe(200)
  await capture(
    'API keys',
    'Member-linked replacement receipt',
    'Replacement preserves the exact member/action link, pin and expiration. The previous caller fails immediately; the new caller retains the same allowed API.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Published API', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await expect(
    page.getByRole('option', {
      name: `${databaseFlow.name} · GraphQL`,
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('option', { name: `${flow.name} · GET`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load settings', exact: true }).click()
  await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
  await capture(
    'Load testing',
    'Selected API load test review',
    'Only shared APIs with all explicit dependency USE appear as targets. This bounded test sends repeated live requests under the member’s Load testing action.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Run load test', exact: true }).click()
  const loadResult = page.getByRole('region', {
    name: 'Load test results',
    exact: true,
  })
  await expect(loadResult).toContainText('Completed', { timeout: 45000 })
  const jobsResponse = await page.request.get(`${apiOrigin}/api/load-tests`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const jobs = await jobsResponse.json()
  expect(jobs).toHaveLength(1)
  expect(jobs[0].summary.requests).toBeGreaterThan(0)
  const managedResponse = await page.request.get(
    `${apiOrigin}/api/runtime-keys`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  const managed = ((await managedResponse.json()) as RuntimeKey[]).find(
    (item) => item.managedBy === 'load-test',
  )!
  expect(managed.issuerBinding).toEqual({
    memberId: collaborator.id,
    action: 'load-tests.run',
  })
  expect(managed.releaseRevision).toBe(2)
  expect(managed.revokedAt).not.toBeNull()
  await capture(
    'Load testing',
    'Selected member-linked k6 result',
    'Real k6 completed against the shared published REST API. Its temporary caller retains the member’s Load testing action and release pin, and is revoked after completion.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByRole('button', {
      name: `Manage APIs for ${collaborator.name}`,
      exact: true,
    })
    .click()
  const sharing = page.getByRole('region', {
    name: `API sharing for ${collaborator.name}`,
    exact: true,
  })
  await expect(
    sharing.getByRole('checkbox', {
      name: `Use spreadsheet ${source.name}`,
      exact: true,
    }),
  ).toBeChecked()
  await sharing
    .getByRole('checkbox', {
      name: `Use spreadsheet ${source.name}`,
      exact: true,
    })
    .click()
  await sharing
    .getByRole('button', { name: 'Review API sharing', exact: true })
    .click()
  await expect(sharing).toContainText('Use spreadsheet sources: none')
  await expect(sharing).toContainText(database.name)
  await capture(
    'Members',
    'Remove spreadsheet USE review',
    'The owner reviews the chosen APIs and each typed dependency family separately. Removing spreadsheet USE ends browser sessions and blocks linked callers that need that source.',
  )
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark typed dependency review',
    'The owner sees API routes, typed USE families and the session-ending warning together in a separate review panel.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'Typed dependency review phone',
    'API scope and dependency families wrap inside the phone panel. Confirmation remains explicit and does not grant resource management.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light typed dependency review phone',
    'Selection summary, access version and confirmation controls retain light-theme contrast at phone width.',
  )
  const sharingBounds = await page.locator('body').evaluate((panel) =>
    [...panel.querySelectorAll('*')]
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        clipped: !!element.closest('.data-table'),
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      }))
      .filter((element) => !element.clipped && element.right > innerWidth + 1),
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    JSON.stringify(sharingBounds),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await sharing
    .getByRole('button', { name: 'Confirm API sharing', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API sharing updated')
  await expect(sharing).toContainText('Access version 2')
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${replacementCaller}` },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${noReadCaller}` },
      })
    ).status(),
  ).toBe(200)
  expect(
    (
      await page.request.post(`${apiOrigin}/graphql${databaseFlow.path}`, {
        headers: { authorization: `Bearer ${graphqlCaller}` },
        data: { query: 'query { rows { name city } }' },
      })
    ).status(),
  ).toBe(200)
  await capture(
    'Members',
    'Typed USE removal committed',
    'The member’s REST caller is denied before reading the spreadsheet. Its SQLite GraphQL caller remains allowed; another member’s independently authorized REST key remains allowed.',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  const blockedRow = page
    .getByRole('row')
    .filter({ hasText: 'Selected bound customer key' })
    .filter({
      has: page.getByRole('button', { name: 'Replace key', exact: true }),
    })
  page.once('dialog', (dialog) => dialog.accept())
  await blockedRow
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    /member|issuer|authority|access|dependency|use/i,
  )
  await expect(page.getByLabel('New API key', { exact: true })).toHaveCount(0)
  await capture(
    'API keys',
    'Owner cannot replace blocked member caller',
    'Even the owner cannot use replacement to remove the original member’s current action and USE requirements. No new token appears after the actual denied replacement.',
  )
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByRole('button', {
      name: `Manage APIs for ${collaborator.name}`,
      exact: true,
    })
    .click()
  await expect(sharing).toContainText('Access version 2')
  await sharing
    .getByRole('checkbox', {
      name: `Use spreadsheet ${source.name}`,
      exact: true,
    })
    .click()
  await sharing
    .getByRole('button', { name: 'Review API sharing', exact: true })
    .click()
  await sharing
    .getByRole('button', { name: 'Confirm API sharing', exact: true })
    .click()
  await expect(sharing).toContainText('Access version 3')
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${replacementCaller}` },
      })
    ).status(),
  ).toBe(200)
  await capture(
    'Members',
    'Explicit dependency USE restored',
    'The owner explicitly restores spreadsheet USE at the next access version. The same unexpired member-linked pin becomes usable again; no scope, member action or release was widened implicitly.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page.getByRole('option', { name: flow.name, exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Delivery outcome unknown')
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}/api/runtime-keys`,
    })
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Could not confirm whether the API key was created',
  )
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Key name', { exact: true })).toHaveValue(
    'Delivery outcome unknown',
  )
  await page.unroute('**/api/runtime-keys')
  await capture(
    'API keys',
    'Member-linked issuance delivery unconfirmed',
    'The real server issued a key, but its response was lost. No secret is invented and repeat creation waits for an explicit refresh of current keys.',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'Delivery outcome unknown' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeEnabled()
  await capture(
    'API keys',
    'Issuance delivery refresh recovery',
    'Refresh discovers the committed member-linked key. Its one-time secret cannot be recovered; the member can explicitly replace or revoke it after reviewing the current list.',
  )
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Pending member-linked caller')
  let deliver!: () => void
  const delivered = new Promise<void>((resolve) => {
    deliver = resolve
  })
  let committed = false
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}/api/runtime-keys`,
    })
    expect(response.status()).toBe(200)
    committed = true
    await delivered
    await route.fulfill({ response })
  })
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect.poll(() => committed).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Create pinned key', exact: true }),
  ).toBeDisabled()
  await capture(
    'API keys',
    'Member-linked issuance response pending',
    'Real issuance has committed while response delivery is held. Duplicate issue, navigation and credential transitions stay blocked until its one-time receipt arrives.',
  )
  deliver()
  await expect(page.getByRole('status')).toContainText('API key created')
  await page.unroute('**/api/runtime-keys')
  await capture(
    'API keys',
    'Pending member-linked issuance completed',
    'Exactly one committed caller appears with the original member, operation and pin; the one-time secret is masked in previews.',
  )
  await appearance('Dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'Member-linked caller receipt phone',
    'Member action, pin and acknowledgment remain readable beside the masked one-time credential; the key table scrolls within its container.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light member-linked caller receipt phone',
    'The same receipt preserves readable scope and member-link information in the light phone layout.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()

  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Published API', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: `${flow.name} · GET`, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load settings', exact: true }).click()
  await page.getByLabel('Duration in seconds', { exact: true }).fill('30')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Run load test', exact: true }).click()
  await expect(loadResult).toContainText('Preparing k6 or running')
  await capture(
    'Load testing',
    'Member-linked live run',
    'The bounded live run uses a release-pinned temporary caller and the initiating member’s Load testing action.',
  )
  const removedUse = await page.request.put(
    `${apiOrigin}/api/members/${collaborator.id}/access`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        mode: 'selected',
        flowIds: collaborator.access.flowIds,
        dependencyUse: { ...collaborator.access.dependencyUse, sources: [] },
        version: 3,
      },
    },
  )
  expect(removedUse.status()).toBe(200)
  const removed = (await removedUse.json()) as Member
  // The policy change revokes the current cookie; fresh login resolves its new USE.
  await expect(page.getByLabel('Workspace token')).toBeVisible({
    timeout: 15000,
  })
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await expect(loadResult).toContainText('Preparing k6 or running')
  await expect(
    page.getByRole('combobox', { name: 'Published API', exact: true }),
  ).toBeDisabled()
  const allowedTargets = await page.request.get(
    `${apiOrigin}/api/load-tests/targets`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  expect(allowedTargets.status()).toBe(200)
  expect(
    (await allowedTargets.json()).map((item: { id: string }) => item.id),
  ).not.toContain(flow.id)
  await capture(
    'Load testing',
    'USE removed but bounded cleanup available',
    'The revoked cookie requires fresh login. The spreadsheet API disappears from run targets, while its member-linked history and Cancel run remain available for cleanup.',
  )
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click()
  await expect(loadResult).toContainText('Canceled', { timeout: 15000 })
  await capture(
    'Load testing',
    'Scoped load run canceled without USE',
    'Cleanup cancels the member-linked job and revokes its temporary caller even after source USE was removed. It grants no new execution or resource access.',
  )
  const restoredUse = await page.request.put(
    `${apiOrigin}/api/members/${collaborator.id}/access`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        mode: 'selected',
        flowIds: collaborator.access.flowIds,
        dependencyUse: collaborator.access.dependencyUse,
        version: removed.access.version,
      },
    },
  )
  expect(restoredUse.status()).toBe(200)
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()

  const currentDefinition = await page.request.get(
    `${apiOrigin}/api/flows/${flow.id}`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  const saved = (await currentDefinition.json()) as SavedFlow
  const changed = await page.request.put(`${apiOrigin}/api/flows/${flow.id}`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { ...saved, name: 'Selected operations customer API revised' },
  })
  expect(changed.status()).toBe(200)
  const revised = (await changed.json()) as SavedFlow
  await management(`/api/flows/${flow.id}/publish`, {
    revision: revised.revision,
  })
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByText('Loading API keys…', { exact: true }),
  ).toHaveCount(0)
  const dormantRow = page
    .getByRole('row')
    .filter({ hasText: 'Selected bound customer key' })
    .filter({
      has: page.getByRole('button', { name: 'Replace key', exact: true }),
    })
  await expect(dormantRow).toContainText('Dormant')
  page.once('dialog', (dialog) => dialog.accept())
  await dormantRow
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key replaced')
  const dormantCaller = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${dormantCaller}` },
      })
    ).status(),
  ).toBe(403)
  const dormantKeys = await page.request.get(`${apiOrigin}/api/runtime-keys`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const dormantKey = ((await dormantKeys.json()) as RuntimeKey[]).find(
    (item) => item.name === replacement.name && !item.revokedAt,
  )!
  expect(dormantKey.issuerBinding).toEqual(replacement.issuerBinding)
  expect(dormantKey.releaseRevision).toBe(replacement.releaseRevision)
  expect(dormantKey.expiresAt).toBe(replacement.expiresAt)
  await capture(
    'API keys',
    'Dormant member-linked replacement',
    'Replacement preserves the original member, action, expiration and exact release pin. The replacement remains denied while another release is current; no archived code executes.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const rollback = await page.request.post(
    `${apiOrigin}/api/flows/${flow.id}/rollback`,
    {
      headers: { authorization: `Bearer ${token}` },
      data: { revision: 2, publishedRevision: revised.revision },
    },
  )
  expect(rollback.status()).toBe(200)
  expect(
    (
      await page.request.get(`${apiOrigin}/run${flow.path}`, {
        headers: { authorization: `Bearer ${dormantCaller}` },
      })
    ).status(),
  ).toBe(200)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Selected bound customer key' })
      .filter({
        has: page.getByRole('button', { name: 'Replace key', exact: true }),
      }),
  ).toContainText('Current release · linked to member')
  await capture(
    'API keys',
    'Exact rollback restores member-linked pin',
    'An authorized selected publisher rolls back the current publication to the exact pinned release. The saved draft remains newer, and the member’s current USE/action still controls the restored caller.',
  )
  expect(privateReads).toEqual([])
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /^API Studio/ })).toBeVisible()
}
