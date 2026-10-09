import { expect, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function tenantProtectionPreviews({
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
  await expect(
    page.getByRole('heading', { name: 'Tenant protection', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Loading tenant protection…')).toHaveCount(0)
  await capture(
    'Tenant protection',
    'Owner tenant protection registry',
    'Only the owner approves immutable exact-text identities and resource row protection.',
  )
  const label = `Exact text tenant ${crypto.randomUUID().slice(0, 8)}`
  const value = ' Acme.01 '
  await page.getByLabel('Tenant label', { exact: true }).fill(label)
  await page.getByLabel('Exact tenant value', { exact: true }).fill(value)
  await page
    .getByRole('button', { name: 'Review new tenant', exact: true })
    .click()
  const review = page.getByRole('region', {
    name: 'Review new tenant',
    exact: true,
  })
  await expect(review).toContainText('Spaces and case are part of the identity')
  expect(
    await review.getByLabel('Reviewed exact tenant value').textContent(),
  ).toBe(value)
  await capture(
    'Tenant protection',
    'Review immutable exact tenant text',
    'The reviewed value retains surrounding spaces and case before owner approval.',
  )
  await review
    .getByRole('button', { name: 'Create tenant', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Tenant created')
  const response = await page.request.get(`${apiOrigin}/api/tenants`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(response.status()).toBe(200)
  const tenants = (await response.json()) as {
    id: string
    label: string
    value: string
  }[]
  expect(tenants.find((tenant) => tenant.label === label)?.value).toBe(value)
  await capture(
    'Tenant protection',
    'Exact text tenant saved',
    'The real registry preserves approved identity text; future label edits cannot change it.',
  )
  await page
    .getByRole('button', { name: `Edit tenant ${label}`, exact: true })
    .click()
  const editor = page.getByRole('region', {
    name: `Edit tenant ${label}`,
    exact: true,
  })
  await expect(
    editor.getByRole('heading', { name: `Edit tenant ${label}`, exact: true }),
  ).toBeInViewport({ ratio: 0.5 })
  expect(await editor.getByLabel('Immutable tenant value').textContent()).toBe(
    value,
  )
  const renamed = `${label} retired`
  await editor.getByLabel('Tenant label', { exact: true }).fill(renamed)
  await editor
    .getByRole('combobox', { name: 'Tenant state', exact: true })
    .click()
  await page.getByRole('option', { name: 'Retired', exact: true }).click()
  await editor
    .getByRole('button', { name: 'Review tenant changes', exact: true })
    .click()
  await expect(editor).toContainText(
    'Retiring this tenant denies assigned tests and callers',
  )
  await capture(
    'Tenant protection',
    'Review tenant retirement',
    'Label edits leave exact identity untouched; retirement requires an explicit review of affected callers.',
  )
  await editor
    .getByRole('button', { name: 'Confirm tenant changes', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Tenant updated')
  const changed = await page.request.get(`${apiOrigin}/api/tenants`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(changed.status()).toBe(200)
  const records = (await changed.json()) as {
    id: string
    label: string
    value: string
    state: string
    version: number
  }[]
  expect(records.find((tenant) => tenant.label === renamed)).toMatchObject({
    value,
    state: 'retired',
    version: 2,
  })
  await capture(
    'Tenant protection',
    'Tenant retired with immutable value',
    'The real versioned update changes label and retirement state while preserving exact identity.',
  )
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Data & backups', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(
    'Workspace backup created',
  )
  const backupsResponse = await page.request.get(`${apiOrigin}/api/backups`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(backupsResponse.status()).toBe(200)
  const backups = (await backupsResponse.json()) as {
    id: string
    bytes: number
  }[]
  const backup = backups[0]
  expect(backup.bytes).toBeGreaterThan(100)
  let downloads = 0
  const observeDownload = () => {
    downloads++
  }
  page.on('download', observeDownload)
  await page.route(`**/api/backups/${backup.id}`, async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}`,
    })
    expect(response.status()).toBe(200)
    const archive = await response.body()
    expect(archive.length).toBe(backup.bytes)
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: archive.subarray(0, Math.floor(archive.length / 2)),
    })
  })
  const backupRow = page
    .getByRole('row')
    .filter({ hasText: `${backup.id.slice(0, 8)}.sqlite` })
  await backupRow.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(
    'Backup download interrupted or incomplete',
  )
  expect(downloads).toBe(0)
  await capture(
    'Data & backups',
    'Incomplete backup download rejected',
    'A real archive prefix arrives as a normally ending HTTP200 response. Its size differs from the reviewed record, so no file is saved.',
  )
  await page.unroute(`**/api/backups/${backup.id}`)
  const completedDownload = page.waitForEvent('download')
  await backupRow.getByRole('button', { name: 'Download', exact: true }).click()
  const complete = await completedDownload
  expect(complete.suggestedFilename()).toBe(backup.id)
  await expect(page.getByRole('status')).toContainText('Backup downloaded')
  page.off('download', observeDownload)
  await capture(
    'Data & backups',
    'Complete backup download recovered',
    'A fresh complete real archive passes the reviewed size check and downloads normally.',
  )
  const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { label: 'Tenant A', value: 'A' },
  })
  expect(tenantResponse.status()).toBe(200)
  const tenantA = (await tenantResponse.json()) as { id: string; label: string }
  const memberName = `Tenant reader ${crypto.randomUUID().slice(0, 8)}`
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: memberName, role: 'viewer' },
  })
  expect(memberResponse.status()).toBe(200)
  const reader = (await memberResponse.json()) as { id: string }
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your team', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Loading workspace records…')).toHaveCount(0)
  await page
    .getByRole('button', {
      name: `Manage tenant for ${memberName}`,
      exact: true,
    })
    .click()
  const assignment = page.getByRole('region', {
    name: `Tenant assignment for ${memberName}`,
    exact: true,
  })
  await expect(
    assignment.getByRole('heading', {
      name: `Tenant assignment for ${memberName}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await assignment
    .getByRole('combobox', { name: 'Assigned tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await assignment
    .getByRole('button', { name: 'Review tenant assignment', exact: true })
    .click()
  await expect(assignment).toContainText(
    'Existing API keys keep their original tenant',
  )
  await capture(
    'Members',
    'Review member tenant assignment',
    'Owner reviews approved tenant and expected assignment version before ending the member’s sessions; existing caller identity is never retargeted.',
  )
  await assignment
    .getByRole('button', { name: 'Confirm tenant assignment', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    'Tenant assignment updated',
  )
  const membersResponse = await page.request.get(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(membersResponse.status()).toBe(200)
  const members = (await membersResponse.json()) as {
    id: string
    tenantAssignment: { tenantId: string | null; version: number }
  }[]
  expect(
    members.find((member) => member.id === reader.id)?.tenantAssignment,
  ).toEqual({ tenantId: tenantA.id, version: 2 })
  await capture(
    'Members',
    'Member tenant assignment saved',
    'The real assignment record advances its reviewed version and displays the approved tenant label.',
  )
  await assignment
    .getByRole('combobox', { name: 'Assigned tenant', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'No tenant assigned', exact: true })
    .click()
  const peerAssignment = await page.request.put(
    `${apiOrigin}/api/members/${reader.id}/tenant`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: { tenantId: null, version: 2 },
    },
  )
  expect(peerAssignment.status()).toBe(200)
  await assignment
    .getByRole('button', { name: 'Review tenant assignment', exact: true })
    .click()
  await assignment
    .getByRole('button', { name: 'Confirm tenant assignment', exact: true })
    .click()
  await expect(assignment.getByRole('alert')).toContainText(
    'Tenant assignment changed',
  )
  await expect(
    assignment.getByRole('combobox', { name: 'Assigned tenant', exact: true }),
  ).toContainText('No tenant assigned')
  await expect(
    assignment.getByRole('button', {
      name: 'Review tenant assignment',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Stale tenant assignment requires refresh',
    'A real competing owner change rejects the reviewed version; preserved choices cannot be saved until current identity is read.',
  )
  await assignment
    .getByRole('button', { name: 'Refresh tenant assignment', exact: true })
    .click()
  await expect(assignment).toContainText('assignment version 3')
  await expect(assignment.getByRole('alert')).toHaveCount(0)
  await expect(
    assignment.getByRole('button', {
      name: 'Review tenant assignment',
      exact: true,
    }),
  ).toBeEnabled()
  await capture(
    'Members',
    'Tenant assignment refresh recovery',
    'Explicit refresh adopts the actual unassigned policy and version, clearing the stale outcome.',
  )
  await assignment
    .getByRole('combobox', { name: 'Assigned tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page.route(`**/api/members/${reader.id}/tenant`, async (route) => {
    const url = new URL(route.request().url())
    const saved = await route.fetch({
      url: `${apiOrigin || url.origin}${url.pathname}`,
    })
    expect(saved.status()).toBe(200)
    await route.abort('failed')
  })
  await assignment
    .getByRole('button', { name: 'Review tenant assignment', exact: true })
    .click()
  await assignment
    .getByRole('button', { name: 'Confirm tenant assignment', exact: true })
    .click()
  await expect(assignment.getByRole('alert')).toContainText(
    'Could not confirm whether tenant assignment was saved',
  )
  await expect(
    assignment.getByRole('button', {
      name: 'Review tenant assignment',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Members',
    'Lost tenant assignment response blocks retry',
    'The real assignment commits but delivery is lost; UI reports an unconfirmed outcome without minting or retargeting a caller.',
  )
  await page.unroute(`**/api/members/${reader.id}/tenant`)
  await assignment
    .getByRole('button', { name: 'Refresh tenant assignment', exact: true })
    .click()
  await expect(assignment).toContainText('assignment version 4')
  await expect(assignment.getByRole('alert')).toHaveCount(0)
  await expect(
    assignment.getByRole('combobox', { name: 'Assigned tenant', exact: true }),
  ).toContainText('Tenant A')
  await capture(
    'Members',
    'Lost tenant assignment refresh recovers saved identity',
    'Current real metadata confirms Tenant A at version4 and replaces the unconfirmed outcome only after explicit refresh.',
  )
  await assignment
    .getByRole('button', { name: 'Close tenant assignment', exact: true })
    .click()
  const sourceResponse = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers: { authorization: `Bearer ${owner}` },
      multipart: {
        name: 'Tenant customer spreadsheet',
        file: {
          name: 'tenant-customers.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('tenant,person\nB,Bree\nA,Ada\nA,Aster\n'),
        },
      },
    },
  )
  expect(sourceResponse.status()).toBe(200)
  const source = (await sourceResponse.json()) as { id: string; name: string }
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Tenant protection', exact: true }),
  ).toBeVisible()
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
  const policy = page.getByRole('region', {
    name: `Row protection for ${source.name}`,
    exact: true,
  })
  await expect(
    policy.getByRole('heading', {
      name: `Row protection for ${source.name}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await policy
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant rows only', exact: true })
    .click()
  await policy
    .getByRole('combobox', { name: 'Tenant column', exact: true })
    .click()
  await page.getByRole('option', { name: 'tenant', exact: true }).click()
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(policy).toContainText(
    'Existing keys without a tenant identity lose protected access',
  )
  await expect(policy).toContainText('Unsupported API shapes stop')
  await expect(policy).toContainText('Backups become owner-only permanently')
  await expect(
    policy.getByRole('button', { name: 'Confirm row protection', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'First row protection requires permanent backup review',
    'Original-text tenant column, resource version and policy version are reviewed alongside legacy caller denial and permanent delegated-backup restriction.',
  )
  await policy
    .getByRole('checkbox', {
      name: 'I understand backups become owner-only permanently',
      exact: true,
    })
    .check()
  await policy
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Row protection updated')
  const policyResponse = await page.request.get(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  expect(policyResponse.status()).toBe(200)
  expect(await policyResponse.json()).toMatchObject({
    mode: 'tenant',
    version: 2,
    resourceVersion: 1,
    column: 'tenant',
  })
  const contextResponse = await page.request.get(
    `${apiOrigin}/api/tenant-context`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  expect(contextResponse.status()).toBe(200)
  expect((await contextResponse.json()).backupsOwnerOnly).toBe(true)
  await capture(
    'Tenant protection',
    'Spreadsheet tenant row protection saved',
    'A real protected resource policy commits with the permanent backup restriction; original imported rows stay unchanged.',
  )
  await policy
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(policy).toContainText(
    'Removing row protection can expose all rows',
  )
  await expect(
    policy.getByRole('button', { name: 'Confirm row protection', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Removing protection requires raw exposure review',
    'Deprotection requires a separate explicit acknowledgment. Permanent owner-only backup access remains.',
  )
  await policy
    .getByRole('checkbox', {
      name: 'I understand delegated access may expose all rows',
      exact: true,
    })
    .check()
  const peerPolicy = await page.request.put(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        mode: 'tenant',
        column: 'tenant',
        version: 2,
        resourceVersion: 1,
      },
    },
  )
  expect(peerPolicy.status()).toBe(200)
  await policy
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(policy.getByRole('alert')).toContainText('Refresh row policy')
  await expect(
    policy.getByRole('button', { name: 'Review row protection', exact: true }),
  ).toBeDisabled()
  await expect(
    policy.getByRole('combobox', { name: 'Row protection mode', exact: true }),
  ).toContainText('Unprotected')
  await capture(
    'Tenant protection',
    'Stale policy preserves proposed removal',
    'A real concurrent policy update rejects the older reviewed version. No retry or policy substitution occurs before explicit Refresh.',
  )
  await policy
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    policy.getByRole('combobox', { name: 'Row protection mode', exact: true }),
  ).toContainText('Tenant rows only')
  await policy
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await policy
    .getByRole('checkbox', {
      name: 'I understand delegated access may expose all rows',
      exact: true,
    })
    .check()
  const policyUrl = `**/api/data-sources/${source.id}/row-policy`
  await page.route(policyUrl, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    })
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await policy
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(policy.getByRole('alert')).toContainText(
    'Could not confirm whether row protection was saved',
  )
  await expect(
    policy.getByRole('button', { name: 'Review row protection', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Lost policy save requires current protection refresh',
    'The actual removal committed but delivery was lost. The UI reports an unconfirmed outcome and blocks additional reviews until current policy is read.',
  )
  await page.unroute(policyUrl)
  await policy
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    policy.getByRole('combobox', { name: 'Row protection mode', exact: true }),
  ).toContainText('Unprotected')
  await expect(policy).toContainText('Backups are owner-only permanently')
  await capture(
    'Tenant protection',
    'Deprotection recovered with permanent backup restriction',
    'Explicit refresh confirms unprotected current policy while the sticky owner-only archive restriction remains.',
  )

  const fixture = spawnSync(
    'bun',
    [
      '-e',
      `import { Database } from 'bun:sqlite'
const db = new Database(':memory:')
db.run("CREATE TABLE customers (tenant TEXT, person TEXT); INSERT INTO customers VALUES ('A','Ada'),('B','Bree'); CREATE TABLE orders (tenant TEXT, total INTEGER); INSERT INTO orders VALUES ('A',12),('B',34)")
process.stdout.write(db.serialize())
db.close()`,
    ],
    { windowsHide: true },
  )
  expect(fixture.status).toBe(0)
  const databaseResponse = await page.request.post(
    `${apiOrigin}/api/database-connections`,
    {
      headers: { authorization: `Bearer ${owner}` },
      multipart: {
        name: 'Tenant SQLite copy',
        file: {
          name: 'tenants.sqlite',
          mimeType: 'application/vnd.sqlite3',
          buffer: fixture.stdout,
        },
      },
    },
  )
  expect(databaseResponse.status()).toBe(200)
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
  await page
    .getByRole('option', { name: 'Tenant SQLite copy', exact: true })
    .click()
  const databasePolicy = page.getByRole('region', {
    name: 'Row protection for Tenant SQLite copy',
    exact: true,
  })
  await expect(
    databasePolicy.getByRole('heading', {
      name: 'Row protection for Tenant SQLite copy',
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await databasePolicy
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant rows only', exact: true })
    .click()
  for (const table of ['customers', 'orders']) {
    await databasePolicy
      .getByRole('combobox', {
        name: `Tenant column for ${table}`,
        exact: true,
      })
      .click()
    await page.getByRole('option', { name: 'tenant', exact: true }).click()
  }
  await databasePolicy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await capture(
    'Tenant protection',
    'Complete SQLite tenant mappings reviewed',
    'Each uploaded table receives an eligible original text column. One policy revision reviews the complete mapping and resource version.',
  )
  await databasePolicy
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Row protection updated')
  const database = (await databaseResponse.json()) as { id: string }
  const databasePolicyResponse = await page.request.get(
    `${apiOrigin}/api/database-connections/${database.id}/row-policy`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  expect(databasePolicyResponse.status()).toBe(200)
  expect(await databasePolicyResponse.json()).toMatchObject({
    mode: 'tenant',
    version: 2,
    resourceVersion: 1,
    tables: [
      { table: 'customers', column: 'tenant' },
      { table: 'orders', column: 'tenant' },
    ],
  })
  await capture(
    'Tenant protection',
    'SQLite tenant policy saved for every table',
    'A real immutable SQLite copy now has complete tenant mappings. Original uploaded bytes stay unchanged.',
  )
  const protectedAgain = await page.request.put(
    `${apiOrigin}/api/data-sources/${source.id}/row-policy`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        mode: 'tenant',
        column: 'tenant',
        version: 4,
        resourceVersion: 1,
      },
    },
  )
  expect(protectedAgain.status()).toBe(200)
  const flowResponse = await page.request.post(`${apiOrigin}/api/flows`, {
    headers: { authorization: `Bearer ${owner}` },
    data: {
      name: 'Tenant protected customers',
      method: 'GET',
      path: `/v1/tenant-customers-${crypto.randomUUID().slice(0, 8)}`,
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 40, y: 100 },
          config: {},
        },
        {
          id: 'data',
          type: 'data',
          position: { x: 340, y: 100 },
          config: { sourceId: source.id, columns: ['person'], limit: 10 },
        },
        {
          id: 'response',
          type: 'response',
          position: { x: 640, y: 100 },
          config: { status: 200, body: '$data' },
        },
      ],
      edges: [
        { id: 'read', source: 'request', target: 'data' },
        { id: 'return', source: 'data', target: 'response' },
      ],
    },
  })
  expect(flowResponse.status()).toBe(200)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page
    .locator('.api-list button')
    .filter({ hasText: 'Tenant protected customers' })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await capture(
    'API Studio',
    'Owner reviews tenant before protected draft test',
    'Owner chooses an active identity from the approved registry. Management identity is separate from API body, query and GraphQL variables.',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await expect(page.getByTestId('test-result')).toContainText('Aster')
  await expect(page.getByTestId('test-result')).not.toContainText('Bree')
  await capture(
    'API Studio',
    'Protected draft test returns assigned tenant rows only',
    'Actual source reads apply exact identity before projection. Owner test result contains only Tenant A rows.',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  const protectedFlow = (await flowResponse.json()) as {
    id: string
    path: string
  }
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Tenant A protected caller')
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant protected customers', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Release access', exact: true }),
  ).toContainText('Only this release')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const keyReview = page.getByRole('dialog', {
    name: 'Create release-pinned API key',
    exact: true,
  })
  await expect(keyReview).toContainText('Tenant A')
  await capture(
    'API keys',
    'Protected key reviews original tenant and release',
    'A protected owner-issued caller explicitly reviews its tenant and current release. Replacement never changes that original identity.',
  )
  await keyReview
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
  const runtime = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const live = await page.request.get(`${apiOrigin}/run${protectedFlow.path}`, {
    headers: { authorization: `Bearer ${runtime}` },
  })
  expect(live.status()).toBe(200)
  expect(await live.json()).toEqual([{ person: 'Ada' }, { person: 'Aster' }])
  await capture(
    'API keys',
    'Protected tenant caller issued once',
    'The one-time caller token is masked in capture. Actual live REST reads return Tenant A rows only.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const operatorRoleResponse = await page.request.post(
    `${apiOrigin}/api/roles`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: 'Tenant operator',
        permissions: [
          'flows.read',
          'flows.write',
          'flows.test',
          'runtime-keys.manage',
          'sources.read',
          'database-connections.read',
          'backups.manage',
        ],
      },
    },
  )
  expect(operatorRoleResponse.status()).toBe(200)
  const operatorRole = (await operatorRoleResponse.json()) as { id: string }
  const operatorResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: {
      name: 'Tenant A operator',
      role: 'custom',
      roleId: operatorRole.id,
      tenantId: tenantA.id,
    },
  })
  expect(operatorResponse.status()).toBe(200)
  const operator = (await operatorResponse.json()) as {
    id: string
    token: string
    tenantAssignment: { tenantId: string; version: number }
  }
  expect(operator.tenantAssignment.tenantId).toBe(tenantA.id)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateTenantDirectory = 0
  let backupMetadataReads = 0
  const observePrivateReads = (request: import('@playwright/test').Request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/tenants') privateTenantDirectory++
    if (path === '/api/backups') backupMetadataReads++
  }
  page.on('request', observePrivateReads)
  await page.getByLabel('Workspace token').fill(operator.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page
    .locator('.api-list button')
    .filter({ hasText: 'Tenant protected customers' })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Protected API tenant review',
      exact: true,
    }),
  ).toContainText('Assigned tenant: Tenant A')
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await expect(page.getByTestId('test-result')).not.toContainText('Bree')
  await capture(
    'API Studio',
    'All-mode operator uses assigned tenant without picker',
    'Even a custom member with global action grants derives its active assigned identity. No tenant registry is fetched and no caller input can pick another tenant.',
  )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await page.getByRole('combobox', { name: 'Data source', exact: true }).click()
  await expect(
    page.getByRole('option', { name: source.name, exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await capture(
    'API Studio',
    'Protected dependency inspector receives structure only',
    'A non-owner can edit the approved protected resource schema without fetching raw rows or the original file.',
  )
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click()
  await expect(
    page.getByText('Backups are owner-only permanently', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Create backup', exact: true }),
  ).toHaveCount(0)
  expect(backupMetadataReads).toBe(0)
  expect(privateTenantDirectory).toBe(0)
  await capture(
    'Data & backups',
    'Delegated backup grant cannot read protected archives',
    'Safe own tenant context explains the permanent owner-only archive boundary before any backup metadata or download is requested.',
  )
  page.off('request', observePrivateReads)
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Previous tenant caller')
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant protected customers', exact: true })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Protected API tenant review',
      exact: true,
    }),
  ).toContainText('Assigned tenant: Tenant A')
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('row').filter({ hasText: 'Tenant A protected caller' }),
  ).toHaveCount(0)
  let tenantSelectorSubmitted = false
  await page.route('**/api/runtime-keys', async (route) => {
    if (route.request().method() === 'POST')
      tenantSelectorSubmitted = Object.hasOwn(
        route.request().postDataJSON(),
        'tenantId',
      )
    await route.fallback()
  })
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Create release-pinned API key', exact: true })
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
  const operatorRuntime = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  expect(tenantSelectorSubmitted).toBe(false)
  await page.unroute('**/api/runtime-keys')
  const operatorLive = await page.request.get(
    `${apiOrigin}/run${protectedFlow.path}`,
    { headers: { authorization: `Bearer ${operatorRuntime}` } },
  )
  expect(operatorLive.status()).toBe(200)
  expect(await operatorLive.json()).toEqual([
    { person: 'Ada' },
    { person: 'Aster' },
  ])
  await capture(
    'API keys',
    'Member caller derives original assigned tenant',
    'The real protected key is pinned and linked to the original member. No tenant selector is submitted by this all-mode non-owner.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const removedIdentity = await page.request.put(
    `${apiOrigin}/api/members/${operator.id}/tenant`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: { tenantId: null, version: 1 },
    },
  )
  expect(removedIdentity.status()).toBe(200)
  expect(
    (
      await page.request.get(`${apiOrigin}/run${protectedFlow.path}`, {
        headers: { authorization: `Bearer ${operatorRuntime}` },
      })
    ).status(),
  ).toBe(403)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByLabel('Workspace token')).toBeVisible()
  await page.getByLabel('Workspace token').fill(operator.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  const historicalKey = page
    .getByRole('row')
    .filter({ hasText: 'Previous tenant caller' })
  await expect(historicalKey).toContainText('Cleanup only')
  await expect(historicalKey).not.toContainText('Original tenant: Tenant A')
  await expect(
    historicalKey.getByRole('button', { name: 'Replace key', exact: true }),
  ).toHaveCount(0)
  await expect(
    historicalKey.getByRole('button', { name: 'Revoke', exact: true }),
  ).toBeEnabled()
  await capture(
    'API keys',
    'Reassigned caller history allows cleanup without foreign label',
    'The browser session ends after actual reassignment. Relogin shows historical cleanup only, hides replacement and foreign identity labels, and permits revocation.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByLabel('Member name', { exact: true })
    .fill('Initially assigned tenant member')
  await page
    .getByRole('combobox', { name: 'New member tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  let initialTenantReview = ''
  page.once('dialog', async (dialog) => {
    initialTenantReview = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(
    page.getByLabel('New member token', { exact: true }),
  ).toBeVisible()
  expect(initialTenantReview).toContain('Tenant A')
  const initialPeopleResponse = await page.request.get(
    `${apiOrigin}/api/members`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  const initialPeople = (await initialPeopleResponse.json()) as {
    name: string
    tenantAssignment: { tenantId: string; version: number }
  }[]
  expect(
    initialPeople.find(
      (person) => person.name === 'Initially assigned tenant member',
    )?.tenantAssignment,
  ).toEqual({ tenantId: tenantA.id, version: 1 })
  await capture(
    'Members',
    'Initial member tenant reviewed and created atomically',
    'Owner reviews the active tenant before one member-creation request. The initial assignment is version1; no separate credential creation and reassignment occurs.',
  )
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  const manualRoleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers: { authorization: `Bearer ${owner}` },
    data: {
      name: 'Tenant caller manager',
      permissions: ['runtime-keys.manage'],
    },
  })
  expect(manualRoleResponse.status()).toBe(200)
  const manualRole = (await manualRoleResponse.json()) as { id: string }
  const manualMemberResponse = await page.request.post(
    `${apiOrigin}/api/members`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: 'Tenant key-only manager',
        role: 'custom',
        roleId: manualRole.id,
        tenantId: tenantA.id,
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
    },
  )
  expect(manualMemberResponse.status()).toBe(200)
  const manualMember = (await manualMemberResponse.json()) as {
    id: string
    token: string
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privateFlowReads = 0
  let privateTenantReads = 0
  const observeManualReads = (request: import('@playwright/test').Request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/flows' || /^\/api\/flows\/[^/]+$/.test(path))
      privateFlowReads++
    if (path === '/api/tenants') privateTenantReads++
  }
  page.on('request', observeManualReads)
  await page.getByLabel('Workspace token').fill(manualMember.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Account & sessions', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Known ID protected caller')
  await page.getByLabel('Known published release', { exact: true }).fill('1')
  await expect(
    page.getByRole('region', {
      name: 'Protected API tenant review',
      exact: true,
    }),
  ).toContainText('Assigned tenant: Tenant A')
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  await capture(
    'API keys',
    'Key-only manager reviews own protected identity without API read',
    'Known allowed API ID and owner-provided revision stay explicit. Only minimal row-access metadata and own context are fetched; no private flow or tenant directory read occurs.',
  )
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Create release-pinned API key', exact: true })
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
  const manualRuntime = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const manualLive = await page.request.get(
    `${apiOrigin}/run${protectedFlow.path}`,
    { headers: { authorization: `Bearer ${manualRuntime}` } },
  )
  expect(manualLive.status()).toBe(200)
  expect(await manualLive.json()).toEqual([
    { person: 'Ada' },
    { person: 'Aster' },
  ])
  expect(privateFlowReads).toBe(0)
  expect(privateTenantReads).toBe(0)
  await capture(
    'API keys',
    'No-read protected caller issued with original assigned identity',
    'Actual live REST access succeeds for the reviewed current pin while API details remain unread. The one-time token is masked.',
  )
  page.off('request', observeManualReads)
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const graphqlFlowResponse = await page.request.post(
    `${apiOrigin}/api/flows`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        ...(await flowResponse.json()),
        name: 'Tenant protected GraphQL',
        method: 'POST',
        path: `/v1/tenant-graphql-${crypto.randomUUID().slice(0, 8)}`,
        graphql: {
          schema:
            'type Customer { person: String! } type Query { rows: [Customer!]! }',
        },
      },
    },
  )
  expect(graphqlFlowResponse.status()).toBe(200)
  const graphqlFlow = (await graphqlFlowResponse.json()) as {
    id: string
    path: string
    revision: number
  }
  const publishedGraphql = await page.request.post(
    `${apiOrigin}/api/flows/${graphqlFlow.id}/publish`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: { revision: graphqlFlow.revision },
    },
  )
  expect(publishedGraphql.status()).toBe(200)
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page
    .locator('.api-list button')
    .filter({ hasText: 'Tenant protected GraphQL' })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await expect(page.getByTestId('test-result')).not.toContainText('Bree')
  await capture(
    'API Studio',
    'Protected GraphQL test keeps tenant outside variables',
    'Actual GraphQL draft execution uses the reviewed owner identity as management metadata; API variables cannot choose another tenant.',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Protected GraphQL caller')
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant protected GraphQL', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Create release-pinned API key', exact: true })
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
  const graphqlRuntime = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  const graphqlLive = await page.request.post(
    `${apiOrigin}/graphql${graphqlFlow.path}`,
    {
      headers: { authorization: `Bearer ${graphqlRuntime}` },
      data: { query: '{ rows { person } }' },
    },
  )
  expect(graphqlLive.status()).toBe(200)
  expect(await graphqlLive.json()).toEqual({
    data: { rows: [{ person: 'Ada' }, { person: 'Aster' }] },
  })
  await capture(
    'API keys',
    'Protected GraphQL caller retains tenant and query grant',
    'Actual published GraphQL execution returns only original Tenant A rows. Query grants and the release pin remain separate from tenant identity.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', {
      name: 'Tenant protected GraphQL · GraphQL',
      exact: true,
    })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page.getByRole('button', { name: 'Load settings', exact: true }).click()
  await page.getByLabel('Duration in seconds', { exact: true }).fill('1')
  await capture(
    'Load testing',
    'Owner protected load run reviews tenant and live operation',
    'Owner selects an active tenant independently of GraphQL variables before the bounded live request confirmation.',
  )
  let loadReview = ''
  page.once('dialog', async (dialog) => {
    loadReview = dialog.message()
    await dialog.accept()
  })
  const ownerLoadResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/load-tests' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Run load test', exact: true }).click()
  const ownerRunResponse = await ownerLoadResponse
  expect(ownerRunResponse.status()).toBe(202)
  const ownerRun = (await ownerRunResponse.json()) as {
    id: string
    tenantId: string
    revision: number
  }
  expect(ownerRun).toMatchObject({ tenantId: tenantA.id, revision: 1 })
  expect(loadReview).toContain('Original tenant: Tenant A')
  await expect(
    page.getByRole('region', { name: 'Load test results', exact: true }),
  ).toContainText('All limits passed', { timeout: 90_000 })
  await capture(
    'Load testing',
    'Protected owner GraphQL load run completes',
    'Actual bounded k6 requests succeed against the published tenant-protected GraphQL route. Managed credentials retain original tenant and release and are revoked on completion.',
  )
  const loadRoleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Tenant load operator', permissions: ['load-tests.run'] },
  })
  expect(loadRoleResponse.status()).toBe(200)
  const loadRole = (await loadRoleResponse.json()) as { id: string }
  const loadMemberResponse = await page.request.post(
    `${apiOrigin}/api/members`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        name: 'Tenant load-only operator',
        role: 'custom',
        roleId: loadRole.id,
        tenantId: tenantA.id,
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
    },
  )
  expect(loadMemberResponse.status()).toBe(200)
  const loadMember = (await loadMemberResponse.json()) as {
    id: string
    token: string
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  privateTenantReads = 0
  privateFlowReads = 0
  page.on('request', observeManualReads)
  await page.getByLabel('Workspace token').fill(loadMember.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await expect(
    page.getByRole('region', {
      name: 'Protected API tenant review',
      exact: true,
    }),
  ).toContainText('Assigned tenant: Tenant A')
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Load settings', exact: true }).click()
  await page.getByLabel('Duration in seconds', { exact: true }).fill('3')
  await capture(
    'Load testing',
    'Non-owner load operator derives assigned tenant',
    'No tenant picker or private API detail fetch exists, including for a load-only selected member. The live confirmation retains the original identity.',
  )
  page.once('dialog', async (dialog) => {
    loadReview = dialog.message()
    await dialog.accept()
  })
  const memberLoadResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/load-tests' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Run load test', exact: true }).click()
  const memberRunResponse = await memberLoadResponse
  expect(memberRunResponse.status()).toBe(202)
  const memberRun = (await memberRunResponse.json()) as {
    id: string
    tenantId: string
  }
  expect(memberRun.tenantId).toBe(tenantA.id)
  expect(
    Object.hasOwn(memberRunResponse.request().postDataJSON(), 'tenantId'),
  ).toBe(false)
  const managedResponse = await page.request.get(
    `${apiOrigin}/api/runtime-keys`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  const managed = (
    (await managedResponse.json()) as {
      id: string
      flowId: string
      tenantId: string
      releaseRevision: number
      managedBy?: string
      issuerBinding: { memberId: string; action: string } | null
    }[]
  ).find(
    (key) =>
      key.managedBy === 'load-test' &&
      key.issuerBinding?.memberId === loadMember.id,
  )
  expect(managed).toMatchObject({
    tenantId: tenantA.id,
    releaseRevision: 1,
    issuerBinding: { memberId: loadMember.id, action: 'load-tests.run' },
  })
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${apiOrigin}/api/audit`, {
          headers: { authorization: `Bearer ${owner}` },
        })
        const audit = (await response.json()) as {
          actor: string
          action: string
        }[]
        return audit.some(
          (event) =>
            event.actor === `runtime:${managed!.id}` &&
            event.action === 'flow.executed',
        )
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  const removeLoadTenant = await page.request.put(
    `${apiOrigin}/api/members/${loadMember.id}/tenant`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: { tenantId: null, version: 1 },
    },
  )
  expect(removeLoadTenant.status()).toBe(200)
  await expect(page.getByLabel('Workspace token')).toBeVisible({
    timeout: 10_000,
  })
  await page.getByLabel('Workspace token').fill(loadMember.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  const cleanupRun = page.getByRole('region', {
    name: 'Load test results',
    exact: true,
  })
  await expect(cleanupRun).toContainText('Cleanup only')
  await expect(cleanupRun).not.toContainText('Original tenant: Tenant A')
  await capture(
    'Load testing',
    'Reassigned load history stays available for cleanup',
    'Actual assignment loss ends the browser session and rejects subsequent runtime calls. Relogin exposes only own historical cleanup, without a foreign tenant label or retargeting picker.',
  )
  if (
    await cleanupRun
      .getByRole('button', { name: 'Cancel run', exact: true })
      .count()
  ) {
    await cleanupRun
      .getByRole('button', { name: 'Cancel run', exact: true })
      .click()
    await expect(cleanupRun).toContainText('Canceled')
  } else {
    await expect(cleanupRun).toContainText('Failed')
  }
  expect(privateFlowReads).toBe(0)
  expect(privateTenantReads).toBe(0)
  await capture(
    'Load testing',
    'Historical protected load stops without retargeting',
    'A running own historical job can be canceled; an already finished job remains failed history. Requests already sent can still have effects, and managed keys are revoked on cleanup.',
  )
  page.off('request', observeManualReads)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  const replaceTenantCaller = page
    .getByRole('row')
    .filter({ hasText: 'Tenant A protected caller' })
  await expect(replaceTenantCaller).toContainText('Original tenant: Tenant A')
  let replacementReview = ''
  page.once('dialog', async (dialog) => {
    replacementReview = dialog.message()
    await dialog.accept()
  })
  await replaceTenantCaller
    .getByRole('button', { name: 'Replace key', exact: true })
    .click()
  await expect(page.getByLabel('New API key', { exact: true })).toBeVisible()
  expect(replacementReview).toContain('Original tenant: Tenant A')
  const replacementRuntime = await page
    .getByLabel('New API key', { exact: true })
    .inputValue()
  expect(
    (
      await page.request.get(`${apiOrigin}/run${protectedFlow.path}`, {
        headers: { authorization: `Bearer ${runtime}` },
      })
    ).status(),
  ).toBe(401)
  const replacementLive = await page.request.get(
    `${apiOrigin}/run${protectedFlow.path}`,
    { headers: { authorization: `Bearer ${replacementRuntime}` } },
  )
  expect(replacementLive.status()).toBe(200)
  expect(await replacementLive.json()).toEqual([
    { person: 'Ada' },
    { person: 'Aster' },
  ])
  await capture(
    'API keys',
    'Tenant key replacement preserves original identity',
    'Reviewed replacement keeps Tenant A, permissions, release1 and expiry while revoking the original caller. Actual replacement requests retain tenant filtering.',
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await expect(page.getByText('Loading tenant protection…')).toHaveCount(0)
  await page
    .getByLabel('Tenant label', { exact: true })
    .fill('Pending reviewed identity')
  await page
    .getByLabel('Exact tenant value', { exact: true })
    .fill(`pending-${crypto.randomUUID().slice(0, 8)}`)
  await page
    .getByRole('button', { name: 'Review new tenant', exact: true })
    .click()
  let releaseCreation!: () => void
  let notifyCommitted!: () => void
  const deliveryGate = new Promise<void>((resolve) => {
    releaseCreation = resolve
  })
  const committed = new Promise<void>((resolve) => {
    notifyCommitted = resolve
  })
  await page.route('**/api/tenants', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}/api/tenants`,
    })
    expect(response.status()).toBe(200)
    notifyCommitted()
    await deliveryGate
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Create tenant', exact: true }).click()
  await committed
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Members', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByLabel('Exact tenant value', { exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Tenant creation pending blocks duplicate and navigation',
    'The actual reviewed identity is committed while delivery is delayed. Global navigation, sign-out and mutation inputs remain disabled until receipt.',
  )
  releaseCreation()
  await expect(page.getByRole('status')).toContainText('Tenant created')
  await page.unroute('**/api/tenants')
  await page
    .getByLabel('Tenant label', { exact: true })
    .fill('Unconfirmed saved identity')
  const unconfirmedValue = `unconfirmed-${crypto.randomUUID().slice(0, 8)}`
  await page
    .getByLabel('Exact tenant value', { exact: true })
    .fill(unconfirmedValue)
  await page
    .getByRole('button', { name: 'Review new tenant', exact: true })
    .click()
  await page.route('**/api/tenants', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch({
      url: `${apiOrigin || new URL(route.request().url()).origin}/api/tenants`,
    })
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Create tenant', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Could not confirm whether the tenant was created',
  )
  await expect(
    page.getByRole('button', { name: 'Review new tenant', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Lost tenant creation requires registry refresh',
    'A real committed identity loses its response. Inputs remain preserved and no duplicate creation is allowed before explicit current-registry refresh.',
  )
  await page.unroute('**/api/tenants')
  await page
    .getByRole('button', { name: 'Refresh tenant registry', exact: true })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Tenant Unconfirmed saved identity',
      exact: true,
    }),
  ).toBeVisible()
  await capture(
    'Tenant protection',
    'Lost identity receipt recovered from current registry',
    'Explicit real registry retrieval confirms the approved immutable identity. The UI never assumes that lost delivery means the write failed.',
  )
  await page.getByLabel('Tenant label', { exact: true }).fill('')
  await page.getByLabel('Exact tenant value', { exact: true }).fill('')
  await page
    .getByRole('button', {
      name: 'Edit tenant Pending reviewed identity',
      exact: true,
    })
    .click()
  const registryEditor = page.getByRole('region', {
    name: 'Edit tenant Pending reviewed identity',
    exact: true,
  })
  await registryEditor
    .getByLabel('Tenant label', { exact: true })
    .fill('Locally proposed label')
  await registryEditor
    .getByRole('button', { name: 'Review tenant changes', exact: true })
    .click()
  const currentRegistryResponse = await page.request.get(
    `${apiOrigin}/api/tenants`,
    { headers: { authorization: `Bearer ${owner}` } },
  )
  const currentRegistry = (await currentRegistryResponse.json()) as {
    id: string
    label: string
    version: number
  }[]
  const peerIdentity = currentRegistry.find(
    (tenant) => tenant.label === 'Pending reviewed identity',
  )!
  const peerRename = await page.request.put(
    `${apiOrigin}/api/tenants/${peerIdentity.id}`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        label: 'Peer approved label',
        state: 'active',
        version: peerIdentity.version,
      },
    },
  )
  expect(peerRename.status()).toBe(200)
  await registryEditor
    .getByRole('button', { name: 'Confirm tenant changes', exact: true })
    .click()
  await expect(registryEditor.getByRole('alert')).toContainText(
    'Refresh tenant',
  )
  await expect(
    registryEditor.getByRole('button', {
      name: 'Review tenant changes',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Stale registry edit preserves proposed label',
    'A real concurrent version update rejects the old review. The proposed label stays visible and cannot be resubmitted without current identity refresh.',
  )
  await registryEditor
    .getByRole('button', { name: 'Refresh tenant', exact: true })
    .click()
  const refreshedEditor = page.getByRole('region', {
    name: 'Edit tenant Peer approved label',
    exact: true,
  })
  await expect(
    refreshedEditor.getByLabel('Tenant label', { exact: true }),
  ).toHaveValue('Peer approved label')
  await capture(
    'Tenant protection',
    'Registry version recovery adopts current approved label',
    'Only explicit refresh adopts the peer-approved label and version. The exact tenant value remains immutable.',
  )
  await refreshedEditor
    .getByRole('button', { name: 'Close tenant editor', exact: true })
    .click()

  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  await appearance('Light')
  await capture(
    'Tenant protection',
    'Tenant registry and protection forms light',
    'Owner-only exact identity registry and policy choices stay readable in light appearance.',
  )
  await appearance('Dark')
  await capture(
    'Tenant protection',
    'Tenant registry and protection forms dark',
    'Dark appearance preserves form labels, version summaries, error boundaries and review controls.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  const longTenantLabel = 'Tenant' + 'W'.repeat(74)
  const longTenantValue = 'T'.repeat(128)
  const longTenantResponse = await page.request.post(
    `${apiOrigin}/api/tenants`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: {
        label: longTenantLabel,
        value: longTenantValue,
      },
    },
  )
  expect(longTenantResponse.status()).toBe(200)
  expect((await longTenantResponse.json()).label).toBe(longTenantLabel)
  await page
    .getByRole('button', { name: 'Refresh tenant registry', exact: true })
    .click()
  const longTenantButton = page.getByRole('button', {
    name: `Edit tenant ${longTenantLabel}`,
    exact: true,
  })
  await expect(longTenantButton).toBeEnabled()
  async function expectTextContained(control: Locator) {
    const glyphsContained = await control.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = text.nextNode())) {
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const glyphBounds of range.getClientRects()) {
          if (
            glyphBounds.left < bounds.left - 1 ||
            glyphBounds.right > bounds.right + 1 ||
            glyphBounds.top < bounds.top - 1 ||
            glyphBounds.bottom > bounds.bottom + 1
          )
            return false
        }
      }
      return true
    })
    expect(glyphsContained, 'The complete tenant label fits its control').toBe(
      true,
    )
  }
  async function expectTenantLabelContained() {
    await expect(longTenantButton).toHaveText(`Edit tenant ${longTenantLabel}`)
    await expectTextContained(longTenantButton)
    await expectTextContained(
      page
        .getByRole('region', { name: `Tenant ${longTenantLabel}`, exact: true })
        .getByRole('heading', { level: 3 }),
    )
    const exactValue = page
      .getByRole('region', { name: `Tenant ${longTenantLabel}`, exact: true })
      .locator('code')
    await expect(exactValue).toHaveText(longTenantValue)
    await expectTextContained(exactValue)
  }
  await expectTenantLabelContained()
  await capture(
    'Tenant protection',
    'Full eighty-character tenant edit label dark phone',
    'Every text glyph stays inside its semantic Edit button at390px. The legal full label stays available without truncation.',
  )
  await capture(
    'Tenant protection',
    'Tenant registry and protection forms dark phone',
    'The long owner registry remains contained at390px; custom selectors, exact values and review controls stay readable.',
  )
  await appearance('Light')
  await expectTenantLabelContained()
  await capture(
    'Tenant protection',
    'Full eighty-character tenant edit label light phone',
    'The same complete accessible tenant label wraps inside its light phone control; no significant name is hidden.',
  )
  await capture(
    'Tenant protection',
    'Tenant registry and protection forms light phone',
    'The same owner registry and row-policy choices fit a narrow light phone viewport.',
  )
  await longTenantButton.click()
  const longTenantEditor = page.getByRole('region', {
    name: `Edit tenant ${longTenantLabel}`,
    exact: true,
  })
  const longTenantHeading = longTenantEditor.getByRole('heading', {
    name: `Edit tenant ${longTenantLabel}`,
    exact: true,
  })
  await expect(longTenantHeading).toBeFocused()
  await expectTextContained(longTenantHeading)
  await longTenantEditor
    .getByRole('button', { name: 'Close tenant editor', exact: true })
    .click()
  await expect(longTenantButton).toBeFocused()
  await appearance('System')
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await capture(
    'Tenant protection',
    'Tenant protection system dark and reduced motion phone',
    'System appearance follows the dark preference and reduced-motion setting without storing credentials.',
  )
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await capture(
    'Tenant protection',
    'Tenant protection system light phone',
    'Changing system appearance updates the same accessible forms at390px.',
  )
  await appearance('Light')
  await page
    .getByRole('combobox', { name: 'Resource type', exact: true })
    .click()
  await page.getByRole('option', { name: 'SQLite copy', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant SQLite copy', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Row protection for Tenant SQLite copy',
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await capture(
    'Tenant protection',
    'Complete SQLite tenant mappings light phone',
    'Every table mapping and immutable-copy policy version remain available on a narrow phone with guarded initial focus.',
  )
  await appearance('Dark')
  await capture(
    'Tenant protection',
    'Complete SQLite tenant mappings dark phone',
    'Dark phone view keeps original-text eligibility and complete table mapping controls readable.',
  )
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByRole('button', {
      name: `Manage tenant for ${memberName}`,
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('heading', {
      name: `Tenant assignment for ${memberName}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await capture(
    'Members',
    'Reviewed member tenant assignment dark phone',
    'A lower member row opens its focused versioned assignment editor in the phone viewport; no test-side scrolling hides discoverability.',
  )
  await appearance('Light')
  await capture(
    'Members',
    'Reviewed member tenant assignment light phone',
    'Member assignment label, active tenant selection and existing-caller warning remain contained and readable.',
  )
  await page
    .getByRole('button', { name: 'Close tenant assignment', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: source.name, exact: true }).click()
  const phoneSourcePolicy = page.getByRole('region', {
    name: `Row protection for ${source.name}`,
    exact: true,
  })
  await expect(
    phoneSourcePolicy.getByRole('heading', {
      name: `Row protection for ${source.name}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await capture(
    'Tenant protection',
    'Original spreadsheet tenant column light phone',
    'The source policy exposes eligible original text rather than treating normalized business types as identity proof.',
  )
  await appearance('Dark')
  await phoneSourcePolicy
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await phoneSourcePolicy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(
    phoneSourcePolicy.getByRole('button', {
      name: 'Confirm row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Raw exposure review stays mandatory on dark phone',
    'The original protected resource remains unchanged. Removing protection still requires the explicit raw-exposure acknowledgment in a narrow viewport.',
  )
  await phoneSourcePolicy
    .getByRole('button', { name: 'Cancel row protection review', exact: true })
    .click()
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Tenant protected GraphQL',
  )
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expect
    .poll(() =>
      page.locator('.canvas').evaluate((canvas) => {
        const bounds = canvas.getBoundingClientRect()
        const nodes = [...canvas.querySelectorAll('.react-flow__node')]
        return (
          nodes.length === 3 &&
          nodes.every((node) => {
            const box = node.getBoundingClientRect()
            return (
              box.left >= bounds.left &&
              box.right <= bounds.right &&
              box.top >= bounds.top &&
              box.bottom <= bounds.bottom
            )
          })
        )
      }),
    )
    .toBe(true)
  await capture(
    'API Studio',
    'Protected draft tenant review dark phone with complete graph',
    'All three public node bounds fit after the phone viewport change. Owner identity remains separate from GraphQL input fields.',
  )
  await appearance('Light')
  await capture(
    'API Studio',
    'Protected draft tenant review light phone',
    'The same contained graph and reviewed identity remain readable in light appearance.',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Phone protected review')
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Tenant protected GraphQL', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const phoneKeyDialog = page.getByRole('dialog', {
    name: 'Create release-pinned API key',
    exact: true,
  })
  await expect(phoneKeyDialog).toContainText('Original tenant:')
  await capture(
    'API keys',
    'Protected key review light phone',
    'The real custom dialog reviews original tenant, current pin, operation grant and expiry without issuing another credential.',
  )
  await phoneKeyDialog
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await appearance('Dark')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  await capture(
    'API keys',
    'Protected key review dark phone',
    'Dark phone confirmation preserves readable original-identity and release-pin requirements.',
  )
  await phoneKeyDialog
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Published API', exact: true })
    .click()
  await page
    .getByRole('option', {
      name: 'Tenant protected GraphQL · GraphQL',
      exact: true,
    })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: 'Tenant A', exact: true }).click()
  await capture(
    'Load testing',
    'Protected live load tenant review dark phone',
    'The protected owner selector, typed GraphQL request and completed original-tenant history remain readable without starting another run.',
  )
  await appearance('Light')
  await capture(
    'Load testing',
    'Protected live load tenant review light phone',
    'The same bounded live action remains separate from API variables and holds the owner-selected tenant review.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token').fill(loadMember.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Load testing', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Load test results', exact: true }),
  ).toContainText('Cleanup only')
  await capture(
    'Load testing',
    'Historical member load cleanup light phone',
    'Own cleanup-only history remains accessible after reassignment, with no arbitrary tenant selector or foreign tenant label.',
  )
  await appearance('Dark')
  await capture(
    'Load testing',
    'Historical member load cleanup dark phone',
    'Dark phone view preserves cleanup status, bounded cancellation explanation and hidden foreign labels.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await appearance('Light')
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: null })
}
