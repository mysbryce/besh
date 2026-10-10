import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const choices = [
  [
    'th',
    'ไทย',
    'สร้าง API',
    'ชนิด API',
    'เส้นทางปลายทาง',
    'กรองด้วยข้อมูลนำเข้า',
    'สร้าง API จากข้อมูล',
  ],
  [
    'en',
    'English',
    'Create an API',
    'API type',
    'Endpoint path',
    'Filter by input',
    'Create API from data',
  ],
  [
    'zh',
    '中文',
    '创建 API',
    'API 类型',
    '端点路径',
    '按输入筛选',
    '从数据创建 API',
  ],
  [
    'ru',
    'Русский',
    'Создать API',
    'Тип API',
    'Путь эндпоинта',
    'Фильтровать по входным данным',
    'Создать API из данных',
  ],
  [
    'ja',
    '日本語',
    'API を作成',
    'API の種類',
    'エンドポイントのパス',
    '入力値で絞り込む',
    'データから API を作成',
  ],
  [
    'ko',
    '한국어',
    'API 만들기',
    'API 유형',
    '엔드포인트 경로',
    '입력값으로 필터링',
    '데이터로 API 만들기',
  ],
  [
    'pt',
    'Português',
    'Criar uma API',
    'Tipo de API',
    'Caminho do endpoint',
    'Filtrar por entrada',
    'Criar API a partir dos dados',
  ],
] as const

type Flow = {
  id: string
  name: string
  path: string
  method: string
  revision: number
  publishedRevision: number | null
  graphql?: { schema: string }
  contract?: unknown
  nodes: { type: string; config: unknown }[]
}

const csv =
  'API name,Count,Active,Private\nPublish,12,true,hidden\nSave draft,15,false,secret\n'
