import { expect, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function tenantFieldProfilePreviews({
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
  const suffix = crypto.randomUUID().slice(0, 8)
  const identityValue = `Profile.${suffix}`
  const otherValue = `Profile.Other.${suffix}`
  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  async function assertReviewActionsFit(region: Locator) {
    const card = await region.boundingBox()
    expect(card).not.toBeNull()
    const minimumHeight =
      (await page.evaluate(() => innerWidth)) <= 1100 ? 44 : 32
    for (const button of await region.getByRole('button').all()) {
      const bounds = await button.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(card!.x)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        card!.x + card!.width,
      )
      expect(bounds!.height).toBeGreaterThanOrEqual(minimumHeight)
      const textFits = await button.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const buttonBounds = element.getBoundingClientRect()
        return Array.from(range.getClientRects()).every(
          (rect) =>
            rect.left >= buttonBounds.left &&
            rect.right <= buttonBounds.right &&
            rect.top >= buttonBounds.top &&
            rect.bottom <= buttonBounds.bottom,
        )
      })
      expect(textFits).toBe(true)
    }
  }
  const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers,
    data: { label: `Profile tenant ${suffix}`, value: identityValue },
  })
  expect(tenantResponse.status()).toBe(200)
  const tenant = (await tenantResponse.json()) as {
    id: string
    label: string
  }
  const otherTenantResponse = await page.request.post(
    `${apiOrigin}/api/tenants`,
    {
      headers,
      data: { label: `Other profile tenant ${suffix}`, value: otherValue },
    },
  )
  expect(otherTenantResponse.status()).toBe(200)
  const otherTenant = (await otherTenantResponse.json()) as { id: string }
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Tenant profile source ${suffix}`,
        file: {
          name: 'tenant-profile.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            `tenant,person,email\n${identityValue},Ada,ada@example.test\n${otherValue},Bree,bree@example.test\n`,
          ),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)
  const source = (await imported.json()) as { id: string; name: string }
  const policyUrl = `${apiOrigin}/api/data-sources/${source.id}/row-policy`
  const policyResponse = await page.request.get(policyUrl, { headers })
  expect(policyResponse.status()).toBe(200)
  const policy = (await policyResponse.json()) as {
    version: number
    resourceVersion: number
  }
  const protectedResponse = await page.request.put(policyUrl, {
    headers,
    data: {
      mode: 'tenant',
      column: 'tenant',
      version: policy.version,
      resourceVersion: policy.resourceVersion,
    },
  })
  expect(protectedResponse.status()).toBe(200)

  async function createRead(columns: string[]) {
    const response = await page.request.post(`${apiOrigin}/api/flows`, {
      headers,
      data: {
        name: `Profile read ${columns.join(' and ')} ${suffix}`,
        method: 'GET',
        path: `/v1/tenant-profile-${crypto.randomUUID().slice(0, 8)}`,
        nodes: [
          {
            id: 'request',
            type: 'request',
            position: { x: 40, y: 100 },
            config: {},
          },
          {
            id: 'rows',
            type: 'data',
            position: { x: 340, y: 100 },
            config: { sourceId: source.id, columns, limit: 10 },
          },
          {
            id: 'response',
            type: 'response',
            position: { x: 640, y: 100 },
            config: { status: 200, body: '$data' },
          },
        ],
        edges: [
          { id: 'read', source: 'request', target: 'rows' },
          { id: 'reply', source: 'rows', target: 'response' },
        ],
      },
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as {
      id: string
      revision: number
      path: string
    }
  }
  const wide = await createRead(['person', 'email'])
  const narrow = await createRead(['person'])
  const publication = await page.request.post(
    `${apiOrigin}/api/flows/${wide.id}/publish`,
    {
      headers,
      data: { revision: wide.revision },
    },
  )
  expect(publication.status()).toBe(200)
  async function issue(tenantId: string) {
    const response = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
      headers,
      data: {
        name: `Profile caller ${suffix}`,
        flowId: wide.id,
        permissions: ['rest'],
        releaseRevision: 1,
        tenantId,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as { token: string }
  }
  const caller = await issue(tenant.id)
  const otherCaller = await issue(otherTenant.id)
  const call = (token: string) =>
    page.request.get(`${apiOrigin}/run${wide.path}`, {
      headers: { authorization: `Bearer ${token}` },
    })
  const original = await call(caller.token)
  expect(original.status()).toBe(200)
  expect(await original.json()).toEqual([
    { person: 'Ada', email: 'ada@example.test' },
  ])

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
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await expect(page.getByText('Opening studio…', { exact: true })).toHaveCount(
    0,
    { timeout: 15_000 },
  )
  await expect(
    page.getByRole('heading', { name: 'Tenant protection', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: source.name, exact: true }).click()
  const resource = page.getByRole('region', {
    name: `Row protection for ${source.name}`,
    exact: true,
  })
  let failRegistry = true
  const registryDelivery = async (route: import('@playwright/test').Route) => {
    if (failRegistry && route.request().method() === 'GET') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Registry delivery unavailable' }),
      })
    }
    return route.fallback()
  }
  await page.route('**/api/tenants', registryDelivery)
  let deliverModule!: () => void
  const moduleDelivery = new Promise<void>((resolve) => {
    deliverModule = resolve
  })
  let moduleStarted!: () => void
  const moduleRequest = new Promise<void>((resolve) => {
    moduleStarted = resolve
  })
  const moduleRoute =
    /\/web\/components\/resource-access\/tenant-field-profiles\.tsx(?:\?|$)|\/assets\/tenant-field-profiles-[^/]+\.js(?:\?|$)/
  const heldModule = async (route: import('@playwright/test').Route) => {
    const result = await route.fetch()
    expect(result.status()).toBe(200)
    moduleStarted()
    await moduleDelivery
    await route.fulfill({ response: result })
  }
  await page.route(moduleRoute, heldModule)
  await resource
    .getByRole('button', { name: 'Tenant-specific API fields', exact: true })
    .click()
  const profile = page.getByRole('region', {
    name: `Tenant-specific API fields for ${source.name}`,
    exact: true,
  })
  await moduleRequest
  await resource
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  const globalReview = resource.getByRole('region', {
    name: 'Review row protection',
    exact: true,
  })
  let deliverGlobal!: () => void
  const globalDelivery = new Promise<void>((resolve) => {
    deliverGlobal = resolve
  })
  let globalCommitted!: () => void
  const globalCommit = new Promise<void>((resolve) => {
    globalCommitted = resolve
  })
  const heldGlobal = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const result = await route.fetch({
      url: policyUrl || route.request().url(),
    })
    expect(result.status()).toBe(200)
    globalCommitted()
    await globalDelivery
    await route.fulfill({ response: result })
  }
  await page.route(`**/api/data-sources/${source.id}/row-policy`, heldGlobal)
  await globalReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await globalCommit
  deliverModule()
  await expect(
    profile.getByRole('heading', {
      name: 'Tenant-specific API fields',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    profile.getByRole('button', {
      name: 'Refresh tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('heading', {
      name: 'Tenant-specific API fields',
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await capture(
    'Tenant protection',
    'First tenant field panel opens during a pending global save',
    'The real lazy module is delivered while a real same-policy PUT response is held. Initial metadata loading waits for the global busy task; no mutation or failed read is retried.',
  )
  deliverGlobal()
  await page.unroute(`**/api/data-sources/${source.id}/row-policy`, heldGlobal)
  await page.unroute(moduleRoute, heldModule)
  await expect(profile.getByRole('alert')).toContainText(
    'Registry delivery unavailable',
  )
  await expect(profile).not.toContainText('Approve a tenant in the registry')
  await expect(
    profile.getByRole('button', {
      name: 'Refresh tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await capture(
    'Tenant protection',
    'Tenant registry delivery fails safely',
    'Only the public registry response is unavailable. The owner can explicitly Refresh; no tenant field review is admitted.',
  )
  failRegistry = false
  await profile
    .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
    .click()
  await expect(
    profile.getByRole('combobox', { name: 'Approved tenant', exact: true }),
  ).toBeEnabled()
  await page.unroute('**/api/tenants', registryDelivery)
  await capture(
    'Tenant protection',
    'Choose an approved label before tenant field review',
    'Only configured tenant IDs are summarized. A profile is read only after the owner selects an approved registry label; no identity value or data cells are presented in the panel.',
  )
  await profile
    .getByRole('combobox', { name: 'Approved tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant.label, exact: true }).click()
  await expect(
    profile.getByRole('combobox', {
      name: 'Tenant API field choice',
      exact: true,
    }),
  ).toContainText('Use shared API fields')
  await expect(profile).toContainText('Currently usable API fields')
  await expect(profile).not.toContainText(identityValue)
  await capture(
    'Tenant protection',
    'Tenant API fields inherit the shared policy',
    'The owner reviews one approved tenant label. Saved tenant choice, shared resource fields and currently usable fields are separate; no exact identity value or rows are shown.',
  )
  await profile
    .getByRole('combobox', { name: 'Tenant API field choice', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this tenant', exact: true })
    .click()
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  await profile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  const review = profile.getByRole('region', {
    name: 'Review tenant API fields',
    exact: true,
  })
  await expect(review).toContainText(tenant.label)
  await expect(review).toContainText(source.name)
  await expect(review).toContainText('Fields after saving: person')
  await appearance('Light')
  await assertReviewActionsFit(review)
  await appearance('Dark')
  await assertReviewActionsFit(review)
  await appearance('Light')
  await capture(
    'Tenant protection',
    'Review tenant-specific source fields',
    'The owner reviews person, the shared ceiling and resource/policy/tenant versions. This changes no member assignment or caller scope.',
  )
  await review
    .getByRole('button', { name: 'Cancel tenant field review', exact: true })
    .click()
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    }),
  ).toBeChecked()
  const profileUrl = `${apiOrigin}/api/data-sources/${source.id}/tenant-fields/${tenant.id}`
  const cancelled = await page.request.get(profileUrl, { headers })
  expect(cancelled.status()).toBe(200)
  expect((await cancelled.json()).profile).toEqual({ mode: 'inherit' })
  await capture(
    'Tenant protection',
    'Cancel tenant field review preserves choices',
    'Cancel leaves person selected in the form and the persisted profile unchanged.',
  )
  let localProfileReads = 0
  const observeLocalProfileRead = (request: {
    url(): string
    method(): string
  }) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname ===
        new URL(profileUrl, page.url()).pathname
    )
      localProfileReads++
  }
  page.on('request', observeLocalProfileRead)
  await resource
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await resource
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await globalReview
    .getByRole('checkbox', {
      name: 'I understand delegated access may expose all rows',
      exact: true,
    })
    .click()
  await globalReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Row protection updated')
  await expect(profile).toContainText('Current tenant API fields unknown')
  await expect(
    profile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('combobox', { name: 'Approved tenant', exact: true }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    }),
  ).toBeChecked()
  expect(localProfileReads).toBe(0)
  await capture(
    'Tenant protection',
    'Local global save invalidates an open tenant review',
    'An accepted parent deprotection changes the same policy. The child immediately marks old application/effective fields unknown, blocks review and preserves its unsaved person choice without an automatic GET.',
  )
  await refreshSourceProfile()
  expect(localProfileReads).toBe(1)
  page.off('request', observeLocalProfileRead)
  await expect(profile).toContainText('Prospective API fields')
  await expect(profile).toContainText(
    'Saving does not activate protection or this identity.',
  )
  await capture(
    'Tenant protection',
    'Refresh confirms local deprotection for the tenant profile',
    'An explicit child Refresh reads the accepted unprotected policy. The profile is now truthfully prospective.',
  )
  await resource
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant rows only', exact: true })
    .click()
  await resource
    .getByRole('combobox', { name: 'Tenant column', exact: true })
    .click()
  await page.getByRole('option', { name: 'tenant', exact: true }).click()
  await resource
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await globalReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(profile).toContainText('Current tenant API fields unknown')
  await refreshSourceProfile()
  await expect(profile).toContainText(
    'Currently applied to protected API reads',
  )
  await chooseSource('Choose fields for this tenant')
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  let automaticProfileReads = 0
  const observeProfileRead = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname ===
        new URL(profileUrl, page.url()).pathname
    )
      automaticProfileReads++
  }
  page.on('request', observeProfileRead)
  await resource
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await resource
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await globalReview
    .getByRole('checkbox', {
      name: 'I understand delegated access may expose all rows',
      exact: true,
    })
    .click()
  const lostGlobal = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const result = await route.fetch({
      url: policyUrl || route.request().url(),
    })
    expect(result.status()).toBe(200)
    await route.abort('failed')
  }
  await page.route(`**/api/data-sources/${source.id}/row-policy`, lostGlobal)
  await globalReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(
    resource
      .getByRole('alert')
      .filter({ hasText: 'Could not confirm whether row protection' }),
  ).toBeVisible()
  await expect(profile).toContainText('Current tenant API fields unknown')
  await expect(
    profile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    }),
  ).toBeChecked()
  expect(automaticProfileReads).toBe(0)
  const globalPersisted = await page.request.get(policyUrl, { headers })
  expect(globalPersisted.status()).toBe(200)
  expect((await globalPersisted.json()).mode).toBe('unprotected')
  await capture(
    'Tenant protection',
    'Lost global save invalidates the tenant profile without auto-reading',
    'The real global PUT committed deprotection and lost delivery. The child preserves person but marks application/fields unknown; zero automatic profile GETs occurred.',
  )
  await page.unroute(`**/api/data-sources/${source.id}/row-policy`, lostGlobal)
  await resource
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    resource.getByRole('combobox', {
      name: 'Row protection mode',
      exact: true,
    }),
  ).toContainText('Unprotected')
  // The selected text already matches before the global refresh completes.
  await expect(
    resource.getByRole('combobox', {
      name: 'Row protection mode',
      exact: true,
    }),
  ).toBeEnabled()
  expect(automaticProfileReads).toBe(0)
  await refreshSourceProfile()
  await expect(profile).toContainText('Prospective API fields')
  expect(automaticProfileReads).toBe(1)
  await capture(
    'Tenant protection',
    'Explicit global and tenant Refresh confirm the lost save',
    'The owner explicitly reads each current policy. Deprotection is now known; no uncertain mutation was replayed and the profile remains prospective.',
  )
  page.off('request', observeProfileRead)
  await resource
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant rows only', exact: true })
    .click()
  await resource
    .getByRole('combobox', { name: 'Tenant column', exact: true })
    .click()
  await page.getByRole('option', { name: 'tenant', exact: true }).click()
  await resource
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await globalReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await refreshSourceProfile()
  await chooseSource('Choose fields for this tenant')
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  await profile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Tenant API fields updated',
  )
  const saved = await page.request.get(profileUrl, { headers })
  expect(saved.status()).toBe(200)
  const savedProfile = await saved.json()
  expect(savedProfile.profile).toEqual({
    mode: 'selected',
    columns: ['person'],
  })
  expect(savedProfile.effectiveColumns).toEqual(['person'])
  await expect(profile).not.toContainText('Current tenant API fields unknown')
  const configured = profile.getByRole('region', {
    name: 'Configured tenant choices',
    exact: true,
  })
  await expect(configured).toContainText(tenant.label)
  await expect(configured).not.toContainText(identityValue)
  const denied = await call(caller.token)
  expect(denied.status()).toBe(403)
  expect(await denied.text()).not.toContain('ada@example.test')
  const otherRows = await call(otherCaller.token)
  expect(otherRows.status()).toBe(200)
  expect(await otherRows.json()).toEqual([
    { person: 'Bree', email: 'bree@example.test' },
  ])
  const narrowRead = await page.request.post(
    `${apiOrigin}/api/flows/${narrow.id}/test`,
    {
      headers,
      data: { body: null, query: {}, tenantId: tenant.id },
    },
  )
  expect(narrowRead.status()).toBe(200)
  expect((await narrowRead.json()).body).toEqual([{ person: 'Ada' }])
  const retainedPublication = await page.request.get(
    `${apiOrigin}/api/flows/${wide.id}`,
    { headers },
  )
  expect(retainedPublication.status()).toBe(200)
  expect((await retainedPublication.json()).publishedRevision).toBe(1)
  await expect(
    resource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(resource).toContainText('Refresh row policy')
  await capture(
    'Tenant protection',
    'Saved tenant fields invalidate an older global review',
    'The real profile saves person. The global form keeps its choices but requires explicit Refresh because both edits share the same policy version.',
  )
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field email',
      exact: true,
    })
    .click()
  await profile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  await expect(
    review.getByRole('button', {
      name: 'Confirm tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  let deliverSave!: () => void
  const saveDelivery = new Promise<void>((resolve) => {
    deliverSave = resolve
  })
  let saveStarted!: () => void
  const saveRequest = new Promise<void>((resolve) => {
    saveStarted = resolve
  })
  const lostSave = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    saveStarted()
    await saveDelivery
    const result = await route.fetch({
      url: profileUrl || route.request().url(),
    })
    expect(result.status()).toBe(200)
    await route.abort('failed')
  }
  await page.route(
    `**/api/data-sources/${source.id}/tenant-fields/${tenant.id}`,
    lostSave,
  )
  await review
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await saveRequest
  await expect(
    profile.getByRole('button', {
      name: 'Refresh tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Tenant field save blocks navigation while pending',
    'Only delivery is held. Confirm, Refresh, tenant selection and sign-out remain blocked until the real mutation completes.',
  )
  deliverSave()
  await expect(profile.getByRole('alert')).toContainText(
    'Could not confirm whether',
  )
  await expect(profile).toContainText('Current tenant API fields unknown')
  await expect(
    profile.getByRole('combobox', { name: 'Approved tenant', exact: true }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field email',
      exact: true,
    }),
  ).toBeChecked()
  const committed = await page.request.get(profileUrl, { headers })
  expect(committed.status()).toBe(200)
  expect((await committed.json()).profile).toEqual({
    mode: 'selected',
    columns: ['person', 'email'],
  })
  await capture(
    'Tenant protection',
    'Committed tenant save loses its response safely',
    'The real PUT committed, then delivery was aborted. Current policy is unknown; edited choices remain and another review requires explicit Refresh.',
  )
  await page.unroute(
    `**/api/data-sources/${source.id}/tenant-fields/${tenant.id}`,
    lostSave,
  )
  await profile
    .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
    .click()
  await expect(
    profile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(profile).not.toContainText('Current tenant API fields unknown')
  await capture(
    'Tenant protection',
    'Refresh confirms the committed tenant selection',
    'Explicit Refresh reads person and email from the real current profile. No automatic retry creates a second mutation.',
  )
  async function refreshSourceProfile() {
    await profile
      .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
      .click()
    await expect(
      profile.getByRole('button', {
        name: 'Review tenant API fields',
        exact: true,
      }),
    ).toBeEnabled()
  }
  async function reviewSource() {
    await profile
      .getByRole('button', { name: 'Review tenant API fields', exact: true })
      .click()
  }
  async function confirmSource() {
    await review
      .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
      .click()
    await expect(
      profile.getByRole('button', {
        name: 'Review tenant API fields',
        exact: true,
      }),
    ).toBeEnabled()
  }
  async function chooseSource(
    mode: 'Use shared API fields' | 'Choose fields for this tenant',
  ) {
    await profile
      .getByRole('combobox', { name: 'Tenant API field choice', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  async function currentSourceProfile() {
    const result = await page.request.get(profileUrl, { headers })
    expect(result.status()).toBe(200)
    return result.json()
  }
  async function sourcePolicy(
    fields?: { mode: 'all' | 'selected'; columns: string[] },
    mode: 'tenant' | 'unprotected' = 'tenant',
  ) {
    const result = await page.request.get(policyUrl, { headers })
    expect(result.status()).toBe(200)
    const latest = await result.json()
    const update = await page.request.put(policyUrl, {
      headers,
      data: {
        mode,
        version: latest.version,
        resourceVersion: latest.resourceVersion,
        ...(mode === 'tenant'
          ? { column: 'tenant', ...(fields ? { fields } : {}) }
          : {}),
      },
    })
    expect(update.status()).toBe(200)
  }
  await sourcePolicy({ mode: 'selected', columns: ['person'] })
  await refreshSourceProfile()
  await expect(profile).toContainText(
    'Blocked by shared policy; a saved choice stays stored.',
  )
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field email',
      exact: true,
    }),
  ).toBeChecked()
  expect((await currentSourceProfile()).profile).toEqual({
    mode: 'selected',
    columns: ['person', 'email'],
  })
  expect((await currentSourceProfile()).effectiveColumns).toEqual(['person'])
  await capture(
    'Tenant protection',
    'Shared ceiling preserves a latent tenant selection',
    'Email remains saved and checked but the current shared ceiling permits only person. The tenant choice cannot grant a globally blocked field.',
  )
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field email',
      exact: true,
    })
    .click()
  await reviewSource()
  await expect(
    review.getByRole('button', {
      name: 'Confirm tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Empty tenant selection requires reviewed denial',
    'No API fields for this tenant blocks reads using this selection. Confirm remains disabled until the owner acknowledges the denial.',
  )
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant selection blocks its API reads',
      exact: true,
    })
    .click()
  await confirmSource()
  expect((await currentSourceProfile()).profile).toEqual({
    mode: 'selected',
    columns: [],
  })
  await expect(configured).toContainText(tenant.label)
  const noFields = await page.request.post(
    `${apiOrigin}/api/flows/${narrow.id}/test`,
    {
      headers,
      data: { body: null, query: {}, tenantId: tenant.id },
    },
  )
  expect(noFields.status()).toBe(403)
  await capture(
    'Tenant protection',
    'Empty tenant API fields saved',
    'The real selected-empty profile stays configured and rejects the narrow protected read. It is never silently changed to shared fields.',
  )
  await chooseSource('Use shared API fields')
  await reviewSource()
  await expect(
    review.getByRole('button', {
      name: 'Confirm tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Reset tenant fields to the shared ceiling',
    'Reset requires both a shared-fields acknowledgment and a widening acknowledgment. The shared ceiling still permits only person.',
  )
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  await review
    .getByRole('checkbox', {
      name: 'I understand this restores shared API fields',
      exact: true,
    })
    .click()
  await confirmSource()
  expect((await currentSourceProfile()).profile).toEqual({ mode: 'inherit' })
  await expect(configured).toContainText('No tenant-specific selections saved.')
  await capture(
    'Tenant protection',
    'Shared fields restored without granting blocked email',
    'The explicit profile is removed from the configured summary. Its inherited effective fields remain person because the global ceiling still blocks email.',
  )
  await sourcePolicy({ mode: 'all', columns: [] })
  await refreshSourceProfile()
  expect((await call(caller.token)).status()).toBe(200)

  await chooseSource('Choose fields for this tenant')
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  await reviewSource()
  const concurrent = await currentSourceProfile()
  const peerSave = await page.request.put(profileUrl, {
    headers,
    data: {
      version: concurrent.version,
      resourceVersion: concurrent.resourceVersion,
      tenantVersion: concurrent.tenant.version,
      fields: { mode: 'inherit' },
    },
  })
  expect(peerSave.status()).toBe(200)
  await review
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(profile.getByRole('alert')).toContainText(
    'Refresh tenant API fields',
  )
  await expect(profile).toContainText('Current tenant API fields unknown')
  await expect(
    profile.getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    }),
  ).toBeChecked()
  await expect(
    profile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Concurrent shared policy version rejects stale review',
    'An actual owner PUT advanced the same shared policy version. The stale confirmation fails without overwriting it, and person remains in the edited form until explicit Refresh.',
  )
  await refreshSourceProfile()
  await expect(
    profile.getByRole('combobox', {
      name: 'Tenant API field choice',
      exact: true,
    }),
  ).toContainText('Use shared API fields')
  await capture(
    'Tenant protection',
    'Stale tenant fields recover by explicit Refresh',
    'Refresh reads the winning shared selection and enables a new deliberate review.',
  )

  await sourcePolicy(undefined, 'unprotected')
  await refreshSourceProfile()
  await expect(profile).toContainText('Prospective API fields')
  await expect(profile).toContainText(
    'Saving does not activate protection or this identity.',
  )
  await chooseSource('Choose fields for this tenant')
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field email',
      exact: true,
    })
    .click()
  await reviewSource()
  await capture(
    'Tenant protection',
    'Dormant tenant fields can be maintained',
    'This unprotected source shows a prospective intersection. Saving email does not activate row protection, assign a tenant or alter a caller.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 390, height: 844 })
  await assertReviewActionsFit(review)
  await capture(
    'Mobile light',
    'Phone prospective source profile review',
    'Inactive source choices remain explicitly prospective. Full resource and tenant labels, before/after fields and warnings wrap on a 390px phone.',
  )
  await appearance('Dark')
  await assertReviewActionsFit(review)
  await capture(
    'Mobile dark',
    'Phone dark prospective source profile review',
    'The same dormant review stays readable with visible custom controls in dark appearance.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await confirmSource()
  expect((await currentSourceProfile()).active).toBe(false)
  await profile
    .getByRole('checkbox', {
      name: 'Allow tenant API field person',
      exact: true,
    })
    .click()
  await reviewSource()
  const replacement = await page.request.put(
    `${apiOrigin}/api/data-sources/${source.id}/import`,
    {
      headers,
      multipart: {
        name: source.name,
        file: {
          name: 'profile-replaced.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            `tenant,person,email\n${identityValue},Ada,ada@example.test\n${otherValue},Bree,bree@example.test\n`,
          ),
        },
      },
    },
  )
  expect(replacement.status()).toBe(200)
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  await review
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(profile.getByRole('alert')).toContainText(
    'Refresh tenant API fields',
  )
  await expect(profile).toContainText('Current tenant API fields unknown')
  expect((await currentSourceProfile()).profile).toEqual({
    mode: 'selected',
    columns: ['email'],
  })
  await capture(
    'Tenant protection',
    'Resource replacement invalidates an older profile review',
    'A real replacement keeps all retained profile fields but advances the resource version. The queued review cannot silently overwrite the current profile.',
  )
  await refreshSourceProfile()
  await profile
    .getByRole('button', { name: 'Review details', exact: true })
    .click()
  await expect(profile).toContainText('Reviewed resource version 2')
  await chooseSource('Use shared API fields')
  await reviewSource()
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  await review
    .getByRole('checkbox', {
      name: 'I understand this restores shared API fields',
      exact: true,
    })
    .click()
  const tenantCurrent = await page.request.get(`${apiOrigin}/api/tenants`, {
    headers,
  })
  expect(tenantCurrent.status()).toBe(200)
  const registry = await tenantCurrent.json()
  const currentTenant = registry.find(
    (record: { id: string }) => record.id === tenant.id,
  )
  const retired = await page.request.put(
    `${apiOrigin}/api/tenants/${tenant.id}`,
    {
      headers,
      data: {
        label: tenant.label,
        state: 'retired',
        version: currentTenant.version,
      },
    },
  )
  expect(retired.status()).toBe(200)
  await review
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(profile.getByRole('alert')).toContainText(
    'Refresh tenant API fields',
  )
  await expect(profile).toContainText('Current tenant API fields unknown')
  expect((await currentSourceProfile()).profile).toEqual({
    mode: 'selected',
    columns: ['email'],
  })
  await capture(
    'Tenant protection',
    'Tenant registry version invalidates queued field review',
    'An actual retirement advances the approved tenant version. Reset confirmation fails safely until explicit Refresh reads the current retired identity.',
  )
  await refreshSourceProfile()
  await expect(profile).toContainText('Retired identity')
  await expect(profile).toContainText('Prospective API fields')
  await capture(
    'Tenant protection',
    'Retired tenant keeps its dormant saved choice',
    'The owner can repair this saved profile by registry label. Exact tenant identity text and private cells remain absent.',
  )
  await chooseSource('Use shared API fields')
  await reviewSource()
  await review
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  await review
    .getByRole('checkbox', {
      name: 'I understand this restores shared API fields',
      exact: true,
    })
    .click()
  await confirmSource()
  expect((await currentSourceProfile()).active).toBe(false)
  expect((await currentSourceProfile()).configured).toBe(false)
  await capture(
    'Tenant protection',
    'Reset inactive profile without activation',
    'Reset removes the explicit tenant choice while this identity remains retired and the source remains unprotected.',
  )
  const reactivate = await page.request.put(
    `${apiOrigin}/api/tenants/${tenant.id}`,
    {
      headers,
      data: {
        label: tenant.label,
        state: 'active',
        version: (await currentSourceProfile()).tenant.version,
      },
    },
  )
  expect(reactivate.status()).toBe(200)
  await expect(
    resource.getByRole('button', {
      name: 'Close tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await resource
    .getByRole('button', { name: 'Close tenant API fields', exact: true })
    .click()
  await expect(profile).toHaveCount(0)

  const fixture = spawnSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const database = new Database(':memory:')
    database.run('CREATE TABLE people(tenant TEXT, name TEXT, salary INTEGER)')
    database.run('CREATE TABLE products(tenant TEXT, "Product title with spaces" TEXT)')
    database.query('INSERT INTO people VALUES (?, ?, ?)').run(${JSON.stringify(identityValue)}, 'Ada', 2400)
    database.query('INSERT INTO people VALUES (?, ?, ?)').run(${JSON.stringify(otherValue)}, 'Bree', 3100)
    database.query('INSERT INTO products VALUES (?, ?)').run(${JSON.stringify(identityValue)}, 'Notebook')
    process.stdout.write(database.serialize())
    database.close()
  `,
    ],
    { windowsHide: true },
  )
  expect(fixture.status).toBe(0)
  const copyResponse = await page.request.post(
    `${apiOrigin}/api/database-connections`,
    {
      headers,
      multipart: {
        name: `Tenant profile copy ${suffix}`,
        file: {
          name: 'tenant-profile.sqlite',
          mimeType: 'application/vnd.sqlite3',
          buffer: fixture.stdout,
        },
      },
    },
  )
  expect(copyResponse.status()).toBe(200)
  const copy = (await copyResponse.json()) as { id: string; name: string }
  const copyPolicyUrl = `${apiOrigin}/api/database-connections/${copy.id}/row-policy`
  const copyPolicyResponse = await page.request.get(copyPolicyUrl, { headers })
  expect(copyPolicyResponse.status()).toBe(200)
  const copyPolicy = (await copyPolicyResponse.json()) as {
    version: number
    resourceVersion: number
  }
  const protectCopy = await page.request.put(copyPolicyUrl, {
    headers,
    data: {
      mode: 'tenant',
      version: copyPolicy.version,
      resourceVersion: copyPolicy.resourceVersion,
      tables: [
        { table: 'people', column: 'tenant' },
        { table: 'products', column: 'tenant' },
      ],
    },
  })
  expect(protectCopy.status()).toBe(200)
  await page
    .getByRole('button', { name: 'Refresh resources', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Resource type', exact: true })
    .click()
  await page.getByRole('option', { name: 'SQLite copy', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: copy.name, exact: true }).click()
  const copyResource = page.getByRole('region', {
    name: `Row protection for ${copy.name}`,
    exact: true,
  })
  await copyResource
    .getByRole('button', { name: 'Tenant-specific API fields', exact: true })
    .click()
  const copyProfile = page.getByRole('region', {
    name: `Tenant-specific API fields for ${copy.name}`,
    exact: true,
  })
  await copyProfile
    .getByRole('combobox', { name: 'Approved tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant.label, exact: true }).click()
  await expect(
    copyProfile.getByRole('combobox', {
      name: 'Tenant API field choice for products',
      exact: true,
    }),
  ).toContainText('Use shared API fields')
  await capture(
    'Tenant protection',
    'SQLite tenant profile inherits every table',
    'The real uploaded copy exposes schema names only in this panel. Every inspected table has a separate shared ceiling and tenant choice.',
  )
  await copyProfile
    .getByRole('combobox', {
      name: 'Tenant API field choice for people',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this tenant', exact: true })
    .click()
  await copyProfile
    .getByRole('checkbox', { name: 'Allow tenant API field name', exact: true })
    .click()
  await copyProfile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  const copyReview = copyProfile.getByRole('region', {
    name: 'Review tenant API fields',
    exact: true,
  })
  await expect(copyReview).toContainText('Fields after saving: name')
  await expect(copyReview).toContainText('products')
  await appearance('Light')
  await assertReviewActionsFit(copyReview)
  await appearance('Dark')
  await assertReviewActionsFit(copyReview)
  await appearance('Light')
  await copyReview
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Tenant API fields updated',
  )
  const copySavedResponse = await page.request.get(
    `${apiOrigin}/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
    { headers },
  )
  expect(copySavedResponse.status()).toBe(200)
  const copySaved = await copySavedResponse.json()
  expect(
    copySaved.tables.map((table: { table: string; profile: unknown }) => ({
      table: table.table,
      profile: table.profile,
    })),
  ).toEqual([
    { table: 'people', profile: { mode: 'selected', columns: ['name'] } },
    { table: 'products', profile: { mode: 'inherit' } },
  ])
  await capture(
    'Tenant protection',
    'Complete SQLite tenant selection preserves other tables',
    'The reviewed request saves people:name and explicitly keeps products inheriting the shared fields. No table is silently omitted.',
  )
  async function databaseRead(
    table: string,
    columns: string[],
    tenantId: string,
  ) {
    const draft = await page.request.post(`${apiOrigin}/api/flows`, {
      headers,
      data: {
        name: `Profile SQLite ${table} ${suffix}`,
        method: 'GET',
        path: `/v1/profile-copy-${crypto.randomUUID().slice(0, 8)}`,
        nodes: [
          {
            id: 'request',
            type: 'request',
            position: { x: 40, y: 100 },
            config: {},
          },
          {
            id: 'read',
            type: 'database',
            position: { x: 340, y: 100 },
            config: { connectionId: copy.id, table, columns, limit: 10 },
          },
          {
            id: 'response',
            type: 'response',
            position: { x: 640, y: 100 },
            config: { status: 200, body: '$data' },
          },
        ],
        edges: [
          { id: 'rows', source: 'request', target: 'read' },
          { id: 'reply', source: 'read', target: 'response' },
        ],
      },
    })
    expect(draft.status()).toBe(200)
    const flow = await draft.json()
    return page.request.post(`${apiOrigin}/api/flows/${flow.id}/test`, {
      headers,
      data: { body: null, query: {}, tenantId },
    })
  }
  const deniedCopy = await databaseRead('people', ['name', 'salary'], tenant.id)
  expect(deniedCopy.status()).toBe(403)
  expect(await deniedCopy.text()).not.toContain('2400')
  const otherCopy = await databaseRead(
    'people',
    ['name', 'salary'],
    otherTenant.id,
  )
  expect(otherCopy.status()).toBe(200)
  expect((await otherCopy.json()).body).toEqual([
    { name: 'Bree', salary: 3100 },
  ])
  const selectedCopy = await databaseRead('people', ['name'], tenant.id)
  expect(selectedCopy.status()).toBe(200)
  expect((await selectedCopy.json()).body).toEqual([{ name: 'Ada' }])
  await copyProfile
    .getByRole('combobox', {
      name: 'Tenant API field choice for products',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this tenant', exact: true })
    .click()
  await copyProfile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  await expect(copyReview).toContainText(
    'Fields after saving: No API fields for this tenant',
  )
  await expect(copyReview).toContainText('Fields after saving: name')
  await expect(
    copyReview.getByRole('button', {
      name: 'Confirm tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'One SQLite table has an empty tenant selection',
    'Products would stop protected reads for this tenant while people remains name. Every table is reviewed; no blanket claim says all tables are denied.',
  )
  await copyReview
    .getByRole('checkbox', {
      name: 'I understand this tenant selection blocks its API reads',
      exact: true,
    })
    .click()
  await copyReview
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(
    copyProfile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  expect(
    (
      await databaseRead('products', ['product_title_with_spaces'], tenant.id)
    ).status(),
  ).toBe(403)
  expect((await databaseRead('people', ['name'], tenant.id)).status()).toBe(200)
  await capture(
    'Tenant protection',
    'SQLite selected-empty is table-specific',
    'The real products read is denied while the same tenant’s people:name read succeeds. No response redaction or schema rewrite occurs.',
  )
  await copyProfile
    .getByRole('combobox', {
      name: 'Tenant API field choice for products',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Use shared API fields', exact: true })
    .click()
  await copyProfile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  await copyReview
    .getByRole('checkbox', {
      name: 'I understand this tenant may receive more API fields',
      exact: true,
    })
    .click()
  await copyReview
    .getByRole('checkbox', {
      name: 'I understand this restores shared API fields',
      exact: true,
    })
    .click()
  await capture(
    'Tenant protection',
    'Review SQLite table reset without changing another table',
    'Products returns to its shared ceiling, including the full original column label. People keeps its explicit name selection.',
  )
  await copyReview
    .getByRole('button', { name: 'Confirm tenant API fields', exact: true })
    .click()
  await expect(
    copyProfile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  const productRows = await databaseRead(
    'products',
    ['product_title_with_spaces'],
    tenant.id,
  )
  expect(productRows.status()).toBe(200)
  expect((await productRows.json()).body).toEqual([
    { product_title_with_spaces: 'Notebook' },
  ])
  await expect(copyProfile).toContainText('Product title with spaces')
  await appearance('Light')
  await capture(
    'Tenant protection',
    'Light SQLite tenant fields show full column labels',
    'Each table’s saved choice, shared ceiling and currently usable fields remain distinct. No private cells or exact tenant values appear.',
  )
  await appearance('Dark')
  await capture(
    'Tenant protection',
    'Dark SQLite tenant fields',
    'The real profile and configured label summary remain readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  async function assertPhoneProfileControlsFit() {
    const card = await copyProfile.boundingBox()
    expect(card).not.toBeNull()
    for (const control of await copyProfile.getByRole('combobox').all()) {
      const bounds = await control.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(card!.x)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        card!.x + card!.width,
      )
      const textFits = await control.evaluate((button) => {
        const text = button.querySelector('span')
        if (!text) return false
        const range = document.createRange()
        range.selectNodeContents(text)
        const buttonBounds = button.getBoundingClientRect()
        return Array.from(range.getClientRects()).every(
          (rect) =>
            rect.left >= buttonBounds.left && rect.right <= buttonBounds.right,
        )
      })
      expect(textFits).toBe(true)
    }
  }
  await assertPhoneProfileControlsFit()
  const phonePanelBounds = await copyProfile.boundingBox()
  expect(phonePanelBounds).not.toBeNull()
  expect(phonePanelBounds!.x).toBeGreaterThanOrEqual(0)
  expect(phonePanelBounds!.x + phonePanelBounds!.width).toBeLessThanOrEqual(390)
  await capture(
    'Mobile dark',
    'Phone dark SQLite tenant fields',
    'Complete table controls, full human column labels and conservative resource-wide effects wrap within the phone layout.',
  )
  await appearance('Light')
  await assertPhoneProfileControlsFit()
  await capture(
    'Mobile light',
    'Phone light SQLite tenant fields',
    'The owner uses custom selectors and checkboxes. Advanced JSON is unnecessary.',
  )
  await copyProfile
    .getByRole('combobox', {
      name: 'Tenant API field choice for products',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this tenant', exact: true })
    .click()
  await copyProfile
    .getByRole('checkbox', {
      name: 'Allow tenant API field Product title with spaces',
      exact: true,
    })
    .click()
  await copyProfile
    .getByRole('button', { name: 'Review tenant API fields', exact: true })
    .click()
  await assertPhoneProfileControlsFit()
  await assertReviewActionsFit(copyReview)
  await capture(
    'Mobile light',
    'Phone SQLite tenant review keeps full table names',
    'The complete-table review shows old and proposed intersections without truncating significant column labels.',
  )
  await appearance('Dark')
  await assertPhoneProfileControlsFit()
  await assertReviewActionsFit(copyReview)
  await capture(
    'Mobile dark',
    'Phone dark SQLite tenant review',
    'Review explanations and Confirm/Cancel controls remain readable in dark appearance.',
  )
  await copyReview
    .getByRole('button', { name: 'Cancel tenant field review', exact: true })
    .click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await appearance('System')
  await capture(
    'Mobile system',
    'System dark tenant fields',
    'System appearance follows the OS preference without storing any identity or credential.',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await capture(
    'Mobile system',
    'System light tenant fields',
    'The same full schema labels and saved selection remain readable when the system switches to light.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(copyProfile).not.toContainText(identityValue)
  await expect(copyProfile).not.toContainText('Notebook')
  await expect(copyProfile).not.toContainText('2400')
  const profileReadFailure = async (
    route: import('@playwright/test').Route,
  ) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Profile delivery unavailable' }),
    })
  }
  await page.route(
    `**/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
    profileReadFailure,
  )
  await copyProfile
    .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
    .click()
  await expect(copyProfile.getByRole('alert')).toContainText(
    'Profile delivery unavailable',
  )
  await expect(copyProfile).toContainText('Current tenant API fields unknown')
  await expect(
    copyProfile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Profile read failure preserves reviewed choices safely',
    'Only GET delivery fails. Existing choices remain visible as last-reviewed, and no mutation can use that old policy as current.',
  )
  await page.unroute(
    `**/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
    profileReadFailure,
  )
  await copyProfile
    .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
    .click()
  await expect(
    copyProfile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(copyProfile).not.toContainText(
    'Current tenant API fields unknown',
  )
  await capture(
    'Tenant protection',
    'Explicit Refresh recovers current SQLite tenant fields',
    'The real GET restores the saved complete-table profile. A failed read is never automatically retried as a mutation.',
  )
  let releaseRead!: () => void
  const delayedRead = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  let readStarted!: () => void
  const readRequest = new Promise<void>((resolve) => {
    readStarted = resolve
  })
  const copyProfileUrl = `${apiOrigin}/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`
  let readDelivery: Promise<void> | undefined
  const heldRead = (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    readDelivery = (async () => {
      const result = await route.fetch({
        url: copyProfileUrl || route.request().url(),
      })
      expect(result.status()).toBe(200)
      readStarted()
      await delayedRead
      await route.fulfill({ response: result })
    })()
    return readDelivery
  }
  await page.route(
    `**/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
    heldRead,
  )
  await copyProfile
    .getByRole('button', { name: 'Refresh tenant API fields', exact: true })
    .click()
  await readRequest
  await expect(
    copyProfile.getByRole('combobox', { name: 'Approved tenant', exact: true }),
  ).toBeDisabled()
  await expect(
    copyProfile.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Tenant metadata pending disables old review',
    'A real profile GET is held at delivery. Old fields are marked last-reviewed; tenant selection and mutation review remain disabled.',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'API keys', exact: true }),
  ).toBeVisible()
  const deliveredResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${copy.id}/tenant-fields/${tenant.id}` &&
      response.request().method() === 'GET',
  )
  releaseRead()
  expect(readDelivery).toBeDefined()
  await readDelivery
  expect((await deliveredResponse).status()).toBe(200)
  await page.unroute(
    `**/api/database-connections/${copy.id}/tenant-fields/${tenant.id}`,
    heldRead,
  )
  await expect(copyProfile).toHaveCount(0)
  await capture(
    'API keys',
    'Late tenant profile response cannot reopen old editor',
    'The owner navigated during an allowed metadata read. Its late response cannot remount the profile panel or replace this page.',
  )
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: `Profile reader ${suffix}`,
      role: 'viewer',
      access: {
        mode: 'selected',
        flowIds: [wide.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [],
          authConnections: [],
        },
      },
      tenantId: otherTenant.id,
    },
  })
  expect(memberResponse.status()).toBe(200)
  const reader = (await memberResponse.json()) as { token: string }
  for (const url of [
    profileUrl,
    copyProfileUrl,
    `${apiOrigin}/api/data-sources/${source.id}/tenant-fields`,
  ]) {
    const forbidden = await page.request.get(url, {
      headers: { authorization: `Bearer ${reader.token}` },
    })
    expect(forbidden.status()).toBe(403)
    expect(await forbidden.text()).not.toContain(tenant.label)
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateReads = 0
  const observePrivate = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'GET' &&
      /\/tenant-fields(?:\/|$)|^\/api\/tenants(?:\/|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      privateReads++
  }
  page.on('request', observePrivate)
  await page.getByLabel('Workspace token').fill(reader.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /^API Studio\b/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Tenant protection', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: /^Tenant-specific API fields for/ }),
  ).toHaveCount(0)
  expect(privateReads).toBe(0)
  await capture(
    'Permissions',
    'Tenant profile administration stays owner-only',
    'A real selected API viewer sees its shared API but has no tenant-profile controls and performs zero private profile, summary or registry reads. Profile choices never change assignment or key scope.',
  )
  page.off('request', observePrivate)
}
