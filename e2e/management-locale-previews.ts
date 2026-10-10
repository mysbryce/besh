import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'

const accountChoices = [
  [
    'en',
    'English',
    'Account & sessions',
    'Save sign-in details',
    'This device',
  ],
  ['th', 'ไทย', 'บัญชีและเซสชัน', 'บันทึกข้อมูลเข้าสู่ระบบ', 'อุปกรณ์นี้'],
  ['zh', '中文', '账户与会话', '保存登录信息', '此设备'],
  [
    'ru',
    'Русский',
    'Аккаунт и сеансы',
    'Сохранить данные входа',
    'Это устройство',
  ],
  ['ja', '日本語', 'アカウントとセッション', 'ログイン情報を保存', 'この端末'],
  ['ko', '한국어', '계정 및 세션', '로그인 정보 저장', '이 기기'],
  [
    'pt',
    'Português',
    'Conta e sessões',
    'Salvar dados de acesso',
    'Este dispositivo',
  ],
] as const

export async function chooseManagementLanguage(page: Page, name: string) {
  await page.locator('#language').click()
  await page.getByRole('option', { name, exact: true }).click()
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
}

export async function accountLocalePreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}) {
  const created = await page.request.post(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Current password', role: 'viewer' },
  })
  expect(created.status()).toBe(200)
  const member = (await created.json()) as { id: string; token: string }
  await page.goto(apiOrigin)
  await page.getByLabel('Workspace token', { exact: true }).fill(member.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Account & sessions', exact: true })
    .click()
  await expect(page.locator('#account-email')).toBeEnabled()
  await page.locator('#account-email').fill('locale-member@example.test')
  await page.locator('#account-password').fill('local-test-password-2026')
  await page.locator('#account-credential').fill(member.token)
  const sessionsResponse = await page.request.get(`${apiOrigin}/api/sessions`)
  expect(sessionsResponse.status()).toBe(200)
  const [session] = (await sessionsResponse.json()) as { expiresAt: string }[]
  const row = page.locator('tbody tr').filter({ hasText: 'Current password' })
  let accountWrites = 0
  page.on('request', (request) => {
    if (
      request.url() === `${apiOrigin}/api/account` &&
      request.method() === 'PUT'
    )
      accountWrites++
  })

  for (const [language, label, heading, save, device] of accountChoices) {
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: save, exact: true }),
    ).toBeEnabled()
    await expect(row.locator('td').first()).toHaveText('Current password')
    await expect(row.locator('td').nth(1)).toHaveText(device)
    const expectedDate = await page.evaluate(
      ({ language, timestamp }) =>
        new Intl.DateTimeFormat(language, {
          calendar: 'gregory',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(timestamp)),
      { language, timestamp: session!.expiresAt },
    )
    await expect(row.locator('td').nth(3)).toHaveText(expectedDate)
    await expect(page.locator('#account-email')).toHaveValue(
      'locale-member@example.test',
    )
    await expect(page.locator('#account-password')).toHaveValue(
      'local-test-password-2026',
    )
    await expect
      .poll(
        async () =>
          (await page.locator('#account-credential').inputValue()) ===
          member.token,
      )
      .toBe(true)
    expect(accountWrites).toBe(0)
    await contained(page)
    await capture(
      'Languages',
      `${label} account and sessions`,
      'Account guidance, action labels and session dates follow the selected language. Authored member names and unsaved credentials stay unchanged; switching language sends no account write.',
    )
    if (language === 'ru') {
      await page.setViewportSize({ width: 390, height: 844 })
      await contained(page)
      await capture(
        'Languages',
        'Phone light Russian account and sessions',
        'Long translated account guidance and session dates remain inside the native phone layout. Session rows can scroll inside their table.',
      )
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
  }

  await chooseManagementLanguage(page, 'ไทย')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'มืด', exact: true }).click()
  await contained(page)
  await capture(
    'Languages',
    'Phone dark Thai account form',
    'Translated password and identity guidance stays readable at a native 390px width. Sensitive form values remain masked.',
    { fullPage: false },
  )

  await page
    .getByRole('button', { name: 'บันทึกข้อมูลเข้าสู่ระบบ', exact: true })
    .click()
  await expect(page.locator('#account-password')).toHaveValue('')
  // A failed assertion must not print an uncleared workspace key.
  await expect
    .poll(
      async () =>
        (await page.locator('#account-credential').inputValue()) === '',
    )
    .toBe(true)
  await expect(
    page.getByText(
      'บันทึกข้อมูลเข้าสู่ระบบแล้ว เซสชันบนเบราว์เซอร์อื่นถูกเพิกถอน',
      { exact: true },
    ),
  ).toBeVisible()
  expect(accountWrites).toBe(1)
  const account = await page.request.get(`${apiOrigin}/api/account`)
  expect(account.status()).toBe(200)
  expect((await account.json()).email).toBe('locale-member@example.test')
  await capture(
    'Languages',
    'Thai account saved explicitly',
    'Only the explicit save updates email/password through the real authenticated API. The current session remains active and proof/password inputs are cleared.',
    { fullPage: false },
  )

  await page.locator('#account-credential').fill(member.token)
  await page.locator('#account-proof').click()
  await expect(
    page.getByRole('option', { name: 'รหัสผ่านปัจจุบัน', exact: true }),
  ).toBeVisible()
  await capture(
    'Languages',
    'Thai identity confirmation choices closeup',
    'A close view of the actual phone popup keeps both translated proof choices readable. Only the opaque listbox is captured; credential inputs outside it are excluded. Changing proof type explicitly clears its sensitive input.',
    { fullPage: false, region: 'listbox' },
  )
  await page
    .getByRole('option', { name: 'รหัสผ่านปัจจุบัน', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await page.locator('#account-credential').inputValue()) === '',
    )
    .toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('เพิกถอนเซสชันนี้และออกจากระบบหรือไม่?')
    await dialog.accept()
  })
  await row
    .getByRole('button', {
      name: 'เพิกถอนเซสชันของ Current password บนอุปกรณ์นี้',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('heading', { name: 'เปิดพื้นที่ทำงานของคุณ', exact: true }),
  ).toBeVisible()
  expect((await page.request.get(`${apiOrigin}/api/sessions`)).status()).toBe(
    401,
  )
  await capture(
    'Languages',
    'Thai session revoked explicitly',
    'The translated confirmation revokes the real current session and returns to sign-in. A language change never authorizes revocation.',
  )
}

