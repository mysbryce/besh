import { expect, test, type Locator } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PreviewRecord } from '../scripts/preview-report'

test('preview every current page and its actions', async ({
  page,
  context,
  request,
}) => {
  const directory = process.env.BESH_PREVIEW_DIR!
  const setupKey = process.env.BESH_PREVIEW_SETUP_KEY!
  const records: PreviewRecord[] = []
  test.setTimeout(300_000)
  const errors: string[] = []
  mkdirSync(join(directory, 'images'), { recursive: true })
  page.on('pageerror', (error) => errors.push(error.message))

  async function capture(group: string, title: string, detail: string) {
    const dropdownOpen = (await page.getByRole('listbox').count()) > 0
    if (dropdownOpen) {
      await expect(page.getByRole('listbox')).toHaveCSS('opacity', '1')
    }
    if (!dropdownOpen && (await page.locator('.theme-control').count())) {
      await expect(
        page.getByRole('combobox', { name: 'Appearance' }),
      ).toBeVisible()
    }
    if (!dropdownOpen) await page.evaluate(() => window.scrollTo(0, 0))
    const passwordMasks: Locator[] = []
    for (const input of await page.locator('input[type="password"]').all()) {
      if (await input.inputValue()) passwordMasks.push(input)
    }
    const image = `images/${String(records.length + 1).padStart(2, '0')}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-$/, '')}.png`
    await page.screenshot({
      path: join(directory, image),
      fullPage: !dropdownOpen,
      animations: 'disabled',
      mask: [
        ...passwordMasks,
        page.getByLabel('Your owner key', { exact: true }),
        page.getByLabel('Workspace token', { exact: true }),
        page.getByLabel('Setup key', { exact: true }),
        page.getByLabel('New member token', { exact: true }),
        page.getByLabel('New API key', { exact: true }),
      ],
      maskColor: '#dfe4ec',
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

  async function appearance(mode: 'Light' | 'Dark') {
    await page.getByRole('combobox', { name: 'Appearance' }).click()
    await page.getByRole('option', { name: mode, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      mode.toLowerCase(),
    )
  }

  async function navigate(name: string) {
    await page
      .getByRole('button', {
        name: name === 'API Studio' ? /^API Studio/ : name,
        exact: name !== 'API Studio',
      })
      .click()
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

  async function fitLoginGraph() {
    await page.getByRole('button', { name: 'Fit View', exact: true }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(3)
    await expect
      .poll(() =>
        page.locator('.canvas').evaluate((canvas) => {
          const bounds = canvas.getBoundingClientRect()
          return [...canvas.querySelectorAll('.react-flow__node')].every(
            (node) => {
              const box = node.getBoundingClientRect()
              return box.left >= bounds.left && box.right <= bounds.right
            },
          )
        }),
      )
      .toBe(true)
  }

  async function configure(config: unknown) {
    if (!(await page.getByLabel('Node configuration').isVisible())) {
      await page
        .getByRole('button', { name: 'Advanced configuration', exact: true })
        .click()
    }
    await page
      .getByLabel('Node configuration')
      .fill(JSON.stringify(config, null, 2))
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await notice('Configuration applied')
  }

  async function testInput(value: string) {
    if (!(await page.getByLabel('Test input').isVisible())) {
      await page
        .getByRole('button', { name: 'Advanced test input', exact: true })
        .click()
    }
    await page.getByLabel('Test input').fill(value)
  }

  async function connect(source: Locator, target: Locator) {
    await source.scrollIntoViewIfNeeded()
    await target.scrollIntoViewIfNeeded()
    await expect(source).toBeInViewport()
    await expect(target).toBeInViewport()
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
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark workspace',
    'Dark studio keeps cards, endpoint inputs, canvas controls, and text readable.',
  )
  await page.getByRole('combobox', { name: 'HTTP method' }).click()
  await capture(
    'Appearance',
    'Dark custom dropdown',
    'Keyboard-accessible custom dropdown uses dark surfaces and visible selection.',
  )
  await page.keyboard.press('Escape')
  await appearance('Light')
  await capture(
    'API Studio',
    'Empty workspace',
    'The studio opens with a request-to-response starter graph and no saved APIs.',
  )
  await navigate('API keys')
  await expect(
    page.getByRole('heading', { name: 'Publish an API first' }),
  ).toBeVisible()
  await capture(
    'API keys',
    'No published APIs',
    'Caller credentials require a published flow. The empty page explains how to publish first.',
  )
  await navigate('API Studio')

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Welcome endpoint')
  await page.getByRole('combobox', { name: 'HTTP method' }).click()
  await capture(
    'API Studio',
    'Custom method dropdown',
    'A styled dropdown supports keyboard navigation, selection, Escape, and focus return.',
  )
  await page.getByRole('option', { name: 'POST', exact: true }).click()
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
  await page
    .getByRole('combobox', { name: 'Field type 1', exact: true })
    .click()
  await capture(
    'API Studio',
    'Response value types',
    'Response fields offer fixed text, numbers, booleans, empty values, and safe request references through custom controls.',
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('combobox', { name: 'Response status', exact: true })
    .click()
  await capture(
    'API Studio',
    'Choose response status',
    'A custom dropdown sets the HTTP status without writing JSON.',
  )
  await page.keyboard.press('Escape')
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark response fields',
    'Field inputs, type selectors, and response status use readable dark surfaces.',
  )
  await appearance('Light')
  await page
    .getByRole('button', { name: 'Advanced configuration', exact: true })
    .click()
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
  await page
    .getByRole('button', { name: 'Add body field', exact: true })
    .click()
  await page.getByLabel('Body name 1', { exact: true }).fill('name')
  await page.getByLabel('Body value 1', { exact: true }).fill('Ada')
  await capture(
    'API Studio',
    'Simple request fields',
    'Query parameters and typed request-body values are entered through rows; Advanced JSON is optional.',
  )
  await testInput('{invalid')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.locator('.statusbar.error')).toBeVisible()
  await capture(
    'API Studio',
    'Invalid test input',
    'Invalid test JSON is rejected before a run is submitted.',
  )
  await testInput('{"body":{"name":"Ada"},"query":{}}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await capture(
    'API Studio',
    'Test response',
    'The test returns HTTP 201, the resolved name, and the visited node IDs.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published')
  await navigate('API keys')
  await expect(page.getByText('No API keys yet.')).toBeVisible()
  await capture(
    'API keys',
    'Empty key list',
    'The owner can issue a caller key for one published API. No runtime credentials have been issued yet.',
  )
  await page.getByLabel('Key name').fill('Welcome caller')
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await capture(
    'API keys',
    'Choose published API',
    'The custom dropdown lists published APIs, separately from editable drafts.',
  )
  await page
    .getByRole('option', { name: 'Welcome endpoint', exact: true })
    .click()
  await page.getByRole('combobox', { name: 'Expires in' }).click()
  await capture(
    'API keys',
    'Choose key expiration',
    'Every runtime key expires. The custom dropdown offers 1, 7, 30, or 90 days.',
  )
  await page.getByRole('option', { name: '7 days', exact: true }).click()
  const restPermission = page.getByRole('checkbox', { name: 'REST requests' })
  await restPermission.focus()
  await page.keyboard.press('Space')
  await expect(restPermission).not.toBeChecked()
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await capture(
    'API keys',
    'Permission required',
    'Keyboard toggling the custom REST checkbox disables issuance when no permission remains.',
  )
  await page.keyboard.press('Space')
  await expect(restPermission).toBeChecked()
  await capture(
    'API keys',
    'Scoped REST key form',
    'The form identifies the live endpoint, permission, and expiration before issuing a key.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const restKey = await page.getByLabel('New API key').inputValue()
  await capture(
    'API keys',
    'Runtime key shown once',
    'The server returns the caller token once. Its value is masked; key metadata remains available afterward.',
  )
  await page.getByRole('button', { name: 'Copy API key', exact: true }).click()
  await notice('API key copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    restKey,
  )
  await capture(
    'API keys',
    'Copy runtime key',
    'Copy writes the disposable caller key to the browser clipboard and confirms success. The token is masked.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await expect(page.getByLabel('New API key')).toHaveCount(0)
  await capture(
    'API keys',
    'Acknowledge saved runtime key',
    'Acknowledgement removes the one-time token display and leaves scoped metadata in the list.',
  )
  await navigate('API Studio')
  const live = await page.request.post('/run/welcome', {
    headers: { authorization: `Bearer ${restKey}` },
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
    headers: { authorization: `Bearer ${restKey}` },
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
  await expect(page.getByLabel('Input field', { exact: true })).toBeVisible()
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
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
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
    'Signing out revokes this browser session on the server and returns to the login page.',
  )
  await page.getByLabel('Workspace token').fill('invalid-demo-key')
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await notice('Invalid credentials')
  await capture(
    'Authentication',
    'Invalid login',
    'An incorrect workspace token receives an authentication error.',
  )
  await signIn(owner)
  await page.getByRole('button', { name: /Stock availability/ }).click()
  await testInput('{"body":{"inStock":true},"query":{}}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText(
    '"available": true',
  )
  await capture(
    'API Studio',
    'Condition true branch',
    'This sample was created through the public management API. The dashboard run follows the true branch and returns 200.',
  )
  await testInput('{"body":{"inStock":false},"query":{}}')
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

  await navigate('Data sources')
  await expect(page.getByText('No data sources yet')).toBeVisible()
  await capture(
    'Data sources',
    'No imported data',
    'Owners and editors can import spreadsheet snapshots. No external account is required for uploaded files.',
  )
  await page.getByLabel('Source name', { exact: true }).fill('Products')
  await page.getByLabel('Spreadsheet file', { exact: true }).setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,price,available\nTea,12,true\nCoffee,15,false\n'),
  })
  await capture(
    'Data sources',
    'Choose spreadsheet file',
    'A CSV or Excel file is selected before import. The first row contains column names.',
  )
  await page
    .getByRole('button', { name: 'Import spreadsheet', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Tea', exact: true }),
  ).toBeVisible()
  await capture(
    'Data sources',
    'Imported typed preview',
    'Real CSV import shows the saved rows, types, version, original headings, and API field mapping.',
  )
  await appearance('Dark')
  await capture(
    'Data sources',
    'Dark spreadsheet preview',
    'Saved data and mapped fields remain readable on dark surfaces.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile',
    'Dark data import and mapping',
    'Data import, preview table, and column choices fit phone width; the table scrolls within its card.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await appearance('Light')
  await page
    .getByRole('combobox', { name: 'Saved data source', exact: true })
    .click()
  await capture(
    'Data sources',
    'Choose saved source',
    'A custom dropdown selects a saved source and retains keyboard support.',
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('combobox', { name: 'Rows per request', exact: true })
    .click()
  await capture(
    'Data sources',
    'Choose row limit',
    'Bound each request to a reviewed row limit before generating a draft.',
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('checkbox', { name: 'Return available', exact: true })
    .uncheck()
  await capture(
    'Data sources',
    'Review returned columns',
    'Only selected fields are included. The preview explains original heading, API field name, and data type.',
  )
  await page.getByLabel('API name', { exact: true }).fill('Products REST')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/products-preview')
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Products REST',
  )
  await capture(
    'Data sources',
    'Generated visual draft',
    'Real public management API creates a saved request → spreadsheet rows → response graph; publication remains a separate step.',
  )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await expect(
    page.getByRole('checkbox', { name: 'Include name', exact: true }),
  ).toBeVisible()
  await capture(
    'API Studio',
    'Spreadsheet step settings',
    'Choose source, returned columns, maximum rows, and optional typed equality filter without JSON.',
  )
  await page
    .getByRole('combobox', { name: 'Maximum rows', exact: true })
    .click()
  await capture(
    'API Studio',
    'Spreadsheet row limit control',
    'Custom row-limit dropdown supports values from one to one hundred.',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('checkbox', { name: 'Filter rows', exact: true }).check()
  await capture(
    'API Studio',
    'Optional row match',
    'A column match can use a fixed typed value or a request input. This capture has not applied the edit.',
  )
  await page
    .getByRole('checkbox', { name: 'Filter rows', exact: true })
    .uncheck()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await capture(
    'API Studio',
    'Return spreadsheet rows',
    'The generated response shows a friendly rows mode; no $data JSON editing is required.',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Tea')
  await capture(
    'Data sources',
    'Test generated REST API',
    'The real draft test returns only name and price from the saved CSV snapshot.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published')
  const productFlows = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${owner}` },
    })
  ).json()
  const productFlow = productFlows.find(
    (flow: { name: string }) => flow.name === 'Products REST',
  )
  const productGrant = await (
    await page.request.post('/api/runtime-keys', {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: 'Preview spreadsheet caller',
        flowId: productFlow.id,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
  ).json()
  expect(
    await (
      await page.request.get('/run/products-preview', {
        headers: { authorization: `Bearer ${productGrant.token}` },
      })
    ).json(),
  ).toEqual([
    { name: 'Tea', price: 12 },
    { name: 'Coffee', price: 15 },
  ])
  await capture(
    'Data sources',
    'Published spreadsheet endpoint',
    'A real scoped runtime key calls the published REST endpoint. Disposable key issued through the approved management HTTP seam and omitted from artifacts.',
  )
  await navigate('Data sources')
  await page
    .getByLabel('Replacement spreadsheet', { exact: true })
    .setInputFiles({
      name: 'products-new.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'name,price,available\nTea,18,true\nCoffee,15,false\n',
      ),
    })
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Replace spreadsheet', exact: true })
    .click()
  await capture(
    'Data sources',
    'Cancel snapshot replacement',
    'Cancel preserves the saved snapshot and live callers. A new file remains selected for review.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Replace spreadsheet', exact: true })
    .click()
  await notice('replaced')
  expect(
    await (
      await page.request.get('/run/products-preview', {
        headers: { authorization: `Bearer ${productGrant.token}` },
      })
    ).json(),
  ).toEqual([
    { name: 'Tea', price: 18 },
    { name: 'Coffee', price: 15 },
  ])
  await capture(
    'Data sources',
    'Replaced saved snapshot',
    'Real replacement updates the row preview and the already-published REST response immediately; its graph stays unchanged.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Delete data source', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'used by a draft or published API',
  )
  await capture(
    'Data sources',
    'Referenced source cannot delete',
    'The real server rejects deletion while a draft or published graph references this source.',
  )
  await page
    .getByRole('checkbox', { name: 'Filter by input', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Filter column', exact: true })
    .click()
  await capture(
    'Data sources',
    'Choose optional search column',
    'Search filters help callers find rows. Omitting an optional input returns all eligible rows up to the limit; filters are not authorization.',
  )
  await page.getByRole('option', { name: 'price', exact: true }).click()
  await page.getByLabel('Filter input name', { exact: true }).fill('price')
  await capture(
    'Data sources',
    'Map optional caller input',
    'The generated API accepts a typed equality filter. Safe parameter names and original column names remain visible before creation.',
  )
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await capture(
    'Data sources',
    'Choose generated API type',
    'Generate REST or typed query-only GraphQL from reviewed spreadsheet fields.',
  )
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await page.getByLabel('API name', { exact: true }).fill('Products GraphQL')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/products-graphql-preview')
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Products GraphQL',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('"rows"')
  await capture(
    'GraphQL',
    'Generated spreadsheet query',
    'Typed Query.rows and a valid matching operation are generated. The real draft test runs without typing JSON, schema, or query text.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published')
  const generatedGraphs = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${owner}` },
    })
  ).json()
  const generatedGraph = generatedGraphs.find(
    (flow: { name: string }) => flow.name === 'Products GraphQL',
  )
  const generatedGrant = await (
    await page.request.post('/api/runtime-keys', {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: 'Preview spreadsheet query caller',
        flowId: generatedGraph.id,
        permissions: ['query'],
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
  ).json()
  expect(
    await (
      await page.request.post('/graphql/products-graphql-preview', {
        headers: { authorization: `Bearer ${generatedGrant.token}` },
        data: { query: '{ rows(price:18) { name price } }' },
      })
    ).json(),
  ).toEqual({ data: { rows: [{ name: 'Tea', price: 18 }] } })
  await capture(
    'GraphQL',
    'Published typed spreadsheet filter',
    'A real scoped query key invokes the generated published GraphQL endpoint with a numeric argument and field selection. The token is omitted from artifacts.',
  )
  await appearance('Dark')
  await capture(
    'GraphQL',
    'Dark generated query result',
    'Typed rows and optional advanced controls remain readable in dark mode.',
  )
  await appearance('Light')
  await navigate('Data sources')
  await page
    .getByRole('combobox', { name: 'Import method', exact: true })
    .click()
  await capture(
    'Data sources',
    'Choose import method',
    'Use a local spreadsheet file or a public Google Sheets link. Private OAuth is not implemented.',
  )
  await page
    .getByRole('option', { name: 'Public Google Sheet', exact: true })
    .click()
  await page.getByLabel('Source name', { exact: true }).fill('Invalid sheet')
  await page
    .getByLabel('Google Sheets link', { exact: true })
    .fill('https://example.com/private')
  await capture(
    'Data sources',
    'Public Google Sheet form',
    'A shared Google link imports a saved snapshot, with manual refresh rather than continuous synchronization.',
  )
  await page
    .getByRole('button', { name: 'Import Google Sheet', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('Google Sheets')
  await capture(
    'Data sources',
    'Invalid Google URL rejected',
    'The real backend rejects a non-Google URL without fetching it.',
  )
  const realSources = await (
    await page.request.get('/api/data-sources', {
      headers: { authorization: `Bearer ${owner}` },
    })
  ).json()
  const simulatedGoogle = {
    ...realSources[0],
    id: 'preview-simulated-google',
    name: 'Simulated public sheet',
    kind: 'google-sheets',
    sourceUrl:
      'https://docs.google.com/spreadsheets/d/simulated-ui-preview/edit',
    version: 1,
    rowCount: 1,
    rows: [{ name: 'Simulated original', price: 5, available: true }],
  }
  await page.route('**/api/data-sources/google-sheets', (route) =>
    route.fulfill({ status: 200, json: simulatedGoogle }),
  )
  await page
    .getByLabel('Source name', { exact: true })
    .fill(simulatedGoogle.name)
  await page
    .getByLabel('Google Sheets link', { exact: true })
    .fill(simulatedGoogle.sourceUrl)
  await page
    .getByRole('button', { name: 'Import Google Sheet', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Simulated original', exact: true }),
  ).toBeVisible()
  await capture(
    'Data sources',
    'Simulated Google import success',
    'Controlled management HTTP response demonstrates public-sheet success UI offline. Separate smoke verified real Google network import; this screenshot is simulated.',
  )
  await page.route(
    '**/api/data-sources/preview-simulated-google/refresh',
    (route) =>
      route.fulfill({
        status: 200,
        json: {
          ...simulatedGoogle,
          version: 2,
          rows: [{ name: 'Simulated refreshed', price: 6, available: true }],
        },
      }),
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Refresh saved data', exact: true })
    .click()
  await capture(
    'Data sources',
    'Cancel simulated Google refresh',
    'Cancel sends no refresh request and preserves the saved rows. This source uses controlled management HTTP responses.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Refresh saved data', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Simulated refreshed', exact: true }),
  ).toBeVisible()
  await capture(
    'Data sources',
    'Simulated Google refresh success',
    'Controlled HTTP refresh updates row preview and version. This screenshot does not claim a live Google fetch.',
  )
  await page.unroute('**/api/data-sources/preview-simulated-google/refresh')
  await page.route(
    '**/api/data-sources/preview-simulated-google/refresh',
    (route) =>
      route.fulfill({
        status: 502,
        json: {
          error:
            'Simulated Google export temporarily unavailable. Try refresh again.',
        },
      }),
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Refresh saved data', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('Simulated Google export')
  await capture(
    'Data sources',
    'Simulated Google refresh error',
    'Controlled HTTP error preserves the saved rows and gives a retry message; the server failure is simulated.',
  )
  await page.unroute('**/api/data-sources/google-sheets')
  await page.unroute('**/api/data-sources/preview-simulated-google/refresh')

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
  await page.getByRole('combobox', { name: 'Member role' }).click()
  await capture(
    'Members',
    'Custom role dropdown',
    'Member roles use the shared styled dropdown with accessible option labels.',
  )
  await page
    .getByRole('option', { name: 'Editor · build and test', exact: true })
    .click()
  await page
    .getByLabel('Member email (optional)', { exact: true })
    .fill('preview-editor@example.test')
  await page
    .getByLabel('Member password', { exact: true })
    .fill('Preview editor password 123!')
  await capture(
    'Members',
    'Optional member email sign-in',
    'The owner can give a new editor email/password sign-in while keeping their scoped member key. The password is masked.',
  )
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

  await navigate('API keys')
  const restKeyRow = page.getByRole('row').filter({ hasText: 'Welcome caller' })
  page.once('dialog', (dialog) => dialog.dismiss())
  await restKeyRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(restKeyRow).toContainText('Active')
  await capture(
    'API keys',
    'Cancel key revocation',
    'Canceling the confirmation preserves access for the scoped caller key.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await restKeyRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  await notice('API key revoked')
  await expect(restKeyRow).toContainText('Revoked')
  expect(
    (
      await page.request.post('/run/welcome', {
        headers: { authorization: `Bearer ${restKey}` },
        data: { name: 'Ada' },
      })
    ).status(),
  ).toBe(401)
  await capture(
    'API keys',
    'Confirm key revocation',
    'Revoked metadata remains in the list. A real HTTP request with the old token immediately returned 401.',
  )
  await page.route('**/api/runtime-keys', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"Preview: API key records temporarily unavailable"}',
    }),
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await capture(
    'API keys',
    'Key record loading error',
    'A temporary HTTP-boundary failure displays a clear error while existing metadata stays visible. This failure is deliberately simulated.',
  )
  await page.unroute('**/api/runtime-keys')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await notice('API keys refreshed')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await capture(
    'API keys',
    'Refresh after key record error',
    'Refresh recovers against the real server and clears the temporary error.',
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
    'Product social-auth templates, database adapters, custom plugins, and AI are explicitly marked planned.',
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
  await navigate('Data sources')
  await expect(
    page.getByRole('heading', { name: 'Editor access required' }),
  ).toBeVisible()
  await capture(
    'Permissions',
    'Viewer denied spreadsheet data',
    'Source metadata, rows, imports, and API generation require owner or editor access; the real server enforces the same boundary.',
  )
  for (const name of ['Members', 'API keys', 'Audit trail', 'Data & backups']) {
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
  await navigate('Account & sessions')
  await expect(page.getByText('Loading your account…')).toHaveCount(0)
  await expect(
    page.getByText('Only your own active sessions appear here.'),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Owner', exact: true }),
  ).toHaveCount(0)
  await capture(
    'Permissions',
    'Viewer account and own sessions',
    'A viewer can configure their own password and revoke their own sessions. Owner sessions are not listed.',
  )
  await navigate('Product login')
  await expect(
    page.getByRole('heading', { name: 'Product login needs editor access' }),
  ).toBeVisible()
  await capture(
    'Permissions',
    'Viewer denied product login',
    'Viewers cannot inspect product OAuth connections or generate login APIs. The server enforces this role boundary.',
  )
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
  await navigate('Data sources')
  await expect(
    page.getByRole('cell', { name: 'Tea', exact: true }),
  ).toBeVisible()
  await capture(
    'Permissions',
    'Editor spreadsheet access',
    'An editor can import and review saved data and generate drafts; publishing and runtime-key administration remain owner-only.',
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

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Typed count API')
  await page.getByLabel('Endpoint path').fill('/typed-count')
  const rulesToggle = page.getByRole('button', {
    name: 'API rules',
    exact: true,
  })
  if ((await rulesToggle.getAttribute('aria-expanded')) !== 'true')
    await rulesToggle.click()
  await page
    .getByRole('checkbox', { name: 'Validate query parameters', exact: true })
    .check()
  await page
    .getByRole('button', { name: 'Add Query field', exact: true })
    .click()
  await page.getByLabel('Query field name 1', { exact: true }).fill('count')
  await page
    .getByRole('combobox', { name: 'Query field 1 type', exact: true })
    .click()
  await capture(
    'API rules',
    'Choose a query rule type',
    'The custom type dropdown offers text, numbers, whole numbers, and true/false values without JSON editing.',
  )
  await page.getByRole('option', { name: 'Whole number', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Query field 1 required', exact: true })
    .check()
  await page
    .getByRole('checkbox', { name: 'Validate response', exact: true })
    .check()
  await page
    .getByRole('button', { name: 'Add Response field', exact: true })
    .click()
  await page.getByLabel('Response field name 1', { exact: true }).fill('count')
  await page
    .getByRole('combobox', { name: 'Response field 1 type', exact: true })
    .click()
  await page.getByRole('option', { name: 'Whole number', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Response field 1 required', exact: true })
    .check()
  await capture(
    'API rules',
    'Required query and response fields',
    'Labeled forms define a required whole-number query parameter and matching response field. Server rules are optional and separate from authorization.',
  )
  await appearance('Dark')
  await capture(
    'API rules',
    'Dark rule controls',
    'Rule names, custom type controls, required choices, and allow-null choices remain readable in dark appearance.',
  )
  await page
    .getByRole('combobox', { name: 'Query field 1 type', exact: true })
    .click()
  await capture(
    'API rules',
    'Dark rule type dropdown',
    'The open custom dropdown keeps typed rule choices and the selected whole-number value readable in dark mode.',
  )
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'API rules',
    'Phone dark API rules',
    'API rules fit a 390px phone viewport with accessible custom controls and no horizontal document overflow.',
  )
  await appearance('Light')
  await capture(
    'API rules',
    'Phone light API rules',
    'The same query and response field forms remain contained and readable in light phone appearance.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('combobox', { name: 'HTTP method' }).click()
  await page.getByRole('option', { name: 'POST', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Validate request body', exact: true })
    .check()
  await page.getByRole('combobox', { name: 'Body type', exact: true }).click()
  await capture(
    'API rules',
    'Choose a request body shape',
    'A POST body can be text, a number, true/false, an object, or a list. A custom selector exposes these shapes without JSON editing.',
  )
  await page.getByRole('option', { name: 'List of items', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add Body item field', exact: true })
    .click()
  await page.getByLabel('Body item field name 1', { exact: true }).fill('name')
  await page
    .getByRole('checkbox', { name: 'Body item field 1 required', exact: true })
    .check()
  await capture(
    'API rules',
    'Nested object fields in a body list',
    'Recursive field forms define a list of objects with a required text name. Each object and nested field has its own rules.',
  )
  await page
    .locator('details')
    .filter({ has: page.getByLabel('Body minItems', { exact: true }) })
    .getByText('Limits and description', { exact: true })
    .click()
  await page.getByLabel('Body minItems', { exact: true }).fill('1')
  await page.getByLabel('Body maxItems', { exact: true }).fill('5')
  await page
    .getByLabel('Body description', { exact: true })
    .fill('One to five named items')
  await page
    .locator('details')
    .filter({
      has: page.getByLabel('Body item field 1 minLength', { exact: true }),
    })
    .getByText('Limits and description', { exact: true })
    .click()
  await page
    .getByLabel('Body item field 1 minLength', { exact: true })
    .fill('1')
  await page
    .getByLabel('Body item field 1 maxLength', { exact: true })
    .fill('80')
  await capture(
    'API rules',
    'List and nested text limits',
    'Optional limits constrain list length and nested text length. Descriptions document intent while all rules remain server-checked.',
  )
  await page.getByRole('combobox', { name: 'HTTP method' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('option', { name: 'GET', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Validate request body', exact: true }),
  ).not.toBeChecked()
  await page
    .locator('details')
    .filter({ has: page.getByLabel('Query field 1 minimum', { exact: true }) })
    .getByText('Limits and description', { exact: true })
    .click()
  await page.getByLabel('Query field 1 minimum', { exact: true }).fill('3')
  await page.getByLabel('Query field 1 maximum', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('query rules.count: minimum must not exceed maximum.')
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'API rules',
    'Contradictory limits cannot save',
    'The form explains that minimum exceeds maximum before saving. This new API remains unsaved and cannot publish; the server also validates contract limits.',
  )
  await page.getByLabel('Query field 1 minimum', { exact: true }).fill('')
  await page.getByLabel('Query field 1 maximum', { exact: true }).fill('')
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await configure({ status: 200, body: { count: '$input.query.count' } })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await notice('Input query.count')
  await capture(
    'API rules',
    'Missing required query input',
    'The real server rejects missing count with 400 before executing the saved draft. The error contains no submitted values.',
  )
  await page
    .getByRole('button', { name: 'Add query parameter', exact: true })
    .click()
  await page.getByLabel('Query name 1', { exact: true }).fill('count')
  await page.getByLabel('Query value 1', { exact: true }).fill('3')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('"count": 3')
  await expect(page.getByTestId('test-result')).not.toContainText(
    '"count": "3"',
  )
  await capture(
    'API rules',
    'Valid typed response',
    'Query text 3 becomes a JSON whole number before execution and passes the saved response rules.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('/run/typed-count')

  async function downloadOpenapi() {
    const pending = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Download OpenAPI', exact: true })
      .click()
    const document = await pending
    const filename = join(directory, `openapi-${Date.now()}.json`)
    await document.saveAs(filename)
    return JSON.parse(readFileSync(filename, 'utf8'))
  }

  await page.getByRole('combobox', { name: 'OpenAPI source' }).click()
  await capture(
    'OpenAPI',
    'Choose documentation snapshot',
    'The custom selector distinguishes the saved draft revision from the immutable published release; browser edits must be saved before export.',
  )
  await page.getByRole('option', { name: /^Saved draft/ }).click()
  const draftDocument = await downloadOpenapi()
  expect(draftDocument.openapi).toBe('3.1.1')
  expect(draftDocument['x-besh-source']).toBe('draft')
  expect(draftDocument.paths['/run/typed-count'].get.parameters).toEqual([
    { name: 'count', in: 'query', required: true, schema: { type: 'integer' } },
  ])
  expect(draftDocument.paths['/run/typed-count'].get.security).toEqual([
    { RuntimeKey: [] },
  ])
  await capture(
    'OpenAPI',
    'Download saved draft documentation',
    'A real JSON download describes the saved REST method, route, integer query rules, and required runtime bearer authentication.',
  )
  await page.getByRole('combobox', { name: 'OpenAPI source' }).click()
  await page.getByRole('option', { name: /^Published release/ }).click()
  const publishedDocument = await downloadOpenapi()
  expect(publishedDocument['x-besh-source']).toBe('published')
  expect(publishedDocument['x-besh-revision']).toBe(1)
  await capture(
    'OpenAPI',
    'Download published documentation',
    'Published export describes release 1. Download access uses member identity; callers of this route still need a separate runtime API key.',
  )
  await page.getByLabel('Endpoint path').fill('/typed-count-next')
  await page
    .getByRole('checkbox', { name: 'Response field 1 allow null', exact: true })
    .check()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  const stillPublished = await downloadOpenapi()
  expect(stillPublished).toEqual(publishedDocument)
  await capture(
    'OpenAPI',
    'Edited draft keeps live documentation',
    'Saved revision 2 changes the draft route and response nullability. Published download remains exactly the release-1 document.',
  )
  await page.getByRole('combobox', { name: 'OpenAPI source' }).click()
  await page.getByRole('option', { name: /^Saved draft/ }).click()
  const nextDraft = await downloadOpenapi()
  expect(nextDraft['x-besh-revision']).toBe(2)
  expect(
    nextDraft.paths['/run/typed-count-next'].get.responses['200'].content[
      'application/json'
    ].schema.properties.count.type,
  ).toEqual(['integer', 'null'])
  expect(nextDraft.paths['/run/typed-count']).toBeUndefined()
  await capture(
    'OpenAPI',
    'Updated draft documentation',
    'The saved-draft download describes the new route and nullable integer response with OpenAPI 3.1 JSON Schema type unions; release 1 stays live.',
  )

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('GraphQL greeting')
  await page.getByLabel('Endpoint path').fill('/greeting')
  await page.getByRole('combobox', { name: 'API type' }).click()
  await capture(
    'GraphQL',
    'Choose API type',
    'Each visual API can use REST or GraphQL. GraphQL exposes its own POST endpoint.',
  )
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await capture(
    'GraphQL',
    'Simple typed contract',
    'Starter GraphQL works with its generated query. Schema and variables are optional Advanced editors.',
  )
  await page
    .getByRole('button', { name: 'Advanced schema', exact: true })
    .click()
  await capture(
    'GraphQL',
    'Schema editor',
    'An editable GraphQL schema defines queries, mutations, arguments, and response types.',
  )
  await page
    .getByLabel('GraphQL schema')
    .fill(
      'type Query { greet(name: String!): Greeting! } type Mutation { greet(name: String!): Greeting! } type Greeting { message: String! name: String! }',
    )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await configure({
    status: 200,
    body: { message: 'Hello from GraphQL', name: '$input.body.name' },
  })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  await capture(
    'GraphQL',
    'Save typed API',
    'Arguments become flow body input. Query and mutation root fields run the visual flow.',
  )
  await page
    .getByLabel('GraphQL operation', { exact: true })
    .fill('query Greeting($name: String!) { greet(name: $name) { name } }')
  await page
    .getByRole('button', { name: 'Advanced GraphQL input', exact: true })
    .click()
  await page.getByLabel('GraphQL operation name').fill('Greeting')
  await page.getByLabel('GraphQL variables').fill('{"name":"Ada"}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('"name": "Ada"')
  await expect(page.getByTestId('test-result')).not.toContainText(
    'Hello from GraphQL',
  )
  await capture(
    'GraphQL',
    'Query variables and field selection',
    'A named operation resolves variables and returns only the requested name field.',
  )
  await page.getByLabel('GraphQL variables').fill('{"name":123}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('errors')
  await expect(page.getByTestId('test-result')).toContainText('400')
  await capture(
    'GraphQL',
    'Typed variable error',
    'The schema rejects a numeric variable where String is required before running any flow.',
  )
  await page.getByLabel('GraphQL operation name').fill('')
  await page
    .getByLabel('GraphQL operation', { exact: true })
    .fill('mutation { greet(name: "Grace") { message name } }')
  await page.getByLabel('GraphQL variables').fill('{}')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Grace')
  await capture(
    'GraphQL',
    'Test mutation',
    'GraphQL mutations run through the same authenticated, bounded flow executor.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('/graphql/greeting')
  await navigate('API keys')
  await page.getByLabel('Key name').fill('GraphQL reader')
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await page
    .getByRole('option', { name: 'GraphQL greeting', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', { name: 'GraphQL queries' }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'GraphQL mutations' }),
  ).not.toBeChecked()
  await capture(
    'API keys',
    'GraphQL query permission',
    'A GraphQL key starts with queries allowed and mutations denied. Grants apply to a whole selected operation.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const graphKey = await page.getByLabel('New API key').inputValue()
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  expect(
    (
      await page.request.post('/graphql/greeting', {
        headers: { authorization: `Bearer ${graphKey}` },
        data: { query: 'mutation { greet(name: "Grace") { name } }' },
      })
    ).status(),
  ).toBe(403)
  await capture(
    'API keys',
    'Query-only key rejects mutation',
    'The real published GraphQL endpoint returned 403 to this query-only key for a mutation.',
  )
  await page.getByLabel('Key name').fill('GraphQL writer')
  const mutationPermission = page.getByRole('checkbox', {
    name: 'GraphQL mutations',
  })
  await mutationPermission.focus()
  await page.keyboard.press('Space')
  await expect(mutationPermission).toBeChecked()
  await capture(
    'API keys',
    'Grant GraphQL mutations',
    'The owner explicitly enables mutations with the keyboard-accessible custom checkbox; queries remain granted.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const writerKey = await page.getByLabel('New API key').inputValue()
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const writerResponse = await page.request.post('/graphql/greeting', {
    headers: { authorization: `Bearer ${writerKey}` },
    data: { query: 'mutation { greet(name: "Grace") { message name } }' },
  })
  expect(await writerResponse.json()).toEqual({
    data: { greet: { message: 'Hello from GraphQL', name: 'Grace' } },
  })
  await capture(
    'API keys',
    'Scoped GraphQL keys',
    'Separate caller keys list their query/mutation grants, expiration, published flow, and current status. A granted mutation returned the expected typed data.',
  )
  await navigate('API Studio')
  const graphResponse = await page.request.post('/graphql/greeting', {
    headers: { authorization: `Bearer ${graphKey}` },
    data: { query: '{ greet(name: "Ada") { message name } }' },
  })
  expect(await graphResponse.json()).toEqual({
    data: { greet: { message: 'Hello from GraphQL', name: 'Ada' } },
  })
  await capture(
    'GraphQL',
    'Publish GraphQL endpoint',
    'The live POST /graphql/greeting endpoint returned typed GraphQL data over HTTP.',
  )
  await page
    .getByRole('button', { name: 'Advanced schema', exact: true })
    .click()
  await page
    .getByLabel('GraphQL schema')
    .fill('type Query { broken: MissingType }')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await notice('Draft saved')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Unknown type')
  await capture(
    'GraphQL',
    'Invalid schema cannot publish',
    'Invalid schema can remain a draft. Publishing fails and the previous release stays live.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'GraphQL',
    'Phone schema and test editor',
    'GraphQL schema and operation editors remain within the phone viewport.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: /Stock availability/ }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  for (const name of [
    'API Studio',
    'Data sources',
    'Product login',
    'Members',
    'API keys',
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
      const savedApi = page.getByRole('combobox', { name: 'Saved API' })
      await savedApi.click()
      await capture(
        'Mobile',
        'Choose a saved API',
        'The custom saved-API dropdown preserves API selection on phone layouts where the desktop list is hidden.',
      )
      await page.getByRole('option', { name: /Welcome endpoint/ }).click()
      await expect(page.getByLabel('API name')).toHaveValue('Welcome endpoint')
      await capture(
        'Mobile',
        'Selected saved API',
        'Selecting a saved API opens its draft in the phone studio without losing access to the canvas.',
      )
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
    await appearance('Dark')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      name,
      'The same phone page is readable in dark mode and has no horizontal document overflow.',
    )
    await appearance('Light')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await appearance('Dark')
  for (const name of [
    'API Studio',
    'Data sources',
    'Product login',
    'Members',
    'API keys',
    'Data & backups',
    'Audit trail',
    'What’s next',
  ]) {
    await navigate(name)
    await capture(
      'Dark workspace pages',
      name,
      'Current desktop page in dark appearance with visible controls and readable content.',
    )
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Sign out/ }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await appearance('Light')
  await capture('Mobile', 'Login', 'Login remains usable at phone width.')
  await appearance('Dark')
  await capture(
    'Mobile dark',
    'Login',
    'Dark sign-in supports the same keyboard controls and masks the workspace token.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await capture(
    'Authentication',
    'Login page',
    'Sign in with a workspace key or email/password. A successful login exchanges credentials for an HttpOnly session cookie.',
  )
  await signIn(owner)
  await page.getByRole('link', { name: 'Besh home', exact: true }).click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await capture(
    'Authentication',
    'Home link and reload',
    'The home link reloads the app. The server restores the valid workspace session without storing the member key in browser storage.',
  )

  await navigate('Account & sessions')
  await expect(page.getByText('Loading your account…')).toHaveCount(0)
  await expect(page.getByText('This device', { exact: true })).toBeVisible()
  await capture(
    'Account & sessions',
    'Workspace key and current session',
    'A key-only member can add email/password sign-in. The current browser session and its server expiry are shown.',
  )
  const accountPassword = 'Preview owner password 123!'
  await page
    .getByLabel('Account email', { exact: true })
    .fill('preview-owner@example.test')
  await page.getByLabel('New password', { exact: true }).fill(accountPassword)
  await page
    .getByLabel('Your workspace key', { exact: true })
    .fill('wrong-preview-key')
  await page
    .getByRole('button', { name: 'Save sign-in details', exact: true })
    .click()
  await notice('Current password or member key required')
  await capture(
    'Account & sessions',
    'Account change needs current credentials',
    'The real server rejects an incorrect proof key before changing sign-in details. All password and key fields are masked.',
  )
  await page.getByLabel('Your workspace key', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Save sign-in details', exact: true })
    .click()
  await notice('Sign-in details saved')
  await capture(
    'Account & sessions',
    'Email sign-in configured',
    'The saved account email is shown. New credentials are cleared from the form and other browser sessions are revoked.',
  )
  await page
    .getByRole('combobox', { name: 'Confirm your identity', exact: true })
    .click()
  await capture(
    'Account & sessions',
    'Choose account confirmation method',
    'An accessible custom selector offers a workspace key or the current password as proof for account changes.',
  )
  await page
    .getByRole('option', { name: 'Current password', exact: true })
    .click()
  await capture(
    'Account & sessions',
    'Current password confirmation',
    'Members with a password account can confirm changes with that password. The workspace key remains a sign-in option.',
  )

  const otherLogin = await request.post('/auth/login', {
    headers: { origin: 'http://127.0.0.1:5180' },
    data: { token: owner },
  })
  expect(otherLogin.status()).toBe(200)
  await page
    .getByRole('button', { name: 'Refresh sessions', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Revoke session for Owner', exact: true }),
  ).toHaveCount(1)
  await capture(
    'Account & sessions',
    'Review another active session',
    'A separate HTTP client signs in through the real server. The owner sees that session alongside this device.',
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Revoke session for Owner', exact: true })
    .click()
  await capture(
    'Account & sessions',
    'Cancel another session revocation',
    'Canceling confirmation leaves the other browser session active.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Revoke session for Owner', exact: true })
    .click()
  await notice('Browser session revoked')
  expect((await request.get('/auth/session')).status()).toBe(401)
  await capture(
    'Account & sessions',
    'Revoke another session',
    'The other client receives 401 after revocation, while this device remains signed in.',
  )
  await appearance('Dark')
  await capture(
    'Dark workspace pages',
    'Account & sessions',
    'Account fields, current-session status, and revocation controls remain readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await capture(
    'Mobile dark',
    'Account & sessions',
    'Phone layout contains account fields and the session table in dark appearance.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Account & sessions',
    'The same account and session controls remain usable at phone width in light appearance.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: /Sign out/ }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await page
    .getByRole('button', { name: 'Email & password', exact: true })
    .click()
  await capture(
    'Authentication',
    'Email and password sign-in',
    'Workspace sign-in offers email/password or a workspace key. Social sign-in belongs to generated-product API templates.',
  )
  await page
    .getByLabel('Email', { exact: true })
    .fill('preview-owner@example.test')
  await page
    .getByLabel('Password', { exact: true })
    .fill('Wrong preview password 123!')
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await notice('Invalid credentials')
  await capture(
    'Authentication',
    'Rejected email sign-in',
    'An incorrect password receives a generic error; the server does not reveal whether an account exists.',
  )
  await appearance('Dark')
  await capture(
    'Authentication',
    'Dark email sign-in',
    'Email/password controls and errors retain clear contrast in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'Email sign-in',
    'Password sign-in at phone width in dark appearance, with credentials masked.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Email sign-in',
    'Password sign-in at phone width in light appearance, with credentials masked.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByLabel('Password', { exact: true }).fill(accountPassword)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await capture(
    'Authentication',
    'Successful email sign-in',
    'A real verified password creates a new workspace session and opens the existing APIs.',
  )
  await navigate('Account & sessions')
  await expect(page.getByText('Loading your account…')).toHaveCount(0)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', {
      name: 'Revoke session for Owner on this device',
      exact: true,
    })
    .click()
  await capture(
    'Account & sessions',
    'Cancel current session revocation',
    'Canceling leaves this device signed in and preserves the active session.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', {
      name: 'Revoke session for Owner on this device',
      exact: true,
    })
    .click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  expect((await page.request.get('/auth/session')).status()).toBe(401)
  await capture(
    'Authentication',
    'Current session revoked',
    'Revoking this device invalidates its server session and returns to workspace sign-in.',
  )

  await signIn(owner)
  await navigate('Product login')
  await expect(
    page.getByRole('heading', { name: 'Start with your GitHub app' }),
  ).toBeVisible()
  await capture(
    'Product login',
    'Connect a product OAuth app',
    'Product login is separate from workspace sign-in. Owners configure a GitHub OAuth app; editors create API drafts from it.',
  )

  async function connectionForm() {
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Demo product')
    await page
      .getByLabel('GitHub client ID', { exact: true })
      .fill('disposable-preview-client')
    await page
      .getByLabel('GitHub client secret', { exact: true })
      .fill('disposable-preview-secret')
    await page
      .getByLabel('Callback URL', { exact: true })
      .fill('https://product.example.test/login/callback')
  }

  await page
    .getByRole('button', { name: 'Connect GitHub', exact: true })
    .click()
  await capture(
    'Product login',
    'GitHub connection form',
    'Labeled fields collect a name, client ID, secret, and the product server callback. Registration help links to GitHub.',
  )
  await connectionForm()
  await page
    .getByLabel('Callback URL', { exact: true })
    .fill('http://product.example.test/login/callback')
  await page
    .getByRole('button', { name: 'Save connection', exact: true })
    .click()
  await expect(page.getByRole('alert')).toBeVisible()
  await capture(
    'Product login',
    'Unsafe callback rejected',
    'The real server rejects HTTP callbacks outside loopback. The error stays beside the connection form; the secret is masked.',
  )
  await page
    .getByLabel('Callback URL', { exact: true })
    .fill('https://product.example.test/login/callback')
  await capture(
    'Product login',
    'Review GitHub connection',
    'Disposable demo credentials are entered for the walkthrough. This does not verify a real GitHub application.',
  )
  await page
    .getByRole('button', { name: 'Save connection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Demo product', exact: true }),
  ).toBeVisible()
  await capture(
    'Product login',
    'Saved GitHub connection',
    'Connection cards show metadata only. The encrypted client secret is never returned by the metadata API.',
  )
  await page
    .getByRole('button', { name: 'Edit connection', exact: true })
    .click()
  await expect(
    page.getByLabel('GitHub client secret', { exact: true }),
  ).toHaveValue('')
  await capture(
    'Product login',
    'Edit without reading a secret',
    'The saved secret cannot be read back. Leaving its field blank preserves it when settings are saved.',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await capture(
    'Product login',
    'Cancel connection editing',
    'Canceling leaves the saved connection unchanged.',
  )
  await page
    .getByRole('button', { name: 'Edit connection', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Save connection', exact: true })
    .click()
  await expect(
    page.getByText('GitHub · version 2', { exact: true }),
  ).toBeVisible()
  await capture(
    'Product login',
    'Save connection settings',
    'Saving increments the connection version and invalidates pending login attempts while preserving an omitted secret.',
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Delete connection', exact: true })
    .click()
  await capture(
    'Product login',
    'Cancel connection deletion',
    'Canceling confirmation keeps the provider connection.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Delete connection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Demo product', exact: true }),
  ).toHaveCount(0)
  await capture(
    'Product login',
    'Delete unused connection',
    'The real server deletes an unused connection after confirmation and records the change in the audit trail.',
  )
  await page
    .getByRole('button', { name: 'Connect GitHub', exact: true })
    .click()
  await connectionForm()
  await page
    .getByRole('button', { name: 'Save connection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Demo product', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Create login API', exact: true })
    .click()
  await capture(
    'Product login',
    'Create a login API draft',
    'Choose an API name, endpoint path, and REST or GraphQL. Generation saves a draft and never publishes it automatically.',
  )
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await capture(
    'Product login',
    'Choose login API protocol',
    'The custom dropdown supports keyboard selection of REST or GraphQL.',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await capture(
    'Product login',
    'Cancel login API creation',
    'Canceling returns to connection metadata without creating a draft.',
  )
  await page
    .getByRole('button', { name: 'Create login API', exact: true })
    .click()
  await page.getByLabel('API name', { exact: true }).fill('GitHub REST login')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/login/github-preview')
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await expect(page.locator('.flow-card.social')).toContainText('GitHub login')
  await page.locator('.flow-card.social').click()
  await expect(
    page.getByRole('combobox', { name: 'GitHub connection', exact: true }),
  ).toHaveText('Demo product')
  await fitLoginGraph()
  await capture(
    'Product login API',
    'Generated REST login graph',
    'A saved request → GitHub login → response graph uses the connection reference and typed REST rules. No JSON editing is needed.',
  )
  await page
    .getByRole('combobox', { name: 'GitHub connection', exact: true })
    .click()
  await capture(
    'Product login API',
    'Review the GitHub connection',
    'The node selects a server-held connection by name. Its client secret never enters the graph or inspector.',
  )
  await page.keyboard.press('Escape')

  const beginLogin = page.waitForResponse((response) =>
    /\/api\/flows\/[^/]+\/test$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  const attempt = (await (await beginLogin).json()).body
  await expect(page.getByTestId('test-result')).toContainText(
    'authorizationUrl',
  )
  await expect(page.getByTestId('test-result')).not.toContainText(attempt.proof)
  await expect(page.getByTestId('test-result')).not.toContainText(attempt.state)
  await capture(
    'Product login API',
    'Start a draft login attempt',
    'The real server creates a bound ten-minute attempt and S256 authorization URL. State, proof, and the URL challenge are hidden in the visible response.',
  )
  await page
    .getByRole('button', { name: 'Copy sensitive proof', exact: true })
    .click()
  expect(
    await page.evaluate(
      (proof) =>
        navigator.clipboard.readText().then((value) => value === proof),
      attempt.proof,
    ),
  ).toBe(true)
  await capture(
    'Product login API',
    'Copy server-held proof explicitly',
    'Copying a sensitive proof requires an explicit action. The value stays hidden in the preview and belongs on the product server.',
  )
  await page
    .getByRole('combobox', { name: 'Login action', exact: true })
    .click()
  await capture(
    'Product login API',
    'Choose the login step',
    'A custom selector switches between starting login and completing the callback. COMPLETE uses labeled credential fields.',
  )
  await page
    .getByRole('option', { name: 'COMPLETE · Finish login', exact: true })
    .click()
  await page
    .getByLabel('Authorization code', { exact: true })
    .fill('simulated-preview-code')
  await page.getByLabel('OAuth state', { exact: true }).fill('invalid-state')
  await page.getByLabel('Login proof', { exact: true }).fill('invalid-proof')
  await capture(
    'Product login API',
    'Complete login fields',
    'Code, state, and proof use masked inputs. Real applications receive code/state at their registered callback and retrieve proof from their server storage.',
  )
  const rejectedLogin = page.waitForResponse((response) =>
    /\/api\/flows\/[^/]+\/test$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await rejectedLogin).status()).toBe(400)
  await capture(
    'Product login API',
    'Rejected login attempt',
    'Invalid state/proof is rejected by the real Besh server before any provider exchange. The valid earlier attempt remains usable.',
  )
  await page.getByLabel('OAuth state', { exact: true }).fill(attempt.state)
  await page.getByLabel('Login proof', { exact: true }).fill(attempt.proof)
  const completedLogin = page.waitForResponse((response) =>
    /\/api\/flows\/[^/]+\/test$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  const identity = (await (await completedLogin).json()).body.identity
  expect(identity.subject).toBe('4242')
  await expect(page.getByTestId('test-result')).toContainText(
    'simulated-github-user',
  )
  await capture(
    'Product login API',
    'Simulated GitHub identity',
    'Only GitHub token/profile responses are simulated. Real Besh validation, one-time consumption, execution, persistence, and audit return a typed demo identity.',
  )
  const replayedLogin = page.waitForResponse((response) =>
    /\/api\/flows\/[^/]+\/test$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await replayedLogin).status()).toBe(400)
  await capture(
    'Product login API',
    'Consumed attempt cannot replay',
    'The real server rejects reuse of the completed state/proof before calling the simulated provider.',
  )
  await appearance('Dark')
  await capture(
    'Product login API',
    'Dark login form and identity',
    'The generated graph, masked callback fields, identity response, and errors remain readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await fitLoginGraph()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await capture(
    'Mobile dark',
    'Product login API',
    'Phone layout contains the generated graph, callback form, and response in dark appearance.',
  )
  await appearance('Light')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await capture(
    'Mobile',
    'Product login API',
    'The same generated login API stays contained and readable in light appearance at phone width.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await fitLoginGraph()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published · POST /run/login/github-preview')
  await navigate('Product login')
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Delete connection', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('referenced')
  await capture(
    'Product login',
    'Referenced connection cannot delete',
    'A real server check prevents deleting a connection used by a saved draft or release.',
  )
  await page
    .getByRole('button', { name: 'Create login API', exact: true })
    .click()
  await page
    .getByLabel('API name', { exact: true })
    .fill('GitHub GraphQL login')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/login/github-preview')
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await capture(
    'Product login',
    'Create typed GraphQL login',
    'GraphQL generates a real LoginAction enum, login mutation, and typed identity response under its separate route namespace.',
  )
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Login action', exact: true }),
  ).toHaveText('BEGIN · Start login')
  await capture(
    'Product login API',
    'Generated GraphQL login graph',
    'The generated mutation and variables are ready. The same BEGIN/COMPLETE field form works without schema or JSON editing.',
  )
  const graphqlLogin = page.waitForResponse((response) =>
    /\/api\/flows\/[^/]+\/graphql\/test$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await graphqlLogin).status()).toBe(200)
  await expect(page.getByTestId('test-result')).toContainText(
    'authorizationUrl',
  )
  await capture(
    'Product login API',
    'Test typed GraphQL login',
    'A real GraphQL mutation starts the draft attempt and returns only requested fields. Sensitive response values remain hidden.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await notice('Published · POST /graphql/login/github-preview')
  await capture(
    'Product login API',
    'Published GraphQL login',
    'Publishing creates an immutable GraphQL release. Its callers require a separately issued key with mutation permission.',
  )
  await navigate('Product login')
  await appearance('Dark')
  await capture(
    'Dark workspace pages',
    'Connected product login',
    'Connection metadata and template actions stay readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await capture(
    'Mobile dark',
    'Connected product login',
    'Phone connection cards contain client metadata and the product callback URL without document overflow.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Connected product login',
    'Light phone layout keeps template creation and connection management accessible.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: /Sign out/ }).click()
  await signIn(editor)
  await navigate('Product login')
  await expect(
    page.getByRole('button', { name: 'Create login API', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Edit connection', exact: true }),
  ).toHaveCount(0)
  await capture(
    'Permissions',
    'Editor generates product login drafts',
    'Editors see metadata and can create drafts, while connection changes and publication remain owner actions.',
  )
  expect(errors).toEqual([])

  await context.clearPermissions()
})
