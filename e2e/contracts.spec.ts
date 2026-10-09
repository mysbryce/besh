import { openApiTools } from './api-tools'
import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('REST API rules are optional and editable through labeled forms', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const directory = mkdtempSync(join(tmpdir(), 'besh-contract-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4312'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4312',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: token,
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((resolve) => {
    server.once('exit', () => resolve())
    server.once('error', () => resolve())
  })

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(`${backend}/health`)).status()
        } catch {
          return 0
        }
      })
      .toBe(200)
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (
        !/^\/(api\/|auth\/|setup\/|health$|run\/|graphql\/)/.test(url.pathname)
      ) {
        await route.continue()
        return
      }
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
      })
      await route.fulfill({ response })
    })
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await openApiTools(page)
    await expect(
      page.getByRole('button', { name: 'Download OpenAPI', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('checkbox', {
        name: 'Validate query parameters',
        exact: true,
      }),
    ).not.toBeChecked()
    await page
      .getByRole('checkbox', { name: 'Validate query parameters', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Add Query field', exact: true })
      .click()
    await page.getByLabel('Query field name 1', { exact: true }).fill('count')
    await page
      .getByRole('combobox', { name: 'Query field 1 type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Query field 1 required', exact: true })
      .check()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await expect(
      page.getByRole('button', { name: 'Download OpenAPI', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('combobox', { name: 'OpenAPI source', exact: true })
      .click()
    await page.getByRole('option', { name: /^Saved draft/ }).click()
    const downloadPromise = page.waitForEvent('download')
    await openApiTools(page)
    await page
      .getByRole('button', { name: 'Download OpenAPI', exact: true })
      .click()
    const download = await downloadPromise
    const document = JSON.parse(readFileSync((await download.path())!, 'utf8'))
    expect(document.openapi).toBe('3.1.1')
    expect(document.paths['/run/hello'].get.parameters[0]).toMatchObject({
      name: 'count',
      required: true,
      schema: { type: 'integer' },
    })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await expect(
      page.getByLabel('Query field name 1', { exact: true }),
    ).toHaveValue('count')
    await expect(
      page.getByRole('combobox', { name: 'Query field 1 type', exact: true }),
    ).toHaveText('Whole number')
    await page
      .getByRole('combobox', { name: 'HTTP method', exact: true })
      .click()
    await page.getByRole('option', { name: 'POST', exact: true }).click()
    await expect(
      page.getByRole('checkbox', {
        name: 'Validate request body',
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole('checkbox', { name: 'Validate request body', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Add Body field', exact: true })
      .click()
    await page.getByLabel('Body field name 1', { exact: true }).fill('quantity')
    await page
      .getByRole('combobox', { name: 'Body field 1 type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Body field 1 required', exact: true })
      .check()
    await page
      .getByRole('checkbox', { name: 'Validate response', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Add Response field', exact: true })
      .click()
    await page
      .getByLabel('Response field name 1', { exact: true })
      .fill('message')
    await page
      .getByRole('checkbox', { name: 'Response field 1 required', exact: true })
      .check()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('query.count')
    await page
      .getByRole('button', { name: 'Add query parameter', exact: true })
      .click()
    await page.getByLabel('Query name 1', { exact: true }).fill('count')
    await page.getByLabel('Query value 1', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('body.quantity')
    await page
      .getByRole('button', { name: 'Add body field', exact: true })
      .click()
    await page.getByLabel('Body name 1', { exact: true }).fill('quantity')
    await page.getByLabel('Body value 1', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('body.quantity')
    await page
      .getByRole('combobox', { name: 'Body type 1', exact: true })
      .click()
    await page.getByRole('option', { name: 'Number', exact: true }).click()
    await page.getByLabel('Body value 1', { exact: true }).fill('4')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText('Hello, Besh!')

    await page
      .getByRole('combobox', { name: 'Response field 1 type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Whole number', exact: true })
      .click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await expect(page.getByLabel('Body value 1', { exact: true })).toHaveValue(
      '4',
    )
    const mismatchResponse = page.waitForResponse((response) =>
      /\/api\/flows\/[^/]+\/test$/.test(new URL(response.url()).pathname),
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    expect((await mismatchResponse).status()).toBe(500)
    await expect(page.getByRole('status')).toContainText(
      'Response does not match response rules',
    )
    await page
      .getByRole('combobox', { name: 'Response field 1 type', exact: true })
      .click()
    await page.getByRole('option', { name: 'Text', exact: true }).click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    const headers = { authorization: `Bearer ${token}` }
    const flows = await (
      await page.request.get(`${backend}/api/flows`, { headers })
    ).json()
    const flow = flows[0]
    const key = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'Contract caller',
          flowId: flow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    const runtime = await page.request.post(`${backend}/run/hello?count=3`, {
      headers: { authorization: `Bearer ${key.token}` },
      data: { quantity: 4 },
    })
    expect(runtime.status()).toBe(200)
    expect(await runtime.json()).toEqual({ message: 'Hello, Besh!' })
    expect(
      (
        await page.request.post(`${backend}/run/hello?count=3`, {
          headers: { authorization: `Bearer ${key.token}` },
          data: { quantity: '4' },
        })
      ).status(),
    ).toBe(400)

    async function downloadDocument(source: 'draft' | 'published') {
      await openApiTools(page)
      await page
        .getByRole('combobox', { name: 'OpenAPI source', exact: true })
        .click()
      await page
        .getByRole('option', {
          name: source === 'draft' ? /^Saved draft/ : /^Published release/,
        })
        .click()
      const ready = page.waitForEvent('download')
      await openApiTools(page)
      await page
        .getByRole('button', { name: 'Download OpenAPI', exact: true })
        .click()
      return JSON.parse(readFileSync((await (await ready).path())!, 'utf8'))
    }
    const published = await downloadDocument('published')
    expect(
      published.paths['/run/hello'].post.requestBody.content['application/json']
        .schema.required,
    ).toEqual(['quantity'])
    await page
      .getByLabel('Endpoint path', { exact: true })
      .fill('/contract-draft')
    await page
      .getByRole('checkbox', { name: 'Body field 1 allow null', exact: true })
      .check()
    expect(await downloadDocument('published')).toEqual(published)
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    const draft = await downloadDocument('draft')
    expect(
      draft.paths['/run/contract-draft'].post.requestBody.content[
        'application/json'
      ].schema.properties.quantity.type,
    ).toEqual(['integer', 'null'])
    expect(await downloadDocument('published')).toEqual(published)
    expect(
      (
        await page.request.post(`${backend}/run/hello?count=3`, {
          headers: { authorization: `Bearer ${key.token}` },
          data: { quantity: null },
        })
      ).status(),
    ).toBe(400)

    await page
      .getByLabel('Query field name 1', { exact: true })
      .fill('bad-name')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('field names need')
    await page.getByLabel('Query field name 1', { exact: true }).fill('count')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    const queryField = page.getByRole('group', {
      name: 'Query field 1',
      exact: true,
    })
    await queryField
      .getByText('Limits and description', { exact: true })
      .click()
    await page.getByLabel('Query field 1 minimum', { exact: true }).fill('10')
    await page.getByLabel('Query field 1 maximum', { exact: true }).fill('2')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      'minimum must not exceed maximum',
    )
    await page.getByLabel('Query field 1 minimum', { exact: true }).fill('')
    await page.getByLabel('Query field 1 maximum', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    for (const appearance of ['Dark', 'Light']) {
      await page
        .getByRole('combobox', { name: 'Appearance', exact: true })
        .click()
      await page.getByRole('option', { name: appearance, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        appearance.toLowerCase(),
      )
      await expect(
        page.getByLabel('Query field name 1', { exact: true }),
      ).toBeVisible()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await page
      .getByRole('checkbox', { name: 'Query field 1 required', exact: true })
      .focus()
    await page.keyboard.press('Space')
    await expect(
      page.getByRole('checkbox', {
        name: 'Query field 1 required',
        exact: true,
      }),
    ).not.toBeChecked()
    await page.keyboard.press('Space')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page.setViewportSize({ width: 1440, height: 1000 })

    const viewer = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: 'Contract reviewer', role: 'viewer' },
      })
    ).json()
    await page.getByRole('button', { name: /Sign out/ }).click()
    await page.getByLabel('Workspace token').fill(viewer.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await expect(
      page.getByLabel('Body field name 1', { exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('checkbox', { name: 'Validate response', exact: true }),
    ).toBeDisabled()
    expect(await downloadDocument('published')).toEqual(published)
    await page.getByRole('button', { name: /Sign out/ }).click()
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()

    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('combobox', { name: 'API type', exact: true }).click()
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await expect(
      page.getByRole('combobox', { name: 'API type', exact: true }),
    ).toHaveText('REST')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('combobox', { name: 'API type', exact: true }).click()
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'API rules', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    const graphDraft = await (
      await page.request.get(`${backend}/api/flows/${flow.id}`, { headers })
    ).json()
    expect(graphDraft.contract).toBeUndefined()
    expect(graphDraft.graphql).toBeDefined()
    expect(await downloadDocument('published')).toEqual(published)
    await page.getByRole('button', { name: 'New API', exact: true }).click()
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await openApiTools(page)
    await expect(
      page.getByRole('checkbox', {
        name: 'Validate query parameters',
        exact: true,
      }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('button', { name: 'Download OpenAPI', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('combobox', { name: 'HTTP method', exact: true })
      .click()
    await page.getByRole('option', { name: 'POST', exact: true }).click()
    await page.getByLabel('API name', { exact: true }).fill('List rules')
    await page.getByLabel('Endpoint path', { exact: true }).fill('/list-rules')
    await page
      .getByRole('checkbox', { name: 'Validate request body', exact: true })
      .check()
    await page.getByRole('combobox', { name: 'Body type', exact: true }).click()
    await page
      .getByRole('option', { name: 'List of items', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Add Body item field', exact: true })
      .click()
    await page.getByLabel('Body item field name 1', { exact: true }).fill('sku')
    await page
      .getByRole('checkbox', {
        name: 'Body item field 1 required',
        exact: true,
      })
      .check()
    await page
      .getByRole('checkbox', {
        name: 'Body item field 1 allow null',
        exact: true,
      })
      .check()
    await page
      .getByRole('group', { name: 'Body item field 1', exact: true })
      .getByText('Limits and description', { exact: true })
      .click()
    await page
      .getByLabel('Body item field 1 maxLength', { exact: true })
      .fill('8')
    await page
      .getByRole('button', { name: 'Add Body item field', exact: true })
      .click()
    await page
      .getByLabel('Body item field name 2', { exact: true })
      .fill('details')
    await page
      .getByRole('combobox', { name: 'Body item field 2 type', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Object with fields', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Add Body item field 2 field', exact: true })
      .click()
    await page
      .getByLabel('Body item field 2 field name 1', { exact: true })
      .fill('color')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    const listFlows = await (
      await page.request.get(`${backend}/api/flows`, { headers })
    ).json()
    expect(
      listFlows.find((item: { name: string }) => item.name === 'List rules')
        .contract.body,
    ).toEqual({
      type: 'array',
      items: {
        type: 'object',
        required: ['sku'],
        properties: {
          sku: { type: 'string', nullable: true, maxLength: 8 },
          details: {
            type: 'object',
            properties: { color: { type: 'string' } },
          },
        },
      },
    })
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'API rules', exact: true }).click()
    await expect(
      page.getByRole('combobox', { name: 'Body type', exact: true }),
    ).toHaveText('List of items')
    await expect(
      page.getByLabel('Body item field 2 field name 1', { exact: true }),
    ).toHaveValue('color')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('combobox', { name: 'HTTP method', exact: true })
      .click()
    await page.getByRole('option', { name: 'GET', exact: true }).click()
    await expect(
      page.getByRole('combobox', { name: 'HTTP method', exact: true }),
    ).toHaveText('POST')
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('combobox', { name: 'HTTP method', exact: true })
      .click()
    await page.getByRole('option', { name: 'GET', exact: true }).click()
    await expect(
      page.getByRole('checkbox', {
        name: 'Validate request body',
        exact: true,
      }),
    ).not.toBeChecked()
    expect(errors).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
