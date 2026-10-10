import { expect, type Page, type Response, type Route } from '@playwright/test'
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
  link: string
  import: string
  importHelp: string
  open: string
  refresh: string
  snapshotHelp: string
  confirm: string
  complete: string
  denied: string
}

// Acceptance copy is authored independently of the application dictionaries.
export const googleSourceMessages: Record<Language, Messages> = {
  en: {
    link: 'Google Sheets link',
    import: 'Import Google Sheet',
    importHelp:
      'Share the sheet for anyone with the link to view. We save its current rows; changes are imported only when you refresh saved data. For a private sheet, upload Excel or CSV instead.',
    open: 'Open Google Sheet',
    refresh: 'Refresh saved data',
    snapshotHelp:
      'This is a saved snapshot. Refresh imports changes from Google Sheets for APIs using this source.',
    confirm:
      'Refresh saved data for {source}? APIs using this source will read the new Google Sheets snapshot.',
    complete: 'Google Sheet refreshed. Your APIs now use the saved data.',
    denied:
      'Manage data sources access is needed to import or change saved rows.',
  },
  th: {
    link: 'ลิงก์ Google Sheets',
    import: 'นำเข้า Google Sheet',
    importHelp:
      'แชร์ชีตให้ทุกคนที่มีลิงก์ดูได้ เราบันทึกแถวข้อมูลปัจจุบันไว้ การเปลี่ยนแปลงจะนำเข้าเมื่อคุณรีเฟรชข้อมูลที่บันทึกไว้เท่านั้น หากเป็นชีตส่วนตัว ให้อัปโหลด Excel หรือ CSV แทน',
    open: 'เปิด Google Sheet',
    refresh: 'รีเฟรชข้อมูลที่บันทึกไว้',
    snapshotHelp:
      'นี่คือข้อมูลที่บันทึกไว้ การรีเฟรชจะนำเข้าการเปลี่ยนแปลงจาก Google Sheets ให้ API ที่ใช้แหล่งข้อมูลนี้',
    confirm:
      'รีเฟรชข้อมูลที่บันทึกไว้ของ {source} หรือไม่? API ที่ใช้แหล่งข้อมูลนี้จะอ่านข้อมูลชุดใหม่จาก Google Sheets',
    complete: 'รีเฟรช Google Sheet แล้ว ตอนนี้ API ของคุณใช้ข้อมูลที่บันทึกไว้',
    denied:
      'ต้องมีสิทธิ์จัดการแหล่งข้อมูลเพื่อนำเข้าหรือเปลี่ยนแถวข้อมูลที่บันทึกไว้',
  },
  zh: {
    link: 'Google 表格链接',
    import: '导入 Google 表格',
    importHelp:
      '请将表格设为任何拥有链接的人都可查看。我们保存当前数据行；只有刷新已保存数据时才会导入更改。对于私密表格，请改为上传 Excel 或 CSV。',
    open: '打开 Google 表格',
    refresh: '刷新已保存数据',
    snapshotHelp:
      '这是已保存的数据快照。刷新会从 Google 表格导入更改，供使用此数据源的 API 读取。',
    confirm:
      '刷新 {source} 的已保存数据？使用此数据源的 API 将读取新的 Google 表格快照。',
    complete: 'Google 表格已刷新。您的 API 现在使用已保存的数据。',
    denied: '需要管理数据源权限才能导入或更改已保存的数据行。',
  },
  ru: {
    link: 'Ссылка на Google Таблицу',
    import: 'Импортировать Google Таблицу',
    importHelp:
      'Откройте доступ к таблице для просмотра всем, у кого есть ссылка. Мы сохраняем текущие строки; изменения импортируются только при обновлении сохранённых данных. Для закрытой таблицы загрузите Excel или CSV.',
    open: 'Открыть Google Таблицу',
    refresh: 'Обновить сохранённые данные',
    snapshotHelp:
      'Это сохранённый снимок данных. Обновление импортирует изменения из Google Таблиц для API, использующих этот источник.',
    confirm:
      'Обновить сохранённые данные источника {source}? API, использующие этот источник, будут читать новый снимок Google Таблицы.',
    complete:
      'Google Таблица обновлена. Ваши API теперь используют сохранённые данные.',
    denied:
      'Для импорта или изменения сохранённых строк требуется право управления источниками данных.',
  },
  ja: {
    link: 'Google スプレッドシートのリンク',
    import: 'Google スプレッドシートをインポート',
    importHelp:
      'リンクを知っている全員が閲覧できるようにシートを共有してください。現在の行を保存し、保存済みデータを更新したときだけ変更を取り込みます。非公開のシートは Excel または CSV をアップロードしてください。',
    open: 'Google スプレッドシートを開く',
    refresh: '保存済みデータを更新',
    snapshotHelp:
      'これは保存済みデータのスナップショットです。更新すると Google スプレッドシートの変更を取り込み、このデータソースを使用する API に反映します。',
    confirm:
      '{source} の保存済みデータを更新しますか？このデータソースを使用する API は新しい Google スプレッドシートのスナップショットを読み取ります。',
    complete:
      'Google スプレッドシートを更新しました。API は保存済みデータを使用するようになりました。',
    denied:
      '保存済みの行をインポートまたは変更するには、データソースの管理権限が必要です。',
  },
  ko: {
    link: 'Google 스프레드시트 링크',
    import: 'Google 스프레드시트 가져오기',
    importHelp:
      '링크가 있는 모든 사용자가 볼 수 있도록 시트를 공유하세요. 현재 행을 저장하며, 저장된 데이터를 새로고침할 때만 변경 사항을 가져옵니다. 비공개 시트는 Excel 또는 CSV로 업로드하세요.',
    open: 'Google 스프레드시트 열기',
    refresh: '저장된 데이터 새로고침',
    snapshotHelp:
      '저장된 데이터 스냅샷입니다. 새로고침하면 Google 스프레드시트의 변경 사항을 가져와 이 데이터 소스를 사용하는 API에 반영합니다.',
    confirm:
      '{source}의 저장된 데이터를 새로고침하시겠습니까? 이 데이터 소스를 사용하는 API는 새 Google 스프레드시트 스냅샷을 읽습니다.',
    complete:
      'Google 스프레드시트를 새로고침했습니다. 이제 API는 저장된 데이터를 사용합니다.',
    denied:
      '저장된 행을 가져오거나 변경하려면 데이터 소스 관리 권한이 필요합니다.',
  },
  pt: {
    link: 'Link da Planilha Google',
    import: 'Importar Planilha Google',
    importHelp:
      'Compartilhe a planilha para que qualquer pessoa com o link possa vê-la. Salvamos as linhas atuais; alterações só são importadas quando você atualiza os dados salvos. Para uma planilha privada, envie Excel ou CSV.',
    open: 'Abrir Planilha Google',
    refresh: 'Atualizar dados salvos',
    snapshotHelp:
      'Esta é uma cópia salva dos dados. Atualizar importa alterações da Planilha Google para as APIs que usam esta fonte.',
    confirm:
      'Atualizar os dados salvos de {source}? As APIs que usam esta fonte lerão a nova cópia da Planilha Google.',
    complete:
      'Planilha Google atualizada. Suas APIs agora usam os dados salvos.',
    denied:
      'É necessária permissão para gerenciar fontes de dados para importar ou alterar linhas salvas.',
  },
}

