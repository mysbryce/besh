import {
  expect,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

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
type Messages = {
  loading: string
  denied: string
  placeholder: string
  status: string
  sheet: string
  complete: string
  refresh: string
}

// Fixed acceptance copy does not read product dictionaries.
export const sourceStatusMessages: Record<Language, Messages> = {
  en: {
    loading: 'Loading data sources…',
    denied: 'Read data sources access is needed to browse saved sources.',
    placeholder: 'Choose a data source',
    status:
      'Showing {shown} of {total} rows. Version {version} · Saved {saved}',
    sheet: 'Sheet: {sheet}',
    complete: 'Data sources refreshed.',
    refresh: 'Refresh list',
  },
  th: {
    loading: 'กำลังโหลดแหล่งข้อมูล…',
    denied: 'ต้องมีสิทธิ์อ่านแหล่งข้อมูลเพื่อดูแหล่งข้อมูลที่บันทึกไว้',
    placeholder: 'เลือกแหล่งข้อมูล',
    status:
      'แสดง {shown} จาก {total} แถว เวอร์ชัน {version} · บันทึกเมื่อ {saved}',
    sheet: 'ชีต: {sheet}',
    complete: 'รีเฟรชรายการแหล่งข้อมูลแล้ว',
    refresh: 'รีเฟรชรายการ',
  },
  zh: {
    loading: '正在加载数据源…',
    denied: '需要读取数据源权限才能浏览已保存的数据源。',
    placeholder: '选择数据源',
    status: '显示 {shown} 行，共 {total} 行。版本 {version} · 保存于 {saved}',
    sheet: '工作表：{sheet}',
    complete: '数据源列表已刷新。',
    refresh: '刷新列表',
  },
  ru: {
    loading: 'Загрузка источников данных…',
    denied:
      'Для просмотра сохранённых источников нужно разрешение на чтение источников данных.',
    placeholder: 'Выберите источник данных',
    status:
      'Показано {shown} из {total} строк. Версия {version} · Сохранено {saved}',
    sheet: 'Лист: {sheet}',
    complete: 'Список источников данных обновлён.',
    refresh: 'Обновить список',
  },
  ja: {
    loading: 'データソースを読み込み中…',
    denied:
      '保存済みデータソースを表示するには、データソースの閲覧権限が必要です。',
    placeholder: 'データソースを選択',
    status:
      '{total} 行中 {shown} 行を表示。バージョン {version} · 保存日時 {saved}',
    sheet: 'シート: {sheet}',
    complete: 'データソース一覧を更新しました。',
    refresh: '一覧を更新',
  },
  ko: {
    loading: '데이터 소스를 불러오는 중…',
    denied: '저장된 데이터 소스를 보려면 데이터 소스 읽기 권한이 필요합니다.',
    placeholder: '데이터 소스 선택',
    status: '전체 {total}행 중 {shown}행 표시. 버전 {version} · 저장 {saved}',
    sheet: '시트: {sheet}',
    complete: '데이터 소스 목록을 새로고침했습니다.',
    refresh: '목록 새로고침',
  },
  pt: {
    loading: 'Carregando fontes de dados…',
    denied:
      'É necessária a permissão de leitura de fontes de dados para ver as fontes salvas.',
    placeholder: 'Escolha uma fonte de dados',
    status:
      'Mostrando {shown} de {total} linhas. Versão {version} · Salvo em {saved}',
    sheet: 'Planilha: {sheet}',
    complete: 'Lista de fontes de dados atualizada.',
    refresh: 'Atualizar lista',
  },
}

type Source = {
  id: string
  name: string
  rowCount: number
  version: number
  updatedAt: string
  sheetName?: string
  columns: {
    key: string
    label: string
    type: string
    nullable: boolean
  }[]
  rows: Record<string, unknown>[]
}

const csvName = 'Refresh list'
const csv =
  'Name,Count,Active\nSave draft,12,true\nPublish,15,false\nProduct03,3,true\nProduct04,4,false\nProduct05,5,true\nProduct06,6,false\nProduct07,7,true\nProduct08,8,false\nProduct09,9,true\nProduct10,10,false\nProduct11,11,true\nProduct12,12,false\n'
const replacement = csv.replace('Save draft,12,true', 'Save draft,112,true')
const englishMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const thaiMonths = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]
const russianMonths = [
  'янв.',
  'февр.',
  'мар.',
  'апр.',
  'мая',
  'июн.',
  'июл.',
  'авг.',
  'сент.',
  'окт.',
  'нояб.',
  'дек.',
]
const portugueseMonths = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
]

