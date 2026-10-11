import { expect, type Page, type Request, type Route } from '@playwright/test'
import { createHash } from 'node:crypto'
import { collectionRendererLanguages } from './collection-renderer-languages'
import { chooseManagementLanguage } from './management-locale-previews'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import { seedHtmlPreviewWorkspace } from './rich-text-html-seed'

export const savedRendererPreviewCount = 14

const languages = [
  {
    review: 'Private HTML preview',
    settings: 'HTML settings',
    selected: 'Reviewed collection settings',
    reviewSettings: 'Review collection settings',
    generate: 'Generate HTML preview',
    source: 'HTML source',
  },
  {
    review: 'ตัวอย่าง HTML ส่วนตัว',
    settings: 'การตั้งค่า HTML',
    selected: 'การตั้งค่าคอลเลกชันที่ตรวจสอบแล้ว',
    reviewSettings: 'ตรวจสอบการตั้งค่าคอลเลกชัน',
    generate: 'สร้างตัวอย่าง HTML',
    source: 'โค้ด HTML',
  },
  {
    review: '私有 HTML 预览',
    settings: 'HTML 设置',
    selected: '已查看的集合设置',
    reviewSettings: '查看集合设置',
    generate: '生成 HTML 预览',
    source: 'HTML 源码',
  },
  {
    review: 'Приватный предпросмотр HTML',
    settings: 'Настройки HTML',
    selected: 'Просмотренные настройки коллекции',
    reviewSettings: 'Просмотреть настройки коллекции',
    generate: 'Создать предпросмотр HTML',
    source: 'Исходный HTML',
  },
  {
    review: '非公開 HTML プレビュー',
    settings: 'HTML 設定',
    selected: '確認済みコレクション設定',
    reviewSettings: 'コレクション設定を確認',
    generate: 'HTML プレビューを生成',
    source: 'HTML ソース',
  },
  {
    review: '비공개 HTML 미리보기',
    settings: 'HTML 설정',
    selected: '검토한 컬렉션 설정',
    reviewSettings: '컬렉션 설정 검토',
    generate: 'HTML 미리보기 생성',
    source: 'HTML 소스',
  },
  {
    review: 'Prévia privada do HTML',
    settings: 'Configurações de HTML',
    selected: 'Configurações revisadas da coleção',
    reviewSettings: 'Revisar configurações da coleção',
    generate: 'Gerar prévia do HTML',
    source: 'Código HTML',
  },
] as const

const firstRenderer = {
  schemaVersion: 1,
  elements: {
    h1: {
      classes: ['reviewed-heading'],
      attributes: { title: 'Saved <heading> & ไทย' },
    },
  },
}
const peerRenderer = {
  schemaVersion: 1,
  elements: {
    h1: {
      classes: ['peer-heading'],
      attributes: { title: 'Peer <heading> & ไทย' },
    },
  },
}
const firstHash = createHash('sha256')
  .update(
    '{"consumerContract":null,"elements":{"h1":{"attributes":{"title":"Saved <heading> & ไทย"},"classes":["reviewed-heading"]}},"schemaVersion":1}',
    'utf8',
  )
  .digest('hex')
const peerHash = createHash('sha256')
  .update(
    '{"consumerContract":null,"elements":{"h1":{"attributes":{"title":"Peer <heading> & ไทย"},"classes":["peer-heading"]}},"schemaVersion":1}',
    'utf8',
  )
  .digest('hex')
const restHtml =
  '<p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
const firstHtml =
  '<h1 class="reviewed-heading" title="Saved &lt;heading&gt; &amp; ไทย">Saved heading ไทย</h1>' +
  restHtml
const peerHtml =
  '<h1 class="peer-heading" title="Peer &lt;heading&gt; &amp; ไทย">Saved heading ไทย</h1>' +
  restHtml

type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
}

