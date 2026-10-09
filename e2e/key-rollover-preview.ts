import { expect, type Page } from '@playwright/test'
import { helloFlow } from '../test/fixtures'
import type { RuntimeKey } from '../web/lib/api'

type PreviewOptions = {
  page: Page
  owner: string
  apiOrigin: string
  capture: (page: string, title: string, description: string) => Promise<void>
}

export async function keyRolloverPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: PreviewOptions) {
  const headers = { authorization: `Bearer ${owner}` }
  const unique = crypto.randomUUID().slice(0, 8)
  const flowResponse = await page.request.post(`${apiOrigin}/api/flows`, {
    headers,
    data: {
      ...helloFlow,
      name: `Rollover API ${unique}`,
      path: `/v1/rollover-${unique}`,
    },
  })
  expect(flowResponse.status()).toBe(200)
  const flow = (await flowResponse.json()) as { id: string }
  const publication = await page.request.post(
    `${apiOrigin}/api/flows/${flow.id}/publish`,
    {
      headers,
      data: { revision: 1 },
    },
  )
  expect(publication.status()).toBe(200)
  const keyResponse = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
    headers,
    data: {
      name: `Handover caller ${unique}`,
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: 1,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  })
  expect(keyResponse.status()).toBe(200)
  const old = (await keyResponse.json()) as RuntimeKey & { token: string }
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  async function snapshot(title: string, detail: string) {
    await capture('Key replacement', title, detail)
  }
  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  async function refresh() {
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('API keys refreshed.')
  }
  const namedRows = () =>
    page.getByRole('row').filter({ hasText: `Handover caller ${unique}` })
  const linkedRow = (id: string) =>
    namedRows().filter({
      has: page
        .locator('td > p')
        .filter({ hasText: new RegExp(`^Key ID: ${id}`) }),
    })
  await appearance('Light')
  const row = page
    .getByRole('row')
    .filter({ hasText: `Handover caller ${unique}` })
  await expect(
    row.getByRole('button', { name: 'Replace key', exact: true }),
  ).toBeVisible()
  await row
    .getByRole('button', { name: 'Replacement options', exact: true })
    .click()
  const focusedHeading = page.getByRole('heading', {
    name: 'Replacement options',
    exact: true,
  })
  await expect(focusedHeading).toBeFocused()
  const headingBounds = await focusedHeading.boundingBox()
  expect(headingBounds).not.toBeNull()
  expect(headingBounds!.y).toBeGreaterThanOrEqual(0)
  expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  )
  await expect(
    page.getByRole('combobox', { name: 'Replacement timing', exact: true }),
  ).toBeVisible()
  await snapshot(
    'Immediate replacement remains default',
    'Replacement options preserve immediate revocation as the default. Full key and API identifiers support review without renewing expiry.',
  )
  await page
    .getByRole('button', { name: 'Cancel replacement options', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Replacement options', exact: true }),
  ).toHaveCount(0)
  await snapshot(
    'Cancel replacement options',
    'Cancel closes the review without replacing a key or changing caller access.',
  )
  await row
    .getByRole('button', { name: 'Replacement options', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Replacement timing', exact: true })
    .click()
  await page.getByRole('option', { name: 'Short overlap', exact: true }).click()
  const seconds = page.getByLabel('Overlap seconds (1–300)', { exact: true })
  const review = page.getByRole('button', {
    name: 'Review replacement',
    exact: true,
  })
  await expect(review).toBeDisabled()
  await snapshot(
    'Short overlap needs explicit acknowledgment',
    'An overlap continues old caller access for a bounded period. Both keys remain subject to current authority.',
  )
  await seconds.fill('')
  await expect(review).toBeDisabled()
  await snapshot(
    'Empty overlap duration',
    'A blank duration cannot be reviewed or sent to the server.',
  )
  for (const invalid of ['0', '301', '1.5', '-1', 'no']) {
    await seconds.fill(invalid)
    await expect(seconds).toHaveAttribute('aria-invalid', 'true')
    await expect(review).toBeDisabled()
  }
  await snapshot(
    'Invalid overlap duration',
    'Only whole seconds from 1 to 300 are accepted. No JSON or native numeric picker is required.',
  )
  await seconds.fill('300')
  await page
    .getByRole('checkbox', {
      name: 'I understand the old key continues during overlap',
      exact: true,
    })
    .click()
  await expect(review).toBeEnabled()
  await snapshot(
    'Reviewed five-minute overlap',
    'The requested maximum is reviewed explicitly. Original expiry stays unchanged; only the server can set the accepted old-key deadline.',
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await review.click()
  await expect(review).toBeEnabled()
  await snapshot(
    'Cancel final replacement confirmation',
    'Dismissing the final exact-key confirmation leaves the original key and review settings intact.',
  )
  let releaseInventory = () => {}
  let inventoryArrived = () => {}
  const inventoryReady = new Promise<void>((resolve) => {
    inventoryArrived = resolve
  })
  const inventoryDelivery = new Promise<void>((resolve) => {
    releaseInventory = resolve
  })
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin}/api/runtime-keys`,
    })
    inventoryArrived()
    await inventoryDelivery
    await route.fulfill({ response })
  })
  page.once('dialog', (dialog) => dialog.accept())
  await review.click()
  const receipt = page.getByRole('region', {
    name: 'Save API key',
    exact: true,
  })
  await expect(receipt).toBeVisible()
  await inventoryReady
  try {
    await expect(row.filter({ hasText: 'Replaced by:' })).not.toContainText(
      old.expiresAt,
    )
    await expect(receipt).toContainText(
      'Old-key deadline is awaiting current metadata',
    )
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()
    await snapshot(
      'Accepted replacement awaits fixed deadline',
      'Real replacement succeeded, but inventory delivery is held at the HTTP boundary. The secret is masked; no estimate or original expiry is presented as the old-key deadline.',
    )
  } finally {
    releaseInventory()
  }
  const successorToken = await receipt.getByLabel('New API key').inputValue()
  for (const secret of [old.token, successorToken]) {
    const response = await page.request.get(
      `${apiOrigin}/run/v1/rollover-${unique}`,
      { headers: { authorization: `Bearer ${secret}` } },
    )
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
  }
  const inventory = await page.request.get(`${apiOrigin}/api/runtime-keys`, {
    headers,
  })
  expect(inventory.status()).toBe(200)
  const records = (await inventory.json()) as RuntimeKey[]
  const predecessor = records.find((key) => key.id === old.id)!
  const successor = records.find((key) => key.replacesKeyId === old.id)!
  expect(predecessor.revokedAt).toBeNull()
  expect(predecessor.replacedByKeyId).toBe(successor.id)
  expect(predecessor.acceptUntil).toBe(
    new Date(Date.parse(successor.createdAt) + 300_000).toISOString(),
  )
  expect(successor).toMatchObject({
    flowId: old.flowId,
    permissions: old.permissions,
    releaseRevision: old.releaseRevision,
    tenantId: old.tenantId,
    issuerBinding: old.issuerBinding,
    expiresAt: old.expiresAt,
    acceptUntil: old.expiresAt,
  })
  await expect(receipt).toContainText('Old key accepted until')
  await expect(row.filter({ hasText: 'Replaced by:' })).toContainText(
    'Retiring',
  )
  await expect(receipt.locator('time')).toHaveAttribute(
    'datetime',
    predecessor.acceptUntil,
  )
  await page.unroute('**/api/runtime-keys')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await snapshot(
    'Fixed handover deadline and unchanged expiry',
    'The receipt shows the actual server-approved predecessor deadline and both full key identifiers. Original expiry and caller scope remain unchanged; the new token is masked.',
  )
  await receipt
    .getByRole('button', { name: 'Copy API key', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('API key copied.')
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())) ===
      successorToken,
  ).toBe(true)
  await snapshot(
    'Copy successor once',
    'Copy delivers the one-time successor token to the caller. The screenshot masks the credential.',
  )
  await appearance('Dark')
  await snapshot(
    'Dark handover receipt',
    'Dark appearance keeps the fixed deadline, immutable expiry and masked credential controls readable.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await snapshot(
    'Phone dark handover receipt',
    'A narrow screen wraps full key identifiers and fixed handover guidance without hiding copy or acknowledgment controls.',
  )
  await appearance('Light')
  await snapshot(
    'Phone light handover receipt',
    'Light phone appearance retains the reviewed schedule and masks the successor secret.',
  )
  await receipt
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await expect(receipt).toHaveCount(0)
  await snapshot(
    'Acknowledged handover inventory',
    'After saving the successor, inventory keeps both linked records and the old fixed deadline. An outgoing predecessor cannot be replaced again.',
  )
  await expect(
    linkedRow(old.id).getByRole('button', { name: 'Replace key', exact: true }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 1000 })
  page.once('dialog', (dialog) => dialog.accept())
  await linkedRow(successor.id)
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Refresh API keys before trying again',
  )
  await expect(
    linkedRow(successor.id).getByRole('button', {
      name: 'Replace key',
      exact: true,
    }),
  ).toBeDisabled()
  await snapshot(
    'Live predecessor blocks another replacement',
    'The server rejects a third key while the approved old-key window is live. Replacement stays blocked until an explicit metadata refresh.',
  )
  await refresh()
  await snapshot(
    'Refresh linked handover before cleanup',
    'Explicit Refresh reviews the current chain. It does not silently revoke the predecessor or mint another secret.',
  )
  let revokeReview = ''
  page.once('dialog', async (dialog) => {
    revokeReview = dialog.message()
    await dialog.accept()
  })
  await linkedRow(old.id)
    .getByRole('button', { name: 'Revoke', exact: true })
    .click()
  expect(revokeReview).toContain(old.id)
  await expect(linkedRow(old.id)).toContainText('Revoked')
  const stillWorking = await page.request.get(
    `${apiOrigin}/run/v1/rollover-${unique}`,
    { headers: { authorization: `Bearer ${successorToken}` } },
  )
  expect(stillWorking.status()).toBe(200)
  await snapshot(
    'Revoke exact predecessor without revoking successor',
    'Explicitly revoking the named old identifier ends its window early and releases the chain slot. The successor still serves the same published API.',
  )
  async function chooseOverlap(id: string, duration: string) {
    await linkedRow(id)
      .getByRole('button', { name: 'Replacement options', exact: true })
      .click()
    await page
      .getByRole('combobox', { name: 'Replacement timing', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Short overlap', exact: true })
      .click()
    await seconds.fill(duration)
    await page
      .getByRole('checkbox', {
        name: 'I understand the old key continues during overlap',
        exact: true,
      })
      .click()
  }
  async function inventoryRecords() {
    const response = await page.request.get(`${apiOrigin}/api/runtime-keys`, {
      headers,
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as RuntimeKey[]
  }
  async function runtimeStatus(secret: string) {
    return (
      await page.request.get(`${apiOrigin}/run/v1/rollover-${unique}`, {
        headers: { authorization: `Bearer ${secret}` },
      })
    ).status()
  }
  await chooseOverlap(successor.id, '1')
  await snapshot(
    'Released chain allows reviewed next handover',
    'After exact predecessor cleanup, the successor can be replaced with a newly reviewed one-second window. Original expiry and scope still cannot change.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await review.click()
  await expect(receipt).toContainText('Old key accepted until')
  const secondToken = await receipt.getByLabel('New API key').inputValue()
  const secondRecords = await inventoryRecords()
  const second = secondRecords.find(
    (key) => key.replacesKeyId === successor.id,
  )!
  expect(second.expiresAt).toBe(old.expiresAt)
  await receipt
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await expect.poll(() => runtimeStatus(successorToken)).toBe(401)
  expect(await runtimeStatus(secondToken)).toBe(200)
  await refresh()
  await expect(linkedRow(successor.id)).toContainText(
    'Replaced · acceptance ended',
  )
  await snapshot(
    'Fixed deadline ends old acceptance',
    'Real elapsed time ends the approved one-second predecessor window. The successor remains usable; Refresh reports acceptance ended without extending original expiry.',
  )

  await chooseOverlap(second.id, '1')
  await snapshot(
    'Review another bounded handover',
    'A completed predecessor window frees the chain. Changing duration requires a fresh overlap acknowledgment.',
  )
  const lostRoute = `**/api/runtime-keys/${second.id}/rotate`
  let committedReplacements = 0
  await page.route(lostRoute, async (route) => {
    const response = await route.fetch({
      url: `${apiOrigin}/api/runtime-keys/${second.id}/rotate`,
    })
    expect(response.status()).toBe(200)
    committedReplacements++
    await route.abort('failed')
  })
  page.once('dialog', (dialog) => dialog.accept())
  await review.click()
  await expect(page.getByRole('alert')).toContainText(
    'Could not confirm key replacement',
  )
  await expect(receipt).toHaveCount(0)
  await expect(review).toBeDisabled()
  expect(committedReplacements).toBe(1)
  await expect(linkedRow(second.id)).toContainText(
    'Replacement status unknown · Refresh required',
  )
  const lostRecords = await inventoryRecords()
  const lost = lostRecords.find((key) => key.replacesKeyId === second.id)!
  expect(lost).toBeDefined()
  expect(lost.expiresAt).toBe(old.expiresAt)
  expect(Object.hasOwn(lost, 'token')).toBe(false)
  await snapshot(
    'Committed replacement response lost',
    'Transport aborts only after a real successful replacement. Outcome is unconfirmed in the browser; no secret is displayed and replacement is blocked until explicit Refresh.',
  )
  await page.unroute(lostRoute)
  await refresh()
  await expect(
    page.getByRole('heading', { name: 'Replacement options', exact: true }),
  ).toHaveCount(0)
  await expect(linkedRow(lost.id)).toBeVisible()
  await snapshot(
    'Refresh reveals linked key without replaying secret',
    'Authorized metadata confirms one committed successor. Its one-time token cannot be recovered or replayed; the owner must explicitly replace or revoke the exact record.',
  )
  await expect.poll(() => runtimeStatus(secondToken)).toBe(401)
  page.once('dialog', (dialog) => dialog.accept())
  await linkedRow(lost.id)
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(receipt).toBeVisible()
  const recoveredToken = await receipt.getByLabel('New API key').inputValue()
  const recoveredRecords = await inventoryRecords()
  const recovered = recoveredRecords.find(
    (key) => key.replacesKeyId === lost.id,
  )!
  await expect(linkedRow(lost.id).locator('time')).toHaveAttribute(
    'datetime',
    recoveredRecords.find((key) => key.id === lost.id)!.acceptUntil,
  )
  expect(recovered.expiresAt).toBe(old.expiresAt)
  expect(await runtimeStatus(recoveredToken)).toBe(200)
  await snapshot(
    'Explicit recovery creates one new secret',
    'After the old approved window ends, a reviewed immediate replacement recovers caller access with one new secret. Original expiry and release scope are preserved; the token is masked.',
  )
  await receipt
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()

  await chooseOverlap(recovered.id, '300')
  let failedMetadataDelivery = false
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch({ url: `${apiOrigin}/api/runtime-keys` })
    expect(response.status()).toBe(200)
    failedMetadataDelivery = true
    await route.abort('failed')
  })
  page.once('dialog', (dialog) => dialog.accept())
  await review.click()
  await expect(page.getByRole('alert')).toContainText(
    'Replacement was accepted, but its old-key deadline could not be read',
  )
  expect(failedMetadataDelivery).toBe(true)
  await expect(receipt).toBeVisible()
  await expect(receipt).toContainText(
    'Old-key deadline is awaiting current metadata',
  )
  const retainedToken = await receipt.getByLabel('New API key').inputValue()
  expect(await runtimeStatus(retainedToken)).toBe(200)
  await snapshot(
    'Accepted replacement inventory delivery fails',
    'The successful one-time secret remains available when later metadata delivery fails. The deadline stays unknown, not estimated. Save the key and Refresh explicitly.',
  )
  await page.unroute('**/api/runtime-keys')
  await refresh()
  expect(
    (await receipt.getByLabel('New API key').inputValue()) === retainedToken,
  ).toBe(true)
  await expect(receipt).toContainText('Old key accepted until')
  await snapshot(
    'Refresh recovers fixed deadline and retains token',
    'A fresh authorized inventory supplies the actual old-key deadline. Refresh preserves the same one-time token and never repeats replacement.',
  )
  await receipt
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await appearance('Dark')
  await page.setViewportSize({ width: 390, height: 844 })
  const finalRecords = await inventoryRecords()
  const currentKey = finalRecords.find(
    (key) => key.replacesKeyId === recovered.id,
  )!
  await chooseOverlap(currentKey.id, '60')
  async function assertPhoneFieldRows() {
    const timingBounds = await page
      .getByRole('combobox', { name: 'Replacement timing', exact: true })
      .boundingBox()
    const fieldBounds = await seconds.evaluate((input) => {
      const label = input.closest('label')!
      const caption = [...label.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )!
      const range = document.createRange()
      range.selectNodeContents(caption)
      const text = range.getBoundingClientRect()
      return {
        captionTop: text.top,
        captionBottom: text.bottom,
        inputTop: input.getBoundingClientRect().top,
      }
    })
    expect(timingBounds).not.toBeNull()
    expect(fieldBounds.captionTop).toBeGreaterThanOrEqual(
      timingBounds!.y + timingBounds!.height + 4,
    )
    expect(fieldBounds.inputTop).toBeGreaterThanOrEqual(
      fieldBounds.captionBottom + 4,
    )
  }
  await assertPhoneFieldRows()
  await snapshot(
    'Phone dark replacement options',
    'A phone screen keeps the full key/API identifiers, original expiry, custom timing controls and overlap acknowledgment readable.',
  )
  await appearance('Light')
  await assertPhoneFieldRows()
  await snapshot(
    'Phone light replacement options',
    'Light phone controls preserve the complete review. No native checkbox, select or JSON editor is required.',
  )
  await seconds.fill('')
  await snapshot(
    'Phone invalid overlap recovery',
    'The inline whole-seconds error wraps beside the duration field; Review stays disabled until settings are valid and acknowledged.',
  )
  await seconds.fill('60')
  await appearance('System')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await snapshot(
    'System dark replacement controls',
    'System appearance follows the dark device preference without altering key scope, expiry or handover settings.',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await snapshot(
    'System light replacement controls',
    'System appearance follows light preference while retaining the reviewed values and explicit acknowledgment requirement.',
  )
  await page
    .getByRole('button', { name: 'Cancel replacement options', exact: true })
    .click()
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })

  const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers,
    data: { label: `Rollover tenant ${unique}`, value: `rollover.${unique}` },
  })
  expect(tenantResponse.status()).toBe(200)
  const tenant = (await tenantResponse.json()) as { id: string; label: string }
  const sourceResponse = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Rollover tenant rows ${unique}`,
        file: {
          name: 'rollover.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            `tenant,message\nrollover.${unique},Allowed row\nother.${unique},Other row\n`,
          ),
        },
      },
    },
  )
  expect(sourceResponse.status()).toBe(200)
  const source = (await sourceResponse.json()) as { id: string }
  const policyResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    { headers },
  )
  expect(policyResponse.status()).toBe(200)
  const policy = (await policyResponse.json()) as {
    version: number
    resourceVersion: number
  }
  const protection = await page.request.put(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    {
      headers,
      data: {
        mode: 'tenant',
        column: 'tenant',
        version: policy.version,
        resourceVersion: policy.resourceVersion,
      },
    },
  )
  expect(protection.status()).toBe(200)
  const protectedFlowResponse = await page.request.post(
    `${apiOrigin}/api/flows`,
    {
      headers,
      data: {
        ...helloFlow,
        name: `Protected rollover ${unique}`,
        path: `/v1/protected-rollover-${unique}`,
        nodes: [
          helloFlow.nodes[0],
          {
            id: 'data',
            type: 'data',
            position: { x: 400, y: 100 },
            config: { sourceId: source.id, columns: ['message'], limit: 10 },
          },
          {
            ...helloFlow.nodes[1],
            position: { x: 720, y: 100 },
            config: { status: 200, body: '$data' },
          },
        ],
        edges: [
          { id: 'read', source: 'request', target: 'data' },
          { id: 'reply', source: 'data', target: 'response' },
        ],
      },
    },
  )
  expect(protectedFlowResponse.status()).toBe(200)
  const protectedFlow = (await protectedFlowResponse.json()) as { id: string }
  expect(
    (
      await page.request.post(
        `${apiOrigin}/api/flows/${protectedFlow.id}/publish`,
        { headers, data: { revision: 1 } },
      )
    ).status(),
  ).toBe(200)
  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: `Rollover key manager ${unique}`,
      permissions: ['runtime-keys.manage'],
    },
  })
  expect(roleResponse.status()).toBe(200)
  const role = (await roleResponse.json()) as { id: string }
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: `Rollover operator ${unique}`,
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [protectedFlow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  })
  expect(memberResponse.status()).toBe(200)
  const operator = (await memberResponse.json()) as {
    id: string
    token: string
  }
  const operatorHeaders = { authorization: `Bearer ${operator.token}` }
  const boundResponse = await page.request.post(
    `${apiOrigin}/api/runtime-keys`,
    {
      headers: operatorHeaders,
      data: {
        name: `Bound handover ${unique}`,
        flowId: protectedFlow.id,
        releaseRevision: 1,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    },
  )
  expect(boundResponse.status()).toBe(200)
  const bound = (await boundResponse.json()) as RuntimeKey & { token: string }
  expect(bound.tenantId).toBe(tenant.id)
  expect(bound.issuerBinding).toEqual({
    memberId: operator.id,
    action: 'runtime-keys.manage',
  })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateFlowReads = 0
  let privateTeamReads = 0
  const privateGuard = '**/api/**'
  await page.route(privateGuard, async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'GET') {
      if (
        (url.pathname === '/api/flows' ||
          url.pathname.startsWith('/api/flows/')) &&
        !/^\/api\/flows\/[^/]+\/row-access$/.test(url.pathname)
      )
        privateFlowReads++
      if (url.pathname === '/api/members' || url.pathname === '/api/tenants')
        privateTeamReads++
    }
    await route.fallback()
  })
  await page.getByLabel('Workspace token').fill(operator.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Account & sessions', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'API keys', exact: true }),
  ).toBeVisible()
  const boundRows = () =>
    page.getByRole('row').filter({ hasText: `Bound handover ${unique}` })
  await expect(boundRows()).toContainText(tenant.label)
  await expect(boundRows()).toContainText('Linked to member')
  expect(privateFlowReads).toBe(0)
  expect(privateTeamReads).toBe(0)
  await snapshot(
    'Key-only operator reviews linked caller',
    'A selected key manager without Read APIs sees only authorized bound key inventory and its own tenant label. No private API graph, team list or tenant registry is fetched.',
  )
  await boundRows()
    .getByRole('button', { name: 'Replacement options', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Replacement timing', exact: true })
    .click()
  await page.getByRole('option', { name: 'Short overlap', exact: true }).click()
  await seconds.fill('300')
  await page
    .getByRole('checkbox', {
      name: 'I understand the old key continues during overlap',
      exact: true,
    })
    .click()
  await snapshot(
    'Protected member-linked overlap review',
    'Replacement retains the original selected API, release pin, assigned tenant, member link and expiry. Overlap does not provide additional row or field access.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await review.click()
  await expect(receipt).toContainText('Old key accepted until')
  await expect(receipt).toContainText(tenant.label)
  await expect(receipt).toContainText('Current release unknown')
  const boundSuccessorToken = await receipt
    .getByLabel('New API key')
    .inputValue()
  const boundInventory = await page.request.get(
    `${apiOrigin}/api/runtime-keys`,
    { headers: operatorHeaders },
  )
  expect(boundInventory.status()).toBe(200)
  const boundKeys = (await boundInventory.json()) as RuntimeKey[]
  const boundSuccessor = boundKeys.find(
    (key) => key.replacesKeyId === bound.id,
  )!
  expect(boundSuccessor).toMatchObject({
    tenantId: bound.tenantId,
    issuerBinding: bound.issuerBinding,
    expiresAt: bound.expiresAt,
    permissions: bound.permissions,
    releaseRevision: bound.releaseRevision,
  })
  for (const secret of [bound.token, boundSuccessorToken]) {
    const result = await page.request.get(
      `${apiOrigin}/run/v1/protected-rollover-${unique}`,
      { headers: { authorization: `Bearer ${secret}` } },
    )
    expect(result.status()).toBe(200)
    expect(await result.json()).toEqual([{ message: 'Allowed row' }])
  }
  expect(privateFlowReads).toBe(0)
  expect(privateTeamReads).toBe(0)
  await snapshot(
    'Protected overlap keeps original authority',
    'Both real credentials read only the assigned tenant rows. The successor preserves non-null tenant and original member authority; the receipt does not claim known current release without Read APIs.',
  )
  await appearance('Dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await snapshot(
    'Phone linked tenant handover receipt',
    'The operator phone receipt wraps the own tenant label and member-linked authority guidance. The token is masked and no arbitrary tenant picker appears.',
  )
  await receipt
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await expect(page.getByRole('combobox', { name: /Tenant/ })).toHaveCount(0)
  await snapshot(
    'Phone key-only linked inventory',
    'The same protected caller history is available without private flow metadata. Only the exact authorized old credential can be revoked for cleanup.',
  )
  await page.unroute(privateGuard)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeVisible()
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
}
