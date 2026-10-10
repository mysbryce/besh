import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

// Advanced schema and operation editors remain literal in this journey.
const expectedMessages = {
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.',
  'GRAPHQL OPERATION': 'GRAPHQL OPERATION',
}

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

const guidance: Record<Language, { graphql: string; heading: string }> = {
  en: {
    graphql:
      expectedMessages[
        'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.'
      ],
    heading: 'GRAPHQL OPERATION',
  },
  th: {
    graphql:
      'ใช้เส้นทางที่ตรงตามที่ระบุ เช่น /v1/customers อาร์กิวเมนต์ GraphQL ใช้ส่งค่าข้อมูลเข้า',
    heading: 'การดำเนินการ GRAPHQL',
  },
  zh: {
    graphql: '使用精确路径，例如 /v1/customers。GraphQL 参数用于传递输入值。',
    heading: 'GRAPHQL 操作',
  },
  ru: {
    graphql:
      'Используйте точный путь, например /v1/customers. Аргументы GraphQL передают входные значения.',
    heading: 'ОПЕРАЦИЯ GRAPHQL',
  },
  ja: {
    graphql:
      '/v1/customers などの完全なパスを指定してください。入力値は GraphQL の引数で渡します。',
    heading: 'GRAPHQL オペレーション',
  },
  ko: {
    graphql:
      '/v1/customers와 같은 정확한 경로를 사용하세요. 입력 값은 GraphQL 인수로 전달합니다.',
    heading: 'GRAPHQL 작업',
  },
  pt: {
    graphql:
      'Use um caminho exato, como /v1/customers. Os argumentos GraphQL transportam os valores de entrada.',
    heading: 'OPERAÇÃO GRAPHQL',
  },
}

type Options = {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}

type SavedProtocolFlow = {
  id: string
  name: string
  method: string
  path: string
  revision: number
  publishedRevision: number | null
  graphql?: { schema: string }
  websocket?: unknown
  contract?: unknown
  nodes: { type: string; config: unknown }[]
}

async function freshStudio({ page, owner, apiOrigin }: Options) {
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
  const first = page.locator('section[aria-label].load-test-card')
  await expect(first).toBeVisible()
  const saved = await page.request.get(`${apiOrigin}/api/flows`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toEqual([])
  await first
    .getByRole('button', { name: 'Build a blank API', exact: true })
    .click()
  await expect(first).toHaveCount(0)

  const requests: string[] = []
  const actions: string[] = []
  const observe = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/flows(\/|$)/.test(path)) return
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

  async function readSaved(id: string) {
    const response = await page.request.get(`${apiOrigin}/api/flows/${id}`, {
      headers: { authorization: `Bearer ${owner}` },
    })
    expect(response.status()).toBe(200)
    return (await response.json()) as SavedProtocolFlow
  }

  return { actions, observe, choose, readSaved }
}

async function chooseProtocol(page: Page, name: 'GraphQL' | 'WebSocket') {
  await page.locator('#api-type').click()
  await page.getByRole('option', { name, exact: true }).click()
}

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  expect(
    await page
      .locator(
        '.endpoint-bar > *, .endpoint-bar input, .graphql-inputs textarea, .graphql-schema textarea, .rule-field input, .rule-field button[role="combobox"], .test-panel > *, .test-request .panel-heading > *',
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

async function thaiPhone(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'มืด', exact: true }).click()
  await contained(page)
}

