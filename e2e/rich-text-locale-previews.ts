import { expect, type Page, type Request } from '@playwright/test'
import { chooseManagementLanguage } from './management-locale-previews'
import type { PreviewCapture } from './preview-fixture'

const richTextLanguages = [
  [
    'en',
    'English',
    'Content',
    'Body formatting',
    'Body block style',
    'Heading 1',
    'Bold',
    'Undo',
    'Redo',
    'Save entry',
  ],
  [
    'th',
    'ไทย',
    'เนื้อหา',
    'Body · การจัดรูปแบบ',
    'Body · รูปแบบบล็อก',
    'หัวข้อ 1',
    'ตัวหนา',
    'เลิกทำ',
    'ทำซ้ำ',
    'บันทึกรายการ',
  ],
  [
    'zh',
    '中文',
    '内容',
    'Body 格式设置',
    'Body 块样式',
    '标题 1',
    '粗体',
    '撤销',
    '重做',
    '保存条目',
  ],
  [
    'ru',
    'Русский',
    'Контент',
    'Body · Форматирование',
    'Body · Стиль блока',
    'Заголовок 1',
    'Жирный',
    'Отменить',
    'Повторить',
    'Сохранить запись',
  ],
  [
    'ja',
    '日本語',
    'コンテンツ',
    'Body の書式設定',
    'Body のブロックスタイル',
    '見出し 1',
    '太字',
    '元に戻す',
    'やり直す',
    '項目を保存',
  ],
  [
    'ko',
    '한국어',
    '콘텐츠',
    'Body 서식 지정',
    'Body 블록 스타일',
    '제목 1',
    '굵게',
    '실행 취소',
    '다시 실행',
    '항목 저장',
  ],
  [
    'pt',
    'Português',
    'Conteúdo',
    'Body · Formatação',
    'Body · Estilo do bloco',
    'Título 1',
    'Negrito',
    'Desfazer',
    'Refazer',
    'Salvar entrada',
  ],
] as const

const originalHeading = '<script>ไทย</script> & literal title'
const changedHeading = '<script>ไทย</script> & edited title'
const originalTitle = '  <h1>ไทย & literal title</h1>  '
const changedTitle = '  <script>ชื่อเรื่อง</script> & draft  '
const codeText =
  "const title = '<script>literal</script> & ไทย'\n\tconst column = '" +
  'literal_column_'.repeat(12) +
  "'\nreturn title + column"

const text = (value: string, marks: string[] = []) => ({
  type: 'text',
  text: value,
  marks,
})

const paragraph = (value: string) => ({
  type: 'paragraph',
  children: [text(value)],
})

const fixtureBody = {
  type: 'document',
  astVersion: 2,
  children: [
    {
      type: 'heading',
      level: 1,
      children: [text(originalHeading, ['bold'])],
    },
    {
      type: 'paragraph',
      children: [
        text('Read ', ['italic', 'bold']),
        {
          type: 'link',
          url: 'https://example.com/guide?language=literal',
          children: [text('Guide ไทย', ['underline'])],
        },
        text(' without navigation.'),
      ],
    },
    {
      type: 'list',
      ordered: true,
      start: 20,
      children: [
        { type: 'listItem', children: [paragraph('Review literal columns')] },
        { type: 'listItem', children: [paragraph('Keep authored values')] },
      ],
    },
    {
      type: 'table',
      children: [
        {
          type: 'tableRow',
          children: ['name', 'price', 'available', 'literal_column'].map(
            (value) => ({
              type: 'tableCell',
              header: true,
              children: [paragraph(value)],
            }),
          ),
        },
        {
          type: 'tableRow',
          children: ['Tea ไทย', '12.50', 'false', '<em>literal</em>'].map(
            (value) => ({
              type: 'tableCell',
              header: false,
              children: [paragraph(value)],
            }),
          ),
        },
      ],
    },
    { type: 'code', language: 'javascript', text: codeText },
  ],
}

const changedBody = {
  ...fixtureBody,
  children: [
    {
      type: 'heading',
      level: 1,
      children: [text(changedHeading, ['bold'])],
    },
    ...fixtureBody.children.slice(1),
  ],
}

async function contained(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
}