export async function updateLocalePreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}) {
  await page.goto(apiOrigin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Updates', exact: true }).click()
  await expect(page.locator('#update-repository')).toBeEnabled()
  await page
    .locator('#update-repository')
    .fill('https://github.com/example/localization')
  let writes = 0
  let checks = 0
  let reads = 0
  page.on('request', (request) => {
    if (
      request.url() === `${apiOrigin}/api/updates` &&
      request.method() === 'PUT'
    )
      writes++
    if (
      request.url() === `${apiOrigin}/api/updates` &&
      request.method() === 'GET'
    )
      reads++
    if (request.url() === `${apiOrigin}/api/updates/check`) checks++
  })
  for (const [language, label, heading, check] of [
    ['en', 'English', 'Besh updates', 'Check releases'],
    ['th', 'ไทย', 'อัปเดต Besh', 'ตรวจสอบเวอร์ชัน'],
    ['zh', '中文', 'Besh 更新', '检查版本'],
    ['ru', 'Русский', 'Обновления Besh', 'Проверить выпуски'],
    ['ja', '日本語', 'Besh の更新', 'リリースを確認'],
    ['ko', '한국어', 'Besh 업데이트', '릴리스 확인'],
    ['pt', 'Português', 'Atualizações do Besh', 'Verificar versões'],
  ] as const) {
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: check, exact: true }),
    ).toBeDisabled()
    await expect(page.locator('#update-repository')).toHaveValue(
      'https://github.com/example/localization',
    )
    expect(writes).toBe(0)
    expect(checks).toBe(0)
    await contained(page)
    await capture(
      'Languages',
      `${label} update settings`,
      'Update guidance and guarded actions follow language selection. The unsaved repository stays unchanged and no settings write or release check runs automatically.',
    )
  }
  await chooseManagementLanguage(page, 'ไทย')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'มืด', exact: true }).click()
  await contained(page)
  await expect(
    page.getByText('บันทึกการเปลี่ยนแปลงก่อนตรวจสอบเวอร์ชัน', { exact: true }),
  ).toBeVisible()
  await capture(
    'Languages',
    'Phone dark Thai update review',
    'The native phone layout keeps translated release settings, save guidance and upgrade limitations readable. A dirty form cannot start a release check.',
  )
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'ทิ้งการตั้งค่าอัปเดตที่ยังไม่บันทึกและโหลดใหม่หรือไม่?',
    )
    await dialog.dismiss()
  })
  await page
    .getByRole('button', { name: 'โหลดการตั้งค่าอัปเดตใหม่', exact: true })
    .click()
  await expect(page.locator('#update-repository')).toHaveValue(
    'https://github.com/example/localization',
  )
  expect(writes).toBe(0)
  await capture(
    'Languages',
    'Thai update refresh canceled',
    'Canceling the translated discard confirmation preserves the typed repository and leaves saved settings untouched.',
  )
  await page
    .getByRole('button', { name: 'บันทึกการตั้งค่าอัปเดต', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'ตรวจสอบเวอร์ชัน', exact: true }),
  ).toBeEnabled()
  expect(writes).toBe(1)
  expect(checks).toBe(0)
  const response = await page.request.get(`${apiOrigin}/api/updates`)
  expect(response.status()).toBe(200)
  const saved = await response.json()
  expect(saved.settings.repositoryUrl).toBe(
    'https://github.com/example/localization',
  )
  expect(saved.lastCheck).toBeNull()
  await capture(
    'Languages',
    'Thai update settings saved explicitly',
    'Only the explicit save updates the real owner-managed repository. The application still makes no release request and performs no upgrade.',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })

  const created = await page.request.post(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: 'Update viewer', role: 'viewer' },
  })
  expect(created.status()).toBe(200)
  const viewer = (await created.json()) as { token: string }
  await chooseManagementLanguage(page, 'English')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(viewer.token)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Updates', exact: true }).click()
  await chooseManagementLanguage(page, 'ไทย')
  await expect(
    page.getByRole('heading', { name: 'ต้องมีสิทธิ์เจ้าของ', exact: true }),
  ).toBeVisible()
  await expect(page.locator('#update-repository')).toHaveCount(0)
  expect(reads).toBe(0)
  expect(checks).toBe(0)
  expect(writes).toBe(1)
  await capture(
    'Languages',
    'Thai update owner boundary',
    'A viewer receives translated owner-only guidance without mounting settings or requesting private update state. Language selection grants no permission.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'สว่าง', exact: true }).click()
  await contained(page)
  await capture(
    'Languages',
    'Phone light Thai update permission guidance',
    'The non-owner explanation remains visible at a native phone width in light appearance. Protected release settings are not read.',
    { fullPage: false },
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
}
