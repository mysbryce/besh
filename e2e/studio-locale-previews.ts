import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const controls = [
  [
    'en',
    'English',
    'Create your first API',
    'Start with a spreadsheet',
    'Build a blank API',
  ],
  ['th', 'ไทย', 'สร้าง API แรกของคุณ', 'เริ่มจากสเปรดชีต', 'สร้าง API เปล่า'],
  ['zh', '中文', '创建你的第一个 API', '从电子表格开始', '创建空白 API'],
  [
    'ru',
    'Русский',
    'Создайте первый API',
    'Начать с таблицы',
    'Создать пустой API',
  ],
  [
    'ja',
    '日本語',
    '最初の API を作成',
    'スプレッドシートから開始',
    '空の API を作成',
  ],
  ['ko', '한국어', '첫 API 만들기', '스프레드시트로 시작', '빈 API 만들기'],
  [
    'pt',
    'Português',
    'Crie sua primeira API',
    'Começar com uma planilha',
    'Criar uma API em branco',
  ],
] as const

type Language = (typeof controls)[number][0]
type FirstTaskGuidance = {
  first: string
  idea: string
  create: string
}

const firstTaskGuidance: Record<Language, FirstTaskGuidance> = {
  en: {
    first:
      'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.',
    idea: 'Your next idea starts here.',
    create: 'Create your first API.',
  },
  th: {
    first:
      'เริ่มจากสเปรดชีตของคุณ หรือสร้าง API เปล่าโดยใช้คำขอและคำตอบด้านล่าง การเปิดเส้นทางใดก็ตามจะไม่บันทึกหรือเผยแพร่ API คุณเลือกเองว่าจะสร้างหรือบันทึกฉบับร่างเมื่อใด',
    idea: 'ไอเดียถัดไปของคุณเริ่มที่นี่',
    create: 'สร้าง API แรกของคุณ',
  },
  zh: {
    first:
      '从你的电子表格开始，或使用下方的请求和响应构建空白 API。打开任一路径都不会保存或发布 API。由你决定何时创建或保存草稿。',
    idea: '你的下一个想法从这里开始。',
    create: '创建你的第一个 API。',
  },
  ru: {
    first:
      'Начните со своей таблицы или создайте пустой API с запросом и ответом ниже. Открытие любого варианта не сохраняет и не публикует API. Вы сами выбираете, когда создать или сохранить черновик.',
    idea: 'Ваша следующая идея начинается здесь.',
    create: 'Создайте первый API.',
  },
  ja: {
    first:
      'スプレッドシートから始めるか、下のリクエストとレスポンスを使って空の API を作成します。どちらを開いても API は保存・公開されません。下書きを作成・保存するタイミングは自分で選べます。',
    idea: '次のアイデアはここから始まります。',
    create: '最初の API を作成しましょう。',
  },
  ko: {
    first:
      '스프레드시트로 시작하거나 아래의 요청과 응답으로 빈 API를 만드세요. 어느 경로를 열어도 API가 저장되거나 게시되지 않습니다. 초안을 만들거나 저장할 시점은 직접 선택합니다.',
    idea: '다음 아이디어는 여기서 시작됩니다.',
    create: '첫 API를 만드세요.',
  },
  pt: {
    first:
      'Comece com sua planilha ou crie uma API em branco usando a solicitação e a resposta abaixo. Abrir qualquer opção não salva nem publica uma API. Você escolhe quando criar ou salvar o rascunho.',
    idea: 'Sua próxima ideia começa aqui.',
    create: 'Crie sua primeira API.',
  },
}

type StudioLocaleOptions = {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(
    await page
      .locator('.load-test-card .title-actions > *')
      .evaluateAll((elements) =>
        elements.every((element) => {
          const parent = element.parentElement!.getBoundingClientRect()
          const child = element.getBoundingClientRect()
          return (
            child.left >= parent.left - 1 && child.right <= parent.right + 1
          )
        }),
      ),
  ).toBe(true)
}

