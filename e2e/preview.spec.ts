import { chooseNode } from './node-picker'
import { openApiTools } from './api-tools'
import { expect, type Locator } from '@playwright/test'
import { test, storyCapture, signInPreview } from './preview-fixture'
import { previewStories } from './preview-order'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdateState } from '../src/updates/model'
import { databasePreviews } from './database-preview'
import { clientCodePreviews } from './client-code-preview'
import { releasePinPreviews } from './release-pins-preview'
import { generatedBackendPreviews } from './generated-backend-preview'
import { flowAccessPreviews } from './flow-access-preview'
import { scopedActionsPreviews } from './scoped-actions-preview'
import { tenantProtectionPreviews } from './tenant-protection-preview'
import { websocketPreviews } from './websocket-preview'
import { fieldAccessPreviews } from './field-access-preview'
import { keyRolloverPreviews } from './key-rollover-preview'
import { tenantFieldProfilePreviews } from './tenant-field-profiles-preview'
import { protectedReadGraphPreviews } from './protected-read-graphs-preview'
import { memberFieldProfilePreviews } from './member-field-profiles-preview'
import { studioFirstTaskPreviews } from './studio-first-task-preview'
import { studioToolsPreviews } from './studio-tools-preview'
import { invitationPreviews } from './invitation-previews'
import { nodePickerPreviews } from './node-picker-preview'
import { navigationPreviews } from './navigation-preview'
import { localePreviews, localeFallbackPreviews } from './locale-previews'
import {
  accountLocalePreviews,
  updateLocalePreviews,
} from './management-locale-previews'
import {
  memberLocalePreviews,
  roleLocalePreviews,
} from './team-locale-previews'
import { studioFirstTaskLocalePreviews } from './studio-locale-previews'
import { studioDraftLocalePreviews } from './studio-draft-locale-previews'
import { studioGraphqlLocalePreviews } from './studio-graphql-locale-previews'
import { studioWebsocketLocalePreviews } from './studio-websocket-locale-previews'
import { dataSourceImportLocalePreviews } from './data-source-locale-previews'
import { dataSourceReplacementLocalePreviews } from './data-source-replacement-locale-previews'
import { dataApiLocalePreviews } from './data-api-locale-previews'
import { dataSourceGoogleLocalePreviews } from './data-source-google-locale-previews'
import { dataSourceDeleteLocalePreviews } from './data-source-delete-locale-previews'
import { dataSourceStatusLocalePreviews } from './data-source-status-locale-previews'
import { databaseCatalogLocalePreviews } from './database-catalog-locale-previews'
import { structPreviews } from './struct-previews'
import { collectionPreviews } from './collection-previews'
import { richTextPreviews } from './rich-text-previews'
import { formattedRichTextPreviews } from './formatted-rich-text-previews'
import { richTextBlockPreviews } from './rich-text-block-previews'
import { richTextInteractionPreviews } from './rich-text-interaction-previews'
import { richTextLocalePreviews } from './rich-text-locale-previews'
import { richTextHtmlPreviews } from './rich-text-html-previews'
import { richTextHtmlGuardPreviews } from './rich-text-html-guard-previews'
import { collectionRendererPreviews } from './collection-renderer-previews'
import { savedRendererPreviews } from './saved-renderer-preview-previews'
import {
  localeStartupPreviews,
  localeBootstrapPreviews,
} from './locale-startup-previews'

test.describe.configure({ mode: 'parallel' })

for (const [id, run] of [
  ['rich-text-html', richTextHtmlPreviews],
  ['rich-text-html-guards', richTextHtmlGuardPreviews],
  ['collection-renderers', collectionRendererPreviews],
  ['saved-renderer-preview', savedRendererPreviews],
] as const) {
  test.describe(id, () => {
    test.use({ locale: 'en-US' })

    test(id, async ({ page, previewWorkspace }) => {
      const { owner, origin } = previewWorkspace
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const { capture, complete } = storyCapture(page, id)

      await run({ page, owner, origin, capture })
      expect(errors).toEqual([])
      complete()
    })
  })
}

for (const [id, run] of [
  ['rich-text', richTextPreviews],
  ['formatted-rich-text', formattedRichTextPreviews],
  ['rich-text-blocks', richTextBlockPreviews],
  ['rich-text-interactions', richTextInteractionPreviews],
  ['rich-text-locales', richTextLocalePreviews],
] as const) {
  test.describe(id, () => {
    test.use({ locale: 'en-US' })

    test(id, async ({ page, previewWorkspace }) => {
      const { owner, origin } = previewWorkspace
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const { capture, complete } = storyCapture(page, id)

      await run({ page, owner, apiOrigin: origin, capture })
      expect(errors).toEqual([])
      complete()
    })
  })
}

test.describe('collections', () => {
  test.use({ locale: 'en-US' })

  test('collections', async ({ page, previewWorkspace }) => {
    const { owner, origin } = previewWorkspace
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { capture, complete } = storyCapture(page, 'collections')

    await collectionPreviews({ page, owner, apiOrigin: origin, capture })
    expect(errors).toEqual([])
    complete()
  })
})

