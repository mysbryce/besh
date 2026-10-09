import { expect, type Page } from '@playwright/test'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function studioToolsPreviews({
  page,
  owner,
  capture,
}: {
  page: Page
  owner: string
  capture: Capture
}) {
  await page.setViewportSize({ width: 1440, height: 900 })
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: /^API Studio\b/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'New API', exact: true }).click()
  const tools = page.getByRole('button', { name: 'API tools', exact: true })
  await expect(tools).toHaveAttribute('aria-expanded', 'false')
  await expect(
    page.getByRole('button', { name: 'Use this API', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Generated backend', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.editor-panel')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Test flow', exact: true }),
  ).toBeVisible()
  const placement = await tools.evaluate((button) => ({
    tools: button.getBoundingClientRect().top,
    test: document.querySelector('.test-panel')!.getBoundingClientRect().bottom,
  }))
  expect(placement.tools).toBeGreaterThanOrEqual(placement.test)
  await capture(
    'API Studio',
    'Optional API tools stay below building and testing',
    'The canvas, draft actions and test form come first. Examples, exports, generated backend and release history open only when requested.',
  )
  await page.getByLabel('API name', { exact: true }).fill('Studio tools API')
  await page
    .getByLabel('Endpoint path', { exact: true })
    .fill('/studio-tools-preview')
  const savedReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/flows' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const saved = await savedReceipt
  expect(saved.status()).toBe(200)
  const flow = (await saved.json()) as { id: string }
  const testReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${flow.id}/test` &&
      response.request().method() === 'POST',
  )
  await expect(
    page.getByRole('button', { name: 'Test flow', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Test flow', exact: true }).click()
  expect((await testReceipt).status()).toBe(200)
  await expect(page.getByTestId('test-result')).toContainText('"status": 200')
  const publishedReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/flows/${flow.id}/publish` &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  expect((await publishedReceipt).status()).toBe(200)
  await expect(
    page.getByText('Published endpoint URL', { exact: false }),
  ).toBeVisible()
  await tools.click()
  await expect(tools).toHaveAttribute('aria-expanded', 'true')
  const toolPanel = page.getByRole('region', { name: 'API tools', exact: true })
  await expect(
    toolPanel.getByRole('button', { name: 'Use this API', exact: true }),
  ).toBeEnabled()
  await expect(
    toolPanel.getByRole('button', { name: 'Generated backend', exact: true }),
  ).toBeEnabled()
  const exampleReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${flow.id}/client-code` &&
      response.request().method() === 'GET',
  )
  await toolPanel
    .getByRole('button', { name: 'Use this API', exact: true })
    .click()
  expect((await exampleReceipt).status()).toBe(200)
  await expect(
    page.getByRole('combobox', { name: 'Example source', exact: true }),
  ).toBeVisible()
  const backendReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/flows/${flow.id}/backend-code` &&
      response.request().method() === 'GET',
  )
  await toolPanel
    .getByRole('button', { name: 'Generated backend', exact: true })
    .click()
  expect((await backendReceipt).status()).toBe(200)
  await expect(
    page.getByRole('button', { name: 'Copy backend code', exact: true }),
  ).toBeEnabled()
  await capture(
    'API Studio',
    'Requested API tools retain real published exports',
    'The same saved and tested release provides actual client metadata and generated backend code. Optional disclosure does not change publication or authentication.',
  )
  await tools.click()
  await expect(toolPanel).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Test flow', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByText('Published endpoint URL', { exact: false }),
  ).toBeVisible()
  await expect(page.getByTestId('test-result')).toContainText('"status": 200')
  await capture(
    'API Studio',
    'Closing API tools keeps current work visible',
    'The current response, published URL and main actions stay available when optional tools are closed.',
  )
}
