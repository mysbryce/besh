import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('built dashboard signs in, restores sessions and imports Excel under strict CSP', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-production-browser-'))
  const token = crypto.randomUUID() + crypto.randomUUID()
  const password = 'Production browser password 123!'
  const backend = 'http://127.0.0.1:4314'
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: '4314',
    BESH_HOST: '127.0.0.1',
    BESH_ADMIN_TOKEN: token,
    BESH_DATABASE_PATH: join(directory, 'workspace.sqlite'),
    BESH_BACKUP_DIR: join(directory, 'backups'),
    BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
  }
  delete env.BESH_WEB_URL
  const server = spawn('bun', ['src/index.ts'], {
    env,
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((resolve) => {
    server.once('exit', () => resolve())
    server.once('error', () => resolve())
  })
  const pageErrors: string[] = []
  const policyViolations: { directive: string; blocked: string }[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.exposeFunction(
    'recordProductionPolicyViolation',
    (violation: { directive: string; blocked: string }) => {
      policyViolations.push(violation)
    },
  )
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = Reflect.get(window, 'recordProductionPolicyViolation')
      void report({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
      })
    })
  })

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(backend + '/health')).status()
        } catch {
          return 0
        }
      })
      .toBe(200)
    const document = await page.goto(backend)
    const policy = document!.headers()['content-security-policy']
    expect(policy).toContain("default-src 'self'")
    expect(policy).not.toContain('unsafe-eval')
    await page.getByLabel('Workspace token').fill(token)
    const handshake = page.waitForResponse(
      (response) =>
        response.url() === backend + '/auth/login' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    const signedIn = await handshake
    expect(signedIn.status()).toBe(200)
    expect((await signedIn.request().allHeaders()).origin).toBe(backend)
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
    const cookie = (await page.context().cookies()).find(
      (entry) => entry.name === 'besh_session',
    )!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Strict')

    await page
      .getByRole('button', { name: 'Account & sessions', exact: true })
      .click()
    await page.getByLabel('Account email').fill('owner@production.example')
    await page.getByLabel('New password', { exact: true }).fill(password)
    await page.getByLabel('Your workspace key', { exact: true }).fill(token)
    await page
      .getByRole('button', { name: 'Save sign-in details', exact: true })
      .click()
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue(
      '',
    )
    await page.reload()
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    expect(
      (await page.context().cookies()).find(
        (entry) => entry.name === 'besh_session',
      )!.value,
    ).toBe(cookie.value)
    const logout = page.waitForResponse(
      (response) => response.url() === backend + '/auth/logout',
    )
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    expect((await logout).status()).toBe(200)
    expect((await page.request.get(backend + '/auth/session')).status()).toBe(
      401,
    )
    expect(
      (
        await page.request.get(backend + '/api/me', {
          headers: { cookie: `besh_session=${cookie.value}` },
        })
      ).status(),
    ).toBe(401)

    await page
      .getByRole('button', { name: 'Email & password', exact: true })
      .click()
    await page
      .getByLabel('Email', { exact: true })
      .fill('owner@production.example')
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await page.getByLabel('Source name', { exact: true }).fill('Excel contacts')
    await page
      .getByLabel('Spreadsheet file', { exact: true })
      .setInputFiles(resolve('test/fixtures/contacts.xlsx'))
    const upload = page.waitForResponse(
      (response) => response.url() === backend + '/api/data-sources/import',
    )
    await page
      .getByRole('button', { name: 'Import spreadsheet', exact: true })
      .click()
    const imported = await upload
    expect(imported.status()).toBe(200)
    const headers = await imported.request().allHeaders()
    expect(headers['content-type']).toContain('multipart/form-data')
    expect(headers.origin).toBe(backend)
    expect(headers['x-besh-csrf']).toBeTruthy()
    await expect(
      page.getByRole('cell', { name: 'Ada', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Product login', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Connect GitHub', exact: true })
      .click()
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Built product')
    await page
      .getByLabel('GitHub client ID', { exact: true })
      .fill('built-client')
    await page
      .getByLabel('GitHub client secret', { exact: true })
      .fill('disposable-built-secret')
    await page
      .getByLabel('Callback URL', { exact: true })
      .fill('https://product.example.test/login/callback')
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Built product', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Create login API', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click()
    await expect(page.locator('.flow-card.social')).toContainText(
      'GitHub login',
    )
    const started = page.waitForResponse((response) =>
      /\/api\/flows\/[^/]+\/test$/.test(response.url()),
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    const login = await started
    expect(login.status()).toBe(200)
    const attempt = (await login.json()).body
    expect(new URL(attempt.authorizationUrl).hostname).toBe('github.com')
    await expect(page.getByTestId('test-result')).not.toContainText(
      attempt.proof,
    )
    await expect(page.getByTestId('test-result')).not.toContainText(
      attempt.state,
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await page.getByLabel('Key name', { exact: true }).fill('Built caller')
    const keyCreated = page.waitForResponse(
      (response) =>
        response.url() === backend + '/api/runtime-keys' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()
    const original = await (await keyCreated).json()
    const runtimeUrl = await page
      .getByLabel('Published endpoint URL', { exact: true })
      .inputValue()
    await page
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    const rotation = page.waitForResponse(
      (response) =>
        response.url() === `${backend}/api/runtime-keys/${original.id}/rotate`,
    )
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('row')
      .filter({ hasText: 'Built caller' })
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    const rotated = await rotation
    expect(rotated.status()).toBe(200)
    const replacement = await rotated.json()
    await expect(
      page.getByRole('region', { name: 'Save API key', exact: true }),
    ).toBeVisible()
    expect(
      (
        await page.request.post(runtimeUrl, {
          headers: { authorization: `Bearer ${original.token}` },
          data: { action: 'BEGIN' },
        })
      ).status(),
    ).toBe(401)
    const nextAttempt = await page.request.post(runtimeUrl, {
      headers: { authorization: `Bearer ${replacement.token}` },
      data: { action: 'BEGIN' },
    })
    expect(nextAttempt.status()).toBe(200)
    expect(new URL((await nextAttempt.json()).authorizationUrl).hostname).toBe(
      'github.com',
    )
    expect(pageErrors).toEqual([])
    expect(policyViolations).toEqual([])
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
})