// Public GraphQL draft proof only. No publication or runtime-key issuance.
export async function studioGraphqlLocalePreviews(options: Options) {
  const { page, capture } = options
  const { actions, observe, choose, readSaved } = await freshStudio(options)
  const name = 'GRAPHQL OPERATION'
  const path = '/v1/MembersGraphQL'
  const schema =
    'type Query { Publish: Greeting! } type Greeting { message: String! }'
  const operation = 'query SaveDraft { Publish { message } }'
  try {
    await page.locator('#api-name').fill(name)
    await page.locator('#api-path').fill(`${path}/:id`)
    await chooseProtocol(page, 'GraphQL')
    await expect(page.locator('#api-type')).toHaveText('REST')
    await expect(page.locator('#api-path')).toHaveValue(`${path}/:id`)
    await expect(page.getByRole('status')).toContainText(
      'GraphQL needs an exact endpoint path. Remove named segments such as :id before switching; GraphQL arguments carry those values.',
    )
    expect(actions).toEqual([])

    await page.locator('#api-path').fill(path)
    await chooseProtocol(page, 'GraphQL')
    await expect(page.locator('#api-type')).toHaveText('GraphQL')
    await expect(page.locator('#api-method')).toBeDisabled()
    await expect(page.locator('#api-method')).toHaveText('POST')
    await page
      .getByRole('button', { name: 'Advanced schema', exact: true })
      .click()
    await page.getByLabel('GraphQL schema', { exact: true }).fill(schema)
    await page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.flow-card.response') })
      .click()
    await page
      .getByLabel('Field value 1', { exact: true })
      .fill('GRAPHQL OPERATION')
    await page
      .getByRole('button', { name: 'Apply configuration', exact: true })
      .click()
    await page.getByLabel('GraphQL operation', { exact: true }).fill(operation)
    await expect(
      page.getByRole('button', { name: 'Test flow', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeDisabled()

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        page.getByText(guidance[language].graphql, { exact: true }),
      ).toBeVisible()
      await expect(
        page.locator('.test-request .panel-heading span'),
      ).toHaveText(guidance[language].heading)
      await expect(page.locator('#api-name')).toHaveValue(name)
      await expect(page.locator('#api-path')).toHaveValue(path)
      await expect(
        page.getByLabel('GraphQL schema', { exact: true }),
      ).toHaveValue(schema)
      await expect(
        page.getByLabel('GraphQL operation', { exact: true }),
      ).toHaveValue(operation)
      await contained(page)
      expect(actions).toEqual([])
      await capture(
        'Languages',
        `${label} Studio GraphQL guidance`,
        'Only protocol route guidance and operation heading translate. Authored name, exact route, schema and operation remain literal; no draft action occurs on language selection.',
      )
    }

    await choose('en', 'English')
    const savedResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/flows' &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    const savedHttp = await savedResponse
    expect(savedHttp.status()).toBe(200)
    const saved = (await savedHttp.json()) as SavedProtocolFlow
    expect(saved).toMatchObject({
      name,
      path,
      method: 'POST',
      revision: 1,
      publishedRevision: null,
      graphql: { schema },
    })
    expect(saved.websocket).toBeUndefined()
    expect(saved.contract).toBeUndefined()
    expect(
      saved.nodes.find((node) => node.type === 'response')?.config,
    ).toEqual({
      status: 200,
      body: { message: 'GRAPHQL OPERATION' },
    })
    await expect(
      page.getByRole('button', { name: 'Test flow', exact: true }),
    ).toBeEnabled()

    const testResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/flows/${saved.id}/graphql/test` &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Test flow', exact: true }).click()
    const testHttp = await testResponse
    expect(testHttp.status()).toBe(200)
    expect(await testHttp.json()).toMatchObject({
      status: 200,
      body: { data: { Publish: { message: 'GRAPHQL OPERATION' } } },
    })
    await expect(page.getByTestId('test-result')).toContainText(
      '"message": "GRAPHQL OPERATION"',
    )
    expect(actions).toEqual([
      'POST /api/flows',
      `POST /api/flows/${saved.id}/graphql/test`,
    ])
    expect(await readSaved(saved.id)).toMatchObject({
      name,
      path,
      revision: 1,
      publishedRevision: null,
      graphql: { schema },
    })
    const beforeCancel = [...actions]
    await chooseProtocol(page, 'WebSocket')
    const review = page.getByRole('dialog', {
      name: 'Change API transport',
      exact: true,
    })
    await expect(review).toBeVisible()
    await review
      .getByRole('button', { name: 'Cancel transport change', exact: true })
      .click()
    await expect(review).not.toBeVisible()
    await expect(page.locator('#api-type')).toHaveText('GraphQL')
    await expect(
      page.getByLabel('GraphQL schema', { exact: true }),
    ).toHaveValue(schema)
    await expect(
      page.getByLabel('GraphQL operation', { exact: true }),
    ).toHaveValue(operation)
    expect(actions).toEqual(beforeCancel)
    await choose('th', 'ไทย')
    await thaiPhone(page)
    await expect(page.getByTestId('test-result')).toContainText(
      '"message": "GRAPHQL OPERATION"',
    )
    await capture(
      'Languages',
      'Phone dark Thai Studio GraphQL draft tested',
      'Explicit public draft test executes authored GraphQL operation. Raw response stays literal. No published call, runtime credential or contract conversion is claimed.',
    )
  } finally {
    page.off('request', observe)
  }
}
