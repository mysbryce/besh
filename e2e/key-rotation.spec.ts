import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { graphqlFlow, helloFlow } from '../test/fixtures'

test('owner replaces a caller key once, saves its secret, and sees revoked history', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const directory = mkdtempSync(join(tmpdir(), 'besh-key-rotation-browser-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4316'
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4316',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: 'http://127.0.0.1:5179',
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((resolve) => {
    server.once('exit', () => resolve())
    server.once('error', () => resolve())
  })
  const headers = { authorization: `Bearer ${owner}` }
  let releaseReplacement = () => {}
  const replacementAcknowledged = new Promise<void>((resolve) => {
    releaseReplacement = resolve
  })
  let loseListResponse = false
  let loseReplacementResponse = false

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
    const flowResponse = await page.request.post(`${backend}/api/flows`, {
      headers,
      data: helloFlow,
    })
    expect(flowResponse.status()).toBe(200)
    const flow = await flowResponse.json()
    expect(
      (
        await page.request.post(`${backend}/api/flows/${flow.id}/publish`, {
          headers,
          data: { revision: 1 },
        })
      ).status(),
    ).toBe(200)
    const issuedResponse = await page.request.post(
      `${backend}/api/runtime-keys`,
      {
        headers,
        data: {
          name: 'Production caller',
          flowId: flow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    )
    expect(issuedResponse.status()).toBe(200)
    const old = await issuedResponse.json()
    let replacements = 0

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (
        !/^\/(auth\/|api\/|setup\/|health$|run\/|graphql\/)/.test(url.pathname)
      ) {
        await route.continue()
        return
      }
      if (url.pathname.endsWith('/rotate')) replacements++
      const response = await route.fetch({
        url: `${backend}${url.pathname}${url.search}`,
      })
      if (url.pathname.endsWith('/rotate')) await replacementAcknowledged
      if (loseReplacementResponse && url.pathname.endsWith('/rotate')) {
        loseReplacementResponse = false
        await route.abort('failed')
        return
      }
      if (
        loseListResponse &&
        url.pathname === '/api/runtime-keys' &&
        route.request().method() === 'GET'
      ) {
        loseListResponse = false
        await route.abort('failed')
        return
      }
      await route.fulfill({ response })
    })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    await page.getByLabel('Workspace token').fill(owner)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    const oldRow = page.getByRole('row', { name: /Production caller.*Active/ })
    const replace = oldRow.getByRole('button', {
      name: 'Replace key',
      exact: true,
    })
    await expect(replace).toBeVisible()
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('stops working immediately')
      expect(dialog.message()).toContain('same API, permissions, and expiry')
      await dialog.dismiss()
    })
    await replace.click()
    expect(replacements).toBe(0)
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${old.token}` },
        })
      ).status(),
    ).toBe(200)
    page.once('dialog', (dialog) => dialog.accept())
    await replace.click()
    await expect(page.getByLabel('Key name', { exact: true })).toBeDisabled()
    await expect(
      page.getByRole('combobox', { name: 'Published API', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('combobox', { name: 'Expires in', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('checkbox', { name: 'REST requests', exact: true }),
    ).toBeDisabled()
    await expect(
      oldRow.getByRole('button', { name: 'Revoke', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Help & roadmap', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('link', { name: 'Besh home', exact: true }),
    ).toHaveAttribute('aria-disabled', 'true')
    await replace.evaluate((button) => (button as HTMLButtonElement).click())
    expect(replacements).toBe(1)
    releaseReplacement()
    const saved = page.getByRole('region', {
      name: 'Save API key',
      exact: true,
    })
    await expect(saved).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Help & roadmap', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('link', { name: 'Besh home', exact: true }),
    ).not.toHaveAttribute('aria-disabled', 'true')
    const secret = await saved.getByLabel('New API key').inputValue()
    expect(secret.length > 32).toBe(true)
    expect(replacements).toBe(1)
    await expect(
      page.getByRole('row', { name: /Production caller.*Revoked/ }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('row', { name: /Production caller.*Active/ })
        .getByRole('button', { name: 'Replace key', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(saved).toBeVisible()
    expect(
      (await saved.getByLabel('New API key').inputValue()) === secret,
    ).toBe(true)
    const metadata = await (
      await page.request.get(`${backend}/api/runtime-keys`, { headers })
    ).json()
    const replacement = metadata.find(
      (key: { id: string }) => key.id !== old.id,
    )
    expect(replacement).toMatchObject({
      name: 'Production caller',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: old.expiresAt,
      revokedAt: null,
    })
    expect(Object.hasOwn(replacement, 'token')).toBe(false)
    loseListResponse = true
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    expect(
      (await saved.getByLabel('New API key').inputValue()) === secret,
    ).toBe(true)
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${old.token}` },
        })
      ).status(),
    ).toBe(401)
    const response = await page.request.get(`${backend}/run/hello`, {
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ message: 'Hello, Besh!' })
    await saved
      .getByRole('button', { name: 'Copy API key', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('API key copied.')
    expect(
      (await page.evaluate(() => navigator.clipboard.readText())) === secret,
    ).toBe(true)
    await saved
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    await expect(saved).toHaveCount(0)
    await page.reload()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await expect(saved).toHaveCount(0)
    await expect(
      page.getByRole('row', { name: /Production caller.*Revoked/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('row', { name: /Production caller.*Active/ }),
    ).toBeVisible()

    const expiringResponse = await page.request.post(
      `${backend}/api/runtime-keys`,
      {
        headers,
        data: {
          name: 'Expiring caller',
          flowId: flow.id,
          permissions: ['rest'],
          expiresAt: new Date(Date.now() + 3_000).toISOString(),
        },
      },
    )
    expect(expiringResponse.status()).toBe(200)
    const expiring = await expiringResponse.json()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    const expiryRow = page.getByRole('row', { name: /Expiring caller/ })
    await expect(
      expiryRow.getByRole('button', { name: 'Replace key', exact: true }),
    ).toBeVisible()
    page.once('dialog', async (dialog) => {
      await expect
        .poll(async () =>
          (
            await page.request.get(`${backend}/run/hello`, {
              headers: { authorization: `Bearer ${expiring.token}` },
            })
          ).status(),
        )
        .toBe(401)
      await dialog.accept()
    })
    await expiryRow
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Refresh API keys before trying again',
    )
    await expect(page.getByRole('status')).toContainText(
      'Could not confirm key replacement',
    )
    await expect(expiryRow).toContainText('Expired')
    await expect(
      expiryRow.getByRole('button', { name: 'Replace key', exact: true }),
    ).toHaveCount(0)
    await expect(saved).toHaveCount(0)
    const expiredMetadata = await (
      await page.request.get(`${backend}/api/runtime-keys`, { headers })
    ).json()
    expect(
      expiredMetadata.find((key: { id: string }) => key.id === expiring.id),
    ).toMatchObject({
      name: 'Expiring caller',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: expiring.expiresAt,
      revokedAt: null,
    })
    const lostResponse = await page.request.post(
      `${backend}/api/runtime-keys`,
      {
        headers,
        data: {
          name: 'Lost response caller',
          flowId: flow.id,
          permissions: ['rest'],
          expiresAt: old.expiresAt,
        },
      },
    )
    expect(lostResponse.status()).toBe(200)
    const lost = await lostResponse.json()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    loseReplacementResponse = true
    page.once('dialog', (dialog) => dialog.accept())
    const lostRow = page.getByRole('row', {
      name: /Lost response caller.*Active/,
    })
    await lostRow
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'If the old key is revoked, create a new API key and update your caller',
    )
    await expect(saved).toHaveCount(0)
    await expect(lostRow).toContainText('Active')
    expect(replacements).toBe(3)
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${lost.token}` },
        })
      ).status(),
    ).toBe(401)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(
      page.getByRole('row', { name: /Lost response caller.*Revoked/ }),
    ).toBeVisible()
    await page.getByLabel('Key name', { exact: true }).fill('Recovered caller')
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()
    await expect(saved).toBeVisible()
    const recovered = await saved.getByLabel('New API key').inputValue()
    expect(
      (
        await page.request.get(`${backend}/run/hello`, {
          headers: { authorization: `Bearer ${recovered}` },
        })
      ).status(),
    ).toBe(200)
    await saved
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()
    expect(
      (
        await page.request.put(`${backend}/api/flows/${flow.id}`, {
          headers,
          data: { ...graphqlFlow, revision: 1 },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await page.request.post(`${backend}/api/flows/${flow.id}/publish`, {
          headers,
          data: { revision: 2 },
        })
      ).status(),
    ).toBe(200)
    const incompatible = page.getByRole('row', {
      name: /Production caller.*Active/,
    })
    page.once('dialog', (dialog) => dialog.accept())
    await incompatible
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Refresh API keys before trying again',
    )
    await expect(incompatible).toContainText('Active')
    await expect(saved).toHaveCount(0)
    expect(replacements).toBe(4)

    const graphqlResponse = await page.request.post(
      `${backend}/api/runtime-keys`,
      {
        headers,
        data: {
          name: 'GraphQL reader',
          flowId: flow.id,
          permissions: ['query'],
          expiresAt: old.expiresAt,
        },
      },
    )
    expect(graphqlResponse.status()).toBe(200)
    const graphql = await graphqlResponse.json()
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .getByRole('row', { name: /GraphQL reader.*Active/ })
      .getByRole('button', { name: 'Replace key', exact: true })
      .click()
    await expect(saved).toBeVisible()
    const graphqlSecret = await saved.getByLabel('New API key').inputValue()
    const grants = await (
      await page.request.get(`${backend}/api/runtime-keys`, { headers })
    ).json()
    expect(
      grants.find(
        (key: { name: string; revokedAt: string | null }) =>
          key.name === 'GraphQL reader' && !key.revokedAt,
      ),
    ).toMatchObject({
      flowId: flow.id,
      permissions: ['query'],
      expiresAt: old.expiresAt,
    })
    for (const operation of ['query', 'mutation']) {
      const data = { query: `${operation} { greet(name: "Ada") { name } }` }
      expect(
        (
          await page.request.post(`${backend}/graphql/hello`, {
            headers: { authorization: `Bearer ${graphqlSecret}` },
            data,
          })
        ).status(),
      ).toBe(operation === 'query' ? 200 : 403)
      expect(
        (
          await page.request.post(`${backend}/graphql/hello`, {
            headers: { authorization: `Bearer ${graphql.token}` },
            data,
          })
        ).status(),
      ).toBe(401)
    }
    await page.getByRole('button', { name: 'API Studio', exact: true }).click()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await expect(saved).toHaveCount(0)
    await expect(
      page.getByRole('row', { name: /GraphQL reader.*Revoked/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('row', { name: /GraphQL reader.*Active/ }),
    ).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([])

    await page.reload()
    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    for (const appearance of ['Light', 'Dark', 'System']) {
      await page
        .getByRole('combobox', { name: 'Appearance', exact: true })
        .click()
      await page.getByRole('option', { name: appearance, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        appearance === 'Light' ? 'light' : 'dark',
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expect(
        page
          .getByRole('row', { name: /GraphQL reader.*Active/ })
          .getByRole('button', { name: 'Replace key', exact: true }),
      ).toBeVisible()
    }
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(
      page.getByRole('combobox', { name: 'Published API', exact: true }),
    ).toHaveJSProperty('tagName', 'BUTTON')
    await expect(
      page.getByRole('checkbox', { name: 'GraphQL queries', exact: true }),
    ).toHaveJSProperty('tagName', 'BUTTON')
    await page.setViewportSize({ width: 1440, height: 1000 })
    for (const role of ['editor', 'viewer']) {
      const memberResponse = await page.request.post(`${backend}/api/members`, {
        headers,
        data: { name: `${role} caller`, role },
      })
      expect(memberResponse.status()).toBe(200)
      const member = await memberResponse.json()
      await page.getByRole('button', { name: 'Sign out', exact: true }).click()
      await page.getByLabel('Workspace token').fill(member.token)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await page.getByRole('button', { name: 'API keys', exact: true }).click()
      await expect(
        page.getByRole('heading', {
          name: 'Owner access required',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Replace key', exact: true }),
      ).toHaveCount(0)
      await expect(saved).toHaveCount(0)
      expect(
        (
          await page.request.post(
            `${backend}/api/runtime-keys/${graphql.id}/rotate`,
            {
              headers: { authorization: `Bearer ${member.token}` },
            },
          )
        ).status(),
      ).toBe(403)
    }
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
      'besh-theme',
    ])
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([])
    expect(errors).toEqual([])
  } finally {
    releaseReplacement()
    await page
      .evaluate(() => {
        for (const input of document.querySelectorAll('input')) input.value = ''
      })
      .catch(() => {})
    if (server.exitCode === null && server.signalCode === null) server.kill()
    await stopped
    rmSync(directory, { recursive: true, force: true })
  }
})
