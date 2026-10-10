import { openApiTools } from './api-tools'
import { expect, type Page, type Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Member, Role, SavedFlow } from '../web/lib/api'
import { helloFlow } from '../test/fixtures'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function flowAccessPreviews({
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
  async function management<T>(path: string, data?: unknown, method = 'POST') {
    const response = await page.request.fetch(`${apiOrigin}${path}`, {
      headers,
      method,
      ...(data === undefined ? {} : { data }),
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as T
  }
  const basePath = `/v1/shared-${crypto.randomUUID().slice(0, 8)}`
  const rest = await management<SavedFlow>('/api/flows', {
    ...helloFlow,
    name: 'Shared customer REST API',
    path: `${basePath}/customers`,
  })
  const graphql = await management<SavedFlow>('/api/flows', {
    ...helloFlow,
    name: 'Shared customer GraphQL API',
    path: `${basePath}/graphql`,
    method: 'POST',
    graphql: {
      schema:
        'type Query { hello: Message! } type Message { message: String! }',
    },
  })
  const hidden = await management<SavedFlow>('/api/flows', {
    ...helloFlow,
    name: 'Private owner accounting API',
    path: `${basePath}/accounting`,
  })
  for (const flow of [rest, graphql, hidden])
    await management(`/api/flows/${flow.id}/publish`, { revision: 1 })
  const readerRole = await management<Role>('/api/roles', {
    name: 'Selected API reading role',
    permissions: ['flows.read'],
  })
  async function login(token: string, empty = false) {
    if (
      await page.getByRole('button', { name: 'Sign out', exact: true }).count()
    )
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: empty ? 'No APIs shared' : /^API Studio/,
      }),
    ).toBeVisible()
  }
  async function members() {
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Your team', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Loading workspace records…', { exact: true }),
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
  const row = page.getByRole('row').filter({ hasText: 'Selected API reviewer' })
  const sharing = page.getByRole('region', {
    name: 'API sharing for Selected API reviewer',
    exact: true,
  })
  async function openSharing() {
    await page
      .getByRole('button', {
        name: 'Manage APIs for Selected API reviewer',
        exact: true,
      })
      .click()
    await expect(
      sharing.getByRole('heading', {
        name: 'API sharing for Selected API reviewer',
        exact: true,
      }),
    ).toBeInViewport({ ratio: 0.5 })
    await expect(
      sharing.getByText('Loading API sharing…', { exact: true }),
    ).toHaveCount(0)
    await expect(
      sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
    ).toBeEnabled()
  }
  async function review() {
    await sharing
      .getByRole('button', { name: 'Review API sharing', exact: true })
      .click()
  }
  async function confirm() {
    await sharing
      .getByRole('button', { name: 'Confirm API sharing', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('API sharing updated')
  }
  async function refreshSharing() {
    await sharing
      .getByRole('button', { name: 'Refresh API access', exact: true })
      .click()
    await expect(
      sharing.getByText('Loading API sharing…', { exact: true }),
    ).toHaveCount(0)
  }
  async function chooseMode(
    value: 'All APIs' | 'Selected APIs only',
    creation = false,
  ) {
    await page
      .getByRole('combobox', {
        name: creation
          ? 'New member API access'
          : 'API access for Selected API reviewer',
        exact: true,
      })
      .click()
    await page.getByRole('option', { name: value, exact: true }).click()
  }
  await login(owner)
  await appearance('Light')
  await members()
  await capture(
    'Members',
    'New member keeps all API access by default',
    'Existing roles retain all current and future APIs unless the owner explicitly selects read-only sharing.',
  )
  await page
    .getByRole('combobox', { name: 'New member API access', exact: true })
    .click()
  await capture(
    'Members',
    'API sharing mode choices',
    'Keyboard-accessible custom options distinguish all APIs from an explicit selected list.',
  )
  await page
    .getByRole('option', { name: 'Selected APIs only', exact: true })
    .click()
  const creation = page.getByRole('region', {
    name: 'New member API access',
    exact: true,
  })
  await expect(creation).toContainText('No APIs selected')
  await capture(
    'Members',
    'Selected sharing starts with no APIs',
    'An empty selection is an intentional policy: sign-in and own account remain available, but no API is shared.',
  )
  for (const flow of [rest, graphql])
    await creation
      .getByRole('checkbox', { name: `Share ${flow.name}`, exact: true })
      .check()
  await capture(
    'Members',
    'Choose REST and GraphQL APIs to share',
    'The owner sees actual saved names and routes. Sharing grants no runtime credentials or related resource access.',
  )
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  await page
    .getByRole('option', { name: 'Editor · build and test', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Add member', exact: true }),
  ).toBeDisabled()
  await expect(creation.getByRole('alert')).toContainText('beyond Read APIs')
  await capture(
    'Members',
    'Selected sharing rejects global action roles',
    'The selected IDs remain intact. Creation is disabled until the owner chooses a read-only role or explicitly restores all API access.',
  )
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  await page
    .getByRole('option', { name: 'Viewer · read APIs', exact: true })
    .click()
  await page
    .getByLabel('Member name', { exact: true })
    .fill('Selected API reviewer')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(
    page.getByLabel('New member token', { exact: true }),
  ).toBeVisible()
  const viewer = await page
    .getByLabel('New member token', { exact: true })
    .inputValue()
  await capture(
    'Members',
    'Selected sharing member receipt',
    'Member creation atomically saves the selected policy and returns one credential. The screenshot masks its one-time value.',
  )
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await expect(row).toContainText('Selected APIs · 2')
  const people = await management<Member[]>('/api/members', undefined, 'GET')
  const member = people.find(
    (person) => person.name === 'Selected API reviewer',
  )!
  expect(member.flowAccess).toEqual({
    mode: 'selected',
    flowIds: [rest.id, graphql.id].sort(),
    version: 1,
  })
  await row
    .getByRole('combobox', {
      name: 'Role for Selected API reviewer',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Editor · build and test', exact: true })
    .click()
  page.once('dialog', (dialog) => void dialog.accept())
  await row.getByRole('button', { name: 'Change role', exact: true }).click()
  await expect(row.getByRole('alert')).toContainText(
    'requires scoped API actions only',
  )
  expect(
    (await management<Member[]>('/api/members', undefined, 'GET')).find(
      (person) => person.id === member.id,
    )!.flowAccess.version,
  ).toBe(1)
  await capture(
    'Members',
    'Selected API reader rejects editor assignment',
    'The real server rejects action-grant expansion. The viewer role, selected policy and access version remain unchanged.',
  )
  await row
    .getByRole('combobox', {
      name: 'Role for Selected API reviewer',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Viewer · read APIs', exact: true })
    .click()
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  const readingRole = page.getByRole('option', {
    name: 'Selected API reading role · custom role',
    exact: true,
  })

  // Scroll within the menu instead of relying on option-click auto-scrolling.
  await page.getByRole('listbox').hover()
  await page.mouse.wheel(0, 600)
  await expect(readingRole).toBeInViewport({ ratio: 1 })
  await readingRole.click()
  await chooseMode('Selected APIs only', true)
  await creation
    .getByRole('checkbox', { name: `Share ${rest.name}`, exact: true })
    .check()
  await page
    .getByLabel('Member name', { exact: true })
    .fill('Selected custom role reviewer')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(
    page.getByLabel('New member token', { exact: true }),
  ).toBeVisible()
  const customReader = await page
    .getByLabel('New member token', { exact: true })
    .inputValue()
  await capture(
    'Members',
    'Custom read-only role selected API receipt',
    'A custom role with only Read APIs can atomically create a selected reader. The one-time credential is masked.',
  )
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await page
    .getByRole('button', { name: `Edit ${readerRole.name}`, exact: true })
    .click()
  await page
    .getByRole('checkbox', { name: 'Manage data sources', exact: true })
    .check()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Save role', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Custom roles' }).getByRole('alert'),
  ).toContainText(/selected/i)
  await capture(
    'Members',
    'Custom selected reader role expansion rejected',
    'Adding global Manage data sources to an assigned selected-reader role returns a real conflict. Existing grants and sharing remain read-only.',
  )
  await page
    .getByRole('button', { name: 'Cancel role changes', exact: true })
    .click()
  let deliverRead = () => {}
  let heldRead = false
  let finishedRead = false
  const readDelivery = new Promise<void>((resolve) => {
    deliverRead = resolve
  })
  await page.route('**/api/members', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}`,
    })
    heldRead = true
    await readDelivery
    await route.fulfill({ response })
    finishedRead = true
  })
  await page
    .getByRole('button', {
      name: 'Manage APIs for Selected API reviewer',
      exact: true,
    })
    .click()
  await expect.poll(() => heldRead).toBe(true)
  await expect(sharing).toContainText('Loading API sharing…')
  await expect(
    sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
  ).toBeDisabled()
  await capture(
    'Members',
    'API sharing metadata read loading',
    'The real current-policy response is held. Saving and selection changes stay disabled until its version is known.',
  )
  await sharing
    .getByRole('button', { name: 'Close API sharing', exact: true })
    .click()
  deliverRead()
  await expect.poll(() => finishedRead).toBe(true)
  await expect(sharing).toHaveCount(0)
  await expect(row).toContainText('Selected APIs · 2')
  await capture(
    'Members',
    'Late sharing read ignored after close',
    'Closing the editor fences its delayed real response. It cannot reopen the editor or overwrite another review.',
  )
  await page.unroute('**/api/members')
  await openSharing()
  await sharing
    .getByRole('checkbox', { name: `Share ${rest.name}`, exact: true })
    .uncheck()
  await review()
  await expect(
    sharing.getByRole('region', { name: 'Review API sharing', exact: true }),
  ).toContainText(graphql.name)
  await capture(
    'Members',
    'Review selected API policy',
    'The named API and route, access version, session-ending effect and runtime/resource boundaries are reviewed before the change.',
  )
  await sharing
    .getByRole('button', { name: 'Cancel sharing review', exact: true })
    .click()
  expect(
    (await management<Member[]>('/api/members', undefined, 'GET')).find(
      (person) => person.id === member.id,
    )!.flowAccess.version,
  ).toBe(1)
  await capture(
    'Members',
    'Cancel API sharing review',
    'Cancel returns to unsaved choices without updating access, audit or browser sessions.',
  )
  await sharing
    .getByRole('button', { name: 'Close API sharing', exact: true })
    .click()

  let selectedSession = false
  let runtimeRequests = 0
  const privateReads: string[] = []
  const observe = (request: Request) => {
    const path = new URL(request.url()).pathname
    if (/^\/(run|graphql)\//.test(path)) runtimeRequests++
    if (
      selectedSession &&
      (path.includes(hidden.id) ||
        /^\/api\/(data-sources|database-connections|auth-connections|runtime-keys|audit|backups|roles|members|load-tests)(\/|$)/.test(
          path,
        ))
    )
      privateReads.push(path)
  }
  page.on('request', observe)
  selectedSession = true
  await login(customReader)
  await expect(
    page.locator('.api-list button').filter({ hasText: rest.name }),
  ).toBeVisible()
  await expect(
    page.locator('.api-list button').filter({ hasText: graphql.name }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'Permissions',
    'Custom role receives only selected REST API',
    'The assigned custom read-only role sees exactly its selected API without gaining action or resource access.',
  )
  await login(viewer)
  await expect(
    page.locator('.api-list button').filter({ hasText: rest.name }),
  ).toBeVisible()
  await expect(
    page.locator('.api-list button').filter({ hasText: graphql.name }),
  ).toBeVisible()
  await expect(
    page.locator('.api-list button').filter({ hasText: hidden.name }),
  ).toHaveCount(0)
  for (const flow of [rest, graphql]) {
    await page
      .locator('.api-list button')
      .filter({ hasText: flow.name })
      .click()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Test flow', exact: true }),
    ).toBeDisabled()
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Release history', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Review release 1', exact: true })
      .click()
    await expect(
      page.getByRole('region', { name: 'Release review', exact: true }),
    ).toContainText(flow.name)
    if (!flow.graphql) {
      const download = page.waitForEvent('download')
      await openApiTools(page)
      await page
        .getByRole('button', { name: 'Download OpenAPI', exact: true })
        .click()
      const document = await download
      expect(document.suggestedFilename()).toBe('besh-published-1.openapi.json')
      expect(readFileSync((await document.path())!, 'utf8')).toContain(
        rest.path,
      )
    }
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Use this API', exact: true })
      .click()
    const client = page.getByRole('region', {
      name: 'Use this API',
      exact: true,
    })
    await expect(
      client.getByRole('button', { name: 'Generate example', exact: true }),
    ).toBeEnabled()
    await client
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    await expect(client.getByLabel('Generated client code')).toBeVisible()
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Generated backend', exact: true })
      .click()
    const artifact = page.getByRole('region', {
      name: 'Generated backend',
      exact: true,
    })
    await expect(artifact.getByLabel('Generated backend code')).toBeVisible()
    await capture(
      'Permissions',
      flow.graphql
        ? 'Selected GraphQL read exports'
        : 'Selected REST read exports',
      'Only the chosen API appears in Studio. History, client examples and the generated backend are readable; editing, testing and publication remain denied.',
    )
  }
  for (const suffix of [
    '',
    '/releases',
    '/releases/1',
    '/openapi?revision=1',
    '/client-code',
    '/backend-code',
  ]) {
    expect(
      (
        await page.request.get(`${apiOrigin}/api/flows/${hidden.id}${suffix}`, {
          headers: { authorization: `Bearer ${viewer}` },
        })
      ).status(),
    ).toBe(404)
  }
  await expect(
    page.getByRole('button', { name: 'Data sources', exact: true }),
  ).toHaveCount(0)
  expect(privateReads).toEqual([])
  await expect(
    page
      .getByRole('region', { name: 'Generated backend', exact: true })
      .getByLabel('Generated backend code'),
  ).toBeVisible()
  await management(
    `/api/members/${member.id}/flow-access`,
    { mode: 'selected', flowIds: [rest.id], version: 1 },
    'PUT',
  )
  await page
    .getByRole('region', { name: 'Generated backend', exact: true })
    .getByRole('button', { name: 'Refresh generated backend', exact: true })
    .click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('revoked')
  await capture(
    'Permissions',
    'Sharing update ends viewer browser session',
    'A real owner policy change revokes the affected cookie. The next private read signs the browser out without retaining the former API view.',
  )
  await login(viewer)
  await expect(
    page.locator('.api-list button').filter({ hasText: rest.name }),
  ).toBeVisible()
  await expect(
    page.locator('.api-list button').filter({ hasText: graphql.name }),
  ).toHaveCount(0)
  expect(privateReads).toEqual([])
  await capture(
    'Permissions',
    'Relogin adopts current selected API policy',
    'A new session reads the current policy; the removed GraphQL API disappears without a forbidden direct lookup.',
  )
  selectedSession = false
  await login(owner)
  await members()
  await openSharing()
  await sharing
    .getByRole('checkbox', { name: `Share ${graphql.name}`, exact: true })
    .check()
  await management(
    `/api/members/${member.id}/flow-access`,
    { mode: 'all', version: 2 },
    'PUT',
  )
  await review()
  await sharing
    .getByRole('button', { name: 'Confirm API sharing', exact: true })
    .click()
  await expect(sharing.getByRole('alert')).toContainText('API access changed')
  await expect(
    sharing.getByRole('checkbox', {
      name: `Share ${graphql.name}`,
      exact: true,
    }),
  ).toBeChecked()
  await expect(
    sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Stale sharing policy requires explicit refresh',
    'The real competing owner update rejects the old expected version. Chosen IDs remain visible, while another save is blocked until refresh.',
  )
  await refreshSharing()
  await expect(
    sharing.getByRole('combobox', {
      name: 'API access for Selected API reviewer',
      exact: true,
    }),
  ).toContainText('All APIs')
  await expect(sharing).toContainText('Access version 3')
  await expect(row).toContainText('All APIs')
  await capture(
    'Members',
    'Sharing refresh adopts current owner policy',
    'Explicit refresh reads the real all-API policy and current version without silently resubmitting old choices.',
  )
  await chooseMode('Selected APIs only')
  for (const flow of [rest, graphql])
    await sharing
      .getByRole('checkbox', { name: `Share ${flow.name}`, exact: true })
      .check()
  let release = () => {}
  let committed = false
  const delivery = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/members/*/access', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}`,
    })
    expect(response.status()).toBe(200)
    committed = true
    await delivery
    await route.fulfill({ response })
  })
  await review()
  await capture(
    'Members',
    'Confirm selected API sharing',
    'Both named routes are reviewed before their policy replaces all-API visibility and ends affected sessions.',
  )
  await sharing
    .getByRole('button', { name: 'Confirm API sharing', exact: true })
    .click()
  await expect.poll(() => committed).toBe(true)
  for (const label of [
    'Confirm API sharing',
    'Refresh API access',
    'Close API sharing',
  ])
    await expect(
      sharing.getByRole('button', { name: label, exact: true }),
    ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Sharing save response pending',
    'The actual server change has completed but delivery is held. Duplicate save, navigation and credential transitions stay blocked.',
  )
  release()
  await expect(page.getByRole('status')).toContainText('API sharing updated')
  await page.unroute('**/api/members/*/access')
  await capture(
    'Members',
    'Selected sharing save completed',
    'The confirmed version is adopted and team summary updates after exactly one saved policy change.',
  )

  await sharing
    .getByRole('checkbox', { name: `Share ${graphql.name}`, exact: true })
    .uncheck()
  await page.route('**/api/members/*/access', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}`,
    })
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await review()
  await sharing
    .getByRole('button', { name: 'Confirm API sharing', exact: true })
    .click()
  await expect(sharing.getByRole('alert')).toContainText(
    'Could not confirm whether API sharing was saved',
  )
  await expect(
    sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Lost sharing save outcome unconfirmed',
    'A real committed PUT loses its response. The UI preserves choices, avoids claiming failure and blocks another save until current policy is read.',
  )
  await page.unroute('**/api/members/*/access')
  await refreshSharing()
  await expect(sharing).toContainText('Access version 5')
  await expect(row).toContainText('Selected APIs · 1')
  await expect(
    sharing.getByRole('checkbox', {
      name: `Share ${graphql.name}`,
      exact: true,
    }),
  ).not.toBeChecked()
  await capture(
    'Members',
    'Lost sharing save refresh recovery',
    'Explicit refresh discovers the actually committed REST-only policy and clears the unconfirmed outcome.',
  )

  let failRead = true
  await page.route('**/api/members', async (route) => {
    if (failRead && route.request().method() === 'GET') {
      failRead = false
      await route.abort('failed')
    } else await route.fallback()
  })
  await refreshSharing()
  await expect(sharing.getByRole('alert')).toBeVisible()
  await expect(
    sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Sharing metadata delivery error',
    'A lost actual metadata response invalidates version knowledge. Choices remain visible but cannot be saved until refresh succeeds.',
  )
  await refreshSharing()
  await expect(sharing.getByRole('alert')).toHaveCount(0)
  await expect(
    sharing.getByRole('button', { name: 'Review API sharing', exact: true }),
  ).toBeEnabled()
  await page.unroute('**/api/members')
  await capture(
    'Members',
    'Sharing metadata retry recovered',
    'A successful explicit refresh restores current version knowledge and review controls with truthful success feedback.',
  )
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark selected API sharing editor',
    'The API catalog, selected custom checkboxes, role guidance and policy controls remain readable in dark mode.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await sharing
    .getByRole('button', { name: 'Close API sharing', exact: true })
    .click()
  await openSharing()
  await capture(
    'Mobile dark',
    'Selected API sharing phone',
    'The separate sharing panel fits phone width while the member table retains its own horizontal scroll.',
  )
  await appearance('Light')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile',
    'Light selected API sharing phone',
    'API names, routes, selection counts and owner review actions remain contained at phone width.',
  )
  await review()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile',
    'Selected API sharing review phone',
    'The actual confirmation and cancellation controls stay contained with named route and session-ending guidance at phone width.',
  )
  await sharing
    .getByRole('button', { name: 'Cancel sharing review', exact: true })
    .click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await sharing
    .getByRole('checkbox', { name: `Share ${rest.name}`, exact: true })
    .uncheck()
  await review()
  await expect(
    sharing.getByRole('region', { name: 'Review API sharing', exact: true }),
  ).toContainText('No APIs selected')
  await capture(
    'Members',
    'Confirm no shared APIs',
    'An explicit empty-list review removes every API from this reader without removing their account.',
  )
  await confirm()
  await sharing
    .getByRole('button', { name: 'Close API sharing', exact: true })
    .click()
  selectedSession = true
  await login(viewer, true)
  await expect(page.getByTestId('flow-canvas')).toHaveCount(0)
  await expect(page.locator('.api-list button')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generated backend', exact: true }),
  ).toHaveCount(0)
  await capture(
    'Permissions',
    'Selected member with no APIs shared',
    'An empty selected policy shows an honest empty Studio instead of an imaginary draft. No private API detail or export is fetched.',
  )
  await appearance('Dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'No shared APIs phone',
    'The empty policy keeps own account access and sign-out reachable with clear owner-review guidance.',
  )
  expect(privateReads).toEqual([])
  selectedSession = false
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(owner)
  await appearance('Light')
  await members()
  await openSharing()
  await chooseMode('All APIs')
  await review()
  await capture(
    'Members',
    'Restore all API visibility review',
    'The owner explicitly reviews all current and future APIs. Existing viewer action permissions remain unchanged.',
  )
  await confirm()
  await expect(row).toContainText('All APIs')
  await sharing
    .getByRole('button', { name: 'Close API sharing', exact: true })
    .click()
  await login(viewer)
  await expect(
    page.locator('.api-list button').filter({ hasText: hidden.name }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await capture(
    'Permissions',
    'All API access restored for viewer',
    'The next session sees every saved API again while editing, testing and publication stay denied by the viewer role.',
  )
  expect(runtimeRequests).toBe(0)
  page.off('request', observe)
  await login(owner)
}
