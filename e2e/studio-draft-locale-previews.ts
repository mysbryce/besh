import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

// Dynamic footer notices and advanced editors remain outside this story.
const controls = [
  [
    'en',
    'English',
    'Save draft',
    'Test flow',
    'Publish',
    'Unsaved changes',
    'Field value 1',
  ],
  [
    'th',
    'ไทย',
    'บันทึกฉบับร่าง',
    'ทดสอบโฟลว์',
    'เผยแพร่',
    'การเปลี่ยนแปลงที่ยังไม่บันทึก',
    'ค่า ฟิลด์ 1',
  ],
  ['zh', '中文', '保存草稿', '测试流程', '发布', '未保存的更改', '字段值 1'],
  [
    'ru',
    'Русский',
    'Сохранить черновик',
    'Проверить схему',
    'Опубликовать',
    'Несохранённые изменения',
    'Значение Поле 1',
  ],
  [
    'ja',
    '日本語',
    '下書きを保存',
    'フローをテスト',
    '公開',
    '未保存の変更',
    'フィールド の値 1',
  ],
  [
    'ko',
    '한국어',
    '초안 저장',
    '흐름 테스트',
    '게시',
    '저장하지 않은 변경 사항',
    '필드 값 1',
  ],
  [
    'pt',
    'Português',
    'Salvar rascunho',
    'Testar fluxo',
    'Publicar',
    'Alterações não salvas',
    'Valor de Campo 1',
  ],
] as const

type Language = (typeof controls)[number][0]
type DraftGuidance = {
  route: string
  credential: string
  request: string
  empty: string
  counts: string
  saved: string
  live: string
}

// Fixed counts and revision match the actual two-node, one-edge starter.
const draftGuidance: Record<Language, DraftGuidance> = {
  en: {
    route:
      'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.',
    credential:
      'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.',
    request: 'REQUEST DETAILS',
    empty:
      '// Save your draft, then run a test.\n// Your response will appear here.',
    counts: '2 nodes · 1 connections',
    saved: 'Saved · revision 1',
    live: 'Live · v1',
  },
  th: {
    route:
      'ใช้ /v1/customers/:id สำหรับเส้นทางที่ระบุเวอร์ชันและมีพารามิเตอร์ในเส้นทาง แต่ละ :name ต้องเป็นหนึ่งส่วนเต็มของเส้นทาง',
    credential:
      'คีย์เจ้าของและสมาชิกใช้จัดการฉบับร่าง สร้างคีย์ API ในหน้าคีย์ API เพื่อเรียกปลายทางที่เผยแพร่แล้ว',
    request: 'รายละเอียดคำขอ',
    empty: '// บันทึกฉบับร่าง แล้วรันทดสอบ\n// คำตอบของคุณจะแสดงที่นี่',
    counts: '2 ขั้นตอน · 1 การเชื่อมต่อ',
    saved: 'บันทึกแล้ว · ฉบับแก้ไข 1',
    live: 'ใช้งานจริง · v1',
  },
  zh: {
    route:
      '使用 /v1/customers/:id 创建带版本号和路径参数的路由。每个 :name 必须占据一个完整的路由段。',
    credential:
      '所有者密钥和成员密钥用于管理草稿。在 API 密钥页面创建 API 密钥，以调用已发布的端点。',
    request: '请求详情',
    empty: '// 保存草稿，然后运行测试。\n// 响应将显示在这里。',
    counts: '2 个节点 · 1 个连接',
    saved: '已保存 · 修订版 1',
    live: '已上线 · v1',
  },
  ru: {
    route:
      'Используйте /v1/customers/:id для маршрута с версией и параметром пути. Каждый :name должен занимать целый сегмент маршрута.',
    credential:
      'Ключи владельца и участников управляют черновиками. Создайте ключ API в разделе «Ключи API», чтобы вызывать опубликованный эндпоинт.',
    request: 'ДАННЫЕ ЗАПРОСА',
    empty:
      '// Сохраните черновик, затем запустите тест.\n// Здесь появится ваш ответ.',
    counts: 'Узлы: 2 · Соединения: 1',
    saved: 'Сохранено · ревизия 1',
    live: 'Опубликовано · v1',
  },
  ja: {
    route:
      'バージョン付きでパスパラメーターを使うルートには /v1/customers/:id を指定します。各 :name はルートの 1 セグメント全体を占めます。',
    credential:
      'オーナーキーとメンバーキーは下書きの管理に使います。公開済みエンドポイントを呼び出すには「API キー」で API キーを作成してください。',
    request: 'リクエストの詳細',
    empty:
      '// 下書きを保存してからテストを実行してください。\n// レスポンスはここに表示されます。',
    counts: 'ノード 2 個 · 接続 1 本',
    saved: '保存済み · リビジョン 1',
    live: '公開中 · v1',
  },
  ko: {
    route:
      '버전과 경로 매개변수가 있는 경로에는 /v1/customers/:id를 사용하세요. 각 :name은 경로의 한 구간 전체를 차지해야 합니다.',
    credential:
      '소유자 키와 멤버 키는 초안을 관리합니다. 게시된 엔드포인트를 호출하려면 API 키 페이지에서 API 키를 만드세요.',
    request: '요청 세부 정보',
    empty:
      '// 초안을 저장한 다음 테스트를 실행하세요.\n// 응답이 여기에 표시됩니다.',
    counts: '노드 2개 · 연결 1개',
    saved: '저장됨 · 리비전 1',
    live: '게시됨 · v1',
  },
  pt: {
    route:
      'Use /v1/customers/:id para uma rota com versão e parâmetro de caminho. Cada :name ocupa um segmento inteiro da rota.',
    credential:
      'As chaves do proprietário e dos membros gerenciam rascunhos. Crie uma chave de API em Chaves de API para chamar um endpoint publicado.',
    request: 'DETALHES DA SOLICITAÇÃO',
    empty:
      '// Salve o rascunho e execute um teste.\n// Sua resposta aparecerá aqui.',
    counts: 'Nós: 2 · Conexões: 1',
    saved: 'Salvo · revisão 1',
    live: 'Em produção · v1',
  },
}

