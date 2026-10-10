import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'
import { helloFlow } from '../test/fixtures'

const roleChoices = [
  ['en', 'English', 'Custom roles', 'Role name', 'Save role', 'Read APIs'],
  ['th', 'ไทย', 'บทบาทกำหนดเอง', 'ชื่อบทบาท', 'บันทึกบทบาท', 'อ่าน API'],
  ['zh', '中文', '自定义角色', '角色名称', '保存角色', '读取 API'],
  [
    'ru',
    'Русский',
    'Пользовательские роли',
    'Название роли',
    'Сохранить роль',
    'Читать API',
  ],
  ['ja', '日本語', 'カスタムロール', 'ロール名', 'ロールを保存', 'API を閲覧'],
  ['ko', '한국어', '사용자 지정 역할', '역할 이름', '역할 저장', 'API 읽기'],
  [
    'pt',
    'Português',
    'Funções personalizadas',
    'Nome da função',
    'Salvar função',
    'Ler APIs',
  ],
] as const

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(
    await page
      .locator('.roles-panel > .panel-heading')
      .evaluateAll((headings) =>
        headings.every((heading) => {
          const bounds = heading.getBoundingClientRect()
          return Array.from(heading.children).every((child) => {
            const action = child.getBoundingClientRect()
            return (
              action.left >= bounds.left - 1 && action.right <= bounds.right + 1
            )
          })
        }),
      ),
  ).toBe(true)
}

export async function roleLocalePreviews({
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
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'New role', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Role name', exact: true })
    .fill('Read APIs')
  await page.getByRole('checkbox', { name: 'Read APIs', exact: true }).click()
  let writes = 0
  let languageReads = 0
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      /^\/api\/(roles|members)(\/|$)/.test(path) &&
      request.method() !== 'GET'
    )
      writes++
    if (
      /^\/api\/(roles|members|permissions)(\/|$)/.test(path) &&
      request.method() === 'GET'
    )
      languageReads++
  })

  for (const [language, label, heading, name, save, read] of roleChoices) {
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name, exact: true })).toHaveValue(
      'Read APIs',
    )
    await expect(
      page.getByRole('checkbox', { name: read, exact: true }),
    ).toBeChecked()
    await expect(
      page.getByRole('button', { name: save, exact: true }),
    ).toBeEnabled()
    expect(writes).toBe(0)
    expect(languageReads).toBe(0)
    await contained(page)
    await capture(
      'Languages',
      `${label} role permissions`,
      'The role name stays authored text and selected action IDs stay unchanged. Language selection translates trusted permission guidance without reading or writing team state.',
    )
    if (language === 'ru') {
      await page.setViewportSize({ width: 390, height: 844 })
      await contained(page)
      await capture(
        'Languages',
        'Phone light Russian role permissions',
        'Complete permission descriptions wrap inside a native 390px role form. Role and grant choices are unchanged.',
      )
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
  }

  await chooseManagementLanguage(page, 'ไทย')
  await page
    .getByRole('checkbox', {
      name: 'จัดการข้อมูลสำรองของพื้นที่ทำงาน',
      exact: true,
    })
    .click()
  await page
    .getByRole('checkbox', { name: 'รันทดสอบโหลด', exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'มืด', exact: true }).click()
  await contained(page)
  await expect(
    page.getByText(
      'การเข้าถึงข้อมูลสำรองเปิดเผยทั้งพื้นที่ทำงาน รวมถึงข้อมูลที่บันทึกไว้และระเบียนข้อมูลรับรองที่ละเอียดอ่อน เก็บไฟล์ที่ดาวน์โหลดเป็นส่วนตัว',
      { exact: true },
    ),
  ).toBeVisible()
  await capture(
    'Languages',
    'Phone dark Thai role risk review',
    'Translated backup and load-test warnings retain their full security meaning. Selecting a grant is unsaved and causes no API execution.',
  )
  await page
    .getByRole('checkbox', {
      name: 'จัดการข้อมูลสำรองของพื้นที่ทำงาน',
      exact: true,
    })
    .click()
  await page
    .getByRole('checkbox', { name: 'รันทดสอบโหลด', exact: true })
    .click()
  await page.getByRole('button', { name: 'บันทึกบทบาท', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'บทบาทใหม่', exact: true }),
  ).toBeEnabled()
  expect(writes).toBe(1)
  const result = await page.request.get(`${apiOrigin}/api/roles`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(result.status()).toBe(200)
  const [role] = (await result.json()) as {
    id: string
    name: string
    permissions: string[]
  }[]
  expect(role?.name).toBe('Read APIs')
  expect(role?.permissions).toEqual(['flows.read'])
  await capture(
    'Languages',
    'Thai role saved explicitly',
    'Only explicit Save creates the real role with the unchanged authored name and flows.read grant. The translated role card leaves its name literal.',
  )

  await page
    .getByRole('button', { name: 'แก้ไข Read APIs', exact: true })
    .click()
  await page
    .getByRole('checkbox', { name: 'ทดสอบฉบับร่าง', exact: true })
    .click()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'บันทึกการเปลี่ยนแปลงของ Read APIs หรือไม่? สิทธิ์ที่เปลี่ยนจะมีผลกับคีย์สมาชิกทันทีและสิ้นสุดเซสชันเบราว์เซอร์ที่ได้รับผลกระทบ ตรวจสอบสิทธิ์ทั้งหมดที่เลือกก่อนดำเนินการต่อ',
    )
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'บันทึกบทบาท', exact: true }).click()
  expect(writes).toBe(1)
  await expect(
    page.getByRole('checkbox', { name: 'ทดสอบฉบับร่าง', exact: true }),
  ).toBeChecked()
  await capture(
    'Languages',
    'Thai role change confirmation canceled',
    'Canceling translated review preserves the unsaved grant selection and changes neither permissions nor sessions.',
  )
  await page
    .getByRole('button', { name: 'ยกเลิกการเปลี่ยนบทบาท', exact: true })
    .click()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'ลบบทบาท Read APIs หรือไม่? การกระทำนี้ย้อนกลับไม่ได้ บทบาทที่มอบหมายให้สมาชิกอยู่ไม่สามารถลบได้',
    )
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'ลบ Read APIs', exact: true }).click()
  expect(writes).toBe(1)
  const persisted = await page.request.get(`${apiOrigin}/api/roles`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(persisted.status()).toBe(200)
  expect((await persisted.json())[0].permissions).toEqual(['flows.read'])
  await capture(
    'Languages',
    'Thai role deletion canceled',
    'Translated deletion review keeps the irreversible and assigned-role restrictions. Canceling leaves the actual role and grants intact.',
  )
}