// Browser contexts use UTC. These explicit language patterns are an independent
// oracle: no product formatter, dictionary or Intl configuration is imported.
function savedDate(language: Language, timestamp: string) {
  const date = new Date(timestamp)
  expect(Number.isNaN(date.getTime())).toBe(false)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const hour = date.getUTCHours()
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const clock = `${String(hour).padStart(2, '0')}:${minute}`
  const twelve = `${hour % 12 || 12}:${minute}`

  switch (language) {
    case 'en':
      return `${englishMonths[month]} ${day}, ${year}, ${twelve} ${hour < 12 ? 'AM' : 'PM'}`
    case 'th':
      return `${day} ${thaiMonths[month]} ${year} ${clock}`
    case 'zh':
      return `${year}年${month + 1}月${day}日 ${clock}`
    case 'ru':
      return `${day} ${russianMonths[month]} ${year} г., ${clock}`
    case 'ja':
      return `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')} ${hour}:${minute}`
    case 'ko':
      return `${year}. ${month + 1}. ${day}. ${hour < 12 ? '오전' : '오후'} ${twelve}`
    case 'pt':
      return `${day} de ${portugueseMonths[month]} de ${year}, ${clock}`
  }
}

function status(language: Language, source: Source) {
  const text = sourceStatusMessages[language].status
    .replace('{shown}', String(source.rows.length))
    .replace('{total}', String(source.rowCount))
    .replace('{version}', String(source.version))
    .replace('{saved}', savedDate(language, source.updatedAt))
  const sheet = source.sheetName
    ? ` · ${sourceStatusMessages[language].sheet.replace('{sheet}', source.sheetName)}`
    : ''

  return `${text}${sheet}.`
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(
    await page
      .locator('.source-preview > .source-note, .page-title')
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
}

export async function dataSourceStatusLocalePreviews({
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
  const requests: string[] = []
  const actions: string[] = []
  const observe = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/(data-sources|flows)(\/|$)/.test(path)) return

    const entry = `${request.method()} ${path}`
    requests.push(entry)
    if (request.method() !== 'GET') actions.push(entry)
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(apiOrigin)
  await chooseManagementLanguage(page, 'English')
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()

  page.on('request', observe)

  const preview = page
    .locator('.data-source-grid .source-preview')
    .filter({ has: page.locator('table') })
  const note = preview.locator(':scope > .source-note')

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function heldGet(
    path: string,
    trigger: () => Promise<void>,
    inspect: () => Promise<void>,
  ) {
    const url = `${apiOrigin}${path}`
    let release!: () => void
    let markReady!: () => void
    let markDone!: () => void
    const released = new Promise<void>((done) => {
      release = done
    })
    const ready = new Promise<void>((done) => {
      markReady = done
    })
    const done = new Promise<void>((finish) => {
      markDone = finish
    })
    let started = false
    let responseStatus = 0
    let failure: unknown
    let ownedRequest: Request | undefined
    let settleDelivery!: (
      result: { response: Response } | { error: unknown },
    ) => void
    const delivered = new Promise<{ response: Response } | { error: unknown }>(
      (finish) => {
        settleDelivery = finish
      },
    )
    const receiveDelivery = (response: Response) => {
      if (response.request() === ownedRequest) settleDelivery({ response })
    }
    const receiveFailure = (request: Request) => {
      if (request === ownedRequest)
        settleDelivery({ error: new Error('Held source request failed') })
    }

    page.on('response', receiveDelivery)
    page.on('requestfailed', receiveFailure)

    const hold = async (route: Route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      started = true
      ownedRequest = route.request()

      try {
        const response = await route.fetch()
        responseStatus = response.status()
        markReady()
        await released
        await route.fulfill({ response })
      } catch (reason) {
        failure = reason
        markReady()

        // Settle an unresolved intercepted request through the browser failure
        // boundary; it may already be finished if delivery itself failed.
        await route.abort().catch(() => {})
      } finally {
        markDone()
      }
    }

    try {
      await page.route(url, hold)
      await trigger()
      await ready
      if (failure) throw failure

      expect(responseStatus).toBe(200)
      await inspect()
    } finally {
      release()

      try {
        if (started) {
          await done
          const result = await delivered

          if ('response' in result) {
            const deliveryError = await result.response.finished()
            if (deliveryError) failure ??= deliveryError
          } else failure ??= result.error
        }
      } finally {
        page.off('response', receiveDelivery)
        page.off('requestfailed', receiveFailure)
        await page.unroute(url, hold)
      }
    }

    if (failure) throw failure
  }

  async function saved(id: string) {
    const response = await page.request.get(
      `${apiOrigin}/api/data-sources/${id}`,
      { headers },
    )
    expect(response.status()).toBe(200)

    return (await response.json()) as Source
  }

  async function previewMatches(language: Language, source: Source) {
    await expect(preview.locator('h2')).toHaveText(source.name)
    await expect(note).toHaveText(status(language, source))
    await expect(preview.locator('tbody tr')).toHaveCount(source.rows.length)
    expect(
      await preview
        .locator('th')
        .evaluateAll((elements) =>
          elements.map((element) => element.firstChild?.textContent?.trim()),
        ),
    ).toEqual(source.columns.map((column) => column.label))
    expect(
      await preview
        .locator('tbody tr')
        .evaluateAll((elements) =>
          elements.map((element) =>
            [...element.querySelectorAll('td')].map((cell) => cell.textContent),
          ),
        ),
    ).toEqual(
      source.rows.map((row) =>
        source.columns.map((column) => String(row[column.key])),
      ),
    )
  }

  async function importFile(
    name: string,
    file: {
      name: string
      mimeType: string
      buffer: Buffer
    },
  ) {
    await page.locator('#source-name').fill(name)
    await page.locator('#spreadsheet-file').setInputFiles(file)
    const received = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}/api/data-sources/import` &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Import spreadsheet', exact: true })
      .click()
    const response = await received
    expect(response.status()).toBe(200)

    const source = (await response.json()) as Source
    await previewMatches('en', source)

    return source
  }

  async function select(name: string) {
    await page.locator('#saved-source').click()
    await page
      .getByRole('option', {
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ·`),
      })
      .click()
    await expect(preview.locator('h2')).toHaveText(name)
  }

  async function signIn(token: string) {
    await choose('en', 'English')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token', { exact: true }).fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()
  }

  try {
    await heldGet(
      '/api/data-sources',
      async () => {
        await page
          .getByRole('button', { name: 'Data sources', exact: true })
          .click()
      },
      async () => {
        for (const [language, label] of choices) {
          await choose(language, label)
          await expect(
            page.getByText(sourceStatusMessages[language].loading, {
              exact: true,
            }),
          ).toBeVisible()
          await expect(
            page.getByRole('button', {
              name: sourceStatusMessages[language].refresh,
              exact: true,
            }),
          ).toBeDisabled()
          await expect(page.locator('.runtime-key-empty')).toHaveCount(0)
        }

        await capture(
          'Languages',
          'Portuguese initial source catalog loading',
          'The real successful catalog response is held before delivery. Loading and disabled Refresh list follow the current language without another source or flow request.',
        )
      },
    )
    await expect(page.locator('.runtime-key-empty')).toBeVisible()
    await choose('en', 'English')

    const imported = await importFile(csvName, {
      name: 'status-review.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    expect(imported).toMatchObject({ name: csvName, version: 1, rowCount: 12 })
    expect(imported.rows).toHaveLength(10)
    expect(imported.rows[0]).toEqual({
      name: 'Save draft',
      count: 12,
      active: true,
    })
    expect(await saved(imported.id)).toEqual(imported)

    for (const [language, label] of choices) {
      await choose(language, label)
      await previewMatches(language, imported)
      await capture(
        'Languages',
        `${label} saved CSV status and date`,
        'The actual 12-row CSV snapshot previews ten typed rows. Status uses Gregorian dates in this browser’s UTC zone with minute precision; authored names, column labels and cells stay literal.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai saved source status',
      'Native 390px light view keeps the full translated 10-of-12 status and date contained; the real table remains scrollable.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await choose('en', 'English')

    const excel = await importFile('Contacts.xlsx', {
      name: 'Contacts.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: readFileSync(resolve('test/fixtures/contacts.xlsx')),
    })
    expect(excel).toMatchObject({
      name: 'Contacts.xlsx',
      version: 1,
      rowCount: 1,
      sheetName: 'Contacts',
    })
    expect(excel.rows[0]).toMatchObject({
      name: 'Ada',
      count: 2,
      active: true,
      created: '2024-07-27T00:00:00.000Z',
      total: 4,
    })

    for (const [language, label] of choices) {
      await choose(language, label)
      await previewMatches(language, excel)
      await capture(
        'Languages',
        `${label} saved Excel sheet status`,
        'Actual checked-in Excel import retains Contacts.xlsx, its Contacts worksheet, Ada and typed cells. Only the trusted status and Sheet prefix translate; the saved date cell is authored data.',
      )
    }

    await choose('th', 'ไทย')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Excel source status',
      'Native 390px dark view contains translated status and Sheet prefix with literal Contacts worksheet and authored date-cell data.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await choose('en', 'English')
    await select(csvName)
    await previewMatches('en', imported)

    const updatedResponse = await page.request.put(
      `${apiOrigin}/api/data-sources/${imported.id}/import`,
      {
        headers,
        multipart: {
          name: csvName,
          file: {
            name: 'status-review.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(replacement),
          },
        },
      },
    )
    expect(updatedResponse.status()).toBe(200)

    const updated = (await updatedResponse.json()) as Source
    expect(updated).toMatchObject({
      id: imported.id,
      name: csvName,
      version: 2,
      rowCount: 12,
    })
    expect(updated.rows).toHaveLength(10)
    expect(updated.rows[0]).toEqual({
      name: 'Save draft',
      count: 112,
      active: true,
    })
    expect(await saved(imported.id)).toEqual(updated)
    await previewMatches('en', imported)

    const refreshRequestsBefore = [...requests]
    await heldGet(
      '/api/data-sources',
      async () => {
        await page
          .getByRole('button', { name: 'Refresh list', exact: true })
          .click()
      },
      async () => {
        await expect(
          page.getByRole('button', { name: 'Refresh list', exact: true }),
        ).toBeDisabled()
        await expect(page.locator('#saved-source')).toBeDisabled()
        await previewMatches('en', imported)
        await choose('ru', 'Русский')
        await previewMatches('ru', imported)
        await expect(
          page.getByRole('button', {
            name: sourceStatusMessages.ru.refresh,
            exact: true,
          }),
        ).toBeDisabled()
        await capture(
          'Languages',
          'Russian explicit catalog refresh pending',
          'Version two already exists through a real compatible public PUT. The visible version-one snapshot remains until explicit catalog refresh completes; controls stay disabled while language changes.',
        )
      },
    )
    await previewMatches('ru', updated)
    await expect(
      page.getByRole('button', {
        name: sourceStatusMessages.ru.refresh,
        exact: true,
      }),
    ).toBeEnabled()
    await expect
      .poll(() => requests.slice(refreshRequestsBefore.length))
      .toEqual([
        'GET /api/data-sources',
        `GET /api/data-sources/${imported.id}`,
      ])

    for (const [language, label] of choices) {
      await choose(language, label)
      await previewMatches(language, updated)
      await expect(page.locator('.statusbar [role="status"]')).toHaveText(
        sourceStatusMessages[language].complete,
      )
    }
    await capture(
      'Languages',
      'Portuguese refreshed source version two',
      'Delivered real catalog and selected-detail GETs reveal version two and current-language completion. Locale changes neither mutate rows nor refetch sources or flows.',
    )

    const browser = page.context().browser()
    if (!browser) throw new Error('Source status needs a real browser')

    const bangkok = await browser.newContext({
      locale: 'en-US',
      timezoneId: 'Asia/Bangkok',
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    })

    try {
      const localPage = await bangkok.newPage()
      await localPage.goto(apiOrigin)
      await localPage.getByLabel('Workspace token', { exact: true }).fill(owner)
      await localPage
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(
        localPage.getByRole('button', { name: 'Sign out', exact: true }),
      ).toBeVisible()
      await localPage
        .getByRole('button', { name: 'Data sources', exact: true })
        .click()
      await expect(
        localPage.locator('.data-source-grid h2').first(),
      ).toHaveText(excel.name)
      await localPage.locator('#saved-source').click()
      await localPage
        .getByRole('option', { name: 'Refresh list · 12 rows', exact: true })
        .click()
      await expect(
        localPage.locator('.data-source-grid h2').first(),
      ).toHaveText(csvName)
      await chooseManagementLanguage(localPage, 'ไทย')

      const localTimestamp = new Date(
        new Date(updated.updatedAt).getTime() + 7 * 60 * 60 * 1000,
      ).toISOString()
      const localStatus = status('th', {
        ...updated,
        updatedAt: localTimestamp,
      })
      expect(localStatus).not.toBe(status('th', updated))
      await expect(
        localPage.locator('.data-source-grid .source-preview > .source-note'),
      ).toHaveText(localStatus)
      await expect(
        localPage.locator('.data-source-grid tbody tr').first(),
      ).toHaveText('Save draft112true')
    } finally {
      await bangkok.close()
    }

    async function member(name: string, permissions: string[]) {
      const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
        headers,
        data: { name, permissions },
      })
      expect(roleResponse.status()).toBe(200)

      const role = (await roleResponse.json()) as { id: string }

      const response = await page.request.post(`${apiOrigin}/api/members`, {
        headers,
        data: { name, role: 'custom', roleId: role.id },
      })
      expect(response.status()).toBe(200)

      return (await response.json()) as { token: string }
    }

    const reader = await member('Status reader', ['flows.read', 'sources.read'])
    await signIn(reader.token)
    await heldGet(
      `/api/data-sources/${excel.id}`,
      async () => {
        await page
          .getByRole('button', { name: 'Data sources', exact: true })
          .click()
      },
      async () => {
        for (const [language, label] of choices) {
          await choose(language, label)
          await expect(page.locator('#saved-source')).toHaveText(
            sourceStatusMessages[language].placeholder,
          )
          await expect(
            page.getByText(sourceStatusMessages[language].loading, {
              exact: true,
            }),
          ).toBeVisible()
          await expect(page.locator('#saved-source')).toBeDisabled()
        }
        await capture(
          'Languages',
          'Portuguese read-only source selection loading',
          'The real catalog has loaded, while its first real detail response is held. The disabled empty selector and loading label translate without new requests.',
        )
      },
    )
    await previewMatches('pt', excel)
    await expect(
      page.getByRole('button', {
        name: sourceStatusMessages.pt.refresh,
        exact: true,
      }),
    ).toBeEnabled()
    await expect(page.locator('#source-name')).toBeDisabled()

    const readerRefreshed = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}/api/data-sources/${excel.id}` &&
        response.request().method() === 'GET',
    )
    await page
      .getByRole('button', {
        name: sourceStatusMessages.pt.refresh,
        exact: true,
      })
      .click()
    expect((await readerRefreshed).status()).toBe(200)
    await previewMatches('pt', excel)
    await expect(page.locator('.statusbar [role="status"]')).toHaveText(
      sourceStatusMessages.pt.complete,
    )

    const deniedWrite = await page.request.put(
      `${apiOrigin}/api/data-sources/${imported.id}/import`,
      {
        headers: { authorization: `Bearer ${reader.token}` },
        multipart: {
          name: csvName,
          file: {
            name: 'status-review.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csv),
          },
        },
      },
    )
    expect(deniedWrite.status()).toBe(403)
    await capture(
      'Languages',
      'Portuguese read-only saved source status',
      'A real reader can browse the saved Excel status and refresh the catalog, while import fields stay disabled and direct replacement returns 403.',
    )

    const writer = await member('Status writer', [
      'flows.read',
      'sources.write',
    ])
    await signIn(writer.token)
    const writerReadsBefore = requests.filter((entry) =>
      entry.startsWith('GET /api/data-sources'),
    )
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        page.getByText(sourceStatusMessages[language].denied, { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {
          name: sourceStatusMessages[language].refresh,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#source-name')).toBeEnabled()
      await expect(page.locator('#saved-source')).toHaveCount(0)
    }
    expect(
      requests.filter((entry) => entry.startsWith('GET /api/data-sources')),
    ).toEqual(writerReadsBefore)
    expect(
      (
        await page.request.get(`${apiOrigin}/api/data-sources`, {
          headers: { authorization: `Bearer ${writer.token}` },
        })
      ).status(),
    ).toBe(403)
    await capture(
      'Languages',
      'Portuguese write-only catalog permission guidance',
      'A real write-only custom member keeps import controls available, but cannot browse saved sources or refresh their catalog. Full read-permission guidance translates in all seven languages.',
    )

    const selectedResponse = await page.request.post(
      `${apiOrigin}/api/members`,
      {
        headers,
        data: {
          name: 'Selected status viewer',
          role: 'viewer',
          access: {
            mode: 'selected',
            flowIds: [],
            dependencyUse: {
              sources: [],
              databaseConnections: [],
              authConnections: [],
            },
          },
        },
      },
    )
    expect(selectedResponse.status()).toBe(200)

    const selected = (await selectedResponse.json()) as { token: string }
    const selectedSourceReadsBefore = requests.filter((entry) =>
      entry.startsWith('GET /api/data-sources'),
    )

    await signIn(selected.token)
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toHaveCount(0)
    expect(
      requests.filter((entry) => entry.startsWith('GET /api/data-sources')),
    ).toEqual(selectedSourceReadsBefore)

    const selectedReadsBefore = [...requests]
    await choose('th', 'ไทย')
    expect(requests).toEqual(selectedReadsBefore)
    expect(
      (
        await page.request.get(`${apiOrigin}/api/data-sources`, {
          headers: { authorization: `Bearer ${selected.token}` },
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await page.request.get(`${apiOrigin}/api/data-sources/${imported.id}`, {
          headers: { authorization: `Bearer ${selected.token}` },
        })
      ).status(),
    ).toBe(403)
    expect(await saved(imported.id)).toEqual(updated)
    expect(await saved(excel.id)).toEqual(excel)

    const flows = await page.request.get(`${apiOrigin}/api/flows`, { headers })
    expect(flows.status()).toBe(200)
    expect(await flows.json()).toEqual([])
    expect(actions).toEqual([
      'POST /api/data-sources/import',
      'POST /api/data-sources/import',
    ])
  } finally {
    page.off('request', observe)
  }
}
