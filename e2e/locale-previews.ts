import { expect, type Page } from '@playwright/test'

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

const choices = [
  ['en', 'English', 'Open your workspace.'],
  ['th', 'ไทย', 'เปิดพื้นที่ทำงานของคุณ'],
  ['zh', '中文', '打开你的工作区。'],
  ['ru', 'Русский', 'Откройте своё рабочее пространство.'],
  ['ja', '日本語', 'ワークスペースを開きましょう。'],
  ['ko', '한국어', '작업 공간을 여세요.'],
  ['pt', 'Português', 'Abra seu espaço de trabalho.'],
] as const

async function chooseLanguage(page: Page, label: string) {
  const control = page.locator('#language')
  await expect(control).toHaveJSProperty('tagName', 'BUTTON')
  await control.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
}

export async function localePreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: Options) {
  await page.goto(apiOrigin)
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(
    page.getByRole('heading', { name: 'เปิดพื้นที่ทำงานของคุณ', exact: true }),
  ).toBeVisible()
  await capture(
    'Languages',
    'Thai device language before sign-in',
    'A new th-TH browser opens in Thai before the first screen renders. No workspace credentials are stored with language preferences.',
  )

  for (const [language, label, heading] of choices) {
    await chooseLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await contained(page)
    await capture(
      'Languages',
      `${label} sign-in`,
      'The custom selector loads a supported language on demand. Sign-in guidance and appearance controls update without losing the current form.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    if (language === 'ko') {
      const wordLines = await page
        .locator('.welcome-copy h1 em')
        .evaluate((element) => {
          const text = element.firstChild!
          const value = text.textContent!
          const start = value.indexOf('연결하세요.')
          const range = document.createRange()
          range.setStart(text, start)
          range.setEnd(text, start + '연결하세요.'.length)
          return range.getClientRects().length
        })
      expect(wordLines).toBe(1)
    }
    await capture(
      'Languages',
      `Phone ${label} sign-in`,
      'A native 390px viewport keeps translated guidance and custom language/appearance controls inside the document.',
      { fullPage: false },
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
  }

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt')
  await expect(
    page.getByRole('heading', {
      name: 'Abra seu espaço de trabalho.',
      exact: true,
    }),
  ).toBeVisible()
  await capture(
    'Languages',
    'Explicit language survives reload',
    'The chosen Portuguese preference overrides the original Thai device language after reload. Only the language code is persisted.',
  )
  await chooseLanguage(page, 'English')
  const created = await page.request.post(`${apiOrigin}/api/flows`, {
    headers: { authorization: `Bearer ${owner}` },
    data: {
      name: 'Members',
      method: 'GET',
      path: '/locale-example',
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 140, y: 160 },
          config: {},
        },
        {
          id: 'response',
          type: 'response',
          position: { x: 440, y: 160 },
          config: { status: 200, body: { message: 'Members' } },
        },
      ],
      edges: [{ id: 'edge', source: 'request', target: 'response' }],
    },
  })
  expect(created.status()).toBe(200)
  const flow = (await created.json()) as { id: string }
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await chooseLanguage(page, 'ไทย')
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(
    page.getByRole('button', { name: 'แหล่งข้อมูล', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('ชื่อ API', { exact: true })).toHaveValue(
    'Members',
  )
  const saved = await page.request.get(`${apiOrigin}/api/flows/${flow.id}`)
  expect(saved.status()).toBe(200)
  const unchanged = await saved.json()
  expect(unchanged.name).toBe('Members')
  expect(unchanged.nodes[1].config.body).toEqual({ message: 'Members' })
  await capture(
    'Languages',
    'Thai workspace keeps authored API names',
    'Navigation and API form labels change language. The authored name Members and saved response text remain unchanged through the public API.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await contained(page)
  await capture(
    'Languages',
    'Phone Thai workspace',
    'Compact controls wrap inside the phone viewport while authored API data remains readable.',
    { fullPage: false },
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
}

export async function localeFallbackPreviews({
  page,
  apiOrigin,
  capture,
}: Options) {
  await page.goto(apiOrigin)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Open your workspace.', exact: true }),
  ).toBeVisible()
  await expect(page.locator('#language')).toHaveText('English')
  await capture(
    'Languages',
    'Unsupported device language falls back to English',
    'A new es-MX browser has no matching supported language. Its first screen uses English without changing the browser locale.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await contained(page)
  await capture(
    'Languages',
    'Phone English language fallback',
    'English fallback keeps the language and appearance selectors readable at a native 390px width.',
    { fullPage: false },
  )
}