const memberChoices = [
  [
    'en',
    'English',
    'Your team',
    'Member name',
    'Member role',
    'Add member',
    'New member API access',
    'Share Name',
  ],
  [
    'th',
    'ไทย',
    'ทีมของคุณ',
    'ชื่อสมาชิก',
    'บทบาทสมาชิก',
    'เพิ่มสมาชิก',
    'สิทธิ์เข้าถึง API ของสมาชิกใหม่',
    'แชร์ Name',
  ],
  [
    'zh',
    '中文',
    '你的团队',
    '成员名称',
    '成员角色',
    '添加成员',
    '新成员 API 访问权限',
    '共享 Name',
  ],
  [
    'ru',
    'Русский',
    'Ваша команда',
    'Имя участника',
    'Роль участника',
    'Добавить участника',
    'Доступ нового участника к API',
    'Поделиться Name',
  ],
  [
    'ja',
    '日本語',
    'チーム',
    'メンバー名',
    'メンバーのロール',
    'メンバーを追加',
    '新しいメンバーの API アクセス',
    'Name を共有',
  ],
  [
    'ko',
    '한국어',
    '팀',
    '멤버 이름',
    '멤버 역할',
    '멤버 추가',
    '새 멤버의 API 접근 권한',
    'Name 공유',
  ],
  [
    'pt',
    'Português',
    'Sua equipe',
    'Nome do membro',
    'Função do membro',
    'Adicionar membro',
    'Acesso do novo membro às APIs',
    'Compartilhar Name',
  ],
] as const