// This journey requires its own fresh empty workspace.
async function openEmptyStudio({
  page,
  owner,
  apiOrigin,
}: StudioLocaleOptions) {
  const headers = { authorization: `Bearer ${owner}` }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(apiOrigin)
  await chooseManagementLanguage(page, 'English')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  const firstTask = page.locator('section[aria-label].load-test-card')
  await expect(firstTask).toBeVisible()

  const flowActions: string[] = []
  const flowReads: string[] = []
  const observeFlow = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/flows(\/|$)/.test(path)) return
    if (request.method() === 'GET') flowReads.push(path)
    else flowActions.push(`${request.method()} ${path}`)
  }
  page.on('request', observeFlow)

  async function readSaved() {
    const response = await page.request.get(`${apiOrigin}/api/flows`, {
      headers,
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as unknown[]
  }

  async function chooseWithoutActions(language: Language, label: string) {
    const actionsBefore = [...flowActions]
    const readsBefore = [...flowReads]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(flowActions).toEqual(actionsBefore)
    expect(flowReads).toEqual(readsBefore)
  }

  return {
    firstTask,
    flowActions,
    observeFlow,
    readSaved,
    chooseWithoutActions,
  }
}

export async function studioFirstTaskLocalePreviews(
  options: StudioLocaleOptions,
) {
  const { page, owner, apiOrigin, capture } = options
  const headers = { authorization: `Bearer ${owner}` }
  const {
    firstTask,
    flowActions,
    observeFlow,
    readSaved,
    chooseWithoutActions,
  } = await openEmptyStudio(options)
  const sourceReads: string[] = []
  const observeSources = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (request.method() === 'GET' && path.startsWith('/api/data-sources'))
      sourceReads.push(path)
  }

  try {
    expect(await readSaved()).toEqual([])
    for (const [language, label, heading, spreadsheet, blank] of controls) {
      const expected = firstTaskGuidance[language]
      await chooseWithoutActions(language, label)
      await expect(firstTask).toHaveAttribute('aria-label', heading)
      await expect(
        firstTask.getByText(expected.first, { exact: true }),
      ).toBeVisible()
      await expect(
        firstTask.getByRole('button', { name: spreadsheet, exact: true }),
      ).toBeEnabled()
      await expect(
        firstTask.getByRole('button', { name: blank, exact: true }),
      ).toBeEnabled()
      await expect(page.locator('.api-list')).toContainText(expected.idea)
      await expect(page.locator('.api-list')).toContainText(expected.create)
      await expect(page.locator('#api-name')).toHaveValue('Untitled API')
      await expect(page.locator('#api-path')).toHaveValue('/hello')
      expect(flowActions).toEqual([])
      await contained(page)
      await capture(
        'Languages',
        `${label} Studio first task`,
        'Full first-task guidance translates without saving, testing or publishing the empty workspace. Starter values remain authored defaults.',
      )
    }
    expect(await readSaved()).toEqual([])

    await chooseWithoutActions('en', 'English')
    await firstTask
      .getByRole('button', { name: 'Start with a spreadsheet', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Data sources', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel('Spreadsheet file', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'No data sources yet.', exact: true }),
    ).toBeVisible()
    expect(flowActions).toEqual([])
    expect(await readSaved()).toEqual([])
    await page.getByRole('button', { name: 'API Studio', exact: true }).click()
    await expect(firstTask).toBeVisible()

    const roleResponse = await page.request.post(apiOrigin + '/api/roles', {
      headers,
      data: {
        name: 'Studio blank builder',
        permissions: ['flows.read', 'flows.write'],
      },
    })
    expect(roleResponse.status()).toBe(200)
    const role = (await roleResponse.json()) as { id: string }
    const memberResponse = await page.request.post(apiOrigin + '/api/members', {
      headers,
      data: {
        name: 'Studio blank-only member',
        role: 'custom',
        roleId: role.id,
      },
    })
    expect(memberResponse.status()).toBe(200)
    const limited = (await memberResponse.json()) as { token: string }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    page.on('request', observeSources)
    await page
      .getByLabel('Workspace token', { exact: true })
      .fill(limited.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(firstTask).toBeVisible()
    await expect(
      firstTask.getByRole('button', {
        name: 'Start with a spreadsheet',
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      firstTask.getByRole('button', {
        name: 'Build a blank API',
        exact: true,
      }),
    ).toBeEnabled()
    expect(sourceReads).toEqual([])
    await firstTask
      .getByRole('button', { name: 'Build a blank API', exact: true })
      .click()
    await expect(firstTask).toHaveCount(0)
    await expect(page.locator('#api-name')).toHaveValue('Untitled API')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: 'Save draft', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Test flow', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()
    expect(sourceReads).toEqual([])
    expect(flowActions).toEqual([])
    expect(await readSaved()).toEqual([])
  } finally {
    page.off('request', observeFlow)
    page.off('request', observeSources)
  }
}
