import { expect, type Page, type Route } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

// ApiFromData, SourceActions, Google import/provider proof, policy panels, denied
// explanations, server errors and current number/date formatting remain excluded.
const messageKeys = [
  'FROM SPREADSHEET TO API',
  'Data sources',
  'Bring your data. Preview its columns. Build an API without writing JSON.',
  'Refresh list',
  'Import a spreadsheet',
  'Check your data',
  'Choose API fields',
  'Manage data sources',
  'Add a data source',
  'Import method',
  'Spreadsheet file',
  'Public Google Sheet',
  'Source name',
  'Products',
  'Import spreadsheet',
  'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.',
  'No data sources yet.',
  'Import a spreadsheet to see your data here.',
  'Spreadsheet imported. Check your data before creating an API.',
  'Saved data source',
  '{source} · {count} rows',
  '{count} rows',
  'Text',
  'Number',
  'True or false',
  'Empty cells allowed',
  'Empty',
] as const

type Key = (typeof messageKeys)[number]
const choices = [
  ['en', 'English'],
  ['th', 'ไทย'],
  ['zh', '中文'],
  ['ru', 'Русский'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['pt', 'Português'],
] as const
type Language = (typeof choices)[number][0]

const fixed: Record<Language, readonly string[]> = {
  en: [
    'FROM SPREADSHEET TO API',
    'Data sources',
    'Bring your data. Preview its columns. Build an API without writing JSON.',
    'Refresh list',
    'Import a spreadsheet',
    'Check your data',
    'Choose API fields',
    'Manage data sources',
    'Add a data source',
    'Import method',
    'Spreadsheet file',
    'Public Google Sheet',
    'Source name',
    'Products',
    'Import spreadsheet',
    'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.',
    'No data sources yet.',
    'Import a spreadsheet to see your data here.',
    'Spreadsheet imported. Check your data before creating an API.',
    'Saved data source',
    '{source} · {count} rows',
    '{count} rows',
    'Text',
    'Number',
    'True or false',
    'Empty cells allowed',
    'Empty',
  ],
  th: [
    'จากสเปรดชีตสู่ API',
    'แหล่งข้อมูล',
    'นำข้อมูลของคุณมา ดูตัวอย่างคอลัมน์ แล้วสร้าง API โดยไม่ต้องเขียน JSON',
    'รีเฟรชรายการ',
    'นำเข้าสเปรดชีต',
    'ตรวจสอบข้อมูล',
    'เลือกฟิลด์ API',
    'จัดการแหล่งข้อมูล',
    'เพิ่มแหล่งข้อมูล',
    'วิธีนำเข้า',
    'ไฟล์สเปรดชีต',
    'Google Sheet สาธารณะ',
    'ชื่อแหล่งข้อมูล',
    'สินค้า',
    'นำเข้าสเปรดชีต',
    'CSV หรือ Excel (.xlsx) ขนาดไม่เกิน 2 MB ใส่ชื่อคอลัมน์ในแถวแรก การนำเข้าจะบันทึกภาพข้อมูล ณ เวลานั้น',
    'ยังไม่มีแหล่งข้อมูล',
    'นำเข้าสเปรดชีตเพื่อดูข้อมูลที่นี่',
    'นำเข้าสเปรดชีตแล้ว ตรวจสอบข้อมูลก่อนสร้าง API',
    'แหล่งข้อมูลที่บันทึกไว้',
    '{source} · {count} แถว',
    '{count} แถว',
    'ข้อความ',
    'ตัวเลข',
    'จริงหรือเท็จ',
    'อนุญาตเซลล์ว่าง',
    'ว่าง',
  ],
  zh: [
    '从电子表格到 API',
    '数据源',
    '导入数据，预览列，无需编写 JSON 即可构建 API。',
    '刷新列表',
    '导入电子表格',
    '检查数据',
    '选择 API 字段',
    '管理数据源',
    '添加数据源',
    '导入方式',
    '电子表格文件',
    '公开的 Google 表格',
    '数据源名称',
    '产品',
    '导入电子表格',
    'CSV 或 Excel (.xlsx)，最大 2 MB。请在第一行填写列名。导入会保存数据快照。',
    '尚无数据源。',
    '导入电子表格，在这里查看数据。',
    '电子表格已导入。创建 API 前请检查数据。',
    '已保存的数据源',
    '{source} · {count} 行',
    '{count} 行',
    '文本',
    '数字',
    '真或假',
    '允许空单元格',
    '空',
  ],
  ru: [
    'ИЗ ТАБЛИЦЫ В API',
    'Источники данных',
    'Добавьте данные, просмотрите столбцы и создайте API без написания JSON.',
    'Обновить список',
    'Импортировать таблицу',
    'Проверить данные',
    'Выбрать поля API',
    'Управлять источниками данных',
    'Добавить источник данных',
    'Способ импорта',
    'Файл таблицы',
    'Общедоступная Google Таблица',
    'Название источника',
    'Товары',
    'Импортировать таблицу',
    'CSV или Excel (.xlsx), до 2 МБ. Укажите названия столбцов в первой строке. Импорт сохраняет снимок данных.',
    'Источников данных пока нет.',
    'Импортируйте таблицу, чтобы увидеть данные здесь.',
    'Таблица импортирована. Проверьте данные перед созданием API.',
    'Сохранённый источник данных',
    '{source} · строк: {count}',
    'Строк: {count}',
    'Текст',
    'Число',
    'Истина или ложь',
    'Пустые ячейки разрешены',
    'Пусто',
  ],
  ja: [
    'スプレッドシートから API へ',
    'データソース',
    'データを取り込み、列を確認して、JSON を書かずに API を作成できます。',
    '一覧を更新',
    'スプレッドシートをインポート',
    'データを確認',
    'API フィールドを選択',
    'データソースを管理',
    'データソースを追加',
    'インポート方法',
    'スプレッドシートファイル',
    '公開 Google スプレッドシート',
    'データソース名',
    '商品',
    'スプレッドシートをインポート',
    'CSV または Excel (.xlsx)、最大 2 MB。最初の行に列名を入力してください。インポートするとデータのスナップショットが保存されます。',
    'データソースはまだありません。',
    'スプレッドシートをインポートすると、ここでデータを確認できます。',
    'スプレッドシートをインポートしました。API を作成する前にデータを確認してください。',
    '保存済みデータソース',
    '{source} · {count} 行',
    '{count} 行',
    'テキスト',
    '数値',
    '真または偽',
    '空のセルを許可',
    '空',
  ],
  ko: [
    '스프레드시트에서 API로',
    '데이터 소스',
    '데이터를 가져오고 열을 미리 확인한 뒤 JSON을 작성하지 않고 API를 만드세요.',
    '목록 새로고침',
    '스프레드시트 가져오기',
    '데이터 확인',
    'API 필드 선택',
    '데이터 소스 관리',
    '데이터 소스 추가',
    '가져오기 방법',
    '스프레드시트 파일',
    '공개 Google 스프레드시트',
    '데이터 소스 이름',
    '제품',
    '스프레드시트 가져오기',
    'CSV 또는 Excel(.xlsx), 최대 2 MB. 첫 번째 행에 열 이름을 넣으세요. 가져오면 데이터 스냅샷이 저장됩니다.',
    '아직 데이터 소스가 없습니다.',
    '스프레드시트를 가져오면 여기에서 데이터를 볼 수 있습니다.',
    '스프레드시트를 가져왔습니다. API를 만들기 전에 데이터를 확인하세요.',
    '저장된 데이터 소스',
    '{source} · {count}행',
    '{count}행',
    '텍스트',
    '숫자',
    '참 또는 거짓',
    '빈 셀 허용',
    '비어 있음',
  ],
  pt: [
    'DA PLANILHA À API',
    'Fontes de dados',
    'Traga seus dados, confira as colunas e crie uma API sem escrever JSON.',
    'Atualizar lista',
    'Importar uma planilha',
    'Conferir os dados',
    'Escolher campos da API',
    'Gerenciar fontes de dados',
    'Adicionar uma fonte de dados',
    'Método de importação',
    'Arquivo de planilha',
    'Planilha Google pública',
    'Nome da fonte',
    'Produtos',
    'Importar planilha',
    'CSV ou Excel (.xlsx), até 2 MB. Coloque os nomes das colunas na primeira linha. A importação salva uma cópia dos dados daquele momento.',
    'Ainda não há fontes de dados.',
    'Importe uma planilha para ver seus dados aqui.',
    'Planilha importada. Confira os dados antes de criar uma API.',
    'Fonte de dados salva',
    '{source} · {count} linhas',
    '{count} linhas',
    'Texto',
    'Número',
    'Verdadeiro ou falso',
    'Células vazias permitidas',
    'Vazio',
  ],
}

function expected(language: Language, key: Key) {
  return fixed[language][messageKeys.indexOf(key)]!
}

function withRows(
  language: Language,
  key: '{source} · {count} rows' | '{count} rows',
) {
  return expected(language, key)
    .replace('{source}', 'Import spreadsheet')
    .replace('{count}', '2')
}

type Options = {
  page: Page
  owner: string
  reader: string
  selectedViewer: string
  apiOrigin: string
  capture: PreviewCapture
}
type Source = {
  id: string
  name: string
  kind: string
  rowCount: number
  version: number
  columns: { key: string; label: string; type: string; nullable: boolean }[]
  rows: Record<string, unknown>[]
}

const rawError = 'CSV contains an unfinished quoted value'
const invalidCsv = 'Text\n"unfinished'
const rawCsv =
  'Text,Empty,Count,Active\nImport spreadsheet,Publish,12,true\nSave draft,,15,false\n'
const rawRows = [
  { text: 'Import spreadsheet', empty: 'Publish', count: 12, active: true },
  { text: 'Save draft', empty: null, count: 15, active: false },
]
const rawColumns = [
  { key: 'text', label: 'Text', type: 'string', nullable: false },
  { key: 'empty', label: 'Empty', type: 'string', nullable: true },
  { key: 'count', label: 'Count', type: 'number', nullable: false },
  { key: 'active', label: 'Active', type: 'boolean', nullable: false },
]

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(
    await page
      .locator(
        '.source-import-form > *, .source-import-form input, .source-import-method > *, .source-selector > *',
      )
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .every((element) => {
            const parent = element.parentElement!.getBoundingClientRect()
            const child = element.getBoundingClientRect()
            return (
              child.left >= parent.left - 1 && child.right <= parent.right + 1
            )
          }),
      ),
  ).toBe(true)
  // The table may scroll inside its card. Its wrapper must remain contained.
  expect(
    await page
      .locator('.data-source-grid .source-table')
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

async function assertForm(page: Page, language: Language) {
  await expect(page.locator('.page-title .eyebrow')).toHaveText(
    expected(language, 'FROM SPREADSHEET TO API'),
  )
  await expect(page.locator('.page-title h1')).toHaveText(
    expected(language, 'Data sources'),
  )
  await expect(page.locator('.page-title p')).toHaveText(
    expected(
      language,
      'Bring your data. Preview its columns. Build an API without writing JSON.',
    ),
  )
  await expect(
    page.getByRole('button', {
      name: expected(language, 'Refresh list'),
      exact: true,
    }),
  ).toBeEnabled()
  for (const [index, key] of (
    ['Import a spreadsheet', 'Check your data', 'Choose API fields'] as const
  ).entries()) {
    await expect(
      page.locator('.getting-started-steps > span').nth(index),
    ).toHaveText(`${index + 1} ${expected(language, key)}`)
  }
  await expect(page.locator('.source-write-fields > legend')).toHaveText(
    expected(language, 'Manage data sources'),
  )
  await expect(page.locator('.source-import h2')).toHaveText(
    expected(language, 'Add a data source'),
  )
  await expect(page.locator('label[for="import-method"]')).toHaveText(
    expected(language, 'Import method'),
  )
  await expect(page.locator('#import-method')).toHaveAttribute(
    'aria-label',
    expected(language, 'Import method'),
  )
  await expect(page.locator('#import-method')).toHaveText(
    expected(language, 'Spreadsheet file'),
  )
  await expect(page.locator('label[for="source-name"]')).toContainText(
    expected(language, 'Source name'),
  )
  await expect(page.locator('#source-name')).toHaveAttribute(
    'placeholder',
    expected(language, 'Products'),
  )
  await expect(page.locator('label[for="spreadsheet-file"]')).toContainText(
    expected(language, 'Spreadsheet file'),
  )
  await expect(
    page.getByRole('button', {
      name: expected(language, 'Import spreadsheet'),
      exact: true,
    }),
  ).toBeEnabled()
  await expect(page.locator('#import-source-help')).toHaveText(
    expected(
      language,
      'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.',
    ),
  )
  await page.locator('#import-method').click()
  await expect(
    page.getByRole('option', {
      name: expected(language, 'Spreadsheet file'),
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('option', {
      name: expected(language, 'Public Google Sheet'),
      exact: true,
    }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#google-sheet-link')).toHaveCount(0)
}

// Explicit CSV import only; does not create, test or publish an API.
// Invalid CSV uses the actual server parser. Its raw error is deliberately untranslated.
export async function dataSourceImportLocalePreviews({
  page,
  owner,
  reader,
  selectedViewer,
  apiOrigin,
  capture,
}: Options) {
  const headers = { authorization: `Bearer ${owner}` }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(apiOrigin)
  await chooseManagementLanguage(page, 'English')
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No data sources yet.', exact: true }),
  ).toBeVisible()

  const requests: string[] = []
  const actions: string[] = []
  const observe = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/(data-sources|flows)(\/|$)/.test(path)) return

    const event = `${request.method()} ${path}`
    requests.push(event)

    if (request.method() !== 'GET') actions.push(event)
  }

  page.on('request', observe)

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function sourceList() {
    const response = await page.request.get(`${apiOrigin}/api/data-sources`, {
      headers,
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as Source[]
  }
  async function noFlows() {
    const response = await page.request.get(`${apiOrigin}/api/flows`, {
      headers,
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual([])
  }
  async function selectedFile() {
    expect(
      await page.locator('#spreadsheet-file').evaluate(async (element) => {
        const file = (element as HTMLInputElement).files?.[0]
        if (!file) return null

        return { name: file.name, text: await file.text() }
      }),
    ).toEqual({ name: 'literal.csv', text: selectedCsv })
  }

  let selectedCsv = rawCsv

  try {
    expect(await sourceList()).toEqual([])
    await noFlows()
    await page.locator('#source-name').fill('Import spreadsheet')
    await page.locator('#spreadsheet-file').setInputFiles({
      name: 'literal.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(rawCsv),
    })

    for (const [language, label] of choices) {
      await choose(language, label)
      await assertForm(page, language)
      await expect(page.locator('#source-name')).toHaveValue(
        'Import spreadsheet',
      )
      await selectedFile()
      await expect(page.locator('.runtime-key-empty h2')).toHaveText(
        expected(language, 'No data sources yet.'),
      )
      await expect(page.locator('.runtime-key-empty p')).toHaveText(
        expected(language, 'Import a spreadsheet to see your data here.'),
      )
      expect(actions).toEqual([])
      await contained(page)
      await capture(
        'Languages',
        `${label} CSV import staged`,
        'Full basic CSV guidance and controls translate. Authored source name and selected native file remain unchanged. Locale selection does not import data, read catalogs or create an API.',
      )
    }
    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai staged CSV import',
      'Translated import form stays contained at native 390px with selected file and authored source name intact; table, provider and policy operations have not run.',
    )

    selectedCsv = invalidCsv

    await page.locator('#spreadsheet-file').setInputFiles({
      name: 'literal.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv),
    })
    const failedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/data-sources/import' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', {
        name: expected('th', 'Import spreadsheet'),
        exact: true,
      })
      .click()
    const failed = await failedResponse
    expect(failed.status()).toBe(400)
    expect(await failed.json()).toEqual({ error: rawError })
    await expect(page.getByRole('alert')).toHaveText(rawError)
    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(page.getByRole('alert')).toHaveText(rawError)
      await expect(page.locator('#source-name')).toHaveValue(
        'Import spreadsheet',
      )
      await selectedFile()
    }
    expect(await sourceList()).toEqual([])
    await noFlows()
    await choose('th', 'ไทย')
    await capture(
      'Languages',
      'Thai actual CSV error remains literal',
      'Explicit import reaches the real parser and fails. Switching all seven languages retains its raw server error, selected file and source name, with no saved source or API.',
    )

    await page.locator('#spreadsheet-file').setInputFiles({
      name: 'literal.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(rawCsv),
    })
    selectedCsv = rawCsv

    const importUrl = `${apiOrigin}/api/data-sources/import`
    let releaseHeld!: () => void
    let markFetchReady!: () => void
    let markHandlerDone!: () => void
    const release = new Promise<void>((resolve) => {
      releaseHeld = resolve
    })
    const fetchReady = new Promise<void>((resolve) => {
      markFetchReady = resolve
    })
    const handlerDone = new Promise<void>((resolve) => {
      markHandlerDone = resolve
    })

    let handlerStarted = false
    let heldStatus = 0
    let handlerError: unknown
    const holdImport = async (route: Route) => {
      handlerStarted = true

      try {
        const response = await route.fetch()
        heldStatus = response.status()
        markFetchReady()
        await release
        await route.fulfill({ response })
      } catch (reason) {
        handlerError = reason
        markFetchReady()
      } finally {
        markHandlerDone()
      }
    }

    await page.route(importUrl, holdImport)

    let imported!: Source
    try {
      const importedResponse = page
        .waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/data-sources/import' &&
            response.request().method() === 'POST',
        )
        .then(
          (response) => ({ response }),
          (error: unknown) => ({ error }),
        )
      // The server performs the actual authorized import. Only delivery to the
      // dashboard waits; no saved state or response body is substituted.
      await page
        .getByRole('button', {
          name: expected('th', 'Import spreadsheet'),
          exact: true,
        })
        .click()
      await fetchReady
      if (handlerError) throw handlerError
      expect(heldStatus).toBe(200)
      expect(await sourceList()).toHaveLength(1)
      await expect(page.locator('.source-write-fields')).toHaveAttribute(
        'disabled',
        '',
      )
      await expect(page.locator('#import-method')).toBeDisabled()
      await expect(page.locator('#source-name')).toBeDisabled()
      await expect(page.locator('#spreadsheet-file')).toBeDisabled()
      await expect(
        page.getByRole('button', {
          name: expected('th', 'Import spreadsheet'),
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#source-name')).toHaveValue(
        'Import spreadsheet',
      )
      await selectedFile()
      await choose('ru', 'Русский')
      await expect(page.locator('#source-name')).toHaveValue(
        'Import spreadsheet',
      )
      await selectedFile()
      releaseHeld()
      const delivered = await importedResponse
      if ('error' in delivered) throw delivered.error
      const importedHttp = delivered.response
      expect(importedHttp.status()).toBe(200)
      imported = (await importedHttp.json()) as Source
      expect(imported).toMatchObject({
        name: 'Import spreadsheet',
        kind: 'upload',
        rowCount: 2,
        version: 1,
        columns: rawColumns,
        rows: rawRows,
      })
      await handlerDone
      if (handlerError) throw handlerError
    } finally {
      releaseHeld()
      if (handlerStarted) await handlerDone
      await page.unroute(importUrl, holdImport)
    }
    await expect(page.getByRole('status')).toContainText(
      expected(
        'ru',
        'Spreadsheet imported. Check your data before creating an API.',
      ),
    )
    await expect(page.locator('#source-name')).toHaveValue('')
    await expect(page.locator('#spreadsheet-file')).toHaveValue('')
    await expect(page.getByRole('alert')).toHaveCount(0)
    const preview = page
      .locator('.data-source-grid .source-preview')
      .filter({ has: page.locator('table') })
    await expect(preview.locator('h2')).toHaveText('Import spreadsheet')
    await page.setViewportSize({ width: 1440, height: 1000 })

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(page.getByRole('status')).toContainText(
        expected(
          language,
          'Spreadsheet imported. Check your data before creating an API.',
        ),
      )
      await expect(page.locator('label[for="saved-source"]')).toHaveText(
        expected(language, 'Saved data source'),
      )
      await expect(page.locator('#saved-source')).toHaveAttribute(
        'aria-label',
        expected(language, 'Saved data source'),
      )
      await expect(page.locator('#saved-source')).toHaveText(
        withRows(language, '{source} · {count} rows'),
      )
      await expect(preview.locator('[data-slot="badge"]')).toHaveText(
        withRows(language, '{count} rows'),
      )
      expect(
        await preview
          .locator('th')
          .evaluateAll((headers) =>
            headers.map((header) => header.firstChild?.textContent?.trim()),
          ),
      ).toEqual(['Text', 'Empty', 'Count', 'Active'])
      const types = preview.locator('.column-type')
      await expect(types.nth(0)).toHaveText(expected(language, 'Text'))
      await expect(types.nth(1)).toHaveText(
        `${expected(language, 'Text')} · ${expected(language, 'Empty cells allowed')}`,
      )
      await expect(types.nth(2)).toHaveText(expected(language, 'Number'))
      await expect(types.nth(3)).toHaveText(expected(language, 'True or false'))
      await expect(preview.locator('tbody tr').nth(0)).toHaveText(
        'Import spreadsheetPublish12true',
      )
      await expect(preview.locator('tbody tr').nth(1)).toHaveText(
        `Save draft${expected(language, 'Empty')}15false`,
      )
      await expect(preview.locator('.empty-cell')).toHaveText(
        expected(language, 'Empty'),
      )
      await contained(page)
      await capture(
        'Languages',
        `${label} imported CSV row preview`,
        'Real saved CSV snapshot retains authored source name, original column labels, canonical keys, values and boolean text. Only trusted type/empty/count labels translate; date/number formatting, mapping and source actions remain outside this slice.',
      )
    }
    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai imported CSV preview',
      'Actual saved rows remain inside their table wrapper at 390px. Empty-cell/type labels translate. No automatic refresh, replacement, policy write, API creation or publication occurs.',
    )
    expect(actions).toEqual([
      'POST /api/data-sources/import',
      'POST /api/data-sources/import',
    ])
    const savedList = await sourceList()
    expect(savedList).toHaveLength(1)
    expect(savedList[0]).toMatchObject({
      id: imported.id,
      name: imported.name,
      columns: rawColumns,
      rowCount: 2,
      version: 1,
    })
    const persisted = await page.request.get(
      `${apiOrigin}/api/data-sources/${imported.id}`,
      { headers },
    )
    expect(persisted.status()).toBe(200)
    expect(await persisted.json()).toMatchObject({
      columns: rawColumns,
      rows: rawRows,
      version: 1,
    })
    await noFlows()

    // Existing permission seams only; no new denied copy or policy editor scope.
    await choose('en', 'English')
    await page.setViewportSize({ width: 1440, height: 1000 })
    // Fixture supplies memory-only subjects. This journey never creates or
    // parses credential-bearing member receipts and never prints key values.
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token', { exact: true }).fill(reader)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await expect(
      page.getByRole('cell', { name: 'Import spreadsheet', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.source-write-fields')).toHaveAttribute(
      'disabled',
      '',
    )
    await expect(page.locator('#import-method')).toBeDisabled()
    await expect(page.locator('#source-name')).toBeDisabled()
    await expect(page.locator('#spreadsheet-file')).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Import spreadsheet', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Create API from data', exact: true }),
    ).toBeDisabled()
    expect(
      (
        await page.request.delete(
          `${apiOrigin}/api/data-sources/${imported.id}`,
          {
            headers: { authorization: `Bearer ${reader}` },
          },
        )
      ).status(),
    ).toBe(403)

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page
      .getByLabel('Workspace token', { exact: true })
      .fill(selectedViewer)

    const readsBefore = requests.filter((request) =>
      request.startsWith('GET /api/data-sources'),
    )
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('.source-import-form')).toHaveCount(0)
    expect(
      requests.filter((request) => request.startsWith('GET /api/data-sources')),
    ).toEqual(readsBefore)
    expect(
      (
        await page.request.get(`${apiOrigin}/api/data-sources/${imported.id}`, {
          headers: { authorization: `Bearer ${selectedViewer}` },
        })
      ).status(),
    ).toBe(403)
  } finally {
    page.off('request', observe)
  }
}