type Source = {
  id: string
  name: string
  kind: string
  sourceUrl: string
  version: number
  rowCount: number
  columns: { key: string; label: string; type: string; nullable: boolean }[]
  rows: Record<string, unknown>[]
}

const sourceName = 'Refresh saved data'
const sourceLink =
  'https://docs.google.com/spreadsheets/d/besh-disposable-locale-sheet-2026/edit#gid=0'
const originalRows = [
  { text: 'Save draft', count: 12, active: true },
  { text: 'Publish', count: 15, active: false },
]
const refreshedRows = [
  { text: 'Import Google Sheet', count: 18, active: true },
  { text: 'Save draft', count: 21, active: false },
]
const columns = [
  { key: 'text', label: 'Text', type: 'string', nullable: false },
  { key: 'count', label: 'Count', type: 'number', nullable: false },
  { key: 'active', label: 'Active', type: 'boolean', nullable: false },
]
const rawError =
  'Google Sheet is unavailable. Share it for anyone to view, or upload Excel/CSV instead. Private Google sign-in is not connected.'

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)

  expect(
    await page
      .locator(
        '.source-import-form, .source-import-form > *, #import-source-help, .source-actions, .source-actions > *, .source-table',
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

export async function dataSourceGoogleLocalePreviews({
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

    const event = `${request.method()} ${path}`
    requests.push(event)
    if (request.method() !== 'GET') actions.push(event)
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
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await page.locator('#import-method').click()
  await page
    .getByRole('option', { name: 'Public Google Sheet', exact: true })
    .click()
  await page.locator('#source-name').fill(sourceName)
  await page.locator('#google-sheet-link').fill(sourceLink)
  await expect(page.locator('.runtime-key-empty')).toBeVisible()

  page.on('request', observe)

  const form = page.locator('.source-import-form')
  const preview = page
    .locator('.data-source-grid .source-preview')
    .filter({ has: page.locator('table') })
  const sourceActions = preview.locator('.source-actions')
  let displayedRows = ['Save draft12true', 'Publish15false']

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function importControls(language: Language, staged = true) {
    const text = googleSourceMessages[language]
    await expect(form.locator('label[for="google-sheet-link"]')).toContainText(
      text.link,
    )
    await expect(page.locator('#google-sheet-link')).toHaveAttribute(
      'type',
      'url',
    )
    await expect(page.locator('#google-sheet-link')).toHaveAttribute(
      'placeholder',
      'https://docs.google.com/spreadsheets/d/…/edit',
    )
    await expect(
      form.getByRole('button', { name: text.import, exact: true }),
    ).toHaveCount(1)
    await expect(page.locator('#import-source-help')).toHaveText(
      text.importHelp,
    )

    if (staged) {
      await expect(page.locator('#source-name')).toHaveValue(sourceName)
      await expect(page.locator('#google-sheet-link')).toHaveValue(sourceLink)
      await expect(
        form.getByRole('button', { name: text.import, exact: true }),
      ).toBeEnabled()
    }
  }

  async function snapshotControls(language: Language) {
    const text = googleSourceMessages[language]
    await expect(preview.locator('h2')).toHaveText(sourceName)
    await expect(
      sourceActions.getByRole('link', { name: text.open, exact: true }),
    ).toHaveAttribute('href', sourceLink)
    await expect(
      sourceActions.getByRole('link', { name: text.open, exact: true }),
    ).toHaveAttribute('rel', 'noreferrer')
    await expect(
      sourceActions.getByRole('button', { name: text.refresh, exact: true }),
    ).toBeEnabled()
    await expect(sourceActions.locator('.field-help').first()).toHaveText(
      text.snapshotHelp,
    )
    expect(
      await preview
        .locator('th')
        .evaluateAll((elements) =>
          elements.map((element) => element.firstChild?.textContent?.trim()),
        ),
    ).toEqual(['Text', 'Count', 'Active'])
    await expect(preview.locator('tbody tr')).toHaveText(displayedRows)
  }

  async function confirm(language: Language, accept: boolean) {
    const ready = page.waitForEvent('dialog')
    const clicked = sourceActions
      .getByRole('button', {
        name: googleSourceMessages[language].refresh,
        exact: true,
      })
      .click()
    const dialog = await ready
    const message = dialog.message()

    if (accept) await dialog.accept()
    else await dialog.dismiss()
    await clicked

    expect(message).toBe(
      googleSourceMessages[language].confirm.replace('{source}', sourceName),
    )
  }

  try {
    await importControls('en')

    const importedReady = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}/api/data-sources/google-sheets` &&
        response.request().method() === 'POST',
    )
    await form
      .getByRole('button', {
        name: googleSourceMessages.en.import,
        exact: true,
      })
      .click()
    const imported = await importedReady
    expect(imported.status()).toBe(200)

    const source = (await imported.json()) as Source
    expect(source).toMatchObject({
      name: sourceName,
      kind: 'google-sheets',
      sourceUrl: sourceLink,
      version: 1,
      rowCount: 2,
      columns,
      rows: originalRows,
    })
    await expect(preview.locator('tbody tr').nth(0)).toHaveText(
      'Save draft12true',
    )
    await expect(preview.locator('tbody tr').nth(1)).toHaveText(
      'Publish15false',
    )
    await expect(page.getByRole('status')).toContainText(
      'Spreadsheet imported. Check your data before creating an API.',
    )
    await expect(page.locator('#source-name')).toHaveValue('')
    await expect(page.locator('#google-sheet-link')).toHaveValue('')

    const sourceUrl = `${apiOrigin}/api/data-sources/${source.id}`
    const refreshUrl = `${sourceUrl}/refresh`

    async function saved() {
      const response = await page.request.get(sourceUrl, { headers })
      expect(response.status()).toBe(200)

      return (await response.json()) as Source
    }

    await page.locator('#source-name').fill(sourceName)
    await page.locator('#google-sheet-link').fill(sourceLink)

    for (const [language, label] of choices) {
      await choose(language, label)
      await importControls(language)
      expect(actions).toEqual(['POST /api/data-sources/google-sheets'])
      await contained(page)
      await capture(
        'Languages',
        `${label} public Google import staged`,
        'Trusted import labels and complete public-sharing/private-sheet guidance follow language. Authored name and disposable Google URL remain literal. One real import is already saved; language choice submits no further import, refresh or flow action.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai public Google import',
      'Full guidance and authored URL fit native 390px with the original saved snapshot intact. Google login and private-sheet access are not simulated.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })

    // Every language gets a native confirmation; cancel never reaches Besh.
    for (const [language, label] of choices) {
      await choose(language, label)
      await importControls(language)
      await snapshotControls(language)
      await confirm(language, false)
      expect(actions).toEqual(['POST /api/data-sources/google-sheets'])
    }
    expect(await saved()).toMatchObject({
      version: 1,
      rows: originalRows,
      columns,
      sourceUrl: sourceLink,
    })

    await choose('th', 'ไทย')

    let releaseHeld!: () => void
    let markReady!: () => void
    let markDone!: () => void
    const release = new Promise<void>((resolve) => {
      releaseHeld = resolve
    })
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
    })
    const done = new Promise<void>((resolve) => {
      markDone = resolve
    })
    let started = false
    let heldStatus = 0
    let handlerError: unknown
    let settleDelivery!: (
      result: { response: Response } | { error: unknown },
    ) => void
    const delivered = new Promise<{ response: Response } | { error: unknown }>(
      (resolve) => {
        settleDelivery = resolve
      },
    )
    const receiveDelivery = (response: Response) => {
      if (
        response.url() === refreshUrl &&
        response.request().method() === 'POST'
      )
        settleDelivery({ response })
    }

    page.on('response', receiveDelivery)

    const holdRefresh = async (route: Route) => {
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
        settleDelivery({ error })
      } finally {
        markDone()
      }
    }

    try {
      await page.route(refreshUrl, holdRefresh)
      await confirm('th', true)
      await ready
      if (handlerError) throw handlerError

      expect(heldStatus).toBe(200)
      await expect(
        sourceActions.getByRole('button', {
          name: googleSourceMessages.th.refresh,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#google-sheet-link')).toBeDisabled()
      await expect(page.locator('#google-sheet-link')).toHaveValue(sourceLink)
      await expect(page.locator('#source-name')).toHaveValue(sourceName)
      await expect(preview.locator('tbody tr').nth(0)).toHaveText(
        'Save draft12true',
      )
      expect(await saved()).toMatchObject({
        version: 2,
        rows: refreshedRows,
        columns,
        sourceUrl: sourceLink,
      })

      await choose('ru', 'Русский')
      await expect(
        sourceActions.getByRole('button', {
          name: googleSourceMessages.ru.refresh,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(sourceActions.locator('.field-help').first()).toHaveText(
        googleSourceMessages.ru.snapshotHelp,
      )
      await capture(
        'Languages',
        'Russian Google refresh response pending',
        'The real refresh has committed its second snapshot. Only browser delivery waits. Language changes while controls stay disabled and visible old rows stay literal; no second refresh or flow action runs.',
      )

      releaseHeld()
      const result = await delivered
      if ('error' in result) throw result.error

      expect(result.response.status()).toBe(200)
      expect(await result.response.json()).toMatchObject({
        version: 2,
        rows: refreshedRows,
      })
      await done
      if (handlerError) throw handlerError
    } finally {
      releaseHeld()
      if (started) await done

      // A failed assertion can leave no browser response to observe. Settle
      // that owned observer only after its held route has finished cleanup.
      settleDelivery({
        error:
          handlerError ??
          new Error('Refresh delivery observer closed during cleanup'),
      })
      await delivered
      page.off('response', receiveDelivery)
      await page.unroute(refreshUrl, holdRefresh)
    }

    await expect(page.getByRole('status')).toContainText(
      googleSourceMessages.ru.complete,
    )
    await expect(preview.locator('tbody tr').nth(0)).toHaveText(
      'Import Google Sheet18true',
    )
    await expect(preview.locator('tbody tr').nth(1)).toHaveText(
      'Save draft21false',
    )
    displayedRows = ['Import Google Sheet18true', 'Save draft21false']

    for (const [language, label] of choices) {
      await choose(language, label)
      await importControls(language)
      await snapshotControls(language)
      await expect(page.getByRole('status')).toContainText(
        googleSourceMessages[language].complete,
      )
      await contained(page)
      await capture(
        'Languages',
        `${label} refreshed Google saved snapshot`,
        'Explicit refresh advanced the real saved snapshot once. Authored source, column labels/types, URL and new cells remain literal. Trusted completion reacts to current language; external Google CSV alone is simulated.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai refreshed Google snapshot',
      'Full snapshot guidance and current-language completion fit native 390px dark appearance. Authored rows stay inside the horizontal table viewport.',
    )

    const failedReady = page.waitForResponse(
      (response) =>
        response.url() === refreshUrl && response.request().method() === 'POST',
    )
    await confirm('th', true)
    const failed = await failedReady
    expect(failed.status()).toBe(400)
    expect(await failed.json()).toEqual({ error: rawError })
    await expect(page.getByRole('alert')).toHaveText(rawError)

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(page.getByRole('alert')).toHaveText(rawError)
      await snapshotControls(language)
    }
    expect(await saved()).toMatchObject({
      version: 2,
      rows: refreshedRows,
      columns,
      sourceUrl: sourceLink,
    })
    expect(actions).toEqual([
      'POST /api/data-sources/google-sheets',
      `POST /api/data-sources/${source.id}/refresh`,
      `POST /api/data-sources/${source.id}/refresh`,
    ])

    const flows = await page.request.get(`${apiOrigin}/api/flows`, { headers })
    expect(flows.status()).toBe(200)
    expect(await flows.json()).toEqual([])

    await choose('th', 'ไทย')
    await contained(page)
    await capture(
      'Languages',
      'Thai unavailable Google refresh preserves snapshot',
      'The external provider returns 503; the real management server returns its literal 400 guidance. All languages preserve that raw error and the last valid saved snapshot. No API is generated or changed.',
    )

    const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
      headers,
      data: {
        name: 'Google reader',
        permissions: ['flows.read', 'sources.read'],
      },
    })
    expect(roleResponse.status()).toBe(200)

    const role = (await roleResponse.json()) as { id: string }
    const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name: 'Google reader', role: 'custom', roleId: role.id },
    })
    expect(memberResponse.status()).toBe(200)

    const reader = (await memberResponse.json()) as { token: string }
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
      'Import Google Sheet18true',
    )

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        page.getByText(googleSourceMessages[language].denied, { exact: true }),
      ).toBeVisible()
      await expect(
        sourceActions.getByRole('button', {
          name: googleSourceMessages[language].refresh,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#source-name')).toBeDisabled()
    }

    const readerHeaders = { authorization: `Bearer ${reader.token}` }
    const deniedImport = await page.request.post(
      `${apiOrigin}/api/data-sources/google-sheets`,
      { headers: readerHeaders, data: { name: sourceName, url: sourceLink } },
    )
    expect(deniedImport.status()).toBe(403)

    const deniedRefresh = await page.request.post(refreshUrl, {
      headers: readerHeaders,
    })
    expect(deniedRefresh.status()).toBe(403)
    expect(await saved()).toMatchObject({ version: 2, rows: refreshedRows })

    await choose('th', 'ไทย')
    await capture(
      'Languages',
      'Thai Google reader permission boundary',
      'A real read-only custom member sees the saved rows and translated management explanation. Import and refresh controls remain disabled; both real HTTP operations return 403 without changing the snapshot.',
    )

    const selectedResponse = await page.request.post(
      `${apiOrigin}/api/members`,
      {
        headers,
        data: {
          name: 'Selected Google viewer',
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
    await choose('en', 'English')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page
      .getByLabel('Workspace token', { exact: true })
      .fill(selected.token)
    const readsBefore = requests.filter((request) =>
      request.startsWith('GET /api/data-sources'),
    )
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('#google-sheet-link')).toHaveCount(0)
    expect(
      requests.filter((request) => request.startsWith('GET /api/data-sources')),
    ).toEqual(readsBefore)

    const selectedHeaders = { authorization: `Bearer ${selected.token}` }
    const selectedImport = await page.request.post(
      `${apiOrigin}/api/data-sources/google-sheets`,
      { headers: selectedHeaders, data: { name: sourceName, url: sourceLink } },
    )
    expect(selectedImport.status()).toBe(403)

    const selectedRefresh = await page.request.post(refreshUrl, {
      headers: selectedHeaders,
    })
    expect(selectedRefresh.status()).toBe(403)
    expect(await saved()).toMatchObject({
      version: 2,
      rows: refreshedRows,
      columns,
      sourceUrl: sourceLink,
    })
    expect(actions).toEqual([
      'POST /api/data-sources/google-sheets',
      `POST /api/data-sources/${source.id}/refresh`,
      `POST /api/data-sources/${source.id}/refresh`,
    ])
  } finally {
    page.off('request', observe)
  }
}
