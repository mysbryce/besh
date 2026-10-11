import { expect, type Locator, type Page, type Request } from '@playwright/test'
import { chooseManagementLanguage } from './management-locale-previews'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import { seedHtmlPreviewWorkspace } from './rich-text-html-seed'
import type { SavedFlow } from '../web/types/api'

export const contentSnapshotPreviewCount = 17

const languages = [
  {
    code: 'en',
    choice: 'English',
    review: 'Private HTML preview',
    create: 'Create Content API',
    name: 'API name',
    path: 'Endpoint path',
    source: 'HTML source',
    help: 'Creates a sealed draft. This does not publish an API.',
  },
  {
    code: 'th',
    choice: 'ไทย',
    review: 'ตัวอย่าง HTML ส่วนตัว',
    create: 'สร้าง API เนื้อหา',
    name: 'ชื่อ API',
    path: 'เส้นทางปลายทาง',
    source: 'โค้ด HTML',
    help: 'สร้างฉบับร่างที่ล็อกเนื้อหาไว้ ยังไม่เผยแพร่ API',
  },
  {
    code: 'zh',
    choice: '中文',
    review: '私有 HTML 预览',
    create: '创建内容 API',
    name: 'API 名称',
    path: '端点路径',
    source: 'HTML 源码',
    help: '创建内容已固定的草稿。这不会发布 API。',
  },
  {
    code: 'ru',
    choice: 'Русский',
    review: 'Приватный предпросмотр HTML',
    create: 'Создать API контента',
    name: 'Название API',
    path: 'Путь эндпоинта',
    source: 'Исходный HTML',
    help: 'Создаёт черновик с зафиксированным содержимым. API не публикуется.',
  },
  {
    code: 'ja',
    choice: '日本語',
    review: '非公開 HTML プレビュー',
    create: 'コンテンツ API を作成',
    name: 'API 名',
    path: 'エンドポイントのパス',
    source: 'HTML ソース',
    help: '内容を固定した下書きを作成します。API は公開されません。',
  },
  {
    code: 'ko',
    choice: '한국어',
    review: '비공개 HTML 미리보기',
    create: '콘텐츠 API 만들기',
    name: 'API 이름',
    path: '엔드포인트 경로',
    source: 'HTML 소스',
    help: '내용이 고정된 초안을 만듭니다. API는 게시되지 않습니다.',
  },
  {
    code: 'pt',
    choice: 'Português',
    review: 'Prévia privada do HTML',
    create: 'Criar API de conteúdo',
    name: 'Nome da API',
    path: 'Caminho do endpoint',
    source: 'Código HTML',
    help: 'Cria um rascunho com conteúdo fixo. Isso não publica uma API.',
  },
] as const

const apiName = 'Reviewed article API ไทย'
const endpointPath = '/reviewed-content-article'
const expectedHtml =
  '<h1>Saved heading ไทย</h1>' +
  '<p>&lt;script&gt;literal&lt;/script&gt; &amp; text ' +
  '<a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'

