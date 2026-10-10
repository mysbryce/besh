import { expect, type Page } from '@playwright/test'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

export async function nodePickerPreviews({
  page,
  owner,
  capture,
}: {
  page: Page
  owner: string
  capture: Capture
}) {
  if (await page.getByRole('button', { name: 'Sign out', exact: true }).count())
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
  await page.getByLabel('API name', { exact: true }).fill('Node picker example')
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/flows' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  const picker = page.getByRole('dialog', {
    name: 'Choose a step',
    exact: true,
  })
  await expect(picker).toBeVisible()
  const search = picker.getByLabel('Search steps', { exact: true })
  await expect(search).toBeFocused()
  await search.fill('Spreadsheet')
  await expect(
    picker.getByRole('button', { name: 'Add Spreadsheet rows', exact: true }),
  ).toBeVisible()
  await capture(
    'API Studio',
    'Search the categorized step picker',
    'A saved draft opens a focused searchable catalog. Choosing a step changes only the editable draft; saving and publication remain explicit.',
  )
  const sourceCatalog = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/data-sources' &&
      response.request().method() === 'GET',
  )
  await picker
    .getByRole('button', { name: 'Add Spreadsheet rows', exact: true })
    .click()
  const loadedCatalog = await sourceCatalog
  expect(loadedCatalog.status()).toBe(200)
  expect(await loadedCatalog.json()).toEqual([])
  await expect(picker).toHaveCount(0)
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await expect(
    page.getByRole('heading', { name: 'Spreadsheet rows', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Unsaved changes', { exact: false }),
  ).toBeVisible()
  await expect(page.locator('.inspector')).toContainText(
    'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.',
  )
  await expect(page.locator('.inspector')).not.toContainText(
    'Loading saved source details…',
  )
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await expect
    .poll(async () => {
      const canvas = await page.getByTestId('flow-canvas').boundingBox()
      const boxes = await Promise.all(
        (await page.locator('.react-flow__node').all()).map((node) =>
          node.boundingBox(),
        ),
      )
      return (
        !!canvas &&
        boxes.length === 3 &&
        boxes.every(
          (box) =>
            !!box &&
            box.x >= canvas.x - 1 &&
            box.y >= canvas.y - 1 &&
            box.x + box.width <= canvas.x + canvas.width + 1 &&
            box.y + box.height <= canvas.y + canvas.height + 1,
        )
      )
    })
    .toBe(true)
  await capture(
    'API Studio',
    'Choose a step and configure its draft',
    'Selection closes the picker and opens the chosen spreadsheet step settings. The added step is an unsaved draft change; publishing remains explicit.',
  )
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await picker.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(picker).toContainText('No favorite steps yet.')
  await picker.getByRole('button', { name: 'All steps', exact: true }).click()
  await picker
    .getByRole('button', { name: 'Favorite Spreadsheet rows', exact: true })
    .click()
  await picker.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(
    picker.getByRole('heading', { name: 'Spreadsheet rows', exact: true }),
  ).toBeVisible()
  await expect(
    picker.getByRole('heading', { name: 'SQLite rows', exact: true }),
  ).toHaveCount(0)
  await capture(
    'API Studio',
    'Favorite steps stay easy to find',
    'Favorite selection stores built-in descriptor IDs only. Favorites filter shows chosen steps without changing the editable graph.',
  )
  await picker
    .getByRole('button', { name: 'Close step picker', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeFocused()

  page.once('dialog', (dialog) => void dialog.accept())
  await page.reload()
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await picker.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(
    picker.getByRole('heading', { name: 'Spreadsheet rows', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('besh-node-favorites') || '[]'),
    ),
  ).toEqual(['builtin.data'])
  await picker
    .getByRole('button', {
      name: 'Remove Spreadsheet rows from favorites',
      exact: true,
    })
    .focus()
  await page.keyboard.press('Space')
  await expect(picker).toContainText('No favorite steps yet.')
  await capture(
    'API Studio',
    'Remove a favorite with the keyboard',
    'A persisted favorite survives reload. Space on its custom favorite control removes only the descriptor preference, leaving the saved API unchanged.',
  )
  await picker.getByRole('button', { name: 'All steps', exact: true }).click()
  await picker.getByRole('button', { name: 'API', exact: true }).click()
  await expect(picker.getByRole('heading')).toHaveCount(3)
  await expect(
    picker.getByRole('button', { name: 'Add HTTP request', exact: true }),
  ).toBeDisabled()
  await expect(picker).toContainText('This API already has a starting step.')
  await capture(
    'API Studio',
    'Category view explains unavailable steps',
    'API category shows supported request and response steps. The existing starting request is disabled with a plain explanation.',
  )
  await picker
    .getByLabel('Search steps', { exact: true })
    .fill('No such future plugin')
  await expect(picker).toContainText('No steps found.')
  await capture(
    'API Studio',
    'No matching step leaves the draft unchanged',
    'Search has an explicit empty state. Built-in catalog contains supported steps only; no installed plugin or arbitrary executor is implied.',
  )
  await page.keyboard.press('Escape')
  await expect(picker).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeFocused()
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: 390, height: 844 })
  for (const theme of ['Light', 'Dark', 'System']) {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: theme, exact: true }).click()
    await page.getByRole('button', { name: 'Add step', exact: true }).click()
    await expect(
      picker.getByLabel('Search steps', { exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect
      .poll(() =>
        picker.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true)
    const bounds = await picker.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
    for (const button of await picker.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        bounds!.x + bounds!.width + 1,
      )
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await capture(
      'API Studio',
      `Phone ${theme.toLowerCase()} categorized step picker`,
      'Native 390px viewport keeps search, category controls and full step names inside the modal. Keyboard focus remains in the dialog; mobile controls retain touch targets.',
      { fullPage: false },
    )
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Add step', exact: true }),
    ).toBeFocused()
  }
  await page.setViewportSize(viewport)
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()

  let releaseDelivery!: () => void
  let observedReceipt!: () => void
  const delivery = new Promise<void>((resolve) => {
    releaseDelivery = resolve
  })
  const receipt = new Promise<void>((resolve) => {
    observedReceipt = resolve
  })
  let finishHandler!: () => void
  const handled = new Promise<void>((resolve) => {
    finishHandler = resolve
  })
  const holdSave = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const response = await route.fetch({ maxRedirects: 0 })
    expect(response.status()).toBe(200)
    observedReceipt()
    await delivery
    await route.fulfill({ response })
    finishHandler()
  }
  await page.route('**/api/flows/*', holdSave)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await receipt
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeDisabled()
  await capture(
    'API Studio',
    'Pending save blocks opening the step picker',
    'A real saved-draft PUT is committed while response delivery is held. Picker entry and navigation stay disabled until the owned delivery settles.',
  )
  releaseDelivery()
  await handled
  await page.unroute('**/api/flows/*', holdSave)
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeEnabled()
  await capture(
    'API Studio',
    'Compact desktop studio keeps main actions visible',
    'Desktop spacing keeps the current API name, route and Save/Test/Publish controls accessible. Optional API tools remain below the canvas and test.',
  )

  const origin = new URL(page.url()).origin
  const memberResponse = await page.request.post(`${origin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Step picker viewer', role: 'viewer' },
  })
  expect(memberResponse.status()).toBe(200)
  const viewer = (await memberResponse.json()) as { token: string }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(viewer.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Node picker example',
  )
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeDisabled()
  await capture(
    'API Studio',
    'Read-only members cannot add steps',
    'Viewer can inspect the shared saved API. Picker entry, saving and publication remain guarded by their independent action grants.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
}
