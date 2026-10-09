import { openApiTools } from './api-tools'
import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function clientCodePreviews({
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
  const headers = { authorization: `Bearer ${owner}` }
  const path = `/v1/client-code-${crypto.randomUUID().slice(0, 8)}`
  const definition = {
    name: 'Client code customer example',
    method: 'POST',
    path: `${path}/:id`,
    contract: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      query: {
        type: 'object',
        properties: { active: { type: 'boolean' } },
        required: ['active'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'integer', minimum: 1 },
        },
        required: ['name', 'count'],
      },
    },
    nodes: [
      { id: 'request', type: 'request', position: { x: 0, y: 0 }, config: {} },
      {
        id: 'response',
        type: 'response',
        position: { x: 350, y: 0 },
        config: { status: 200, body: { message: 'Example only' } },
      },
    ],
    edges: [{ id: 'next', source: 'request', target: 'response' }],
  }
  async function create(data: unknown, publish = false) {
    const response = await page.request.post(`${apiOrigin}/api/flows`, {
      headers,
      data,
    })
    expect(response.status()).toBe(200)
    const flow = await response.json()
    if (publish)
      expect(
        (
          await page.request.post(`${apiOrigin}/api/flows/${flow.id}/publish`, {
            headers,
            data: { revision: flow.revision },
          })
        ).status(),
      ).toBe(200)
    return flow
  }
  const rest = await create(definition, true)
  const unpublished = await create({
    ...definition,
    name: 'Client code unpublished example',
    path: `${path}/draft/:id`,
  })
  const graphql = await create(
    {
      ...definition,
      name: 'Client code GraphQL example',
      method: 'POST',
      path: `${path}/graphql`,
      contract: undefined,
      graphql: {
        schema:
          'type Query { greeting(name: String!, count: Int!, active: Boolean!): Greeting! } type Greeting { message: String! }',
      },
    },
    true,
  )
  async function login(token: string) {
    if (
      await page.getByRole('button', { name: 'Sign out', exact: true }).count()
    )
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()
  }
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
  const panel = page.getByRole('region', { name: 'Use this API', exact: true })
  async function open(name: string) {
    await page.getByRole('button', { name: /^API Studio/ }).click()
    await page.locator('.api-list button').filter({ hasText: name }).click()
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Use this API', exact: true })
      .click()
    await expect(
      panel.getByText('Loading saved API…', { exact: true }),
    ).toHaveCount(0)
  }
  async function select(label: string, name: string) {
    await panel.getByRole('combobox', { name: label, exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await expect(
      panel.getByText('Loading saved API…', { exact: true }),
    ).toHaveCount(0)
  }
  async function generate() {
    await panel
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    await expect(panel.getByLabel('Generated client code')).toBeVisible()
    await expect(panel.getByLabel('Generated client code')).toContainText(
      'BESH_RUNTIME_API_KEY',
    )
    await expect(panel.getByLabel('Generated client code')).not.toContainText(
      owner,
    )
  }
  async function expectGraphContained() {
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
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
  let runtimeCalls = 0
  let privateReads = 0
  const onRequest = (request: import('@playwright/test').Request) => {
    if (/^\/(run|graphql)\//.test(new URL(request.url()).pathname))
      runtimeCalls++
    if (
      /\/client-code(?:\?|$)/.test(request.url()) &&
      request.method() === 'GET'
    )
      privateReads++
  }
  page.on('request', onRequest)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(owner)
  await appearance('Light')
  await open(rest.name)
  await expect(
    panel.getByText('Published release · revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Client code',
    'Published client example form',
    'Real saved release metadata supplies the path, query and body forms. Generating code makes no live request.',
  )
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill(`${path}/unsaved/:id`)
  await expect(
    panel.getByText('Unsaved edits are excluded.', { exact: false }),
  ).toBeVisible()
  await panel
    .getByLabel('Path parameter id', { exact: true })
    .fill('Ada Lovelace')
  await panel.getByLabel('Body value 1', { exact: true }).fill('Ada')
  await panel.getByLabel('Client base URL').fill('https://api.example.com/team')
  await generate()
  await expect(panel.getByLabel('Generated client code')).toContainText(
    `/team/run${path}/Ada%20Lovelace?active=true`,
  )
  await expect(panel.getByLabel('Generated client code')).not.toContainText(
    '/unsaved/',
  )
  await capture(
    'Client code',
    'Unsaved changes excluded from client example',
    'Published revision 1 stays selected while the canvas contains an unsaved route. The example uses the actual release and deployment prefix.',
  )
  const languages = [
    'JavaScript — Axios',
    'JavaScript — Fetch',
    'PHP — cURL',
    'cURL — shell',
    'Rust — reqwest',
    'Go — net/http',
    'Java — java.net.http',
    'C++ — libcurl',
  ]
  await panel
    .getByRole('combobox', { name: 'Client language', exact: true })
    .click()
  await capture(
    'Client code',
    'Client language menu',
    'Eight accessible language choices show the HTTP library used by each example.',
  )
  await page.keyboard.press('Escape')
  for (const language of languages) {
    await select('Client language', language)
    await generate()
    await capture(
      'Client code',
      `${language} client example`,
      'Real code generator output contains an environment placeholder, encoded request URL, selected JSON body and dependency requirements. No runtime credential is entered.',
    )
  }
  await select('Client language', 'JavaScript — Fetch')
  await generate()
  const downloadEvent = page.waitForEvent('download')
  await panel
    .getByRole('button', { name: 'Download code', exact: true })
    .click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('request.mjs')
  expect(readFileSync((await download.path())!, 'utf8')).toBe(
    await panel.getByLabel('Generated client code').textContent(),
  )
  await capture(
    'Client code',
    'Downloaded client example',
    'The downloaded UTF-8 file exactly matches the displayed generated code and contains no stored credential.',
  )
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await panel.getByRole('button', { name: 'Copy code', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: 'Code copied', exact: true }),
  ).toBeVisible()
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      '\r\n',
      '\n',
    ),
  ).toBe(await panel.getByLabel('Generated client code').textContent())
  await capture(
    'Client code',
    'Copied client example',
    'Copy feedback follows the real clipboard write. The code uses only the runtime environment placeholder.',
  )
  await select('Example source', 'Saved draft')
  await expect(
    panel.getByText('Saved draft · revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Client code',
    'Explicit saved draft client source',
    'Saved draft is an explicit choice. The panel explains that it must be published before its route and contract can be used.',
  )
  const updated = await page.request.put(`${apiOrigin}/api/flows/${rest.id}`, {
    headers,
    data: { ...definition, path: `${path}/changed/:id`, revision: 1 },
  })
  expect(updated.status()).toBe(200)
  await panel.getByLabel('Path parameter id', { exact: true }).fill('42')
  await panel
    .getByRole('button', { name: 'Generate example', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText(
    /revision|changed|stale/i,
  )
  await expect(panel.getByLabel('Generated client code')).toHaveCount(0)
  await capture(
    'Client code',
    'Stale saved revision rejected',
    'A second real owner request changed the saved draft. Expected-revision validation rejects the older example without running the flow.',
  )
  await panel
    .getByRole('button', { name: 'Refresh saved source', exact: true })
    .click()
  await expect(
    panel.getByText('Saved draft · revision 2', { exact: true }),
  ).toBeVisible()
  await panel.getByLabel('Path parameter id', { exact: true }).fill('42')
  await generate()
  await expect(panel.getByLabel('Generated client code')).toContainText(
    '/changed/42',
  )
  await capture(
    'Client code',
    'Saved revision refresh recovery',
    'Refreshing selects the current saved revision and resets the request form for review. Unsaved canvas edits remain separate.',
  )
  await select('Example source', 'Published release')
  await expect(
    panel.getByText('Published release · revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Client code',
    'Published source unchanged after draft save',
    'The live source remains revision 1 with its original route after the separate saved draft moves to revision 2.',
  )
  await panel
    .getByLabel('Client base URL')
    .fill('https://user:secret@example.com')
  await panel
    .getByRole('button', { name: 'Generate example', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText('without credentials')
  await panel.getByLabel('Client base URL').fill('https://api.example.com')
  await capture(
    'Client code',
    'Invalid base URL corrected',
    'Credentials in a base URL are rejected. Correcting the address removes the rejected value; only an ordinary application-server origin is shown.',
  )
  await panel
    .getByRole('button', { name: 'Advanced request JSON', exact: true })
    .click()
  await panel.getByLabel('Client request JSON').fill('{bad json')
  await panel
    .getByRole('button', { name: 'Generate example', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText('body and query')
  await capture(
    'Client code',
    'Invalid advanced client input',
    'Advanced JSON is optional. Invalid input produces an understandable error and no code or runtime request.',
  )
  await panel.getByLabel('Client request JSON').fill(
    JSON.stringify({
      params: { id: '42' },
      query: { active: 'true' },
      body: { name: 'Ada', count: 2 },
    }),
  )
  await panel
    .getByRole('button', { name: 'Advanced request JSON', exact: true })
    .click()
  await generate()
  await capture(
    'Client code',
    'Advanced input returns to labeled forms',
    'Valid JSON returns to the same path, query and typed body forms without losing its values.',
  )
  let deliver!: () => void
  const gate = new Promise<void>((resolve) => {
    deliver = resolve
  })
  let received!: () => void
  const receipt = new Promise<void>((resolve) => {
    received = resolve
  })
  await page.route('**/api/flows/*/client-code', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}${new URL(route.request().url()).pathname}`,
    })
    received()
    await gate
    await route.fulfill({ response })
  })
  await panel
    .getByRole('button', { name: 'Generate example', exact: true })
    .click()
  await receipt
  await expect(
    panel.getByRole('button', { name: 'Generate example', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'What’s next', exact: true }),
  ).toBeDisabled()
  await capture(
    'Client code',
    'Client generation pending',
    'Only delivery of a real generated response is delayed. Duplicate generation, source changes and navigation stay blocked while it is pending.',
  )
  deliver()
  await expect(panel.getByLabel('Generated client code')).toBeVisible()
  await page.unroute('**/api/flows/*/client-code')
  let fail = true
  await page.route('**/api/flows/*/client-code?*', async (route) => {
    if (fail) {
      fail = false
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Saved client source unavailable. Try again.',
        }),
      })
    }
    await route.fallback()
  })
  await panel
    .getByRole('button', { name: 'Refresh saved source', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText('unavailable')
  await capture(
    'Client code',
    'Client metadata read error',
    'Controlled transport failure: saved-source metadata cannot be delivered. Old code is cleared and an explicit refresh is available.',
  )
  await panel
    .getByRole('button', { name: 'Refresh saved source', exact: true })
    .click()
  await expect(
    panel.getByText('Published release · revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Client code',
    'Client metadata retry recovery',
    'The next metadata read reaches the real server and restores the current saved-source form.',
  )
  await page.unroute('**/api/flows/*/client-code?*')
  let deliverOldMetadata!: () => void
  let receivedOldMetadata!: () => void
  let deliveredOldMetadata!: () => void
  const oldMetadataGate = new Promise<void>((resolve) => {
    deliverOldMetadata = resolve
  })
  const oldMetadataReceipt = new Promise<void>((resolve) => {
    receivedOldMetadata = resolve
  })
  const oldMetadataDelivered = new Promise<void>((resolve) => {
    deliveredOldMetadata = resolve
  })
  await page.route(
    '**/api/flows/*/client-code?source=published',
    async (route) => {
      const response = await route.fetch({
        url: `${apiOrigin || new URL(route.request().url()).origin}${new URL(route.request().url()).pathname}?source=published`,
      })
      receivedOldMetadata()
      await oldMetadataGate
      await route.fulfill({ response })
      deliveredOldMetadata()
    },
  )
  await panel
    .getByRole('button', { name: 'Refresh saved source', exact: true })
    .click()
  await oldMetadataReceipt
  await expect(
    panel.getByText('Loading saved API…', { exact: true }),
  ).toBeVisible()
  await capture(
    'Client code',
    'Client metadata loading',
    'A real published metadata response is delayed. Previous code is cleared while the saved source loads; the source selector remains available.',
  )
  await select('Example source', 'Saved draft')
  await expect(
    panel.getByText('Saved draft · revision 2', { exact: true }),
  ).toBeVisible()
  deliverOldMetadata()
  await oldMetadataDelivered
  await page.unroute('**/api/flows/*/client-code?source=published')
  await expect(
    panel.getByText('Saved draft · revision 2', { exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByText('Published release · revision 1', { exact: true }),
  ).toHaveCount(0)
  await capture(
    'Client code',
    'Late metadata cannot replace selected source',
    'Saved revision 2 stays selected after an older real published response arrives. Source changes fence stale request delivery.',
  )
  page.once('dialog', (dialog) => void dialog.accept())
  await open(unpublished.name)
  await expect(panel.getByRole('alert')).toContainText(/publish/i)
  await capture(
    'Client code',
    'Unpublished API source guidance',
    'Published release remains the default. An unpublished API explains why that source is unavailable and offers explicit Saved draft.',
  )
  await select('Example source', 'Saved draft')
  await panel.getByLabel('Path parameter id', { exact: true }).fill('42')
  await generate()
  await capture(
    'Client code',
    'Unpublished saved draft example',
    'A saved draft can generate code with a clear publish-first warning; no live endpoint is implied.',
  )
  await open(graphql.name)
  await expect(panel.getByLabel('Client GraphQL operation')).toContainText(
    '$name: String!',
  )
  await panel.getByLabel('Variable value 1', { exact: true }).fill('Ada')
  await panel.getByLabel('Variable value 2', { exact: true }).fill('2')
  await panel
    .getByRole('combobox', { name: 'Variable value 3', exact: true })
    .click()
  await page.getByRole('option', { name: 'False', exact: true }).click()
  await capture(
    'Client code',
    'GraphQL operation and typed variable forms',
    'The saved SDL seeds a real query and separate text, number and Boolean variable controls. The operation stays editable.',
  )
  for (const language of languages) {
    await select('Client language', language)
    await generate()
    await capture(
      'Client code',
      `${language} GraphQL client example`,
      'Real generator validates the selected operation and typed variables against the saved schema, then emits its JSON HTTP request without executing GraphQL.',
    )
  }
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark client-code panel',
    'Dark desktop code, requirements, field controls and actions remain readable.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expectGraphContained()
  await capture(
    'Mobile',
    'Dark client-code panel phone',
    'Code scrolls inside its own panel and typed request forms stack in the phone viewport.',
  )
  await appearance('Light')
  await expectGraphContained()
  await capture(
    'Mobile',
    'Light client-code panel phone',
    'The light phone panel keeps source, language, request forms and copy/download actions contained.',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expectGraphContained()
  const viewer = await (
    await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name: 'Client example viewer', role: 'viewer' },
    })
  ).json()
  await login(viewer.token)
  await open(graphql.name)
  await generate()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'Permissions',
    'Viewer can generate client examples',
    'Flow read access permits non-executing client generation. Test, edit and publish controls remain separately denied.',
  )
  const role = await (
    await page.request.post(`${apiOrigin}/api/roles`, {
      headers,
      data: { name: 'Client account only', permissions: [] },
    })
  ).json()
  const member = await (
    await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name: 'No client read access', role: 'custom', roleId: role.id },
    })
  ).json()
  const readsBefore = privateReads
  await login(member.token)
  await page.getByRole('button', { name: /^API Studio/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Permission required', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Use this API', exact: true }),
  ).toHaveCount(0)
  expect(privateReads).toBe(readsBefore)
  await capture(
    'Permissions',
    'Client examples require flow read access',
    'The denied Studio never mounts the client panel or fetches private source metadata. Sign-in still works with account-only access.',
  )
  expect(runtimeCalls).toBe(0)
  page.off('request', onRequest)
  await login(owner)
  await page.context().clearPermissions()
}
