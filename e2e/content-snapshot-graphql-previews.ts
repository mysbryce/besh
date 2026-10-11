import { expect, type Locator, type Page, type Request } from '@playwright/test'
import { chooseManagementLanguage } from './management-locale-previews'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import { seedHtmlPreviewWorkspace } from './rich-text-html-seed'
import type { SavedFlow } from '../web/types/api'
import en from '../web/locales/en'
import th from '../web/locales/th'
import zh from '../web/locales/zh'
import ru from '../web/locales/ru'
import ja from '../web/locales/ja'
import ko from '../web/locales/ko'
import pt from '../web/locales/pt'

export const contentSnapshotGraphqlPreviewCount = 23

const languages = [
  { code: 'en', choice: 'English', messages: en },
  { code: 'th', choice: 'ไทย', messages: th },
  { code: 'zh', choice: '中文', messages: zh },
  { code: 'ru', choice: 'Русский', messages: ru },
  { code: 'ja', choice: '日本語', messages: ja },
  { code: 'ko', choice: '한국어', messages: ko },
  { code: 'pt', choice: 'Português', messages: pt },
] as const

const apiName = 'Sealed GraphQL article ไทย'
const endpointPath = '/sealed-graphql-article'
const expectedHtml =
  '<h1>Saved heading ไทย</h1>' +
  '<p>&lt;script&gt;literal&lt;/script&gt; &amp; text ' +
  '<a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
const contractHelp =
  'GraphQL uses a fixed read-only schema. Create and publish explicitly before calling it.'
const queryHelp =
  'Select the document, HTML and provenance fields you need. Queries do not read newer source content.'