export async function savedRendererPreviews({
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
  const requests: string[] = []
  const errors: string[] = []
  let count = 0
  const observeError = (error: Error) => errors.push(error.message)
  const observeRequest = (request: Request) => {
    if (request.url().startsWith(origin + '/api/'))
      requests.push(request.method() + ' ' + request.url())
  }
  const headers = { origin, authorization: 'Bearer ' + owner }

  async function record(
    title: string,
    detail: string,
    options?: Parameters<PreviewCapture>[3],
  ) {
    const frame = page.locator('.collection-review iframe[sandbox=""][srcdoc]')
    const rendered = (await frame.count()) > 0
    if (rendered && !options) {
      await frame.scrollIntoViewIfNeeded()
      await expect(frame).toBeInViewport()
      await expect(frame.contentFrame().locator('body')).not.toBeEmpty()
    }

    await capture('Saved HTML preview settings', title, detail, {
      ...options,
      ...(rendered ? { fullPage: false } : {}),
    })
    count += 1
  }

  async function get(path: string) {
    const response = await page.request.get(origin + path, { headers })
    expect(response.status()).toBe(200)

    return response.json()
  }

  page.on('pageerror', observeError)

  try {
    const saved = await seedHtmlPreviewWorkspace(page, origin, owner)
    const collectionPath = '/api/collections/' + saved.collectionId
    const entryPath = collectionPath + '/entries/' + saved.entryId
    const rendererPath = origin + collectionPath + '/renderer'
    const previewPath = origin + entryPath + '/render-preview'
    const saveResponse = await page.request.put(rendererPath, {
      headers,
      data: { version: 0, renderer: firstRenderer },
    })
    expect(saveResponse.status()).toBe(200)

    const first = await saveResponse.json()
    expect(first.version).toBe(1)
    expect(first.renderer).toEqual(firstRenderer)
    expect(first.rendererSha256).toBe(firstHash)

    await signInPreview(page, owner)
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
    await expect(
      page.getByRole('heading', { name: 'Saved entry', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      saved.title,
    )

    page.on('request', observeRequest)
    await page
      .getByRole('button', { name: 'Preview HTML', exact: true })
      .click()

    const review = page.getByRole('region', {
      name: languages[0].review,
      exact: true,
    })
    const reviewSettings = review.getByRole('button', {
      name: languages[0].reviewSettings,
      exact: true,
    })
    const settingsChoice = review.getByRole('combobox', {
      name: languages[0].settings,
      exact: true,
    })
    const generate = review.getByRole('button', {
      name: languages[0].generate,
      exact: true,
    })
    await expect(review).toBeVisible()
    await expect(reviewSettings).toBeEnabled()

    async function snapshot() {
      return {
        model: await get('/api/structs/' + saved.structId),
        collection: await get(collectionPath),
        entry: await get(entryPath),
        entries: await get(collectionPath + '/entries'),
        renderer: await get(collectionPath + '/renderer'),
        audit: (await get('/api/audit')) as AuditEvent[],
      }
    }

    const before = await snapshot()
    expect(requests).toEqual([])
    await expect(settingsChoice).toHaveText('Temporary settings')
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveCount(0)
    await record(
      'Private preview before explicit settings review',
      'The saved entry is open in temporary mode. Opening the review performs no renderer GET or preview POST and changes no saved content.',
    )

    let release!: () => void
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    let receive!: (value: unknown) => void
    let reject!: (reason: unknown) => void
    const actual = new Promise<unknown>((resolve, fail) => {
      receive = resolve
      reject = fail
    })
    let finish!: () => void
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    let browserFinish!: () => void
    const browserFinished = new Promise<void>((resolve) => {
      browserFinish = resolve
    })
    let owned: Request | null = null
    let started = false
    const observeFinish = (request: Request) => {
      if (request === owned) browserFinish()
    }
    const heldGet = async (route: Route) => {
      if (route.request().method() !== 'GET' || started) {
        await route.continue()
        return
      }

      started = true
      owned = route.request()

      try {
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
        expect(response.status()).toBe(200)
        receive(await response.json())
        await released
        await route.fulfill({ response })
      } catch (reason) {
        reject(reason)
        await route.abort('failed').catch(() => undefined)
      } finally {
        finish()
      }
    }

    page.on('requestfinished', observeFinish)
    page.on('requestfailed', observeFinish)
    await page.route(rendererPath, heldGet)

    try {
      await reviewSettings.click()
      expect(await actual).toEqual(first)
      await expect(review.getByRole('status')).toHaveText(
        'Loading HTML settings…',
      )
      for (const control of [reviewSettings, settingsChoice, generate])
        await expect(control).toBeDisabled()
      await expect(
        review.getByRole('button', { name: 'Close HTML preview', exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByRole('button', { name: 'API Studio', exact: true }),
      ).toBeDisabled()
      expect(requests).toEqual(['GET ' + rendererPath])
      expect(await snapshot()).toEqual(before)
      await record(
        'Explicit settings review waits for real delivery',
        'The actual renderer GET succeeded while browser delivery is held. Review controls and navigation remain disabled; no settings are selected or HTML generated automatically.',
      )

      release()
      await finished
      await browserFinished
      await expect(reviewSettings).toBeEnabled()
      await expect(settingsChoice).toHaveText('Temporary settings')
      expect(requests).toEqual(['GET ' + rendererPath])
    } finally {
      release()

      if (started) {
        await finished
        await browserFinished
      }

      await page.unroute(rendererPath, heldGet)
      page.off('requestfinished', observeFinish)
      page.off('requestfailed', observeFinish)
    }

    async function chooseSettings(name: string) {
      await settingsChoice.click()
      await page.getByRole('option', { name, exact: true }).click()
    }

    await chooseSettings('Reviewed collection settings')
    await chooseSettings('Temporary settings')
    await chooseSettings('Reviewed collection settings')

    const fieldChoice = review.getByRole('combobox', {
      name: 'Rich-text field',
      exact: true,
    })
    await fieldChoice.click()
    await page.getByRole('option', { name: 'Summary', exact: true }).click()
    await fieldChoice.click()
    await page.getByRole('option', { name: 'Body', exact: true }).click()
    expect(requests).toEqual(['GET ' + rendererPath])

    const identity = {
      collectionId: saved.collectionId,
      collectionVersion: 1,
      structId: saved.structId,
      structVersion: 1,
      entryId: saved.entryId,
      entryVersion: 1,
      fieldKey: 'body',
      schemaVersion: 2,
      astVersion: 2,
      rendererSchemaVersion: 1,
      consumerContract: null,
    }

    async function generateReply(version: number, hash: string, html: string) {
      const receiving = page.waitForResponse(
        (response) =>
          response.url() === previewPath &&
          response.request().method() === 'POST',
      )
      await generate.click()

      const response = await receiving
      expect(response.status()).toBe(200)
      expect(response.request().postDataJSON()).toEqual({
        entryVersion: 1,
        fieldKey: 'body',
        rendererVersion: version,
      })
      expect(await response.json()).toEqual({
        ...identity,
        rendererVersion: version,
        rendererSha256: hash,
        html,
      })
      await expect(
        review.getByRole('textbox', { name: 'HTML source', exact: true }),
      ).toHaveValue(html)
      await expect(generate).toBeEnabled()
    }

    async function renderedHeading(className: string, title: string) {
      const iframe = review.locator('iframe')
      await iframe.scrollIntoViewIfNeeded()
      await expect(iframe).toHaveAttribute('sandbox', '')
      await expect(iframe).toHaveAttribute('tabindex', '-1')
      await expect(iframe).toHaveAttribute('aria-hidden', 'true')

      const frame = iframe.contentFrame()
      await expect(frame.locator('body')).toHaveAttribute('inert', '')
      await expect(frame.locator('h1')).toHaveText('Saved heading ไทย')
      await expect(frame.locator('h1')).toHaveAttribute('class', className)
      await expect(frame.locator('h1')).toHaveAttribute('title', title)
      await expect(frame.locator('script')).toHaveCount(0)
      await expect(frame.locator('p')).toHaveText(
        '<script>literal</script> & text Open article',
      )
    }

    await generateReply(1, firstHash, firstHtml)
    await renderedHeading('reviewed-heading', 'Saved <heading> & ไทย')
    expect(await snapshot()).toEqual(before)
    await record(
      'Reviewed collection settings generate escaped private HTML',
      'Explicit generation uses renderer revision one and the independently checked mapping hash. Literal attributes and content remain escaped inside the inactive sandbox.',
    )

    const peerResponse = await page.request.put(rendererPath, {
      headers,
      data: { version: 1, renderer: peerRenderer },
    })
    expect(peerResponse.status()).toBe(200)

    const peer = await peerResponse.json()
    expect(peer.version).toBe(2)
    expect(peer.renderer).toEqual(peerRenderer)
    expect(peer.rendererSha256).toBe(peerHash)

    const afterPeer = await snapshot()
    expect(afterPeer.model).toEqual(before.model)
    expect(afterPeer.collection).toEqual(before.collection)
    expect(afterPeer.entry).toEqual(before.entry)
    expect(afterPeer.entries).toEqual(before.entries)
    expect(afterPeer.renderer).toEqual(peer)

    const previousIds = new Set(before.audit.map((event) => event.id))
    const additions = afterPeer.audit.filter(
      (event) => !previousIds.has(event.id),
    )
    expect(additions).toHaveLength(1)
    expect(additions[0]).toMatchObject({
      action: 'collection.renderer.saved',
      resource: saved.collectionId,
    })
    expect(
      afterPeer.audit.filter((event) => previousIds.has(event.id)),
    ).toEqual(before.audit)

    const rejected = page.waitForResponse(
      (response) =>
        response.url() === previewPath &&
        response.request().method() === 'POST',
    )
    await generate.click()
    const staleResponse = await rejected
    expect(staleResponse.status()).toBe(409)
    expect(await staleResponse.json()).toEqual({
      error: 'Collection renderer changed. Reload before previewing.',
    })
    await expect(review.getByRole('alert')).toHaveText(
      'Saved HTML settings changed. Review collection settings again.',
    )
    await expect(generate).toBeDisabled()
    await expect(reviewSettings).toBeEnabled()
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveCount(0)
    expect(await snapshot()).toEqual(afterPeer)
    await record(
      'Peer renderer update requires explicit rereview',
      'A real peer PUT advances only the renderer and its metadata audit. Generating with the reviewed older version returns 409 and blocks further saved-mode generation without retrying.',
    )

    const reread = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'GET',
    )
    await reviewSettings.click()
    expect(await (await reread).json()).toEqual(peer)
    await expect(generate).toBeEnabled()
    await expect(settingsChoice).toHaveText('Reviewed collection settings')
    await generateReply(2, peerHash, peerHtml)
    await renderedHeading('peer-heading', 'Peer <heading> & ไทย')
    expect(await snapshot()).toEqual(afterPeer)
    await record(
      'Explicit rereview recovers current saved renderer',
      'Review retrieves the actual renderer revision two. A separate explicit generation delivers matching HTML and hash while all saved content and audit remain unchanged.',
    )

    const expectedRequests = [
      'GET ' + rendererPath,
      'POST ' + previewPath,
      'POST ' + previewPath,
      'GET ' + rendererPath,
      'POST ' + previewPath,
    ]
    expect(requests).toEqual(expectedRequests)
    await page.setViewportSize({ width: 390, height: 844 })

    for (const [index, language] of languages.entries()) {
      const locale = collectionRendererLanguages[index]!
      await chooseManagementLanguage(page, locale.choice)

      const translated = page.getByRole('region', {
        name: language.review,
        exact: true,
      })
      const choice = translated.getByRole('combobox', {
        name: language.settings,
        exact: true,
      })
      await expect(choice).toHaveText(language.selected)
      await expect(
        translated.getByRole('textbox', { name: language.source, exact: true }),
      ).toHaveValue(peerHtml)
      const settingsPanel = translated.locator('.collection-field').first()
      const settingsBounds = await settingsPanel.boundingBox()
      const revisionBounds = await settingsPanel
        .locator('[data-slot="badge"]')
        .first()
        .boundingBox()
      expect(settingsBounds).not.toBeNull()
      expect(revisionBounds).not.toBeNull()
      expect(revisionBounds!.x).toBeGreaterThanOrEqual(settingsBounds!.x)
      expect(revisionBounds!.x + revisionBounds!.width).toBeLessThanOrEqual(
        settingsBounds!.x + settingsBounds!.width,
      )
      for (const control of [
        choice,
        translated.getByRole('button', {
          name: language.reviewSettings,
          exact: true,
        }),
        translated.getByRole('button', {
          name: language.generate,
          exact: true,
        }),
      ]) {
        await expect(control).toBeEnabled()
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)
      await translated.locator('iframe').scrollIntoViewIfNeeded()
      await expect(
        translated.locator('iframe').contentFrame().locator('h1'),
      ).toHaveText('Saved heading ไทย')
      expect(requests).toEqual(expectedRequests)
      expect(await snapshot()).toEqual(afterPeer)
      await record(
        'Phone reviewed saved HTML settings ' + locale.code,
        'At a native 390 × 844 viewport, translated reviewed-mode controls remain contained and at least 44 pixels. Language choice preserves delivered literal HTML without another GET, POST or saved-state effect.',
      )
    }

    for (const [index, appearance] of [
      [6, 'Light'],
      [3, 'Dark'],
    ] as const) {
      await chooseManagementLanguage(page, 'English')
      await page
        .getByRole('combobox', { name: 'Appearance', exact: true })
        .click()
      await page.getByRole('option', { name: appearance, exact: true }).click()
      const language = languages[index]
      const locale = collectionRendererLanguages[index]!
      await chooseManagementLanguage(page, locale.choice)
      const translated = page.getByRole('region', {
        name: language.review,
        exact: true,
      })
      const choice = translated.getByRole('combobox', {
        name: language.settings,
        exact: true,
      })
      await choice.scrollIntoViewIfNeeded()
      await choice.focus()
      await expect(choice).toBeFocused()
      await expect(choice).toHaveText(language.selected)
      await expect(
        translated.getByRole('textbox', { name: language.source, exact: true }),
      ).toHaveValue(peerHtml)
      expect(requests).toEqual(expectedRequests)
      expect(await snapshot()).toEqual(afterPeer)
      await record(
        'Phone ' +
          appearance.toLowerCase() +
          ' reviewed settings focus ' +
          locale.code,
        'Native phone focus shows reviewed settings, wrapped revision labels and explicit actions in ' +
          appearance.toLowerCase() +
          ' appearance. Delivered HTML and saved state stay unchanged.',
        { fullPage: false },
      )
    }

    expect(count).toBe(savedRendererPreviewCount)
    expect(errors).toEqual([])

    return count
  } finally {
    page.off('pageerror', observeError)
    page.off('request', observeRequest)

    if (viewport && !page.isClosed()) await page.setViewportSize(viewport)
  }
}