export async function memberLocalePreviews({
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
  const headers = { authorization: `Bearer ${owner}` }
  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: { name: 'Read APIs', permissions: ['flows.read'] },
  })
  expect(roleResponse.status()).toBe(200)
  const role = (await roleResponse.json()) as { id: string }
  const flowResponse = await page.request.post(`${apiOrigin}/api/flows`, {
    headers,
    data: { ...helloFlow, name: 'Name' },
  })
  expect(flowResponse.status()).toBe(200)
  const flow = (await flowResponse.json()) as { id: string }
  const sourceResponse = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: 'Data sources',
        file: {
          name: 'language.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from('name\nAda\n'),
        },
      },
    },
  )
  expect(sourceResponse.status()).toBe(200)
  const source = (await sourceResponse.json()) as { id: string }
  const deniedResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: { name: 'Role name', role: 'custom', roleId: role.id },
  })
  expect(deniedResponse.status()).toBe(200)
  const deniedMember = (await deniedResponse.json()) as { token: string }

  await page.goto(apiOrigin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Member name', exact: true })
    .fill('Custom roles')
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  await page
    .getByRole('option', { name: 'Read APIs · custom role', exact: true })
    .click()
  const form = page.locator('.member-form')
  await form.locator('input[type="email"]').fill('team-locale@example.test')
  await form.locator('input[type="password"]').fill('local-team-password-2026')
  await page
    .getByRole('combobox', { name: 'New member API access', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Selected APIs only', exact: true })
    .click()
  await page.getByRole('checkbox', { name: 'Share Name', exact: true }).click()
  await page
    .getByRole('checkbox', {
      name: 'Use spreadsheet Data sources',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'New role', exact: true }),
  ).toBeEnabled()

  let writes = 0
  let languageReads = 0
  let denied = false
  const privateReads: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    const privateTeam = /^\/api\/(members|roles|permissions)(\/|$)/.test(path)
    if (privateTeam && request.method() !== 'GET') writes++
    if (privateTeam && request.method() === 'GET') {
      languageReads++
      if (denied) privateReads.push(path)
    }
  })

  for (const [
    language,
    label,
    heading,
    name,
    memberRole,
    add,
    access,
    share,
  ] of memberChoices) {
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name, exact: true })).toHaveValue(
      'Custom roles',
    )
    await expect(form.locator('input[type="email"]')).toHaveValue(
      'team-locale@example.test',
    )
    expect(
      (await form.locator('input[type="password"]').inputValue()) ===
        'local-team-password-2026',
    ).toBe(true)
    await expect(
      page.getByRole('combobox', { name: memberRole, exact: true }),
    ).toContainText('Read APIs')
    await expect(
      page.getByRole('combobox', { name: access, exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('checkbox', { name: share, exact: true }),
    ).toBeChecked()
    await expect(form.getByText(/^Data sources/)).toBeVisible()
    await expect(
      page.getByRole('button', { name: add, exact: true }),
    ).toBeEnabled()
    expect(writes).toBe(0)
    expect(languageReads).toBe(0)
    await contained(page)
    await capture(
      'Languages',
      `${label} member draft`,
      'Name, email, password, custom role, selected API and dependency choices stay unchanged. Language selection reads and writes no team state.',
    )
    if (language === 'ru') {
      await page.setViewportSize({ width: 390, height: 844 })
      await contained(page)
      await capture(
        'Languages',
        'Phone light Russian member draft',
        'Full selected-API and dependency warnings wrap inside a native 390px form. The password remains masked.',
      )
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
  }

  await chooseManagementLanguage(page, 'ไทย')
  await page.getByRole('combobox', { name: 'บทบาทสมาชิก', exact: true }).click()
  await expect(
    page.getByRole('option', {
      name: 'Read APIs · บทบาทกำหนดเอง',
      exact: true,
    }),
  ).toHaveAttribute('data-state', 'checked')
  await capture(
    'Languages',
    'Thai member role options',
    'Built-in role descriptions translate; the authored custom role name stays literal and its stable ID remains selected.',
    { region: 'listbox' },
  )
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'มืด', exact: true }).click()
  await contained(page)
  await capture(
    'Languages',
    'Phone dark Thai member draft',
    'Custom controls, full scope guidance and explicit Add action remain readable on a dark phone. No member has been created.',
  )
  await page.getByRole('button', { name: 'เพิ่มสมาชิก', exact: true }).click()
  const receipt = page.getByRole('textbox', {
    name: 'โทเคนสมาชิกใหม่',
    exact: true,
  })
  await expect(receipt).toHaveAttribute('data-private', 'true')
  const memberToken = await receipt.inputValue()
  expect(memberToken.length > 20).toBe(true)
  const membersResponse = await page.request.get(`${apiOrigin}/api/members`, {
    headers,
  })
  expect(membersResponse.status()).toBe(200)
  const created = (await membersResponse.json()).find(
    (person: { name: string }) => person.name === 'Custom roles',
  )
  expect(created.roleId).toBe(role.id)
  expect(created.permissions).toEqual(['flows.read'])
  expect(created.hasAccount).toBe(true)
  expect(created.access.mode).toBe('selected')
  expect(created.access.flowIds).toEqual([flow.id])
  expect(created.access.dependencyUse.sources).toEqual([source.id])
  expect(writes).toBe(1)
  await contained(page)
  await capture(
    'Languages',
    'Phone dark Thai member receipt',
    'Explicit Add creates the actual member with unchanged role, API and dependency IDs. The one-time credential uses a language-independent private mask.',
  )
  await page.getByRole('button', { name: 'บันทึกไว้แล้ว', exact: true }).click()
  await expect(receipt).toHaveCount(0)
  const row = page.getByRole('row').filter({
    has: page.getByRole('cell', { name: 'Custom roles', exact: true }),
  })
  await row
    .getByRole('combobox', { name: 'บทบาทของ Custom roles', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'ผู้แก้ไข · สร้างและทดสอบ', exact: true })
    .click()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'เปลี่ยนบทบาทของ Custom roles จาก Read APIs เป็น ผู้แก้ไข หรือไม่? การกระทำนี้สิ้นสุดเซสชันเบราว์เซอร์ที่ใช้งานอยู่ของสมาชิก คีย์สมาชิกจะใช้สิทธิ์ใหม่ทันที',
    )
    await dialog.dismiss()
  })
  await row.getByRole('button', { name: 'เปลี่ยนบทบาท', exact: true }).click()
  expect(writes).toBe(1)
  await capture(
    'Languages',
    'Thai member role confirmation canceled',
    'Translated role review keeps the authored names and full session/key consequences. Canceling changes neither assignment nor grants.',
  )
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'เพิกถอนสิทธิ์เข้าถึงของ Custom roles หรือไม่?',
    )
    await dialog.dismiss()
  })
  await row.getByRole('button', { name: 'เพิกถอน', exact: true }).click()
  expect(writes).toBe(1)
  await capture(
    'Languages',
    'Thai member revocation canceled',
    'Canceling the translated revocation keeps the actual member credential valid. The member name remains authored text.',
  )
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click()
  denied = true
  await page.getByLabel('โทเคนพื้นที่ทำงาน', { exact: true }).fill(memberToken)
  await page
    .getByRole('button', { name: 'เปิดพื้นที่ทำงาน', exact: true })
    .click()
  await expect(page.locator('.user-profile')).toContainText('Read APIs')
  await expect(
    page.getByRole('button', { name: 'สมาชิก', exact: true }),
  ).toHaveCount(0)
  expect(privateReads).toEqual([])
  await contained(page)
  await capture(
    'Languages',
    'Thai selected member keeps API scope',
    'The created credential still signs in after canceled role and revocation reviews. Selected access hides team administration and reads no private team catalog; its authored custom role stays literal.',
  )
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click()
  await page
    .getByLabel('โทเคนพื้นที่ทำงาน', { exact: true })
    .fill(deniedMember.token)
  await page
    .getByRole('button', { name: 'เปิดพื้นที่ทำงาน', exact: true })
    .click()
  await page.getByRole('button', { name: 'สมาชิก', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'ต้องมีสิทธิ์เจ้าของ', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('เฉพาะเจ้าของเท่านั้นที่จัดการสมาชิกและบทบาทได้', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.member-form')).toHaveCount(0)
  expect(privateReads).toEqual([])
  await contained(page)
  await capture(
    'Languages',
    'Thai custom member denied team administration',
    'Translated owner-only guidance does not mount forms or read private team catalogs for an all-API custom member. Authored member and custom-role names stay literal.',
  )
}