const provisionalThaiDiscard =
  'ละทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่ได้บันทึกหรือไม่?'

type FlowRecord = {
  id: string
  name: string
  method: string
  path: string
  revision: number
  publishedRevision: number | null
  publishedEndpoint: {
    method: string
    path: string
    graphql: boolean
    transport: string
  } | null
  nodes: { type: string; config: unknown }[]
  edges: unknown[]
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await expect(page.locator('.endpoint-bar')).toBeVisible()
  expect(
    await page
      .locator(
        '.title-actions > *, .endpoint-bar > *, .endpoint-bar input, .editor-toolbar > *, .editor-toolbar > div > *, .field-row > *, .simple-form input, .simple-form button[role="combobox"], .test-panel > *, .test-request .panel-heading > *',
      )
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          if (element.getClientRects().length === 0) return []

          const parent = element.parentElement!.getBoundingClientRect()
          const child = element.getBoundingClientRect()
          if (child.left >= parent.left - 1 && child.right <= parent.right + 1)
            return []

          return [
            {
              tag: element.tagName,
              class: element.className,
              parent: { left: parent.left, right: parent.right },
              child: { left: child.left, right: child.right },
            },
          ]
        }),
      ),
  ).toEqual([])
  expect(
    await page
      .getByTestId('test-result')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true)
}

function expectAuthored(flow: FlowRecord) {
  expect(flow.name).toBe('Save draft')
  expect(flow.method).toBe('GET')
  expect(flow.path).toBe('/v1/Members')
  expect(flow.nodes).toHaveLength(2)
  expect(flow.edges).toHaveLength(1)
  expect(flow.nodes.find((node) => node.type === 'response')?.config).toEqual({
    status: 200,
    body: { message: 'Publish' },
  })
}

type StudioLocaleOptions = {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}

// Each public journey requires its own fresh empty workspace.
// Evidence covers a public draft test and publication metadata, not a live call.
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
    return (await response.json()) as FlowRecord[]
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

