import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const loginMutation =
  'mutation Login($action: LoginAction!, $code: String, $state: String, $proof: String) { login(action: $action, code: $code, state: $state, proof: $proof) { authorizationUrl state proof identity { provider subject username } } }'

test('owners connect GitHub for product APIs through labeled forms', async ({
  page,
}) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-product-login-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4315'
  const errors: string[] = []
  page.on('pageerror', (failure) => errors.push(failure.message))
  const server = spawn('bun', ['e2e/product-auth-server.ts'], {
    env: {
      ...process.env,
      PORT: '4315',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: token,
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'oauth-test.key'),
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
      const response = await route
        .fetch({
          url: `${backend}${url.pathname}${url.search}`,
        })
        .catch(() => null)
      if (!response) {
        await route.abort('failed')
        return
      }
      await route.fulfill({ response })
    })
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Connect GitHub', exact: true })
      .click()
    await page.getByLabel('Connection name', { exact: true }).fill('My product')
    await page
      .getByLabel('GitHub client ID', { exact: true })
      .fill('disposable-browser-client')
    await page
      .getByLabel('GitHub client secret', { exact: true })
      .fill('disposable-browser-secret')
    await page
      .getByLabel('Callback URL', { exact: true })
      .fill('http://127.0.0.1:3000/login/callback')
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'My product', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel('GitHub client secret', { exact: true }),
    ).toHaveCount(0)
    const connections = await (
      await page.request.get(`${backend}/api/auth-connections`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json()
    expect(connections[0]).toMatchObject({
      name: 'My product',
      provider: 'github',
      clientId: 'disposable-browser-client',
    })
    expect(JSON.stringify(connections)).not.toContain(
      'disposable-browser-secret',
    )
    await page
      .getByRole('button', { name: 'Edit connection', exact: true })
      .click()
    await expect(
      page.getByLabel('GitHub client secret', { exact: true }),
    ).toHaveValue('')
    await page
      .getByLabel('Callback URL', { exact: true })
      .fill('http://example.com/callback')
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page
      .getByRole('button', { name: 'Edit connection', exact: true })
      .click()
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Updated product')
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Updated product', exact: true }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Delete connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Updated product', exact: true }),
    ).toBeVisible()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Updated product', exact: true }),
    ).toHaveCount(0)
    await page.request.post(`${backend}/api/auth-connections`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        name: 'Login provider',
        provider: 'github',
        clientId: 'disposable-browser-client',
        clientSecret: 'disposable-browser-secret',
        redirectUri: 'http://127.0.0.1:3000/login/callback',
      },
    })
    await page.getByRole('button', { name: 'API Studio', exact: true }).click()
    await page.getByLabel('API name', { exact: true }).fill('Unsaved idea')
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Create login API', exact: true })
      .click()
    page.once('dialog', (dialog) => dialog.dismiss())
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'GitHub product login' }),
    ).toBeVisible()
    expect(
      (
        await (
          await page.request.get(`${backend}/api/flows`, {
            headers: { authorization: `Bearer ${token}` },
          })
        ).json()
      ).length,
    ).toBe(0)
    page.once('dialog', (dialog) => dialog.accept())
    let releaseGeneration: () => void = () => {}
    let reachedGeneration: () => void = () => {}
    const generationGate = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })
    const generationReached = new Promise<void>((resolve) => {
      reachedGeneration = resolve
    })
    await page.route(
      '**/api/auth-connections/*/generate',
      async (route) => {
        reachedGeneration()
        await generationGate
        await route.fallback()
      },
      { times: 1 },
    )
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await generationReached
    try {
      await page
        .getByRole('button', { name: 'API Studio', exact: true })
        .click()
      await expect(page.getByLabel('API name', { exact: true })).toBeDisabled()
    } finally {
      releaseGeneration()
    }
    await expect(
      page.getByRole('heading', { name: /API Studio/ }),
    ).toBeVisible()
    await expect(page.locator('.flow-card.social')).toContainText(
      'GitHub login',
    )
    await page.locator('.flow-card.social').click()
    await expect(
      page.getByRole('combobox', { name: 'GitHub connection', exact: true }),
    ).toHaveText('Login provider')
    const beginResponse = page.waitForResponse(
      (response) =>
        /\/api\/flows\/[^/]+\/test$/.test(response.url()) &&
        response.request().method() === 'POST',
    )
    await expect(
      page.getByRole('combobox', { name: 'Login action', exact: true }),
    ).toHaveText('BEGIN · Start login')
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    const begin = (await (await beginResponse).json()).body
    expect(begin.authorizationUrl).toMatch(
      /^https:\/\/github.com\/login\/oauth\/authorize\?/,
    )
    await expect(page.getByTestId('test-result')).not.toContainText(begin.proof)
    await expect(page.getByTestId('test-result')).not.toContainText(begin.state)
    await page
      .getByRole('combobox', { name: 'Login action', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'COMPLETE · Finish login', exact: true })
      .click()
    await page
      .getByLabel('Authorization code', { exact: true })
      .fill('simulated-provider-code')
    await page.getByLabel('OAuth state', { exact: true }).fill(begin.state)
    await page.getByLabel('Login proof', { exact: true }).fill(begin.proof)
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText(
      'simulated-github-user',
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      'Invalid or expired product login attempt',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    const headers = { authorization: `Bearer ${token}` }
    const flows = await (
      await page.request.get(`${backend}/api/flows`, { headers })
    ).json()
    const restFlow = flows[0]
    const restKey = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'Product server',
          flowId: restFlow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    expect(
      (
        await page.request.post(`${backend}/run/login/github`, {
          headers,
          data: { action: 'BEGIN' },
        })
      ).status(),
    ).toBe(401)
    const restHeaders = { authorization: `Bearer ${restKey.token}` }
    const liveBegin = await (
      await page.request.post(`${backend}/run/login/github`, {
        headers: restHeaders,
        data: { action: 'BEGIN' },
      })
    ).json()
    const completeInput = {
      action: 'COMPLETE',
      code: 'simulated-provider-code',
      state: liveBegin.state,
      proof: liveBegin.proof,
    }
    const liveComplete = await page.request.post(
      `${backend}/run/login/github`,
      { headers: restHeaders, data: completeInput },
    )
    expect(liveComplete.status()).toBe(200)
    expect((await liveComplete.json()).identity).toMatchObject({
      provider: 'github',
      subject: '4242',
      username: 'simulated-github-user',
    })
    expect(
      (
        await page.request.post(`${backend}/run/login/github`, {
          headers: restHeaders,
          data: completeInput,
        })
      ).status(),
    ).toBe(400)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('combobox', { name: 'API type', exact: true }).click()
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Draft saved')
    await page
      .getByRole('combobox', { name: 'Login action', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'BEGIN · Start login', exact: true })
      .click()
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(
      'GraphQL test complete · 200 response',
    )
    await expect(page.getByTestId('test-result')).toContainText(
      'authorizationUrl',
    )
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('button', { name: 'Delete connection', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('referenced')
    await page
      .getByRole('button', { name: 'Create login API', exact: true })
      .click()
    await page
      .getByLabel('API name', { exact: true })
      .fill('GraphQL product login')
    await page.getByRole('combobox', { name: 'API type', exact: true }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(
      page.getByRole('option', { name: 'REST', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('End')
    await expect(
      page.getByRole('option', { name: 'GraphQL', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('combobox', { name: 'API type', exact: true }),
    ).toHaveText('GraphQL')
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'GraphQL product login',
    )
    await expect(
      page.getByRole('combobox', { name: 'Login action', exact: true }),
    ).toHaveText('BEGIN · Start login')
    const graphBeginResponse = page.waitForResponse(
      (response) =>
        /\/graphql\/test$/.test(response.url()) &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    const graphBegin = (await (await graphBeginResponse).json()).body.data.login
    expect(graphBegin.authorizationUrl).toContain(
      'github.com/login/oauth/authorize',
    )
    await expect(page.getByTestId('test-result')).not.toContainText(
      graphBegin.proof,
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Published')
    const graphFlow = (
      await (await page.request.get(`${backend}/api/flows`, { headers })).json()
    ).find((flow: { name: string }) => flow.name === 'GraphQL product login')
    const graphKey = await (
      await page.request.post(`${backend}/api/runtime-keys`, {
        headers,
        data: {
          name: 'GraphQL product server',
          flowId: graphFlow.id,
          permissions: ['mutation'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      })
    ).json()
    const graphHeaders = { authorization: `Bearer ${graphKey.token}` }
    const graphLiveBegin = (
      await (
        await page.request.post(`${backend}/graphql/login/github`, {
          headers: graphHeaders,
          data: { query: loginMutation, variables: { action: 'BEGIN' } },
        })
      ).json()
    ).data.login
    const graphComplete = await page.request.post(
      `${backend}/graphql/login/github`,
      {
        headers: graphHeaders,
        data: {
          query: loginMutation,
          variables: {
            action: 'COMPLETE',
            code: 'simulated-provider-code',
            state: graphLiveBegin.state,
            proof: graphLiveBegin.proof,
          },
        },
      },
    )
    expect((await graphComplete.json()).data.login.identity.username).toBe(
      'simulated-github-user',
    )
    expect(
      (
        await page.request.post(`${backend}/graphql/login/github`, {
          headers: restHeaders,
          data: { query: loginMutation, variables: { action: 'BEGIN' } },
        })
      ).status(),
    ).toBe(403)
    await page.locator('.flow-card.social').click()
    await page.getByRole('button', { name: 'Remove node', exact: true }).click()
    await expect(page.locator('.flow-card.social')).toHaveCount(0)
    await expect(page.getByTestId('test-result')).not.toContainText(
      graphBegin.proof,
    )
    await expect(page.getByTestId('test-result')).not.toContainText(
      graphBegin.state,
    )
    const ordinary = await (
      await page.request.post(`${backend}/api/flows`, {
        headers,
        data: {
          name: 'Ordinary state response',
          path: '/ordinary',
          method: 'GET',
          nodes: [
            {
              id: 'request',
              type: 'request',
              position: { x: 60, y: 130 },
              config: {},
            },
            {
              id: 'response',
              type: 'response',
              position: { x: 390, y: 130 },
              config: {
                status: 200,
                body: { state: 'ordinary-state', code: 'ordinary-code' },
              },
            },
          ],
          edges: [
            { id: 'request-response', source: 'request', target: 'response' },
          ],
        },
      })
    ).json()
    expect(ordinary.id).toBeTruthy()
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await page.getByRole('button', { name: /Ordinary state response/ }).click()
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    await expect(page.getByTestId('test-result')).toContainText(
      'ordinary-state',
    )
    await expect(page.getByTestId('test-result')).toContainText('ordinary-code')
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Login provider', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Create login API', exact: true })
      .click()
    await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    expect(
      await page
        .getByRole('combobox')
        .evaluateAll((controls) =>
          controls.every((control) => control.tagName === 'BUTTON'),
        ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: 'Light', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const editor = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: 'Template editor', role: 'editor' },
      })
    ).json()
    const viewer = await (
      await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: 'Product viewer', role: 'viewer' },
      })
    ).json()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(editor.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Connect GitHub', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Edit connection', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Delete connection', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Create login API', exact: true })
      .click()
    await page
      .getByLabel('API name', { exact: true })
      .fill('Editor login draft')
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      'Editor login draft',
    )
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token').fill(viewer.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: 'Product login needs editor access',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Login provider', exact: true }),
    ).toHaveCount(0)
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
      'besh-theme',
    ])
    expect(errors).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
