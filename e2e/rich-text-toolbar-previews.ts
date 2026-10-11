import { expect, type Page, type Request } from '@playwright/test'
import { chooseManagementLanguage } from './management-locale-previews'
import type { PreviewCapture } from './preview-fixture'

export const richTextToolbarCaptureCount = 5

export async function richTextToolbarPreviews({
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
      name: 'Compact article model',
      fields: [
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
        name: 'Toolbar articles',
        structId: model.id,
        structVersion: model.version,
      },
    },
  )
  expect(collectionResponse.status()).toBe(200)

  const collection = await collectionResponse.json()
  const table = {
    type: 'table',
    children: [
      {
        type: 'tableRow',
        children: [
          {
            type: 'tableCell',
            header: true,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Plan', marks: [] }],
              },
            ],
          },
          {
            type: 'tableCell',
            header: true,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Price', marks: [] }],
              },
            ],
          },
        ],
      },
      {
        type: 'tableRow',
        children: [
          {
            type: 'tableCell',
            header: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Starter', marks: [] }],
              },
            ],
          },
          {
            type: 'tableCell',
            header: false,
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: '$9', marks: [] }],
              },
            ],
          },
        ],
      },
    ],
  }
  const initialBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Hello teams', marks: [] }],
      },
      table,
    ],
  }
  const entries = origin + '/api/collections/' + collection.id + '/entries'
  const entryResponse = await page.request.post(entries, {
    headers,
    data: { data: { body: initialBody } },
  })
  expect(entryResponse.status()).toBe(200)

  const entry = await entryResponse.json()
  expect(entry.version).toBe(1)
  expect(entry.data).toEqual({ body: initialBody })
  const entryUrl = entries + '/' + entry.id
  const initialRead = await page.request.get(entryUrl, { headers })
  expect(initialRead.status()).toBe(200)
  expect((await initialRead.json()).data).toEqual({ body: initialBody })

  let entryWrites = 0
  const observeWrite = (request: Request) => {
    if (request.url() === entryUrl && request.method() === 'PUT') entryWrites++
  }
  page.on('request', observeWrite)

  const originalViewport = page.viewportSize()
  let captures = 0

  async function record(title: string, detail: string) {
    await page.locator('.formatted-text-toolbar').scrollIntoViewIfNeeded()
    await capture('Rich text toolbar', title, detail, { fullPage: false })
    captures++
  }

  try {
    await page.goto(origin)
    await page.getByLabel('Workspace token', { exact: true }).fill(owner)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'Light', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Toolbar articles', exact: true })
      .click()
    await page.getByRole('button', { name: new RegExp(entry.id) }).click()
    await page.getByRole('button', { name: 'Edit entry', exact: true }).click()

    const editor = page.getByRole('textbox', { name: 'Body', exact: true })
    const paragraph = editor.locator(':scope > p').first()
    const bold = page.getByRole('button', { name: 'Bold', exact: true })
    const style = page.getByRole('combobox', {
      name: 'Body block style',
      exact: true,
    })
    const toolbar = page.getByRole('toolbar', {
      name: 'Body formatting',
      exact: true,
    })

    await expect(toolbar.getByRole('group')).toHaveCount(3)
    for (const name of ['Text style', 'Insert', 'Undo and redo'])
      await expect(
        toolbar.getByRole('group', { name, exact: true }),
      ).toBeVisible()
    await expect(
      toolbar.getByRole('group', { name: 'Lists', exact: true }),
    ).toHaveCount(0)
    await expect(
      toolbar.getByRole('group', { name: 'Table tools', exact: true }),
    ).toHaveCount(0)

    await style.focus()
    await page.keyboard.press('Tab')
    await expect(editor).toBeFocused()

    async function selectHello() {
      await paragraph.click()
      await editor.press('Home')
      await expect
        .poll(() =>
          paragraph.evaluate(async (element) => {
            function atFirstText() {
              const selection = window.getSelection()
              const first = document
                .createTreeWalker(element, NodeFilter.SHOW_TEXT)
                .nextNode()

              return Boolean(
                first &&
                document.activeElement ===
                  element.closest('.formatted-text-surface') &&
                selection?.isCollapsed &&
                selection.anchorNode === first &&
                selection.focusNode === first &&
                selection.anchorOffset === 0 &&
                selection.focusOffset === 0,
              )
            }

            if (!atFirstText()) return false

            // History paint and asynchronous native selection must both settle.
            for (let frame = 0; frame < 2; frame++) {
              await new Promise<void>((done) =>
                requestAnimationFrame(() => done()),
              )
              if (!atFirstText()) return false
            }

            return true
          }),
        )
        .toBe(true)

      for (let index = 0; index < 5; index++) {
        await editor.press('Shift+ArrowRight')
        await expect
          .poll(() => page.evaluate(() => window.getSelection()?.toString()))
          .toBe('Hello'.slice(0, index + 1))
      }

      await expect
        .poll(() => page.evaluate(() => window.getSelection()?.toString()))
        .toBe('Hello')
    }

    await selectHello()
    await bold.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Bold')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Hello')

    await editor.press('Alt+F10')
    await expect(style).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(bold).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(editor).toBeFocused()
    await expect(paragraph.locator('strong')).toHaveText('Hello')
    await expect(paragraph).toHaveText('Hello teams')
    expect(
      await paragraph
        .locator('strong')
        .evaluate((element) => element.nextSibling?.textContent),
    ).toBe(' teams')

    await editor.press('ControlOrMeta+z')
    await expect(paragraph.locator('strong')).toHaveCount(0)
    await expect(paragraph).toHaveText('Hello teams')
    await editor.press('ControlOrMeta+Shift+z')
    await expect(paragraph.locator('strong')).toHaveText('Hello')

    await selectHello()
    await page.getByRole('button', { name: 'Italic', exact: true }).click()
    await expect(editor).toBeFocused()
    await expect(paragraph.locator('strong')).toHaveText('Hello')
    await expect(paragraph.locator('strong')).toHaveCSS('font-style', 'italic')
    await expect(paragraph).toHaveText('Hello teams')
    await expect(bold).toHaveCSS('width', '36px')
    await expect(bold).toHaveCSS('height', '36px')

    await record(
      'Compact formatted selection desktop light',
      'Keyboard Bold, native Undo/Redo and mouse Italic apply only to Hello; the table and plain teams tail retain their authored content.',
    )

    await bold.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Bold')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('Hello')
    await editor.press('Alt+F10')
    await page.keyboard.press('End')
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Home')
    await expect(style).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(bold).toBeFocused()
    await expect(page.getByRole('tooltip')).toHaveText('Bold')

    await record(
      'Keyboard focused formatting tooltip',
      'Alt+F10 returns to the toolbar, Home selects the visible style selector and ArrowRight focuses Bold; its hint accompanies keyboard focus without modifying selection.',
    )
    await page.keyboard.press('Escape')
    await expect(editor).toBeFocused()

    const expectedBody = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Hello', marks: ['bold', 'italic'] },
            { type: 'text', text: ' teams', marks: [] },
          ],
        },
        table,
      ],
    }
    const savedReply = page.waitForResponse(
      (response) =>
        response.url() === entryUrl && response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save entry', exact: true }).click()
    const savedResponse = await savedReply
    expect(savedResponse.status()).toBe(200)
    expect(savedResponse.request().postDataJSON()).toEqual({
      version: 1,
      data: { body: expectedBody },
    })

    const saved = await savedResponse.json()
    expect(saved.version).toBe(2)
    expect(saved.data).toEqual({ body: expectedBody })
    const savedRead = await page.request.get(entryUrl, { headers })
    expect(savedRead.status()).toBe(200)
    expect(await savedRead.json()).toEqual(saved)

    await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await editor.locator('td').first().click()
    await expect(
      page.getByRole('button', { name: 'Add row', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Add column', exact: true }),
    ).toBeEnabled()
    await expect(style).toBeDisabled()
    await expect(
      toolbar.getByRole('group', { name: 'Table tools', exact: true }),
    ).toBeVisible()
    await expect(editor.locator('th')).toHaveText(['Plan', 'Price'])
    await expect(editor.locator('td')).toHaveText(['Starter', '$9'])

    await record(
      'Selected table cell tools desktop dark',
      'The saved two-by-two table keeps its header cells and literal prices; selecting Starter enables existing table tools while block conversion is disabled.',
    )

    for (const phone of [
      {
        code: 'th',
        choice: 'ไทย',
        theme: 'light',
        appearance: 'สว่าง',
        bold: 'ตัวหนา',
        title: 'Thai light phone focused toolbar',
      },
      {
        code: 'ru',
        choice: 'Русский',
        theme: 'dark',
        appearance: 'Тёмная',
        bold: 'Жирный',
        title: 'Russian dark phone focused toolbar',
      },
    ]) {
      await chooseManagementLanguage(page, phone.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', phone.code)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('#appearance').click()
      await page
        .getByRole('option', { name: phone.appearance, exact: true })
        .click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        phone.theme,
      )
      await selectHello()
      await page.locator('.formatted-text-toolbar').scrollIntoViewIfNeeded()
      await editor.press('Alt+F10')
      await page.keyboard.press('Home')
      await expect(
        page.locator('.formatted-text-toolbar .select-trigger'),
      ).toBeFocused()
      await page.keyboard.press('ArrowRight')

      const focused = page.getByRole('button', {
        name: phone.bold,
        exact: true,
      })
      await expect(focused).toBeFocused()
      await expect(focused).toBeInViewport()
      await expect(page.getByRole('tooltip')).toHaveText(phone.bold)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)

      const bounds = await page.locator('.formatted-text-toolbar').boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)

      for (const control of await page
        .locator('.formatted-text-toolbar button')
        .all()) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          bounds!.x + bounds!.width + 1,
        )
        expect(box!.y).toBeGreaterThanOrEqual(bounds!.y)
        expect(box!.y + box!.height).toBeLessThanOrEqual(
          bounds!.y + bounds!.height + 1,
        )
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(390)
      }

      await record(
        phone.title,
        'The 390-pixel toolbar wraps within its panel with 44-pixel controls, visible keyboard focus and a translated Bold tooltip; authored text and table content remain unchanged.',
      )
      await page.keyboard.press('Escape')
      await expect(editor).toBeFocused()
    }

    const finalRead = await page.request.get(entryUrl, { headers })
    expect(finalRead.status()).toBe(200)
    expect(await finalRead.json()).toEqual(saved)
    expect(entryWrites).toBe(1)
    expect(captures).toBe(richTextToolbarCaptureCount)

    return captures
  } finally {
    page.off('request', observeWrite)
    if (originalViewport) await page.setViewportSize(originalViewport)
  }
}