export async function studioDraftLocalePreviews(options: StudioLocaleOptions) {
  const { page, apiOrigin, capture } = options
  const {
    firstTask,
    flowActions,
    observeFlow,
    readSaved,
    chooseWithoutActions,
  } = await openEmptyStudio(options)

  try {
    expect(await readSaved()).toEqual([])
    await firstTask
      .getByRole('button', { name: 'Build a blank API', exact: true })
      .click()
    await expect(firstTask).toHaveCount(0)
    await page.locator('#api-name').fill('Save draft')
    await page.locator('#api-path').fill('/v1/Members')
    await page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.flow-card.response') })
      .click()
    await expect(
      page.getByLabel('Node configuration', { exact: true }),
    ).toHaveCount(0)
    await page.getByLabel('Field value 1', { exact: true }).fill('Publish')
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    expect(flowActions).toEqual([])

    for (const [
      language,
      label,
      save,
      test,
      publish,
      unsaved,
      fieldValue,
    ] of controls) {
      const expected = draftGuidance[language]
      await chooseWithoutActions(language, label)
      await expect(page.locator('#api-name')).toHaveValue('Save draft')
      await expect(page.locator('#api-path')).toHaveValue('/v1/Members')
      await expect(page.getByLabel(fieldValue, { exact: true })).toHaveValue(
        'Publish',
      )
      await expect(
        page.getByText(expected.route, { exact: true }),
      ).toBeVisible()
      await expect(page.locator('.endpoint-credential-note')).toHaveText(
        expected.credential,
      )
      await expect(
        page.locator('.test-request .panel-heading span'),
      ).toHaveText(expected.request)
      await expect(page.getByTestId('test-result')).toHaveText(expected.empty)
      await expect(page.locator('.editor-toolbar .muted')).toHaveText(
        expected.counts,
      )
      await expect(page.locator('.draft-state')).toHaveText(unsaved)
      await expect(
        page.getByRole('button', { name: save, exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('button', { name: test, exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByRole('button', { name: publish, exact: true }),
      ).toBeDisabled()
      expect(flowActions).toEqual([])
      await contained(page)
      await capture(
        'Languages',
        `${label} Studio unsaved draft`,
        'Authored name Save draft, route /v1/Members and response Publish stay literal. Full lifecycle guidance translates while testing and publication still require an explicit saved draft.',
      )
      if (language === 'ru') {
        await page.setViewportSize({ width: 390, height: 844 })
        await contained(page)
        await capture(
          'Languages',
          'Phone light Russian Studio unsaved draft',
          'Translated guidance, toolbar and response form remain inside their containers at native 390px. No save, test or publication has occurred.',
        )
        await page.setViewportSize({ width: 1440, height: 1000 })
      }
    }
    expect(await readSaved()).toEqual([])

    await chooseWithoutActions('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Studio unsaved draft',
      'Dark phone controls and full draft/runtime-key explanations remain readable. Authored form values stay unchanged and no API action has occurred.',
    )

    const savedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/flows' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true })
      .click()
    const savedHttp = await savedResponse
    expect(savedHttp.status()).toBe(200)
    const saved = (await savedHttp.json()) as FlowRecord
    expectAuthored(saved)
    expect(saved.revision).toBe(1)
    expect(saved.publishedRevision).toBeNull()
    expect(saved.publishedEndpoint).toBeNull()
    await expect(
      page.getByRole('button', { name: 'ทดสอบโฟลว์', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'เผยแพร่', exact: true }),
    ).toBeEnabled()
    expect(flowActions).toEqual(['POST /api/flows'])
    const [persisted] = await readSaved()
    expectAuthored(persisted!)
    expect(persisted!.id).toBe(saved.id)

    for (const [language, label, , test, publish] of controls) {
      await chooseWithoutActions(language, label)
      await expect(page.locator('.draft-state')).toHaveText(
        draftGuidance[language].saved,
      )
      await expect(page.locator('#api-name')).toHaveValue('Save draft')
      await expect(page.locator('#api-path')).toHaveValue('/v1/Members')
      await expect(
        page.getByRole('button', { name: test, exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('button', { name: publish, exact: true }),
      ).toBeEnabled()
    }
    await chooseWithoutActions('th', 'ไทย')
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Studio saved explicitly',
      'Only explicit Save creates the real authored definition. Saved revision guidance translates across all seven languages without another write.',
    )

    const testedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/flows/${saved.id}/test` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'ทดสอบโฟลว์', exact: true }).click()
    const testedHttp = await testedResponse
    expect(testedHttp.status()).toBe(200)
    expect(await testedHttp.json()).toMatchObject({
      status: 200,
      body: { message: 'Publish' },
    })
    await expect(page.getByTestId('test-result')).toContainText(
      '"message": "Publish"',
    )
    await expect(page.getByTestId('test-result')).toContainText('"status": 200')
    expect(flowActions).toEqual([
      'POST /api/flows',
      `POST /api/flows/${saved.id}/test`,
    ])
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Studio tested explicitly',
      'Only explicit Test executes the saved draft. The actual public test response retains the authored word Publish; result JSON is never translated.',
    )

    const publishedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/flows/${saved.id}/publish` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'เผยแพร่', exact: true }).click()
    const publishedHttp = await publishedResponse
    expect(publishedHttp.status()).toBe(200)
    const published = (await publishedHttp.json()) as FlowRecord
    expectAuthored(published)
    expect(published.publishedRevision).toBe(1)
    expect(published.publishedEndpoint).toEqual({
      method: 'GET',
      path: '/v1/Members',
      graphql: false,
      transport: 'rest',
    })
    await expect(page.locator('#studio-endpoint-url')).toHaveValue(
      `${apiOrigin}/run/v1/Members`,
    )
    for (const [language, label] of controls) {
      await chooseWithoutActions(language, label)
      await expect(
        page.locator('.page-title h1 [data-slot="badge"]'),
      ).toHaveText(draftGuidance[language].live)
      await expect(page.locator('.draft-state')).toHaveText(
        draftGuidance[language].saved,
      )
      await expect(page.getByTestId('test-result')).toContainText(
        '"message": "Publish"',
      )
      await expect(page.locator('#api-name')).toHaveValue('Save draft')
      await expect(page.locator('#studio-endpoint-url')).toHaveValue(
        `${apiOrigin}/run/v1/Members`,
      )
    }
    await chooseWithoutActions('th', 'ไทย')
    expect(flowActions).toEqual([
      'POST /api/flows',
      `POST /api/flows/${saved.id}/test`,
      `POST /api/flows/${saved.id}/publish`,
    ])
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Studio published explicitly',
      'Explicit Publish records the unchanged GET route. The live badge translates in all seven languages; authored response, saved definition and published URL stay unchanged.',
    )

    await page.locator('#api-name').fill('Save draft unsaved')
    await expect(
      page.getByRole('button', { name: 'เผยแพร่', exact: true }),
    ).toBeDisabled()
    const actionsBeforeDiscard = [...flowActions]
    const dialogPromise = page.waitForEvent('dialog')
    const openReview = page
      .getByRole('button', { name: 'API ใหม่', exact: true })
      .click()
    const dialog = await dialogPromise
    try {
      expect(dialog.message()).toBe(provisionalThaiDiscard)
    } finally {
      await dialog.dismiss()
      await openReview
    }
    await expect(page.locator('#api-name')).toHaveValue('Save draft unsaved')
    await expect(page.locator('.draft-state')).toHaveText(
      'การเปลี่ยนแปลงที่ยังไม่บันทึก',
    )
    await expect(page.locator('#studio-endpoint-url')).toHaveValue(
      `${apiOrigin}/run/v1/Members`,
    )
    expect(flowActions).toEqual(actionsBeforeDiscard)
    const [unchanged] = await readSaved()
    expectAuthored(unchanged!)
    expect(unchanged!.revision).toBe(1)
    expect(unchanged!.publishedRevision).toBe(1)
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai Studio discard canceled',
      'Canceling the translated discard keeps the unsaved authored edit. Real saved definition and publication metadata retain revision one, with no extra save, test or publication.',
    )
  } finally {
    page.off('request', observeFlow)
  }
}
