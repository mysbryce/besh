import { expect, type Page, type Route } from '@playwright/test'
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
  label: string
  action: string
  help: string
  confirm: string
  complete: string
}

// Fixed public acceptance literals are independent of product dictionaries.
const fixed: Record<Language, Messages> = {
  en: {
    label: 'Replacement spreadsheet',
    action: 'Replace spreadsheet',
    help: 'Replaces saved rows used by your APIs. Keep published columns and their types compatible.',
    confirm:
      'Replace saved data for {source}? APIs using this source will read the new snapshot.',
    complete: 'Spreadsheet replaced. Your APIs now use the saved data.',
  },
  th: {
    label: 'ไฟล์สเปรดชีตใหม่',
    action: 'แทนที่สเปรดชีต',
    help: 'แทนที่แถวข้อมูลที่บันทึกไว้ซึ่ง API ของคุณใช้อยู่ คอลัมน์และชนิดข้อมูลต้องยังรองรับ API ที่เผยแพร่แล้ว',
    confirm:
      'แทนที่ข้อมูลที่บันทึกไว้ของ {source} หรือไม่? API ที่ใช้แหล่งข้อมูลนี้จะอ่านข้อมูลชุดใหม่',
    complete: 'แทนที่สเปรดชีตแล้ว ตอนนี้ API ของคุณใช้ข้อมูลที่บันทึกไว้',
  },
  zh: {
    label: '用于替换的电子表格',
    action: '替换电子表格',
    help: '替换 API 使用的已保存数据行。请保持已发布的列及其类型兼容。',
    confirm: '替换 {source} 的已保存数据？使用此数据源的 API 将读取新快照。',
    complete: '电子表格已替换。您的 API 现在使用已保存的数据。',
  },
  ru: {
    label: 'Таблица для замены',
    action: 'Заменить таблицу',
    help: 'Заменяет сохранённые строки, которые используют ваши API. Сохраняйте совместимость опубликованных столбцов и их типов.',
    confirm:
      'Заменить сохранённые данные источника {source}? API, использующие этот источник, будут читать новый снимок данных.',
    complete:
      'Таблица заменена. Ваши API теперь используют сохранённые данные.',
  },
  ja: {
    label: '置き換え用スプレッドシート',
    action: 'スプレッドシートを置き換え',
    help: 'API が使用する保存済みの行を置き換えます。公開済みの列とその型の互換性を保ってください。',
    confirm:
      '{source} の保存済みデータを置き換えますか？このデータソースを使用する API は新しいスナップショットを読み取ります。',
    complete:
      'スプレッドシートを置き換えました。API は保存済みデータを使用するようになりました。',
  },
  ko: {
    label: '교체할 스프레드시트',
    action: '스프레드시트 교체',
    help: 'API에서 사용하는 저장된 행을 교체합니다. 게시된 열과 해당 유형의 호환성을 유지하세요.',
    confirm:
      '{source}의 저장된 데이터를 교체하시겠습니까? 이 데이터 소스를 사용하는 API는 새 데이터 스냅샷을 읽습니다.',
    complete:
      '스프레드시트를 교체했습니다. 이제 API는 저장된 데이터를 사용합니다.',
  },
  pt: {
    label: 'Planilha de substituição',
    action: 'Substituir planilha',
    help: 'Substitui as linhas salvas usadas pelas suas APIs. Mantenha a compatibilidade das colunas publicadas e de seus tipos.',
    confirm:
      'Substituir os dados salvos de {source}? As APIs que usam esta fonte lerão a nova cópia dos dados.',
    complete: 'Planilha substituída. Suas APIs agora usam os dados salvos.',
  },
}

type Source = {
  id: string
  name: string
  version: number
  rowCount: number
  columns: { key: string; label: string; type: string; nullable: boolean }[]
  rows: Record<string, unknown>[]
}

const sourceName = 'Replace spreadsheet'
const originalCsv = 'Text,Count,Active\nSave draft,12,true\nPublish,15,false\n'
const replacementCsv =
  'Text,Count,Active\nImport spreadsheet,18,true\nSave draft,21,false\n'
