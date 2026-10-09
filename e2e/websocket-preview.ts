import { openApiTools } from './api-tools'
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function websocketPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: Capture
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
        page.getByTestId('flow-canvas').evaluate((canvas) => {
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
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeVisible()
  await appearance('Light')
  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name', { exact: true }).fill('Typed message echo')
  await page.getByLabel('Endpoint path', { exact: true }).fill('/v1/messages')
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'WebSocket', exact: true }).click()
  const rules = page.getByRole('region', {
    name: 'WebSocket message rules',
    exact: true,
  })
  await expect(rules).toBeVisible()
  await rules
    .getByLabel('Received field name 1', { exact: true })
    .fill('customer')
  await rules.getByLabel('Reply field name 1', { exact: true }).fill('customer')
  await rules
    .getByRole('button', { name: 'Add browser origin', exact: true })
    .click()
  await rules
    .getByLabel('Browser origin 1', { exact: true })
    .fill('https://client.example')
  await rules
    .getByRole('button', { name: 'Add received field', exact: true })
    .click()
  await rules
    .getByRole('button', { name: 'Add reply field', exact: true })
    .click()
  await rules
    .getByRole('combobox', { name: 'Received field 2 type', exact: true })
    .click()
  await capture(
    'WebSocket',
    'Custom scalar field type selector',
    'Received and reply fields use accessible custom selectors for text, number, whole number and true/false values. Added draft fields are reviewed before saving.',
  )
  await page.getByRole('option', { name: 'True or false', exact: true }).click()
  await rules
    .getByRole('combobox', { name: 'Reply field 2 type', exact: true })
    .click()
  await page.getByRole('option', { name: 'True or false', exact: true }).click()
  await rules
    .getByRole('checkbox', { name: 'Received field 2 allow null', exact: true })
    .click()
  await rules
    .getByRole('checkbox', { name: 'Reply field 2 allow null', exact: true })
    .click()
  await rules
    .getByRole('checkbox', { name: 'Received field 2 required', exact: true })
    .click()
  await rules
    .getByRole('checkbox', { name: 'Reply field 2 required', exact: true })
    .click()
  await capture(
    'WebSocket',
    'Required and nullable scalar rules',
    'Matching received/reply true-or-false fields can be required while explicitly allowing null. Custom checkboxes preserve the typed distinction between missing and null.',
  )
  await rules
    .getByRole('button', { name: 'Remove received field 2', exact: true })
    .click()
  await rules
    .getByRole('button', { name: 'Remove reply field 2', exact: true })
    .click()
  await rules
    .getByRole('button', { name: 'Add browser origin', exact: true })
    .click()
  await capture(
    'WebSocket',
    'Review multiple exact browser origins',
    'Each allowed browser origin is explicit. The added workspace origin is a draft form choice, never a wildcard or authentication replacement.',
  )
  await rules
    .getByRole('button', { name: 'Remove origin 2', exact: true })
    .click()
  await capture(
    'WebSocket',
    'Remove reviewed fields and browser origin',
    'Removing temporary fields and an origin preserves the remaining received/reply rules. The final saved echo permits only the reviewed client origin.',
  )
  await capture(
    'WebSocket',
    'Typed received and reply fields with exact browser origin',
    'Flat typed fields and an exact approved browser origin are edited through labeled forms. This metadata slice does not connect or execute a socket.',
  )
  const savedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/flows' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const saved = await savedResponse
  expect(saved.status()).toBe(200)
  const flow = await saved.json()
  const objectRules = {
    type: 'object',
    properties: { customer: { type: 'string' } },
    required: ['customer'],
    additionalProperties: false,
  }
  expect(flow.websocket).toEqual({
    input: objectRules,
    output: objectRules,
    allowedOrigins: ['https://client.example'],
  })
  expect(flow.graphql).toBeUndefined()
  expect(flow.contract).toBeUndefined()
  await expect(page.locator('.api-list button.selected small')).toHaveText('WS')
  expect(
    flow.nodes.find((node: { type: string }) => node.type === 'response')
      .config,
  ).toEqual({ status: 200, body: '$input.body' })
  const restored = await page.request.get(`${apiOrigin}/api/flows/${flow.id}`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(restored.status()).toBe(200)
  expect((await restored.json()).websocket).toEqual(flow.websocket)
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'API type', exact: true }),
  ).toHaveText('WebSocket')
  await expect(
    page.getByLabel('Received field name 1', { exact: true }),
  ).toHaveValue('customer')
  await expect(
    page.getByLabel('Reply field name 1', { exact: true }),
  ).toHaveValue('customer')
  await expect(
    page.getByLabel('Browser origin 1', { exact: true }),
  ).toHaveValue('https://client.example')
  await capture(
    'WebSocket',
    'Saved WebSocket rules restored from real backend',
    'Reload preserves exclusive WebSocket metadata and the canonical received-message reply; REST and GraphQL contracts are absent.',
  )

  const headers = { authorization: `Bearer ${owner}` }
  const restDefinition = {
    name: 'Reviewed existing REST reply',
    method: 'POST',
    path: '/v1/reviewed-message',
    contract: {
      response: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
        additionalProperties: false,
      },
    },
    nodes: [
      { id: 'request', type: 'request', config: {}, position: { x: 0, y: 0 } },
      {
        id: 'response',
        type: 'response',
        config: { status: 200, body: { message: 'Original live greeting' } },
        position: { x: 350, y: 0 },
      },
    ],
    edges: [{ id: 'next', source: 'request', target: 'response' }],
  }
  const created = await page.request.post(`${apiOrigin}/api/flows`, {
    headers,
    data: restDefinition,
  })
  expect(created.status()).toBe(200)
  const rest = await created.json()
  const published = await page.request.post(
    `${apiOrigin}/api/flows/${rest.id}/publish`,
    { headers, data: { revision: rest.revision } },
  )
  expect(published.status()).toBe(200)
  const changedDefinition = {
    ...restDefinition,
    nodes: [
      restDefinition.nodes[0],
      {
        ...restDefinition.nodes[1],
        config: {
          status: 200,
          body: { message: 'Reviewed modified draft greeting' },
        },
      },
    ],
  }
  const changed = await page.request.put(`${apiOrigin}/api/flows/${rest.id}`, {
    headers,
    data: { ...changedDefinition, revision: rest.revision },
  })
  expect(changed.status()).toBe(200)
  await page.reload()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    restDefinition.name,
  )
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'WebSocket', exact: true }).click()
  const review = page.getByRole('dialog', {
    name: 'Change API transport',
    exact: true,
  })
  await expect(review).toBeVisible()
  await expect(review).toContainText('REST API rules')
  await expect(review).toContainText('reply')
  await expect(review).toContainText('Published release stays unchanged')
  await capture(
    'WebSocket',
    'Review existing API transport conversion',
    'The current REST response and typed rules are replaced only after explicit review; the published endpoint stays unchanged until publication.',
  )
  await review
    .getByRole('button', { name: 'Cancel transport change', exact: true })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'API type', exact: true }),
  ).toHaveText('REST')
  const cancelledSave = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${rest.id}` &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const cancelled = await cancelledSave
  expect(cancelled.status()).toBe(200)
  const preserved = await cancelled.json()
  expect(preserved.websocket).toBeUndefined()
  expect(preserved.contract).toEqual(restDefinition.contract)
  expect(
    preserved.nodes.find((node: { type: string }) => node.type === 'response')
      .config.body,
  ).toEqual({ message: 'Reviewed modified draft greeting' })
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'WebSocket', exact: true }).click()
  await review
    .getByRole('button', { name: 'Confirm transport change', exact: true })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'API type', exact: true }),
  ).toHaveText('WebSocket')
  await expect(
    page.getByLabel('Published endpoint URL', { exact: true }),
  ).toHaveValue(new URL('/run/v1/reviewed-message', page.url()).href)
  const convertedSave = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${rest.id}` &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const converted = await convertedSave
  expect(converted.status()).toBe(200)
  const convertedFlow = await converted.json()
  expect(convertedFlow.websocket.input).toEqual({
    ...objectRules,
    properties: { message: { type: 'string' } },
    required: ['message'],
  })
  expect(convertedFlow.contract).toBeUndefined()
  expect(convertedFlow.publishedRevision).toBe(1)
  expect(convertedFlow.publishedEndpoint.path).toBe(restDefinition.path)
  expect(convertedFlow.publishedEndpoint.graphql).toBe(false)
  const key = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
    headers,
    data: {
      name: 'Conversion live REST proof',
      flowId: rest.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  })
  expect(key.status()).toBe(200)
  const live = await page.request.post(
    `${apiOrigin}/run${restDefinition.path}`,
    {
      headers: { authorization: `Bearer ${(await key.json()).token}` },
      data: {},
    },
  )
  expect(live.status()).toBe(200)
  expect(await live.json()).toEqual({ message: 'Original live greeting' })
  const canvas = page.getByTestId('flow-canvas')
  await expect(
    canvas.getByText('Receive message', { exact: true }),
  ).toBeVisible()
  await expect(canvas.getByText('Send reply', { exact: true })).toBeVisible()
  await canvas.getByText('Send reply', { exact: true }).click()
  const inspector = page.locator('aside.inspector')
  await expect(
    inspector.getByRole('heading', { name: 'Send reply', exact: true }),
  ).toBeVisible()
  await expect(
    inspector.getByRole('combobox', {
      name: 'WebSocket reply source',
      exact: true,
    }),
  ).toHaveText('Echo received message')
  await expect(
    inspector.getByLabel('Response status', { exact: true }),
  ).toHaveCount(0)
  await expect(
    canvas.getByRole('button', { name: 'Condition', exact: true }),
  ).toBeDisabled()
  await expect(
    canvas.getByRole('button', { name: 'GitHub login', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'Canonical message reply controls',
    'Receive message and Send reply use a canonical echo source; beginner controls do not offer HTTP response status, branch steps or login effects for WebSocket.',
  )
  await capture(
    'WebSocket',
    'Converted saved draft keeps its published REST endpoint',
    'Explicit conversion saves canonical WebSocket message rules while the original REST release and response continue serving with its separate runtime key.',
  )
  await openApiTools(page)
  await expect(
    page.getByRole('button', { name: 'Use this API', exact: true }),
  ).toBeEnabled()
  await openApiTools(page)
  await page.getByRole('button', { name: 'Use this API', exact: true }).click()
  const examples = page.getByRole('region', {
    name: 'Use this API',
    exact: true,
  })
  await expect(examples).toContainText('Published release · revision 1')
  await examples
    .getByRole('button', { name: 'Generate example', exact: true })
    .click()
  await expect(
    examples.getByLabel('Generated client code', { exact: true }),
  ).toContainText('/run/v1/reviewed-message')
  await page
    .getByRole('combobox', { name: 'OpenAPI source', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Published release · v1', exact: true })
    .click()
  const openApiDownload = page.waitForEvent('download')
  await openApiTools(page)
  await page
    .getByRole('button', { name: 'Download OpenAPI', exact: true })
    .click()
  const downloadedOpenApi = await openApiDownload
  const openApiPath = await downloadedOpenApi.path()
  expect(openApiPath).not.toBeNull()
  const liveDocument = JSON.parse(readFileSync(openApiPath!, 'utf8'))
  expect(liveDocument.paths['/run/v1/reviewed-message'].post).toBeDefined()
  await capture(
    'WebSocket',
    'Published REST tools remain available while the saved draft uses WebSocket',
    'Client examples and OpenAPI explicitly use the unchanged published REST release. Choosing WebSocket in the draft does not replace the live protocol or its exports.',
  )
  await examples
    .getByRole('combobox', { name: 'Example source', exact: true })
    .click()
  await page.getByRole('option', { name: 'Saved draft', exact: true }).click()
  await expect(examples.getByRole('alert')).toContainText('WebSocket')
  await expect(
    examples.getByLabel('Generated client code', { exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('combobox', { name: 'OpenAPI source', exact: true })
    .click()
  await page.getByRole('option', { name: /^Saved draft · revision / }).click()
  await expect(
    page.getByRole('button', { name: 'Download OpenAPI', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'Saved WebSocket draft excludes HTTP examples and OpenAPI',
    'Source-specific guards clear HTTP code and disable the REST document for the saved WebSocket draft; they do not hide the separately published REST release.',
  )
  const websocketPublish = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${rest.id}/publish` &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const websocketPublished = await websocketPublish
  expect(websocketPublished.status()).toBe(200)
  const released = await websocketPublished.json()
  expect(released.publishedEndpoint.transport).toBe('websocket')
  await expect(
    page.getByText('WebSocket · Published endpoint URL', { exact: true }),
  ).toBeVisible()
  await openApiTools(page)
  await page
    .getByRole('button', { name: 'Generated backend', exact: true })
    .click()
  const backendPanel = page.getByRole('region', {
    name: 'Generated backend',
    exact: true,
  })
  await expect(backendPanel).toContainText(
    `WebSocket /ws${restDefinition.path}`,
  )
  await capture(
    'WebSocket',
    'Published WebSocket generated backend',
    'The reviewed compiler artifact reports its actual published WebSocket transport and registered /ws route, independently of editable draft metadata.',
  )
  const wsTargetsResponse = await page.request.get(
    `${apiOrigin}/api/load-tests/targets`,
    { headers },
  )
  expect(wsTargetsResponse.status()).toBe(200)
  expect(
    (await wsTargetsResponse.json()).some(
      (target: { id: string }) => target.id === rest.id,
    ),
  ).toBe(false)
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'API keys', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Published API', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: restDefinition.name, exact: true })
    .click()
  await expect(
    page.getByText('WebSocket · Published endpoint URL', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: 'WebSocket messages', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'REST requests', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('combobox', { name: 'Release access', exact: true }),
  ).toHaveText('Only this release')
  await page
    .getByRole('combobox', { name: 'Release access', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Follow published changes', exact: true }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Reviewed WebSocket caller')
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeEnabled()
  await capture(
    'WebSocket',
    'Dedicated WebSocket key and required current-release pin',
    'Permissions come from the published WebSocket release; REST and GraphQL grants cannot connect, and follow-published mode is unavailable.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const keyReview = page.getByRole('dialog', {
    name: 'Create release-pinned API key',
    exact: true,
  })
  await expect(keyReview).toContainText('WebSocket messages')
  await expect(keyReview).toContainText(`/ws${restDefinition.path}`)
  await expect(keyReview).toContainText(
    `Only release ${released.publishedRevision}`,
  )
  await capture(
    'WebSocket',
    'Review WebSocket caller issuance',
    'The reviewed name, dedicated operation, actual published route, current revision and expiry are confirmed before key issuance.',
  )
  const keyResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/runtime-keys' &&
      response.request().method() === 'POST',
  )
  await keyReview
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  const websocketKeyResponse = await keyResponse
  expect(websocketKeyResponse.status()).toBe(200)
  const websocketKey = await websocketKeyResponse.json()
  expect(websocketKey.permissions).toEqual(['ws'])
  expect(websocketKey.releaseRevision).toBe(released.publishedRevision)
  await expect(
    page.getByRole('region', { name: 'Save API key', exact: true }),
  ).toContainText(`Only release ${released.publishedRevision}`)
  await capture(
    'WebSocket',
    'One-time WebSocket caller credential is masked',
    'The dedicated pinned key is displayed once by the management page; previews mask the token. No key enters a WebSocket URL or browser test connection.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: 'WebSocket key-only operator',
      permissions: ['runtime-keys.manage'],
    },
  })
  expect(roleResponse.status()).toBe(200)
  const role = await roleResponse.json()
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: 'WebSocket key-only member',
      role: 'custom',
      roleId: role.id,
      access: {
        mode: 'selected',
        flowIds: [rest.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  })
  expect(memberResponse.status()).toBe(200)
  const operator = await memberResponse.json()
  let privateFlowReads = 0
  const rowReviews: unknown[] = []
  const observeRequest = (request: import('@playwright/test').Request) => {
    const url = new URL(request.url())
    if (
      request.method() === 'GET' &&
      url.pathname.startsWith('/api/flows') &&
      !(
        url.pathname === `/api/flows/${rest.id}/row-access` &&
        url.search === '?source=published'
      )
    )
      privateFlowReads++
  }
  page.on('request', observeRequest)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(operator.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API keys', exact: true }),
  ).toBeVisible()
  const rowReview = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${rest.id}/row-access` &&
      response.request().method() === 'GET',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  const reviewedRows = await rowReview
  expect(reviewedRows.status()).toBe(200)
  expect(new URL(reviewedRows.url()).search).toBe('?source=published')
  rowReviews.push(await reviewedRows.json())
  expect(rowReviews).toEqual([
    {
      source: 'published',
      revision: released.publishedRevision,
      required: false,
      supported: true,
    },
  ])
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Known WebSocket scope caller')
  await page
    .getByLabel('Known published release', { exact: true })
    .fill(String(released.publishedRevision))
  await page
    .getByRole('combobox', { name: 'Operation type', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'WebSocket messages', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeEnabled()
  await capture(
    'WebSocket',
    'Known scoped WebSocket key without private API reading',
    'A selected key-only operator supplies the owner-provided API ID, revision and operation. Only the exact minimal row-protection review is fetched; no private graph, endpoint, schema or flow list is read.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await expect(keyReview).toContainText('Endpoint metadata not read')
  await expect(keyReview).toContainText('WebSocket messages')
  const operatorKeyResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/runtime-keys' &&
      response.request().method() === 'POST',
  )
  await keyReview
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  const operatorKeyResult = await operatorKeyResponse
  expect(operatorKeyResult.status()).toBe(200)
  const operatorKey = await operatorKeyResult.json()
  expect(operatorKey.permissions).toEqual(['ws'])
  expect(operatorKey.releaseRevision).toBe(released.publishedRevision)
  expect(operatorKey.issuerBinding).toEqual({
    memberId: operator.id,
    action: 'runtime-keys.manage',
  })
  expect(privateFlowReads).toBe(0)
  await expect(
    page.getByRole('row').filter({ hasText: 'Known WebSocket scope caller' }),
  ).toContainText('Current release unknown')
  await capture(
    'WebSocket',
    'Key-only WebSocket issuance keeps member link and unknown current status',
    'The one-time credential is masked, its exact pin and original member are retained, and the dashboard does not imply full publication knowledge without Read APIs.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  page.off('request', observeRequest)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    restDefinition.name,
  )
  const draftTest = page.getByRole('region', {
    name: 'WebSocket draft test',
    exact: true,
  })
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeEnabled()
  const socketEvent = page.waitForEvent('websocket')
  const mintedTicket = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${rest.id}/ws/test-ticket` &&
      response.request().method() === 'POST',
  )
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  const receiptResponse = await mintedTicket
  expect(receiptResponse.status()).toBe(200)
  const receipt = await receiptResponse.json()
  expect(receipt.revision).toBe(released.revision)
  expect(receipt.protocol).toBe('besh.ws.v1')
  expect(receipt.path).toBe(`/api/flows/${rest.id}/ws/test`)
  expect(receiptResponse.request().postDataJSON()).toEqual({
    revision: released.revision,
  })
  const actualSocket = await socketEvent
  const actualSocketUrl = new URL(actualSocket.url())
  expect(actualSocketUrl.pathname).toBe(receipt.path)
  expect(actualSocketUrl.search).toBe('')
  expect(actualSocketUrl.hash).toBe('')
  expect(actualSocketUrl.host).toBe(new URL(page.url()).host)
  await expect(draftTest).toContainText('Connected')
  expect(
    (await page.locator('body').innerText()).includes(receipt.ticket),
  ).toBe(false)
  await draftTest
    .getByLabel('Message field: message', { exact: true })
    .fill('Hello over WebSocket')
  const sentFrame = actualSocket.waitForEvent('framesent')
  const replyFrame = actualSocket.waitForEvent('framereceived')
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  const sent = JSON.parse(String((await sentFrame).payload))
  const replied = JSON.parse(String((await replyFrame).payload))
  expect(sent.body).toEqual({ message: 'Hello over WebSocket' })
  expect(replied).toEqual({
    id: sent.id,
    result: { message: 'Hello over WebSocket' },
  })
  await expect(
    draftTest.getByLabel('Latest WebSocket reply', { exact: true }),
  ).toContainText('Hello over WebSocket')
  expect(
    await page.evaluate(
      (ticket) =>
        Object.values(localStorage).some((value) =>
          String(value).includes(ticket),
        ),
      receipt.ticket,
    ),
  ).toBe(false)
  await capture(
    'WebSocket',
    'Actual same-origin draft message and reply',
    'The signed-in owner uses an in-memory one-use ticket subprotocol on the real native upgrade. Labeled fields send one typed message and show its matching reply; the URL and persisted preferences contain no ticket.',
  )
  const closedSocket = actualSocket.waitForEvent('close')
  await draftTest
    .getByRole('button', { name: 'Disconnect draft', exact: true })
    .click()
  await closedSocket
  await expect(draftTest).toContainText('Disconnected')
  await capture(
    'WebSocket',
    'Disconnect the draft connection',
    'Explicit disconnect closes the actual socket and clears transient replies; reconnect requests a fresh one-use ticket.',
  )
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: 'Message customer rows',
        file: {
          name: 'message-customers.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('name,city\nAda,London\nGrace,New York\n'),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)
  const source = await imported.json()
  const generatedRead = await page.request.post(
    `${apiOrigin}/api/data-sources/${source.id}/api`,
    {
      headers,
      data: {
        version: source.version,
        name: 'Customer rows by message',
        path: '/v1/message-customers',
        protocol: 'rest',
        columns: ['name', 'city'],
        filter: { column: 'city', inputName: 'city' },
        limit: 5,
      },
    },
  )
  expect(generatedRead.status()).toBe(200)
  const readFlow = await generatedRead.json()
  await page.reload()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    readFlow.name,
  )
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'WebSocket', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Change API transport', exact: true })
    .getByRole('button', { name: 'Confirm transport change', exact: true })
    .click()
  await expect(
    page.getByLabel('Received field name 1', { exact: true }),
  ).toHaveValue('city')
  await expect(
    page.getByLabel('Reply field name 1', { exact: true }),
  ).toHaveValue('name')
  await expect(
    page.getByLabel('Reply field name 2', { exact: true }),
  ).toHaveValue('city')
  const saveRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${readFlow.id}` &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const convertedReadResponse = await saveRead
  expect(convertedReadResponse.status()).toBe(200)
  const convertedRead = await convertedReadResponse.json()
  expect(
    convertedRead.nodes.find((node: { type: string }) => node.type === 'data')
      .config,
  ).toEqual({
    ...readFlow.nodes.find((node: { type: string }) => node.type === 'data')
      .config,
    filter: { column: 'city', value: '$input.body.city' },
  })
  expect(convertedRead.websocket.output).toEqual(readFlow.contract.response)
  await capture(
    'WebSocket',
    'Reviewed data read keeps typed row fields',
    'Existing REST row rules supply message and reply fields automatically; the reviewed filter moves to received message fields while columns, row limit and graph stay unchanged.',
  )
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeEnabled()
  const readSocketEvent = page.waitForEvent('websocket')
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  const readSocket = await readSocketEvent
  await expect(draftTest).toContainText('Connected')
  await draftTest
    .getByRole('checkbox', { name: 'Include optional field city', exact: true })
    .click()
  await draftTest
    .getByLabel('Message field: city', { exact: true })
    .fill('London')
  const rowReply = readSocket.waitForEvent('framereceived')
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  expect(JSON.parse(String((await rowReply).payload)).result).toEqual([
    { name: 'Ada', city: 'London' },
  ])
  await expect(
    draftTest.getByLabel('Latest WebSocket reply', { exact: true }),
  ).toContainText('Ada')
  await expect(
    draftTest.getByRole('table', { name: 'WebSocket reply rows', exact: true }),
  ).toContainText('Ada')
  await expect(
    draftTest.getByLabel('Latest WebSocket reply', { exact: true }),
  ).toBeHidden()
  await capture(
    'WebSocket',
    'Actual typed data reply',
    'A labeled city message filters the real imported spreadsheet and returns the selected typed rows through the native draft socket. No JSON editing or field guessing is required.',
  )
  await draftTest
    .getByRole('button', { name: 'Disconnect draft', exact: true })
    .click()
  const newerDraft = await page.request.put(
    `${apiOrigin}/api/flows/${readFlow.id}`,
    {
      headers,
      data: {
        ...convertedRead,
        name: 'Current customer message draft',
      },
    },
  )
  expect(newerDraft.status()).toBe(200)
  const currentDraft = await newerDraft.json()
  const staleMint = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${readFlow.id}/ws/test-ticket` &&
      response.request().method() === 'POST',
  )
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  expect((await staleMint).status()).toBe(409)
  await expect(draftTest.getByRole('alert')).toContainText('changed')
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'Stale draft connection requires explicit refresh',
    'The real backend rejects a ticket for an older saved revision. No socket is opened and reconnect stays unavailable until the current saved draft is explicitly reviewed.',
  )
  await draftTest
    .getByRole('button', { name: 'Refresh saved draft', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    currentDraft.name,
  )
  await expect(draftTest).toContainText(
    `saved draft revision ${currentDraft.revision}`,
  )
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeEnabled()
  await capture(
    'WebSocket',
    'Refresh reviews current saved draft',
    'Explicit refresh loads the current saved revision and clears stale connection knowledge before tenant review and a new one-use ticket.',
  )
  const ticketPattern = `**/api/flows/${readFlow.id}/ws/test-ticket`
  await page.route(ticketPattern, async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  await expect(draftTest.getByRole('alert')).toBeVisible()
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeEnabled()
  await expect(
    draftTest.getByRole('button', { name: 'Send message', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'Ticket delivery error permits fresh retry',
    'Controlled transport drops a real minted receipt before the browser receives it. No socket or runtime key is created in the browser; retry requests a new one-use ticket.',
  )
  await page.unroute(ticketPattern)
  let releaseTicket!: () => void
  const ticketDelivery = new Promise<void>((resolve) => {
    releaseTicket = resolve
  })
  let ticketHeld = false
  await page.route(ticketPattern, async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    ticketHeld = true
    await ticketDelivery
    await route.fulfill({ response })
  })
  const pendingSocketEvent = page.waitForEvent('websocket')
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  await expect.poll(() => ticketHeld).toBe(true)
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'New API', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'API keys', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'One-use ticket pending guards',
    'Controlled transport delays the real successful ticket receipt. Connect and global navigation remain disabled while the original signed-in request is pending; no fake socket response is supplied.',
  )
  releaseTicket()
  const pendingSocket = await pendingSocketEvent
  await expect(draftTest).toContainText('Connected')
  await page.unroute(ticketPattern)
  const editClosed = pendingSocket.waitForEvent('close')
  await page
    .getByLabel('API name', { exact: true })
    .fill('Reviewed customer message draft')
  await editClosed
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeDisabled()
  await expect(
    draftTest.getByRole('button', { name: 'Send message', exact: true }),
  ).toBeDisabled()
  await expect(
    draftTest.getByLabel('Latest WebSocket reply', { exact: true }),
  ).toHaveCount(0)
  await capture(
    'WebSocket',
    'Unsaved edit closes actual draft socket',
    'An ordinary edit closes the real socket and clears replies immediately. Unsaved draft changes must be saved before another connection is admitted.',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeEnabled()
  const viewSocketEvent = page.waitForEvent('websocket')
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  const viewSocket = await viewSocketEvent
  await expect(draftTest).toContainText('Connected')
  await draftTest
    .getByRole('checkbox', { name: 'Include optional field city', exact: true })
    .click()
  await draftTest
    .getByLabel('Message field: city', { exact: true })
    .fill('x'.repeat(33_000))
  let sentCount = 0
  viewSocket.on('framesent', () => sentCount++)
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  await expect(draftTest.getByRole('alert')).toContainText('32 KiB')
  expect(sentCount).toBe(0)
  await draftTest
    .getByLabel('Message field: city', { exact: true })
    .fill('London')
  await capture(
    'WebSocket',
    'Oversized message stays local',
    'The complete message exceeds 32 KiB and is rejected before sending any frame. The bounded connection can still send a corrected message.',
  )
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  await expect(
    draftTest.getByRole('table', { name: 'WebSocket reply rows', exact: true }),
  ).toContainText('Ada')
  await draftTest.getByText('Advanced reply JSON', { exact: true }).click()
  await expect(
    draftTest.getByLabel('Latest WebSocket reply', { exact: true }),
  ).toBeVisible()
  await capture(
    'WebSocket',
    'Optional advanced reply envelope',
    'Readable rows remain the default. Advanced reply JSON reveals the matching envelope only on explicit request; request values remain transient.',
  )
  await draftTest.getByText('Advanced reply JSON', { exact: true }).click()
  await appearance('Dark')
  await fitGraph()
  await capture(
    'Appearance',
    'Dark WebSocket rules and typed replies',
    'Dark controls, received fields and readable row replies retain contrast; the canonical three-node graph is fitted using its real control.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await fitGraph()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile dark',
    'WebSocket fields and live row replies',
    'The actual fitted receive/read/reply graph and typed row forms remain contained at 390 pixels. Connection history contains fixture values and no ticket.',
  )
  await appearance('Light')
  await fitGraph()
  await capture(
    'Mobile',
    'WebSocket fields and live row replies',
    'Light phone controls and readable replies stay within the viewport; all three nodes are independently checked inside the canvas after Fit View.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await fitGraph()
  await draftTest
    .getByRole('button', { name: 'Disconnect draft', exact: true })
    .click()

  const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers,
    data: { label: 'Message London tenant', value: 'London' },
  })
  expect(tenantResponse.status()).toBe(200)
  const tenant = await tenantResponse.json()
  const policyResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    { headers },
  )
  expect(policyResponse.status()).toBe(200)
  const policy = await policyResponse.json()
  const protectedResponse = await page.request.put(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    {
      headers,
      data: {
        mode: 'tenant',
        column: 'city',
        version: policy.version,
        resourceVersion: policy.resourceVersion,
      },
    },
  )
  expect(protectedResponse.status()).toBe(200)
  await page.reload()
  await expect(
    draftTest.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toBeVisible()
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeDisabled()
  await capture(
    'WebSocket',
    'Protected draft requires owner tenant review',
    'The real original-text source policy requires an explicit owner identity before minting a draft ticket. The tenant is management metadata, never a message field.',
  )
  await draftTest
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant.label, exact: true }).click()
  const protectedMint = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${readFlow.id}/ws/test-ticket` &&
      response.request().method() === 'POST',
  )
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  const ownerMint = await protectedMint
  expect(ownerMint.status()).toBe(200)
  expect(ownerMint.request().postDataJSON().tenantId).toBe(tenant.id)
  await expect(draftTest).toContainText('Connected')
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  await expect(
    draftTest.getByRole('table', { name: 'WebSocket reply rows', exact: true }),
  ).toContainText('Ada')
  await capture(
    'WebSocket',
    'Protected owner draft returns reviewed tenant rows',
    'An actual native socket reads only the reviewed London tenant. Leaving the optional business filter out does not widen the tenant boundary.',
  )
  await draftTest
    .getByRole('button', { name: 'Disconnect draft', exact: true })
    .click()
  const readerRoleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: 'Message draft reader',
      permissions: ['flows.read', 'flows.test'],
    },
  })
  expect(readerRoleResponse.status()).toBe(200)
  const readerRole = await readerRoleResponse.json()
  const readerResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: 'Assigned message reader',
      role: 'custom',
      roleId: readerRole.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [readFlow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  })
  expect(readerResponse.status()).toBe(200)
  const reader = await readerResponse.json()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateTenantReads = 0
  const countTenantReads = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname === '/api/tenants'
    )
      privateTenantReads++
  }
  page.on('request', countTenantReads)
  await page.getByLabel('Workspace token').fill(reader.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(draftTest).toContainText(`Assigned tenant: ${tenant.label}`)
  await expect(
    draftTest.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  const readerMint = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${readFlow.id}/ws/test-ticket` &&
      response.request().method() === 'POST',
  )
  await draftTest
    .getByRole('button', { name: 'Connect draft', exact: true })
    .click()
  const assignedMint = await readerMint
  expect(assignedMint.status()).toBe(200)
  expect(Object.hasOwn(assignedMint.request().postDataJSON(), 'tenantId')).toBe(
    false,
  )
  await expect(draftTest).toContainText('Connected')
  await draftTest
    .getByRole('button', { name: 'Send message', exact: true })
    .click()
  await expect(
    draftTest.getByRole('table', { name: 'WebSocket reply rows', exact: true }),
  ).toContainText('Ada')
  expect(privateTenantReads).toBe(0)
  page.off('request', countTenantReads)
  await capture(
    'Permissions',
    'Assigned member protected WebSocket draft',
    'The selected tester uses explicit source USE and its current assignment. No owner tenant registry is fetched and no arbitrary tenant picker or request selector is offered.',
  )
  await draftTest
    .getByRole('button', { name: 'Disconnect draft', exact: true })
    .click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const viewerResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: 'Read-only message viewer',
      role: 'viewer',
      flowAccess: { mode: 'selected', flowIds: [readFlow.id] },
    },
  })
  expect(viewerResponse.status()).toBe(200)
  const viewer = await viewerResponse.json()
  let deniedMints = 0
  const countDeniedMints = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/ws/test-ticket')
    )
      deniedMints++
  }
  page.on('request', countDeniedMints)
  await page.getByLabel('Workspace token').fill(viewer.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(draftTest).toContainText(
    'Read APIs and Test APIs access are required',
  )
  await expect(
    draftTest.getByRole('button', { name: 'Connect draft', exact: true }),
  ).toBeDisabled()
  expect(deniedMints).toBe(0)
  page.off('request', countDeniedMints)
  await capture(
    'Permissions',
    'Read-only viewer cannot mint a draft ticket',
    'A viewer may inspect its shared API but cannot connect or send. The denied control makes no ticket request.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeVisible()
  return flow
}