async function assertLiteralBlocks(page: Page) {
  const editor = page.getByRole('textbox', { name: 'Body', exact: true })

  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    changedTitle,
  )
  await expect(editor.locator('h1')).toHaveText(changedHeading)
  await expect(editor.locator('script')).toHaveCount(0)
  await expect(editor.locator('a')).toHaveAttribute(
    'href',
    'https://example.com/guide?language=literal',
  )
  await expect(editor.locator('a')).toHaveText('Guide ไทย')
  await expect(editor.locator('ol')).toHaveAttribute('start', '20')
  await expect(editor.locator('ol li')).toHaveText([
    'Review literal columns',
    'Keep authored values',
  ])
  await expect(editor.locator('th')).toHaveText([
    'name',
    'price',
    'available',
    'literal_column',
  ])
  await expect(editor.locator('td')).toHaveText([
    'Tea ไทย',
    '12.50',
    'false',
    '<em>literal</em>',
  ])
  expect(await editor.locator('.formatted-code-block').innerText()).toBe(
    codeText,
  )
}

async function localScroll(page: Page) {
  const editor = page.getByRole('textbox', { name: 'Body', exact: true })

  for (const selector of ['.formatted-table-scroll', '.formatted-code-block']) {
    const region = editor.locator(selector)
    const geometry = await region.evaluate((element) => {
      const bounds = element.getBoundingClientRect()

      return {
        left: bounds.left,
        right: bounds.right,
        client: element.clientWidth,
        content: element.scrollWidth,
        overflow: getComputedStyle(element).overflowX,
      }
    })

    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(390)
    expect(geometry.content).toBeGreaterThan(geometry.client)
    expect(geometry.overflow).toBe('auto')

    await region.evaluate((element) => {
      element.scrollLeft = 60
    })
    expect(
      await region.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0)
  }

  await contained(page)
}

