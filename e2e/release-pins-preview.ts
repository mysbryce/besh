import { expect, type Page } from '@playwright/test'
import type { RuntimeKey, SavedFlow } from '../web/lib/api'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function releasePinPreviews({
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
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const path = `/v1/release-pin-${crypto.randomUUID().slice(0, 8)}`
  const definition = {
    name: 'Release-pinned customer API',
    method: 'GET',
    path,
    nodes: [
      { id: 'request', type: 'request', position: { x: 0, y: 0 }, config: {} },
      {
        id: 'response',
        type: 'response',
        position: { x: 350, y: 0 },
        config: { status: 200, body: { revision: 1 } },
      },
    ],
    edges: [{ id: 'next', source: 'request', target: 'response' }],
  }
  async function management<T>(url: string, data?: unknown, method = 'POST') {
    const response = await page.request.fetch(`${apiOrigin}${url}`, {
      method,
      headers,
      ...(data === undefined ? {} : { data }),
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as T
  }
  async function publish(flow: SavedFlow) {
    return management<SavedFlow>(`/api/flows/${flow.id}/publish`, {
      revision: flow.revision,
    })
  }
  const rest = await management<SavedFlow>('/api/flows', definition)
  await publish(rest)
  const graphql = await management<SavedFlow>('/api/flows', {
    ...definition,
    name: 'Release-pinned GraphQL API',
    path: `${path}/graphql`,
    method: 'POST',
    graphql: {
      schema:
        'type Query { customer: Result! } type Mutation { customer: Result! } type Result { revision: Int! }',
    },
  })
  await publish(graphql)

  async function login(token: string) {
    if (
      await page.getByRole('button', { name: 'Sign out', exact: true }).count()
    )
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await expect(
      page.getByText('Loading API keys…', { exact: true }),
    ).toHaveCount(0)
  }
  async function select(label: string, name: string) {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
  }
  async function appearance(mode: 'Light' | 'Dark') {
    await select('Appearance', mode)
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      mode.toLowerCase(),
    )
  }
  const dialog = page.getByRole('dialog', {
    name: 'Create release-pinned API key',
    exact: true,
  })
  const receipt = page.getByRole('region', {
    name: 'Save API key',
    exact: true,
  })
  async function token() {
    await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
    return page.getByLabel('New API key', { exact: true }).inputValue()
  }
  async function acknowledge() {
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    await expect(receipt).toHaveCount(0)
  }
  async function refresh() {
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('API keys refreshed.')
  }
  function row(name: string) {
    return page
      .getByRole('row')
      .filter({ has: page.getByText(name, { exact: true }) })
  }
  async function runtime(
    secret: string,
    status: number,
    revision?: number,
    gql = false,
    mutation = false,
  ) {
    const response = gql
      ? await page.request.post(`${apiOrigin}/graphql${graphql.path}`, {
          headers: { authorization: `Bearer ${secret}` },
          data: {
            query: `${mutation ? 'mutation' : 'query'} { customer { revision } }`,
          },
        })
      : await page.request.get(`${apiOrigin}/run${rest.path}`, {
          headers: { authorization: `Bearer ${secret}` },
        })
    expect(response.status()).toBe(status)
    if (status === 200)
      expect(await response.json()).toEqual(
        gql ? { data: { customer: { revision } } } : { revision },
      )
  }
  async function prepare(name: string, pinned: boolean, apiName = rest.name) {
    await select('Published API', apiName)
    await page.getByLabel('Key name', { exact: true }).fill(name)
    await select('Expires in', '7 days')
    await select(
      'Release access',
      pinned ? 'Only this release' : 'Follow published changes',
    )
  }
  async function allowMutations() {
    const choice = page.getByRole('checkbox', {
      name: 'GraphQL mutations',
      exact: true,
    })
    if ((await choice.getAttribute('aria-checked')) !== 'true')
      await choice.click()
    await expect(choice).toBeChecked()
  }
  async function review() {
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()
    await expect(dialog).toBeVisible()
  }
  async function confirm() {
    await dialog
      .getByRole('button', { name: 'Create pinned key', exact: true })
      .click()
  }

  await login(owner)
  await appearance('Light')
  await prepare('Following customer caller', false)
  await capture(
    'API keys',
    'Follow published changes key choice',
    'The default caller mode follows future published releases. The API, grants and expiry remain explicit.',
  )
  await page
    .getByRole('combobox', { name: 'Release access', exact: true })
    .click()
  await capture(
    'API keys',
    'Release access choices',
    'The accessible custom selector offers following changes or access only while one chosen release is current.',
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const following = await token()
  await expect(receipt).toContainText('Follow published changes')
  await capture(
    'API keys',
    'Following key receipt',
    'The one-time credential is masked. Its receipt retains the name, grants, expiry and following mode.',
  )
  await runtime(following, 200, 1)
  await acknowledge()

  await prepare('Pinned customer caller', true)
  await capture(
    'API keys',
    'Only this release selected',
    'Selecting a pin captures the actual published revision and route. Refresh will not silently change that selection.',
  )
  await review()
  await expect(dialog).toContainText('Only release 1')
  await expect(dialog).toContainText(`GET /run${path}`)
  await capture(
    'API keys',
    'Confirm pinned caller key',
    'Review the actual API, release, route, grants and expiry before creating a pinned key. Imported data and login settings remain mutable.',
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await appearance('Dark')
  await review()
  await capture(
    'Appearance',
    'Dark pinned key confirmation',
    'The explicit release review stays readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'Pinned key confirmation phone',
    'The confirmation scrolls within the phone viewport and keeps both actions reachable.',
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await appearance('Light')
  await review()
  await capture(
    'Mobile',
    'Light pinned key confirmation phone',
    'Release, endpoint, grants and expiry remain readable in the light phone dialog.',
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await review()
  await confirm()
  const pinned = await token()
  await expect(receipt).toContainText('Only release 1')
  await expect(row('Pinned customer caller')).toContainText('Active')
  await capture(
    'API keys',
    'Active pinned key receipt',
    'The masked new key is active while its exact release is current. The receipt includes the release and unchanged expiry.',
  )
  await page.getByRole('button', { name: 'Copy API key', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('API key copied.')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard === pinned).toBe(true)
  await capture(
    'API keys',
    'Copy pinned caller credential',
    'Copy writes the disposable pinned caller credential to the clipboard. Its screenshot remains masked and the release metadata stays visible.',
  )
  const firstKeys = await management<RuntimeKey[]>(
    '/api/runtime-keys',
    undefined,
    'GET',
  )
  const firstPin = firstKeys.find(
    (key) => key.name === 'Pinned customer caller',
  )!
  expect(firstPin.releaseRevision).toBe(1)
  await runtime(pinned, 200, 1)
  await acknowledge()
  await capture(
    'API keys',
    'Following and pinned key inventory',
    'The list distinguishes following keys from pinned keys and displays current release status when Read APIs is available.',
  )

  const second = await management<SavedFlow>(
    `/api/flows/${rest.id}`,
    {
      ...definition,
      revision: 1,
      nodes: [
        definition.nodes[0],
        {
          ...definition.nodes[1],
          config: { status: 200, body: { revision: 2 } },
        },
      ],
    },
    'PUT',
  )
  await publish(second)
  await runtime(following, 200, 2)
  await runtime(pinned, 403)
  await refresh()
  await expect(row('Pinned customer caller')).toContainText('Dormant')
  await expect(row('Following customer caller')).toContainText('Active')
  await capture(
    'API keys',
    'Pinned key dormant after publication',
    'Publishing another release makes the existing pin dormant. The following key calls the new live release; the dormant key is rejected before execution.',
  )
  page.once('dialog', async (confirmation) => {
    expect(confirmation.message()).toContain('Only release 1')
    expect(confirmation.message()).toContain('remains dormant')
    await confirmation.accept()
  })
  await row('Pinned customer caller')
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  const replacement = await token()
  await expect(receipt).toContainText('Dormant')
  const rotatedKeys = await management<RuntimeKey[]>(
    '/api/runtime-keys',
    undefined,
    'GET',
  )
  const rotated = rotatedKeys.find(
    (key) => key.name === 'Pinned customer caller' && !key.revokedAt,
  )!
  expect(rotated.releaseRevision).toBe(firstPin.releaseRevision)
  expect(rotated.expiresAt).toBe(firstPin.expiresAt)
  await runtime(pinned, 401)
  await runtime(replacement, 403)
  await capture(
    'API keys',
    'Dormant pinned key replacement receipt',
    'Replacing a dormant key revokes the old credential and preserves the exact pin, grants and expiry. The masked replacement remains dormant.',
  )
  await appearance('Dark')
  await capture(
    'Appearance',
    'Dark dormant pinned key receipt',
    'The dormant state and pin remain legible beside the one-time masked replacement.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'Dormant pinned key phone',
    'The replacement receipt stacks on phone width and the key inventory scrolls inside its own table.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light dormant pinned key phone',
    'Release access and credential acknowledgment remain available in the light phone layout.',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await acknowledge()

  await management(`/api/flows/${rest.id}/rollback`, {
    revision: 1,
    publishedRevision: 2,
  })
  await runtime(replacement, 200, 1)
  await runtime(following, 200, 1)
  await refresh()
  await expect(
    row('Pinned customer caller').filter({ hasText: 'Active' }),
  ).toHaveCount(1)
  await capture(
    'API keys',
    'Rollback reactivates exact release pin',
    'Rollback to the exact pinned release restores the valid replacement key. Revoked credentials remain revoked, and the following key calls the same current release.',
  )

  await prepare('Stale release review caller', true)
  await publish(second)
  await review()
  await confirm()
  await expect(page.getByRole('alert')).toContainText(
    /changed|current|release/i,
  )
  await expect(page.getByLabel('Key name', { exact: true })).toHaveValue(
    'Stale release review caller',
  )
  await expect(
    page.getByText('Only release 1 selected.', { exact: false }),
  ).toBeVisible()
  await expect(receipt).toHaveCount(0)
  await expect(
    page.getByText('Only release 1 selected.', { exact: false }),
  ).toContainText('Current published release: unknown')
  await expect(
    row('Pinned customer caller').filter({
      hasText: 'Current release unknown',
    }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await capture(
    'API keys',
    'Stale pinned issuance rejected',
    'A real competing publication rejects issuance for the stale revision. The selected pin, key name and grants stay available for explicit review.',
  )
  await refresh()
  await expect(
    page.getByText('Only release 1 selected.', { exact: false }),
  ).toContainText('Current published release: 2')
  await capture(
    'API keys',
    'Refresh preserves stale pin selection',
    'Refresh updates current release metadata while preserving the old selected pin. Use current release is an explicit separate action.',
  )
  await page
    .getByRole('button', { name: 'Use current release', exact: true })
    .click()
  await expect(
    page.getByText('Only release 2 selected.', { exact: false }),
  ).toBeVisible()
  await capture(
    'API keys',
    'Review and select current release pin',
    'The user explicitly adopts release 2 and can review its actual endpoint before issuance.',
  )
  await review()

  let releaseDelivery = () => {}
  const delivery = new Promise<void>((resolve) => {
    releaseDelivery = resolve
  })
  let issuanceCount = 0
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    issuanceCount++
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}/api/runtime-keys`,
    })
    await delivery
    await route.fulfill({ response })
  })
  await confirm()
  await expect(
    dialog.getByRole('button', { name: 'Create pinned key', exact: true }),
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await capture(
    'API keys',
    'Pinned key issuance pending',
    'Only real response delivery is delayed. Duplicate creation, cancellation, sign-out and workspace navigation stay locked while the server-issued key is pending.',
  )
  releaseDelivery()
  await token()
  expect(issuanceCount).toBe(1)
  await page.unroute('**/api/runtime-keys')
  await expect(receipt).toContainText('Only release 2')
  await capture(
    'API keys',
    'Current release pin issuance recovered',
    'After explicit review, exactly one new release 2 key is returned. Its one-time credential is masked.',
  )
  await acknowledge()

  await prepare('Following GraphQL caller', false, graphql.name)
  await allowMutations()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const gqlFollowing = await token()
  await runtime(gqlFollowing, 200, 1, true)
  await runtime(gqlFollowing, 200, 1, true, true)
  await capture(
    'API keys',
    'Following GraphQL key receipt',
    'The following GraphQL key has explicit query and mutation grants and remains separate from release-pinned credentials.',
  )
  await acknowledge()

  await prepare('Pinned GraphQL caller', true, graphql.name)
  await allowMutations()
  await review()
  await expect(dialog).toContainText('GraphQL queries, GraphQL mutations')
  await capture(
    'API keys',
    'GraphQL pinned key confirmation',
    'The pin uses the published GraphQL endpoint and explicitly selected query and mutation grants.',
  )
  await confirm()
  const gqlPin = await token()
  await runtime(gqlPin, 200, 1, true)
  await runtime(gqlPin, 200, 1, true, true)
  await capture(
    'API keys',
    'GraphQL release pin receipt',
    'The masked pinned key calls real query and mutation operations while its exact GraphQL release is current.',
  )
  await acknowledge()
  const gqlSecond = await management<SavedFlow>(
    `/api/flows/${graphql.id}`,
    {
      ...definition,
      name: graphql.name,
      path: graphql.path,
      method: 'POST',
      graphql: graphql.graphql,
      revision: 1,
      nodes: [
        definition.nodes[0],
        {
          ...definition.nodes[1],
          config: { status: 200, body: { revision: 2 } },
        },
      ],
    },
    'PUT',
  )
  await publish(gqlSecond)
  await runtime(gqlFollowing, 200, 2, true)
  await runtime(gqlFollowing, 200, 2, true, true)
  await runtime(gqlPin, 403, undefined, true)
  await runtime(gqlPin, 403, undefined, true, true)
  await refresh()
  await expect(row('Pinned GraphQL caller')).toContainText('Dormant')
  await capture(
    'API keys',
    'GraphQL release pin dormant',
    'Both GraphQL operation grants are rejected when the current release differs from the pin. The key cannot execute an archive.',
  )
  await management(`/api/flows/${graphql.id}/rollback`, {
    revision: 1,
    publishedRevision: 2,
  })
  await runtime(gqlPin, 200, 1, true)
  await runtime(gqlPin, 200, 1, true, true)
  await runtime(gqlFollowing, 200, 1, true)
  await runtime(gqlFollowing, 200, 1, true, true)
  await refresh()
  await capture(
    'API keys',
    'GraphQL rollback restores pinned grants',
    'Exact rollback restores both allowed operations for the still-valid key.',
  )

  const expired = await management<RuntimeKey & { token: string }>(
    '/api/runtime-keys',
    {
      name: 'Expired pinned caller',
      flowId: rest.id,
      releaseRevision: 2,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    },
  )
  await expect
    .poll(async () => Date.parse(expired.expiresAt) <= Date.now())
    .toBe(true)
  await runtime(expired.token, 401)
  await refresh()
  await expect(row('Expired pinned caller')).toContainText('Expired')
  await expect(
    row('Expired pinned caller').getByRole('button', {
      name: 'Replace key',
      exact: true,
    }),
  ).toHaveCount(0)
  await capture(
    'API keys',
    'Expired and revoked release pins',
    'Expiry and revocation remain authoritative. An exact matching release does not revive an expired or revoked key.',
  )

  const runResponse = await page.request.post(`${apiOrigin}/api/load-tests`, {
    headers,
    data: { flowId: rest.id, config: { vus: 1, durationSeconds: 5 } },
  })
  expect(runResponse.status()).toBe(202)
  const run = await runResponse.json()
  await refresh()
  const managedKeys = await management<RuntimeKey[]>(
    '/api/runtime-keys',
    undefined,
    'GET',
  )
  const managed = managedKeys.find((key) => key.name === `Load test ${run.id}`)!
  expect(managed.releaseRevision).toBe(2)
  expect(managed.managedBy).toBe('load-test')
  await expect(row(managed.name)).toContainText('Only release 2')
  await expect(row(managed.name)).toContainText('Managed by load testing')
  await expect(
    row(managed.name).getByRole('button', { name: 'Replace key', exact: true }),
  ).toHaveCount(0)
  await capture(
    'API keys',
    'Managed load-test release pin',
    'A real bounded k6 job creates a temporary key pinned to its selected release. Managed credentials never offer replacement.',
  )
  await expect
    .poll(
      async () => {
        const current = await management<{ status: string }>(
          `/api/load-tests/${run.id}`,
          undefined,
          'GET',
        )
        return current.status
      },
      { timeout: 45_000 },
    )
    .toBe('completed')
  await refresh()
  await expect(row(managed.name)).toContainText('Revoked')
  await capture(
    'API keys',
    'Completed load-test pinned key history',
    'Completion revokes the temporary key while preserving its original release pin in managed history.',
  )

  let privateReads = 0
  const countReads = (request: import('@playwright/test').Request) => {
    if (/\/api\/flows(?:\/|$)/.test(new URL(request.url()).pathname))
      privateReads++
  }
  page.on('request', countReads)
  const role = await management<{ id: string }>('/api/roles', {
    name: 'Pinned key manager only',
    permissions: ['runtime-keys.manage'],
  })
  const member = await management<{ token: string }>('/api/members', {
    name: 'No API read key manager',
    role: 'custom',
    roleId: role.id,
  })
  const before = privateReads
  await login(member.token)
  await expect(
    page.getByRole('heading', {
      name: 'API reading needed for new key choices',
      exact: true,
    }),
  ).toBeVisible()
  await expect(row('Pinned GraphQL caller')).toContainText('Only release 1')
  await expect(row('Pinned GraphQL caller')).toContainText(
    'Current release unknown',
  )
  await refresh()
  expect(privateReads).toBe(before)
  await capture(
    'Permissions',
    'Pinned key manager without API reading',
    'A key manager can see pin metadata and manage existing keys without a private flow lookup. Current release status is honestly unknown; creation choices require Read APIs.',
  )
  page.once('dialog', (confirmation) => confirmation.accept())
  await row('Pinned GraphQL caller')
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await token()
  await expect(receipt).toContainText('Only release 1')
  await expect(receipt).toContainText('Current release unknown')
  expect(privateReads).toBe(before)
  await capture(
    'Permissions',
    'No-read pinned key rotation receipt',
    'Rotation preserves the pin and expiry without looking up private APIs. The masked replacement displays unknown current status.',
  )
  await acknowledge()
  await appearance('Dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(
    'Mobile dark',
    'No-read pinned key manager phone',
    'The account can manage key metadata at phone width while private API choices and release status remain unavailable.',
  )
  await appearance('Light')
  await capture(
    'Mobile',
    'Light no-read pinned key manager phone',
    'The read boundary and unknown status remain readable in the light phone view.',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  page.off('request', countReads)
  await login(owner)

  await prepare('Release metadata recovery caller', false)
  let loseMetadata = true
  await page.route('**/api/flows', async (route) => {
    if (loseMetadata && route.request().method() === 'GET') {
      loseMetadata = false
      await route.abort('failed')
    } else await route.fallback()
  })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'current API releases could not be read',
  )
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await expect(
    row('Pinned GraphQL caller').filter({ hasText: 'Current release unknown' }),
  ).toHaveCount(1)
  await capture(
    'API keys',
    'Current release metadata delivery error',
    'A lost real metadata response keeps key inventory usable but marks current status unknown and blocks creation until explicit refresh succeeds.',
  )
  await refresh()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeEnabled()
  await capture(
    'API keys',
    'Release metadata refresh recovery',
    'Explicit successful refresh clears the error and restores current release status and caller creation controls.',
  )
  await page.unroute('**/api/flows')
  page.once('dialog', (confirmation) => confirmation.accept())
  await row('Following customer caller')
    .getByRole('button', { name: 'Revoke', exact: true })
    .click()
  await expect(row('Following customer caller')).toContainText('Revoked')
  await runtime(following, 401)
  await capture(
    'API keys',
    'Revoke following caller after pin review',
    'Revocation rejects the following caller immediately and leaves its following mode visible in history.',
  )
  const viewer = await management<{ token: string }>('/api/members', {
    name: 'No pinned key administration',
    role: 'viewer',
  })
  let keyReads = 0
  const countKeyReads = (request: import('@playwright/test').Request) => {
    if (new URL(request.url()).pathname === '/api/runtime-keys') keyReads++
  }
  page.on('request', countKeyReads)
  await login(viewer.token)
  await expect(
    page.getByRole('heading', { name: 'Owner access required', exact: true }),
  ).toBeVisible()
  expect(keyReads).toBe(0)
  await capture(
    'Permissions',
    'Viewer denied pinned key administration',
    'Read APIs alone does not grant key administration. The denied page fetches no private runtime-key inventory.',
  )
  page.off('request', countKeyReads)
  await login(owner)
  await page.context().clearPermissions()
}
