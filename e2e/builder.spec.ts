import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('build, move, save, test and publish a flow through the dashboard', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  const controlledWarnings: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.text().includes('uncontrolled input'))
      controlledWarnings.push(message.text())
  })
  await page.goto('/?setup=browser-test-setup-key-32-characters-long')
  await page.getByLabel('Workspace name').fill('Studio workspace')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  const token = await page.getByLabel('Your owner key').inputValue()
  expect(token.length).toBeGreaterThan(32)
  await expect(
    page.getByRole('checkbox', { name: 'I saved my owner key' }),
  ).toHaveJSProperty('tagName', 'BUTTON')
  await page.getByRole('checkbox', { name: 'I saved my owner key' }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('checkbox', { name: 'I saved my owner key' }),
  ).toBeChecked()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Enter studio' }),
  ).toBeDisabled()
  await page.getByLabel('I saved my owner key').check()
  await page.getByRole('button', { name: 'Enter studio' }).click()
  await expect(page.getByTestId('flow-canvas')).toBeVisible()
  await expect(
    page.locator('.flow-card').filter({ hasText: 'JSON response' }),
  ).toBeVisible()
  await page.getByRole('combobox', { name: 'Appearance' }).click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const contrast = () =>
    page.getByLabel('API name', { exact: true }).evaluate((element) => {
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map((channel) => Number(channel) / 255)
          .map((channel) =>
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4,
          )
        return (
          channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
        )
      }
      let background: Element | null = element
      while (
        background &&
        getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)'
      )
        background = background.parentElement
      const style = getComputedStyle(element)
      const backgroundLuminance = luminance(
        getComputedStyle(background!).backgroundColor,
      )
      const textLuminance = luminance(style.color)
      return (
        (Math.max(textLuminance, backgroundLuminance) + 0.05) /
        (Math.min(textLuminance, backgroundLuminance) + 0.05)
      )
    })
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('combobox', { name: 'Appearance' }).click()
  await expect(
    page.getByRole('option', { name: 'Light', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('combobox', { name: 'Appearance' }).click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  const documentationPath = resolve('docs/repository.md')
  const documentation = readFileSync(documentationPath, 'utf8')
  const reloaded = page
    .waitForEvent('framenavigated', {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 2000,
    })
    .then(
      () => true,
      () => false,
    )
  try {
    writeFileSync(documentationPath, `${documentation}\nPreview watch probe.\n`)
    expect(await reloaded).toBe(false)
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
  } finally {
    writeFileSync(documentationPath, documentation)
  }
  await page
    .getByRole('button', { name: 'Advanced test input', exact: true })
    .click()
  await page.getByLabel('Test input').fill('null')
  await page
    .getByRole('button', { name: 'Advanced test input', exact: true })
    .click()
  await expect(page.getByLabel('Test input')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('body and query')
  await page
    .getByLabel('Test input')
    .fill('{"body":{"literal":"$input.body.name"},"query":{}}')
  await page
    .getByRole('button', { name: 'Advanced test input', exact: true })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Body type 1', exact: true }),
  ).toContainText('Text')
  await expect(page.getByLabel('Body value 1', { exact: true })).toHaveValue(
    '$input.body.name',
  )
  await page
    .getByRole('button', { name: 'Advanced test input', exact: true })
    .click()
  await page.getByLabel('Test input').fill('{"body":{},"query":{}}')
  await page
    .getByRole('button', { name: 'Advanced test input', exact: true })
    .click()
  await page.getByRole('button', { name: 'New API' }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Untitled API')
  await page.getByLabel('API name').fill('Browser greeting')
  const method = page.getByRole('combobox', { name: 'HTTP method' })
  await expect(method).toHaveJSProperty('tagName', 'BUTTON')
  await method.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(method).toBeFocused()
  await page.getByLabel('Endpoint path').fill('/browser-hello')

  const node = page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
  const before = await node.boundingBox()
  if (!before) throw new Error('Response node not visible')

  await page.mouse.move(before.x + 80, before.y + 35)
  await page.mouse.down()
  await page.mouse.move(before.x + 125, before.y + 110, { steps: 10 })
  await page.mouse.up()
  await node.click()
  await expect(page.getByLabel('Node configuration')).toHaveCount(0)
  await page.getByLabel('Field value 1', { exact: true }).fill('Built in Besh')
  await page
    .getByRole('button', { name: 'Add response field', exact: true })
    .click()
  await page.getByLabel('Field name 2', { exact: true }).fill('name')
  await page
    .getByRole('combobox', { name: 'Field type 2', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'From query parameter', exact: true })
    .click()
  await page.getByLabel('Field value 2', { exact: true }).fill('name')
  await page.getByRole('combobox', { name: 'Response status' }).click()
  await page.getByRole('option', { name: /^201/ }).click()
  await page.getByRole('button', { name: 'Apply configuration' }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await expect(page.getByLabel('Test input')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Add query parameter', exact: true })
    .click()
  await page.getByLabel('Query name 1', { exact: true }).fill('name')
  await page.getByLabel('Query value 1', { exact: true }).fill('Ada')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Built in Besh')
  await expect(page.getByTestId('test-result')).toContainText('Ada')
  await expect(page.getByTestId('test-result')).toContainText('201')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'API keys', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Key name').fill('Browser caller')
  const publishedApi = page.getByRole('combobox', { name: 'Published API' })
  await expect(publishedApi).toHaveJSProperty('tagName', 'BUTTON')
  await publishedApi.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(publishedApi).toBeFocused()
  await publishedApi.click()
  await page.getByRole('option', { name: /Browser greeting/ }).click()
  const restPermission = page.getByRole('checkbox', { name: 'REST requests' })
  await expect(restPermission).toHaveJSProperty('tagName', 'BUTTON')
  await restPermission.check()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const runtimeToken = await page.getByLabel('New API key').inputValue()
  expect(runtimeToken.length).toBeGreaterThan(32)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy API key', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('API key copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    runtimeToken,
  )
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await expect(page.getByLabel('New API key')).toHaveCount(0)
  const live = await page.request.get('/run/browser-hello?name=Ada', {
    headers: { authorization: `Bearer ${runtimeToken}` },
  })
  expect(live.status()).toBe(201)
  expect(await live.json()).toEqual({ message: 'Built in Besh', name: 'Ada' })
  expect(
    (
      await page.request.get('/run/browser-hello', {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(401)
  expect(
    (
      await page.request.get('/api/runtime-keys', {
        headers: { authorization: `Bearer ${runtimeToken}` },
      })
    ).status(),
  ).toBe(401)
  const keyRow = page.getByRole('row').filter({ hasText: 'Browser caller' })
  page.once('dialog', (dialog) => dialog.dismiss())
  await keyRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  expect(
    (
      await page.request.get('/run/browser-hello', {
        headers: { authorization: `Bearer ${runtimeToken}` },
      })
    ).status(),
  ).toBe(201)
  page.once('dialog', (dialog) => dialog.accept())
  await keyRow.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('API key revoked')
  await expect(keyRow).toContainText('Revoked')
  expect(
    (
      await page.request.get('/run/browser-hello', {
        headers: { authorization: `Bearer ${runtimeToken}` },
      })
    ).status(),
  ).toBe(401)

  await page.reload()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: /Browser greeting/ }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Browser greeting')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Built in Besh')
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true })

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Reconnected API')
  await page.getByLabel('Endpoint path').fill('/reconnected')
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await page
    .getByRole('button', { name: 'Advanced configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Remove node', exact: true }).click()
  await page
    .getByRole('button', { name: 'Response', exact: true })
    .dragTo(page.getByTestId('flow-canvas'), {
      targetPosition: { x: 480, y: 235 },
    })
  await page.locator('.react-flow__pane').click({ position: { x: 40, y: 220 } })

  const source = page
    .locator('.react-flow__node')
    .filter({ hasText: 'HTTP request' })
    .locator('.react-flow__handle.source')
  const target = page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .locator('.react-flow__handle.target')
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Connection handles not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Hello, Besh!')

  const stock = await page.request.post('/api/flows', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name: 'Stock example',
      method: 'POST',
      path: '/stock-browser',
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 0, y: 130 },
          config: {},
        },
        {
          id: 'check',
          type: 'condition',
          position: { x: 300, y: 130 },
          config: { field: 'body.active', equals: true },
        },
        {
          id: 'yes',
          type: 'response',
          position: { x: 620, y: 30 },
          config: { status: 200, body: { available: true } },
        },
        {
          id: 'no',
          type: 'response',
          position: { x: 620, y: 230 },
          config: { status: 404, body: { available: false } },
        },
      ],
      edges: [
        { id: 'start', source: 'request', target: 'check' },
        { id: 'true', source: 'check', target: 'yes', sourceHandle: 'true' },
        { id: 'false', source: 'check', target: 'no', sourceHandle: 'false' },
      ],
    },
  })
  expect(stock.ok()).toBe(true)
  await page.getByRole('button', { name: /Sign out/ }).click()
  await page.getByLabel('Workspace token').fill(token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: /Stock example/ }).click()
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Condition' })
    .click()
  await expect(page.getByLabel('Node configuration')).toHaveCount(0)
  await page.getByLabel('Input field', { exact: true }).fill('inStock')
  await expect(
    page.getByRole('combobox', { name: 'Comparison', exact: true }),
  ).toHaveJSProperty('tagName', 'BUTTON')
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add body field', exact: true })
    .click()
  await page.getByLabel('Body name 1', { exact: true }).fill('inStock')
  await page.getByRole('combobox', { name: 'Body type 1', exact: true }).click()
  await page.getByRole('option', { name: 'True or false', exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText(
    '"available": true',
  )
  await page
    .getByRole('combobox', { name: 'Body value 1', exact: true })
    .click()
  await page.getByRole('option', { name: 'False', exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('404')
  await expect(page.getByTestId('test-result')).toContainText(
    '"available": false',
  )

  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await page.getByLabel('Source name', { exact: true }).fill('Products')
  await page.getByLabel('Spreadsheet file', { exact: true }).setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,price,available\nTea,12,true\nCoffee,15,false\n'),
  })
  await page
    .getByRole('button', { name: 'Import spreadsheet', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Tea', exact: true }),
  ).toBeVisible()
  const sourceList = await page.request.get('/api/data-sources', {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(sourceList.ok()).toBe(true)
  const sources = await sourceList.json()
  const products = sources.find(
    (source: { name: string }) => source.name === 'Products',
  )
  expect(products.rowCount).toBe(2)
  expect(products.kind).toBe('upload')
  await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
  await page.getByLabel('API name', { exact: true }).fill('Products API')
  await expect(page.getByLabel('Endpoint path', { exact: true })).toHaveValue(
    '/products',
  )
  await expect(
    page.getByRole('checkbox', { name: 'Return name', exact: true }),
  ).toBeChecked()
  await page
    .getByRole('checkbox', { name: 'Return available', exact: true })
    .uncheck()
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Products API',
  )
  await expect(
    page.locator('.react-flow__node').filter({ hasText: 'Spreadsheet rows' }),
  ).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  const dataTest = JSON.parse(await page.getByTestId('test-result').innerText())
  expect(dataTest.body).toEqual([
    { name: 'Tea', price: 12 },
    { name: 'Coffee', price: 15 },
  ])
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Data source', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  await expect(
    page.getByRole('checkbox', { name: 'Include name', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'Include available', exact: true }),
  ).not.toBeChecked()
  await page
    .getByRole('combobox', { name: 'Maximum rows', exact: true })
    .click()
  await page.getByRole('option', { name: '1', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect(
    JSON.parse(await page.getByTestId('test-result').innerText()).body,
  ).toEqual([{ name: 'Tea', price: 12 }])
  await page
    .getByRole('combobox', { name: 'Maximum rows', exact: true })
    .click()
  await page.getByRole('option', { name: '25', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply configuration', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page.getByLabel('Key name').fill('Products caller')
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await page.getByRole('option', { name: 'Products API', exact: true }).click()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const productsToken = await page.getByLabel('New API key').inputValue()
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const productsResponse = await page.request.get('/run/products', {
    headers: { authorization: `Bearer ${productsToken}` },
  })
  expect(productsResponse.status()).toBe(200)
  expect(await productsResponse.json()).toEqual([
    { name: 'Tea', price: 12 },
    { name: 'Coffee', price: 15 },
  ])
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await expect(
    page.getByLabel('Replacement spreadsheet', { exact: true }),
  ).toHaveCount(1)
  await page
    .getByLabel('Replacement spreadsheet', { exact: true })
    .setInputFiles({
      name: 'products-updated.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'name,price,available\nTea,18,true\nCoffee,15,false\n',
      ),
    })
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Replace spreadsheet', exact: true })
    .click()
  expect(
    await (
      await page.request.get('/run/products', {
        headers: { authorization: `Bearer ${productsToken}` },
      })
    ).json(),
  ).toEqual([
    { name: 'Tea', price: 12 },
    { name: 'Coffee', price: 15 },
  ])
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Replace spreadsheet', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('replaced')
  expect(
    await (
      await page.request.get('/run/products', {
        headers: { authorization: `Bearer ${productsToken}` },
      })
    ).json(),
  ).toEqual([
    { name: 'Tea', price: 18 },
    { name: 'Coffee', price: 15 },
  ])
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Delete data source', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'used by a draft or published API',
  )
  await expect(
    page.getByRole('combobox', { name: 'Import method', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  await page
    .getByRole('combobox', { name: 'Import method', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Public Google Sheet', exact: true })
    .click()
  await page.getByLabel('Source name', { exact: true }).fill('Private sheet')
  await page
    .getByLabel('Google Sheets link', { exact: true })
    .fill('https://example.com/private')
  await page
    .getByRole('button', { name: 'Import Google Sheet', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('Google Sheets')
  expect(controlledWarnings).toEqual([])
  await page.getByLabel('API name', { exact: true }).fill('Products GraphQL')
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/products-graphql')
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Products GraphQL',
  )
  await expect(page.getByLabel('GraphQL schema', { exact: true })).toHaveCount(
    0,
  )
  await expect(
    page.getByLabel('GraphQL variables', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('"rows"')
  const generatedGraphql = JSON.parse(
    await page.getByTestId('test-result').innerText(),
  )
  expect(generatedGraphql.body).toEqual({
    data: {
      rows: [
        { name: 'Tea', price: 18, available: true },
        { name: 'Coffee', price: 15, available: false },
      ],
    },
  })
  await page
    .getByLabel('API name', { exact: true })
    .fill('Unsaved spreadsheet draft')
  const beforeDiscard = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  const afterDiscard = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()
  expect(afterDiscard.length).toBe(beforeDiscard.length)
  await page.getByRole('button', { name: /^API Studio/ }).click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Unsaved spreadsheet draft',
  )
  await page.getByLabel('API name', { exact: true }).fill('Products GraphQL')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Import method', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Public Google Sheet', exact: true })
    .click()
  const simulatedSheet = {
    ...products,
    id: 'simulated-google-ui',
    name: 'Simulated Google sample',
    kind: 'google-sheets',
    sourceUrl: 'https://docs.google.com/spreadsheets/d/simulated-ui-sheet/edit',
    version: 1,
    rows: [{ name: 'Simulated original', price: 5, available: true }],
    rowCount: 1,
  }
  await page.route('**/api/data-sources/google-sheets', (route) =>
    route.fulfill({ status: 200, json: simulatedSheet }),
  )
  await page
    .getByLabel('Source name', { exact: true })
    .fill(simulatedSheet.name)
  await page
    .getByLabel('Google Sheets link', { exact: true })
    .fill(simulatedSheet.sourceUrl)
  await page
    .getByRole('button', { name: 'Import Google Sheet', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Simulated original', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Refresh saved data', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  let simulatedRefreshes = 0
  await page.route(
    '**/api/data-sources/simulated-google-ui/refresh',
    (route) => {
      simulatedRefreshes++
      return route.fulfill({
        status: 200,
        json: {
          ...simulatedSheet,
          version: 2,
          rows: [{ name: 'Simulated refreshed', price: 6, available: true }],
        },
      })
    },
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await page
    .getByRole('button', { name: 'Refresh saved data', exact: true })
    .click()
  expect(simulatedRefreshes).toBe(0)
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Refresh saved data', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'Simulated refreshed', exact: true }),
  ).toBeVisible()
  expect(simulatedRefreshes).toBe(1)
  await page.unroute('**/api/data-sources/google-sheets')
  await page.unroute('**/api/data-sources/simulated-google-ui/refresh')
  await page.getByRole('button', { name: /^API Studio/ }).click()
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Filter by input', exact: true }),
  ).toBeVisible({ timeout: 5000 })
  await page
    .getByRole('checkbox', { name: 'Filter by input', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Filter column', exact: true })
    .click()
  await page.getByRole('option', { name: 'name', exact: true }).click()
  await page.getByLabel('Filter input name', { exact: true }).fill('product')
  await page.getByLabel('API name', { exact: true }).fill('Filtered products')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/products-filter')
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Filtered products',
  )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'Spreadsheet rows' })
    .click()
  await expect(
    page.getByRole('checkbox', { name: 'Filter rows', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('combobox', { name: 'Match value type', exact: true }),
  ).toContainText('From query parameter')
  await expect(page.getByLabel('Match value', { exact: true })).toHaveValue(
    'product',
  )
  await expect(page.getByLabel('Query name 1', { exact: true })).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Add query parameter', exact: true })
    .click()
  await page.getByLabel('Query name 1', { exact: true }).fill('product')
  await page.getByLabel('Query value 1', { exact: true }).fill('Tea')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Tea')
  const filteredDraft = JSON.parse(
    await page.getByTestId('test-result').innerText(),
  )
  expect(filteredDraft.body).toEqual([
    { name: 'Tea', price: 18, available: true },
  ])
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  const filteredFlows = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()
  const filteredFlow = filteredFlows.find(
    (flow: { name: string }) => flow.name === 'Filtered products',
  )
  const filteredGrant = await (
    await page.request.post('/api/runtime-keys', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        name: 'Filtered source caller',
        flowId: filteredFlow.id,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
  ).json()
  expect(
    await (
      await page.request.get('/run/products-filter?product=Tea', {
        headers: { authorization: `Bearer ${filteredGrant.token}` },
      })
    ).json(),
  ).toEqual([{ name: 'Tea', price: 18, available: true }])

  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Filter by input', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Filter column', exact: true })
    .click()
  await page.getByRole('option', { name: 'price', exact: true }).click()
  await page.getByLabel('Filter input name', { exact: true }).fill('price')
  await page.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await page
    .getByLabel('API name', { exact: true })
    .fill('Filtered GraphQL products')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/products-filter-graphql')
  await page
    .getByRole('button', { name: 'Create API from data', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Filtered GraphQL products',
  )
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Coffee')
  expect(
    JSON.parse(await page.getByTestId('test-result').innerText()).body.data
      .rows,
  ).toHaveLength(2)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  const graphProducts = await (
    await page.request.get('/api/flows', {
      headers: { authorization: `Bearer ${token}` },
    })
  ).json()
  const graphProduct = graphProducts.find(
    (flow: { name: string }) => flow.name === 'Filtered GraphQL products',
  )
  const graphProductGrant = await (
    await page.request.post('/api/runtime-keys', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        name: 'Filtered GraphQL caller',
        flowId: graphProduct.id,
        permissions: ['query'],
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
  ).json()
  expect(
    await (
      await page.request.post('/graphql/products-filter-graphql', {
        headers: { authorization: `Bearer ${graphProductGrant.token}` },
        data: { query: '{ rows(price:18) { name price } }' },
      })
    ).json(),
  ).toEqual({ data: { rows: [{ name: 'Tea', price: 18 }] } })

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByLabel('Member name').fill('Reviewer')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(page.getByLabel('New member token')).toBeVisible()
  const viewerToken = await page.getByLabel('New member token').inputValue()
  await page.getByRole('button', { name: 'I saved it', exact: true }).click()
  await page
    .getByRole('button', { name: 'Data & backups', exact: true })
    .click()
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'workspace setup', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Audit trail', exact: true }).click()
  await expect(
    page.getByRole('cell', { name: 'backup.created', exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('Unsaved idea')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: /Browser greeting/ }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Unsaved idea')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'New API', exact: true }).click()
  await page.getByLabel('API name').fill('GraphQL browser API')
  await page.getByLabel('Endpoint path').fill('/browser-graphql')
  await page.getByRole('combobox', { name: 'API type' }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await page
    .getByRole('button', { name: 'Advanced schema', exact: true })
    .click()
  await page
    .getByLabel('GraphQL schema')
    .fill(
      'type Query { greet(name: String!): Greeting! } type Mutation { greet(name: String!): Greeting! } type Greeting { message: String! name: String! }',
    )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
    .click()
  await page
    .getByRole('button', { name: 'Advanced configuration', exact: true })
    .click()
  await page
    .getByLabel('Node configuration')
    .fill(
      '{"status":200,"body":{"message":"GraphQL works","name":"$input.body.name"}}',
    )
  await page.getByRole('button', { name: 'Apply configuration' }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page
    .getByLabel('GraphQL operation', { exact: true })
    .fill('query Greeting($name: String!) { greet(name: $name) { name } }')
  await page
    .getByRole('button', { name: 'Advanced GraphQL input', exact: true })
    .click()
  await page.getByLabel('GraphQL variables').fill('{"name":"Ada"}')
  await page.getByLabel('GraphQL operation name').fill('Greeting')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('"name": "Ada"')
  await expect(page.getByTestId('test-result')).not.toContainText(
    'GraphQL works',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(
    '/graphql/browser-graphql',
  )
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await page.getByLabel('Key name').fill('GraphQL query caller')
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await page
    .getByRole('option', { name: 'GraphQL browser API', exact: true })
    .click()
  const queryPermission = page.getByRole('checkbox', {
    name: 'GraphQL queries',
  })
  const mutationPermission = page.getByRole('checkbox', {
    name: 'GraphQL mutations',
  })
  await expect(queryPermission).toHaveJSProperty('tagName', 'BUTTON')
  await expect(queryPermission).toBeChecked()
  await expect(mutationPermission).not.toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'REST requests' }),
  ).toHaveCount(0)
  await queryPermission.focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Space')
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const queryToken = await page.getByLabel('New API key').inputValue()
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const queryCall = await page.request.post('/graphql/browser-graphql', {
    headers: { authorization: `Bearer ${queryToken}` },
    data: {
      query:
        'query Read { greet(name: "Ada") { name } } mutation Write { greet(name: "Grace") { name } }',
      operationName: 'Read',
    },
  })
  expect(queryCall.status()).toBe(200)
  expect(await queryCall.json()).toEqual({ data: { greet: { name: 'Ada' } } })
  const mutationDenied = await page.request.post('/graphql/browser-graphql', {
    headers: { authorization: `Bearer ${queryToken}` },
    data: {
      query:
        'query Read { greet(name: "Ada") { name } } mutation Write { greet(name: "Grace") { name } }',
      operationName: 'Write',
    },
  })
  expect(mutationDenied.status()).toBe(403)
  expect(
    (
      await page.request.get('/run/browser-hello', {
        headers: { authorization: `Bearer ${queryToken}` },
      })
    ).status(),
  ).toBe(403)
  await mutationPermission.focus()
  await page.keyboard.press('Space')
  await expect(mutationPermission).toBeChecked()
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await page
    .getByRole('option', { name: 'Browser greeting', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', { name: 'REST requests' }),
  ).toBeChecked()
  await page.getByRole('combobox', { name: 'Published API' }).click()
  await page
    .getByRole('option', { name: 'GraphQL browser API', exact: true })
    .click()
  await expect(queryPermission).toBeChecked()
  await expect(mutationPermission).not.toBeChecked()
  await page.getByLabel('Key name').fill('Browser mutation caller')
  await mutationPermission.check()
  await queryPermission.uncheck()
  await page
    .getByRole('button', { name: 'Create API key', exact: true })
    .click()
  const mutationToken = await page.getByLabel('New API key').inputValue()
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  const graphql = await page.request.post('/graphql/browser-graphql', {
    headers: { authorization: `Bearer ${mutationToken}` },
    data: { query: 'mutation { greet(name: "Grace") { message name } }' },
  })
  expect(await graphql.json()).toEqual({
    data: { greet: { message: 'GraphQL works', name: 'Grace' } },
  })
  await page.getByRole('button', { name: /^API Studio/ }).click()
  await page.screenshot({ path: 'test-results/graphql.png', fullPage: true })
  expect(
    (
      await page.request.get('/run/browser-hello', {
        headers: { authorization: `Bearer ${viewerToken}` },
      })
    ).status(),
  ).toBe(401)
  expect(
    (
      await page.request.get('/api/runtime-keys', {
        headers: { authorization: `Bearer ${viewerToken}` },
      })
    ).status(),
  ).toBe(403)
  await page.getByRole('button', { name: /Sign out/ }).click()
  await page.getByLabel('Workspace token').fill(viewerToken)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Owner access required' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Create API key', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Editor access required' }),
  ).toBeVisible()
  expect(
    (
      await page.request.get('/api/data-sources', {
        headers: { authorization: `Bearer ${viewerToken}` },
      })
    ).status(),
  ).toBe(403)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^API Studio/ }).click()
  const savedApi = page.getByRole('combobox', { name: 'Saved API' })
  await expect(savedApi).toHaveJSProperty('tagName', 'BUTTON')
  await savedApi.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(savedApi).toBeFocused()
  await savedApi.click()
  await page.getByRole('option', { name: /Browser greeting/ }).click()
  await expect(page.getByLabel('API name')).toHaveValue('Browser greeting')
  await expect(page.getByTestId('flow-canvas')).toBeVisible()
  expect(
    (await page.getByTestId('flow-canvas').boundingBox())!.height,
  ).toBeGreaterThanOrEqual(300)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})
