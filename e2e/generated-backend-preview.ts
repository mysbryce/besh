import { openApiTools } from './api-tools'
import { expect, type Page, type Request } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { BackendCodeArtifact } from '../src/flows/backend-code-model'
import type { SavedFlow } from '../web/lib/api'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function generatedBackendPreviews({
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
  const path = `/v1/generated-backend-${crypto.randomUUID().slice(0, 8)}`
  const definition = {
    name: 'Generated backend reviewed customer API',
    method: 'GET',
    path: `${path}/:id`,
    nodes: [
      { id: 'request', type: 'request', position: { x: 0, y: 0 }, config: {} },
      {
        id: 'response',
        type: 'response',
        position: { x: 350, y: 0 },
        config: { status: 200, body: { customer: '$input.params.id' } },
      },
    ],
    edges: [{ id: 'next', source: 'request', target: 'response' }],
  }
  async function management<T>(url: string, data?: unknown, method = 'POST') {
    const response = await page.request.fetch(`${apiOrigin}${url}`, {
      headers,
      method,
      ...(data === undefined ? {} : { data }),
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as T
  }
  const rest = await management<SavedFlow>('/api/flows', definition)
  const graphql = await management<SavedFlow>('/api/flows', {
    ...definition,
    name: 'Generated backend GraphQL customer API',
    method: 'POST',
    path: `${path}/graphql`,
    graphql: {
      schema:
        'type Query { customer: Result! } type Mutation { customer: Result! } type Result { customer: String! }',
    },
    nodes: [
      definition.nodes[0],
      {
        ...definition.nodes[1],
        config: { status: 200, body: { customer: 'GraphQL customer' } },
      },
    ],
  })
  await management(`/api/flows/${graphql.id}/publish`, { revision: 1 })
  let reads = 0
  let runtimeRequests = 0
  const observe = (request: Request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/backend-code')) reads++
    if (/^\/(run|graphql)\//.test(url.pathname)) runtimeRequests++
  }
  page.on('request', observe)
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
  const panel = page.getByRole('region', {
    name: 'Generated backend',
    exact: true,
  })
  const code = panel.getByLabel('Generated backend code', { exact: true })
  async function open(name: string) {
    await page.getByRole('button', { name: /^API Studio/ }).click()
    await page.locator('.api-list button').filter({ hasText: name }).click()
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Generated backend', exact: true })
      .click()
    await expect(
      panel.getByText('Loading generated backend…', { exact: true }),
    ).toHaveCount(0)
  }
  async function refresh() {
    await panel
      .getByRole('button', { name: 'Refresh generated backend', exact: true })
      .click()
    await expect(
      panel.getByText('Loading generated backend…', { exact: true }),
    ).toHaveCount(0)
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
  async function expectGraphContained() {
    await expect
      .poll(async () => {
        const bounds = await page.getByTestId('flow-canvas').boundingBox()
        const nodes = await page.locator('.react-flow__node').all()
        if (!bounds || nodes.length !== 2) return false
        for (const node of nodes) {
          const box = await node.boundingBox()
          if (
            !box ||
            box.x < bounds.x - 1 ||
            box.y < bounds.y - 1 ||
            box.x + box.width > bounds.x + bounds.width + 1 ||
            box.y + box.height > bounds.y + bounds.height + 1
          )
            return false
        }
        return true
      })
      .toBe(true)
  }

  await login(owner)
  await appearance('Light')
  await open(rest.name)
  await expect(panel).toContainText('Publish this API to generate its backend.')
  await expect(code).toHaveCount(0)
  await capture(
    'Generated backend',
    'Unpublished backend guidance',
    'A saved draft has no published backend yet. Publication generates its code automatically; there is no extra generation or deployment form.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(panel).toContainText('Published release · revision 1')
  await expect(code).toContainText(`/run${path}/:id`)
  await capture(
    'Generated backend',
    'Backend generated automatically by Publish',
    'The ordinary Publish action creates the real release artifact. Its revision, actual prefixed route and runtime requirements are displayed.',
  )
  const artifact = await management<BackendCodeArtifact>(
    `/api/flows/${rest.id}/backend-code?revision=1`,
    undefined,
    'GET',
  )
  expect(await code.textContent()).toBe(artifact.code)
  expect(createHash('sha256').update(artifact.code).digest('hex')).toBe(
    artifact.sha256,
  )
  await panel.getByText('Release integrity', { exact: true }).click()
  await expect(panel).toContainText(artifact.sha256)
  await expect(panel).toContainText(artifact.definitionSha256)
  await capture(
    'Generated backend',
    'Published backend integrity details',
    'The actual code and definition SHA-256 hashes identify the reviewed immutable release artifact.',
  )
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill(`${path}/saved/:id`)
  await expect(panel).toContainText('Draft changes are excluded.')
  await expect(code).not.toContainText(`${path}/saved/:id`)
  await capture(
    'Generated backend',
    'Unsaved draft excluded from backend code',
    'Changing the draft path does not change the published code. The panel explains that only publication updates its backend.',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved.')
  await expect(panel).toContainText('Published release · revision 1')
  await expect(panel).toContainText('Draft changes are excluded.')
  await capture(
    'Generated backend',
    'Saved draft remains separate from published backend',
    'Saving revision 2 keeps release 1 code live and visible until the reviewed draft is published.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(panel).toContainText('Published release · revision 2')
  await expect(code).toContainText(`/run${path}/saved/:id`)
  await capture(
    'Generated backend',
    'Second publication updates generated route',
    'Publishing the saved revision automatically refreshes its backend view with the new live route.',
  )
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await panel
    .getByRole('button', { name: 'Copy backend code', exact: true })
    .click()
  await expect(
    panel.getByRole('button', { name: 'Backend copied', exact: true }),
  ).toBeVisible()
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      '\r\n',
      '\n',
    ),
  ).toBe((await code.textContent())!.replaceAll('\r\n', '\n'))
  await capture(
    'Generated backend',
    'Copy reviewed backend code',
    'Copy checks the expected current revision before writing exactly the displayed trusted module to the clipboard.',
  )
  const downloadEvent = page.waitForEvent('download')
  await panel
    .getByRole('button', { name: 'Download backend code', exact: true })
    .click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(`besh-${rest.id}-r2.cjs`)
  expect(readFileSync((await download.path())!, 'utf8')).toBe(
    await code.textContent(),
  )
  await expect(page.getByRole('status')).toContainText(
    'Generated backend downloaded.',
  )
  await capture(
    'Generated backend',
    'Download reviewed backend module',
    'The downloaded CJS module matches the displayed artifact. It requires Besh runtime helpers and does not bundle data or credentials.',
  )

  const third = await management<SavedFlow>(
    `/api/flows/${rest.id}`,
    {
      ...definition,
      path: `${path}/saved/:id`,
      revision: 2,
      nodes: [
        definition.nodes[0],
        {
          ...definition.nodes[1],
          config: {
            status: 200,
            body: { customer: 'Published by another request' },
          },
        },
      ],
    },
    'PUT',
  )
  await management(`/api/flows/${rest.id}/publish`, {
    revision: third.revision,
  })
  await panel
    .getByRole('button', { name: 'Download backend code', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toContainText(/release changed/i)
  await expect(code).toHaveCount(0)
  await expect(
    panel.getByRole('button', { name: 'Download backend code', exact: true }),
  ).toHaveCount(0)
  await capture(
    'Generated backend',
    'Stale generated backend export rejected',
    'A real competing publication rejects export of the older expected revision. Stale code and export actions disappear until explicit refresh.',
  )
  await refresh()
  await expect(panel).toContainText('Published release · revision 3')
  await expect(code).toContainText('Published by another request')
  await expect(panel).toContainText('Draft changes are excluded.')
  await capture(
    'Generated backend',
    'Refresh adopts current backend release',
    'Explicit refresh reads current release 3 for review while preserving the editor draft.',
  )
  await management(`/api/flows/${rest.id}/rollback`, {
    revision: 2,
    publishedRevision: 3,
  })
  await refresh()
  await expect(panel).toContainText('Published release · revision 2')
  await expect(code).not.toContainText('Published by another request')
  await capture(
    'Generated backend',
    'Rollback selects matching generated backend',
    'Exact release rollback selects its validated backend artifact; the draft remains independently saved.',
  )

  let failNext = true
  await page.route(`**/api/flows/${rest.id}/backend-code*`, async (route) => {
    if (failNext) {
      failNext = false
      await route.abort('failed')
    } else await route.fallback()
  })
  await refresh()
  await expect(panel.getByRole('alert')).toContainText(/fetch|read/i)
  await expect(code).toHaveCount(0)
  await capture(
    'Generated backend',
    'Generated backend response delivery error',
    'A lost real artifact response leaves no stale code behind and exposes an explicit retry action.',
  )
  await refresh()
  await expect(code).toBeVisible()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  await capture(
    'Generated backend',
    'Generated backend read retry recovery',
    'Successful explicit refresh restores the current reviewed artifact and clears its delivery error.',
  )
  await page.unroute(`**/api/flows/${rest.id}/backend-code*`)

  let releaseDelivery = () => {}
  let held = false
  const delivery = new Promise<void>((resolve) => {
    releaseDelivery = resolve
  })
  await page.route(`**/api/flows/${rest.id}/backend-code*`, async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}${url.search}`,
    })
    held = true
    await delivery
    await route.fulfill({ response })
  })
  const pendingDownload = page.waitForEvent('download')
  // A failed capture can exit before the normal download assertion.
  void pendingDownload.catch(() => {})
  try {
    await panel
      .getByRole('button', { name: 'Download backend code', exact: true })
      .click()
    await expect.poll(() => held).toBe(true)
    await expect(
      panel.getByRole('button', { name: 'Download backend code', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Generated backend', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()
    await capture(
      'Generated backend',
      'Backend export revision check pending',
      'Only delivery of a real expected-revision check is delayed. Duplicate export, panel close, publication and navigation remain locked until it finishes.',
    )
  } finally {
    releaseDelivery()
  }
  expect((await pendingDownload).suggestedFilename()).toBe(
    `besh-${rest.id}-r2.cjs`,
  )
  await expect(page.getByRole('status')).toContainText(
    'Generated backend downloaded.',
  )
  await page.unroute(`**/api/flows/${rest.id}/backend-code*`)
  await capture(
    'Generated backend',
    'Pending backend download completed',
    'Exactly the reviewed release 2 module downloads after the real revision check finishes.',
  )

  let deliverInitial = () => {}
  let heldInitial = false
  let finishedInitial = false
  const initialDelivery = new Promise<void>((resolve) => {
    deliverInitial = resolve
  })
  await page.route(`**/api/flows/${rest.id}/backend-code*`, async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}${url.search}`,
    })
    heldInitial = true
    await initialDelivery
    await route.fulfill({ response })
    finishedInitial = true
  })
  try {
    await panel
      .getByRole('button', { name: 'Refresh generated backend', exact: true })
      .click()
    await expect.poll(() => heldInitial).toBe(true)
    await expect(panel).toContainText('Loading generated backend…')
    await expect(code).toHaveCount(0)
    await expect(
      panel.getByRole('button', {
        name: 'Refresh generated backend',
        exact: true,
      }),
    ).toBeDisabled()
    await capture(
      'Generated backend',
      'Generated backend read loading',
      'A real artifact response is held during delivery. Loading replaces prior code and prevents duplicate reads.',
    )
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Generated backend', exact: true })
      .click()
    await open(graphql.name)
  } finally {
    deliverInitial()
  }
  await expect.poll(() => finishedInitial).toBe(true)
  await expect(panel).toContainText(`POST /graphql${graphql.path}`)
  await expect(code).not.toContainText(rest.path)
  await capture(
    'Generated backend',
    'Late backend read ignored after API change',
    'Switching APIs fences the delayed previous response. Only the selected GraphQL release remains visible.',
  )
  await page.unroute(`**/api/flows/${rest.id}/backend-code*`)
  await expect(panel).toContainText(`POST /graphql${graphql.path}`)
  await expect(code).toContainText('runtime.graphql')
  await capture(
    'Generated backend',
    'Generated GraphQL backend route',
    'The published GraphQL module identifies its actual route and Besh GraphQL runtime requirements. Previewing it performs no operation.',
  )
  await panel.getByText('Release integrity', { exact: true }).click()
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark generated backend panel',
    'Dark code, requirements, integrity hashes and export controls remain readable.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expectGraphContained()
  await capture(
    'Mobile dark',
    'Generated backend code phone',
    'The module scrolls inside its code block; filenames and hashes wrap, and both graph nodes fit the phone canvas.',
  )
  await appearance('Light')
  await expectGraphContained()
  await capture(
    'Mobile',
    'Light generated backend code phone',
    'The light phone panel keeps runtime requirements, readonly code and actions contained without document overflow.',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expectGraphContained()

  const viewer = await management<{ token: string }>('/api/members', {
    name: 'Generated backend reviewer',
    role: 'viewer',
  })
  await login(viewer.token)
  await open(graphql.name)
  await expect(code).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await panel
    .getByRole('button', { name: 'Copy backend code', exact: true })
    .click()
  await expect(
    panel.getByRole('button', { name: 'Backend copied', exact: true }),
  ).toBeVisible()
  await capture(
    'Permissions',
    'Viewer can review generated backend',
    'Read APIs permits reviewing and copying generated server code; publication remains separately denied.',
  )
  const role = await management<{ id: string }>('/api/roles', {
    name: 'No generated backend reading',
    permissions: [],
  })
  const member = await management<{ token: string }>('/api/members', {
    name: 'Generated backend account only',
    role: 'custom',
    roleId: role.id,
  })
  const before = reads
  await login(member.token)
  await page.getByRole('button', { name: /^API Studio/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Permission required', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Generated backend', exact: true }),
  ).toHaveCount(0)
  expect(reads).toBe(before)
  await capture(
    'Permissions',
    'Generated backend requires API reading',
    'Account-only sign-in succeeds, but the denied Studio never mounts the panel or fetches a private artifact.',
  )
  expect(runtimeRequests).toBe(0)
  page.off('request', observe)
  await login(owner)
  await page.context().clearPermissions()
}
