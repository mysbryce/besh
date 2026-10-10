import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

// Advanced WebSocket editors remain literal in this journey.
const expectedMessages = {
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.',
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

const guidance: Record<Language, { websocket: string }> = {
  en: {
    websocket:
      expectedMessages[
        'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.'
      ],
  },
  th: {
    websocket:
      'ใช้เส้นทางที่ตรงตามที่ระบุ เช่น /v1/messages ข้อความ WebSocket ใช้ส่งค่าข้อมูลเข้า ไม่รองรับพารามิเตอร์เส้นทางที่มีชื่อ',
  },
  zh: {
    websocket:
      '使用精确路径，例如 /v1/messages。WebSocket 消息用于传递输入值；不支持具名路径参数。',
  },
  ru: {
    websocket:
      'Используйте точный путь, например /v1/messages. Сообщения WebSocket передают входные значения; именованные параметры пути не поддерживаются.',
  },
  ja: {
    websocket:
      '/v1/messages などの完全なパスを指定してください。入力値は WebSocket メッセージで渡します。名前付きパスパラメーターは使えません。',
  },
  ko: {
    websocket:
      '/v1/messages와 같은 정확한 경로를 사용하세요. 입력 값은 WebSocket 메시지로 전달하며 이름이 있는 경로 매개변수는 지원하지 않습니다.',
  },
  pt: {
    websocket:
      'Use um caminho exato, como /v1/messages. As mensagens WebSocket transportam os valores de entrada; parâmetros de caminho nomeados não são suportados.',
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
        '.endpoint-bar > *, .endpoint-bar input, .rule-field input, .rule-field button[role="combobox"]',
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

// Public native WebSocket draft echo only. No subscriptions, exports or load test.
export async function studioWebsocketLocalePreviews(options: Options) {
  const { page, capture } = options
  const { actions, observe, choose, readSaved } = await freshStudio(options)
  const name = 'GRAPHQL OPERATION'
  const path = '/v1/MembersMessages'
  const rules = page.getByRole('region', {
    name: 'WebSocket message rules',
    exact: true,
  })
  const draft = page.getByRole('region', {
    name: 'WebSocket draft test',
    exact: true,
  })
  try {
    await page.locator('#api-name').fill(name)
    await page.locator('#api-path').fill(`${path}/:id`)
    await chooseProtocol(page, 'WebSocket')
    await expect(page.locator('#api-type')).toHaveText('REST')
    await expect(page.locator('#api-path')).toHaveValue(`${path}/:id`)
    await expect(page.getByRole('status')).toContainText(
      'WebSocket needs an exact endpoint path. Remove named segments such as :id before switching.',
    )
    expect(actions).toEqual([])

    await page.locator('#api-path').fill(path)
    await chooseProtocol(page, 'WebSocket')
    await expect(rules).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'Change API transport', exact: true }),
    ).toHaveCount(0)
    await rules
      .getByLabel('Received field name 1', { exact: true })
      .fill('Publish')
    await rules
      .getByLabel('Reply field name 1', { exact: true })
      .fill('Publish')
    await rules
      .getByRole('button', { name: 'Add browser origin', exact: true })
      .click()
    await rules
      .getByLabel('Browser origin 1', { exact: true })
      .fill('https://client.example')
    await expect(
      draft.getByRole('button', { name: 'Connect draft', exact: true }),
    ).toBeDisabled()
    await expect(
      draft.getByRole('button', { name: 'Send message', exact: true }),
    ).toBeDisabled()

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(
        page.getByText(guidance[language].websocket, { exact: true }),
      ).toBeVisible()
      await expect(page.locator('#api-name')).toHaveValue(name)
      await expect(page.locator('#api-path')).toHaveValue(path)
      await expect(
        rules.getByLabel('Received field name 1', { exact: true }),
      ).toHaveValue('Publish')
      await expect(
        rules.getByLabel('Reply field name 1', { exact: true }),
      ).toHaveValue('Publish')
      await expect(
        rules.getByLabel('Browser origin 1', { exact: true }),
      ).toHaveValue('https://client.example')
      await expect(
        draft.getByRole('button', { name: 'Connect draft', exact: true }),
      ).toBeDisabled()
      await contained(page)
      expect(actions).toEqual([])
      await capture(
        'Languages',
        `${label} Studio WebSocket guidance`,
        'Exact-path guidance translates. Authored received/reply field and approved origin remain literal. No connection ticket, socket or message is requested by language selection.',
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
    const object = {
      type: 'object',
      properties: { Publish: { type: 'string' } },
      required: ['Publish'],
      additionalProperties: false,
    }
    const websocket = {
      input: object,
      output: object,
      allowedOrigins: ['https://client.example'],
    }
    expect(saved).toMatchObject({
      name,
      path,
      method: 'GET',
      revision: 1,
      publishedRevision: null,
      websocket,
    })
    expect(saved.graphql).toBeUndefined()
    expect(saved.contract).toBeUndefined()
    expect(
      saved.nodes.find((node) => node.type === 'response')?.config,
    ).toEqual({
      status: 200,
      body: '$input.body',
    })
    await expect(
      draft.getByRole('button', { name: 'Connect draft', exact: true }),
    ).toBeEnabled()

    const ticketResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/flows/${saved.id}/ws/test-ticket` &&
        response.request().method() === 'POST',
    )
    const socketEvent = page.waitForEvent('websocket')
    await draft
      .getByRole('button', { name: 'Connect draft', exact: true })
      .click()
    const ticketHttp = await ticketResponse
    expect(ticketHttp.status()).toBe(200)
    expect(ticketHttp.request().postDataJSON()).toEqual({ revision: 1 })
    // Do not parse, assert, print or capture the credential-bearing receipt.
    const socket = await socketEvent
    const socketUrl = new URL(socket.url())
    expect(socketUrl.pathname).toBe(`/api/flows/${saved.id}/ws/test`)
    expect(socketUrl.search).toBe('')
    await expect(draft).toContainText('Connected')
    await draft
      .getByLabel('Message field: Publish', { exact: true })
      .fill('GRAPHQL OPERATION')
    const sentEvent = socket.waitForEvent('framesent')
    const replyEvent = socket.waitForEvent('framereceived')
    await draft
      .getByRole('button', { name: 'Send message', exact: true })
      .click()
    const sent = JSON.parse(String((await sentEvent).payload))
    const reply = JSON.parse(String((await replyEvent).payload))
    expect(sent.body).toEqual({ Publish: 'GRAPHQL OPERATION' })
    expect(reply).toEqual({
      id: sent.id,
      result: { Publish: 'GRAPHQL OPERATION' },
    })
    await expect(
      draft.getByLabel('WebSocket reply fields', { exact: true }),
    ).toContainText('GRAPHQL OPERATION')
    let frames = 0
    const countFrame = () => {
      frames++
    }
    socket.on('framesent', countFrame)
    try {
      for (const [language, label] of choices) {
        await choose(language, label)
        await expect(draft).toContainText('Reply received')
        await expect(
          draft.getByRole('button', { name: 'Disconnect draft', exact: true }),
        ).toBeEnabled()
        await expect(
          draft.getByRole('button', { name: 'Connect draft', exact: true }),
        ).toBeDisabled()
        await expect(
          draft.getByLabel('Message field: Publish', { exact: true }),
        ).toHaveValue('GRAPHQL OPERATION')
        await expect(
          draft.getByLabel('WebSocket reply fields', { exact: true }),
        ).toContainText('GRAPHQL OPERATION')
        expect(frames).toBe(0)
      }
      expect(actions).toEqual([
        'POST /api/flows',
        `POST /api/flows/${saved.id}/ws/test-ticket`,
      ])
      expect(await readSaved(saved.id)).toMatchObject({
        name,
        path,
        revision: 1,
        publishedRevision: null,
        websocket,
      })
      await choose('th', 'ไทย')
      await thaiPhone(page)
      await capture(
        'Languages',
        'Phone dark Thai Studio WebSocket draft reply',
        'Explicit Connect and Send produce one actual native draft reply. Authored value stays literal across languages; no locale-triggered tickets or frames. No published call, subscription, client export or k6 claim.',
      )
      await draft
        .getByRole('button', { name: 'Disconnect draft', exact: true })
        .click()
      await expect(draft).toContainText('Disconnected')
      await choose('en', 'English')
      const beforeCancel = [...actions]
      await chooseProtocol(page, 'GraphQL')
      const review = page.getByRole('dialog', {
        name: 'Change API transport',
        exact: true,
      })
      await expect(review).toBeVisible()
      await review
        .getByRole('button', { name: 'Cancel transport change', exact: true })
        .click()
      await expect(review).not.toBeVisible()
      await expect(page.locator('#api-type')).toHaveText('WebSocket')
      await expect(
        rules.getByLabel('Received field name 1', { exact: true }),
      ).toHaveValue('Publish')
      await expect(
        rules.getByLabel('Reply field name 1', { exact: true }),
      ).toHaveValue('Publish')
      expect(actions).toEqual(beforeCancel)
    } finally {
      socket.off('framesent', countFrame)
    }
  } finally {
    page.off('request', observe)
  }
}
