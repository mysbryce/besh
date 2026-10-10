import {
  expect,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const choices = [
  ['en', 'English', 'Database connections'],
  ['th', 'ไทย', 'การเชื่อมต่อฐานข้อมูล'],
  ['zh', '中文', '数据库连接'],
  ['ru', 'Русский', 'Подключения к базам данных'],
  ['ja', '日本語', 'データベース接続'],
  ['ko', '한국어', '데이터베이스 연결'],
  ['pt', 'Português', 'Conexões de banco de dados'],
] as const

type Language = (typeof choices)[number][0]

export const catalogKeys = [
  'READ A SAVED DATABASE COPY',
  'Choose a SQLite copy, review its tables, then build a read API.',
  'Refresh connections',
  'SQLite uploaded copy · read-only',
  'This is an uploaded read-only copy. Changes to your original database are not synced.',
  'Upload an ordinary SQLite file up to 2 MiB. No database address, server credentials, or SQL is needed.',
  'Loading SQLite copies…',
  'Upload a SQLite copy',
  'Manage database connections access is needed to upload, check, or delete copies.',
  'Connection name',
  'SQLite file',
  'Upload read-only copy',
  'Read database connections access is needed to list saved copies, preview rows, or choose API fields.',
  'No SQLite copies yet',
  'Upload a copy to review its ordinary tables and saved rows.',
  'Saved SQLite copies',
  'Read-only · v{version}',
  'Database connection',
  '{count} tables · {size} KiB saved copy. Published APIs read this copy.',
  'SQLite copy uploaded. Review its table and returned columns.',
  'Database connections refreshed.',
] as const

type Key = (typeof catalogKeys)[number]

// Fixed public acceptance literals do not import application dictionaries.
export const catalogMessages: Record<Language, readonly string[]> = {
  en: [...catalogKeys],
  th: [
    'อ่านสำเนาฐานข้อมูลที่บันทึกไว้',
    'เลือกสำเนา SQLite ตรวจสอบตาราง แล้วสร้าง API สำหรับอ่านข้อมูล',
    'รีเฟรชรายการการเชื่อมต่อ',
    'สำเนา SQLite ที่อัปโหลด · อ่านอย่างเดียว',
    'นี่คือสำเนาที่อัปโหลดสำหรับอ่านอย่างเดียว การเปลี่ยนแปลงในฐานข้อมูลต้นฉบับจะไม่ซิงก์มายังสำเนานี้',
    'อัปโหลดไฟล์ SQLite ทั่วไปขนาดไม่เกิน 2 MiB ไม่ต้องใช้ที่อยู่ฐานข้อมูล ข้อมูลเข้าสู่ระบบเซิร์ฟเวอร์ หรือ SQL',
    'กำลังโหลดสำเนา SQLite…',
    'อัปโหลดสำเนา SQLite',
    'ต้องมีสิทธิ์จัดการการเชื่อมต่อฐานข้อมูลเพื่ออัปโหลด ตรวจสอบ หรือลบสำเนา',
    'ชื่อการเชื่อมต่อ',
    'ไฟล์ SQLite',
    'อัปโหลดสำเนาแบบอ่านอย่างเดียว',
    'ต้องมีสิทธิ์อ่านการเชื่อมต่อฐานข้อมูลเพื่อดูรายการสำเนาที่บันทึกไว้ ดูตัวอย่างแถวข้อมูล หรือเลือกฟิลด์ API',
    'ยังไม่มีสำเนา SQLite',
    'อัปโหลดสำเนาเพื่อตรวจสอบตารางทั่วไปและแถวข้อมูลที่บันทึกไว้',
    'สำเนา SQLite ที่บันทึกไว้',
    'อ่านอย่างเดียว · v{version}',
    'การเชื่อมต่อฐานข้อมูล',
    '{count} ตาราง · สำเนาที่บันทึกไว้ขนาด {size} KiB API ที่เผยแพร่แล้วจะอ่านสำเนานี้',
    'อัปโหลดสำเนา SQLite แล้ว ตรวจสอบตารางและคอลัมน์ที่จะส่งกลับ',
    'รีเฟรชรายการการเชื่อมต่อฐานข้อมูลแล้ว',
  ],
  zh: [
    '读取已保存的数据库副本',
    '选择 SQLite 副本，查看其表，再构建读取 API。',
    '刷新连接列表',
    '已上传的 SQLite 副本 · 只读',
    '这是已上传的只读副本。原始数据库的更改不会同步到此副本。',
    '上传不超过 2 MiB 的普通 SQLite 文件。无需数据库地址、服务器凭据或 SQL。',
    '正在加载 SQLite 副本…',
    '上传 SQLite 副本',
    '需要管理数据库连接权限才能上传、检查或删除副本。',
    '连接名称',
    'SQLite 文件',
    '上传只读副本',
    '需要读取数据库连接权限才能列出已保存的副本、预览行或选择 API 字段。',
    '还没有 SQLite 副本',
    '上传副本以查看其普通表和已保存的行。',
    '已保存的 SQLite 副本',
    '只读 · v{version}',
    '数据库连接',
    '{count} 个表 · 已保存的副本大小为 {size} KiB。已发布的 API 读取此副本。',
    'SQLite 副本已上传。请查看其表和返回列。',
    '数据库连接列表已刷新。',
  ],
  ru: [
    'ЧИТАЙТЕ СОХРАНЁННУЮ КОПИЮ БАЗЫ ДАННЫХ',
    'Выберите копию SQLite, просмотрите её таблицы и создайте API для чтения.',
    'Обновить список подключений',
    'Загруженная копия SQLite · только чтение',
    'Это загруженная копия только для чтения. Изменения исходной базы данных не синхронизируются с ней.',
    'Загрузите обычный файл SQLite размером до 2 MiB. Адрес базы данных, учётные данные сервера и SQL не нужны.',
    'Загрузка копий SQLite…',
    'Загрузить копию SQLite',
    'Для загрузки, проверки или удаления копий нужно разрешение на управление подключениями к базам данных.',
    'Название подключения',
    'Файл SQLite',
    'Загрузить копию только для чтения',
    'Для просмотра списка сохранённых копий, строк или выбора полей API нужно разрешение на чтение подключений к базам данных.',
    'Копий SQLite пока нет',
    'Загрузите копию, чтобы просмотреть её обычные таблицы и сохранённые строки.',
    'Сохранённые копии SQLite',
    'Только чтение · v{version}',
    'Подключение к базе данных',
    'Таблиц: {count} · Размер сохранённой копии: {size} KiB. Опубликованные API читают эту копию.',
    'Копия SQLite загружена. Проверьте её таблицу и возвращаемые столбцы.',
    'Список подключений к базам данных обновлён.',
  ],
  ja: [
    '保存済みデータベースコピーを読み取る',
    'SQLite のコピーを選び、テーブルを確認してから、読み取り API を作成します。',
    '接続一覧を更新',
    'アップロード済み SQLite コピー · 読み取り専用',
    'これはアップロードされた読み取り専用のコピーです。元のデータベースの変更は同期されません。',
    '2 MiB 以下の通常の SQLite ファイルをアップロードします。データベースのアドレス、サーバーの認証情報、SQL は不要です。',
    'SQLite コピーを読み込み中…',
    'SQLite コピーをアップロード',
    'コピーのアップロード、確認、削除には、データベース接続の管理権限が必要です。',
    '接続名',
    'SQLite ファイル',
    '読み取り専用コピーをアップロード',
    '保存済みコピーの一覧表示、行のプレビュー、API フィールドの選択には、データベース接続の閲覧権限が必要です。',
    'SQLite コピーはまだありません',
    'コピーをアップロードして、通常のテーブルと保存済みの行を確認します。',
    '保存済み SQLite コピー',
    '読み取り専用 · v{version}',
    'データベース接続',
    '{count} テーブル · 保存済みコピー {size} KiB。公開済み API はこのコピーを読み取ります。',
    'SQLite コピーをアップロードしました。テーブルと返す列を確認してください。',
    'データベース接続一覧を更新しました。',
  ],
  ko: [
    '저장된 데이터베이스 복사본 읽기',
    'SQLite 복사본을 선택하고 테이블을 확인한 다음 읽기 API를 만드세요.',
    '연결 목록 새로고침',
    '업로드된 SQLite 복사본 · 읽기 전용',
    '업로드된 읽기 전용 복사본입니다. 원본 데이터베이스의 변경 사항은 동기화되지 않습니다.',
    '2 MiB 이하의 일반 SQLite 파일을 업로드하세요. 데이터베이스 주소, 서버 인증 정보 또는 SQL은 필요하지 않습니다.',
    'SQLite 복사본을 불러오는 중…',
    'SQLite 복사본 업로드',
    '복사본을 업로드, 확인 또는 삭제하려면 데이터베이스 연결 관리 권한이 필요합니다.',
    '연결 이름',
    'SQLite 파일',
    '읽기 전용 복사본 업로드',
    '저장된 복사본 목록, 행 미리보기 또는 API 필드 선택에는 데이터베이스 연결 읽기 권한이 필요합니다.',
    '아직 SQLite 복사본이 없습니다',
    '복사본을 업로드하여 일반 테이블과 저장된 행을 확인하세요.',
    '저장된 SQLite 복사본',
    '읽기 전용 · v{version}',
    '데이터베이스 연결',
    '테이블 {count}개 · 저장된 복사본 {size} KiB. 게시된 API는 이 복사본을 읽습니다.',
    'SQLite 복사본을 업로드했습니다. 테이블과 반환할 열을 확인하세요.',
    '데이터베이스 연결 목록을 새로고침했습니다.',
  ],
  pt: [
    'LEIA UMA CÓPIA SALVA DO BANCO DE DADOS',
    'Escolha uma cópia SQLite, confira suas tabelas e crie uma API de leitura.',
    'Atualizar lista de conexões',
    'Cópia SQLite enviada · somente leitura',
    'Esta é uma cópia enviada somente para leitura. Alterações no banco de dados original não são sincronizadas.',
    'Envie um arquivo SQLite comum de até 2 MiB. Não é necessário endereço do banco de dados, credenciais do servidor ou SQL.',
    'Carregando cópias SQLite…',
    'Enviar uma cópia SQLite',
    'É necessária a permissão de gerenciamento de conexões de banco de dados para enviar, verificar ou excluir cópias.',
    'Nome da conexão',
    'Arquivo SQLite',
    'Enviar cópia somente para leitura',
    'É necessária a permissão de leitura de conexões de banco de dados para listar cópias salvas, visualizar linhas ou escolher campos da API.',
    'Ainda não há cópias SQLite',
    'Envie uma cópia para conferir suas tabelas comuns e linhas salvas.',
    'Cópias SQLite salvas',
    'Somente leitura · v{version}',
    'Conexão de banco de dados',
    '{count} tabelas · Cópia salva de {size} KiB. As APIs publicadas leem esta cópia.',
    'Cópia SQLite enviada. Confira sua tabela e as colunas retornadas.',
    'Lista de conexões de banco de dados atualizada.',
  ],
}

function text(language: Language, key: Key) {
  return catalogMessages[language][catalogKeys.indexOf(key)]!
}

type Connection = {
  id: string
  name: string
  bytes: number
  version: number
  kind: string
  mode: string
  tables: {
    name: string
    rowCount: number
    columns: {
      key: string
      label: string
      type: string
      nullable: boolean
    }[]
  }[]
}

const connectionName = 'Refresh connections'
const fixtureName = 'Refresh connections.sqlite'
const tables = [
  {
    name: 'customers',
    rowCount: 2,
    columns: [
      { key: 'id', label: 'id', type: 'number', nullable: true },
      { key: 'name', label: 'name', type: 'string', nullable: false },
      { key: 'city', label: 'city', type: 'string', nullable: false },
    ],
  },
  {
    name: 'empty_rows',
    rowCount: 0,
    columns: [
      { key: 'id', label: 'id', type: 'number', nullable: true },
      { key: 'name', label: 'name', type: 'string', nullable: true },
    ],
  },
]

export async function databaseCatalogLocalePreviews({
  page,
  owner,
  directory,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  directory: string
  apiOrigin: string
  capture: PreviewCapture
}) {
  const target = resolve(directory)
  if (!target.startsWith(resolve(tmpdir()) + sep))
    throw new Error('SQLite catalog fixture must stay inside temporary root')

  const file = join(target, fixtureName)
  // Independent product data, never Besh control storage or an internal API mock.
  const fixture = spawnSync(
    'bun',
    [
      '-e',
      `
    import { Database } from 'bun:sqlite'
    import { writeFileSync } from 'node:fs'

    const database = new Database(':memory:')
    database.run('PRAGMA page_size = 4096')
    database.run('CREATE TABLE customers (id INTEGER, name TEXT NOT NULL, city TEXT NOT NULL)')
    database.run('CREATE TABLE empty_rows (id INTEGER, name TEXT)')

    database.query('INSERT INTO customers VALUES (?, ?, ?)').run(1, 'Ada', 'London')
    database.query('INSERT INTO customers VALUES (?, ?, ?)').run(2, 'Grace', 'New York')

    writeFileSync(process.argv[1], database.serialize())
    database.close()
  `,
      file,
    ],
    { windowsHide: true },
  )
  expect(fixture.status).toBe(0)

  const bytes = readFileSync(file)
  expect(bytes.subarray(0, 16).toString()).toBe('SQLite format 3\0')
  expect(bytes.length).toBe(12288)

  const fileHash = createHash('sha256').update(bytes).digest('hex')
  const headers = { authorization: `Bearer ${owner}` }
  const path = '/api/database-connections'
  const requests: string[] = []
  const actions: string[] = []
  const browserUploads: Request[] = []
  const observe = (request: Request) => {
    const pathname = new URL(request.url()).pathname
    if (
      !/^\/api\/(database-connections|data-sources|flows)(\/|$)/.test(pathname)
    )
      return

    const entry = `${request.method()} ${pathname}`
    requests.push(entry)
    if (request.method() !== 'GET') actions.push(entry)
    if (request.method() === 'POST' && pathname === path)
      browserUploads.push(request)
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

  const upload = page.locator('.source-import')
  const nameInput = upload.locator('input').first()
  const fileInput = upload.locator('input[type="file"]')
  const catalog = page
    .locator('section.source-preview:not(.source-import)')
    .filter({ has: page.locator('.panel-heading') })
  const status = page.locator('.statusbar [role="status"]')

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function held(
    method: string,
    endpoint: string,
    trigger: () => Promise<void>,
    inspect: () => Promise<void>,
  ) {
    const url = `${apiOrigin}${endpoint}`
    const session =
      method === 'POST' ? await page.context().newCDPSession(page) : undefined
    const uploadIndex = browserUploads.length

    let release!: () => void
    let markReady!: () => void
    let markDone!: () => void
    let settleDelivery!: (
      result: { response: Response } | { error: unknown },
    ) => void
    const released = new Promise<void>((done) => {
      release = done
    })
    const ready = new Promise<void>((done) => {
      markReady = done
    })
    const done = new Promise<void>((finish) => {
      markDone = finish
    })
    const delivered = new Promise<{ response: Response } | { error: unknown }>(
      (finish) => {
        settleDelivery = finish
      },
    )
    let ownedRequest: Request | undefined
    let responseStatus = 0
    let responseError = ''
    let failure: unknown

    const receiveDelivery = (response: Response) => {
      if (response.request() === ownedRequest) settleDelivery({ response })
    }
    const receiveFailure = (request: Request) => {
      if (request === ownedRequest)
        settleDelivery({
          error: new Error('Held SQLite catalog request failed'),
        })
    }

    page.on('response', receiveDelivery)
    page.on('requestfailed', receiveFailure)

    const hold = async (route: Route) => {
      if (route.request().method() !== method) {
        await route.continue()
        return
      }

      ownedRequest = route.request()

      try {
        const response = await route.fetch()
        responseStatus = response.status()
        if (responseStatus !== 200) responseError = await response.text()

        markReady()
        await released
        await route.fulfill({ response })
      } catch (reason) {
        failure = reason
        markReady()

        // Ensure an unresolved interception reaches the browser failure boundary.
        await route.abort().catch(() => {})
      } finally {
        markDone()
      }
    }

    // Pause the native upload response; route.fetch cannot replay file parts.
    const pauseUpload = async (event: {
      requestId: string
      request: { method: string }
      responseStatusCode?: number
    }) => {
      if (event.request.method !== method) {
        await session!.send('Fetch.continueResponse', {
          requestId: event.requestId,
        })
        return
      }

      ownedRequest = browserUploads[uploadIndex]

      try {
        responseStatus = event.responseStatusCode ?? 0
        if (responseStatus !== 200) {
          const body = await session!.send('Fetch.getResponseBody', {
            requestId: event.requestId,
          })
          responseError = body.base64Encoded
            ? Buffer.from(body.body, 'base64').toString('utf8')
            : body.body
        }

        markReady()
        await released
        await session!.send('Fetch.continueResponse', {
          requestId: event.requestId,
        })
      } catch (reason) {
        failure = reason
        markReady()
        await session!
          .send('Fetch.failRequest', {
            requestId: event.requestId,
            errorReason: 'Failed',
          })
          .catch(() => {})
      } finally {
        markDone()
      }
    }

    try {
      if (session) {
        session.on('Fetch.requestPaused', pauseUpload)
        await session.send('Fetch.enable', {
          patterns: [{ urlPattern: url, requestStage: 'Response' }],
        })
      } else await page.route(url, hold)

      await trigger()
      await ready
      if (failure) throw failure

      expect(responseStatus, responseError).toBe(200)
      await inspect()
    } finally {
      release()

      try {
        if (ownedRequest) {
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
        if (session) {
          session.off('Fetch.requestPaused', pauseUpload)
          try {
            await session.send('Fetch.disable')
          } finally {
            await session.detach()
          }
        } else await page.unroute(url, hold)
      }
    }

    if (failure) throw failure
  }

  async function shell(language: Language, heading: string) {
    await expect(page.locator('.page-title h1')).toHaveText(heading)
    await expect(page.locator('.page-title .eyebrow')).toHaveText(
      text(language, catalogKeys[0]),
    )
    await expect(page.locator('.page-title p')).toHaveText(
      text(language, catalogKeys[1]),
    )
    await expect(
      page.getByRole('button', {
        name: text(language, 'Refresh connections'),
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('.product-login-guide strong')).toHaveText(
      text(language, catalogKeys[3]),
    )
    await expect(page.locator('.product-login-guide p')).toHaveText([
      text(language, catalogKeys[4]),
      text(language, catalogKeys[5]),
    ])

    await expect(upload.locator('h2')).toHaveText(
      text(language, 'Upload a SQLite copy'),
    )
    await expect(nameInput).toHaveAccessibleName(
      text(language, 'Connection name'),
    )
    await expect(fileInput).toHaveAccessibleName(text(language, 'SQLite file'))
    await expect(fileInput).toHaveAttribute('accept', '.sqlite,.sqlite3,.db')
    await expect(
      upload.getByRole('button', {
        name: text(language, 'Upload read-only copy'),
        exact: true,
      }),
    ).toBeVisible()
  }

  async function selectedFile() {
    await expect(nameInput).toHaveValue(connectionName)
    expect(
      await fileInput.evaluate(async (element) => {
        const file = (element as HTMLInputElement).files?.[0]
        if (!file) return null

        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.arrayBuffer(),
        )

        return {
          name: file.name,
          size: file.size,
          hash: [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join(''),
        }
      }),
    ).toEqual({ name: fixtureName, size: 12288, hash: fileHash })
  }

  async function savedCopy(
    language: Language,
    authoredName: string,
    readable = true,
  ) {
    await expect(catalog.locator('h2')).toHaveText(
      text(language, 'Saved SQLite copies'),
    )
    await expect(catalog.locator('.panel-heading')).toContainText(
      text(language, 'Read-only · v{version}').replace('{version}', '1'),
    )
    await expect(
      catalog.locator('.simple-form').first().locator(':scope > .field-help'),
    ).toHaveText(
      text(language, catalogKeys[18])
        .replace('{count}', '2')
        .replace('{size}', '12.0'),
    )

    if (readable) {
      await expect(
        catalog.getByRole('combobox', {
          name: text(language, 'Database connection'),
          exact: true,
        }),
      ).toHaveText(authoredName)
      await expect(
        catalog.getByRole('combobox', { name: 'Table', exact: true }),
      ).toHaveText('customers')
      await expect(
        catalog.getByRole('checkbox', { name: 'Include id', exact: true }),
      ).toBeChecked()
      await expect(
        catalog.getByRole('checkbox', { name: 'Include name', exact: true }),
      ).toBeChecked()
      await expect(
        catalog.getByRole('checkbox', { name: 'Include city', exact: true }),
      ).toBeChecked()
    } else await expect(catalog.locator('h3')).toHaveText(authoredName)
  }

  async function metadata(id: string) {
    const response = await page.request.get(`${apiOrigin}${path}/${id}`, {
      headers,
    })
    expect(response.status()).toBe(200)

    return (await response.json()) as Connection
  }

  async function contained() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    expect(
      await page
        .locator(
          '.page-title, .product-login-guide, .source-import, .source-preview > .simple-form > .field-help',
        )
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length > 0)
            .every((element) => {
              const child = element.getBoundingClientRect()
              const parent = element.parentElement!.getBoundingClientRect()

              return (
                child.left >= parent.left - 1 && child.right <= parent.right + 1
              )
            }),
        ),
    ).toBe(true)
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

  async function member(name: string, permissions: string[]) {
    const response = await page.request.post(`${apiOrigin}/api/roles`, {
      headers,
      data: { name, permissions },
    })
    expect(response.status()).toBe(200)

    const role = (await response.json()) as { id: string }

    const issued = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name, role: 'custom', roleId: role.id },
    })
    expect(issued.status()).toBe(200)

    return (await issued.json()) as { token: string }
  }

  try {
    await held(
      'GET',
      path,
      async () => {
        await page
          .getByRole('button', { name: 'Database connections', exact: true })
          .click()
      },
      async () => {
        for (const [language, label, heading] of choices) {
          await choose(language, label)
          await shell(language, heading)
          await expect(
            page.getByText(text(language, 'Loading SQLite copies…'), {
              exact: true,
            }),
          ).toBeVisible()
          await expect(
            page.getByRole('heading', {
              name: text(language, 'No SQLite copies yet'),
              exact: true,
            }),
          ).toHaveCount(0)
          await expect(
            page.getByRole('button', {
              name: text(language, 'Refresh connections'),
              exact: true,
            }),
          ).toBeDisabled()
        }

        await capture(
          'Languages',
          'Portuguese SQLite catalog initial loading',
          'A held real empty catalog response shows translated loading without flashing an empty saved-copy state. Locale changes issue no database, source or flow requests.',
        )
      },
    )
    await expect(
      page.getByText(text('pt', 'Loading SQLite copies…'), { exact: true }),
    ).toHaveCount(0)
    await choose('en', 'English')
    await nameInput.fill(connectionName)
    await fileInput.setInputFiles(file)

    for (const [language, label, heading] of choices) {
      await choose(language, label)
      await shell(language, heading)
      await selectedFile()
      await expect(
        page.getByRole('heading', {
          name: text(language, 'No SQLite copies yet'),
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByText(text(language, catalogKeys[14]), { exact: true }),
      ).toBeVisible()
      await expect(
        upload.getByRole('button', {
          name: text(language, 'Upload read-only copy'),
          exact: true,
        }),
      ).toBeEnabled()
      await capture(
        'Languages',
        `${label} SQLite upload staged`,
        'The native file and authored name Refresh connections stay unchanged across languages. Full immutable-copy, no-sync and 2 MiB/no-credentials guidance translates before any upload.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained()
    await capture(
      'Languages',
      'Phone light Thai SQLite upload review',
      'Native 390px light view keeps complete beginner warnings and native selected-file controls readable and contained.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await choose('en', 'English')

    let committed!: Connection
    await held(
      'POST',
      path,
      async () => {
        await upload
          .getByRole('button', { name: 'Upload read-only copy', exact: true })
          .click()
      },
      async () => {
        const response = await page.request.get(`${apiOrigin}${path}`, {
          headers,
        })
        expect(response.status()).toBe(200)

        const records = (await response.json()) as Connection[]
        expect(records).toHaveLength(1)
        committed = records[0]!
        expect(committed).toMatchObject({
          name: connectionName,
          kind: 'sqlite',
          mode: 'uploaded-copy',
          bytes: 12288,
          version: 1,
          tables,
        })
        expect(await metadata(committed.id)).toEqual(committed)
        await expect(catalog).toHaveCount(0)
        await expect(nameInput).toBeDisabled()
        await expect(fileInput).toBeDisabled()
        await expect(
          page.getByRole('button', { name: 'Sign out', exact: true }),
        ).toBeDisabled()
        await choose('ru', 'Русский')
        await selectedFile()
        await expect(
          upload.getByRole('button', {
            name: text('ru', 'Upload read-only copy'),
            exact: true,
          }),
        ).toBeDisabled()
        await capture(
          'Languages',
          'Russian committed SQLite upload pending',
          'Real upload has committed exact version-one table/type/byte metadata before browser delivery. The original native file and authored name remain; disabled controls and language changes cannot upload again.',
        )
      },
    )
    expect((await browserUploads[0]!.allHeaders()).origin).toBe(apiOrigin)
    await savedCopy('ru', connectionName)
    await expect(status).toHaveText(text('ru', catalogKeys[19]))

    await expect(nameInput).toHaveValue('')
    await expect(fileInput).toHaveValue('')

    for (const [language, label, heading] of choices) {
      await choose(language, label)
      await shell(language, heading)
      await savedCopy(language, connectionName)
      await expect(status).toHaveText(text(language, catalogKeys[19]))
      await capture(
        'Languages',
        `${label} saved SQLite catalog metadata`,
        'Actual uploaded metadata retains version 1, two tables, raw 12.0 KiB display and authored identifiers/types. Shared row controls and generation remain intentionally unchanged; no SQL, preview or API action runs.',
      )
    }

    await choose('th', 'ไทย')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await contained()
    await capture(
      'Languages',
      'Phone dark Thai saved SQLite catalog',
      'Native 390px dark view keeps translated saved-copy metadata and immutable-copy guidance contained. Literal row controls are outside this slice.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await choose('en', 'English')

    const beforeRefresh = [...requests]
    await held(
      'GET',
      `${path}/${committed.id}`,
      async () => {
        await held(
          'GET',
          path,
          async () => {
            await page
              .getByRole('button', { name: 'Refresh connections', exact: true })
              .click()
          },
          async () => {
            await expect(
              page.getByRole('button', {
                name: 'Refresh connections',
                exact: true,
              }),
            ).toBeDisabled()
            await choose('zh', '中文')
            await savedCopy('zh', connectionName)
            await expect(
              page.getByText(text('zh', 'Loading SQLite copies…'), {
                exact: true,
              }),
            ).toBeVisible()
            await capture(
              'Languages',
              'Chinese explicit SQLite catalog refresh pending',
              'Explicit Refresh connections holds the real catalog GET. Saved metadata remains visible, language changes issue no additional requests, and refresh stays disabled.',
            )
          },
        )
      },
      async () => {
        await choose('ru', 'Русский')
        await savedCopy('ru', connectionName)
        await expect(
          page.getByRole('button', {
            name: text('ru', 'Refresh connections'),
            exact: true,
          }),
        ).toBeDisabled()
        await capture(
          'Languages',
          'Russian SQLite detail refresh pending',
          'The real refreshed catalog has arrived; its exact saved-copy detail GET remains held. The original version/table/byte metadata remains unchanged until delivery.',
        )
      },
    )
    await expect(
      page.getByRole('button', {
        name: text('ru', 'Refresh connections'),
        exact: true,
      }),
    ).toBeEnabled()
    await expect(status).toHaveText(
      text('ru', 'Database connections refreshed.'),
    )
    expect(requests.slice(beforeRefresh.length)).toEqual([
      `GET ${path}`,
      `GET ${path}/${committed.id}`,
    ])

    for (const [language, label] of choices) {
      await choose(language, label)
      await savedCopy(language, connectionName)
      await expect(status).toHaveText(
        text(language, 'Database connections refreshed.'),
      )
    }
    await capture(
      'Languages',
      'Portuguese SQLite catalog refresh complete',
      'Real catalog and selected-detail GETs complete with the current-language notice. The immutable uploaded copy is not refreshed from its original file or replaced.',
    )

    const reader = await member('Catalog reader', [
      'flows.read',
      'database-connections.read',
    ])
    await signIn(reader.token)
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await savedCopy('en', connectionName)
    await expect(
      page.getByText('Loading SQLite copies…', { exact: true }),
    ).toHaveCount(0)

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        upload.getByText(text(language, catalogKeys[8]), { exact: true }),
      ).toBeVisible()
      await expect(nameInput).toBeDisabled()
      await expect(fileInput).toBeDisabled()
      await expect(
        upload.getByRole('button', {
          name: text(language, 'Upload read-only copy'),
          exact: true,
        }),
      ).toBeDisabled()
    }
    const deniedUpload = await page.request.post(`${apiOrigin}${path}`, {
      headers: { authorization: `Bearer ${reader.token}` },
      multipart: {
        name: connectionName,
        file: {
          name: fixtureName,
          mimeType: 'application/octet-stream',
          buffer: bytes,
        },
      },
    })
    expect(deniedUpload.status()).toBe(403)

    await capture(
      'Languages',
      'Portuguese SQLite reader upload permission',
      'A real reader can browse saved metadata but cannot upload or manage copies. Full permission guidance translates; a valid direct upload returns 403.',
    )

    const manager = await member('Catalog manager', [
      'flows.read',
      'database-connections.manage',
    ])
    await signIn(manager.token)
    const managerReadsBefore = requests.filter((entry) =>
      entry.startsWith(`GET ${path}`),
    )
    await page
      .getByRole('button', { name: 'Database connections', exact: true })
      .click()
    await nameInput.fill('Upload read-only copy')
    await fileInput.setInputFiles(file)

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        page.getByText(text(language, catalogKeys[12]), { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {
          name: text(language, 'Refresh connections'),
          exact: true,
        }),
      ).toBeDisabled()
      await expect(
        upload.getByRole('button', {
          name: text(language, 'Upload read-only copy'),
          exact: true,
        }),
      ).toBeEnabled()
    }
    expect(requests.filter((entry) => entry.startsWith(`GET ${path}`))).toEqual(
      managerReadsBefore,
    )
    await choose('th', 'ไทย')

    const uploaded = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}${path}` &&
        response.request().method() === 'POST',
    )
    await upload
      .getByRole('button', {
        name: text('th', 'Upload read-only copy'),
        exact: true,
      })
      .click()
    const managerUpload = await uploaded
    expect(managerUpload.status()).toBe(200)

    const managed = (await managerUpload.json()) as Connection
    expect(managed).toMatchObject({
      name: 'Upload read-only copy',
      bytes: 12288,
      version: 1,
      tables,
    })
    await savedCopy('th', managed.name, false)
    await expect(status).toHaveText(text('th', catalogKeys[19]))
    await expect(catalog.getByRole('combobox')).toHaveCount(0)

    const managerHeaders = { authorization: `Bearer ${manager.token}` }
    expect(
      (
        await page.request.get(`${apiOrigin}${path}`, {
          headers: managerHeaders,
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await page.request.get(`${apiOrigin}${path}/${managed.id}`, {
          headers: managerHeaders,
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await page.request.post(`${apiOrigin}${path}/${managed.id}/preview`, {
          headers: managerHeaders,
          data: {
            version: 1,
            table: 'customers',
            columns: ['id', 'name'],
            limit: 10,
          },
        })
      ).status(),
    ).toBe(403)
    await capture(
      'Languages',
      'Thai manage-only SQLite upload metadata',
      'A real manage-only member uploads an ordinary copy and sees its returned metadata, with translated read-permission guidance. Catalog, detail and row-preview HTTP requests remain 403; no browse selector is exposed.',
    )

    const selectedResponse = await page.request.post(
      `${apiOrigin}/api/members`,
      {
        headers,
        data: {
          name: 'Selected catalog viewer',
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

    const selectedReadsBefore = requests.filter((entry) =>
      entry.startsWith(`GET ${path}`),
    )
    await signIn(selected.token)
    await expect(
      page.getByRole('button', { name: 'Database connections', exact: true }),
    ).toHaveCount(0)
    expect(requests.filter((entry) => entry.startsWith(`GET ${path}`))).toEqual(
      selectedReadsBefore,
    )

    const selectedHeaders = { authorization: `Bearer ${selected.token}` }
    expect(
      (
        await page.request.get(`${apiOrigin}${path}`, {
          headers: selectedHeaders,
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await page.request.get(`${apiOrigin}${path}/${committed.id}`, {
          headers: selectedHeaders,
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await page.request.post(`${apiOrigin}${path}/${committed.id}/preview`, {
          headers: selectedHeaders,
          data: {
            version: 1,
            table: 'customers',
            columns: ['id', 'name'],
            limit: 10,
          },
        })
      ).status(),
    ).toBe(403)
    expect(await metadata(committed.id)).toEqual(committed)

    const flows = await page.request.get(`${apiOrigin}/api/flows`, { headers })
    expect(flows.status()).toBe(200)
    expect(await flows.json()).toEqual([])
    expect(actions).toEqual([`POST ${path}`, `POST ${path}`])

    const uploadRequests = requests.filter((entry) => entry === `POST ${path}`)
    expect(uploadRequests).toHaveLength(2)
  } finally {
    page.off('request', observe)
  }
}
