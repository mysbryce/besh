import { expect, type Page, type Request } from '@playwright/test'
import { createHash } from 'node:crypto'
import { chooseManagementLanguage } from './management-locale-previews'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import {
  seedHtmlPreviewWorkspace,
  type HtmlPreviewWorkspace,
} from './rich-text-html-seed'

const languages = [
  {
    code: 'en',
    choice: 'English',
    review: 'Private HTML preview',
    generate: 'Generate HTML preview',
    advanced: 'Advanced element settings',
    classes: 'CSS classes',
    title: 'Title attribute',
    aria: 'Accessibility label',
    fixed: 'Use fixed heading identifier',
    source: 'HTML source',
    copy: 'Copy HTML',
    close: 'Close HTML preview',
  },
  {
    code: 'th',
    choice: 'ไทย',
    review: 'ตัวอย่าง HTML ส่วนตัว',
    generate: 'สร้างตัวอย่าง HTML',
    advanced: 'ตั้งค่าองค์ประกอบขั้นสูง',
    classes: 'คลาส CSS',
    title: 'แอตทริบิวต์ title',
    aria: 'ป้ายกำกับสำหรับการเข้าถึง',
    fixed: 'ใช้ตัวระบุหัวเรื่องแบบตายตัว',
    source: 'โค้ด HTML',
    copy: 'คัดลอก HTML',
    close: 'ปิดตัวอย่าง HTML',
  },
  {
    code: 'zh',
    choice: '中文',
    review: '私有 HTML 预览',
    generate: '生成 HTML 预览',
    advanced: '高级元素设置',
    classes: 'CSS 类名',
    title: 'title 属性',
    aria: '无障碍标签',
    fixed: '使用固定标题标识符',
    source: 'HTML 源码',
    copy: '复制 HTML',
    close: '关闭 HTML 预览',
  },
  {
    code: 'ru',
    choice: 'Русский',
    review: 'Приватный предпросмотр HTML',
    generate: 'Создать предпросмотр HTML',
    advanced: 'Дополнительные настройки элементов',
    classes: 'Классы CSS',
    title: 'Атрибут title',
    aria: 'Метка доступности',
    fixed: 'Использовать фиксированный идентификатор заголовка',
    source: 'Исходный HTML',
    copy: 'Скопировать HTML',
    close: 'Закрыть предпросмотр HTML',
  },
  {
    code: 'ja',
    choice: '日本語',
    review: '非公開 HTML プレビュー',
    generate: 'HTML プレビューを生成',
    advanced: '要素の詳細設定',
    classes: 'CSS クラス',
    title: 'title 属性',
    aria: 'アクセシビリティラベル',
    fixed: '固定の見出し識別子を使用',
    source: 'HTML ソース',
    copy: 'HTML をコピー',
    close: 'HTML プレビューを閉じる',
  },
  {
    code: 'ko',
    choice: '한국어',
    review: '비공개 HTML 미리보기',
    generate: 'HTML 미리보기 생성',
    advanced: '고급 요소 설정',
    classes: 'CSS 클래스',
    title: 'title 속성',
    aria: '접근성 레이블',
    fixed: '고정 제목 식별자 사용',
    source: 'HTML 소스',
    copy: 'HTML 복사',
    close: 'HTML 미리보기 닫기',
  },
  {
    code: 'pt',
    choice: 'Português',
    review: 'Prévia privada do HTML',
    generate: 'Gerar prévia do HTML',
    advanced: 'Configurações avançadas de elementos',
    classes: 'Classes CSS',
    title: 'Atributo title',
    aria: 'Rótulo de acessibilidade',
    fixed: 'Usar identificador fixo de título',
    source: 'Código HTML',
    copy: 'Copiar HTML',
    close: 'Fechar prévia do HTML',
  },
] as const

const defaultHtml =
  '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
const summaryHtml = '<p>  Summary &lt;em&gt;literal&lt;/em&gt; &amp; ไทย  </p>'
const nestedHtml =
  '<p>  Second nested &lt;p&gt;literal&lt;/p&gt; &amp; ไทย  </p>'
const classNames = 'text-heading-1 article-title'
const titleAttribute = 'Title "ไทย" & <saved>'
const accessibilityLabel = 'Heading ไทย'
const mappedHtml =
  '<h1 class="text-heading-1 article-title" aria-label="Heading ไทย" title="Title &quot;ไทย&quot; &amp; &lt;saved&gt;" x-data="h1">Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
const defaultRenderer = { schemaVersion: 1, elements: {} }
const mappedRenderer = {
  schemaVersion: 1,
  elements: {
    h1: {
      classes: ['text-heading-1', 'article-title'],
      attributes: {
        title: titleAttribute,
        'aria-label': accessibilityLabel,
        'x-data': 'h1',
      },
    },
  },
  consumerContract: 'besh.fixed-heading-id.v1',
}
const defaultHash = createHash('sha256')
  .update('{"consumerContract":null,"elements":{},"schemaVersion":1}')
  .digest('hex')