export async function richTextLocalePreviews({
  page,
  owner,
  apiOrigin: origin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}) {
  const headers = { origin, authorization: 'Bearer ' + owner }
  const modelResponse = await page.request.post(origin + '/api/structs', {
    headers,
    data: {
      name: 'Literal article model ไทย',
      fields: [
        {
          key: 'title',
          label: 'Title',
          required: true,
          schema: { type: 'text' },
        },
        {
          key: 'body',
          label: 'Body',
          required: true,
          schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
        },
      ],
    },
  })
  expect(modelResponse.status()).toBe(200)

  const model = await modelResponse.json()
  const collectionResponse = await page.request.post(
    origin + '/api/collections',
    {
      headers,
      data: {
        name: 'Literal articles ไทย',
        structId: model.id,
        structVersion: 1,
      },
    },
  )
  expect(collectionResponse.status()).toBe(200)

  const collection = await collectionResponse.json()
  const entries = origin + '/api/collections/' + collection.id + '/entries'
  const entryResponse = await page.request.post(entries, {
    headers,
    data: { data: { title: originalTitle, body: fixtureBody } },
  })
  expect(entryResponse.status()).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.data).toEqual({ title: originalTitle, body: fixtureBody })

  await page.goto(origin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Literal articles ไทย', exact: true })
    .click()
  await page.locator('.content-entry-row').filter({ hasText: entry.id }).click()
  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()

  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  const heading = editor.locator('h1')
  await expect(heading).toHaveText(originalHeading)
  await expect(editor.locator('table')).toBeVisible()
  await capture(
    'Rich text',
    'Imported formatted article',
    'A real private entry imports literal Thai/markup text, an ordered list starting at twenty, a four-column table, a safe link and literal JavaScript without executing content.',
  )

  await page.getByLabel('Title', { exact: true }).fill(changedTitle)
  await heading.click()
  await editor.press('Home')
  await editor.press('Shift+End')
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe(originalHeading)
  await page.keyboard.insertText(changedHeading)
  await expect(heading).toHaveText(changedHeading)
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled()

  const requests: string[] = []
  const observe = (request: Request) => {
    const url = new URL(request.url())
    if (
      url.origin === origin &&
      /^\/api\/(collections|structs|flows|data-sources|database-connections)(\/|$)/.test(
        url.pathname,
      )
    )
      requests.push(request.method() + ' ' + url.pathname)
  }

  page.on('request', observe)

  try {
    for (const [
      language,
      label,
      content,
      formatting,
      style,
      headingOne,
      bold,
      undo,
      redo,
      save,
    ] of richTextLanguages) {
      await chooseManagementLanguage(page, label)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(
        page.getByRole('heading', { name: content, exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('toolbar', { name: formatting, exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('combobox', { name: style, exact: true }),
      ).toHaveText(headingOne)
      await expect(
        page.getByRole('button', { name: bold, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByRole('button', { name: save, exact: true }),
      ).toBeEnabled()
      await assertLiteralBlocks(page)

      // Undo/Redo after each switch proves the native editor history survives.
      await page.getByRole('button', { name: undo, exact: true }).click()
      await expect(heading).toHaveText(originalHeading)
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
        changedTitle,
      )
      await page.getByRole('button', { name: redo, exact: true }).click()
      await assertLiteralBlocks(page)
      expect(requests).toEqual([])

      await capture(
        'Rich text',
        `Dirty formatted article ${language}`,
        'Trusted controls change language while the same authored title, rich AST and native Undo/Redo history remain dirty without resource reads or writes.',
      )
    }

    await page.setViewportSize({ width: 390, height: 844 })
    for (const phone of [
      {
        label: 'ไทย',
        language: 'th',
        appearance: 'รูปแบบการแสดงผล',
        theme: 'สว่าง',
        name: 'Thai light',
        save: 'บันทึกรายการ',
        codeLanguage: 'Body · ภาษาโค้ด',
      },
      {
        label: 'Русский',
        language: 'ru',
        appearance: 'Оформление',
        theme: 'Тёмная',
        name: 'Russian dark',
        save: 'Сохранить запись',
        codeLanguage: 'Body · Язык кода',
      },
    ]) {
      await chooseManagementLanguage(page, phone.label)
      await expect(page.locator('html')).toHaveAttribute('lang', phone.language)
      await page
        .getByRole('combobox', { name: phone.appearance, exact: true })
        .click()
      await page.getByRole('option', { name: phone.theme, exact: true }).click()

      const save = page.getByRole('button', { name: phone.save, exact: true })
      await save.focus()
      await expect(save).toBeFocused()
      const bounds = await save.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      await contained(page)
      await capture(
        'Rich text',
        `Phone ${phone.name} formatted controls`,
        'A native 390-pixel viewport contains translated actions and a focused touch-sized Save button without changing authored content.',
        { fullPage: false },
      )

      await editor.locator('.formatted-code-block').click()
      await expect(
        page.getByRole('combobox', { name: phone.codeLanguage, exact: true }),
      ).toHaveText('JavaScript')
      await localScroll(page)
      await assertLiteralBlocks(page)
      await editor.locator('.formatted-table-scroll').scrollIntoViewIfNeeded()
      await capture(
        'Rich text',
        `Phone ${phone.name} table and code`,
        'Wide table columns and literal code scroll inside their own regions; the document body stays within 390 pixels in the selected appearance.',
        { fullPage: false },
      )
      expect(requests).toEqual([])
    }

    await page.setViewportSize({ width: 1440, height: 1000 })
    await chooseManagementLanguage(page, 'ไทย')
    await assertLiteralBlocks(page)
    expect(requests).toEqual([])
  } finally {
    page.off('request', observe)
  }

  const detail = entries + '/' + entry.id
  const savedReply = page.waitForResponse(
    (response) =>
      response.url() === detail && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'บันทึกรายการ', exact: true }).click()
  const savedResponse = await savedReply
  expect(savedResponse.status()).toBe(200)
  expect(savedResponse.request().postDataJSON()).toEqual({
    version: 1,
    data: { title: changedTitle, body: changedBody },
  })
  const saved = await savedResponse.json()
  expect(saved.version).toBe(2)
  expect(saved.data).toEqual({ title: changedTitle, body: changedBody })

  const readResponse = await page.request.get(detail, { headers })
  expect(readResponse.status()).toBe(200)
  const read = await readResponse.json()
  expect(read.version).toBe(2)
  expect(read.data).toEqual({ title: changedTitle, body: changedBody })
  await expect(page.locator('.statusbar [role="status"]')).toHaveText(
    'บันทึกรายการแล้ว',
  )
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveCSS('opacity', '1')
  await assertLiteralBlocks(page)
  await capture(
    'Rich text',
    'Saved exact multilingual article',
    'The actual versioned browser PUT and public GET retain the independently specified dirty heading/title and every untouched list, table, link, mark order and code byte.',
  )
}
