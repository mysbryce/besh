import { expect, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

export async function protectedReadGraphPreviews({
  page,
  owner,
  capture: takeCapture,
  apiOrigin = '',
}: {
  page: Page
  owner: string
  capture: Capture
  apiOrigin?: string
}) {
  const headers = { authorization: `Bearer ${owner}` }
  async function displayedReplyBody() {
    const text = await page.getByTestId('test-result').innerText()
    return text.startsWith('{') ? JSON.parse(text).body : undefined
  }
  async function capture(
    group: string,
    title: string,
    detail: string,
    focus?: 'reply' | 'reply-actions' | 'reply-metadata' | 'argument',
  ) {
    const target =
      focus === 'reply'
        ? page.getByRole('heading', {
            name: 'Review last-read reply',
            exact: true,
          })
        : focus === 'reply-actions'
          ? page.getByRole('button', {
              name: 'Apply last-read reply',
              exact: true,
            })
          : focus === 'argument'
            ? page.getByRole('combobox', {
                name: 'Reply argument choose type',
                exact: true,
              })
            : focus === 'reply-metadata'
              ? page
                  .getByRole('region', {
                    name: 'Last-read reply rules',
                    exact: true,
                  })
                  .getByRole('button')
                  .first()
              : null
    if (target) {
      await target.evaluate((element, lowerActions) => {
        const inspector = element.closest<HTMLElement>('.inspector')!
        const inspectorBounds = inspector.getBoundingClientRect()
        const lastAction = lowerActions
          ? [...element.parentElement!.querySelectorAll('button')].at(-1)!
          : element
        const offset = lowerActions
          ? lastAction.getBoundingClientRect().bottom -
            inspectorBounds.bottom +
            24
          : element.getBoundingClientRect().top - inspectorBounds.top - 24
        inspector.scrollTo({
          top: inspector.scrollTop + offset,
          behavior: 'instant',
        })
      }, focus === 'reply-actions')
      await expect
        .poll(() =>
          target.evaluate((element) => {
            const inspector = element
              .closest('.inspector')!
              .getBoundingClientRect()
            const bounds = element.getBoundingClientRect()
            return (
              bounds.top >= inspector.top && bounds.bottom <= inspector.bottom
            )
          }),
        )
        .toBe(true)
    }
    const boundedInspector = !!target && page.viewportSize()!.width > 800
    async function assertBrowserBounds() {
      await expect
        .poll(() =>
          target!.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            return (
              bounds.left >= 0 &&
              bounds.right <= window.innerWidth &&
              bounds.top >= 0 &&
              bounds.bottom <= window.innerHeight
            )
          }),
        )
        .toBe(true)
    }
    if (boundedInspector) {
      await target.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        window.scrollBy({
          top: bounds.top - (window.innerHeight - bounds.height) / 2,
          behavior: 'instant',
        })
      })
      await assertBrowserBounds()
    }
    await takeCapture(
      group,
      title,
      detail,
      boundedInspector ? { fullPage: false } : undefined,
    )
    if (target)
      await expect
        .poll(() =>
          target.evaluate((element) => {
            const inspector = element
              .closest('.inspector')!
              .getBoundingClientRect()
            const bounds = element.getBoundingClientRect()
            return (
              bounds.top >= inspector.top && bounds.bottom <= inspector.bottom
            )
          }),
        )
        .toBe(true)
    if (boundedInspector) await assertBrowserBounds()
  }
  async function acceptActionDialog(action: () => Promise<void>) {
    let accepted: Promise<void> | undefined
    const accept = (dialog: import('@playwright/test').Dialog) => {
      accepted = dialog.accept()
    }
    page.on('dialog', accept)
    try {
      await action()
      await accepted
    } finally {
      page.off('dialog', accept)
    }
  }
  async function chooseTransport(transport: 'REST' | 'GraphQL') {
    await page.getByRole('combobox', { name: 'API type', exact: true }).click()
    await acceptActionDialog(() =>
      page.getByRole('option', { name: transport, exact: true }).click(),
    )
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  const suffix = crypto.randomUUID().slice(0, 8)
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: `Earlier protected read ${suffix}`,
        file: {
          name: 'earlier.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            'tenant,person,age\nA,Earlier Ada,1\nB,Earlier Bree,2\n',
          ),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)
  const source = (await imported.json()) as { id: string; name: string }
  const sqlite = spawnSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    const database = new Database(':memory:')
    database.run('CREATE TABLE people (tenant TEXT NOT NULL, person TEXT NOT NULL, age INTEGER)')
    database.query('INSERT INTO people VALUES (?, ?, ?)').run('A', 'Final Ada', 36)
    database.query('INSERT INTO people VALUES (?, ?, ?)').run('B', 'Final Bree', null)
    process.stdout.write(Buffer.from(database.serialize()))
    database.close()
  `,
    ],
    { windowsHide: true, timeout: 10_000, maxBuffer: 2 * 1024 * 1024 },
  )
  expect(sqlite.status).toBe(0)
  const uploaded = await page.request.post(
    `${apiOrigin}/api/database-connections`,
    {
      headers,
      multipart: {
        name: `Final protected copy ${suffix}`,
        file: {
          name: 'people.sqlite',
          mimeType: 'application/x-sqlite3',
          buffer: sqlite.stdout,
        },
      },
    },
  )
  expect(uploaded.status()).toBe(200)
  const database = (await uploaded.json()) as { id: string; name: string }
  const created = await page.request.post(`${apiOrigin}/api/flows`, {
    headers,
    data: {
      name: `Protected last read ${suffix}`,
      method: 'GET',
      path: `/v1/last-read-${suffix}`,
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 0, y: 100 },
          config: {},
        },
        {
          id: 'earlier',
          type: 'data',
          position: { x: 310, y: 100 },
          config: { sourceId: source.id, columns: ['person'], limit: 10 },
        },
        {
          id: 'last',
          type: 'database',
          position: { x: 620, y: 100 },
          config: {
            connectionId: database.id,
            table: 'people',
            columns: ['person', 'age'],
            limit: 10,
          },
        },
        {
          id: 'response',
          type: 'response',
          position: { x: 930, y: 100 },
          config: { status: 200, body: '$data' },
        },
      ],
      edges: [
        { id: 'first', source: 'request', target: 'earlier' },
        { id: 'next', source: 'earlier', target: 'last' },
        { id: 'reply', source: 'last', target: 'response' },
      ],
    },
  })
  expect(created.status()).toBe(200)
  const flow = (await created.json()) as {
    id: string
    name: string
    path: string
  }
  async function saveDraft() {
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/flows/${flow.id}` &&
        response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    expect((await saved).status()).toBe(200)
  }
  async function publish() {
    const published = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/flows/${flow.id}/publish` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    expect((await published).status()).toBe(200)
  }
  for (const path of [
    `/api/data-sources/${source.id}/row-policy`,
    `/api/database-connections/${database.id}/row-policy`,
  ]) {
    const read = await page.request.get(`${apiOrigin}${path}`, { headers })
    expect(read.status()).toBe(200)
    const policy = (await read.json()) as {
      version: number
      resourceVersion: number
    }
    const changed = await page.request.put(`${apiOrigin}${path}`, {
      headers,
      data: {
        mode: 'tenant',
        version: policy.version,
        resourceVersion: policy.resourceVersion,
        ...(path.includes('data-sources')
          ? { column: 'tenant' }
          : { tables: [{ table: 'people', column: 'tenant' }] }),
      },
    })
    expect(changed.status()).toBe(200)
  }
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeVisible()
  await page
    .locator('.api-list')
    .getByRole('button')
    .filter({ hasText: flow.name })
    .click()
  await expect(page.getByText('Opening studio…', { exact: true })).toHaveCount(
    0,
    { timeout: 15_000 },
  )
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    flow.name,
  )
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Data source', exact: true }),
  ).toHaveText(source.name)
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'SQLite rows' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Database connection', exact: true }),
  ).toHaveText(database.name)
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Review last-read reply', exact: true }),
  ).toBeVisible()
  await capture(
    'protected-reads',
    'Review the last protected read reply',
    'A reviewed flat reply uses the final SQLite read. Earlier spreadsheet rows are replaced, not joined.',
    'reply',
  )
  await capture(
    'protected-reads',
    'Review exact draft reply replacement actions',
    'The lower review explains status 200 and last-read rows. Apply and Cancel are separate explicit actions; publication and input rules are not changed automatically.',
    'reply-actions',
  )
  const review = page.getByRole('region', {
    name: 'Review last-read reply',
    exact: true,
  })
  await expect(review).toContainText('person · Text')
  await expect(review).toContainText('age · Number · Empty cells allowed')
  await review
    .getByRole('button', { name: 'Cancel reply review', exact: true })
    .click()
  await expect(review).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Apply last-read reply', exact: true })
    .click()
  await saveDraft()
  const savedResponse = await page.request.get(
    `${apiOrigin}/api/flows/${flow.id}`,
    { headers },
  )
  expect(savedResponse.status()).toBe(200)
  const saved = await savedResponse.json()
  expect(saved.contract.response).toEqual({
    type: 'array',
    maxItems: 10,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['person', 'age'],
      properties: {
        person: { type: 'string', nullable: false },
        age: { type: 'number', nullable: true },
      },
    },
  })
  const tenantsResponse = await page.request.get(`${apiOrigin}/api/tenants`, {
    headers,
  })
  expect(tenantsResponse.status()).toBe(200)
  const tenants = (await tenantsResponse.json()) as {
    id: string
    label: string
    value: string
  }[]
  let tenant = tenants.find((item) => item.value === 'A')
  if (!tenant) {
    const tenantResponse = await page.request.post(`${apiOrigin}/api/tenants`, {
      headers,
      data: { label: `Last-read tenant ${suffix}`, value: 'A' },
    })
    expect(tenantResponse.status()).toBe(200)
    tenant = await tenantResponse.json()
  }
  await page
    .getByRole('button', { name: 'Refresh tenant access', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant!.label, exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Final Ada')
  expect(
    JSON.parse(await page.getByTestId('test-result').innerText()).body,
  ).toEqual([{ person: 'Final Ada', age: 36 }])
  await publish()
  const issued = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
    headers,
    data: {
      name: 'Last-read protected caller',
      flowId: flow.id,
      permissions: ['rest'],
      releaseRevision: saved.revision,
      tenantId: tenant!.id,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  })
  expect(issued.status()).toBe(200)
  const key = (await issued.json()) as { token: string }
  const called = await page.request.get(`${apiOrigin}/run${flow.path}`, {
    headers: { authorization: `Bearer ${key.token}` },
  })
  expect(called.status()).toBe(200)
  expect(await called.json()).toEqual([{ person: 'Final Ada', age: 36 }])
  await capture(
    'protected-reads',
    'Protected reads return the final SQLite rows',
    'Reviewed typed rules persist through save and publication. The trusted tenant applies to both resources; only the final read is returned.',
  )
  await chooseTransport('GraphQL')
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Review last-read reply', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Apply last-read reply', exact: true })
    .click()
  await saveDraft()
  await page
    .getByRole('button', { name: 'Build rows query', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Use rows query', exact: true })
    .click()
  await expect(
    page.getByLabel('GraphQL operation', { exact: true }),
  ).toHaveValue('{ rows { person age } }')
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant!.label, exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect
    .poll(displayedReplyBody)
    .toEqual({ data: { rows: [{ person: 'Final Ada', age: 36 }] } })
  await capture(
    'protected-reads',
    'One typed rows query returns the final read',
    'Labeled reply selections build one Query.rows operation. The complete raw row contract stays enforced before GraphQL field projection.',
  )
  await publish()
  const currentFlow = await page.request.get(
    `${apiOrigin}/api/flows/${flow.id}`,
    { headers },
  )
  expect(currentFlow.status()).toBe(200)
  const publication = (await currentFlow.json()) as {
    publishedRevision: number
  }
  const graphqlIssued = await page.request.post(
    `${apiOrigin}/api/runtime-keys`,
    {
      headers,
      data: {
        name: 'Last-read GraphQL caller',
        flowId: flow.id,
        permissions: ['query'],
        releaseRevision: publication.publishedRevision,
        tenantId: tenant!.id,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    },
  )
  expect(graphqlIssued.status()).toBe(200)
  const graphqlKey = (await graphqlIssued.json()) as { token: string }
  const queried = await page.request.post(`${apiOrigin}/graphql${flow.path}`, {
    headers: { authorization: `Bearer ${graphqlKey.token}` },
    data: { query: '{ rows { person age } }' },
  })
  expect(queried.status()).toBe(200)
  expect(await queried.json()).toEqual({
    data: { rows: [{ person: 'Final Ada', age: 36 }] },
  })
  await chooseTransport('REST')
  await page.getByRole('combobox', { name: 'HTTP method', exact: true }).click()
  await page.getByRole('option', { name: 'GET', exact: true }).click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.locator('.react-flow__node[data-id="earlier"]').click()
  await page.getByRole('checkbox', { name: 'Include age', exact: true }).check()
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Condition', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Input source', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Query parameter', exact: true })
    .click()
  await page.getByLabel('Input field', { exact: true }).fill('choose')
  await page
    .getByRole('combobox', { name: 'Expected type', exact: true })
    .click()
  await page.getByRole('option', { name: 'Text', exact: true }).click()
  await page.getByLabel('Expected value', { exact: true }).fill('copy')
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page
    .getByRole('group', { name: 'Edge from earlier to last', exact: true })
    .press('Enter')
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  const condition = page
    .locator('.react-flow__node')
    .filter({ hasText: 'Condition' })
  async function connect(
    from: import('@playwright/test').Locator,
    to: import('@playwright/test').Locator,
  ) {
    const start = await from.boundingBox()
    const end = await to.boundingBox()
    expect(start).not.toBeNull()
    expect(end).not.toBeNull()
    await page.mouse.move(
      start!.x + start!.width / 2,
      start!.y + start!.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, {
      steps: 12,
    })
    await page.mouse.up()
  }
  await connect(
    page.locator(
      '.react-flow__node[data-id="earlier"] .react-flow__handle.source',
    ),
    condition.locator('.react-flow__handle.target'),
  )
  await connect(
    condition.locator('.react-flow__handle.source[data-handleid="true"]'),
    page.locator(
      '.react-flow__node[data-id="last"] .react-flow__handle.target',
    ),
  )
  await connect(
    condition.locator('.react-flow__handle.source[data-handleid="false"]'),
    page.locator(
      '.react-flow__node[data-id="response"] .react-flow__handle.target',
    ),
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(5)
  await page.locator('.react-flow__node[data-id="response"]').click()
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Review last-read reply', exact: true }),
  ).toContainText(source.name)
  await expect(
    page.getByRole('region', { name: 'Review last-read reply', exact: true }),
  ).toContainText(database.name)
  await capture(
    'protected-reads',
    'Input condition reviews both possible final reads',
    'The palette and actual handles connect both paths. An input choice selects the last read; it never establishes tenant identity or combines resources.',
    'reply',
  )
  await page
    .getByRole('button', { name: 'Apply last-read reply', exact: true })
    .click()
  await saveDraft()
  await page
    .getByRole('button', { name: 'Add query parameter', exact: true })
    .click()
  await page.getByLabel('Query name 1', { exact: true }).fill('choose')
  await page.getByLabel('Query value 1', { exact: true }).fill('copy')
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant!.label, exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect
    .poll(displayedReplyBody)
    .toEqual([{ person: 'Final Ada', age: 36 }])
  await page.getByLabel('Query value 1', { exact: true }).fill('spreadsheet')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect
    .poll(displayedReplyBody)
    .toEqual([{ person: 'Earlier Ada', age: 1 }])
  await capture(
    'protected-reads',
    'False branch returns spreadsheet rows',
    'The same reviewed tenant is used on each path. A false input condition returns the earlier spreadsheet rows because no later read executes.',
  )
  await chooseTransport('GraphQL')
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Last-read reply rules', exact: true }),
  ).toContainText('GraphQL arguments use request body fields')
  await capture(
    'protected-reads',
    'GraphQL conversion keeps input references explicit',
    'The reply review refuses to reinterpret query/path inputs as GraphQL arguments. Use each labeled node form to choose a simple request body field explicitly.',
    'reply-metadata',
  )
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await condition.click()
  await page
    .getByRole('combobox', { name: 'Input source', exact: true })
    .click()
  await page.getByRole('option', { name: 'Request body', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.locator('.react-flow__node[data-id="response"]').click()
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('combobox', {
      name: 'Reply argument choose type',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', {
      name: 'Require argument choose',
      exact: true,
    }),
  ).toBeChecked()
  await capture(
    'protected-reads',
    'Review a typed GraphQL business argument',
    'The explicitly configured body.choose condition becomes a reviewed Text argument. The required flag and generated reply remain separate from tenant identity.',
    'argument',
  )
  await page
    .getByRole('button', { name: 'Apply last-read reply', exact: true })
    .click()
  await saveDraft()
  await page
    .getByRole('button', { name: 'Build rows query', exact: true })
    .click()
  await page.getByLabel('Argument choose', { exact: true }).fill('copy')
  await page
    .getByRole('button', { name: 'Use rows query', exact: true })
    .click()
  await expect(
    page.getByLabel('GraphQL operation', { exact: true }),
  ).toHaveValue('{ rows(choose: "copy") { person age } }')
  await page
    .getByRole('combobox', { name: 'Reviewed tenant', exact: true })
    .click()
  await page.getByRole('option', { name: tenant!.label, exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect
    .poll(displayedReplyBody)
    .toEqual({ data: { rows: [{ person: 'Final Ada', age: 36 }] } })
  await page.getByLabel('Argument choose', { exact: true }).fill('spreadsheet')
  await page
    .getByRole('button', { name: 'Use rows query', exact: true })
    .click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect
    .poll(displayedReplyBody)
    .toEqual({ data: { rows: [{ person: 'Earlier Ada', age: 1 }] } })
  await capture(
    'protected-reads',
    'Labeled argument chooses the GraphQL branch',
    'The query form accepts a business value without JSON. One rows root returns the last read from the selected branch; both resources retain the same trusted identity.',
  )
  await publish()

  let otherTenant = tenants.find((item) => item.value === 'B')
  if (!otherTenant) {
    const createdTenant = await page.request.post(`${apiOrigin}/api/tenants`, {
      headers,
      data: { label: `Other last-read tenant ${suffix}`, value: 'B' },
    })
    expect(createdTenant.status()).toBe(200)
    otherTenant = await createdTenant.json()
  }
  const currentResponse = await page.request.get(
    `${apiOrigin}/api/flows/${flow.id}`,
    { headers },
  )
  expect(currentResponse.status()).toBe(200)
  const current = await currentResponse.json()
  async function issueQueryKey(tenantId: string) {
    const receipt = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
      headers,
      data: {
        name: 'Branched protected caller',
        flowId: flow.id,
        permissions: ['query'],
        releaseRevision: current.publishedRevision,
        tenantId,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
    expect(receipt.status()).toBe(200)
    return (await receipt.json()) as { id: string; token: string }
  }
  const callerA = await issueQueryKey(tenant!.id)
  const callerB = await issueQueryKey(otherTenant!.id)
  async function callBranch(token: string, choice: string) {
    return page.request.post(`${apiOrigin}/graphql${flow.path}`, {
      headers: { authorization: `Bearer ${token}` },
      data: { query: `{ rows(choose: "${choice}") { person age } }` },
    })
  }
  const nullableRows = await callBranch(callerB.token, 'copy')
  expect(nullableRows.status()).toBe(200)
  expect(await nullableRows.json()).toEqual({
    data: { rows: [{ person: 'Final Bree', age: null }] },
  })
  const profilePath = `/api/database-connections/${database.id}/tenant-fields/${tenant!.id}`
  async function updateProfile(
    fields: { mode: 'inherit' } | { mode: 'selected'; columns: string[] },
  ) {
    const read = await page.request.get(`${apiOrigin}${profilePath}`, {
      headers,
    })
    expect(read.status()).toBe(200)
    const profile = await read.json()
    const updated = await page.request.put(`${apiOrigin}${profilePath}`, {
      headers,
      data: {
        version: profile.version,
        resourceVersion: profile.resourceVersion,
        tenantVersion: profile.tenant.version,
        tables: [{ table: 'people', fields }],
      },
    })
    expect(updated.status()).toBe(200)
  }
  await updateProfile({ mode: 'selected', columns: ['person'] })
  const unchosenDenied = await callBranch(callerA.token, 'spreadsheet')
  expect(unchosenDenied.status()).toBe(403)
  const unaffected = await callBranch(callerB.token, 'copy')
  expect(unaffected.status()).toBe(200)
  const deniedDraft = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${flow.id}/graphql/test` &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await deniedDraft).status()).toBe(403)
  await expect(page.getByRole('status')).toContainText('field')
  await expect(page.getByTestId('test-result')).not.toContainText('Earlier Ada')
  await expect(page.getByTestId('test-result')).not.toContainText(
    '"status": 200',
  )
  await expect(page.getByTestId('test-result')).toContainText(
    'Your response will appear here.',
  )
  await capture(
    'protected-reads',
    'Unchosen branch still requires current field access',
    'A tenant profile removes an authored SQLite field. Draft and pinned callers are denied even when the input chooses the spreadsheet branch; the other tenant remains authorized.',
  )
  await updateProfile({ mode: 'inherit' })
  const recovered = await callBranch(callerA.token, 'spreadsheet')
  expect(recovered.status()).toBe(200)
  expect(await recovered.json()).toEqual({
    data: { rows: [{ person: 'Earlier Ada', age: 1 }] },
  })
  const recoveredDraft = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${flow.id}/graphql/test` &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await recoveredDraft).status()).toBe(200)
  await expect
    .poll(displayedReplyBody)
    .toEqual({ data: { rows: [{ person: 'Earlier Ada', age: 1 }] } })
  await capture(
    'protected-reads',
    'Reviewed access recovery preserves the publication',
    'Restoring the reviewed tenant profile lets the same pinned caller work again. API revision, key scope and typed nullable replies stay unchanged.',
  )
  const unchangedResponse = await page.request.get(
    `${apiOrigin}/api/flows/${flow.id}`,
    { headers },
  )
  const unchanged = await unchangedResponse.json()
  expect(unchanged.publishedRevision).toBe(current.publishedRevision)
  expect(unchanged.revision).toBe(current.revision)
  for (const caller of [callerA, callerB]) {
    const revoked = await page.request.delete(
      `${apiOrigin}/api/runtime-keys/${caller.id}`,
      { headers },
    )
    expect(revoked.status()).toBe(200)
  }

  const sourceCatalog = '**/api/dependencies/sources'
  const unavailable = async (route: import('@playwright/test').Route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Schema catalog temporarily unavailable' }),
    })
  }
  await page.route(sourceCatalog, unavailable)
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Last-read reply rules', exact: true }),
  ).toContainText('Schema catalog temporarily unavailable')
  await expect(
    page.getByRole('region', { name: 'Review last-read reply', exact: true }),
  ).toHaveCount(0)
  await capture(
    'protected-reads',
    'Reply metadata error keeps draft rules unchanged',
    'A delivery failure shows an explicit error. No guessed fields or replacement schema are applied; retry reads the real structural catalog.',
    'reply-metadata',
  )
  await page.unroute(sourceCatalog, unavailable)
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Review last-read reply', exact: true }),
  ).toBeVisible()
  await capture(
    'protected-reads',
    'Reply metadata retry reviews actual fields',
    'Retry recovers the actual field labels and both possible final reads. Applying remains an explicit draft action.',
    'reply',
  )
  await page
    .getByRole('button', { name: 'Cancel reply review', exact: true })
    .click()

  let releaseCatalog!: () => void
  const waitCatalog = new Promise<void>((resolve) => {
    releaseCatalog = resolve
  })
  let catalogArrived!: () => void
  const arrived = new Promise<void>((resolve) => {
    catalogArrived = resolve
  })
  let deliveryFinished!: () => void
  let deliveryFailed!: (error: unknown) => void
  const delivery = new Promise<void>((resolve, reject) => {
    deliveryFinished = resolve
    deliveryFailed = reject
  })
  const heldCatalog = async (route: import('@playwright/test').Route) => {
    try {
      const response = await route.fetch({
        url: `${apiOrigin}/api/dependencies/sources`,
      })
      expect(response.status()).toBe(200)
      catalogArrived()
      await waitCatalog
      await route.fulfill({ response })
      deliveryFinished()
    } catch (error) {
      deliveryFailed(error)
      throw error
    }
  }
  await page.route(sourceCatalog, heldCatalog)
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  await arrived
  await expect(
    page.getByRole('button', { name: 'Reviewing reply fields…', exact: true }),
  ).toBeDisabled()
  await capture(
    'protected-reads',
    'Pending reply metadata cannot apply stale rules',
    'The real catalog request is held in delivery. Reply review and apply stay unavailable while fields are loading.',
    'reply-metadata',
  )
  await chooseTransport('REST')
  releaseCatalog()
  await delivery
  await page.unroute(sourceCatalog, heldCatalog)
  await expect(
    page.getByRole('button', { name: 'Use last read fields', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('region', { name: 'Review last-read reply', exact: true }),
  ).toHaveCount(0)
  await capture(
    'protected-reads',
    'Late reply metadata cannot replace a changed transport',
    'The delayed GraphQL review is discarded after changing the draft transport. Current published GraphQL metadata and its callers remain separate.',
    'reply-metadata',
  )
  await chooseTransport('GraphQL')
  await page
    .getByRole('button', { name: 'Use last read fields', exact: true })
    .click()
  const replyReview = page.getByRole('region', {
    name: 'Review last-read reply',
    exact: true,
  })
  await expect(replyReview).toBeVisible()
  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  async function assertControlsFit(region: import('@playwright/test').Locator) {
    const card = await region.boundingBox()
    expect(card).not.toBeNull()
    for (const control of await region
      .locator('button:not([role="checkbox"])')
      .all()) {
      const bounds = await control.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(card!.x)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        card!.x + card!.width,
      )
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      expect(
        await control.evaluate((element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          const bounds = element.getBoundingClientRect()
          return Array.from(range.getClientRects()).every(
            (rect) =>
              rect.left >= bounds.left &&
              rect.right <= bounds.right &&
              rect.top >= bounds.top &&
              rect.bottom <= bounds.bottom,
          )
        }),
      ).toBe(true)
    }
  }
  await appearance('Light')
  await assertControlsFit(replyReview)
  await capture(
    'protected-reads',
    'Light reviewed branch fields and argument controls',
    'Both possible final reads show their full names and nullable field rules. The owner explicitly reviews a business argument and replacement schema.',
    'reply',
  )
  await capture(
    'protected-reads',
    'Light GraphQL reply review actions',
    'The full schema replacement warning, final-row binding and explicit Apply/Cancel controls are visible in the scrollable inspector.',
    'reply-actions',
  )
  await appearance('Dark')
  await assertControlsFit(replyReview)
  await capture(
    'protected-reads',
    'Dark reviewed branch fields and argument controls',
    'The same draft review stays readable in dark appearance; no credential or tenant value enters the schema controls.',
    'reply',
  )
  await capture(
    'protected-reads',
    'Dark GraphQL reply review actions',
    'The exact replacement decision remains readable in dark appearance with full action labels.',
    'reply-actions',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expect
    .poll(async () =>
      page.locator('.react-flow__node').evaluateAll((nodes) => {
        const canvas = document
          .querySelector('.react-flow')!
          .getBoundingClientRect()
        return nodes.flatMap((node) => {
          const bounds = node.getBoundingClientRect()
          return bounds.left >= canvas.left &&
            bounds.right <= canvas.right &&
            bounds.top >= canvas.top &&
            bounds.bottom <= canvas.bottom
            ? []
            : [
                {
                  id: node.getAttribute('data-id'),
                  canvas: {
                    left: canvas.left,
                    right: canvas.right,
                    top: canvas.top,
                    bottom: canvas.bottom,
                  },
                  node: {
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                  },
                },
              ]
        })
      }),
    )
    .toEqual([])
  await assertControlsFit(replyReview)
  await capture(
    'protected-reads',
    'Dark phone complete graph and typed reply review',
    'At 390 pixels all five nodes fit the actual canvas. Argument controls and full action text fit their review container with 44-pixel targets.',
    'reply',
  )
  await capture(
    'protected-reads',
    'Dark phone GraphQL argument type and required controls',
    'The internally scrollable inspector reveals the full argument type and Required controls without changing schema or tenant identity.',
    'argument',
  )
  await capture(
    'protected-reads',
    'Dark phone GraphQL reply review actions',
    'The lower review shows its complete replacement warning and both full-size action targets.',
    'reply-actions',
  )
  await appearance('Light')
  await assertControlsFit(replyReview)
  await capture(
    'protected-reads',
    'Light phone complete graph and typed reply review',
    'Full resource names, nullable fields and the exact schema replacement warning remain visible without clipping controls.',
    'reply',
  )
  await capture(
    'protected-reads',
    'Light phone GraphQL argument type and required controls',
    'The complete business argument controls remain readable without clipped labels.',
    'argument',
  )
  await capture(
    'protected-reads',
    'Light phone GraphQL reply review actions',
    'The replacement warning and untruncated Apply/Cancel controls remain inside their own card.',
    'reply-actions',
  )
  await page
    .getByRole('button', { name: 'Apply last-read reply', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Build rows query', exact: true })
    .click()
  const queryReview = page.getByRole('region', {
    name: 'Review rows query',
    exact: true,
  })
  await expect(queryReview).toBeVisible()
  await assertControlsFit(queryReview)
  await capture(
    'protected-reads',
    'Light phone labeled GraphQL query inputs',
    'One rows query uses labeled argument and reply-field controls. Advanced operation text remains optional; narrowing selected reply fields does not authorize restricted reads.',
  )
  await appearance('Dark')
  await assertControlsFit(queryReview)
  await capture(
    'protected-reads',
    'Dark phone labeled GraphQL query inputs',
    'Business values and nullable output choices remain readable. Caller input never supplies the trusted tenant identity.',
  )
  await appearance('System')
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await capture(
    'protected-reads',
    'System dark reduced-motion query forms',
    'System appearance follows the browser preference, while reduced motion and keyboard controls preserve the same draft review.',
  )
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await capture(
    'protected-reads',
    'System light reduced-motion query forms',
    'Appearance preferences persist without storing request credentials. Labeled forms retain the same protected graph and reviewed fields.',
  )
  await appearance('Light')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  })
  await page.getByRole('button', { name: 'Use this API', exact: true }).click()
  const examples = page.getByRole('region', {
    name: 'Use this API',
    exact: true,
  })
  await expect(examples).toContainText(
    `Published release · revision ${current.publishedRevision}`,
  )
  await expect(examples).toContainText('Unsaved edits are excluded')
  await capture(
    'protected-reads',
    'Published HTTP examples stay separate from unsaved reply edits',
    'The existing code panel reads the published GraphQL release by default. Unsaved reply review is excluded, and generating client text never executes protected reads.',
  )
  await examples
    .getByRole('combobox', { name: 'Example source', exact: true })
    .click()
  await page.getByRole('option', { name: 'Saved draft', exact: true }).click()
  await expect(examples).toContainText(
    `Saved draft · revision ${current.revision}`,
  )
  await capture(
    'protected-reads',
    'Saved HTTP draft examples are an explicit source choice',
    'Saved draft metadata is selected explicitly, while unsaved edits remain excluded. Source revision and current publication remain distinct.',
  )

  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: `Protected read reviewer ${suffix}`,
      role: 'viewer',
      tenantId: tenant!.id,
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  })
  expect(memberResponse.status()).toBe(200)
  const reviewer = (await memberResponse.json()) as { token: string }
  await acceptActionDialog(() =>
    page.getByRole('button', { name: 'Sign out', exact: true }).click(),
  )
  await page.getByLabel('Workspace token', { exact: true }).fill(reviewer.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeVisible()
  let dependencyReads = 0
  const countDependencyReads = (
    request: import('@playwright/test').Request,
  ) => {
    if (new URL(request.url()).pathname.startsWith('/api/dependencies/'))
      dependencyReads++
  }
  page.on('request', countDependencyReads)
  await page
    .locator('.api-list')
    .getByRole('button')
    .filter({ hasText: flow.name })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    flow.name,
  )
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.locator('.react-flow__node[data-id="response"]').click()
  await expect(
    page.getByRole('button', { name: 'Use last read fields', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Build rows query', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Test flow', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('combobox', { name: 'Reviewed tenant', exact: true }),
  ).toHaveCount(0)
  expect(dependencyReads).toBe(0)
  await capture(
    'protected-reads',
    'Read-only shared graph cannot inspect or execute dependencies',
    'A selected viewer can inspect the shared API graph, but reply editing and tests remain disabled. No structural dependency catalog is fetched and no arbitrary tenant picker appears.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await capture(
    'protected-reads',
    'Phone read-only shared protected graph',
    'The same five-node graph and disabled beginner actions remain available on a phone without granting dependency USE, editing or execution.',
  )
  expect(dependencyReads).toBe(0)
  page.off('request', countDependencyReads)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'API Studio', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
}
