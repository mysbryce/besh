import { expect, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function fieldAccessPreviews({
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
  const identityValue = `Field.Owner.${crypto.randomUUID().slice(0, 8)}`
  const identityResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
    headers,
    data: { label: 'Field read review identity', value: identityValue },
  })
  expect(identityResponse.status()).toBe(200)
  const identity = (await identityResponse.json()) as { id: string }
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Protected field review ${crypto.randomUUID().slice(0, 8)}`,
        file: {
          name: 'field-access.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            `tenant,person,email\n${identityValue},Ada,ada@example.test\nB,Bree,bree@example.test\n`,
          ),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)
  const source = (await imported.json()) as { id: string; name: string }
  const url = `${apiOrigin}/api/data-sources/${source.id}/row-policy`
  const read = await page.request.get(url, { headers })
  expect(read.status()).toBe(200)
  const current = (await read.json()) as {
    version: number
    resourceVersion: number
  }
  const protectedResponse = await page.request.put(url, {
    headers,
    data: {
      mode: 'tenant',
      column: 'tenant',
      version: current.version,
      resourceVersion: current.resourceVersion,
    },
  })
  expect(protectedResponse.status()).toBe(200)
  async function readFlow(columns: string[]) {
    const created = await page.request.post(`${apiOrigin}/api/flows`, {
      headers,
      data: {
        name: `Field-reviewed ${columns.join(' and ')}`,
        method: 'GET',
        path: `/v1/field-review-${crypto.randomUUID().slice(0, 8)}`,
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
    expect(created.status()).toBe(200)
    return (await created.json()) as {
      id: string
      revision: number
      path: string
    }
  }
  const publishedRead = await readFlow(['person', 'email'])
  const permittedRead = await readFlow(['person'])
  const published = await page.request.post(
    `${apiOrigin}/api/flows/${publishedRead.id}/publish`,
    {
      headers,
      data: { revision: publishedRead.revision },
    },
  )
  expect(published.status()).toBe(200)
  const keyResponse = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
    headers,
    data: {
      name: 'Field protection caller',
      flowId: publishedRead.id,
      permissions: ['rest'],
      releaseRevision: 1,
      tenantId: identity.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  })
  expect(keyResponse.status()).toBe(200)
  const caller = (await keyResponse.json()) as { id: string; token: string }
  const callRead = () =>
    page.request.get(`${apiOrigin}/run${publishedRead.path}`, {
      headers: { authorization: `Bearer ${caller.token}` },
    })
  const originalRows = await callRead()
  expect(originalRows.status()).toBe(200)
  expect(await originalRows.json()).toEqual([
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
  await expect(
    policy.getByRole('combobox', { name: 'API field access', exact: true }),
  ).toContainText('All fields')
  await capture(
    'Tenant protection',
    'Protected API fields default to all',
    'Owner reviews resource-wide API field access separately from the private tenant predicate.',
  )
  await policy
    .getByRole('combobox', { name: 'API field access', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Selected fields', exact: true })
    .click()
  await expect(policy).toContainText('No API fields shared')
  await capture(
    'Tenant protection',
    'Selected source fields start with none',
    'An empty selection is explicit. It never silently becomes All fields.',
  )
  await policy
    .getByRole('checkbox', { name: 'Allow API field person', exact: true })
    .click()
  await capture(
    'Tenant protection',
    'Choose source API fields',
    'Only person is selected. The private tenant predicate is separate from permission to return or filter its column.',
  )
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  const review = policy.getByRole('region', {
    name: 'Review row protection',
    exact: true,
  })
  await expect(review).toContainText('API fields: person')
  await expect(review).toContainText('Existing API projections and filters')
  await capture(
    'Tenant protection',
    'Review restricted source API fields',
    'The owner reviews the exact human field names, resource version, policy version and effect on existing projections, filters and releases.',
  )
  await review
    .getByRole('button', { name: 'Cancel row protection review', exact: true })
    .click()
  await expect(
    policy.getByRole('checkbox', {
      name: 'Allow API field person',
      exact: true,
    }),
  ).toBeChecked()
  await capture(
    'Tenant protection',
    'Cancel field review preserves choices',
    'Cancel performs no mutation and leaves the owner’s selected fields available for a fresh review.',
  )
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('Row protection updated')
  const saved = await page.request.get(url, { headers })
  expect(saved.status()).toBe(200)
  expect((await saved.json()).fields).toEqual({
    mode: 'selected',
    columns: ['person'],
  })
  const blockedRows = await callRead()
  expect(blockedRows.status()).toBe(403)
  expect(await blockedRows.text()).not.toContain('ada@example.test')
  const allowedRows = await page.request.post(
    `${apiOrigin}/api/flows/${permittedRead.id}/test`,
    {
      headers,
      data: { body: null, query: {}, tenantId: identity.id },
    },
  )
  expect(allowedRows.status()).toBe(200)
  expect((await allowedRows.json()).body).toEqual([{ person: 'Ada' }])
  await capture(
    'Tenant protection',
    'Source API field restriction saved',
    'Real policy GET confirms person only. A still-valid pinned API projecting email is denied without partial output; the permitted owner draft still returns person using its private tenant predicate.',
  )
  await policy
    .getByRole('checkbox', { name: 'Allow API field person', exact: true })
    .click()
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(review).toContainText('No API fields shared')
  await expect(
    review.getByRole('button', { name: 'Confirm row protection', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'No source API fields requires review',
    'An empty list denies reads of this protected source. Saving requires a separate acknowledgment.',
  )
  await review
    .getByRole('checkbox', {
      name: 'I understand empty field selections block their API reads',
      exact: true,
    })
    .click()
  await capture(
    'Tenant protection',
    'Approve empty source field selection',
    'The owner explicitly accepts blocking reads that use an empty selection; this does not delete resource rows or hide schema names.',
  )
  const emptyResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${source.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await review
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  expect((await emptyResponse).status()).toBe(200)
  const empty = await page.request.get(url, { headers })
  expect(empty.status()).toBe(200)
  expect((await empty.json()).fields).toEqual({
    mode: 'selected',
    columns: [],
  })
  const emptyRead = await page.request.post(
    `${apiOrigin}/api/flows/${permittedRead.id}/test`,
    {
      headers,
      data: { body: null, query: {}, tenantId: identity.id },
    },
  )
  expect(emptyRead.status()).toBe(403)
  await capture(
    'Tenant protection',
    'Empty API fields saved without substitution',
    'The actual policy stores selected with an empty array. Even the otherwise permitted owner draft is denied.',
  )
  await policy
    .getByRole('combobox', { name: 'API field access', exact: true })
    .click()
  await page.getByRole('option', { name: 'All fields', exact: true }).click()
  await policy
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(
    review.getByRole('button', { name: 'Confirm row protection', exact: true }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Widening API fields requires approval',
    'All fields restores every current and future column only after explicit owner acknowledgment.',
  )
  await review
    .getByRole('checkbox', {
      name: 'I understand APIs may expose more fields',
      exact: true,
    })
    .click()
  await capture(
    'Tenant protection',
    'Owner approves wider API field access',
    'The reviewed widening includes future columns. Tenant row protection remains enabled.',
  )
  const widenedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${source.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await review
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  expect((await widenedResponse).status()).toBe(200)
  const widened = await page.request.get(url, { headers })
  expect(widened.status()).toBe(200)
  expect((await widened.json()).fields).toEqual({ mode: 'all', columns: [] })
  const restoredRead = await callRead()
  expect(restoredRead.status()).toBe(200)
  expect(await restoredRead.json()).toEqual([
    { person: 'Ada', email: 'ada@example.test' },
  ])
  await capture(
    'Tenant protection',
    'All API fields restored explicitly',
    'The unchanged pinned published API succeeds again after the reviewed live policy widening; no archive was executed or schema rewritten.',
  )
  const sqlite = spawnSync(
    'bun',
    [
      '-e',
      `
      import { Database } from 'bun:sqlite'
      const database = new Database(':memory:')
      database.run('CREATE TABLE customers (tenant TEXT, person TEXT, email TEXT)')
      database.run("INSERT INTO customers VALUES ('A','Ada','ada@example.test')")
      database.run('CREATE TABLE invoices (tenant TEXT, total INTEGER)')
      database.run("INSERT INTO invoices VALUES ('A',42)")
      process.stdout.write(Buffer.from(database.serialize()).toString('base64'))
      database.close()
    `,
    ],
    { encoding: 'utf8', timeout: 10_000, windowsHide: true },
  )
  expect(sqlite.status).toBe(0)
  const uploaded = await page.request.post(
    `${apiOrigin}/api/database-connections`,
    {
      headers,
      multipart: {
        name: `Protected fields SQLite ${crypto.randomUUID().slice(0, 8)}`,
        file: {
          name: 'field-access.sqlite',
          mimeType: 'application/vnd.sqlite3',
          buffer: Buffer.from(sqlite.stdout.trim(), 'base64'),
        },
      },
    },
  )
  expect(uploaded.status()).toBe(200)
  const database = (await uploaded.json()) as { id: string; name: string }
  const databaseUrl = `${apiOrigin}/api/database-connections/${database.id}/row-policy`
  const databaseRead = await page.request.get(databaseUrl, { headers })
  expect(databaseRead.status()).toBe(200)
  const databasePolicy = (await databaseRead.json()) as {
    version: number
    resourceVersion: number
  }
  const databaseProtected = await page.request.put(databaseUrl, {
    headers,
    data: {
      mode: 'tenant',
      version: databasePolicy.version,
      resourceVersion: databasePolicy.resourceVersion,
      tables: [
        { table: 'customers', column: 'tenant' },
        { table: 'invoices', column: 'tenant' },
      ],
    },
  })
  expect(databaseProtected.status()).toBe(200)
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
  await page.getByRole('option', { name: database.name, exact: true }).click()
  const databaseEditor = page.getByRole('region', {
    name: `Row protection for ${database.name}`,
    exact: true,
  })
  await expect(
    databaseEditor.getByRole('combobox', {
      name: 'API field access for customers',
      exact: true,
    }),
  ).toContainText('All fields')
  await expect(
    databaseEditor.getByRole('heading', {
      name: `Row protection for ${database.name}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await capture(
    'Tenant protection',
    'SQLite API fields default independently',
    'Each inspected table has its own All fields selection inside one reviewed resource policy.',
  )
  await databaseEditor
    .getByRole('combobox', {
      name: 'API field access for customers',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Selected fields', exact: true })
    .click()
  await databaseEditor
    .getByRole('checkbox', { name: 'Allow API field person', exact: true })
    .click()
  await capture(
    'Tenant protection',
    'Select SQLite fields for one table',
    'Customers permits person while invoices remains All fields. No SQL or JSON editor is needed.',
  )
  await databaseEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  const databaseReview = databaseEditor.getByRole('region', {
    name: 'Review row protection',
    exact: true,
  })
  await expect(databaseReview).toContainText('customers')
  await expect(databaseReview).toContainText('invoices')
  await expect(databaseReview).toContainText('API fields: person')
  await expect(databaseReview).toContainText(
    'All fields, including future columns',
  )
  await capture(
    'Tenant protection',
    'Review complete SQLite field selections',
    'The review distinguishes customers and invoices alongside their tenant mappings and shared policy/resource versions.',
  )
  const tableSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${database.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await databaseReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  expect((await tableSaved).status()).toBe(200)
  const tables = await page.request.get(databaseUrl, { headers })
  expect(tables.status()).toBe(200)
  expect((await tables.json()).tables).toEqual([
    expect.objectContaining({
      table: 'customers',
      fields: { mode: 'selected', columns: ['person'] },
    }),
    expect.objectContaining({
      table: 'invoices',
      fields: { mode: 'all', columns: [] },
    }),
  ])
  await capture(
    'Tenant protection',
    'Independent SQLite API fields saved',
    'Actual per-table metadata confirms selected person for customers and All fields for invoices.',
  )
  await appearance('Dark')
  await capture(
    'Tenant protection',
    'Dark SQLite table field controls',
    'Separate table selectors, original column labels and common policy versions remain readable in dark appearance.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile dark',
    'Phone SQLite per-table API fields',
    'Customers keeps person selected while invoices keeps All fields. Both complete table controls stack within the390px viewport.',
  )
  await appearance('Light')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await capture(
    'Mobile',
    'Light phone SQLite field choices',
    'The same per-table policy controls retain full labels and keyboard-accessible custom selectors in light appearance.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await databaseEditor
    .getByRole('combobox', {
      name: 'API field access for invoices',
      exact: true,
    })
    .click()
  await page
    .getByRole('option', { name: 'Selected fields', exact: true })
    .click()
  await databaseEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(
    databaseReview.getByRole('button', {
      name: 'Confirm row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(databaseReview).toContainText(
    'Protected reads using an empty selection stop',
  )
  await capture(
    'Tenant protection',
    'Empty SQLite table fields require approval',
    'Only reads using the empty invoices selection are blocked; the reviewed customers selection remains separate.',
  )
  await databaseReview
    .getByRole('checkbox', {
      name: 'I understand empty field selections block their API reads',
      exact: true,
    })
    .click()
  const emptyTableResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${database.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await databaseReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  expect((await emptyTableResponse).status()).toBe(200)
  await capture(
    'Tenant protection',
    'No API fields shared for one SQLite table',
    'The real policy retains customer fields and explicitly stores an empty invoice selection.',
  )
  await databaseEditor
    .getByRole('combobox', { name: 'Row protection mode', exact: true })
    .click()
  await page.getByRole('option', { name: 'Unprotected', exact: true }).click()
  await databaseEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await capture(
    'Tenant protection',
    'Review deprotection with retained fields',
    'Removing row protection may expose raw rows through delegated resource access. Stored API field selections become inactive and backups remain owner-only.',
  )
  await databaseReview
    .getByRole('checkbox', {
      name: 'I understand delegated access may expose all rows',
      exact: true,
    })
    .click()
  const dormantResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/database-connections/${database.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await databaseReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  const dormant = await dormantResponse
  expect(dormant.status()).toBe(200)
  expect(dormant.request().postDataJSON()).toEqual({
    mode: 'unprotected',
    version: 4,
    resourceVersion: 1,
  })
  const dormantPolicy = await page.request.get(databaseUrl, { headers })
  expect((await dormantPolicy.json()).tables).toEqual([
    expect.objectContaining({
      table: 'customers',
      fields: { mode: 'selected', columns: ['person'] },
    }),
    expect.objectContaining({
      table: 'invoices',
      fields: { mode: 'selected', columns: [] },
    }),
  ])
  await expect(databaseEditor).toContainText('Inactive API field selection')
  await expect(databaseEditor).toContainText('API fields: person')
  await expect(databaseEditor).toContainText('No API fields shared')
  await capture(
    'Tenant protection',
    'Inactive API field selections retained',
    'The unprotected PUT contains no field changes. Actual metadata retains selected person and the empty invoice selection; the inactive summary remains visible.',
  )
  const friendlyImport = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Human field labels ${crypto.randomUUID().slice(0, 8)}`,
        file: {
          name: 'human-fields.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('tenant,Customer full name\nA,Ada\n'),
        },
      },
    },
  )
  expect(friendlyImport.status()).toBe(200)
  const friendly = (await friendlyImport.json()) as { id: string; name: string }
  const friendlyUrl = `${apiOrigin}/api/data-sources/${friendly.id}/row-policy`
  const friendlyGet = await page.request.get(friendlyUrl, { headers })
  expect(friendlyGet.status()).toBe(200)
  const friendlyPolicy = await friendlyGet.json()
  const friendlyProtected = await page.request.put(friendlyUrl, {
    headers,
    data: {
      mode: 'tenant',
      column: 'tenant',
      version: friendlyPolicy.version,
      resourceVersion: friendlyPolicy.resourceVersion,
    },
  })
  expect(friendlyProtected.status()).toBe(200)
  await page
    .getByRole('button', { name: 'Refresh resources', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Resource type', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Spreadsheet source', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: friendly.name, exact: true }).click()
  const friendlyEditor = page.getByRole('region', {
    name: `Row protection for ${friendly.name}`,
    exact: true,
  })
  await friendlyEditor
    .getByRole('combobox', { name: 'API field access', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Selected fields', exact: true })
    .click()
  await friendlyEditor
    .getByRole('checkbox', {
      name: 'Allow API field Customer full name',
      exact: true,
    })
    .click()
  await friendlyEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(
    friendlyEditor.getByRole('region', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toContainText('API fields: Customer full name')
  await capture(
    'Tenant protection',
    'Human field labels preserved in review',
    'The selected imported Customer full name appears in full with its API key, rather than replacing its human label with a normalized identifier.',
  )
  const friendlyReview = friendlyEditor.getByRole('region', {
    name: 'Review row protection',
    exact: true,
  })
  const peerUpdate = await page.request.put(friendlyUrl, {
    headers,
    data: {
      mode: 'tenant',
      column: 'tenant',
      version: 2,
      resourceVersion: 1,
      fields: { mode: 'selected', columns: [] },
    },
  })
  expect(peerUpdate.status()).toBe(200)
  const staleResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${friendly.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await friendlyReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  expect((await staleResponse).status()).toBe(409)
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(friendlyEditor).toContainText(
    'Refresh row policy and review before trying again',
  )
  await expect(
    friendlyEditor.getByRole('checkbox', {
      name: 'Allow API field Customer full name',
      exact: true,
    }),
  ).toBeChecked()
  await capture(
    'Tenant protection',
    'Stale field review preserves local choices',
    'A real peer policy update rejects the reviewed old version. Local checkbox intent stays visible but cannot be submitted until explicit Refresh.',
  )
  await friendlyEditor
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    friendlyEditor.getByRole('checkbox', {
      name: 'Allow API field Customer full name',
      exact: true,
    }),
  ).not.toBeChecked()
  await friendlyEditor
    .getByRole('button', { name: 'Review details', exact: true })
    .click()
  await expect(friendlyEditor).toContainText('Policy version 3')
  await capture(
    'Tenant protection',
    'Refresh adopts current field policy',
    'Only explicit Refresh replaces the stale selection with the peer’s actual empty policy at version3.',
  )

  await friendlyEditor
    .getByRole('checkbox', {
      name: 'Allow API field Customer full name',
      exact: true,
    })
    .click()
  await friendlyEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await friendlyReview
    .getByRole('checkbox', {
      name: 'I understand APIs may expose more fields',
      exact: true,
    })
    .click()
  const friendlyRoute = `**/api/data-sources/${friendly.id}/row-policy`
  await page.route(friendlyRoute, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const response = await route.fetch({
      url: friendlyUrl || route.request().url(),
    })
    expect(response.status()).toBe(200)
    await route.abort('failed')
  })
  await friendlyReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await expect(friendlyEditor).toContainText(
    'Could not confirm whether row protection was saved',
  )
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  const actualSaved = await page.request.get(friendlyUrl, { headers })
  expect(actualSaved.status()).toBe(200)
  expect(await actualSaved.json()).toMatchObject({
    version: 4,
    fields: { mode: 'selected', columns: ['customer_full_name'] },
  })
  await capture(
    'Tenant protection',
    'Lost field save outcome remains unconfirmed',
    'The actual PUT committed but its response was dropped. The UI does not claim failure as fact and blocks review until current policy is refreshed.',
  )
  await page.unroute(friendlyRoute)
  await friendlyEditor
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    friendlyEditor.getByRole('checkbox', {
      name: 'Allow API field Customer full name',
      exact: true,
    }),
  ).toBeChecked()
  await expect(friendlyEditor).toContainText('Policy version 4')
  await capture(
    'Tenant protection',
    'Refresh confirms committed field save',
    'Current real metadata restores Customer full name at version4 and clears the uncertain delivery state.',
  )
  await friendlyEditor
    .getByRole('checkbox', { name: 'Allow API field tenant', exact: true })
    .click()
  await friendlyEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await friendlyReview
    .getByRole('checkbox', {
      name: 'I understand APIs may expose more fields',
      exact: true,
    })
    .click()
  let releasePending!: () => void
  let observeCommit!: () => void
  const delayedDelivery = new Promise<void>((resolve) => {
    releasePending = resolve
  })
  const pendingCommitted = new Promise<void>((resolve) => {
    observeCommit = resolve
  })
  await page.route(friendlyRoute, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const response = await route.fetch({ url: friendlyUrl })
    expect(response.status()).toBe(200)
    observeCommit()
    await delayedDelivery
    await route.fulfill({ response })
  })
  const pendingResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${friendly.id}/row-policy` &&
      response.request().method() === 'PUT',
  )
  await friendlyReview
    .getByRole('button', { name: 'Confirm row protection', exact: true })
    .click()
  await pendingCommitted
  await expect(
    friendlyReview.getByRole('button', {
      name: 'Confirm row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Field save pending blocks navigation',
    'A real committed PUT response is held at the transport boundary. Duplicate saves, Refresh, workspace navigation and sign-out remain disabled until delivery completes.',
  )
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeDisabled()
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Refresh row policy',
      exact: true,
    }),
  ).toBeDisabled()
  releasePending()
  expect((await pendingResponse).status()).toBe(200)
  await expect(friendlyReview).toHaveCount(0)
  await page.unroute(friendlyRoute)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeEnabled()
  const pendingSaved = await page.request.get(friendlyUrl, { headers })
  expect(await pendingSaved.json()).toMatchObject({
    version: 5,
    fields: { mode: 'selected', columns: ['customer_full_name', 'tenant'] },
  })
  await capture(
    'Tenant protection',
    'Reviewed field widening delivered',
    'The real version5 policy includes the human name and explicitly selected tenant field, with pending navigation guards released.',
  )

  await page.route(friendlyRoute, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.abort('failed')
  })
  await friendlyEditor
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(friendlyEditor.getByRole('alert')).toContainText(
    'Refresh row policy before saving',
  )
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeDisabled()
  await capture(
    'Tenant protection',
    'Field policy read failure keeps saving blocked',
    'A failed metadata delivery leaves the last selection visible but unknown; no initial or automatic retry grants save admission.',
  )
  await page.unroute(friendlyRoute)
  await friendlyEditor
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await expect(
    friendlyEditor.getByRole('button', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(friendlyEditor.getByRole('alert')).toHaveCount(0)
  await capture(
    'Tenant protection',
    'Explicit field policy retry recovers current metadata',
    'Only successful explicit Refresh clears the read error and re-enables current reviewed policy changes.',
  )

  let releaseRead!: () => void
  let observeRead!: () => void
  const heldRead = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  const readStarted = new Promise<void>((resolve) => {
    observeRead = resolve
  })
  await page.route(friendlyRoute, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch({ url: friendlyUrl })
    expect(response.status()).toBe(200)
    observeRead()
    await heldRead
    await route.fulfill({ response })
  })
  await friendlyEditor
    .getByRole('button', { name: 'Refresh row policy', exact: true })
    .click()
  await readStarted
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /^API Studio\b/ }),
  ).toBeVisible()
  const currentStatus = await page.getByRole('status').textContent()
  const lateDelivery = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/data-sources/${friendly.id}/row-policy` &&
      response.request().method() === 'GET',
  )
  releaseRead()
  expect((await lateDelivery).status()).toBe(200)
  await expect(friendlyEditor).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText(currentStatus ?? '')
  await page.unroute(friendlyRoute)
  await capture(
    'Tenant protection',
    'Late field metadata cannot replace another page',
    'A real delayed policy read arrives after leaving the editor. The old component remains unmounted and cannot overwrite the current page or announce stale recovery.',
  )

  const longHeader = 'Customer' + 'W'.repeat(72)
  const longImported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Long field labels ${crypto.randomUUID().slice(0, 8)}`,
        file: {
          name: 'long-field-labels.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(`tenant,${longHeader},ชื่อเต็ม\nA,Ada,Ada\n`),
        },
      },
    },
  )
  expect(longImported.status()).toBe(200)
  const longSource = (await longImported.json()) as {
    id: string
    name: string
    columns: { key: string; label: string }[]
  }
  const longKey = longSource.columns.find(
    (column) => column.label === longHeader,
  )?.key
  expect(longKey).toBeTruthy()
  const longUrl = `${apiOrigin}/api/data-sources/${longSource.id}/row-policy`
  const longRead = await page.request.get(longUrl, { headers })
  expect(longRead.status()).toBe(200)
  const longPolicy = await longRead.json()
  const longProtected = await page.request.put(longUrl, {
    headers,
    data: {
      mode: 'tenant',
      column: 'tenant',
      version: longPolicy.version,
      resourceVersion: longPolicy.resourceVersion,
      fields: { mode: 'selected', columns: [longKey] },
    },
  })
  expect(longProtected.status()).toBe(200)
  await page
    .getByRole('button', { name: 'Tenant protection', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Tenant protection', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Protected resource', exact: true })
    .click()
  await page.getByRole('option', { name: longSource.name, exact: true }).click()
  const longEditor = page.getByRole('region', {
    name: `Row protection for ${longSource.name}`,
    exact: true,
  })
  await expect(
    longEditor.getByRole('heading', {
      name: `Row protection for ${longSource.name}`,
      exact: true,
    }),
  ).toBeInViewport({ ratio: 0.5 })
  await expect(
    longEditor.getByRole('checkbox', {
      name: `Allow API field ${longHeader}`,
      exact: true,
    }),
  ).toBeChecked()
  await expect(
    longEditor.getByRole('checkbox', {
      name: 'Allow API field ชื่อเต็ม',
      exact: true,
    }),
  ).not.toBeChecked()
  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  await appearance('Light')
  await capture(
    'Tenant protection',
    'Light full API field labels',
    'Legal80-character unbroken and Thai source headers retain their complete visible and accessible names, with no resource cell samples.',
  )
  await appearance('Dark')
  await capture(
    'Tenant protection',
    'Dark full API field labels',
    'Dark field controls keep allowed selections, original labels and private-tenant guidance readable.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  async function containedFieldLabel() {
    const checkbox = longEditor.getByRole('checkbox', {
      name: `Allow API field ${longHeader}`,
      exact: true,
    })
    expect(
      await checkbox.evaluate((button, fullLabel) => {
        const label = button.closest('label')
        const text =
          label &&
          Array.from(label.querySelectorAll('span')).find(
            (span) => span.textContent === fullLabel,
          )
        if (!label || !text) return false
        const bounds = label.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(text)
        return Array.from(range.getClientRects()).every(
          (rect) =>
            rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 &&
            rect.top >= bounds.top - 1 &&
            rect.bottom <= bounds.bottom + 1,
        )
      }, longHeader),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  }
  await containedFieldLabel()
  await capture(
    'Mobile dark',
    'Phone source API field selection',
    'Actual390px text-glyph bounds contain the complete legal80-character header. Thai labels and all controls remain visible without truncation.',
  )
  await appearance('Light')
  await containedFieldLabel()
  await longEditor
    .getByRole('button', { name: 'Review row protection', exact: true })
    .click()
  await expect(
    longEditor.getByRole('region', {
      name: 'Review row protection',
      exact: true,
    }),
  ).toContainText(`API fields: ${longHeader}`)
  await capture(
    'Mobile',
    'Phone full API field review',
    'The phone review preserves the complete human header and API key, versions and live restriction warning.',
  )
  await longEditor
    .getByRole('button', { name: 'Cancel row protection review', exact: true })
    .click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await appearance('System')
  await containedFieldLabel()
  await capture(
    'Mobile dark',
    'System appearance field controls follow dark',
    'System appearance follows the browser dark preference without changing policy selection or credentials.',
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await containedFieldLabel()
  await capture(
    'Mobile',
    'System appearance field controls follow light',
    'The same complete field labels remain contained when system appearance changes to light.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  const revoked = await page.request.delete(
    `${apiOrigin}/api/runtime-keys/${caller.id}`,
    { headers },
  )
  expect(revoked.status()).toBe(200)
  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: `Field schema reader ${crypto.randomUUID().slice(0, 8)}`,
      permissions: ['flows.read', 'sources.read', 'database-connections.read'],
    },
  })
  expect(roleResponse.status()).toBe(200)
  const role = (await roleResponse.json()) as { id: string }
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: { name: 'Field schema reader', role: 'custom', roleId: role.id },
  })
  expect(memberResponse.status()).toBe(200)
  const reader = (await memberResponse.json()) as { token: string }
  const forbiddenPolicy = await page.request.get(longUrl, {
    headers: { authorization: `Bearer ${reader.token}` },
  })
  expect(forbiddenPolicy.status()).toBe(403)
  const structural = await page.request.get(
    `${apiOrigin}/api/dependencies/sources`,
    {
      headers: { authorization: `Bearer ${reader.token}` },
    },
  )
  expect(structural.status()).toBe(200)
  const catalog = (await structural.json()) as {
    id: string
    columns: { key: string; label: string }[]
  }[]
  const knownSchema = catalog.find((entry) => entry.id === longSource.id)
  expect(knownSchema?.columns.map((column) => column.label)).toEqual([
    'tenant',
    longHeader,
    'ชื่อเต็ม',
  ])
  expect(knownSchema).not.toHaveProperty('rows')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let privatePolicyReads = 0
  const observePolicy = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'GET' &&
      /\/row-policy$|^\/api\/tenants(?:\/|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      privatePolicyReads++
  }
  page.on('request', observePolicy)
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
    page.getByRole('combobox', { name: 'API field access', exact: true }),
  ).toHaveCount(0)
  expect(privatePolicyReads).toBe(0)
  await capture(
    'Permissions',
    'Read grants do not delegate API field policy',
    'A real custom source/schema reader cannot open owner tenant policies and makes zero private policy or registry reads. Authorized structural names remain known without rows, including excluded fields.',
  )
  page.off('request', observePolicy)
}
