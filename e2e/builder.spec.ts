import { expect, test } from '@playwright/test'

test('build, move, save, test and publish a flow through the dashboard', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
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
  await page
    .getByLabel('Node configuration')
    .fill('{"status":201,"body":{"message":"Built in Besh"}}')
  await page.getByRole('button', { name: 'Apply configuration' }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  await expect(page.getByTestId('test-result')).toContainText('Built in Besh')
  await expect(page.getByTestId('test-result')).toContainText('201')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published')
  const live = await page.request.get('/run/browser-hello', {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(live.status()).toBe(201)
  expect(await live.json()).toEqual({ message: 'Built in Besh' })

  await page.reload()
  await page.getByLabel('Workspace token').fill(token)
  await page.getByRole('button', { name: 'Open workspace' }).click()
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

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByLabel('Member name').fill('Reviewer')
  await page.getByRole('button', { name: 'Add member', exact: true }).click()
  await expect(page.getByLabel('New member token')).toBeVisible()
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
    .getByLabel('GraphQL schema')
    .fill(
      'type Query { greet(name: String!): Greeting! } type Mutation { greet(name: String!): Greeting! } type Greeting { message: String! name: String! }',
    )
  await page
    .locator('.react-flow__node')
    .filter({ hasText: 'JSON response' })
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
  const graphql = await page.request.post('/graphql/browser-graphql', {
    headers: { authorization: `Bearer ${token}` },
    data: { query: 'mutation { greet(name: "Grace") { message name } }' },
  })
  expect(await graphql.json()).toEqual({
    data: { greet: { message: 'GraphQL works', name: 'Grace' } },
  })
  await page.screenshot({ path: 'test-results/graphql.png', fullPage: true })
  expect(errors).toEqual([])
})
