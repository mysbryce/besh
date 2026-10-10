import { expect, type Page, type Route } from '@playwright/test'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

type Options = {
  page: Page
  owner: string
  apiOrigin: string
  capture: Capture
}

async function holdThaiDelivery(page: Page) {
  let release!: () => void
  let ready!: (status: number) => void
  let finish!: () => void
  let fail!: (error: unknown) => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const response = new Promise<number>((resolve) => {
    ready = resolve
  })
  const settled = new Promise<void>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const pattern = /\/assets\/th-[^/]+\.js(?:\?.*)?$/
  const handler = async (route: Route) => {
    try {
      const actual = await route.fetch({ maxRedirects: 0 })
      ready(actual.status())
      await released
      await route.fulfill({ response: actual })
      finish()
    } catch (error) {
      fail(error)
      throw error
    }
  }
  await page.route(pattern, handler)
  return {
    response,
    async close() {
      const delivered = page.waitForResponse(pattern)
      release()
      await settled
      await (await delivered).finished()
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      )
      await page.unroute(pattern, handler)
    },
  }
}

export async function localeStartupPreviews({
  page,
  apiOrigin,
  capture,
}: Options) {
  const delivery = await holdThaiDelivery(page)
  try {
    await page.goto(apiOrigin, { waitUntil: 'domcontentloaded' })
    expect(await delivery.response).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Open your workspace.', exact: true }),
    ).toBeVisible({ timeout: 7500 })
    await expect(page.getByRole('alert')).toHaveText(
      'Could not load this language. English is available.',
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await capture(
      'Languages',
      'Stalled startup language returns to English',
      'A real Thai language response remains held. The bounded startup deadline restores the ordinary English sign-in screen with a visible language error.',
    )
  } finally {
    await delivery.close()
  }
  await expect(page.locator('#language')).toBeEnabled()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Open your workspace.', exact: true }),
  ).toBeVisible()
  await capture(
    'Languages',
    'Late language response keeps English active',
    'Releasing the original successful response does not silently change the active language or remove the recovery guidance.',
  )
  await page.locator('#language').click()
  await page.getByRole('option', { name: 'ไทย', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(
    page.getByRole('heading', { name: 'เปิดพื้นที่ทำงานของคุณ', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await capture(
    'Languages',
    'Explicit Thai retry after startup timeout',
    'Choosing Thai explicitly succeeds after the late chunk arrives. The language choice is ordinary UI state, with no automatic sign-in.',
  )
}

export async function localeBootstrapPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: Options) {
  const headers = { authorization: `Bearer ${owner}` }
  const tokens: string[] = []
  for (const name of ['Earlier startup reader', 'Latest startup reader']) {
    const member = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name, role: 'viewer' },
    })
    expect(member.status()).toBe(200)
    const created = (await member.json()) as { id: string }
    const issued = await page.request.post(`${apiOrigin}/api/invitations`, {
      headers,
      data: {
        memberId: created.id,
        email: `startup-${crypto.randomUUID()}@example.test`,
      },
    })
    expect(issued.status()).toBe(200)
    const receipt = (await issued.json()) as { token: string }
    tokens.push(receipt.token)
  }
  const login = await page.request.post(`${apiOrigin}/auth/login`, {
    headers: { origin: apiOrigin },
    data: { token: owner },
  })
  expect(login.status()).toBe(200)
  const privateReads: string[] = []
  const observe = (request: { url: () => string }) => {
    const path = new URL(request.url()).pathname
    if (path === '/setup/status' || path.startsWith('/api/'))
      privateReads.push(path)
  }
  page.on('request', observe)
  const delivery = await holdThaiDelivery(page)
  try {
    await page.goto(apiOrigin, { waitUntil: 'domcontentloaded' })
    expect(await delivery.response).toBe(200)
    for (const token of tokens) {
      await page.evaluate((value) => {
        location.hash = `invite=${value}`
      }, token)
      await expect
        .poll(() => page.evaluate(() => location.hash === ''), {
          timeout: 1000,
          message: 'Invitation fragment is stripped during language startup',
        })
        .toBe(true)
    }
  } finally {
    await delivery.close()
  }
  await expect(
    page.getByRole('heading', { name: 'รับคำเชิญ', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Latest startup reader', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Earlier startup reader', { exact: false }),
  ).toHaveCount(0)
  await expect(page.getByLabel('รหัสผ่านใหม่', { exact: true })).toBeDisabled()
  expect(privateReads).toEqual([])
  await capture(
    'Languages',
    'Latest invitation survives language startup',
    'Two actual invitation links arrive while the real Thai chunk is held. Each fragment is removed immediately; the latest recipient is handed to the app without restoring the signed-in owner’s private workspace.',
  )
  await page
    .getByRole('button', { name: 'ออกจากระบบเพื่อรับคำเชิญ', exact: true })
    .click()
  await expect(
    page.getByText('ยังไม่มีการเข้าสู่ระบบพื้นที่ทำงาน', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('รหัสผ่านใหม่', { exact: true })).toBeEnabled()
  expect(privateReads).toEqual([])
  await capture(
    'Languages',
    'Bootstrap invitation keeps explicit sign-out',
    'The invitation keeps the original cookie sign-in guard. Password setup becomes available only after explicit sign-out; bootstrap handling never signs in or accepts the link automatically.',
  )
  page.off('request', observe)
}