export async function contentSnapshotGraphqlPreviews({
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
  let settings: {
    language: string | null
    theme: string | null
    activeLanguage: string
  } | null = null

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
    await capture('GraphQL Content snapshot APIs', title, detail, {
      fullPage: false,
    })
    count += 1
  }

  async function appearance(value: 'Light' | 'Dark' | 'System') {
    await chooseManagementLanguage(page, 'English')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: value, exact: true }).click()
    if (value !== 'System')
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        value.toLowerCase(),
      )
  }

  async function contained(controls: Locator[], phone: boolean) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)

    for (const control of controls) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width + 1,
      )
      if (phone) {
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
    }
  }

  page.on('pageerror', observeError)

  try {
    const saved = await seedHtmlPreviewWorkspace(page, origin, owner)
    const collectionPath = '/api/collections/' + saved.collectionId
    const entryPath = collectionPath + '/entries/' + saved.entryId
    const snapshotUrl = origin + entryPath + '/snapshot-flow/graphql'
    const rendererUrl = origin + collectionPath + '/renderer'
    const previewUrl = origin + entryPath + '/render-preview'

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
    settings = await page.evaluate(() => ({
      language: localStorage.getItem('besh-language'),
      theme: localStorage.getItem('besh-theme'),
      activeLanguage: document.documentElement.lang,
    }))
    await page.setViewportSize({ width: 1440, height: 1100 })
    await appearance('Light')
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
    const rendererResponse = page.waitForResponse(
      (response) =>
        response.url() === rendererUrl && response.request().method() === 'GET',
    )

    page.on('request', observeRequest)
    await review
      .getByRole('button', { name: 'Review collection settings', exact: true })
      .click()
    expect((await rendererResponse).status()).toBe(200)
    await review
      .getByRole('combobox', { name: 'HTML settings', exact: true })
      .click()
    await page
      .getByRole('option', {
        name: 'Reviewed collection settings',
        exact: true,
      })
      .click()

    const previewResponse = page.waitForResponse(
      (response) =>
        response.url() === previewUrl && response.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Generate HTML preview', exact: true })
      .click()

    const deliveredResponse = await previewResponse
    expect(deliveredResponse.status()).toBe(200)
    expect(deliveredResponse.request().postDataJSON()).toEqual({
      entryVersion: 1,
      fieldKey: 'body',
      rendererVersion: 0,
    })
    const delivered = await deliveredResponse.json()
    expect(delivered.html).toBe(expectedHtml)
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveValue(expectedHtml)
    await review
      .getByRole('combobox', { name: 'API type', exact: true })
      .click()
    await expect(
      page.getByRole('option', { name: 'REST', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await record(
      'Explicit GraphQL Content API choice',
      'The custom accessible API-type menu defaults to REST. GraphQL is an explicit choice after a real saved-renderer HTML review; selecting it does not create or publish an API.',
    )
    await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
    await review.getByLabel('API name', { exact: true }).fill(apiName)
    await review.getByLabel('Endpoint path', { exact: true }).fill(endpointPath)

    const previewRequests = ['GET ' + rendererUrl, 'POST ' + previewUrl]
    expect(requests).toEqual(previewRequests)

    async function creationCapture(
      language: (typeof languages)[number],
      theme: 'Light' | 'Dark',
      phone: boolean,
    ) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
      )
      await appearance(theme)
      await chooseManagementLanguage(page, language.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)

      const text = language.messages
      const panel = page.getByRole('region', {
        name: text['Private HTML preview'],
        exact: true,
      })
      const form = panel.getByRole('group', {
        name: text['Create Content API'],
        exact: true,
      })
      const name = form.getByLabel(text['API name'], { exact: true })
      const path = form.getByLabel(text['Endpoint path'], { exact: true })
      const type = form.getByRole('combobox', {
        name: text['API type'],
        exact: true,
      })
      const create = form.getByRole('button', {
        name: text['Create Content API'],
        exact: true,
      })

      await expect(name).toHaveValue(apiName)
      await expect(path).toHaveValue(endpointPath)
      await expect(type).toHaveText('GraphQL')
      await expect(create).toBeEnabled()
      await expect(
        form.getByText(
          text['Creates a sealed draft. This does not publish an API.'],
          {
            exact: true,
          },
        ),
      ).toBeVisible()
      await expect(
        panel.getByRole('textbox', { name: text['HTML source'], exact: true }),
      ).toHaveValue(expectedHtml)
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
        saved.title,
      )
      await form.evaluate((element) =>
        element.scrollIntoView({ block: 'center' }),
      )
      await name.focus()
      await expect(name).toBeFocused()
      await expect(create).toBeInViewport()
      await contained([name, path, type, create], phone)
      expect(requests).toEqual(previewRequests)

      await record(
        (phone ? 'Phone ' : 'Desktop ') +
          theme.toLowerCase() +
          ' GraphQL creation ' +
          language.code,
        'The filled GraphQL creation form retains literal name/path, title and delivered HTML across language and theme changes without resource requests. ' +
          (phone
            ? 'Native 390 × 844 controls have at least 44-pixel targets and visible contained focus.'
            : 'The desktop view shows translated labels and explicit draft creation.'),
      )
      expect(requests).toEqual(previewRequests)
    }

    for (const [index, language] of languages.entries())
      await creationCapture(language, index % 2 === 0 ? 'Light' : 'Dark', false)
    await creationCapture(languages[1], 'Light', true)
    await creationCapture(languages[3], 'Dark', true)
    expect(await savedContent()).toEqual(contentBefore)
    expect(await get('/api/audit')).toEqual(auditBefore)

    await page.setViewportSize({ width: 1440, height: 1100 })
    await appearance('Light')
    const creation = page.waitForResponse(
      (response) =>
        response.url() === snapshotUrl &&
        response.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Create Content API', exact: true })
      .click()

    const creationResponse = await creation
    expect(creationResponse.status()).toBe(200)
    expect(creationResponse.request().postDataJSON()).toEqual({
      name: apiName,
      path: endpointPath,
      collectionVersion: 1,
      entryVersion: 1,
      rendererVersion: 0,
      fieldPath: ['body'],
    })
    const draft = (await creationResponse.json()) as SavedFlow
    expect(draft).toMatchObject({
      name: apiName,
      path: endpointPath,
      method: 'POST',
      revision: 1,
      publishedRevision: null,
      publishedEndpoint: null,
    })
    expect(draft.graphql?.schema).toContain(
      'contentSnapshot: CmsContentSnapshot!',
    )
    expect(draft.nodes.map((node) => node.type)).toEqual([
      'request',
      'cmsSnapshotResponse',
    ])

    const form = review.getByRole('group', {
      name: 'Create Content API',
      exact: true,
    })
    await expect(form.getByRole('status')).toHaveText(
      'Content API draft created.',
    )
    await expect(
      form.getByRole('combobox', { name: 'API type', exact: true }),
    ).toBeDisabled()
    await expect(
      form.getByRole('button', { name: 'Create Content API', exact: true }),
    ).toBeDisabled()
    await form.evaluate((element) =>
      element.scrollIntoView({ block: 'center' }),
    )
    await record(
      'GraphQL Content API draft created',
      'One real six-key POST to the dedicated GraphQL creation route returns a sealed POST draft and fixed schema. The type choice locks; opening Studio remains separate from publication.',
    )
    await form
      .getByRole('button', { name: 'Open API Studio', exact: true })
      .click()
    await expect(page.locator('.flow-card.cmsSnapshotResponse')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Save draft', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Add step', exact: true }),
    ).toBeDisabled()

    const example = page.getByRole('textbox', {
      name: 'Example GraphQL query',
      exact: true,
    })
    await expect(example).toHaveValue(/contentSnapshot/)
    const query = await example.inputValue()
    const studioRequests = [...requests]
    const studioAudit = await get('/api/audit')

    async function contractCapture(
      language: (typeof languages)[number],
      theme: 'Light' | 'Dark',
      phone: boolean,
    ) {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
      )
      await appearance(theme)
      await chooseManagementLanguage(page, language.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)

      const text = language.messages
      const schema = page.getByRole('textbox', {
        name: text['Fixed GraphQL schema'],
        exact: true,
      })
      const sample = page.getByRole('textbox', {
        name: text['Example GraphQL query'],
        exact: true,
      })
      const contract = page.locator('.graphql-schema')

      await expect(
        page.getByLabel(text['API name'], { exact: true }),
      ).toHaveValue(apiName)
      await expect(
        page.getByLabel(text['Endpoint path'], { exact: true }),
      ).toHaveValue(endpointPath)
      await expect(schema).toHaveValue(draft.graphql!.schema)
      await expect(sample).toHaveValue(query)
      await expect(schema).toHaveAttribute('readonly', '')
      await expect(sample).toHaveAttribute('readonly', '')
      await expect(
        contract.getByText(text[contractHelp], { exact: true }),
      ).toBeVisible()
      await expect(
        contract.getByText(text[queryHelp], { exact: true }),
      ).toBeVisible()

      // Each native textarea accepts focus and scroll without editing the contract.
      for (const control of [schema, sample]) {
        await control.scrollIntoViewIfNeeded()
        await control.focus()
        await expect(control).toBeFocused()
        await expect(control).toBeInViewport()
        await control.evaluate((element) => {
          element.scrollTop = element.scrollHeight
        })
        expect(
          await control.evaluate((element) => element.scrollTop),
        ).toBeGreaterThan(0)
        await control.evaluate((element) => {
          element.scrollTop = 0
        })
      }
      await contained([schema, sample], phone)
      await expect(schema).toHaveValue(draft.graphql!.schema)
      await expect(sample).toHaveValue(query)
      expect(requests).toEqual(studioRequests)

      await record(
        (phone ? 'Phone ' : 'Desktop ') +
          theme.toLowerCase() +
          ' sealed GraphQL contract ' +
          language.code,
        'Read-only fixed schema and example query retain exact literal bytes across translated help and appearance changes. Focused native textareas scroll without editing or resource requests. ' +
          (phone
            ? 'The 390 × 844 view remains contained with at least 44-pixel controls.'
            : 'The desktop view explains explicit publication and sealed-source selection.'),
      )
      expect(requests).toEqual(studioRequests)
    }

    for (const [index, language] of languages.entries())
      await contractCapture(language, index % 2 === 0 ? 'Light' : 'Dark', false)
    await contractCapture(languages[1], 'Light', true)
    await contractCapture(languages[3], 'Dark', true)
    expect(await get('/api/flows/' + draft.id)).toEqual(draft)
    expect(await savedContent()).toEqual(contentBefore)
    expect(await get('/api/audit')).toEqual(studioAudit)

    await page.setViewportSize({ width: 1440, height: 1100 })
    await appearance('Light')
    const publicationUrl = origin + '/api/flows/' + draft.id + '/publish'
    const publication = page.waitForResponse(
      (response) =>
        response.url() === publicationUrl &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()

    const publishedResponse = await publication
    expect(publishedResponse.status()).toBe(200)
    expect(publishedResponse.request().postDataJSON()).toEqual({ revision: 1 })
    const published = (await publishedResponse.json()) as SavedFlow
    expect(published.publishedRevision).toBe(1)
    expect(published.publishedEndpoint).toEqual({
      method: 'POST',
      path: endpointPath,
      graphql: true,
      transport: 'graphql',
    })

    const endpointUrl = origin + '/graphql' + endpointPath
    const endpoint = page.getByLabel('Published endpoint URL', { exact: true })
    await expect(endpoint).toHaveValue(endpointUrl)
    await expect(page.getByText('Live · v1', { exact: true })).toBeVisible()
    await endpoint.scrollIntoViewIfNeeded()
    await record(
      'Published sealed GraphQL endpoint',
      'Explicit publication registers the displayed POST GraphQL route at release one. The fixed schema and selected sealed content remain separate from newer source content.',
    )

    await page.getByRole('button', { name: 'API keys', exact: true }).click()
    await expect(
      page.getByRole('combobox', { name: 'Release access', exact: true }),
    ).toHaveText('Only this release')
    await page
      .getByLabel('Key name', { exact: true })
      .fill('GraphQL preview reader')
    await page
      .getByRole('button', { name: 'Create API key', exact: true })
      .click()

    const confirmation = page.getByRole('dialog', {
      name: 'Create release-pinned API key',
      exact: true,
    })
    await expect(
      confirmation.getByText('Only release 1', { exact: true }),
    ).toBeVisible()
    await record(
      'Review pinned GraphQL query key',
      'The real key-creation confirmation reviews only this published release and its GraphQL query grant. Issuance requires the explicit Create pinned key action.',
    )

    const issuanceUrl = origin + '/api/runtime-keys'
    const issuance = page.waitForResponse(
      (response) =>
        response.url() === issuanceUrl &&
        response.request().method() === 'POST',
    )
    await confirmation
      .getByRole('button', { name: 'Create pinned key', exact: true })
      .click()

    const issuedResponse = await issuance
    expect(issuedResponse.status()).toBe(200)
    expect(issuedResponse.request().postDataJSON()).toMatchObject({
      flowId: draft.id,
      releaseRevision: 1,
      permissions: ['query'],
    })
    const key = await issuedResponse.json()
    expect(key.issuerBinding).toEqual({
      memberId: 'owner',
      action: 'runtime-keys.manage',
    })
    const receipt = page.getByRole('region', {
      name: 'Save API key',
      exact: true,
    })
    const token = receipt.getByRole('textbox', {
      name: 'New API key',
      exact: true,
    })
    await expect(token).toBeVisible()
    expect((await token.inputValue()) === key.token).toBe(true)

    const called = await page.request.post(endpointUrl, {
      headers: { authorization: 'Bearer ' + key.token },
      data: { query },
    })
    expect(called.status()).toBe(200)
    const selected = await called.json()
    expect(selected.errors).toBeUndefined()
    expect(selected.data.contentSnapshot).toMatchObject({
      document: { type: 'document', astVersion: 2 },
      html: expectedHtml,
      provenance: {
        entryVersion: '1',
        rendererVersion: '0',
        releaseRevision: '1',
      },
    })
    expect(
      (
        await page.request.post(endpointUrl, {
          headers,
          data: { query },
        })
      ).status(),
    ).toBe(401)
    await receipt.scrollIntoViewIfNeeded()
    await record(
      'Masked GraphQL caller key receipt',
      'The issued query-only owner-bound key is pinned to release one and masked by the shared gallery capture. A real POST using the exact displayed example selects sealed document/HTML and decimal-string provenance; the management credential is denied.',
    )
    await receipt
      .getByRole('button', { name: 'I saved this API key', exact: true })
      .click()

    expect(await savedContent()).toEqual(contentBefore)
    for (const url of [snapshotUrl, previewUrl, publicationUrl, issuanceUrl])
      expect(
        requests.filter((request) => request === 'POST ' + url),
      ).toHaveLength(1)
    expect(count).toBe(contentSnapshotGraphqlPreviewCount)
    expect(errors).toEqual([])

    return count
  } finally {
    page.off('request', observeRequest)
    page.off('pageerror', observeError)
    if (!page.isClosed()) {
      if (viewport) await page.setViewportSize(viewport)
      if (settings) {
        const originalSettings = settings
        const theme =
          settings.theme === 'light'
            ? 'Light'
            : settings.theme === 'dark'
              ? 'Dark'
              : 'System'
        await appearance(theme)
        const language = languages.find(
          (entry) => entry.code === originalSettings.activeLanguage,
        )
        await chooseManagementLanguage(page, language?.choice ?? 'English')
        await page.evaluate((original) => {
          const values = {
            'besh-language': original.language,
            'besh-theme': original.theme,
          }

          for (const [key, value] of Object.entries(values)) {
            if (value === null) localStorage.removeItem(key)
            else localStorage.setItem(key, value)
          }
        }, originalSettings)
      }
    }
  }
}
