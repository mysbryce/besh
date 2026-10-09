import { expect, type Page } from '@playwright/test'

type Capture = (group: string, title: string, detail: string) => Promise<void>

export async function studioFirstTaskPreviews({
  page,
  owner,
  apiOrigin,
  capture,
  signedIn = false,
  importSpreadsheet = true,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: Capture
  signedIn?: boolean
  importSpreadsheet?: boolean
}) {
  const headers = { authorization: `Bearer ${owner}` }
  async function signIn(token: string) {
    await page.getByLabel('Workspace token', { exact: true }).fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: /^API Studio\b/ }),
    ).toBeVisible()
  }
  async function noSavedApis() {
    const response = await page.request.get(`${apiOrigin}/api/flows`, {
      headers,
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual([])
  }

  if (!signedIn) await signIn(owner)
  const firstTask = page.getByRole('region', {
    name: 'Create your first API',
    exact: true,
  })
  await expect(firstTask).toBeVisible()
  await expect(
    firstTask.getByRole('button', {
      name: 'Start with a spreadsheet',
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    firstTask.getByRole('button', { name: 'Build a blank API', exact: true }),
  ).toBeEnabled()
  await noSavedApis()
  await capture(
    'API Studio',
    'Empty studio offers a useful first task',
    'Choose an existing spreadsheet workflow or an unsaved blank API. Opening the workspace does not save or publish an API.',
  )
  await firstTask
    .getByRole('button', { name: 'Start with a spreadsheet', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Data sources', exact: true }),
  ).toBeVisible()
  if (importSpreadsheet) {
    await page
      .getByLabel('Source name', { exact: true })
      .fill('First task people')
    await page.getByLabel('Spreadsheet file', { exact: true }).setInputFiles({
      name: 'first-task.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,city\nAda,London\n'),
    })
    const imported = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/data-sources/import' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Import spreadsheet', exact: true })
      .click()
    expect((await imported).status()).toBe(200)
    await expect(
      page.getByRole('cell', { name: 'Ada', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create API from data', exact: true }),
    ).toBeEnabled()
    await noSavedApis()
    await capture(
      'Data sources',
      'First spreadsheet import keeps API creation explicit',
      'The actual CSV import shows Ada and London in the existing preview. No API draft is saved until the owner chooses Create API from data.',
    )
  } else {
    await expect(
      page.getByLabel('Spreadsheet file', { exact: true }),
    ).toBeVisible()
    await noSavedApis()
    await capture(
      'Data sources',
      'Spreadsheet path opens the existing import form',
      'The first-task shortcut opens the ordinary spreadsheet form. No import or API draft is created by navigation; the existing import journey follows later.',
    )
  }
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await firstTask
    .getByRole('button', { name: 'Build a blank API', exact: true })
    .click()
  await expect(firstTask).toHaveCount(0)
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Untitled API',
  )
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeDisabled()
  await noSavedApis()
  await capture(
    'API Studio',
    'Blank API starts without autosave',
    'The ordinary request and response starter is ready to edit. Save remains an explicit action and publication is unavailable until a draft is saved.',
  )

  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: 'Blank API builder',
      permissions: ['flows.read', 'flows.write'],
    },
  })
  expect(roleResponse.status()).toBe(200)
  const role = (await roleResponse.json()) as { id: string }
  const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: { name: 'Blank-only builder', role: 'custom', roleId: role.id },
  })
  expect(memberResponse.status()).toBe(200)
  const member = (await memberResponse.json()) as { token: string }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  let sourceReads = 0
  const observeSources = (request: { url(): string; method(): string }) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname.startsWith('/api/data-sources')
    )
      sourceReads++
  }
  page.on('request', observeSources)
  await signIn(member.token)
  await expect(
    firstTask.getByRole('button', { name: 'Build a blank API', exact: true }),
  ).toBeEnabled()
  await expect(
    firstTask.getByRole('button', {
      name: 'Start with a spreadsheet',
      exact: true,
    }),
  ).toHaveCount(0)
  expect(sourceReads).toBe(0)
  await capture(
    'Permissions',
    'First task respects spreadsheet grants',
    'A member who can build APIs but cannot read or import spreadsheets sees only the blank path. The studio performs no private source reads.',
  )
  page.off('request', observeSources)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await signIn(owner)
}