const rows = [
  { api_name: 'Publish', count: 12, active: true },
  { api_name: 'Save draft', count: 15, active: false },
]
const selectedColumns = ['api_name', 'count', 'active']
const schema =
  'type Query { rows(amount: Float): [SpreadsheetRow!]! }\ntype SpreadsheetRow { api_name: String! count: Float! active: Boolean! }'

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)

  expect(
    await page
      .locator(
        '.data-mapping, .data-mapping label, .data-mapping input, .data-mapping button, .source-field-mapping',
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

export async function dataApiLocalePreviews({
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
        name: 'Save draft',
        file: {
          name: 'authored.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csv),
        },
      },
    },
  )
  expect(imported.status()).toBe(200)

  const source = (await imported.json()) as { id: string }
  const originalResponse = await page.request.post(`${apiOrigin}/api/flows`, {
    headers,
    data: {
      name: 'Original draft',
      method: 'GET',
      path: '/untranslated-draft',
      nodes: [
        {
          id: 'request',
          type: 'request',
          position: { x: 80, y: 100 },
          config: {},
        },
        {
          id: 'response',
          type: 'response',
          position: { x: 360, y: 100 },
          config: { status: 200, body: { message: 'Publish' } },
        },
      ],
      edges: [{ id: 'reply', source: 'request', target: 'response' }],
    },
  })
  expect(originalResponse.status()).toBe(200)

  const original = (await originalResponse.json()) as Flow
  const generationUrl = `${apiOrigin}/api/data-sources/${source.id}/api`
  const options = {
    name: 'Create API from data',
    path: '/v1/Save-draft',
    protocol: 'rest',
    columns: selectedColumns,
    limit: 50,
    filter: { column: 'count', inputName: 'amount' },
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
  await expect(page.locator('#api-name')).toHaveValue('Original draft')
  await page.locator('#api-name').fill('Unsaved literal')
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()

  const form = page.locator('.data-mapping')
  const requests: string[] = []
  const actions: string[] = []
  const observe = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/(data-sources|flows)(\/|$)/.test(path)) return

    const action = `${request.method()} ${path}`
    requests.push(action)
    if (request.method() !== 'GET') actions.push(action)
  }
  page.on('request', observe)

  async function choose(language: string, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function authored(protocol: 'rest' | 'graphql') {
    await expect(page.locator('#data-api-name')).toHaveValue(
      'Create API from data',
    )
    await expect(page.locator('#data-api-path')).toHaveValue('/v1/Save-draft')
    await expect(page.locator('#data-api-type')).toHaveText(
      protocol === 'rest' ? 'REST' : 'GraphQL',
    )
    await expect(page.locator('#data-api-limit')).toHaveAttribute(
      'data-state',
      'closed',
    )
    await expect(page.locator('#data-filter-column')).toHaveText('Count')
    await expect(page.locator('#data-filter-input')).toHaveValue('amount')
    await expect(form.locator('.source-column-choice strong')).toHaveText([
      'API name',
      'Count',
      'Active',
      'Private',
    ])
    await expect(form.locator('.source-field-mapping code')).toHaveText([
      'api_name',
      'count',
      'active',
      'private',
    ])
    const boxes = form.locator('.source-column-choice').getByRole('checkbox')
    for (let index = 0; index < 3; index++)
      await expect(boxes.nth(index)).toBeChecked()
    await expect(boxes.nth(3)).not.toBeChecked()
  }

  async function appearance(mode: 'light' | 'dark') {
    await page.locator('#appearance').click()
    await page
      .getByRole('option', {
        name: mode === 'light' ? 'สว่าง' : 'มืด',
        exact: true,
      })
      .click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
  }

  try {
    await page.locator('#data-api-name').fill(options.name)
    await page.locator('#data-api-path').fill(options.path)
    await form
      .getByRole('checkbox', { name: 'Return Private', exact: true })
      .uncheck()
    await page.locator('#data-api-limit').click()
    await page
      .getByRole('option', { name: 'Up to 50 rows', exact: true })
      .click()
    await form
      .getByRole('checkbox', { name: 'Filter by input', exact: true })
      .check()
    await page.locator('#data-filter-column').click()
    await page.getByRole('option', { name: 'Count', exact: true }).click()
    await page.locator('#data-filter-input').fill('amount')

    for (const protocol of ['rest', 'graphql'] as const) {
      for (const [
        language,
        label,
        heading,
        type,
        path,
        filter,
        action,
      ] of choices) {
        await choose(language, label)
        await page.locator('#data-api-type').click()
        await page
          .getByRole('option', {
            name: protocol === 'rest' ? 'REST' : 'GraphQL',
            exact: true,
          })
          .click()
        await expect(
          form.getByRole('heading', { name: heading, exact: true }),
        ).toBeVisible()
        await expect(page.locator('#data-api-type')).toHaveAccessibleName(type)
        await expect(page.locator('#data-api-path')).toHaveAccessibleName(path)
        await expect(
          form.getByRole('checkbox', { name: filter, exact: true }),
        ).toBeChecked()
        await expect(
          form.getByRole('button', { name: action, exact: true }),
        ).toBeEnabled()
        await expect(page.locator('#data-path-help')).toContainText(
          `${protocol === 'rest' ? 'GET /run' : 'POST /graphql'}/v1/Save-draft`,
        )
        await expect(page.locator('#data-filter-help')).toContainText(
          protocol === 'rest' ? '?amount=value' : 'amount',
        )
        await expect(page.locator('#data-api-limit')).toContainText('50')
        await authored(protocol)
        await contained(page)
        expect(actions).toEqual([])
        await capture(
          'Languages',
          `${label} spreadsheet ${protocol.toUpperCase()} draft review`,
          'Trusted guidance follows language. Authored names, paths, original headings, mapped keys, selected fields, typed filter and 50-row limit remain unchanged. Language and protocol choices create no saved draft or publication.',
        )
      }
    }

    await choose('th', 'ไทย')
    await page.locator('#data-api-type').click()
    await page.getByRole('option', { name: 'REST', exact: true }).click()
    await page.locator('#data-api-path').fill('invalid')
    await page.locator('#data-filter-input').fill('Invalid name')
    for (let index = 0; index < 3; index++)
      await form
        .locator('.source-column-choice')
        .getByRole('checkbox')
        .nth(index)
        .uncheck()
    await expect(page.locator('#data-path-help')).toHaveText(
      'เริ่มด้วย / และใช้ตัวอักษร ตัวเลข / ขีดกลาง หรือขีดล่าง',
    )
    await expect(page.locator('#data-filter-help')).toHaveText(
      'เริ่มด้วยตัวอักษรภาษาอังกฤษพิมพ์เล็ก ใช้ตัวอักษร ตัวเลข หรือขีดล่าง',
    )
    await expect(
      form.getByText('เลือกอย่างน้อยหนึ่งฟิลด์เพื่อดำเนินการต่อ', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      form.getByRole('button', { name: 'สร้าง API จากข้อมูล', exact: true }),
    ).toBeDisabled()
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai invalid API generation',
      'Complete invalid-path, input-name and minimum-field guidance remains visible at 390px. Invalid form cannot create a draft.',
    )
    await appearance('dark')
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai invalid API generation',
      'The same complete generation warnings and controls stay readable in dark appearance without changing API values.',
    )
    await appearance('light')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.locator('#data-api-path').fill(options.path)
    await page.locator('#data-filter-input').fill('amount')
    for (let index = 0; index < 3; index++)
      await form
        .locator('.source-column-choice')
        .getByRole('checkbox')
        .nth(index)
        .check()

    async function confirm(accept: boolean) {
      const ready = page.waitForEvent('dialog')
      const clicked = form
        .getByRole('button', { name: 'สร้าง API จากข้อมูล', exact: true })
        .click()
      const dialog = await ready
      const text = dialog.message()

      if (accept) await dialog.accept()
      else await dialog.dismiss()
      await clicked
      expect(text).toBe(
        'ละทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่ได้บันทึก แล้วสร้าง API นี้หรือไม่?',
      )
    }

    await confirm(false)
    expect(actions).toEqual([])
    const unchanged = await page.request.get(
      `${apiOrigin}/api/flows/${original.id}`,
      { headers },
    )
    expect(await unchanged.json()).toEqual(original)
    await page.getByRole('button', { name: 'สตูดิโอ API', exact: true }).click()
    await expect(page.locator('#api-name')).toHaveValue('Unsaved literal')
    await page.getByRole('button', { name: 'แหล่งข้อมูล', exact: true }).click()
    // Navigation remounts the form. Reapply the reviewed authored options.
    await page.locator('#data-api-name').fill(options.name)
    await page.locator('#data-api-path').fill(options.path)
    await form
      .locator('.source-column-choice')
      .getByRole('checkbox')
      .nth(3)
      .uncheck()
    await page.locator('#data-api-limit').click()
    await page
      .getByRole('option', { name: 'สูงสุด 50 แถว', exact: true })
      .click()
    await form
      .getByRole('checkbox', { name: 'กรองด้วยข้อมูลนำเข้า', exact: true })
      .check()
    await page.locator('#data-filter-column').click()
    await page.getByRole('option', { name: 'Count', exact: true }).click()
    await page.locator('#data-filter-input').fill('amount')
    await capture(
      'Languages',
      'Thai generation discard canceled',
      'Cancel sends no create request and leaves the unsaved Studio draft and saved original unchanged. Authored generation options are explicitly reviewed again after navigation.',
    )

    let releaseHeld!: () => void
    const release = new Promise<void>((done) => {
      releaseHeld = done
    })
    let held!: () => void
    const heldReady = new Promise<void>((done) => {
      held = done
    })
    let finished!: () => void
    const routeDone = new Promise<void>((done) => {
      finished = done
    })
    let created!: Flow
    let submitted: unknown
    let started = false
    let handlerError: unknown
    const handler = async (route: import('@playwright/test').Route) => {
      started = true

      try {
        submitted = route.request().postDataJSON()
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        created = (await response.json()) as Flow
        held()
        await release
        await route.fulfill({ response })
      } catch (error) {
        handlerError = error
        held()
      } finally {
        finished()
      }
    }
    await page.route(generationUrl, handler)

    try {
      await confirm(true)
      await heldReady
      if (handlerError) throw handlerError

      expect(submitted).toEqual(options)
      await choose('ru', 'Русский')
      await expect(
        form.getByRole('button', {
          name: 'Создать API из данных',
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#data-api-name')).toBeDisabled()
      await expect(page.locator('#data-api-type')).toBeDisabled()
      await expect(form.getByRole('checkbox').first()).toBeDisabled()
      await authored('rest')
      await capture(
        'Languages',
        'Russian API creation response pending',
        'The real server has created one draft while its HTTP delivery is held. Current-language form is disabled; changing language does not submit another request.',
      )
    } finally {
      releaseHeld()
      if (started) await routeDone
      await page.unroute(generationUrl, handler)
    }

    if (handlerError) throw handlerError

    await expect(page.locator('#api-name')).toHaveValue(options.name)
    await expect(page.getByRole('status')).toContainText(
      'Черновик API создан. Проверьте данные, затем опубликуйте его.',
    )
    expect(created).toMatchObject({
      name: options.name,
      path: options.path,
      method: 'GET',
      revision: 1,
      publishedRevision: null,
    })
    expect(created.nodes.find((node) => node.type === 'data')?.config).toEqual({
      sourceId: source.id,
      columns: selectedColumns,
      limit: 50,
      filter: { column: 'count', value: '$input.query.amount' },
    })
    expect(created.contract).toEqual({
      query: { type: 'object', properties: { amount: { type: 'number' } } },
      response: {
        type: 'array',
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            api_name: { type: 'string', nullable: false },
            count: { type: 'number', nullable: false },
            active: { type: 'boolean', nullable: false },
          },
          required: selectedColumns,
          additionalProperties: false,
        },
      },
    })
    const tested = await page.request.post(
      `${apiOrigin}/api/flows/${created.id}/test`,
      { headers, data: { body: null, query: { amount: '12' } } },
    )
    expect(tested.status()).toBe(200)
    expect(await tested.json()).toMatchObject({ body: [rows[0]] })
    await capture(
      'Languages',
      'Russian generated REST draft',
      'Explicit creation opens an unpublished revision-one graph with the exact authored REST contract. A real draft HTTP test returns only the matching typed row; the excluded private column stays absent.',
    )

    await choose('en', 'English')
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await page.locator('#data-api-name').fill('GraphQL literal')
    await page.locator('#data-api-path').fill('/v1/GraphQL-literal')
    await form
      .getByRole('checkbox', { name: 'Return Private', exact: true })
      .uncheck()
    await page.locator('#data-api-type').click()
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await page.locator('#data-api-limit').click()
    await page
      .getByRole('option', { name: 'Up to 50 rows', exact: true })
      .click()
    await form
      .getByRole('checkbox', { name: 'Filter by input', exact: true })
      .check()
    await page.locator('#data-filter-column').click()
    await page.getByRole('option', { name: 'Count', exact: true }).click()
    await page.locator('#data-filter-input').fill('amount')
    const generated = page.waitForResponse(
      (response) =>
        response.url() === generationUrl &&
        response.request().method() === 'POST',
    )
    await form
      .getByRole('button', { name: 'Create API from data', exact: true })
      .click()
    const graphqlResponse = await generated
    expect(graphqlResponse.status()).toBe(200)
    const graphql = (await graphqlResponse.json()) as Flow
    expect(graphql).toMatchObject({
      name: 'GraphQL literal',
      path: '/v1/GraphQL-literal',
      method: 'POST',
      revision: 1,
      publishedRevision: null,
      graphql: { schema },
    })
    expect(graphql.contract).toBeUndefined()
    const graphqlTest = await page.request.post(
      `${apiOrigin}/api/flows/${graphql.id}/graphql/test`,
      {
        headers,
        data: {
          query:
            'query Match($amount: Float) { rows(amount: $amount) { api_name count active } }',
          variables: { amount: 15 },
        },
      },
    )
    expect(graphqlTest.status()).toBe(200)
    expect(await graphqlTest.json()).toMatchObject({
      status: 200,
      body: { data: { rows: [rows[1]] } },
    })
    const badGraphql = await page.request.post(
      `${apiOrigin}/api/flows/${graphql.id}/graphql/test`,
      {
        headers,
        data: {
          query:
            'query Match($amount: Float) { rows(amount: $amount) { count } }',
          variables: { amount: 'wrong' },
        },
      },
    )
    expect((await badGraphql.json()).body.errors).toHaveLength(1)
    await expect(page.locator('#api-name')).toHaveValue('GraphQL literal')
    await capture(
      'Languages',
      'English generated GraphQL draft',
      'Explicit second creation preserves the exact typed SDL and mapped fields. Real GraphQL variables and field selection return the matching row; invalid scalar input is rejected. Both generated APIs remain unpublished.',
    )

    const listed = await page.request.get(`${apiOrigin}/api/flows`, { headers })
    expect(
      (await listed.json()).map((flow: Flow) => ({
        name: flow.name,
        publishedRevision: flow.publishedRevision,
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: 'Original draft', publishedRevision: null },
        { name: options.name, publishedRevision: null },
        { name: 'GraphQL literal', publishedRevision: null },
      ]),
    )
    expect(actions.filter((action) => action.startsWith('POST '))).toEqual([
      `POST /api/data-sources/${source.id}/api`,
      `POST /api/data-sources/${source.id}/api`,
    ])

    const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
      headers,
      data: {
        name: 'Generation reader',
        permissions: ['flows.read', 'sources.read'],
      },
    })
    expect(roleResponse.status()).toBe(200)
    const role = (await roleResponse.json()) as { id: string }
    const memberResponse = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name: 'Generation reader', role: 'custom', roleId: role.id },
    })
    expect(memberResponse.status()).toBe(200)
    const reader = (await memberResponse.json()) as { token: string }
    const viewerResponse = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: {
        name: 'Selected generation viewer',
        role: 'viewer',
        access: {
          mode: 'selected',
          flowIds: [created.id],
          dependencyUse: {
            sources: [],
            databaseConnections: [],
            authConnections: [],
          },
        },
      },
    })
    expect(viewerResponse.status()).toBe(200)
    const viewer = (await viewerResponse.json()) as { token: string }

    for (const [token, selected] of [
      [reader.token, false],
      [viewer.token, true],
    ] as const) {
      await page.context().clearCookies()
      await page.goto(apiOrigin)
      await chooseManagementLanguage(page, 'English')
      await page.getByLabel('Workspace token', { exact: true }).fill(token)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await expect(page.locator('#api-name')).toBeVisible()

      if (selected)
        await expect(
          page.getByRole('button', { name: 'Data sources', exact: true }),
        ).toHaveCount(0)
      else {
        await page
          .getByRole('button', { name: 'Data sources', exact: true })
          .click()
        await expect(
          form.getByRole('heading', { name: 'Create an API', exact: true }),
        ).toBeVisible()
        await choose('th', 'ไทย')
        await expect(
          form.getByRole('button', {
            name: 'สร้าง API จากข้อมูล',
            exact: true,
          }),
        ).toBeDisabled()
        await expect(page.locator('#data-api-name')).toBeDisabled()
      }
      const denied = await page.request.post(generationUrl, {
        headers: { authorization: `Bearer ${token}` },
        data: options,
      })
      expect(denied.status()).toBe(403)
      if (selected) {
        const catalog = await page.request.get(
          `${apiOrigin}/api/data-sources`,
          { headers: { authorization: `Bearer ${token}` } },
        )
        expect(catalog.status()).toBe(403)
      }
      await capture(
        'Languages',
        selected
          ? 'Selected viewer cannot generate from private source'
          : 'Thai read-only source cannot generate an API',
        'Language does not grant source administration or API creation. Actual HTTP creation is denied; selected viewers cannot access the raw source catalog.',
      )
    }
  } finally {
    page.off('request', observe)
  }
}