test.describe('structs', () => {
  test.use({ locale: 'en-US' })

  test('structs', async ({ page, previewWorkspace }) => {
    const { owner, origin } = previewWorkspace
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { capture, complete } = storyCapture(page, 'structs')

    await structPreviews({ page, owner, apiOrigin: origin, capture })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: 'Light', exact: true }).click()
    const refreshed = page.waitForResponse(
      (response) =>
        response.url() === origin + '/api/structs' &&
        response.request().method() === 'GET',
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    expect((await refreshed).status()).toBe(200)
    await expect(
      page.getByRole('button', { name: 'Refresh', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByLabel('Field 2.1 label', { exact: true }),
    ).toHaveValue('Unit price')
    await expect(
      page.getByText('Draft revision 3', { exact: true }),
    ).toBeVisible()
    await capture(
      'Content models',
      'Refreshed content model catalog',
      'Explicit catalog refresh preserves the open saved model and does not synchronize or migrate its fields.',
    )
    expect(errors).toEqual([])
    complete()
  })
})

test(
  'core',
  { lock: ['clipboard', 'native-k6'] },
  async ({ page, context, request, previewWorkspace }) => {
    const { directory, setupKey } = previewWorkspace
    const core = storyCapture(page, 'core')
    const firstTask = storyCapture(page, 'first-task')
    let capturingFirstTask = false
    const capture: typeof core.capture = (...args) =>
      (capturingFirstTask ? firstTask.capture : core.capture)(...args)
    test.setTimeout(900_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

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

    async function fitGeneratedGraph() {
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
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      owner,
    )
    await capture(
      'Setup',
      'Copy owner key',
      'The copy action writes the generated key to the browser clipboard and shows confirmation.',
    )
    await page.getByLabel('I saved my owner key').check()
    await page.getByRole('button', { name: 'Enter studio' }).click()
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
    capturingFirstTask = true
    await studioFirstTaskPreviews({
      page,
      owner,
      apiOrigin: new URL(page.url()).origin,
      capture,
      signedIn: true,
      importSpreadsheet: false,
    })
    capturingFirstTask = false
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
    await navigate('Load testing')
    await expect(
      page.getByRole('heading', { name: 'Publish an API first' }),
    ).toBeVisible()
    await capture(
      'Load testing',
      'Publish before load testing',
      'The empty page explains how to publish a live API before testing. No k6 installation or caller credential is requested.',
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
    await page
      .getByRole('button', { name: 'Copy API key', exact: true })
      .click()
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
    expect(await live.json()).toEqual({
      message: 'Welcome to Besh',
      name: 'Ada',
    })
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

    await chooseNode(page, 'Condition')
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
    await chooseNode(page, 'Response')
    const responseBounds = await responseNode.boundingBox()
    const canvasBounds = await page.getByTestId('flow-canvas').boundingBox()
    if (!responseBounds || !canvasBounds)
      throw new Error('Response and canvas must be visible')
    const responseStart = { x: responseBounds.x + 40, y: responseBounds.y + 20 }
    await page.mouse.move(responseStart.x, responseStart.y)
    await page.mouse.down()
    await page.mouse.move(canvasBounds.x + 480, canvasBounds.y + 235, {
      steps: 12,
    })
    await page.mouse.up()
    const movedResponse = await responseNode.boundingBox()
    expect(movedResponse).not.toBeNull()
    expect(
      Math.abs(movedResponse!.x - responseBounds.x) +
        Math.abs(movedResponse!.y - responseBounds.y),
    ).toBeGreaterThan(20)
    await page
      .locator('.react-flow__pane')
      .click({ position: { x: 40, y: 220 } })
    await capture(
      'API Studio',
      'Add and position a response from picker',
      'Choose JSON response in the step picker, then drag its node to a new canvas position.',
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
    await chooseNode(page, 'Request')
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
    await capture(
      'API Studio',
      'Zoom in',
      'Canvas controls increase graph zoom.',
    )
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
      buffer: Buffer.from(
        'name,price,available\nTea,12,true\nCoffee,15,false\n',
      ),
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
    await page
      .getByRole('checkbox', { name: 'Filter rows', exact: true })
      .check()
    await capture(
      'API Studio',
      'Optional row match',
      'A column match can use a fixed typed value or a request input. This capture has not applied the edit.',
    )
    await page
      .getByRole('checkbox', { name: 'Filter rows', exact: true })
      .uncheck()
    await fitGeneratedGraph()
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
    await expect(page.getByRole('alert')).toContainText(
      'Simulated Google export',
    )
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
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      viewer,
    )
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
      { fullPage: false, region: 'listbox' },
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
    const restKeyRow = page
      .getByRole('row')
      .filter({ hasText: 'Welcome caller' })
    page.once('dialog', (dialog) => dialog.dismiss())
    await restKeyRow
      .getByRole('button', { name: 'Revoke', exact: true })
      .click()
    await expect(restKeyRow).toContainText('Active')
    await capture(
      'API keys',
      'Cancel key revocation',
      'Canceling the confirmation preserves access for the scoped caller key.',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await restKeyRow
      .getByRole('button', { name: 'Revoke', exact: true })
      .click()
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
    await expect(page.getByRole('alert')).toContainText(
      'temporarily unavailable',
    )
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
    await page
      .getByRole('button', { name: 'Create backup', exact: true })
      .click()
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
      'Additional product login providers, remote database adapters, custom plugins, and AI are explicitly marked planned.',
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
    for (const name of [
      'Members',
      'API keys',
      'Audit trail',
      'Data & backups',
    ]) {
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
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Query field 1 required', exact: true })
      .check()
    await page
      .getByRole('checkbox', { name: 'Validate response', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Add Response field', exact: true })
      .click()
    await page
      .getByLabel('Response field name 1', { exact: true })
      .fill('count')
    await page
      .getByRole('combobox', { name: 'Response field 1 type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
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
    await page
      .getByRole('option', { name: 'List of items', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Add Body item field', exact: true })
      .click()
    await page
      .getByLabel('Body item field name 1', { exact: true })
      .fill('name')
    await page
      .getByRole('checkbox', {
        name: 'Body item field 1 required',
        exact: true,
      })
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
      page.getByRole('checkbox', {
        name: 'Validate request body',
        exact: true,
      }),
    ).not.toBeChecked()
    await page
      .locator('details')
      .filter({
        has: page.getByLabel('Query field 1 minimum', { exact: true }),
      })
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
      await openApiTools(page)
      await page
        .getByRole('button', { name: 'Download OpenAPI', exact: true })
        .click()
      const document = await pending
      const filename = join(directory, `openapi-${Date.now()}.json`)
      await document.saveAs(filename)
      return JSON.parse(readFileSync(filename, 'utf8'))
    }

    await openApiTools(page)
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
      {
        name: 'count',
        in: 'query',
        required: true,
        schema: { type: 'integer' },
      },
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
      .getByRole('checkbox', {
        name: 'Response field 1 allow null',
        exact: true,
      })
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
      'Load testing',
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
        await expect(page.getByLabel('API name')).toHaveValue(
          'Welcome endpoint',
        )
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
      'Load testing',
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
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
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
      headers: { origin: previewWorkspace.origin },
      data: { token: owner },
    })
    expect(otherLogin.status()).toBe(200)
    await page
      .getByRole('button', { name: 'Refresh sessions', exact: true })
      .click()
    await expect(
      page.getByRole('button', {
        name: 'Revoke session for Owner',
        exact: true,
      }),
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
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
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
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await expect(page.locator('.flow-card.social')).toContainText(
      'GitHub login',
    )
    await page.locator('.flow-card.social').click()
    await expect(
      page.getByRole('combobox', { name: 'GitHub connection', exact: true }),
    ).toHaveText('Demo product')
    await fitGeneratedGraph()
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
    await expect(page.getByTestId('test-result')).not.toContainText(
      attempt.proof,
    )
    await expect(page.getByTestId('test-result')).not.toContainText(
      attempt.state,
    )
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
    await fitGeneratedGraph()
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
    await fitGeneratedGraph()
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
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
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

    await page.getByRole('button', { name: /Sign out/ }).click()
    await signIn(owner)
    await navigate('API keys')
    await expect(page.getByText('Loading API keys…')).toHaveCount(0)
    const rotationHeaders = { authorization: `Bearer ${owner}` }
    const rotationBefore = await (
      await page.request.get('/api/runtime-keys', { headers: rotationHeaders })
    ).json()
    const readerBefore = rotationBefore.find(
      (key: { name: string }) => key.name === 'GraphQL reader',
    )
    const rotationFlows = await (
      await page.request.get('/api/flows', { headers: rotationHeaders })
    ).json()
    const rotationFlow = rotationFlows.find(
      (flow: { name: string }) => flow.name === 'Welcome endpoint',
    )
    await page.getByLabel('Key name', { exact: true }).fill('Replacement demo')
    await page
      .getByRole('combobox', { name: 'Published API', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Welcome endpoint', exact: true })
      .click()
    const rotationIssued = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/runtime-keys') &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()
    const rotationOriginal = await (await rotationIssued).json()
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    const replacementRow = () =>
      page
        .getByRole('row')
        .filter({ hasText: 'Replacement demo' })
        .filter({
          has: page.getByText('Active', { exact: true }),
        })
    await expect(
      replacementRow().getByRole('button', {
        name: 'Replace key',
        exact: true,
      }),
    ).toBeEnabled()
    await capture(
      'API keys',
      'Review immediate key replacement',
      'An active caller key can be replaced without changing its published API, permissions, or expiration. Update the caller after replacement.',
    )
    page.once('dialog', (dialog) => dialog.dismiss())
    await replacementRow()
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    expect(
      (
        await page.request.post('/run/welcome', {
          headers: { authorization: `Bearer ${rotationOriginal.token}` },
          data: { name: 'Ada' },
        })
      ).status(),
    ).toBe(202)
    await capture(
      'API keys',
      'Cancel caller key replacement',
      'Canceling confirmation leaves the original caller key active. Its real HTTP request still succeeds.',
    )
    const replacementResponse = page.waitForResponse((response) =>
      response
        .url()
        .endsWith(`/api/runtime-keys/${rotationOriginal.id}/rotate`),
    )
    page.once('dialog', (dialog) => dialog.accept())
    await replacementRow()
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    const replacementResult = await replacementResponse
    expect(replacementResult.status()).toBe(200)
    const replacement = await replacementResult.json()
    expect(replacement.id).not.toBe(rotationOriginal.id)
    expect(replacement.flowId).toBe(rotationOriginal.flowId)
    expect(replacement.permissions).toEqual(['rest'])
    expect(replacement.expiresAt).toBe(rotationOriginal.expiresAt)
    await expect(
      page.getByRole('region', { name: 'Save API key', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create API key', exact: true }),
    ).toBeDisabled()
    await expect(
      replacementRow().getByRole('button', {
        name: 'Replace key',
        exact: true,
      }),
    ).toBeDisabled()
    await capture(
      'API keys',
      'Replacement key shown once',
      'The real server atomically revokes the old key and issues a new credential with unchanged scope and expiry. Its one-time value is masked.',
    )
    await page
      .getByRole('button', { name: 'Copy API key', exact: true })
      .click()
    expect(
      await page.evaluate(
        (secret) =>
          navigator.clipboard.readText().then((value) => value === secret),
        replacement.token,
      ),
    ).toBe(true)
    await capture(
      'API keys',
      'Copy replacement caller key',
      'Copy saves the replacement to the clipboard through an explicit action. The screenshot keeps the credential hidden.',
    )
    await appearance('Dark')
    await capture(
      'API keys',
      'Dark one-time replacement key',
      'Metadata, immediate replacement guidance, and masked credential actions remain readable in dark appearance.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      'Replacement API key',
      'Phone layout contains the scoped metadata and one-time replacement actions in dark appearance.',
    )
    await appearance('Light')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await capture(
      'Mobile',
      'Replacement API key',
      'Light phone layout keeps copy and acknowledgment accessible while the credential is masked.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    await expect(page.getByLabel('New API key', { exact: true })).toHaveCount(0)
    await capture(
      'API keys',
      'Acknowledge replacement key',
      'Acknowledgment clears the one-time credential. The old revoked record and new active record remain visible.',
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await notice('API keys refreshed')
    await capture(
      'API keys',
      'Refresh replacement metadata',
      'A real metadata refresh preserves both history and unchanged replacement permissions/expiration without returning tokens.',
    )
    expect(
      (
        await page.request.post('/run/welcome', {
          headers: { authorization: `Bearer ${rotationOriginal.token}` },
          data: { name: 'Ada' },
        })
      ).status(),
    ).toBe(401)
    const replacementLive = await page.request.post('/run/welcome', {
      headers: { authorization: `Bearer ${replacement.token}` },
      data: { name: 'Ada' },
    })
    expect(replacementLive.status()).toBe(202)
    expect(await replacementLive.json()).toEqual({
      message: 'New draft response',
    })
    await capture(
      'API keys',
      'Old caller rejected and new caller succeeds',
      'Real published REST requests return 401 with the old key and the existing HTTP 202 response with the replacement.',
    )

    const readerRow = page
      .getByRole('row')
      .filter({ hasText: 'GraphQL reader' })
      .filter({ has: page.getByText('Active', { exact: true }) })
    const readerRotated = page.waitForResponse((response) =>
      response.url().endsWith(`/api/runtime-keys/${readerBefore.id}/rotate`),
    )
    page.once('dialog', (dialog) => dialog.accept())
    await readerRow
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    const readerReplacement = await (await readerRotated).json()
    expect(readerReplacement.permissions).toEqual(['query'])
    expect(readerReplacement.expiresAt).toBe(readerBefore.expiresAt)
    await expect(
      page.getByRole('region', { name: 'Save API key', exact: true }),
    ).toBeVisible()
    await capture(
      'API keys',
      'Replace a GraphQL reader key',
      'A query-only GraphQL credential stays query-only. The published release is used even when its editable draft has an invalid schema.',
    )
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    const readerHeaders = { authorization: `Bearer ${readerReplacement.token}` }
    expect(
      (
        await page.request.post('/graphql/greeting', {
          headers: { authorization: `Bearer ${graphKey}` },
          data: { query: '{ greet(name: "Ada") { name } }' },
        })
      ).status(),
    ).toBe(401)
    const readerLive = await page.request.post('/graphql/greeting', {
      headers: readerHeaders,
      data: { query: '{ greet(name: "Ada") { message name } }' },
    })
    expect(await readerLive.json()).toEqual({
      data: { greet: { message: 'Hello from GraphQL', name: 'Ada' } },
    })
    expect(
      (
        await page.request.post('/graphql/greeting', {
          headers: readerHeaders,
          data: { query: 'mutation { greet(name: "Grace") { name } }' },
        })
      ).status(),
    ).toBe(403)
    await capture(
      'API keys',
      'Replacement preserves GraphQL grants',
      'The new key serves the published query, rejects mutations with 403, and the old key returns 401. Replacement cannot broaden access.',
    )

    const staleKey = await (
      await page.request.post('/api/runtime-keys', {
        headers: rotationHeaders,
        data: {
          name: 'Stale replacement',
          flowId: rotationFlow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await notice('API keys refreshed')
    expect(
      (
        await page.request.delete(`/api/runtime-keys/${staleKey.id}`, {
          headers: rotationHeaders,
        })
      ).status(),
    ).toBe(200)
    const rejectedReplacement = page.waitForResponse((response) =>
      response.url().endsWith(`/api/runtime-keys/${staleKey.id}/rotate`),
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('row')
      .filter({ hasText: 'Stale replacement' })
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    expect((await rejectedReplacement).status()).toBe(409)
    await expect(page.getByRole('alert')).toBeVisible()
    await capture(
      'API keys',
      'Server rejects a stale replacement',
      'The key was revoked through another real management request after this list loaded. Replacement returns 409 with a helpful error and no new credential.',
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await notice('API keys refreshed')
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Stale replacement' })
        .getByRole('button', { name: 'Replace key', exact: true }),
    ).toHaveCount(0)
    await capture(
      'API keys',
      'Refresh revoked replacement state',
      'Refreshing reads current server metadata and removes replacement controls from the revoked record.',
    )
    const shortExpiry = new Date(Date.now() + 5_000).toISOString()
    const shortKeyResponse = await page.request.post('/api/runtime-keys', {
      headers: rotationHeaders,
      data: {
        name: 'Expired replacement',
        flowId: rotationFlow.id,
        permissions: ['rest'],
        expiresAt: shortExpiry,
      },
    })
    expect(shortKeyResponse.status()).toBe(200)

    const shortKey = await shortKeyResponse.json()
    expect(shortKey.expiresAt).toBe(shortExpiry)

    await expect
      .poll(() => Date.now() >= Date.parse(shortKey.expiresAt), {
        timeout: 10_000,
      })
      .toBe(true)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await notice('API keys refreshed')
    const expiredRow = page
      .getByRole('row')
      .filter({ hasText: 'Expired replacement' })
    await expect(expiredRow).toContainText('Expired')
    await expect(
      expiredRow.getByRole('button', { name: 'Replace key', exact: true }),
    ).toHaveCount(0)
    await capture(
      'API keys',
      'Expired keys cannot be replaced',
      'An expired credential cannot be revived or extended through replacement. Create a new reviewed caller key instead.',
    )
    await navigate('Audit trail')
    await expect(
      page
        .getByRole('cell', { name: 'runtime-key.revoked', exact: true })
        .first(),
    ).toBeVisible()
    await expect(
      page
        .getByRole('cell', { name: 'runtime-key.created', exact: true })
        .first(),
    ).toBeVisible()
    await capture(
      'Audit trail',
      'Key replacement audit history',
      'Old-key revocation and new-key creation are recorded in the same transaction. Audit records contain resource IDs and actors, never credential values.',
    )
    await page.getByRole('button', { name: /Sign out/ }).click()
    await signIn(editor)
    await navigate('API keys')
    await expect(
      page.getByRole('heading', { name: 'Owner access required', exact: true }),
    ).toBeVisible()
    await capture(
      'Permissions',
      'Editor denied API key replacement',
      'Editors cannot issue, replace, or revoke runtime credentials. Management rights are separate from published caller access.',
    )

    await navigate('Load testing')
    await expect(
      page.getByRole('heading', { name: 'Owner access required' }),
    ).toBeVisible()
    await capture(
      'Permissions',
      'Editor denied load testing',
      'Only workspace owners can run, cancel, or view load tests. Published caller access remains separate.',
    )
    await page.getByRole('button', { name: /Sign out/ }).click()
    await signIn(owner)
    await navigate('Load testing')
    await expect(
      page.getByRole('combobox', { name: 'Published API' }),
    ).toBeVisible()
    await page.getByRole('combobox', { name: 'Published API' }).click()
    await capture(
      'Load testing',
      'Choose a published load target',
      'The custom dropdown lists actual published APIs. Draft changes do not supply the displayed route or schema.',
    )
    await page.getByRole('option', { name: /Welcome endpoint/ }).click()
    await expect(
      page.getByRole('button', { name: 'Run load test', exact: true }),
    ).toBeEnabled()
    await capture(
      'Load testing',
      'Default k6 test ready',
      'The ready-to-run test uses one virtual user for five seconds. Besh prepares k6 and temporary API access automatically.',
    )
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(page.getByText('No load tests yet.')).toBeVisible()
    await capture(
      'Load testing',
      'Cancel live load confirmation',
      'Declining the repeated live-request confirmation creates no job and sends no load.',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    const loadResults = page.getByRole('region', { name: 'Load test results' })
    await expect(loadResults).toContainText('Preparing k6 or running')
    await capture(
      'Load testing',
      'Real k6 run in progress',
      'A real native k6 process calls the published local API. Navigation stays available while the server owns the job.',
    )
    await expect(loadResults).toContainText('All limits passed', {
      timeout: 30_000,
    })
    await capture(
      'Load testing',
      'Default k6 report',
      'Actual k6 metrics show request count, throughput, HTTP errors, response checks, average, p95, and slowest response. This small local run does not certify production capacity.',
    )
    await page.reload()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await navigate('Load testing')
    await expect(loadResults).toContainText('All limits passed')
    await capture(
      'Load testing',
      'Restore load history after reload',
      'Saved metadata and summary return after session restoration. Request values and temporary credentials are not in history.',
    )
    await page.getByRole('combobox', { name: 'Published API' }).click()
    await page.getByRole('option', { name: /Welcome endpoint/ }).click()
    await page
      .getByRole('button', { name: 'Request inputs', exact: true })
      .click()
    await page.getByRole('button', { name: 'Add query parameter' }).click()
    await page.getByLabel('Query name 1', { exact: true }).fill('product')
    await page.getByLabel('Query value 1', { exact: true }).fill('demo')
    await page.getByRole('button', { name: 'Add body field' }).click()
    await page.getByLabel('Body name 1', { exact: true }).fill('name')
    await page.getByLabel('Body value 1', { exact: true }).fill('Ada')
    await capture(
      'Load testing',
      'Load request field forms',
      'Query and body fields use readable forms. Common REST tests do not need JSON editing.',
    )
    await page
      .getByRole('button', { name: 'Advanced request JSON', exact: true })
      .click()
    await capture(
      'Load testing',
      'Optional advanced load request',
      'An optional JSON editor preserves the same query/body values for complex inputs.',
    )
    await page
      .getByRole('button', { name: 'Advanced request JSON', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Virtual users', { exact: true }).fill('2')
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    await page.getByRole('combobox', { name: 'Expected response' }).click()
    await capture(
      'Load testing',
      'Custom load settings dropdown',
      'Optional virtual-user, duration, response-time, error-budget, and expected-status controls use custom keyboard-accessible dropdowns.',
    )
    await page.getByRole('option', { name: 'A specific status' }).click()
    await page.getByLabel('Expected status', { exact: true }).fill('201')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(loadResults).toContainText('Some limits failed', {
      timeout: 15_000,
    })
    await capture(
      'Load testing',
      'Completed report with failed checks',
      'The live endpoint returns 202 while this test expects 201. k6 records failed response checks instead of treating a completed run as a pass.',
    )
    await appearance('Dark')
    await capture(
      'Load testing',
      'Dark k6 report',
      'Load settings, limits, metrics, and history remain readable in dark appearance.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      'k6 report and settings',
      'Metrics and custom settings stay inside the phone viewport in dark appearance.',
    )
    await appearance('Light')
    await capture(
      'Mobile',
      'k6 report and settings',
      'Light phone layout keeps load results and optional settings readable without document overflow.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('combobox', { name: 'Published API' }).click()
    await page.getByRole('option', { name: /GraphQL greeting/ }).click()
    await expect(page.getByLabel('GraphQL query or mutation')).not.toHaveValue(
      '',
    )
    await capture(
      'Load testing',
      'GraphQL load test example',
      'The query example comes from the actual published schema, even while its saved draft is invalid. Besh detects query or mutation access automatically.',
    )
    await page
      .getByLabel('GraphQL query or mutation')
      .fill(
        'mutation LoadGreeting($name: String!) { greet(name: $name) { message name } }',
      )
    await page.getByLabel('New variable name', { exact: true }).fill('name')
    await page
      .getByRole('button', { name: 'Add variable', exact: true })
      .click()
    await page.getByLabel('Variable name', { exact: true }).fill('Ada')
    await page
      .getByRole('button', { name: 'Load settings', exact: true })
      .click()
    await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
    await capture(
      'Load testing',
      'GraphQL mutation variable forms',
      'Operation text can use variables supplied through labeled fields. JSON remains optional for nested variables.',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(loadResults).toContainText('All limits passed', {
      timeout: 15_000,
    })
    await capture(
      'Load testing',
      'Real GraphQL k6 report',
      'Actual native k6 calls the published mutation and checks both its HTTP status and GraphQL data without errors.',
    )
    await page.getByLabel('Duration in seconds', { exact: true }).fill('30')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Run load test', exact: true })
      .click()
    await expect(
      loadResults.getByRole('button', { name: 'Cancel run' }),
    ).toBeEnabled()
    const previewLoads = await (
      await page.request.get('/api/load-tests', { headers: rotationHeaders })
    ).json()
    const activeLoad = previewLoads.find(
      (run: { status: string }) => run.status === 'running',
    )
    expect(activeLoad).toBeTruthy()
    await navigate('API keys')
    const managedPreviewKey = page
      .getByRole('row')
      .filter({ hasText: `Load test ${activeLoad.id}` })
    await expect(managedPreviewKey).toContainText('Managed by load testing')
    await expect(
      managedPreviewKey.getByRole('button', {
        name: 'Replace key',
        exact: true,
      }),
    ).toHaveCount(0)
    await capture(
      'API keys',
      'Managed temporary load test key',
      'The active job key is labeled managed. Replacement is unavailable; the server keeps its raw token private and revokes it automatically.',
    )
    await navigate('Load testing')
    await expect(
      loadResults.getByRole('button', { name: 'Cancel run' }),
    ).toBeEnabled()
    await loadResults.getByRole('button', { name: 'Cancel run' }).click()
    await expect(loadResults).toContainText('Canceled')
    await capture(
      'Load testing',
      'Cancel active k6 run',
      'Cancel revokes the temporary runtime key and stops the process. Requests already sent may finish; their effects are not rolled back.',
    )
    await page.getByRole('combobox', { name: 'Published API' }).click()
    await page.getByRole('option', { name: /GitHub REST login/ }).click()
    await expect(
      page.getByText('Product login APIs cannot be load tested automatically', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Run load test', exact: true }),
    ).toBeDisabled()
    await capture(
      'Load testing',
      'Product login excluded from automatic load',
      'The published GitHub login flow cannot manufacture repeated authorization attempts through load testing.',
    )
    await page.route('**/api/load-tests/targets', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Preview connection interrupted' }),
      }),
    )
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Preview connection interrupted' }),
    ).toBeVisible()
    await capture(
      'Load testing',
      'Load history connection error',
      'This labeled controlled transport failure shows helpful Refresh recovery. Completed report data remains available.',
    )
    await page.unroute('**/api/load-tests/targets')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Preview connection interrupted' }),
    ).toHaveCount(0)
    await capture(
      'Load testing',
      'Refresh load testing metadata',
      'Refresh recovers current published targets and recent reports from real HTTP routes.',
    )
    await navigate('Audit trail')
    await expect(
      page
        .getByRole('cell', { name: 'load-test.canceled', exact: true })
        .first(),
    ).toBeVisible()
    await expect(
      page
        .getByRole('cell', { name: 'load-test.completed', exact: true })
        .first(),
    ).toBeVisible()
    await capture(
      'Audit trail',
      'Load test audit events',
      'Job start, completion, cancellation, and temporary key lifecycle use metadata-only audit records.',
    )
    await navigate('API Studio')
    await page.getByRole('button', { name: 'New API', exact: true }).click()
    await page
      .getByLabel('API name', { exact: true })
      .fill('Versioned customer API')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v1/preview-customers/:id')
    await page.getByLabel('Path parameter id', { exact: true }).fill('42')
    await capture(
      'API Studio',
      'Versioned route input forms',
      'A named whole route segment supplies a labeled path parameter input. Versions such as /v1 are ordinary route prefixes.',
    )
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await page
      .getByRole('checkbox', { name: 'Validate path parameters', exact: true })
      .check()
    await page
      .getByRole('combobox', { name: 'Path id type', exact: true })
      .click()
    await capture(
      'API Studio',
      'Scalar path rule choices',
      'Route names are fixed and required. Scalar path types use the same custom controls as other API rules.',
    )
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
    await capture(
      'API Studio',
      'Path parameter response reference',
      'Response fields can read a path parameter without writing reference syntax or JSON.',
    )
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await notice('Draft saved')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText('"id": 42')
    await capture(
      'API Studio',
      'Typed route draft test',
      'Actual server validation converts the declared path integer and returns 42 in the draft response.',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await notice('Published')
    const routePreviewFlow = (
      await (
        await page.request.get('/api/flows', { headers: rotationHeaders })
      ).json()
    ).find((flow: { name: string }) => flow.name === 'Versioned customer API')
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/v2/preview-customers/:id')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await notice('Draft saved')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await notice('Published')
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Release history', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Review release 1', exact: true }),
    ).toBeVisible()
    await capture(
      'API Studio',
      'Versioned release history',
      'Immutable releases show their actual method and route, creation time, and current live status.',
    )
    await page
      .getByRole('button', { name: 'Review release 2', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Roll back to release 2', exact: true }),
    ).toBeDisabled()
    await capture(
      'API Studio',
      'Current release review',
      'The current release is read only and cannot be rolled back to itself.',
    )
    await page
      .getByLabel('API name', { exact: true })
      .fill('Unsaved customer idea')
    await page
      .getByRole('button', { name: 'Review release 1', exact: true })
      .click()
    await capture(
      'API Studio',
      'Review historical route with unsaved draft',
      'The selected immutable release uses /v1 while the editable /v2 draft and unsaved name remain intact.',
    )
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await capture(
      'API Studio',
      'Confirm historical rollback',
      'Confirmation identifies the target revision and route. Existing caller keys follow the selected release; draft changes are preserved.',
    )
    // The modal makes background theme controls inert; close it before changing appearance.
    await page
      .getByRole('button', { name: 'Cancel rollback', exact: true })
      .click()
    await appearance('Dark')
    await capture(
      'Appearance',
      'Dark route and release forms',
      'Path inputs, scalar validation rules, and release review remain readable in dark appearance.',
    )
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await capture(
      'Appearance',
      'Dark rollback confirmation',
      'Target route and action buttons remain readable in the custom styled confirmation.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      'Route rollback confirmation',
      'The focus-contained confirmation fits the phone viewport in dark appearance.',
    )
    await page
      .getByRole('button', { name: 'Cancel rollback', exact: true })
      .click()
    await appearance('Light')
    await capture(
      'Mobile',
      'Route inputs and release history',
      'Versioned endpoint settings, path forms, and stacked release cards stay contained on phones.',
    )
    await page
      .getByRole('button', { name: 'Roll back to release 1', exact: true })
      .click()
    await capture(
      'Mobile',
      'Route rollback confirmation',
      'Light phone confirmation keeps revision, route, and draft-preservation information visible.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.request.post(`/api/flows/${routePreviewFlow.id}/rollback`, {
      headers: rotationHeaders,
      data: { revision: 1, publishedRevision: 2 },
    })
    await page
      .getByRole('button', { name: 'Confirm rollback', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Confirm rollback' }).getByRole('alert'),
    ).toBeVisible()
    await capture(
      'API Studio',
      'Stale live release rollback error',
      'A real competing rollback changes the live release. The server rejects the stale confirmation and the dialog explains refresh recovery.',
    )
    await page
      .getByRole('button', { name: 'Cancel rollback', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Refresh releases', exact: true })
      .click()
    await expect(
      page.getByLabel('Published endpoint URL', { exact: true }),
    ).toHaveValue(/\/run\/v1\/preview-customers\/:id$/)
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'Unsaved customer idea',
    )
    await capture(
      'API Studio',
      'Rollback refresh preserves draft',
      'Refreshing history recovers the actual /v1 endpoint while the /v2 saved draft and unsaved name stay unchanged.',
    )
    await page.route(`**/api/flows/${routePreviewFlow.id}/releases`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Preview release history connection interrupted',
        }),
      }),
    )
    await page
      .getByRole('button', { name: 'Refresh releases', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Preview release history connection interrupted',
    )
    await capture(
      'API Studio',
      'Release history read error',
      'This labeled transport failure offers refresh recovery and changes no draft or live release.',
    )
    await page.unroute(`**/api/flows/${routePreviewFlow.id}/releases`)
    await page
      .getByRole('button', { name: 'Refresh releases', exact: true })
      .click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await notice('Draft saved')
    await navigate('Load testing')
    await page
      .getByRole('combobox', { name: 'Published API', exact: true })
      .click()
    await page.getByRole('option', { name: /Versioned customer API/ }).click()
    await expect(
      page.getByLabel('Path parameter id', { exact: true }),
    ).toBeVisible()
    await page.getByLabel('Path parameter id', { exact: true }).fill('42')
    await capture(
      'Load testing',
      'Concrete route parameter inputs',
      'The actual published /v1 route supplies labeled path inputs. A concrete id is required; no URL or JSON editor is needed.',
    )
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
    await capture(
      'Load testing',
      'Actual parameterized route k6 report',
      'Native k6 calls the published route with the concrete path value and validates its response. History retains the route template, never submitted values.',
    )
    await navigate('API Studio')
    const routePreviewViewer = await (
      await page.request.post('/api/members', {
        headers: rotationHeaders,
        data: { name: 'Release reviewer', role: 'viewer' },
      })
    ).json()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(routePreviewViewer.token)
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Release history', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Review release 2', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Release review' }),
    ).toContainText('Publish and roll back access')
    await capture(
      'Permissions',
      'Viewer reads release history',
      'Viewers can inspect release metadata and routes. Rollback and publication require their own explicit grant.',
    )
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(owner)
    await navigate('Members')
    await expect(
      page.getByRole('button', { name: 'New role', exact: true }),
    ).toBeEnabled()
    await capture(
      'Members',
      'Built-in roles and custom role entry',
      'Owners alone create roles and assign members. Existing owner, editor, and viewer choices stay available.',
    )
    await page.getByRole('button', { name: 'New role', exact: true }).click()
    await page
      .getByLabel('Role name', { exact: true })
      .fill('API tester preview')
    await capture(
      'Members',
      'Account-only custom role form',
      'An empty grant list allows sign-in and management of the member’s own account and sessions.',
    )
    await page.getByRole('checkbox', { name: 'Read APIs', exact: true }).check()
    await page
      .getByRole('checkbox', { name: 'Test drafts', exact: true })
      .check()
    await page
      .getByRole('checkbox', { name: 'Manage workspace backups', exact: true })
      .check()
    await page
      .getByRole('checkbox', { name: 'Run load tests', exact: true })
      .check()
    await capture(
      'Members',
      'Grouped action permissions and sensitive grants',
      'API edit, test, and publication grants are separate. Backup access exposes complete workspace data; load tests can repeat live writes.',
    )
    await appearance('Dark')
    await capture(
      'Appearance',
      'Dark custom permission controls',
      'Permission groups, descriptions, selected checkboxes, and sensitive-grant warnings stay readable in dark appearance.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      'Custom role grant editor',
      'Permission groups stack into one column without exposing native controls or overflowing the phone viewport.',
    )
    await appearance('Light')
    await capture(
      'Mobile',
      'Custom role grant editor',
      'Light phone layout keeps grant descriptions and save/cancel controls readable.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page
      .getByRole('checkbox', { name: 'Manage workspace backups', exact: true })
      .uncheck()
    await page
      .getByRole('checkbox', { name: 'Run load tests', exact: true })
      .uncheck()
    await page.getByRole('button', { name: 'Save role', exact: true }).click()
    await notice('Role created')
    await capture(
      'Members',
      'Saved read-and-test role',
      'The custom role grants API reading and draft testing, while editing and publication remain absent.',
    )
    await page
      .getByLabel('Member name', { exact: true })
      .fill('Custom API reviewer')
    await page
      .getByRole('combobox', { name: 'Member role', exact: true })
      .click()
    await capture(
      'Members',
      'Assign a custom role during member creation',
      'The custom role selector joins built-in options. Member creation and assignment happen atomically.',
    )
    await page
      .getByRole('option', {
        name: 'API tester preview · custom role',
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    const rolePreviewToken = await page
      .getByLabel('New member token', { exact: true })
      .inputValue()
    await capture(
      'Members',
      'Custom member credential and role badge',
      'The one-time member credential is masked. The table shows the human role name and an owner-controlled assignment selector.',
    )
    await page.getByRole('button', { name: 'I saved it', exact: true }).click()
    const rolePreviewRecord = (
      await (
        await page.request.get('/api/roles', { headers: rotationHeaders })
      ).json()
    ).find((role: { name: string }) => role.name === 'API tester preview')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(rolePreviewToken)
    await expect(
      page.getByRole('button', { name: 'Save draft', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()
    await page.getByLabel('Path parameter id', { exact: true }).fill('42')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText('"id": 42')
    await capture(
      'Permissions',
      'Custom tester executes saved draft',
      'This custom role can read and execute the draft through real HTTP. Save and Publish stay disabled, and request fields remain usable for testing.',
    )
    await page.request.put(`/api/roles/${rolePreviewRecord.id}`, {
      headers: rotationHeaders,
      data: {
        name: 'Account only preview',
        permissions: [],
        version: rolePreviewRecord.version,
      },
    })
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByLabel('Workspace token')).toBeVisible()
    await capture(
      'Permissions',
      'Changed grants revoke active browser session',
      'A real owner grant edit ends this member’s cookie session. The next private request returns to sign-in and clears the prior workspace view.',
    )
    await page.getByLabel('Workspace token').fill(rolePreviewToken)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await capture(
      'Permissions',
      'Account-only member landing',
      'A member without API-reading permission signs in successfully and starts at their own account and sessions, without loading private flow records.',
    )
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Account & sessions', exact: true }),
    ).toBeVisible()
    await capture(
      'Permissions',
      'Account-only session restores after reload',
      'Reload restores the authenticated account-only workspace and shows the custom role’s human name.',
    )
    await navigate('API Studio')
    await expect(
      page.getByRole('heading', { name: 'Permission required', exact: true }),
    ).toBeVisible()
    await capture(
      'Permissions',
      'Missing grant blocks private API page',
      'The dashboard explains the required API-read grant before mounting the builder or fetching private flow records.',
    )
    await appearance('Dark')
    await page.setViewportSize({ width: 390, height: 844 })
    await navigate('Account & sessions')
    await capture(
      'Mobile dark',
      'Account-only workspace access',
      'Own-account controls remain available on phones even when every delegated workspace grant is absent.',
    )
    await appearance('Light')
    await capture(
      'Mobile',
      'Account-only workspace access',
      'The local workspace role badge and own-session controls remain readable in light phone appearance.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(owner)
    await navigate('Members')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete Account only preview', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
    ).toContainText(/reassign|assigned/i)
    await capture(
      'Members',
      'Assigned role deletion rejected',
      'The actual server refuses deleting a role still assigned to a member. Existing membership and grants stay intact.',
    )
    await page
      .getByRole('button', { name: 'Edit Account only preview', exact: true })
      .click()
    await page
      .getByLabel('Role name', { exact: true })
      .fill('Unsaved conflicting role name')
    const rolePreviewCurrent = (
      await (
        await page.request.get('/api/roles', { headers: rotationHeaders })
      ).json()
    ).find((role: { id: string }) => role.id === rolePreviewRecord.id)
    await page.request.put(`/api/roles/${rolePreviewRecord.id}`, {
      headers: rotationHeaders,
      data: {
        name: 'Current account role',
        permissions: [],
        version: rolePreviewCurrent.version,
      },
    })
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Save role', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
    ).toContainText(/changed|version|conflict/i)
    await capture(
      'Members',
      'Concurrent role edit conflict',
      'An actual competing owner edit increments the role version. The server rejects this stale save; the unsaved form remains available for review.',
    )
    await page
      .getByRole('button', { name: 'Cancel role changes', exact: true })
      .click()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    const rolePreviewMemberRow = page
      .getByRole('row')
      .filter({ hasText: 'Custom API reviewer' })
    await rolePreviewMemberRow
      .getByRole('combobox', {
        name: 'Role for Custom API reviewer',
        exact: true,
      })
      .click()
    await page
      .getByRole('option', { name: 'Viewer · read APIs', exact: true })
      .click()
    page.once('dialog', (dialog) => dialog.dismiss())
    await rolePreviewMemberRow
      .getByRole('button', { name: 'Change role', exact: true })
      .click()
    await expect(rolePreviewMemberRow).toContainText('Current account role')
    await capture(
      'Members',
      'Canceled member role assignment',
      'Canceling confirmation leaves the custom role assigned. The selected replacement remains a local form choice until confirmed.',
    )
    let deliverRoleAssignment!: () => void
    const roleAssignmentDelivery = new Promise<void>((resolve) => {
      deliverRoleAssignment = resolve
    })
    let receiveRoleAssignment!: () => void
    const roleAssignmentReceipt = new Promise<void>((resolve) => {
      receiveRoleAssignment = resolve
    })
    await page.route('**/api/members/*/role', async (route) => {
      const response = await route.fetch()
      receiveRoleAssignment()
      await roleAssignmentDelivery
      await route.fulfill({ response })
    })
    page.once('dialog', (dialog) => dialog.accept())
    await rolePreviewMemberRow
      .getByRole('button', { name: 'Change role', exact: true })
      .click()
    await roleAssignmentReceipt
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()
    await capture(
      'Members',
      'Pending member role change guards navigation',
      'Only transport delivery is delayed after a real assignment. Duplicate actions, sign-out, and workspace navigation stay blocked while the result is pending.',
    )
    deliverRoleAssignment()
    await notice('Member role updated')
    await page.unroute('**/api/members/*/role')
    await capture(
      'Members',
      'Confirmed built-in role assignment',
      'The member now uses Viewer permissions. Assignment ends their prior browser sessions and immediately changes bearer-key permissions.',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete Current account role', exact: true })
      .click()
    await notice('Role deleted')
    await capture(
      'Members',
      'Delete an unused custom role',
      'After reassignment, the owner can delete the unused role with its current version. Built-in roles remain available.',
    )
    await page.route('**/api/permissions', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Preview permission choices connection interrupted',
        }),
      }),
    )
    await navigate('Audit trail')
    await navigate('Members')
    await expect(
      page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
    ).toContainText('Preview permission choices connection interrupted')
    await capture(
      'Members',
      'Permission catalog read error',
      'This labeled transport error blocks role editing until the real permission choices can be retrieved again.',
    )
    await page.unroute('**/api/permissions')
    await page
      .getByRole('button', { name: 'Retry permission choices', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'New role', exact: true }),
    ).toBeEnabled()
    await capture(
      'Members',
      'Recover permission catalog choices',
      'Retry restores the authenticated permission inventory without changing any role or member grants.',
    )
    const updateBaseline = (await (
      await page.request.get('/api/updates', { headers: rotationHeaders })
    ).json()) as UpdateState
    let updateNotice: UpdateState = {
      currentVersion: updateBaseline.currentVersion,
      settings: {
        repositoryUrl: 'https://github.com/example/besh',
        includePrereleases: true,
        revision: 1,
        updatedAt: null,
      },
      lastCheck: null,
    }
    let updateReadError = true
    let updateSaveConflict = false
    let updateCheckMode:
      'available' | 'current' | 'no-releases' | 'error' | 'cooldown' =
      'available'
    let updateGets = 0
    let updateChecks = 0
    let delayUpdateCheck = true
    let deliverUpdateCheck!: () => void
    const updateCheckDelivery = new Promise<void>((resolve) => {
      deliverUpdateCheck = resolve
    })
    let receiveUpdateCheck!: () => void
    const updateCheckReceipt = new Promise<void>((resolve) => {
      receiveUpdateCheck = resolve
    })
    await page.route('**/api/updates', async (route) => {
      if (route.request().method() === 'GET') {
        updateGets++
        if (updateReadError)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Preview fixture: update settings connection interrupted',
            }),
          })
      } else if (route.request().method() === 'PUT') {
        if (updateSaveConflict)
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error:
                'Preview fixture: Update settings changed. Refresh before saving.',
            }),
          })
        const values = route.request().postDataJSON()
        updateNotice = {
          ...updateNotice,
          settings: {
            repositoryUrl: values.repositoryUrl,
            includePrereleases: values.includePrereleases,
            revision: updateNotice.settings.revision + 1,
            updatedAt: new Date().toISOString(),
          },
          lastCheck: null,
        }
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(updateNotice),
      })
    })
    await page.route('**/api/updates/check', async (route) => {
      updateChecks++
      if (updateCheckMode === 'cooldown')
        return route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error:
              'Preview fixture: Wait one minute before checking releases again',
          }),
        })
      if (delayUpdateCheck) {
        receiveUpdateCheck()
        await updateCheckDelivery
        delayUpdateCheck = false
      }
      updateNotice = {
        ...updateNotice,
        lastCheck: {
          status: updateCheckMode,
          checkedAt: new Date().toISOString(),
          release:
            updateCheckMode === 'available' || updateCheckMode === 'current'
              ? {
                  version:
                    updateCheckMode === 'available'
                      ? '0.99.0-beta.2'
                      : updateNotice.currentVersion,
                  tag:
                    updateCheckMode === 'available'
                      ? 'v0.99.0-beta.2'
                      : `v${updateNotice.currentVersion}`,
                  name: 'Preview fixture — example public release',
                  url: 'https://github.com/example/besh/releases/tag/v0.99.0-beta.2',
                  publishedAt: new Date().toISOString(),
                  prerelease: true,
                }
              : null,
          error:
            updateCheckMode === 'error'
              ? 'Preview fixture: GitHub release check unavailable. Try again later.'
              : null,
        },
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(updateNotice),
      })
    })
    await navigate('Updates')
    await expect(page.getByRole('alert')).toContainText(
      'Preview fixture: update settings connection interrupted',
    )
    await capture(
      'Updates',
      'Update settings read error',
      'Controlled Besh UI fixture: a saved-settings read fails. No GitHub check or installer runs.',
    )
    updateReadError = false
    await page
      .getByRole('button', { name: 'Refresh update settings', exact: true })
      .click()
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/besh')
    await capture(
      'Updates',
      'Initial release notice settings',
      'Controlled Besh UI fixture: installed version, public repository choice, and preview-channel control appear before any release check.',
    )
    await page
      .getByLabel('GitHub repository', { exact: true })
      .fill('https://github.com/example/unsaved')
    await expect(
      page.getByRole('button', { name: 'Check releases', exact: true }),
    ).toBeDisabled()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Refresh update settings', exact: true })
      .click()
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/unsaved')
    await capture(
      'Updates',
      'Cancel unsaved update settings refresh',
      'Controlled Besh UI fixture: canceled discard confirmation preserves the typed repository; release checks remain disabled until settings are saved.',
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Refresh update settings', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Include preview releases', exact: true })
      .uncheck()
    await capture(
      'Updates',
      'Stable release channel selection',
      'Controlled Besh UI fixture: the keyboard-accessible styled checkbox excludes alpha and beta notices when saved.',
    )
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await notice('Update settings saved')
    await page
      .getByRole('checkbox', { name: 'Include preview releases', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await notice('Update settings saved')
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await updateCheckReceipt
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()
    await capture(
      'Updates',
      'Pending release check guards navigation',
      'Controlled Besh UI fixture: delayed management delivery keeps checking, settings writes, sign-out, and navigation disabled.',
    )
    deliverUpdateCheck()
    await expect(
      page.getByText('Update available', { exact: true }),
    ).toBeVisible()
    await capture(
      'Updates',
      'Available GitHub release notice',
      'Controlled Besh UI fixture: a newer preview release has a public notes link. The application reports versions and offers no installation action.',
    )
    const updateCheckCount = updateChecks
    await page.reload()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await navigate('Updates')
    await expect(
      page.getByText('Update available', { exact: true }),
    ).toBeVisible()
    expect(updateChecks).toBe(updateCheckCount)
    await capture(
      'Updates',
      'Cached release notice after reload',
      'Controlled Besh UI fixture: opening the page reads the cached result without issuing another GitHub check.',
    )
    updateCheckMode = 'cooldown'
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('Wait one minute')
    await capture(
      'Updates',
      'Release check cooldown feedback',
      'Controlled Besh UI fixture: a repeated check receives the one-minute cooldown message while the prior notice remains visible.',
    )
    updateCheckMode = 'current'
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(
      page.getByText('No newer release found', { exact: true }),
    ).toBeVisible()
    await capture(
      'Updates',
      'Installed version is current',
      'Controlled Besh UI fixture: the matching public release is shown beside the installed version and last-check time.',
    )
    updateCheckMode = 'no-releases'
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(
      page.getByText('No matching releases found', { exact: true }),
    ).toBeVisible()
    await capture(
      'Updates',
      'No matching public releases',
      'Controlled Besh UI fixture: empty or filtered public releases produce a clear empty result without an install or download action.',
    )
    updateCheckMode = 'error'
    await page
      .getByRole('button', { name: 'Check releases', exact: true })
      .click()
    await expect(
      page.getByText('Release check failed', { exact: true }),
    ).toBeVisible()
    await capture(
      'Updates',
      'Failed GitHub release check',
      'Controlled Besh UI fixture: a safe provider failure is displayed with its check time and a manual retry action.',
    )
    updateSaveConflict = true
    updateNotice = {
      ...updateNotice,
      settings: {
        ...updateNotice.settings,
        repositoryUrl: 'https://github.com/example/current',
        revision: updateNotice.settings.revision + 1,
      },
      lastCheck: null,
    }
    await page
      .getByLabel('GitHub repository', { exact: true })
      .fill('https://github.com/example/local-edit')
    await page
      .getByRole('button', { name: 'Save update settings', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Update settings changed',
    )
    await capture(
      'Updates',
      'Concurrent update settings save conflict',
      'Controlled Besh UI fixture: a stale revision is rejected and the unsaved local repository remains available for review.',
    )
    updateSaveConflict = false
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Refresh update settings', exact: true })
      .click()
    await expect(
      page.getByLabel('GitHub repository', { exact: true }),
    ).toHaveValue('https://github.com/example/current')
    await capture(
      'Updates',
      'Refresh current release settings',
      'Controlled Besh UI fixture: confirmed refresh replaces local settings with the current revision and clears the previous repository’s notice.',
    )
    await appearance('Dark')
    await capture(
      'Appearance',
      'Dark update notice settings',
      'Controlled Besh UI fixture: repository inputs, release status, and channel controls use readable dark surfaces.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Mobile dark',
      'GitHub update notices',
      'Controlled Besh UI fixture: release settings and notices stack inside the dark phone viewport.',
    )
    await appearance('Light')
    await capture(
      'Mobile',
      'GitHub update notices',
      'Controlled Besh UI fixture: the light phone view keeps repository and manual check controls readable without document overflow.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    const updateGetsBeforeDenial = updateGets
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(editor)
    await navigate('Updates')
    await expect(
      page.getByRole('heading', { name: 'Owner access required', exact: true }),
    ).toBeVisible()
    expect(updateGets).toBe(updateGetsBeforeDenial)
    await capture(
      'Permissions',
      'Editor denied update settings',
      'Update settings and notices remain owner-only. The denied page makes no private update-state request.',
    )
    const updateCatalog = await (
      await page.request.get('/api/permissions', { headers: rotationHeaders })
    ).json()
    const updateCustomRole = await (
      await page.request.post('/api/roles', {
        headers: rotationHeaders,
        data: {
          name: 'All delegated preview grants',
          permissions: updateCatalog.map((entry: { id: string }) => entry.id),
        },
      })
    ).json()
    const updateCustomMember = await (
      await page.request.post('/api/members', {
        headers: rotationHeaders,
        data: {
          name: 'Delegated administrator',
          role: 'custom',
          roleId: updateCustomRole.id,
        },
      })
    ).json()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(updateCustomMember.token)
    await navigate('Updates')
    await expect(
      page.getByRole('heading', { name: 'Owner access required', exact: true }),
    ).toBeVisible()
    expect(updateGets).toBe(updateGetsBeforeDenial)
    await capture(
      'Permissions',
      'Custom grants do not delegate update administration',
      'Even all delegated action grants do not include installation-level release settings. The owner boundary blocks mounting and private update-state reads.',
    )
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn(owner)
    await page.unroute('**/api/updates')
    await page.unroute('**/api/updates/check')
    expect(errors).toEqual([])
    core.complete()
    firstTask.complete()
    await context.clearPermissions()
  },
)

const featureHelpers = {
  database: databasePreviews,
  'client-code': clientCodePreviews,
  'release-pins': releasePinPreviews,
  'generated-backend': generatedBackendPreviews,
  'flow-access': flowAccessPreviews,
  'scoped-actions': scopedActionsPreviews,
  'tenant-protection': tenantProtectionPreviews,
  websocket: websocketPreviews,
  'field-access': fieldAccessPreviews,
  'key-rollover': keyRolloverPreviews,
  'tenant-field-profiles': tenantFieldProfilePreviews,
  'protected-read-graphs': protectedReadGraphPreviews,
  'member-field-profiles': memberFieldProfilePreviews,
  'studio-tools': studioToolsPreviews,
  invitations: invitationPreviews,
  'node-picker': nodePickerPreviews,
  navigation: navigationPreviews,
}

for (const story of previewStories) {
  if (
    story.id === 'core' ||
    story.id === 'first-task' ||
    story.id === 'locales' ||
    story.id === 'locale-fallback' ||
    story.id === 'locale-startup' ||
    story.id === 'locale-bootstrap' ||
    story.id === 'management-account' ||
    story.id === 'management-updates' ||
    story.id === 'management-roles' ||
    story.id === 'management-members' ||
    story.id === 'management-studio-first-task' ||
    story.id === 'management-studio-draft' ||
    story.id === 'management-studio-graphql' ||
    story.id === 'management-studio-websocket' ||
    story.id === 'management-data-source-import' ||
    story.id === 'management-data-source-replacement' ||
    story.id === 'management-data-source-google' ||
    story.id === 'management-data-source-deletion' ||
    story.id === 'management-data-source-status' ||
    story.id === 'database-catalog-locales' ||
    story.id === 'structs' ||
    story.id === 'collections' ||
    story.id === 'rich-text' ||
    story.id === 'formatted-rich-text' ||
    story.id === 'rich-text-blocks' ||
    story.id === 'rich-text-interactions' ||
    story.id === 'rich-text-locales' ||
    story.id === 'rich-text-html' ||
    story.id === 'rich-text-html-guards' ||
    story.id === 'collection-renderers' ||
    story.id === 'saved-renderer-preview' ||
    story.id === 'management-data-api-generation'
  )
    continue
  const helper = featureHelpers[story.id]
  test(
    story.id,
    { lock: [...story.locks] },
    async ({ page, previewWorkspace }) => {
      const { owner, origin, directory } = previewWorkspace
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const { capture, complete } = storyCapture(page, story.id)
      await signInPreview(page, owner)
      await helper({ page, owner, apiOrigin: origin, directory, capture })
      expect(errors).toEqual([])
      complete()
      await page.context().clearPermissions()
    },
  )
}

for (const [story, locale, helper] of [
  ['locales', 'th-TH', localePreviews],
  ['locale-fallback', 'es-MX', localeFallbackPreviews],
  ['locale-startup', 'th-TH', localeStartupPreviews],
  ['locale-bootstrap', 'th-TH', localeBootstrapPreviews],
  ['management-account', 'en-US', accountLocalePreviews],
  ['management-updates', 'en-US', updateLocalePreviews],
  ['management-roles', 'en-US', roleLocalePreviews],
  ['management-members', 'en-US', memberLocalePreviews],
  ['management-studio-first-task', 'en-US', studioFirstTaskLocalePreviews],
  ['management-studio-draft', 'en-US', studioDraftLocalePreviews],
  ['management-studio-graphql', 'en-US', studioGraphqlLocalePreviews],
  ['management-studio-websocket', 'en-US', studioWebsocketLocalePreviews],
  [
    'management-data-source-replacement',
    'en-US',
    dataSourceReplacementLocalePreviews,
  ],
  ['management-data-api-generation', 'en-US', dataApiLocalePreviews],
  ['management-data-source-google', 'en-US', dataSourceGoogleLocalePreviews],
  ['management-data-source-deletion', 'en-US', dataSourceDeleteLocalePreviews],
  ['management-data-source-status', 'en-US', dataSourceStatusLocalePreviews],
  ['database-catalog-locales', 'en-US', databaseCatalogLocalePreviews],
] as const) {
  test.describe(story, () => {
    test.use({
      locale,
      ...(story === 'management-data-source-status'
        ? { timezoneId: 'UTC' }
        : {}),
    })
    test(story, async ({ page, previewWorkspace }) => {
      const { owner, origin, directory } = previewWorkspace
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const { capture, complete } = storyCapture(page, story)
      // Locale stories must observe the first signed-out render in their real
      // browser locale, before any sign-in or persisted appearance preference.
      await helper({ page, owner, apiOrigin: origin, directory, capture })
      expect(errors).toEqual([])
      complete()
      await page.context().clearPermissions()
    })
  })
}

test.describe('management-data-source-import', () => {
  test.use({ locale: 'en-US' })
  test('management-data-source-import', async ({ page, previewWorkspace }) => {
    const { owner, origin } = previewWorkspace
    const headers = { authorization: `Bearer ${owner}` }
    const roleResponse = await page.request.post(`${origin}/api/roles`, {
      headers,
      data: {
        name: 'CSV reader',
        permissions: ['flows.read', 'sources.read'],
      },
    })
    expect(roleResponse.status()).toBe(200)

    const role = (await roleResponse.json()) as { id: string }
    const readerResponse = await page.request.post(`${origin}/api/members`, {
      headers,
      data: { name: 'CSV reader', role: 'custom', roleId: role.id },
    })
    expect(readerResponse.status()).toBe(200)

    const reader = (await readerResponse.json()) as { token: string }
    const selectedResponse = await page.request.post(`${origin}/api/members`, {
      headers,
      data: {
        name: 'Selected CSV viewer',
        role: 'viewer',
        access: {
          mode: 'selected',
          flowIds: [],
          dependencyUse: {
            sources: [],
            databaseConnections: [],
            authConnections: [],
          },
        },
      },
    })
    expect(selectedResponse.status()).toBe(200)

    const selectedViewer = (await selectedResponse.json()) as { token: string }
    const errors: string[] = []
    const { capture, complete } = storyCapture(
      page,
      'management-data-source-import',
    )
    page.on('pageerror', (error) => errors.push(error.message))

    await dataSourceImportLocalePreviews({
      page,
      owner,
      reader: reader.token,
      selectedViewer: selectedViewer.token,
      apiOrigin: origin,
      capture,
    })
    expect(errors).toEqual([])
    complete()
    await page.context().clearPermissions()
  })
})
