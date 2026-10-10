import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'

export async function richTextBlockPreviews({
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
      name: 'Article blocks',
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
        name: 'Article blocks',
        structId: model.id,
        structVersion: 1,
      },
    },
  )
  expect(collectionResponse.status()).toBe(200)

  const collection = await collectionResponse.json()
  const entries = origin + '/api/collections/' + collection.id + '/entries'

  await page.goto(origin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Article blocks', exact: true })
    .click()
  await page.getByRole('button', { name: 'New entry', exact: true }).click()

  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  await editor.click()
  await expect(
    page.getByRole('button', { name: 'Insert table', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Insert table', exact: true }).click()
  await expect(editor.locator('table')).toHaveCount(1)
  await expect(editor.locator('tr')).toHaveCount(2)
  await expect(editor.locator('th')).toHaveCount(2)
  await expect(editor.locator('td')).toHaveCount(2)

  const cells = editor.locator('th, td')
  const values = ['Plan', 'Monthly price', 'Starter', '<script>$9</script>']

  for (let index = 0; index < values.length; index++) {
    await cells.nth(index).click()
    await page.keyboard.insertText(values[index]!)
    await expect(cells.nth(index)).toHaveText(values[index]!)
  }

  await expect(editor.locator('script')).toHaveCount(0)
  await capture(
    'Formatted rich text',
    'Typed two-by-two table',
    'Two header cells and literal table text remain editable without executing markup.',
  )

  const reply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const response = await reply
  expect(response.status()).toBe(200)

  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
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
                    children: [
                      { type: 'text', text: 'Monthly price', marks: [] },
                    ],
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
                    children: [
                      {
                        type: 'text',
                        text: '<script>$9</script>',
                        marks: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  expect(response.request().postDataJSON()).toEqual({ data: { body } })
  const saved = await response.json()
  expect(saved.data).toEqual({ body })
  const read = await page.request.get(entries + '/' + saved.id, { headers })
  expect(read.status()).toBe(200)
  expect((await read.json()).data).toEqual({ body })

  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Formatted rich text',
    'Saved table content',
    'The private saved entry retains the exact reviewed table headers and cell text.',
  )

  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await cells.nth(3).click()
  await expect(
    page.getByRole('button', { name: 'Add row', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add row', exact: true }).click()
  await expect(editor.locator('tr')).toHaveCount(3)
  await cells.nth(4).click()
  await page.keyboard.insertText('Team')
  await cells.nth(5).click()
  await page.keyboard.insertText('$29')
  await page.getByRole('button', { name: 'Add column', exact: true }).click()
  await expect(editor.locator('tr').first().locator('th, td')).toHaveCount(3)

  for (const [index, text] of [
    [2, 'Cycle'],
    [5, 'Monthly'],
    [8, 'Annual'],
  ] as const) {
    await cells.nth(index).click()
    await page.keyboard.insertText(text)
    await expect(cells.nth(index)).toHaveText(text)
  }

  await capture(
    'Formatted rich text',
    'Expanded three-by-three table',
    'Explicit row and column actions preserve existing content and header flags.',
  )

  const expandedBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'table',
        children: [
          {
            type: 'tableRow',
            children: [
              ...body.children[0]!.children[0]!.children,
              {
                type: 'tableCell',
                header: true,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Cycle', marks: [] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            children: [
              ...body.children[0]!.children[1]!.children,
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Monthly', marks: [] }],
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
                    children: [{ type: 'text', text: 'Team', marks: [] }],
                  },
                ],
              },
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: '$29', marks: [] }],
                  },
                ],
              },
              {
                type: 'tableCell',
                header: false,
                children: [
                  {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'Annual', marks: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  const detail = entries + '/' + saved.id
  const update = page.waitForResponse(
    (response) =>
      response.url() === detail && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  const updated = await update
  expect(updated.status()).toBe(200)
  expect(updated.request().postDataJSON()).toEqual({
    version: 1,
    data: { body: expandedBody },
  })
  expect((await updated.json()).data).toEqual({ body: expandedBody })
  expect(
    (await (await page.request.get(detail, { headers })).json()).data,
  ).toEqual({
    body: expandedBody,
  })

  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await cells.nth(8).click()
  await expect(
    page.getByRole('button', { name: 'Remove row', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Remove row', exact: true }).click()
  await expect(editor.locator('tr')).toHaveCount(2)
  await cells.nth(5).click()
  await page.getByRole('button', { name: 'Remove column', exact: true }).click()
  await expect(editor.locator('tr').first().locator('th, td')).toHaveCount(2)
  await expect(cells).toHaveText(values)

  await capture(
    'Formatted rich text',
    'Removed table dimensions',
    'Removing the last row and column restores the original two-by-two table.',
  )

  const reducedReply = page.waitForResponse(
    (response) =>
      response.url() === detail && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  const reduced = await reducedReply
  expect(reduced.status()).toBe(200)
  expect(reduced.request().postDataJSON()).toEqual({
    version: 2,
    data: { body },
  })
  expect((await reduced.json()).data).toEqual({ body })

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await editor.fill('A calm launch')
  await editor.press('ControlOrMeta+a')
  await page
    .getByRole('combobox', { name: 'Body block style', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Quote', exact: true }),
  ).toBeVisible()
  await page.getByRole('option', { name: 'Quote', exact: true }).click()
  await expect(editor.locator('blockquote > p')).toHaveText('A calm launch')
  await editor.press('ArrowRight')
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection()
        return Boolean(
          selection?.isCollapsed &&
          selection.anchorNode &&
          element.contains(selection.anchorNode) &&
          selection.anchorNode.textContent === 'A calm launch' &&
          selection.anchorOffset === 13,
        )
      }),
    )
    .toBe(true)
  await editor.press('Shift+Enter')
  await page.keyboard.insertText('Keep content literal')
  await expect(editor.locator('blockquote > p > br')).toHaveCount(1)
  await editor.press('Enter')
  await page.keyboard.insertText('Another paragraph')
  await expect(editor.locator('blockquote > p')).toHaveText([
    'A calm launchKeep content literal',
    'Another paragraph',
  ])

  await capture(
    'Formatted rich text',
    'Quote with a line break',
    'A quote keeps two paragraphs and an explicit soft line break as structured content.',
  )

  const quoteReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const quoted = await quoteReply
  expect(quoted.status()).toBe(200)

  const quoteBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'quote',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'A calm launch', marks: [] },
              { type: 'lineBreak' },
              { type: 'text', text: 'Keep content literal', marks: [] },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Another paragraph', marks: [] }],
          },
        ],
      },
    ],
  }
  expect(quoted.request().postDataJSON()).toEqual({
    data: { body: quoteBody },
  })
  const quoteEntry = await quoted.json()
  expect(quoteEntry.data).toEqual({ body: quoteBody })
  expect(
    (
      await (
        await page.request.get(entries + '/' + quoteEntry.id, { headers })
      ).json()
    ).data,
  ).toEqual({ body: quoteBody })

  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Formatted rich text',
    'Saved structured quote',
    'The saved private quote matches its exact public content-entry response.',
  )

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await editor.click()
  await page
    .getByRole('combobox', { name: 'Body block style', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Code block', exact: true }),
  ).toBeVisible()
  await page.getByRole('option', { name: 'Code block', exact: true }).click()

  const codeText =
    "const value = '<script>literal</script>'\n\n  keep spaces\tend"

  await editor.fill(codeText)
  await page
    .getByRole('combobox', { name: 'Body code language', exact: true })
    .click()

  await capture(
    'Formatted rich text',
    'Code language choices',
    'The custom language selector offers the reviewed plain-text and JavaScript choices.',
  )

  await page.getByRole('option', { name: 'JavaScript', exact: true }).click()
  await expect(editor.locator('code[data-language="javascript"]')).toBeVisible()
  await expect(editor.locator('script')).toHaveCount(0)

  const codeReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const coded = await codeReply
  expect(coded.status()).toBe(200)

  const codeBody = {
    type: 'document',
    astVersion: 2,
    children: [{ type: 'code', language: 'javascript', text: codeText }],
  }
  expect(coded.request().postDataJSON()).toEqual({ data: { body: codeBody } })
  const codeEntry = await coded.json()
  expect(codeEntry.data).toEqual({ body: codeBody })
  expect(
    (
      await (
        await page.request.get(entries + '/' + codeEntry.id, { headers })
      ).json()
    ).data,
  ).toEqual({ body: codeBody })

  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Formatted rich text',
    'Saved literal code',
    'Saved code preserves markup, blank lines, spaces and a tab as text without evaluation.',
  )

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await editor.fill('Before the divider')
  await expect(
    page.getByRole('button', { name: 'Insert divider', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Insert divider', exact: true })
    .click()
  await expect(editor.locator('hr')).toHaveCount(1)
  await expect(editor.locator(':scope > p')).toHaveCount(2)
  await editor.locator(':scope > p').last().click()
  await page.keyboard.insertText('After the divider')
  await expect(editor.locator(':scope > p')).toHaveText([
    'Before the divider',
    'After the divider',
  ])

  await capture(
    'Formatted rich text',
    'Explicit divider sequence',
    'The divider sits between two authored paragraphs and leaves the following paragraph editable.',
  )

  const dividerReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const divided = await dividerReply
  expect(divided.status()).toBe(200)

  const dividerBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Before the divider', marks: [] }],
      },
      { type: 'horizontalRule' },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'After the divider', marks: [] }],
      },
    ],
  }
  expect(divided.request().postDataJSON()).toEqual({
    data: { body: dividerBody },
  })
  const dividerEntry = await divided.json()
  expect(dividerEntry.data).toEqual({ body: dividerBody })
  expect(
    (
      await (
        await page.request.get(entries + '/' + dividerEntry.id, { headers })
      ).json()
    ).data,
  ).toEqual({ body: dividerBody })

  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Formatted rich text',
    'Saved divider content',
    'The saved entry retains paragraph, divider and paragraph in the reviewed order.',
  )
}