const originalRows = [
  { text: 'Save draft', count: 12, active: true },
  { text: 'Publish', count: 15, active: false },
]
const replacementRows = [
  { text: 'Import spreadsheet', count: 18, active: true },
  { text: 'Save draft', count: 21, active: false },
]
const columns = [
  { key: 'text', label: 'Text', type: 'string', nullable: false },
  { key: 'count', label: 'Count', type: 'number', nullable: false },
  { key: 'active', label: 'Active', type: 'boolean', nullable: false },
]
const invalidCsv = 'Text\n"unfinished'
const rawError = 'CSV contains an unfinished quoted value'

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)

  expect(
    await page
      .locator(
        '.source-replace-form, .source-replace-form > *, .source-replace-form input, .source-table',
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
}

export async function dataSourceReplacementLocalePreviews({
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
  const imported = await page.request.post(
    `${apiOrigin}/api/data-sources/import`,
    {
      headers,
      multipart: {
        name: sourceName,
        file: {
          name: 'original.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(originalCsv),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)

  const source = (await imported.json()) as Source
  expect(source).toMatchObject({
    name: sourceName,
    version: 1,
    columns,
    rows: originalRows,
  })

  // Public fixture provisioning supplies an already-published read API. This
  // journey does not exercise or localize the API-generation form.
  const created = await page.request.post(
    `${apiOrigin}/api/data-sources/${source.id}/api`,
    {
      headers,
      data: {
        name: 'Replacement spreadsheet',
        path: '/replacement-locale',
        protocol: 'rest',
        columns: ['text', 'count', 'active'],
        limit: 10,
      },
    },
  )
  expect(created.status()).toBe(200)

  const flow = (await created.json()) as { id: string; revision: number }
  const published = await page.request.post(
    `${apiOrigin}/api/flows/${flow.id}/publish`,
    {
      headers,
      data: { revision: flow.revision },
    },
  )
  expect(published.status()).toBe(200)

  const issued = await page.request.post(`${apiOrigin}/api/runtime-keys`, {
    headers,
    data: {
      name: 'Replacement locale caller',
      flowId: flow.id,
      permissions: ['rest'],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  })
  expect(issued.status()).toBe(200)

  const caller = (await issued.json()) as { token: string }
  const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
    headers,
    data: {
      name: 'Replacement reader',
      permissions: ['flows.read', 'sources.read'],
    },
  })
  expect(roleResponse.status()).toBe(200)

  const role = (await roleResponse.json()) as { id: string }
  const readerResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: { name: 'Replacement reader', role: 'custom', roleId: role.id },
  })
  expect(readerResponse.status()).toBe(200)

  const reader = (await readerResponse.json()) as { token: string }
  const selectedResponse = await page.request.post(`${apiOrigin}/api/members`, {
    headers,
    data: {
      name: 'Selected replacement viewer',
      role: 'viewer',
      access: {
        mode: 'selected',
        flowIds: [flow.id],
        dependencyUse: {
          sources: [],
          databaseConnections: [],
          authConnections: [],
        },
      },
    },
  })
  expect(selectedResponse.status()).toBe(200)

  const selectedViewer = (await selectedResponse.json()) as { token: string }
  const sourceUrl = `${apiOrigin}/api/data-sources/${source.id}`
  const replaceUrl = `${sourceUrl}/import`

  async function saved() {
    const response = await page.request.get(sourceUrl, { headers })
    expect(response.status()).toBe(200)

    return (await response.json()) as Source
  }

  async function definition() {
    const response = await page.request.get(
      `${apiOrigin}/api/flows/${flow.id}`,
      { headers },
    )
    expect(response.status()).toBe(200)

    return response.json()
  }

  async function runtime(rows: typeof originalRows) {
    const response = await page.request.get(
      `${apiOrigin}/run/replacement-locale`,
      {
        headers: { authorization: `Bearer ${caller.token}` },
        maxRedirects: 0,
      },
    )
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual(rows)
  }

  const originalDefinition = await definition()
  await runtime(originalRows)
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

  const preview = page
    .locator('.data-source-grid .source-preview')
    .filter({ has: page.locator('table') })
  const form = preview.locator('.source-replace-form')
  const file = page.locator('#replacement-spreadsheet')
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

  let selectedCsv = replacementCsv

  async function selectedFile() {
    const selected = await file.evaluate(async (input: HTMLInputElement) => {
      const chosen = input.files?.[0]

      return chosen ? { name: chosen.name, text: await chosen.text() } : null
    })
    expect(selected).toEqual({ name: 'replacement.csv', text: selectedCsv })
  }

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function controls(language: Language) {
    await expect(form.locator('label')).toHaveText(fixed[language].label)
    await expect(file).toHaveAttribute('accept', '.csv,.xlsx')
    await expect(form.locator('.field-help')).toHaveText(fixed[language].help)
    await expect(
      form.getByRole('button', { name: fixed[language].action, exact: true }),
    ).toBeEnabled()
    await expect(preview.locator('h2')).toHaveText(sourceName)
    await expect(page.locator('#source-name')).toHaveValue('Save draft')
    await selectedFile()
  }

  async function confirmation(language: Language, accept: boolean) {
    const dialogReady = page.waitForEvent('dialog')
    const clicked = form
      .getByRole('button', { name: fixed[language].action, exact: true })
      .click()
    const dialog = await dialogReady
    const message = dialog.message()

    if (accept) await dialog.accept()
    else await dialog.dismiss()
    await clicked

    expect(message).toBe(
      fixed[language].confirm.replace('{source}', sourceName),
    )
  }

  try {
    await expect(preview.locator('h2')).toHaveText(sourceName)
    await expect(preview.locator('tbody tr').nth(0)).toHaveText(
      'Save draft12true',
    )
    await expect(preview.locator('tbody tr').nth(1)).toHaveText(
      'Publish15false',
    )
    await page.locator('#source-name').fill('Save draft')
    await file.setInputFiles({
      name: 'replacement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(replacementCsv),
    })

    for (const [language, label] of choices) {
      await choose(language, label)
      await controls(language)
      await confirmation(language, false)
      await selectedFile()
      expect(actions).toEqual([])
      expect(await saved()).toMatchObject({
        id: source.id,
        name: sourceName,
        version: 1,
        columns,
        rows: originalRows,
      })
      await runtime(originalRows)
      await contained(page)
      await capture(
        'Languages',
        `${label} replacement file staged and canceled`,
        'Trusted replacement labels, complete compatibility guidance and confirmation follow the selected language. Authored source name, selected native file bytes and saved rows remain literal. Cancel performs no replacement or flow action.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai replacement review',
      'Selected replacement CSV and complete guidance fit native 390px. The original published response still reads the original saved snapshot.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })

    let releaseHeld!: () => void
    let markReady!: () => void
    let markDone!: () => void
    const release = new Promise<void>((done) => {
      releaseHeld = done
    })
    const ready = new Promise<void>((done) => {
      markReady = done
    })
    const done = new Promise<void>((finish) => {
      markDone = finish
    })
    let started = false
    let heldStatus = 0
    let handlerError: unknown
    const holdReplacement = async (route: Route) => {
      started = true
      try {
        const response = await route.fetch()
        heldStatus = response.status()
        markReady()
        await release
        await route.fulfill({ response })
      } catch (error) {
        handlerError = error
        markReady()
      } finally {
        markDone()
      }
    }

    await page.route(replaceUrl, holdReplacement)
    try {
      const delivered = page
        .waitForResponse(
          (response) =>
            response.url() === replaceUrl &&
            response.request().method() === 'PUT',
        )
        .then(
          (response) => ({ response }),
          (error: unknown) => ({ error }),
        )
      await confirmation('th', true)
      await ready
      if (handlerError) throw handlerError

      expect(heldStatus).toBe(200)
      await expect(file).toBeDisabled()
      await expect(
        form.getByRole('button', { name: fixed.th.action, exact: true }),
      ).toBeDisabled()
      await expect(preview.locator('tbody tr').nth(0)).toHaveText(
        'Save draft12true',
      )
      expect(await saved()).toMatchObject({
        id: source.id,
        name: sourceName,
        version: 2,
        columns,
        rows: replacementRows,
      })
      await runtime(replacementRows)
      await choose('ru', 'Русский')
      await expect(form.locator('label')).toHaveText(fixed.ru.label)
      await expect(
        form.getByRole('button', { name: fixed.ru.action, exact: true }),
      ).toBeDisabled()
      await selectedFile()
      await capture(
        'Languages',
        'Russian replacement response pending',
        'The real compatible PUT has committed. Only browser delivery waits. Language changes while replacement controls remain disabled and selected bytes and visible old rows remain intact; no second operation runs.',
      )

      releaseHeld()
      const result = await delivered
      if ('error' in result) throw result.error
      expect(result.response.status()).toBe(200)
      expect(await result.response.json()).toMatchObject({
        id: source.id,
        name: sourceName,
        version: 2,
        columns,
        rows: replacementRows,
      })
      await done
      if (handlerError) throw handlerError
    } finally {
      releaseHeld()
      if (started) await done
      await page.unroute(replaceUrl, holdReplacement)
    }

    await expect(page.getByRole('status')).toContainText(fixed.ru.complete)
    await expect(file).toHaveValue('')
    await expect(preview.locator('tbody tr').nth(0)).toHaveText(
      'Import spreadsheet18true',
    )
    await expect(preview.locator('tbody tr').nth(1)).toHaveText(
      'Save draft21false',
    )

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(form.locator('label')).toHaveText(fixed[language].label)
      await expect(form.locator('.field-help')).toHaveText(fixed[language].help)
      await expect(
        form.getByRole('button', { name: fixed[language].action, exact: true }),
      ).toBeDisabled()
      await expect(page.getByRole('status')).toContainText(
        fixed[language].complete,
      )
      await expect(preview.locator('h2')).toHaveText(sourceName)
      expect(
        await preview
          .locator('th')
          .evaluateAll((elements) =>
            elements.map((element) => element.firstChild?.textContent?.trim()),
          ),
      ).toEqual(['Text', 'Count', 'Active'])
      await contained(page)
      await capture(
        'Languages',
        `${label} replacement saved snapshot`,
        'Explicit compatible replacement keeps source identity and authored column names/types, advances the version once and updates real published REST rows. Completion follows current language without editing or republishing its graph.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai replaced snapshot',
      'Current translated replacement guidance and completion stay readable at native 390px. Authored new rows remain inside their horizontally scrolling table wrapper.',
    )

    selectedCsv = invalidCsv
    await file.setInputFiles({
      name: 'replacement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv),
    })
    const failedReady = page.waitForResponse(
      (response) =>
        response.url() === replaceUrl && response.request().method() === 'PUT',
    )
    await confirmation('th', true)
    const failed = await failedReady
    expect(failed.status()).toBe(400)
    expect(await failed.json()).toEqual({ error: rawError })
    await expect(page.getByRole('alert')).toHaveText(rawError)

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(page.getByRole('alert')).toHaveText(rawError)
      await controls(language)
    }
    expect(await saved()).toMatchObject({
      id: source.id,
      name: sourceName,
      version: 2,
      columns,
      rows: replacementRows,
    })
    await runtime(replacementRows)
    expect(await definition()).toEqual(originalDefinition)
    expect(actions).toEqual([
      `PUT /api/data-sources/${source.id}/import`,
      `PUT /api/data-sources/${source.id}/import`,
    ])
    await choose('th', 'ไทย')
    await contained(page)
    await capture(
      'Languages',
      'Thai rejected replacement keeps saved data',
      'Real CSV parser returns its literal 400 error. All seven languages preserve that raw error, selected invalid bytes, authored source and last valid saved snapshot; existing runtime callers still receive valid replaced rows.',
    )

    await choose('en', 'English')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token', { exact: true }).fill(reader.token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await expect(preview.locator('tbody tr').nth(0)).toHaveText(
      'Import spreadsheet18true',
    )
    await expect(file).toBeDisabled()
    await expect(
      form.getByRole('button', { name: fixed.en.action, exact: true }),
    ).toBeDisabled()

    const denied = await page.request.put(replaceUrl, {
      headers: { authorization: `Bearer ${reader.token}` },
      multipart: {
        name: sourceName,
        file: {
          name: 'replacement.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(replacementCsv),
        },
      },
    })
    expect(denied.status()).toBe(403)

    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page
      .getByLabel('Workspace token', { exact: true })
      .fill(selectedViewer.token)
    const readsBefore = requests.filter((request) =>
      request.startsWith('GET /api/data-sources'),
    )
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('.source-replace-form')).toHaveCount(0)
    expect(
      requests.filter((request) => request.startsWith('GET /api/data-sources')),
    ).toEqual(readsBefore)

    const selectedDenied = await page.request.put(replaceUrl, {
      headers: { authorization: `Bearer ${selectedViewer.token}` },
      multipart: {
        name: sourceName,
        file: {
          name: 'replacement.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(replacementCsv),
        },
      },
    })
    expect(selectedDenied.status()).toBe(403)
    expect(await saved()).toMatchObject({ version: 2, rows: replacementRows })
    await runtime(replacementRows)
  } finally {
    page.off('request', observe)
  }
}
