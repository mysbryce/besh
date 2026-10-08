import { expect, test, type Locator } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PreviewRecord } from '../scripts/preview-report'

test('preview every current page and its actions', async ({
  page,
  context,
}) => {
  const directory = process.env.BESH_PREVIEW_DIR!
  const setupKey = process.env.BESH_PREVIEW_SETUP_KEY!
  const records: PreviewRecord[] = []
  const errors: string[] = []
  mkdirSync(join(directory, 'images'), { recursive: true })
  page.on('pageerror', (error) => errors.push(error.message))

  async function capture(group: string, title: string, detail: string) {
    const image = `images/${String(records.length + 1).padStart(2, '0')}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-$/, '')}.png`
    await page.screenshot({
      path: join(directory, image),
      fullPage: true,
      animations: 'disabled',
      mask: [
        page.getByLabel('Your owner key', { exact: true }),
        page.getByLabel('Workspace token', { exact: true }),
        page.getByLabel('Setup key', { exact: true }),
        page.getByLabel('New member token', { exact: true }),
      ],
      maskColor: '#bac9ae',
    })
    records.push({ page: group, title, detail, image })
    writeFileSync(
      join(directory, 'manifest.json'),
      JSON.stringify(records, null, 2),
    )
    console.log(`Preview ${records.length}: ${group} / ${title}`)
  }

  async function notice(text: string) {
    await expect(page.getByRole('status')).toContainText(text)
  }

  async function navigate(name: string) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByText('Loading workspace records…')).toHaveCount(0)
  }

  async function signIn(token: string) {
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
  }

  async function configure(config: unknown) {
    await page
      .getByLabel('Node configuration')
      .fill(JSON.stringify(config, null, 2))
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await notice('Configuration applied')
  }

  async function connect(source: Locator, target: Locator) {
    const from = await source.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error('Connection handles are not visible')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    })
    await page.mouse.up()
  }

  await page.route('**/setup/status', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"Preview: server temporarily unavailable"}',
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await capture(
    'Setup',
    'Connection error and retry',
    'An unavailable server shows a clear error with a retry action. This failure is deliberately simulated at the HTTP boundary.',
  )
  await page.unroute('**/setup/status')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('Workspace name')).toBeVisible()
  await capture(
    'Setup',
    'First-run wizard',
    'Retry recovers. A workspace name and the server-issued setup key are required.',
  )
  await page.getByLabel('Workspace name').fill('Besh Playground')
  await page
    .getByLabel('Setup key', { exact: true })
    .fill('incorrect-preview-key')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await notice('Open the setup link')
  await capture(
    'Setup',
    'Invalid setup key',
    'An incorrect setup key cannot claim the workspace.',
  )
  await page.getByLabel('Setup key', { exact: true }).fill(setupKey)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const owner = await page.getByLabel('Your owner key').inputValue()
  await expect(
    page.getByRole('button', { name: 'Enter studio' }),
  ).toBeDisabled()
  await capture(
    'Setup',
    'Workspace created',
    'The generated owner key is shown once. Enter studio stays disabled until the key is acknowledged. Key masked in this preview.',
  )
  await page.getByRole('button', { name: 'Copy owner key' }).click()
  await notice('Owner key copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(owner)
  await capture(
    'Setup',
    'Copy owner key',
    'The copy action writes the generated key to the browser clipboard and shows confirmation.',
  )
  await page.getByLabel('I saved my owner key').check()
  await page.getByRole('button', { name: 'Enter studio' }).click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await capture(
    'API Studio',
    'Empty workspace',
    'The studio opens with a request-to-response starter graph and no saved APIs.',
  )

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Welcome endpoint')
  await page.getByLabel('HTTP method').selectOption('POST')
  await page.getByLabel('Endpoint path').fill('/welcome')
  await capture(
    'API Studio',
    'New API and route settings',
    'Name, HTTP method, and endpoint path are editable. This example uses POST /run/welcome.',
  )

  const responseNode = page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
  const before = await responseNode.boundingBox()
  if (!before) throw new Error('Response node is missing')
  await page.mouse.move(before.x + 80, before.y + 35)
  await page.mouse.down()
  await page.mouse.move(before.x + 120, before.y + 95, { steps: 10 })
  await page.mouse.up()
  await responseNode.click()
  await capture(
    'API Studio',
    'Move and inspect a node',
    'Dragging changes node position. Selecting a node opens its configuration panel.',
  )
  await page.getByLabel('Node configuration').fill('{broken JSON')
  await page.getByRole('button', { name: 'Apply configuration' }).click()
  await expect(page.locator('.statusbar.error')).toBeVisible()
  await capture(
    'API Studio',
    'Invalid node configuration',
    'Malformed JSON produces an error and does not replace the working node configuration.',
  )
  await configure({
    status: 201,
    body: { message: 'Welcome to Besh', name: '$input.body.name' },
  })
  await capture(
    'API Studio',
    'Apply response configuration',
    'A response can set its HTTP status and read request data using safe input references.',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  await capture(
    'API Studio',
    'Save draft',
    'The draft is persisted. Test and publish actions become available.',
  )
  await page.getByLabel('Test input').fill('{invalid')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.locator('.statusbar.error')).toBeVisible()
  await capture(
    'API Studio',
    'Invalid test input',
    'Invalid test JSON is rejected before a run is submitted.',
  )
  await page.getByLabel('Test input').fill('{"body":{"name":"Ada"},"query":{}}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await capture(
    'API Studio',
    'Test response',
    'The test returns HTTP 201, the resolved name, and the visited node IDs.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published')
  const live = await page.request.post('/run/welcome', {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Ada' },
  })
  expect(live.status()).toBe(201)
  expect(await live.json()).toEqual({ message: 'Welcome to Besh', name: 'Ada' })
  await capture(
    'API Studio',
    'Publish and call endpoint',
    'The published POST endpoint was called over HTTP and returned the expected response.',
  )
  await configure({ status: 202, body: { message: 'New draft response' } })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  const unchanged = await page.request.post('/run/welcome', {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Ada' },
  })
  expect(unchanged.status()).toBe(201)
  await capture(
    'API Studio',
    'Draft and release stay separate',
    'Revision 2 is saved while revision 1 remains live. An HTTP call still returns the original 201 response.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published')
  await capture(
    'API Studio',
    'Publish updated revision',
    'Publishing selects the new revision for the live endpoint.',
  )

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Unsaved idea')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: /Welcome endpoint/ }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Unsaved idea')
  await capture(
    'API Studio',
    'Cancel discard',
    'Canceling the discard dialog preserves an unsaved new API.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Welcome endpoint/ }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Welcome endpoint')
  await capture(
    'API Studio',
    'Confirm discard and select API',
    'Confirming the dialog discards the unsaved draft and loads the chosen saved API.',
  )

  await page.getByRole('button', { name: 'Condition', exact: true }).click()
  await expect(page.getByLabel('Node configuration')).toBeVisible()
  await capture(
    'API Studio',
    'Add condition',
    'The palette adds a condition node with configurable input comparison.',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await notice('Conditions need true and false connections')
  await capture(
    'API Studio',
    'Graph validation error',
    'An incomplete condition may be saved as a draft, but execution fails until both branches are connected.',
  )
  await page.getByRole('button', { name: 'Remove node', exact: true }).click()
  await capture(
    'API Studio',
    'Remove selected node',
    'The selected node and its attached edges are removed from the draft.',
  )
  await responseNode.click()
  await page.getByRole('button', { name: 'Remove node', exact: true }).click()
  await page
    .getByRole('button', { name: 'Response', exact: true })
    .dragTo(page.getByTestId('flow-canvas'), {
      targetPosition: { x: 480, y: 235 },
    })
  await page.locator('.react-flow__pane').click({ position: { x: 40, y: 220 } })
  await capture(
    'API Studio',
    'Drag a response from palette',
    'A response can be dropped directly on the canvas.',
  )
  await connect(
    page
      .locator('.react-flow__node')
      .filter({ hasText: 'HTTP request' })
      .locator('.react-flow__handle.source'),
    responseNode.locator('.react-flow__handle.target'),
  )
  await capture(
    'API Studio',
    'Connect node handles',
    'Dragging between output and input handles creates an edge.',
  )
  const edge = page.locator('.react-flow__edge').first()
  await edge.click({ force: true })
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await capture(
    'API Studio',
    'Delete an edge',
    'Selecting an edge and pressing Delete disconnects the steps.',
  )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'HTTP request' })
    .click()
  await page.getByRole('button', { name: 'Remove node', exact: true }).click()
  await page.getByRole('button', { name: 'Request', exact: true }).click()
  await capture(
    'API Studio',
    'Restore request node',
    'When the request node is removed, the palette offers a replacement request trigger.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Welcome endpoint/ }).click()

  const conditionFlow = {
    name: 'Stock availability',
    method: 'POST',
    path: '/stock',
    nodes: [
      {
        id: 'request',
        type: 'request',
        position: { x: 0, y: 160 },
        config: {},
      },
      {
        id: 'check',
        type: 'condition',
        position: { x: 320, y: 160 },
        config: { field: 'body.inStock', equals: true },
      },
      {
        id: 'yes',
        type: 'response',
        position: { x: 650, y: 40 },
        config: { status: 200, body: { available: true } },
      },
      {
        id: 'no',
        type: 'response',
        position: { x: 650, y: 290 },
        config: { status: 404, body: { available: false } },
      },
    ],
    edges: [
      { id: 'start', source: 'request', target: 'check' },
      { id: 'true', source: 'check', target: 'yes', sourceHandle: 'true' },
      { id: 'false', source: 'check', target: 'no', sourceHandle: 'false' },
    ],
  }
  expect(
    (
      await page.request.post('/api/flows', {
        headers: { authorization: `Bearer ${owner}` },
        data: conditionFlow,
      })
    ).ok(),
  ).toBe(true)
  await page.getByRole('button', { name: /Sign out/ }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await capture(
    'Authentication',
    'Sign out',
    'Signing out clears the in-memory key and returns to the login page.',
  )
  await page.getByLabel('Workspace token').fill('invalid-demo-key')
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await notice('Authentication required')
  await capture(
    'Authentication',
    'Invalid login',
    'An incorrect workspace token receives an authentication error.',
  )
  await signIn(owner)
  await page.getByRole('button', { name: /Stock availability/ }).click()
  await page
    .getByLabel('Test input')
    .fill('{"body":{"inStock":true},"query":{}}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText(
    '"available": true',
  )
  await capture(
    'API Studio',
    'Condition true branch',
    'This sample was created through the public management API. The dashboard run follows the true branch and returns 200.',
  )
  await page
    .getByLabel('Test input')
    .fill('{"body":{"inStock":false},"query":{}}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('404')
  await capture(
    'API Studio',
    'Condition false branch',
    'A second run follows the false branch and returns 404.',
  )
  await page.getByRole('button', { name: 'Zoom In', exact: true }).click()
  await capture('API Studio', 'Zoom in', 'Canvas controls increase graph zoom.')
  await page.getByRole('button', { name: 'Zoom Out', exact: true }).click()
  await capture(
    'API Studio',
    'Zoom out',
    'Canvas controls decrease graph zoom.',
  )
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await capture(
    'API Studio',
    'Fit graph to canvas',
    'Fit view brings the full graph into the available canvas.',
  )

  await navigate('Members')
  await expect(
    page.getByRole('cell', { name: 'Bootstrap owner' }),
  ).toBeVisible()
  await capture(
    'Members',
    'Member list',
    'The owner is present. Only the owner can administer workspace members.',
  )
  await page.getByLabel('Member name').fill('Demo viewer')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  const viewer = await page.getByLabel('New member token').inputValue()
  await capture(
    'Members',
    'Create viewer',
    'Creating a viewer returns a scoped token once. Its value is masked in the screenshot.',
  )
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await notice('Member token copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(viewer)
  await capture(
    'Members',
    'Copy member token',
    'The copy action confirms the new member key was placed on the clipboard.',
  )
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await expect(page.getByLabel('New member token')).toHaveCount(0)
  await capture(
    'Members',
    'Dismiss saved token',
    'Acknowledging a saved token removes its one-time display.',
  )
  await page.getByLabel('Member name').fill('Demo editor')
  await page.getByLabel('Member role').selectOption('editor')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  const editor = await page.getByLabel('New member token').inputValue()
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await capture(
    'Members',
    'Create editor',
    'The role selector can issue an editor token with draft editing and testing access.',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'Demo editor' }),
  ).toBeVisible()
  await capture(
    'Members',
    'Refresh members',
    'Refresh reads the current member list from the server.',
  )

  await navigate('Data & backups')
  await expect(page.getByText('Create your first backup.')).toBeVisible()
  await capture(
    'Data & backups',
    'Empty backups and migration log',
    'All applied schema migrations are listed. No backup exists yet.',
  )
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  await notice('Workspace backup created')
  await capture(
    'Data & backups',
    'Create backup',
    'A consistent SQLite snapshot is created and appears with its size and creation time.',
  )
  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  const download = await pendingDownload
  const downloadedPath = join(directory, 'workspace/downloaded.sqlite')
  await download.saveAs(downloadedPath)
  expect(readFileSync(downloadedPath).subarray(0, 16).toString()).toBe(
    'SQLite format 3\u0000',
  )
  await notice('Backup downloaded')
  await capture(
    'Data & backups',
    'Download backup',
    'The download completed and its SQLite file header was verified. Database files are not served by this gallery.',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeVisible()
  await capture(
    'Data & backups',
    'Refresh backup history',
    'Refresh reloads backup metadata and migration history.',
  )

  await navigate('Audit trail')
  await expect(
    page.getByRole('cell', { name: 'backup.downloaded', exact: true }),
  ).toBeVisible()
  await capture(
    'Audit trail',
    'Audit history',
    'Workspace changes, test runs, publishing, denied access, and backup actions are visible without secret values.',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByRole('cell', { name: 'workspace.created', exact: true }),
  ).toBeVisible()
  await capture(
    'Audit trail',
    'Refresh audit events',
    'Refresh retrieves the most recent 200 events.',
  )
  await navigate('What’s next')
  await expect(page.getByText('Not available yet')).toHaveCount(4)
  await capture(
    'Roadmap',
    'Planned integrations',
    'Identity, database adapters, custom plugins, and AI are explicitly marked planned.',
  )

  await page.getByRole('button', { name: /Sign out/ }).click()
  await signIn(viewer)
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'Permissions',
    'Viewer studio',
    'A viewer can read API definitions, but editing, testing, and publication controls are disabled.',
  )
  for (const name of ['Members', 'Audit trail', 'Data & backups']) {
    await navigate(name)
    await expect(
      page.getByRole('heading', { name: 'Owner access required' }),
    ).toBeVisible()
    await capture(
      'Permissions',
      `Viewer denied ${name.toLowerCase()}`,
      'Workspace administration is restricted to the owner; the page explains the role boundary.',
    )
  }
  await page.getByRole('button', { name: /Sign out/ }).click()
  await signIn(editor)
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'Permissions',
    'Editor studio',
    'An editor can build and test drafts while publishing remains an owner action.',
  )
  await page.getByRole('button', { name: /Sign out/ }).click()
  await signIn(owner)
  await navigate('Members')
  const viewerRow = page.getByRole('row').filter({ hasText: 'Demo viewer' })
  page.once('dialog', (dialog) => dialog.dismiss())
  await viewerRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(viewerRow).toBeVisible()
  await capture(
    'Members',
    'Cancel member revocation',
    'Canceling the confirmation preserves the member and their token.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await viewerRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  await notice('Member access revoked')
  await expect(viewerRow).toHaveCount(0)
  await capture(
    'Members',
    'Confirm member revocation',
    'Confirming revocation removes the member. Their previous token is immediately invalid.',
  )
  expect(
    (
      await page.request.get('/api/me', {
        headers: { authorization: `Bearer ${viewer}` },
      })
    ).status(),
  ).toBe(401)

  await page.setViewportSize({ width: 390, height: 844 })
  for (const name of [
    'API Studio',
    'Members',
    'Data & backups',
    'Audit trail',
    'What’s next',
  ]) {
    await navigate(name)
    if (name === 'API Studio') {
      await expect(page.getByTestId('flow-canvas')).toBeVisible()
      expect(
        (await page.getByTestId('flow-canvas').boundingBox())!.height,
      ).toBeGreaterThanOrEqual(300)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile',
      name,
      'The page is rendered at a 390px phone viewport. Main document has no horizontal overflow.',
    )
  }
  await page.getByRole('button', { name: /Sign out/ }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await capture('Mobile', 'Login', 'Login remains usable at phone width.')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await capture(
    'Authentication',
    'Login page',
    'Returning visitors use their saved owner or member token. Tokens are kept only in memory.',
  )
  await signIn(owner)
  await page.getByRole('link', { name: 'Besh home', exact: true }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await capture(
    'Authentication',
    'Home link and reload',
    'The home link reloads the app. Authentication is requested again because the token was not persisted in browser storage.',
  )
  expect(errors).toEqual([])

  await context.clearPermissions()
})
