import { expect, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import type { DatabaseConnection } from '../src/databases/model'
import type { DatabaseRowPolicy } from '../src/workspace/tenant-model'
import type { DatabaseMemberFieldProfile } from '../src/workspace/member-field-model'
import type { Member } from '../web/lib/api'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

export async function memberFieldProfilePreviews({
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
  async function phoneSection(target: Locator, title: string) {
    await target.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    )
    await expect(target).toBeInViewport()
    await capture(
      'Member API fields',
      title,
      'Native-width phone view keeps full labels, local Latin and Thai glyphs, current field ceilings and ordinary accessible controls readable.',
      { fullPage: false },
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(
    page.getByLabel('Workspace token', { exact: true }),
  ).toBeVisible()

  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
    if (mode !== 'System')
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        mode.toLowerCase(),
      )
  }

  async function containedControl(card: Locator, control: Locator) {
    const cardBounds = await card.boundingBox()
    const controlBounds = await control.boundingBox()
    expect(cardBounds).not.toBeNull()
    expect(controlBounds).not.toBeNull()
    expect(controlBounds!.x).toBeGreaterThanOrEqual(cardBounds!.x - 1)
    expect(controlBounds!.x + controlBounds!.width).toBeLessThanOrEqual(
      cardBounds!.x + cardBounds!.width + 1,
    )
    expect(
      await control.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node = text.nextNode()
        while (node) {
          if (node.textContent?.trim()) {
            const range = document.createRange()
            range.selectNodeContents(node)
            if (
              [...range.getClientRects()].some(
                (box) =>
                  box.left < bounds.left - 1 ||
                  box.right > bounds.right + 1 ||
                  box.top < bounds.top - 1 ||
                  box.bottom > bounds.bottom + 1,
              )
            )
              return false
          }
          node = text.nextNode()
        }
        return true
      }),
    ).toBe(true)
  }

  async function noDocumentOverflow() {
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true)
  }

  const headers = { authorization: `Bearer ${owner}` }
  const suffix = crypto.randomUUID().slice(0, 8)
  const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers,
    data: {
      label: `Member profile tenant ${suffix}`,
      value: `Member.${suffix}`,
    },
  })
  expect(tenantResponse.status()).toBe(200)
  const tenant = (await tenantResponse.json()) as { id: string; label: string }
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Member profile source ${suffix}`,
        file: {
          name: 'member-profile.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            `tenant,person,email\nMember.${suffix},Ada,ada@example.test\n`,
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
      fields: { mode: 'selected', columns: ['person', 'email'] },
      version: policy.version,
      resourceVersion: policy.resourceVersion,
    },
  })
  expect(protectedResponse.status()).toBe(200)
  const tenantFieldsUrl = `${apiOrigin}/api/data-sources/${source.id}/tenant-fields/${tenant.id}`
  const inherited = await page.request.get(tenantFieldsUrl, { headers })
  expect(inherited.status()).toBe(200)
  const tenantProfile = (await inherited.json()) as {
    version: number
    resourceVersion: number
    tenant: { version: number }
  }
  const selected = await page.request.put(tenantFieldsUrl, {
    headers,
    data: {
      version: tenantProfile.version,
      resourceVersion: tenantProfile.resourceVersion,
      tenantVersion: tenantProfile.tenant.version,
      fields: { mode: 'selected', columns: ['person'] },
    },
  })
  expect(selected.status()).toBe(200)
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: `Member field reader ${suffix} · สมาชิก`,
      role: 'viewer',
      tenantId: tenant.id,
    },
  })
  expect(memberResponse.status()).toBe(200)
  const member = (await memberResponse.json()) as { id: string; name: string }

  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('navigation', { name: 'Workspace navigation' }),
  ).toBeVisible()
  await appearance('Light')
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
  await resource
    .getByRole('button', { name: 'Member-specific API fields', exact: true })
    .click()
  const panel = page.getByRole('region', {
    name: `Member-specific API fields for ${source.name}`,
    exact: true,
  })
  await expect(
    panel.getByRole('heading', {
      name: 'Member-specific API fields',
      exact: true,
    }),
  ).toBeInViewport()
  const summaryUrl = `${apiOrigin}/api/data-sources/${source.id}/member-fields`
  const inheritedSummaryResponse = await page.request.get(summaryUrl, {
    headers,
  })
  expect(inheritedSummaryResponse.status()).toBe(200)
  const inheritedSummary = await inheritedSummaryResponse.json()
  expect(inheritedSummary.configuredMemberIds).toEqual([])
  const configuredMembers = panel.getByRole('region', {
    name: 'Configured member choices',
    exact: true,
  })
  await expect(configuredMembers).toContainText(
    'No member-specific choices saved.',
  )
  const memberDetails = panel.getByRole('button', {
    name: 'Review details',
    exact: true,
  })
  await expect(memberDetails).toHaveAttribute('aria-expanded', 'false')
  await expect(
    panel.getByText('Current field settings', { exact: true }),
  ).toBeVisible()
  await expect(configuredMembers.getByText(/Policy version/)).toHaveCount(0)
  await memberDetails.click()
  await expect(configuredMembers).toContainText(
    `Policy version ${inheritedSummary.version}`,
  )
  await panel
    .getByRole('combobox', { name: 'Workspace member', exact: true })
    .click()
  await page.getByRole('option', { name: member.name, exact: true }).click()
  await expect(
    panel
      .getByRole('region', { name: 'Saved member choice', exact: true })
      .getByText('Use shared and tenant API fields', { exact: true }),
  ).toBeVisible()
  await expect(panel.getByText(tenant.label, { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const renderedFonts = await page.evaluate(() => ({
    loaded: [...document.fonts]
      .filter((font) => font.status === 'loaded')
      .map((font) => font.family.replaceAll('"', '')),
    requests: performance
      .getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.endsWith('.woff2'))
      .map((entry) => entry.name),
  }))
  expect(renderedFonts.loaded).toContain('Google Sans Flex')
  expect(renderedFonts.loaded).toContain('Noto Sans Thai')
  expect(
    renderedFonts.requests.some((url) =>
      url.includes('google-sans-flex-latin-variable'),
    ),
  ).toBe(true)
  expect(
    renderedFonts.requests.some((url) =>
      url.includes('noto-sans-thai-thai-variable'),
    ),
  ).toBe(true)
  expect(
    renderedFonts.requests.every((url) => new URL(url).origin === apiOrigin),
  ).toBe(true)
  const allowed = panel.getByRole('region', {
    name: 'Fields allowed by these policies',
    exact: true,
  })
  await expect(allowed).toContainText('person')
  await expect(allowed).not.toContainText('email')
  await expect(panel).toContainText(
    'API action permissions, API access scope, and dependency USE are still required.',
  )
  await expect(panel.getByRole('combobox', { name: /tenant/i })).toHaveCount(0)
  await expect(
    panel.getByRole('heading', { name: 'Shared API fields', exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('heading', { name: 'Tenant API fields', exact: true }),
  ).toBeVisible()
  await expect(
    panel.getByRole('heading', { name: 'Member field choice', exact: true }),
  ).toBeVisible()
  await capture(
    'Member API fields',
    'Inherited member fields keep assignment separate',
    'Owner reviews the shared and tenant intersection for an assigned member. This ceiling does not grant API actions or expose imported cells.',
  )

  await resource
    .getByRole('button', { name: 'Tenant-specific API fields', exact: true })
    .click()
  const tenantPanel = page.getByRole('region', {
    name: `Tenant-specific API fields for ${source.name}`,
    exact: true,
  })
  await tenantPanel
    .getByRole('combobox', { name: 'Approved tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant.label, exact: true }).click()
  await expect(tenantPanel).toContainText(
    'Currently applied to protected API reads',
  )
  await panel
    .getByRole('combobox', { name: 'Member API field choice', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this member', exact: true })
    .click()
  await panel
    .getByRole('checkbox', {
      name: 'Allow member API field person',
      exact: true,
    })
    .click()
  await panel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  const review = panel.getByRole('region', {
    name: 'Review member API fields',
    exact: true,
  })
  await expect(review).toContainText(member.name)
  await expect(review).toContainText(tenant.label)
  await expect(review).toContainText('person')
  const confirm = review.getByRole('button', {
    name: 'Confirm member API fields',
    exact: true,
  })
  await expect(confirm).toBeDisabled()
  await review
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  const savedReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${source.id}/member-fields/${member.id}` &&
      response.request().method() === 'PUT',
  )
  await confirm.click()
  expect((await savedReceipt).status()).toBe(200)
  const persistedResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/member-fields/${member.id}`,
    { headers },
  )
  expect(persistedResponse.status()).toBe(200)
  const persisted = await persistedResponse.json()
  expect(persisted.profile).toEqual({ mode: 'selected', columns: ['person'] })
  expect(persisted.effectiveColumns).toEqual(['person'])
  const configuredSummaryResponse = await page.request.get(summaryUrl, {
    headers,
  })
  expect(configuredSummaryResponse.status()).toBe(200)
  const configuredSummary = await configuredSummaryResponse.json()
  expect(configuredSummary.configuredMemberIds).toEqual([member.id])
  expect(configuredSummary.version).toBe(persisted.version)
  await expect(configuredMembers).toContainText(member.name)
  await expect(configuredMembers).toContainText(
    `Policy version ${configuredSummary.version}`,
  )
  await expect(configuredMembers).not.toContainText(
    'No member-specific choices saved.',
  )
  await expect(panel).toContainText(`Policy version ${persisted.version}`)
  await expect(
    panel.getByText('Current member field ceiling unknown.', { exact: false }),
  ).toHaveCount(0)
  await expect(
    panel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(tenantPanel).toContainText('Current tenant API fields unknown.')
  await expect(
    tenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Saved member choice invalidates an older sibling review',
    'Actual saved member selection advances the shared policy version. Its confirmed receipt stays current; the older tenant review requires explicit Refresh.',
  )

  await panel
    .getByRole('checkbox', {
      name: 'Allow member API field person',
      exact: true,
    })
    .click()
  await panel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  await review
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  await expect(confirm).toBeEnabled()
  await capture(
    'Member API fields',
    'Empty member source selection requires explicit review',
    'Selected none is a saved member ceiling, not an inherited default. The owner reviews the source, original member and assigned identity before accepting no API fields.',
  )
  const emptyReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${source.id}/member-fields/${member.id}` &&
      response.request().method() === 'PUT',
  )
  await confirm.click()
  const emptySaved = await emptyReceipt
  expect(emptySaved.status()).toBe(200)
  expect(emptySaved.request().postDataJSON().fields).toEqual({
    mode: 'selected',
    columns: [],
  })
  const emptyProfileResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/member-fields/${member.id}`,
    { headers },
  )
  expect(emptyProfileResponse.status()).toBe(200)
  const emptyProfile = await emptyProfileResponse.json()
  expect(emptyProfile.profile).toEqual({ mode: 'selected', columns: [] })
  expect(emptyProfile.effectiveColumns).toEqual([])
  const emptySummaryResponse = await page.request.get(summaryUrl, { headers })
  expect(emptySummaryResponse.status()).toBe(200)
  expect((await emptySummaryResponse.json()).configuredMemberIds).toEqual([
    member.id,
  ])
  await expect(configuredMembers).toContainText(member.name)
  await expect(configuredMembers).toContainText(
    `Policy version ${emptyProfile.version}`,
  )
  await expect(tenantPanel).toContainText('Current tenant API fields unknown.')
  await capture(
    'Member API fields',
    'Saved empty member selection stays configured',
    'Actual PUT and GET retain selected none and the current shared policy receipt. Independent tenant review remains stale until Refresh.',
  )

  await panel
    .getByRole('combobox', { name: 'Member API field choice', exact: true })
    .click()
  await page
    .getByRole('option', {
      name: 'Use shared and tenant API fields',
      exact: true,
    })
    .click()
  await panel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  await expect(review).toContainText('Use shared and tenant API fields')
  await expect(review).toContainText('person')
  await expect(confirm).toBeDisabled()
  await review
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  await expect(confirm).toBeEnabled()
  await capture(
    'Member API fields',
    'Reset member choice reviews restored inherited fields',
    'Owner reviews the restored shared and tenant intersection for the original member. Reset changes the field ceiling, not assignment, API actions, or caller scope.',
  )
  const resetReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${source.id}/member-fields/${member.id}` &&
      response.request().method() === 'PUT',
  )
  await confirm.click()
  const resetSaved = await resetReceipt
  expect(resetSaved.status()).toBe(200)
  expect(resetSaved.request().postDataJSON().fields).toEqual({
    mode: 'inherit',
  })
  const resetProfileResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/member-fields/${member.id}`,
    { headers },
  )
  expect(resetProfileResponse.status()).toBe(200)
  const resetProfile = await resetProfileResponse.json()
  expect(resetProfile.profile).toEqual({ mode: 'inherit' })
  expect(resetProfile.effectiveColumns).toEqual(['person'])
  const resetSummaryResponse = await page.request.get(summaryUrl, { headers })
  expect(resetSummaryResponse.status()).toBe(200)
  const resetSummary = await resetSummaryResponse.json()
  expect(resetSummary.configuredMemberIds).toEqual([])
  expect(resetSummary.version).toBe(resetProfile.version)
  await expect(configuredMembers).toContainText(
    'No member-specific choices saved.',
  )
  await expect(configuredMembers).toContainText(
    `Policy version ${resetProfile.version}`,
  )
  await expect(allowed).toContainText('person')
  await expect(allowed).not.toContainText('email')
  await expect(tenantPanel).toContainText('Current tenant API fields unknown.')
  await expect(
    panel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await capture(
    'Member API fields',
    'Confirmed source member reset removes configured choice',
    'Actual inherit PUT and GET remove the configured member ID. The confirmed member receipt remains current while its older tenant sibling still requires Refresh.',
  )

  const sqlite = spawnSync(
    'bun',
    [
      '-e',
      `
        import { Database } from 'bun:sqlite'
        const database = new Database(':memory:')
        database.run('CREATE TABLE "People records" (tenant TEXT NOT NULL, person TEXT NOT NULL, email TEXT NOT NULL)')
        database.query('INSERT INTO "People records" VALUES (?, ?, ?)').run(process.argv[1], 'Ada', 'ada@example.test')
        database.run('CREATE TABLE "Reference records" (tenant TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL)')
        database.query('INSERT INTO "Reference records" VALUES (?, ?, ?)').run(process.argv[1], 'Reference one', 'Reviewed note')
        process.stdout.write(database.serialize())
        database.close()
      `,
      `Member.${suffix}`,
    ],
    { windowsHide: true },
  )
  expect(sqlite.status).toBe(0)
  const copyName = `Member profile SQLite ${suffix}`
  await page
    .getByRole('button', { name: 'Database connections', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Database connections', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Loading SQLite copies…')).toHaveCount(0)
  await page.getByLabel('Connection name', { exact: true }).fill(copyName)
  await page.getByLabel('SQLite file', { exact: true }).setInputFiles({
    name: 'member-fields.sqlite',
    mimeType: 'application/vnd.sqlite3',
    buffer: sqlite.stdout,
  })
  const uploadReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/database-connections' &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Upload read-only copy', exact: true })
    .click()
  const uploaded = await uploadReceipt
  expect(uploaded.status()).toBe(200)
  const copy = (await uploaded.json()) as DatabaseConnection
  const copyPolicyUrl = `${apiOrigin}/api/database-connections/${copy.id}/row-policy`
  const copyPolicyResponse = await page.request.get(copyPolicyUrl, { headers })
  expect(copyPolicyResponse.status()).toBe(200)
  const copyPolicy = (await copyPolicyResponse.json()) as DatabaseRowPolicy
  const protectedCopy = await page.request.put(copyPolicyUrl, {
    headers,
    data: {
      mode: 'tenant',
      version: copyPolicy.version,
      resourceVersion: copyPolicy.resourceVersion,
      tables: copy.tables.map((table) => ({
        table: table.name,
        column: 'tenant',
        fields: {
          mode: 'selected',
          columns:
            table.name === 'People records'
              ? ['person', 'email']
              : ['reference', 'notes'],
        },
      })),
    },
  })
  expect(protectedCopy.status()).toBe(200)
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Resource type', exact: true })
    .click()
  await page.getByRole('option', { name: 'SQLite copy', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: copyName, exact: true }).click()
  const copyResource = page.getByRole('region', {
    name: `Row protection for ${copyName}`,
    exact: true,
  })
  await copyResource
    .getByRole('button', { name: 'Member-specific API fields', exact: true })
    .click()
  const copyPanel = page.getByRole('region', {
    name: `Member-specific API fields for ${copyName}`,
    exact: true,
  })
  await expect(
    copyPanel.getByRole('heading', {
      name: 'Member-specific API fields',
      exact: true,
    }),
  ).toBeInViewport()
  const copySummaryUrl = `${apiOrigin}/api/database-connections/${copy.id}/member-fields`
  const inheritedCopySummaryResponse = await page.request.get(copySummaryUrl, {
    headers,
  })
  expect(inheritedCopySummaryResponse.status()).toBe(200)
  const inheritedCopySummary = await inheritedCopySummaryResponse.json()
  expect(inheritedCopySummary.configuredMemberIds).toEqual([])
  const configuredCopyMembers = copyPanel.getByRole('region', {
    name: 'Configured member choices',
    exact: true,
  })
  await expect(configuredCopyMembers).toContainText(
    'No member-specific choices saved.',
  )
  const copyDetails = copyPanel.getByRole('button', {
    name: 'Review details',
    exact: true,
  })
  await expect(copyDetails).toHaveAttribute('aria-expanded', 'false')
  await copyDetails.click()
  await expect(configuredCopyMembers).toContainText(
    `Policy version ${inheritedCopySummary.version}`,
  )
  await copyPanel
    .getByRole('combobox', { name: 'Workspace member', exact: true })
    .click()
  const copyProfileReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${copy.id}/member-fields/${member.id}` &&
      response.request().method() === 'GET',
  )
  await page.getByRole('option', { name: member.name, exact: true }).click()
  expect((await copyProfileReceipt).status()).toBe(200)
  for (const tableName of ['People records', 'Reference records']) {
    const table = copyPanel.getByRole('region', {
      name: `Member fields for ${tableName}`,
      exact: true,
    })
    await expect(
      table.getByRole('heading', { name: tableName, exact: true }),
    ).toBeVisible()
    await expect(
      table.getByRole('region', { name: 'Saved member choice', exact: true }),
    ).toContainText('Use shared and tenant API fields')
    await expect(
      table.getByRole('region', {
        name: 'Fields allowed by these policies',
        exact: true,
      }),
    ).toContainText(tableName === 'People records' ? 'person' : 'reference')
  }
  await expect(copyPanel.getByText(tenant.label, { exact: true })).toBeVisible()
  await expect(
    copyPanel.getByRole('combobox', { name: /tenant/i }),
  ).toHaveCount(0)
  await capture(
    'Member API fields',
    'Inherited SQLite member ceilings keep every table separate',
    'A real uploaded copy shows each inspected table and its shared, tenant, and original-member field ceiling. Assigned identity and API permissions remain separate.',
  )

  await copyResource
    .getByRole('button', { name: 'Tenant-specific API fields', exact: true })
    .click()
  const copyTenantPanel = page.getByRole('region', {
    name: `Tenant-specific API fields for ${copyName}`,
    exact: true,
  })
  await copyTenantPanel
    .getByRole('combobox', { name: 'Approved tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant.label, exact: true }).click()
  await expect(copyTenantPanel).toContainText(
    'Currently applied to protected API reads',
  )
  for (const [tableName, field] of [
    ['People records', 'person'],
    ['Reference records', 'reference'],
  ]) {
    const table = copyPanel.getByRole('region', {
      name: `Member fields for ${tableName}`,
      exact: true,
    })
    await table
      .getByRole('combobox', {
        name: `Member API field choice for ${tableName}`,
        exact: true,
      })
      .click()
    await page
      .getByRole('option', {
        name: 'Choose fields for this member',
        exact: true,
      })
      .click()
    await table
      .getByRole('checkbox', {
        name: `Allow member API field ${field} in ${tableName}`,
        exact: true,
      })
      .click()
  }
  await copyPanel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  const copyReview = copyPanel.getByRole('region', {
    name: 'Review member API fields',
    exact: true,
  })
  await expect(copyReview).toContainText('People records')
  await expect(copyReview).toContainText('Reference records')
  await expect(copyReview).toContainText(member.name)
  await expect(copyReview).toContainText(tenant.label)
  const confirmCopy = copyReview.getByRole('button', {
    name: 'Confirm member API fields',
    exact: true,
  })
  await expect(confirmCopy).toBeDisabled()
  await copyReview
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  const copySaveReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${copy.id}/member-fields/${member.id}` &&
      response.request().method() === 'PUT',
  )
  const rowPolicyPath = `/api/database-connections/${copy.id}/row-policy`
  let globalReadHeld!: () => void
  let releaseGlobalRead!: () => void
  let globalDeliverySettled!: () => void
  const heldGlobalRead = new Promise<void>((resolve) => {
    globalReadHeld = resolve
  })
  const globalReadGate = new Promise<void>((resolve) => {
    releaseGlobalRead = resolve
  })
  const globalReadSettled = new Promise<void>((resolve) => {
    globalDeliverySettled = resolve
  })
  const holdOlderGlobalRead = async (
    route: import('@playwright/test').Route,
  ) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch({ maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect((await response.json()).version).toBe(copyPolicy.version + 1)
    globalReadHeld()
    await globalReadGate
    await route.fulfill({ response })
    globalDeliverySettled()
  }
  await page.route(`**${rowPolicyPath}`, holdOlderGlobalRead)
  await copyResource
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await heldGlobalRead
  await confirmCopy.click()
  const copySaved = await copySaveReceipt
  expect(copySaved.status()).toBe(200)
  const oldGlobalReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === rowPolicyPath &&
      response.request().method() === 'GET',
  )
  releaseGlobalRead()
  expect((await oldGlobalReceipt).status()).toBe(200)
  await globalReadSettled
  await page.unroute(`**${rowPolicyPath}`, holdOlderGlobalRead)
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyResource.getByRole('button', {
      name: 'Refresh row policy',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(copyResource).toContainText(
    'Member API fields changed the shared policy version. Refresh row policy',
  )
  const copySubmitted = copySaved.request().postDataJSON()
  expect(copySubmitted).toEqual({
    version: copyPolicy.version + 1,
    resourceVersion: copy.version,
    memberAccessVersion: 1,
    tenantAssignmentVersion: 1,
    tenantVersion: 1,
    roleId: null,
    roleVersion: 0,
    tables: [
      {
        table: 'People records',
        fields: { mode: 'selected', columns: ['person'] },
      },
      {
        table: 'Reference records',
        fields: { mode: 'selected', columns: ['reference'] },
      },
    ],
  })
  const savedCopyResponse = await page.request.get(
    `${apiOrigin}/api/database-connections/${copy.id}/member-fields/${member.id}`,
    { headers },
  )
  expect(savedCopyResponse.status()).toBe(200)
  const savedCopy = await savedCopyResponse.json()
  expect(
    savedCopy.tables.map(
      (table: {
        table: string
        profile: unknown
        effectiveColumns: string[]
      }) => ({
        table: table.table,
        profile: table.profile,
        effectiveColumns: table.effectiveColumns,
      }),
    ),
  ).toEqual([
    {
      table: 'People records',
      profile: { mode: 'selected', columns: ['person'] },
      effectiveColumns: ['person'],
    },
    {
      table: 'Reference records',
      profile: { mode: 'selected', columns: ['reference'] },
      effectiveColumns: ['reference'],
    },
  ])
  const configuredCopySummaryResponse = await page.request.get(copySummaryUrl, {
    headers,
  })
  expect(configuredCopySummaryResponse.status()).toBe(200)
  const configuredCopySummary = await configuredCopySummaryResponse.json()
  expect(configuredCopySummary.configuredMemberIds).toEqual([member.id])
  expect(configuredCopySummary.version).toBe(savedCopy.version)
  await expect(configuredCopyMembers).toContainText(member.name)
  await expect(configuredCopyMembers).toContainText(
    `Policy version ${configuredCopySummary.version}`,
  )
  await expect(configuredCopyMembers).not.toContainText(
    'No member-specific choices saved.',
  )
  await expect(copyPanel).toContainText(`Policy version ${savedCopy.version}`)
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(copyTenantPanel).toContainText(
    'Current tenant API fields unknown.',
  )
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Complete SQLite member field choices saved with current receipt',
    'Both inspected table choices persist in one reviewed versioned update. The member receipt stays current while the older tenant sibling requires explicit Refresh.',
  )
  await capture(
    'Member API fields',
    'Held older global policy cannot replace newer member receipt',
    'A real earlier policy GET arrives after a newer member save. Its delivery cannot reactivate stale global review or replace the confirmed member receipt.',
  )

  await copyResource
    .getByRole('button', {
      name: 'Refresh row policy',
      exact: true,
    })
    .click()
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeEnabled()
  await copyTenantPanel
    .getByRole('button', {
      name: 'Refresh tenant API fields',
      exact: true,
    })
    .click()
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  const addedFields = [
    ['People records', 'email'],
    ['Reference records', 'notes'],
  ]
  for (const [tableName, field] of addedFields) {
    await copyPanel
      .getByRole('checkbox', {
        name: `Allow member API field ${field} in ${tableName}`,
        exact: true,
      })
      .click()
  }
  await copyPanel
    .getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    })
    .click()
  await copyReview
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  const copyMemberPath = `/api/database-connections/${copy.id}/member-fields/${member.id}`
  let writes = 0
  let automaticReads = 0
  let committed!: () => void
  let releaseLostReceipt!: () => void
  let settled!: () => void
  const copyCommitted = new Promise<void>((resolve) => {
    committed = resolve
  })
  const lostReceiptGate = new Promise<void>((resolve) => {
    releaseLostReceipt = resolve
  })
  const lostDeliverySettled = new Promise<void>((resolve) => {
    settled = resolve
  })
  const loseCopyReceipt = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === 'GET') {
      automaticReads++
      return route.fallback()
    }
    if (route.request().method() !== 'PUT') return route.fallback()
    writes++
    const response = await route.fetch({ maxRedirects: 0 })
    expect(response.status()).toBe(200)
    committed()
    await lostReceiptGate
    await route.abort('failed')
    settled()
  }
  await page.route(`**${copyMemberPath}`, loseCopyReceipt)
  await confirmCopy.click()
  await copyCommitted
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Members', exact: true }),
  ).toBeDisabled()
  await expect(
    copyPanel.getByRole('combobox', {
      name: 'Workspace member',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Committed SQLite member update waits for its receipt',
    'The real complete-table update has committed while only its delivery is held. Navigation, review actions, and member selection remain blocked.',
  )
  releaseLostReceipt()
  await lostDeliverySettled
  await expect(copyPanel.getByRole('alert')).toContainText(
    'Could not confirm whether member API fields were saved',
  )
  for (const [tableName, field] of addedFields) {
    await expect(
      copyPanel.getByRole('checkbox', {
        name: `Allow member API field ${field} in ${tableName}`,
        exact: true,
      }),
    ).toBeChecked()
  }
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(copyTenantPanel).toContainText(
    'Current tenant API fields unknown.',
  )
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(copyPanel).toContainText('Current member field ceiling unknown.')
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyPanel.getByRole('combobox', {
      name: 'Workspace member',
      exact: true,
    }),
  ).toBeDisabled()
  expect(writes).toBe(1)
  expect(automaticReads).toBe(0)
  await capture(
    'Member API fields',
    'Lost committed member receipt preserves both table choices',
    'Lost response does not mean failed save. Proposed fields stay visible; global, tenant, and member reviews require current metadata before another write.',
  )
  const refreshReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'GET',
  )
  await copyPanel
    .getByRole('button', {
      name: 'Refresh member API fields',
      exact: true,
    })
    .click()
  const confirmedRefresh = await refreshReceipt
  expect(confirmedRefresh.status()).toBe(200)
  const confirmedCopy = await confirmedRefresh.json()
  expect(
    confirmedCopy.tables.map((table: { table: string; profile: unknown }) => ({
      table: table.table,
      profile: table.profile,
    })),
  ).toEqual([
    {
      table: 'People records',
      profile: { mode: 'selected', columns: ['person', 'email'] },
    },
    {
      table: 'Reference records',
      profile: { mode: 'selected', columns: ['reference', 'notes'] },
    },
  ])
  await expect(copyPanel.getByRole('alert')).toHaveCount(0)
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  expect(writes).toBe(1)
  expect(automaticReads).toBe(1)
  await page.unroute(`**${copyMemberPath}`, loseCopyReceipt)
  await capture(
    'Member API fields',
    'Explicit member refresh confirms the committed table map',
    'A real GET confirms the saved choices and current member receipt. Independent global and tenant reviews remain stale until explicitly refreshed.',
  )

  for (const field of ['person', 'email']) {
    await copyPanel
      .getByRole('checkbox', {
        name: `Allow member API field ${field} in People records`,
        exact: true,
      })
      .click()
  }
  const referenceTable = copyPanel.getByRole('region', {
    name: 'Member fields for Reference records',
    exact: true,
  })
  await referenceTable
    .getByRole('combobox', {
      name: 'Member API field choice for Reference records',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', {
      name: 'Use shared and tenant API fields',
      exact: true,
    })
    .click()
  await copyPanel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  await expect(
    copyReview.getByRole('region', {
      name: 'Reviewed member fields for People records',
      exact: true,
    }),
  ).toContainText('No API fields allowed by these policies')
  const referenceReview = copyReview.getByRole('region', {
    name: 'Reviewed member fields for Reference records',
    exact: true,
  })
  await expect(referenceReview).toContainText(
    'Use shared and tenant API fields',
  )
  await expect(referenceReview).toContainText('reference, notes')
  await expect(confirmCopy).toBeDisabled()
  await copyReview
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  await expect(confirmCopy).toBeEnabled()
  await capture(
    'Member API fields',
    'Empty SQLite member table keeps other table inheritance separate',
    'Owner reviews People records sharing none alongside Reference records inheriting its current shared and tenant ceiling. The complete table map remains explicit.',
  )
  const emptyCopyReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'PUT',
  )
  await confirmCopy.click()
  const emptyCopySaved = await emptyCopyReceipt
  expect(emptyCopySaved.status()).toBe(200)
  expect(emptyCopySaved.request().postDataJSON().tables).toEqual([
    { table: 'People records', fields: { mode: 'selected', columns: [] } },
    { table: 'Reference records', fields: { mode: 'inherit' } },
  ])
  const emptyCopyProfileResponse = await page.request.get(
    `${apiOrigin}${copyMemberPath}`,
    { headers },
  )
  expect(emptyCopyProfileResponse.status()).toBe(200)
  const emptyCopyProfile = await emptyCopyProfileResponse.json()
  expect(
    emptyCopyProfile.tables.map(
      (table: {
        table: string
        profile: unknown
        effectiveColumns: string[]
      }) => ({
        table: table.table,
        profile: table.profile,
        effectiveColumns: table.effectiveColumns,
      }),
    ),
  ).toEqual([
    {
      table: 'People records',
      profile: { mode: 'selected', columns: [] },
      effectiveColumns: [],
    },
    {
      table: 'Reference records',
      profile: { mode: 'inherit' },
      effectiveColumns: ['reference', 'notes'],
    },
  ])
  const emptyCopySummaryResponse = await page.request.get(copySummaryUrl, {
    headers,
  })
  expect(emptyCopySummaryResponse.status()).toBe(200)
  const emptyCopySummary = await emptyCopySummaryResponse.json()
  expect(emptyCopySummary.configuredMemberIds).toEqual([member.id])
  expect(emptyCopySummary.version).toBe(emptyCopyProfile.version)
  await expect(configuredCopyMembers).toContainText(member.name)
  await expect(configuredCopyMembers).toContainText(
    `Policy version ${emptyCopyProfile.version}`,
  )
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Saved empty SQLite member table stays configured',
    'Actual complete-map PUT and GET retain the empty People selection and inherited Reference fields. The member receipt stays current while sibling reviews remain stale.',
  )

  await copyPanel
    .getByRole('combobox', {
      name: 'Member API field choice for People records',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', {
      name: 'Use shared and tenant API fields',
      exact: true,
    })
    .click()
  await copyPanel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  const restoredPeopleReview = copyReview.getByRole('region', {
    name: 'Reviewed member fields for People records',
    exact: true,
  })
  await expect(restoredPeopleReview).toContainText(
    'Use shared and tenant API fields',
  )
  await expect(restoredPeopleReview).toContainText('person, email')
  await expect(referenceReview).toContainText(
    'Use shared and tenant API fields',
  )
  await expect(referenceReview).toContainText('reference, notes')
  await expect(confirmCopy).toBeDisabled()
  await copyReview
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  await expect(confirmCopy).toBeEnabled()
  await capture(
    'Member API fields',
    'Reset SQLite member choice reviews every inherited table',
    'The owner reviews restored People fields and unchanged Reference inheritance using the complete inspected table map. Assignment and API permissions remain separate.',
  )
  const resetCopyReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'PUT',
  )
  await confirmCopy.click()
  const resetCopySaved = await resetCopyReceipt
  expect(resetCopySaved.status()).toBe(200)
  expect(resetCopySaved.request().postDataJSON().tables).toEqual([
    { table: 'People records', fields: { mode: 'inherit' } },
    { table: 'Reference records', fields: { mode: 'inherit' } },
  ])
  const resetCopyProfileResponse = await page.request.get(
    `${apiOrigin}${copyMemberPath}`,
    { headers },
  )
  expect(resetCopyProfileResponse.status()).toBe(200)
  const resetCopyProfile = await resetCopyProfileResponse.json()
  expect(resetCopyProfile.configured).toBe(false)
  expect(
    resetCopyProfile.tables.map(
      (table: {
        table: string
        profile: unknown
        effectiveColumns: string[]
      }) => ({
        table: table.table,
        profile: table.profile,
        effectiveColumns: table.effectiveColumns,
      }),
    ),
  ).toEqual([
    {
      table: 'People records',
      profile: { mode: 'inherit' },
      effectiveColumns: ['person', 'email'],
    },
    {
      table: 'Reference records',
      profile: { mode: 'inherit' },
      effectiveColumns: ['reference', 'notes'],
    },
  ])
  const resetCopySummaryResponse = await page.request.get(copySummaryUrl, {
    headers,
  })
  expect(resetCopySummaryResponse.status()).toBe(200)
  const resetCopySummary = await resetCopySummaryResponse.json()
  expect(resetCopySummary.configuredMemberIds).toEqual([])
  expect(resetCopySummary.version).toBe(resetCopyProfile.version)
  await expect(configuredCopyMembers).toContainText(
    'No member-specific choices saved.',
  )
  await expect(configuredCopyMembers).toContainText(
    `Policy version ${resetCopyProfile.version}`,
  )
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    copyTenantPanel.getByRole('button', {
      name: 'Review tenant API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyResource.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Confirmed SQLite member reset removes configured choice',
    'Actual complete-map inherit PUT and GET remove the configured member ID, preserve current inherited intersections, and leave independent sibling reviews stale.',
  )

  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: `Member ceiling role ${suffix}`,
      permissions: ['flows.read'],
    },
  })
  expect(roleResponse.status()).toBe(200)
  const role = (await roleResponse.json()) as { id: string; version: number }
  const assignedRoleResponse = await page.request.put(
    `${apiOrigin}/api/members/${member.id}/role`,
    { headers, data: { role: 'custom', roleId: role.id } },
  )
  expect(assignedRoleResponse.status()).toBe(200)
  const roleReviewReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'GET',
  )
  await copyPanel
    .getByRole('button', { name: 'Refresh member API fields', exact: true })
    .click()
  const roleReviewResponse = await roleReviewReceipt
  expect(roleReviewResponse.status()).toBe(200)
  const reviewedRoleProfile =
    (await roleReviewResponse.json()) as DatabaseMemberFieldProfile
  expect(reviewedRoleProfile.member.roleId).toBe(role.id)
  expect(reviewedRoleProfile.member.roleVersion).toBe(role.version)
  await copyPanel
    .getByRole('combobox', {
      name: 'Member API field choice for People records',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Choose fields for this member', exact: true })
    .click()
  await copyPanel
    .getByRole('checkbox', {
      name: 'Allow member API field person in People records',
      exact: true,
    })
    .click()
  await copyPanel
    .getByRole('button', { name: 'Review member API fields', exact: true })
    .click()
  await copyReview
    .getByRole('checkbox', {
      name: 'I reviewed the original member, assigned tenant, and field ceilings',
      exact: true,
    })
    .click()
  const editedRoleResponse = await page.request.put(
    `${apiOrigin}/api/roles/${role.id}`,
    {
      headers,
      data: {
        name: `Member ceiling role ${suffix}`,
        permissions: ['flows.read', 'flows.test'],
        version: role.version,
      },
    },
  )
  expect(editedRoleResponse.status()).toBe(200)
  const editedRole = (await editedRoleResponse.json()) as { version: number }
  expect(editedRole.version).toBe(role.version + 1)
  const currentMembersResponse = await page.request.get(
    `${apiOrigin}/api/members`,
    {
      headers,
    },
  )
  expect(currentMembersResponse.status()).toBe(200)
  const currentMember = (
    (await currentMembersResponse.json()) as Member[]
  ).find((record) => record.id === member.id)
  expect(currentMember?.access.version).toBe(
    reviewedRoleProfile.member.accessVersion,
  )
  expect(currentMember?.tenantAssignment).toEqual(
    reviewedRoleProfile.member.tenantAssignment,
  )
  const staleRoleReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'PUT',
  )
  await confirmCopy.click()
  const staleRoleResponse = await staleRoleReceipt
  expect(staleRoleResponse.status()).toBe(409)
  expect(staleRoleResponse.request().postDataJSON()).toEqual({
    version: reviewedRoleProfile.version,
    resourceVersion: reviewedRoleProfile.resourceVersion,
    memberAccessVersion: reviewedRoleProfile.member.accessVersion,
    tenantAssignmentVersion:
      reviewedRoleProfile.member.tenantAssignment.version,
    tenantVersion: reviewedRoleProfile.tenant?.version ?? null,
    roleId: role.id,
    roleVersion: role.version,
    tables: [
      {
        table: 'People records',
        fields: { mode: 'selected', columns: ['person'] },
      },
      { table: 'Reference records', fields: { mode: 'inherit' } },
    ],
  })
  await expect(copyPanel.getByRole('alert')).toContainText(
    'Refresh member API fields',
  )
  await expect(copyPanel).toContainText('Current member field ceiling unknown.')
  await expect(copyPanel).toContainText(
    'Current configured member choices unknown.',
  )
  await expect(
    copyPanel.getByRole('checkbox', {
      name: 'Allow member API field person in People records',
      exact: true,
    }),
  ).toBeChecked()
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    copyPanel.getByRole('combobox', { name: 'Workspace member', exact: true }),
  ).toBeDisabled()
  await capture(
    'Member API fields',
    'Changed custom role rejects an older member field review',
    'Real role grant change advances role version without changing access or assignment clocks. The old complete-map write returns 409; choices remain visible until explicit Refresh.',
  )
  const refreshedRoleReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === copyMemberPath &&
      response.request().method() === 'GET',
  )
  await copyPanel
    .getByRole('button', { name: 'Refresh member API fields', exact: true })
    .click()
  const refreshedRoleResponse = await refreshedRoleReceipt
  expect(refreshedRoleResponse.status()).toBe(200)
  const refreshedRoleProfile =
    (await refreshedRoleResponse.json()) as DatabaseMemberFieldProfile
  expect(refreshedRoleProfile.member.roleVersion).toBe(editedRole.version)
  expect(refreshedRoleProfile.version).toBe(reviewedRoleProfile.version)
  expect(
    refreshedRoleProfile.tables.every(
      (table) => table.profile.mode === 'inherit',
    ),
  ).toBe(true)
  await expect(copyPanel.getByRole('alert')).toHaveCount(0)
  await expect(copyPanel).toContainText(`Role version ${editedRole.version}`)
  await expect(
    copyPanel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  await capture(
    'Member API fields',
    'Explicit member refresh reviews current custom role version',
    'A real current GET restores review using the new role version and unchanged saved inheritance. A rejected stale request never silently rewrites the field choice.',
  )

  await copyDetails.click()
  await expect(copyDetails).toHaveAttribute('aria-expanded', 'false')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['Light', 'Dark'] as const) {
    await appearance(mode)
    await noDocumentOverflow()
    for (const tableName of ['People records', 'Reference records']) {
      const table = copyPanel.getByRole('region', {
        name: `Member fields for ${tableName}`,
        exact: true,
      })
      await expect(
        table.getByRole('heading', { name: tableName, exact: true }),
      ).toBeVisible()
      await containedControl(
        table,
        table.getByRole('combobox', {
          name: `Member API field choice for ${tableName}`,
          exact: true,
        }),
      )
    }
    await capture(
      'Member API fields',
      `Phone ${mode.toLowerCase()} SQLite member field ceilings`,
      'Every inspected table keeps its full name, inherited choices, assigned tenant and independent API permission guidance. Controls and glyphs stay inside their own cards.',
    )
    await phoneSection(
      copyPanel.getByRole('heading', {
        name: 'Member-specific API fields',
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} SQLite member summary`,
    )
    await copyPanel
      .getByRole('button', { name: 'Review member API fields', exact: true })
      .click()
    if (mode === 'Light')
      console.log(
        'Member phone review geometry',
        await copyReview.evaluate((element) => {
          const styles = getComputedStyle(element)
          return {
            cardWidth: element.getBoundingClientRect().width,
            contentWidth:
              element.clientWidth -
              parseFloat(styles.paddingLeft) -
              parseFloat(styles.paddingRight),
          }
        }),
      )
    await containedControl(copyReview, confirmCopy)
    await containedControl(
      copyReview,
      copyReview.getByRole('button', {
        name: 'Cancel member review',
        exact: true,
      }),
    )
    await noDocumentOverflow()
    await capture(
      'Member API fields',
      `Phone ${mode.toLowerCase()} complete member field review`,
      'The complete table map and all review clocks remain readable. Confirmation stays gated by the existing original-member review acknowledgment.',
    )
    await phoneSection(
      copyReview.getByRole('heading', {
        name: 'Review member API fields',
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} SQLite review fields`,
    )
    await phoneSection(
      confirmCopy,
      `Native phone ${mode.toLowerCase()} SQLite review actions`,
    )
    await copyReview
      .getByRole('button', { name: 'Cancel member review', exact: true })
      .click()
  }
  await page.emulateMedia({ colorScheme: 'dark' })
  await appearance('System')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await noDocumentOverflow()
  await capture(
    'Member API fields',
    'Phone system appearance follows dark member field settings',
    'System mode follows the actual browser color scheme. Current member ceilings remain distinct from permission to execute an API.',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await capture(
    'Member API fields',
    'Phone system appearance follows light member field settings',
    'The same complete SQLite member profile responds to a light system scheme without changing its saved policy or identity.',
  )

  const peopleMode = copyPanel.getByRole('combobox', {
    name: 'Member API field choice for People records',
    exact: true,
  })
  await peopleMode.focus()
  await peopleMode.press('Space')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(
    page.getByRole('option', {
      name: 'Use shared and tenant API fields',
      exact: true,
    }),
  ).toBeVisible()
  await capture(
    'Member API fields',
    'Keyboard opens custom member field choices on phone',
    'The labeled custom selector opens by keyboard, retains full inherited and selected labels, and does not use a native dropdown.',
  )
  await page.keyboard.press('Escape')
  await expect(peopleMode).toBeFocused()
  expect(
    await peopleMode.evaluate((element) => element.matches(':focus-visible')),
  ).toBe(true)
  expect(
    await peopleMode.evaluate((element) => {
      const styles = getComputedStyle(element)
      return styles.boxShadow !== 'none' || styles.outlineStyle !== 'none'
    }),
  ).toBe(true)
  await capture(
    'Member API fields',
    'Keyboard focus returns to member field selector',
    'Escape closes the custom choices and restores a visible focus indicator on the original labeled control.',
  )

  await page
    .getByRole('combobox', { name: 'Resource type', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Spreadsheet source', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: source.name, exact: true }).click()
  await resource
    .getByRole('button', { name: 'Member-specific API fields', exact: true })
    .click()
  await expect(
    panel.getByRole('heading', {
      name: 'Member-specific API fields',
      exact: true,
    }),
  ).toBeInViewport()
  await panel
    .getByRole('combobox', { name: 'Workspace member', exact: true })
    .click()
  await page.getByRole('option', { name: member.name, exact: true }).click()
  await expect(
    panel.getByRole('button', {
      name: 'Review member API fields',
      exact: true,
    }),
  ).toBeEnabled()
  for (const mode of ['Light', 'Dark'] as const) {
    await appearance(mode)
    await noDocumentOverflow()
    await containedControl(
      panel,
      panel.getByRole('combobox', {
        name: 'Member API field choice',
        exact: true,
      }),
    )
    await expect(allowed).toContainText('person')
    await expect(allowed).not.toContainText('email')
    await capture(
      'Member API fields',
      `Phone ${mode.toLowerCase()} source member field ceiling`,
      'Shared, tenant and member choices remain separate on a narrow screen. The inherited member ceiling includes person while the tenant ceiling excludes email.',
    )
    await phoneSection(
      resource.getByRole('heading', {
        name: `Row protection for ${source.name}`,
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} shared field summary`,
    )
    await resource
      .getByRole('button', { name: 'Tenant-specific API fields', exact: true })
      .click()
    await expect(
      tenantPanel.getByRole('heading', {
        name: 'Tenant-specific API fields',
        exact: true,
      }),
    ).toBeVisible()
    await phoneSection(
      tenantPanel.getByRole('heading', {
        name: 'Tenant-specific API fields',
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} tenant field summary`,
    )
    await resource
      .getByRole('button', { name: 'Close tenant API fields', exact: true })
      .click()
    await phoneSection(
      panel.getByRole('heading', {
        name: 'Member-specific API fields',
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} source member summary`,
    )
    await panel
      .getByRole('button', { name: 'Review member API fields', exact: true })
      .click()
    await containedControl(review, confirm)
    await containedControl(
      review,
      review.getByRole('button', { name: 'Cancel member review', exact: true }),
    )
    await noDocumentOverflow()
    await capture(
      'Member API fields',
      `Phone ${mode.toLowerCase()} source member review controls`,
      'Original member, assigned tenant, field intersection and review actions retain full readable labels inside the review card.',
    )
    await phoneSection(
      review.getByRole('heading', {
        name: 'Review member API fields',
        exact: true,
      }),
      `Native phone ${mode.toLowerCase()} source review fields`,
    )
    await phoneSection(
      confirm,
      `Native phone ${mode.toLowerCase()} source review actions`,
    )
    await review
      .getByRole('button', { name: 'Cancel member review', exact: true })
      .click()
  }
  await page.emulateMedia({ colorScheme: 'dark' })
  await appearance('System')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await noDocumentOverflow()
  await capture(
    'Member API fields',
    'Phone system source member fields keep ceilings separate',
    'System appearance preserves source labels, original-member assignment and the current policy intersection without granting API access.',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setViewportSize({ width: 1440, height: 900 })
}