export async function contentSnapshotPreviews({
  page,
  owner,
  origin,
  capture,
}: {
  page: Page
  owner: string
  origin: string
  capture: PreviewCapture
}) {
  const viewport = page.viewportSize()
  const headers = { origin, authorization: 'Bearer ' + owner }
  const requests: string[] = []
  const errors: string[] = []
  let count = 0

  const observeRequest = (request: Request) => {
    if (request.url().startsWith(origin + '/api/'))
      requests.push(request.method() + ' ' + request.url())
  }
  const observeError = (error: Error) => errors.push(error.message)

  async function get(path: string) {
    const response = await page.request.get(origin + path, { headers })
    expect(response.status()).toBe(200)

    return response.json()
  }

  async function record(title: string, detail: string) {
    await capture('Content snapshot APIs', title, detail, { fullPage: false })
    count += 1
  }

  async function paint(review: Locator) {
    const iframe = review.locator('iframe[sandbox=""][srcdoc]')
    await iframe.scrollIntoViewIfNeeded()
    await expect(iframe).toBeInViewport()
    await expect(iframe).toHaveAttribute('tabindex', '-1')
    await expect(iframe).toHaveAttribute('aria-hidden', 'true')

    const frame = iframe.contentFrame()
    await expect(frame.locator('h1')).toHaveText('Saved heading ไทย')
    await expect(frame.locator('p')).toHaveText(
      '<script>literal</script> & text Open article',
    )
    await expect(frame.locator('a')).toHaveAttribute(
      'href',
      'https://example.invalid/preview?note=a&tag=b',
    )
    await expect(frame.locator('body')).toHaveAttribute('inert', '')
    await expect(frame.locator('script')).toHaveCount(0)
  }

  async function appearance(value: 'Light' | 'Dark') {
    await chooseManagementLanguage(page, 'English')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: value, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      value.toLowerCase(),
    )
  }

  page.on('pageerror', observeError)

  try {
    const saved = await seedHtmlPreviewWorkspace(page, origin, owner)
    const collectionPath = '/api/collections/' + saved.collectionId
    const entryPath = collectionPath + '/entries/' + saved.entryId
    const snapshotUrl = origin + entryPath + '/snapshot-flow'
    const previewUrl = origin + entryPath + '/render-preview'
    const rendererUrl = origin + collectionPath + '/renderer'

    async function savedContent() {
      return Promise.all(
        [
          '/api/structs/' + saved.structId,
          collectionPath,
          entryPath,
          collectionPath + '/renderer',
        ].map(get),
      )
    }

    const contentBefore = await savedContent()

    await signInPreview(page, owner)
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()
    await chooseManagementLanguage(page, 'English')
    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: saved.collectionName, exact: true })
      .click()
    await page
      .locator('.content-entry-row')
      .filter({ hasText: saved.entryId })
      .click()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      saved.title,
    )
    await page
      .getByRole('button', { name: 'Preview HTML', exact: true })
      .click()

    const auditBefore = await get('/api/audit')

    const review = page.getByRole('region', {
      name: 'Private HTML preview',
      exact: true,
    })
    const settingsResponse = page.waitForResponse(
      (response) =>
        response.url() === rendererUrl && response.request().method() === 'GET',
    )

    page.on('request', observeRequest)
    await review
      .getByRole('button', { name: 'Review collection settings', exact: true })
      .click()
    expect((await settingsResponse).status()).toBe(200)
    await review
      .getByRole('combobox', { name: 'HTML settings', exact: true })
      .click()
    await page
      .getByRole('option', {
        name: 'Reviewed collection settings',
        exact: true,
      })
      .click()
    expect(requests).toEqual(['GET ' + rendererUrl])

    const generatedResponse = page.waitForResponse(
      (response) =>
        response.url() === previewUrl && response.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Generate HTML preview', exact: true })
      .click()

    const generated = await generatedResponse
    expect(generated.status()).toBe(200)
    expect(generated.request().postDataJSON()).toEqual({
      entryVersion: 1,
      fieldKey: 'body',
      rendererVersion: 0,
    })
    const delivered = await generated.json()
    expect(delivered.html).toBe(expectedHtml)
    expect(delivered).toMatchObject({
      collectionId: saved.collectionId,
      collectionVersion: 1,
      entryId: saved.entryId,
      entryVersion: 1,
      rendererVersion: 0,
      fieldKey: 'body',
      schemaVersion: 2,
      astVersion: 2,
    })
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveValue(expectedHtml)
    await review.getByLabel('API name', { exact: true }).fill(apiName)
    await review.getByLabel('Endpoint path', { exact: true }).fill(endpointPath)

    const previewRequests = ['GET ' + rendererUrl, 'POST ' + previewUrl]
    expect(requests).toEqual(previewRequests)

    for (const phone of [false, true]) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
      )

      for (const [index, language] of languages.entries()) {
        const theme = index % 2 === 0 ? 'Light' : 'Dark'
        await appearance(theme)
        await chooseManagementLanguage(page, language.choice)
        await expect(page.locator('html')).toHaveAttribute(
          'lang',
          language.code,
        )

        const panel = page.getByRole('region', {
          name: language.review,
          exact: true,
        })
        const form = panel.getByRole('group', {
          name: language.create,
          exact: true,
        })
        const name = form.getByLabel(language.name, { exact: true })
        const path = form.getByLabel(language.path, { exact: true })
        const create = form.getByRole('button', {
          name: language.create,
          exact: true,
        })

        await expect(name).toHaveValue(apiName)
        await expect(path).toHaveValue(endpointPath)
        await expect(
          form.getByText(language.help, { exact: true }),
        ).toBeVisible()
        await expect(create).toBeEnabled()
        await expect(
          panel.getByRole('textbox', { name: language.source, exact: true }),
        ).toHaveValue(expectedHtml)
        await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
          saved.title,
        )
        await paint(panel)

        // Paint the real frame first; native viewport capture then focuses the form.
        await form.evaluate((element) =>
          element.scrollIntoView({ block: 'center' }),
        )
        await name.focus()
        await expect(name).toBeFocused()
        await expect(create).toBeInViewport()

        const bounds = await form.boundingBox()
        expect(bounds).not.toBeNull()
        const width = page.viewportSize()!.width
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)

        for (const control of [name, path, create]) {
          const box = await control.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
          expect(box!.x + box!.width).toBeLessThanOrEqual(
            bounds!.x + bounds!.width + 1,
          )
          if (phone) {
            expect(box!.width).toBeGreaterThanOrEqual(44)
            expect(box!.height).toBeGreaterThanOrEqual(44)
          }
        }

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true)
        expect(requests).toEqual(previewRequests)
        await record(
          (phone ? 'Phone ' : 'Desktop ') +
            theme.toLowerCase() +
            ' reviewed Content API creation ' +
            language.code,
          'The filled labelled form follows a real saved-mode HTML review. Literal name, endpoint, saved title and delivered HTML remain unchanged; language and appearance send no resource requests. ' +
            (phone
              ? 'Native 390 × 844 focus and 44-pixel controls are contained.'
              : 'Desktop capture focuses the contained creation form.'),
        )
        expect(requests).toEqual(previewRequests)
      }
    }

    await page.setViewportSize({ width: 1440, height: 1100 })
    await appearance('Light')
    expect(requests).toEqual(previewRequests)
    expect(await savedContent()).toEqual(contentBefore)
    expect(await get('/api/audit')).toEqual(auditBefore)

    const createResponse = page.waitForResponse(
      (response) =>
        response.url() === snapshotUrl &&
        response.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Create Content API', exact: true })
      .click()

    const response = await createResponse
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({
      name: apiName,
      path: endpointPath,
      collectionVersion: 1,
      entryVersion: 1,
      rendererVersion: 0,
      fieldPath: ['body'],
    })
    const created = (await response.json()) as SavedFlow
    expect(created).toMatchObject({
      name: apiName,
      path: endpointPath,
      method: 'GET',
      revision: 1,
      publishedRevision: null,
      publishedEndpoint: null,
    })
    expect(created.nodes.map((node) => node.type)).toEqual([
      'request',
      'cmsSnapshotResponse',
    ])
    expect(requests).toEqual([...previewRequests, 'POST ' + snapshotUrl])
    expect(await savedContent()).toEqual(contentBefore)
    expect(await get('/api/flows/' + created.id)).toEqual(created)

    const form = review.getByRole('group', {
      name: 'Create Content API',
      exact: true,
    })
    await expect(form.getByRole('status')).toHaveText(
      'Content API draft created.',
    )
    await expect(
      form.getByRole('button', { name: 'Create Content API', exact: true }),
    ).toBeDisabled()
    await form.evaluate((element) =>
      element.scrollIntoView({ block: 'center' }),
    )
    await record(
      'Content API draft created',
      'One real six-key POST creates a sealed GET draft. Confirmation and explicit Open API Studio remain separate from publication; saved content/settings are unchanged.',
    )

    await form
      .getByRole('button', { name: 'Open API Studio', exact: true })
      .click()
    const card = page.locator('.flow-card.cmsSnapshotResponse')
    await expect(card).toBeVisible()
    await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
      apiName,
    )
    await expect(page.getByLabel('API name', { exact: true })).toBeDisabled()
    await expect(
      page.getByLabel('Endpoint path', { exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Save draft', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Add step', exact: true }),
    ).toBeDisabled()
    await card.click()
    await expect(
      page.locator('.inspector').getByRole('heading', {
        name: 'Content snapshot',
        exact: true,
      }),
    ).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    await record(
      'Read-only Content snapshot Studio',
      'The newly created draft opens as a sealed request/snapshot graph with literal name/path and read-only inspector. Ordinary graph editing is disabled; publication remains explicit.',
    )

    const publicationUrl = origin + '/api/flows/' + created.id + '/publish'
    const publicationResponse = page.waitForResponse(
      (reply) =>
        reply.url() === publicationUrl && reply.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()

    const publishedResponse = await publicationResponse
    expect(publishedResponse.status()).toBe(200)
    expect(publishedResponse.request().postDataJSON()).toEqual({ revision: 1 })
    const published = (await publishedResponse.json()) as SavedFlow
    expect(published.publishedRevision).toBe(1)
    expect(published.publishedEndpoint).toEqual({
      method: 'GET',
      path: endpointPath,
      graphql: false,
      transport: 'rest',
    })

    const endpoint = page.getByLabel('Published endpoint URL', { exact: true })
    await expect(endpoint).toHaveValue(origin + '/run' + endpointPath)
    await expect(page.getByText('Live · v1', { exact: true })).toBeVisible()
    expect(await savedContent()).toEqual(contentBefore)

    // A server-issued pinned caller proves the route without exposing its token.
    const keyResponse = await page.request.post(origin + '/api/runtime-keys', {
      headers,
      data: {
        name: 'Content preview caller',
        flowId: created.id,
        releaseRevision: 1,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    })
    expect(keyResponse.status()).toBe(200)

    const key = (await keyResponse.json()) as { token: string }
    const runtime = origin + '/run' + endpointPath
    expect((await page.request.get(runtime, { headers })).status()).toBe(401)
    const called = await page.request.get(runtime, {
      headers: { authorization: 'Bearer ' + key.token },
    })
    expect(called.status()).toBe(200)

    const body = await called.json()
    expect(body.html).toBe(expectedHtml)
    expect(body.document).toEqual(contentBefore[2].data.body)
    expect(body.provenance).toMatchObject({
      flowId: created.id,
      releaseRevision: 1,
      collectionId: saved.collectionId,
      entryId: saved.entryId,
      entryVersion: 1,
      rendererVersion: 0,
      fieldPath: ['body'],
    })
    await endpoint.scrollIntoViewIfNeeded()
    await record(
      'Published live Content snapshot API',
      'Explicit publication registers the displayed GET route at release one. A pinned runtime caller receives exact sealed AST/HTML; the management credential is denied and saved content remains unchanged.',
    )

    expect(
      requests.filter((request) => request === 'POST ' + snapshotUrl),
    ).toHaveLength(1)
    expect(
      requests.filter((request) => request === 'POST ' + publicationUrl),
    ).toHaveLength(1)
    expect(
      requests.filter((request) => request === 'POST ' + previewUrl),
    ).toHaveLength(1)
    expect(count).toBe(contentSnapshotPreviewCount)
    expect(errors).toEqual([])

    return count
  } finally {
    page.off('request', observeRequest)
    page.off('pageerror', observeError)
    if (viewport && !page.isClosed()) await page.setViewportSize(viewport)
  }
}