const mappedHash = createHash('sha256')
  .update(
    '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"aria-label":"Heading ไทย","title":"Title \\"ไทย\\" & <saved>","x-data":"h1"},"classes":["text-heading-1","article-title"]}},"schemaVersion":1}',
  )
  .digest('hex')

// Four field states, seven languages, four phone areas and three recovery states.
export const richTextHtmlPreviewCount = 18

export async function richTextHtmlPreviews({
  page,
  origin,
  owner,
  capture,
  workspace,
}: {
  page: Page
  origin: string
  owner: string
  capture: PreviewCapture
  workspace?: HtmlPreviewWorkspace
}) {
  const viewport = page.viewportSize()
  const errors: string[] = []
  const writes: string[] = []
  let count = 0
  const observeError = (error: Error) => errors.push(error.message)
  const observeWrite = (request: Request) => {
    if (
      request.url().startsWith(origin + '/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
    )
      writes.push(request.method() + ' ' + request.url())
  }

  page.on('pageerror', observeError)

  async function record(
    title: string,
    detail: string,
    options?: Parameters<PreviewCapture>[3],
  ) {
    const frame = page.locator('.collection-review iframe[sandbox=""][srcdoc]')
    const rendered = (await frame.count()) > 0
    if ((page.viewportSize()?.width ?? 0) > 700 && rendered) {
      await expect(frame.contentFrame().locator('body')).not.toBeEmpty()
      await frame.scrollIntoViewIfNeeded()
      await expect(frame).toBeInViewport()
    }

    await capture('Rich-text HTML', title, detail, {
      ...options,
      ...(rendered ? { fullPage: false } : {}),
    })
    count += 1
  }

  try {
    const saved =
      workspace ?? (await seedHtmlPreviewWorkspace(page, origin, owner))
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

    const headers = { origin, authorization: 'Bearer ' + owner }
    const collectionPath = '/api/collections/' + saved.collectionId
    const entryPath = collectionPath + '/entries/' + saved.entryId
    const previewUrl = origin + entryPath + '/render-preview'

    async function savedState() {
      return Promise.all(
        [collectionPath, entryPath, '/api/audit'].map(async (path) => {
          const response = await page.request.get(origin + path, { headers })
          expect(response.status()).toBe(200)

          return response.json()
        }),
      )
    }

    const before = await savedState()
    page.on('request', observeWrite)
    const preview = page.getByRole('button', {
      name: 'Preview HTML',
      exact: true,
    })
    await expect(preview).toHaveAttribute('aria-expanded', 'false')
    await record(
      'Saved entry HTML review collapsed',
      'The clean saved entry retains authored title and offers an explicit private preview without generating HTML.',
    )
    await preview.click()

    const review = page.getByRole('region', {
      name: 'Private HTML preview',
      exact: true,
    })
    const generate = review.getByRole('button', {
      name: 'Generate HTML preview',
      exact: true,
    })
    const source = review.getByRole('textbox', {
      name: 'HTML source',
      exact: true,
    })
    const advanced = review.getByRole('button', {
      name: 'Advanced element settings',
      exact: true,
    })

    async function generateHtml(
      selector: { fieldKey: string } | { fieldPath: (string | number)[] },
      schemaVersion: 1 | 2,
      html: string,
      mapped = false,
    ) {
      const reply = page.waitForResponse(
        (response) =>
          response.url() === previewUrl &&
          response.request().method() === 'POST',
      )
      await generate.click()

      const response = await reply
      expect(response.status()).toBe(200)
      expect(response.request().postDataJSON()).toEqual({
        entryVersion: 1,
        ...selector,
        renderer: mapped ? mappedRenderer : defaultRenderer,
      })
      expect(await response.json()).toMatchObject({
        collectionId: saved.collectionId,
        collectionVersion: 1,
        structId: saved.structId,
        structVersion: 1,
        entryId: saved.entryId,
        entryVersion: 1,
        fieldKey: 'fieldKey' in selector ? selector.fieldKey : 'body',
        ...('fieldPath' in selector ? { fieldPath: selector.fieldPath } : {}),
        schemaVersion,
        astVersion: schemaVersion,
        rendererSchemaVersion: 1,
        rendererSha256: mapped ? mappedHash : defaultHash,
        consumerContract: mapped ? 'besh.fixed-heading-id.v1' : null,
        html,
      })
      await expect(source).toHaveValue(html)
      await expect(source).toHaveAttribute('readonly', '')
      const frame = review.locator('iframe').contentFrame()
      if (schemaVersion === 1) {
        await expect(frame.locator('p')).toHaveText(
          'Summary <em>literal</em> & ไทย',
        )
      } else if ('fieldPath' in selector) {
        await expect(frame.locator('p')).toHaveText(
          'Second nested <p>literal</p> & ไทย',
        )
      } else {
        await expect(frame.locator('h1')).toHaveText('Saved heading ไทย')
        await expect(frame.locator('p')).toHaveText(
          '<script>literal</script> & text Open article',
        )
      }

      await expect(
        review.getByRole('button', { name: 'Copy HTML', exact: true }),
      ).toBeVisible()
    }

    await expect(advanced).toHaveAttribute('aria-expanded', 'false')
    await generateHtml({ fieldKey: 'body' }, 2, defaultHtml)
    await record(
      'Default saved formatted HTML',
      'Real generation escapes literal markup and HTTPS query separators without changing the saved entry.',
    )

    const selector = review.getByRole('combobox', {
      name: 'Rich-text field',
      exact: true,
    })
    await selector.click()
    await page.getByRole('option', { name: 'Summary', exact: true }).click()
    await expect(source).toHaveCount(0)
    expect(writes).toHaveLength(1)
    await generateHtml({ fieldKey: 'summary' }, 1, summaryHtml)
    await record(
      'Selected literal Summary HTML',
      'The labelled version-one field keeps surrounding whitespace and authored markup as literal text.',
    )

    await selector.click()
    await page
      .getByRole('option', {
        name: 'Details · Sections · Item 2 · Body',
        exact: true,
      })
      .click()
    await expect(source).toHaveCount(0)
    expect(writes).toHaveLength(2)
    await generateHtml(
      { fieldPath: ['details', 'sections', 1, 'body'] },
      2,
      nestedHtml,
    )
    await record(
      'Selected second nested field HTML',
      'The second saved array item uses its exact frozen typed path and retains literal paragraph markup.',
    )

    await selector.click()
    await page.getByRole('option', { name: 'Body', exact: true }).click()
    await expect(source).toHaveCount(0)
    await advanced.click()
    await review.getByRole('combobox', { name: 'Element', exact: true }).click()
    await page
      .getByRole('option', { name: 'Heading 1 (h1)', exact: true })
      .click()
    await review.getByLabel('CSS classes', { exact: true }).fill(classNames)
    await review
      .getByLabel('Title attribute', { exact: true })
      .fill(titleAttribute)
    await review
      .getByLabel('Accessibility label', { exact: true })
      .fill(accessibilityLabel)
    await review
      .getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      })
      .check()
    expect(writes).toHaveLength(3)
    await generateHtml({ fieldKey: 'body' }, 2, mappedHtml, true)

    async function retained(language: (typeof languages)[number]) {
      const panel = page.getByRole('region', {
        name: language.review,
        exact: true,
      })
      await expect(panel).toBeVisible()
      await expect(
        panel.getByRole('button', { name: language.advanced, exact: true }),
      ).toHaveAttribute('aria-expanded', 'true')
      await expect(
        panel.getByRole('button', { name: language.generate, exact: true }),
      ).toBeEnabled()
      await expect(
        panel.getByLabel(language.classes, { exact: true }),
      ).toHaveValue(classNames)
      await expect(
        panel.getByLabel(language.title, { exact: true }),
      ).toHaveValue(titleAttribute)
      await expect(
        panel.getByLabel(language.aria, { exact: true }),
      ).toHaveValue(accessibilityLabel)
      await expect(
        panel.getByRole('checkbox', { name: language.fixed, exact: true }),
      ).toBeChecked()
      await expect(
        panel.getByRole('textbox', { name: language.source, exact: true }),
      ).toHaveValue(mappedHtml)
      await expect(
        panel.getByRole('button', { name: language.copy, exact: true }),
      ).toBeVisible()
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
        saved.title,
      )
      await expect(panel.locator('iframe')).toHaveAttribute('sandbox', '')
      expect(writes).toHaveLength(4)

      return panel
    }

    for (const language of languages) {
      await chooseManagementLanguage(page, language.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)
      await retained(language)
      await record(
        `Reviewed heading HTML ${language.code}`,
        'Translated review controls preserve literal classes, quoted title, accessibility label, fixed identifier and exact generated source without automatic preview or save requests.',
      )
    }

    async function phone(
      language: (typeof languages)[number],
      mode: 'light' | 'dark',
      option: string,
      warning: string,
    ) {
      await chooseManagementLanguage(page, language.choice)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('#appearance').click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode)

      const panel = await retained(language)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)

      const classesInput = panel.getByLabel(language.classes, { exact: true })
      const trustedWarning = panel.getByText(warning, { exact: false })
      await expect(trustedWarning).toBeVisible()
      for (const control of [
        classesInput,
        panel.getByLabel(language.title, { exact: true }),
        panel.getByRole('checkbox', { name: language.fixed, exact: true }),
        trustedWarning,
      ]) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }

      // Settings and source occupy separate scroll positions on a phone.
      await classesInput.evaluate((element) =>
        element.scrollIntoView({ block: 'start' }),
      )
      await page.evaluate(() => window.scrollBy(0, -100))
      await classesInput.click()
      await expect(classesInput).toBeFocused()
      expect(writes).toHaveLength(4)
      await record(
        `Phone ${mode} reviewed settings ${language.code}`,
        'Focused literal CSS classes, quoted title, fixed checkbox and trusted consumer guidance remain contained in the translated native phone form.',
        { fullPage: false },
      )

      const visibleSource = panel.getByRole('textbox', {
        name: language.source,
        exact: true,
      })
      await visibleSource.scrollIntoViewIfNeeded()
      await visibleSource.click()
      await expect(visibleSource).toBeFocused()
      await expect(visibleSource).toHaveAttribute('readonly', '')
      await expect(
        panel.getByRole('button', { name: language.copy, exact: true }),
      ).toBeInViewport()
      const geometry = await visibleSource.evaluate((element) => ({
        width: element.clientWidth,
        scroll: element.scrollWidth,
        font: Number.parseFloat(getComputedStyle(element).fontSize),
      }))
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1)
      expect(geometry.font).toBeGreaterThanOrEqual(16)

      for (const name of [
        language.advanced,
        language.generate,
        language.copy,
        language.close,
      ]) {
        const control = panel.getByRole('button', { name, exact: true })
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }

      await record(
        `Phone ${mode} reviewed HTML source ${language.code}`,
        'Focused exact read-only source and copy controls remain readable at 390 pixels; theme and language preserve settings without automatic preview or save requests.',
        { fullPage: false },
      )
      expect(writes).toHaveLength(4)
    }

    await phone(
      languages[1],
      'light',
      'สว่าง',
      'Besh ไม่รัน x-data หรือโหลด Alpine.js ใช้ตัวระบุแบบตายตัวนี้เฉพาะกับแอปที่นำไปใช้ซึ่งคุณตรวจสอบและเชื่อถือแล้ว',
    )
    await phone(
      languages[3],
      'dark',
      'Тёмная',
      'Besh не выполняет x-data и не загружает Alpine.js. Используйте этот фиксированный идентификатор только в проверенном вами доверенном приложении-потребителе.',
    )
    await page.setViewportSize(viewport ?? { width: 1440, height: 1000 })
    await chooseManagementLanguage(page, 'English')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'Light', exact: true }).click()
    await retained(languages[0])
    expect(await savedState()).toEqual(before)

    await review.getByLabel('CSS classes', { exact: true }).fill('9bad:name')
    await expect(generate).toBeDisabled()
    await expect(review.getByRole('alert')).toHaveText(
      'Check class names: up to 8 names, each 1 to 64 ASCII characters.',
    )
    await expect(source).toHaveCount(0)
    expect(writes).toHaveLength(4)
    await record(
      'Rejected invalid heading class names',
      'Invalid CSS tokens clear old output and disable generation without sending a preview request or changing saved content.',
    )

    await review.getByLabel('CSS classes', { exact: true }).fill(classNames)
    await expect(generate).toBeEnabled()
    await generateHtml({ fieldKey: 'body' }, 2, mappedHtml, true)
    expect(writes).toHaveLength(5)
    await record(
      'Corrected heading settings regenerated',
      'Correction preserves the reviewed literal attributes and fixed checkbox; explicit generation restores the same exact source.',
    )

    await review
      .getByRole('button', { name: 'Close HTML preview', exact: true })
      .click()
    await expect(review).toHaveCount(0)
    await preview.click()
    await expect(advanced).toHaveAttribute('aria-expanded', 'false')
    await expect(source).toHaveCount(0)
    await expect(
      review.getByRole('button', { name: 'Copy HTML', exact: true }),
    ).toHaveCount(0)
    expect(writes).toHaveLength(5)
    expect(writes.every((write) => write === 'POST ' + previewUrl)).toBe(true)
    expect(await savedState()).toEqual(before)
    await record(
      'Reopened HTML review collapsed',
      'Closing clears the generated result; reopening shows collapsed settings and requires new explicit generation without saving content.',
    )
    expect(count).toBe(richTextHtmlPreviewCount)
    expect(writes).toHaveLength(5)
    expect(errors).toEqual([])

    return count
  } finally {
    page.off('pageerror', observeError)
    page.off('request', observeWrite)
    if (viewport && !page.isClosed()) await page.setViewportSize(viewport)
  }
}
