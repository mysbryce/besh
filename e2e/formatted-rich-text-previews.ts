import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'

export async function formattedRichTextPreviews({
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
  await page.goto(origin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Content models', exact: true })
    .click()
  await page
    .getByLabel('Model name', { exact: true })
    .fill('Formatted articles')
  await page.getByRole('button', { name: 'Add field', exact: true }).click()
  await page.getByLabel('Field 1 label', { exact: true }).fill('Body')
  await page.getByLabel('Field 1 key', { exact: true }).fill('body')
  await page
    .getByRole('checkbox', { name: 'Field 1 required', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Field 1 type', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Formatted rich text', exact: true })
    .click()

  await capture(
    'Rich text',
    'Formatted content model field',
    'Choose the explicit formatted version-two field using a reviewed content model form without writing a schema.',
  )

  const modelReply = page.waitForResponse(
    (response) =>
      response.url() === origin + '/api/structs' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const modelResponse = await modelReply
  expect(modelResponse.status()).toBe(200)
  const model = await modelResponse.json()
  expect(model.fields).toEqual([
    {
      key: 'body',
      label: 'Body',
      required: true,
      schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
    },
  ])

  const collectionResponse = await page.request.post(
    origin + '/api/collections',
    {
      headers: { origin, authorization: 'Bearer ' + owner },
      data: {
        name: 'Formatted articles',
        structId: model.id,
        structVersion: 1,
      },
    },
  )
  expect(collectionResponse.status()).toBe(200)
  const collection = await collectionResponse.json()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Formatted articles', exact: true })
    .click()
  await page.getByRole('button', { name: 'New entry', exact: true }).click()

  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  await editor.fill('<script>literal</script> & ไทย')
  await editor.press('ControlOrMeta+a')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Body block style', exact: true })
    .click()
  await page.getByRole('option', { name: 'Heading 1', exact: true }).click()
  await expect(editor.locator('h1 strong')).toHaveText(
    '<script>literal</script> & ไทย',
  )
  await expect(editor.locator('script')).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor.locator('h1')).toHaveCount(0)
  await expect(editor.locator('p strong')).toHaveText(
    '<script>literal</script> & ไทย',
  )
  await editor.press('ControlOrMeta+Shift+z')
  await expect(editor.locator('h1 strong')).toHaveText(
    '<script>literal</script> & ไทย',
  )

  await capture(
    'Rich text',
    'Formatted heading and literal text',
    'The native editor formats a heading and emphasis, preserves literal markup and supports Undo/Redo before saving the typed document.',
  )

  const entries = origin + '/api/collections/' + collection.id + '/entries'
  const createReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const createResponse = await createReply
  expect(createResponse.status()).toBe(200)
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'heading',
        level: 1,
        children: [
          {
            type: 'text',
            text: '<script>literal</script> & ไทย',
            marks: ['bold'],
          },
        ],
      },
    ],
  }
  expect(createResponse.request().postDataJSON()).toEqual({ data: { body } })
  const created = await createResponse.json()
  expect(created.data).toEqual({ body })

  const read = await page.request.get(entries + '/' + created.id, {
    headers: { origin, authorization: 'Bearer ' + owner },
  })
  expect(read.status()).toBe(200)
  expect((await read.json()).data).toEqual({ body })

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await editor.fill('Create an API')
  await editor.press('ControlOrMeta+a')
  await page
    .getByRole('combobox', { name: 'Body block style', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Bullet list', exact: true }),
  ).toBeVisible()
  await page.getByRole('option', { name: 'Bullet list', exact: true }).click()
  await expect(editor.locator('ul li')).toHaveText('Create an API')
  await editor.press('ArrowRight')
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection()
        return Boolean(
          selection?.isCollapsed &&
          selection.anchorNode &&
          element.contains(selection.anchorNode) &&
          selection.anchorNode.textContent === 'Create an API' &&
          selection.anchorOffset === 13,
        )
      }),
    )
    .toBe(true)
  await editor.press('Enter')
  await expect(editor.locator('ul li')).toHaveText(['Create an API', ''])
  await editor.pressSequentially('Test before publishing')
  await expect(editor.locator('ul li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])
  await page
    .getByRole('combobox', { name: 'Body block style', exact: true })
    .click()
  await page.getByRole('option', { name: 'Numbered list', exact: true }).click()
  await expect(editor.locator('ol li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])

  await editor.press('ControlOrMeta+z')
  await expect(editor.locator('ul li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(editor.locator('ol li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])

  await editor.locator('ol li').last().click()
  await editor.press('End')
  await expect(
    page.getByRole('button', { name: 'Indent list', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Indent list', exact: true }).click()
  await expect(editor.locator('ol ol li')).toHaveText('Test before publishing')

  await capture(
    'Rich text',
    'Nested ordered list',
    'Indent a selected second item under its existing owner through a validated native list operation.',
  )

  const nestedBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'list',
        ordered: true,
        start: 1,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Create an API', marks: [] }],
              },
              {
                type: 'list',
                ordered: true,
                start: 1,
                children: [
                  {
                    type: 'listItem',
                    children: [
                      {
                        type: 'paragraph',
                        children: [
                          {
                            type: 'text',
                            text: 'Test before publishing',
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
      },
    ],
  }
  const nestedReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const nestedResponse = await nestedReply
  expect(nestedResponse.status()).toBe(200)
  expect(nestedResponse.request().postDataJSON()).toEqual({
    data: { body: nestedBody },
  })
  const nestedEntry = await nestedResponse.json()
  expect(nestedEntry.data).toEqual({ body: nestedBody })

  await expect(
    editor.locator('ol').first().locator(':scope > li').first(),
  ).toHaveCSS('list-style-type', 'decimal')

  await capture(
    'Rich text',
    'Saved nested list',
    'The real entry POST stores the exact nested owner/item document; saved content stays read-only until Edit entry.',
  )

  await page.reload()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Formatted articles', exact: true })
    .click()
  await page.getByRole('button', { name: new RegExp(nestedEntry.id) }).click()
  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await expect(editor.locator('ol ol li')).toHaveText('Test before publishing')
  await editor.locator('ol ol li').click()
  await editor.press('End')
  await page.getByRole('button', { name: 'Outdent list', exact: true }).click()
  await expect(editor.locator('ol ol')).toHaveCount(0)
  await expect(editor.locator('ol li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])

  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor.locator('ol ol li')).toHaveText('Test before publishing')
  await editor.locator('ol ol li').click()
  await editor.press('Home')
  await expect
    .poll(() =>
      editor.evaluate((element) => {
        const selection = window.getSelection()

        return Boolean(
          selection?.isCollapsed &&
          selection.anchorOffset === 0 &&
          selection.anchorNode?.textContent === 'Test before publishing' &&
          element.contains(selection.anchorNode),
        )
      }),
    )
    .toBe(true)
  await editor.press('Backspace')
  await expect(editor.locator('ol ol')).toHaveCount(0)
  await expect(editor.locator('ol li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor.locator('ol ol li')).toHaveText('Test before publishing')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(editor.locator('ol ol')).toHaveCount(0)
  await expect(editor.locator('ol li')).toHaveText([
    'Create an API',
    'Test before publishing',
  ])

  const listReply = page.waitForResponse(
    (response) =>
      response.url() === entries + '/' + nestedEntry.id &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  const listResponse = await listReply
  expect(listResponse.status()).toBe(200)
  const listBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'list',
        ordered: true,
        start: 1,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Create an API', marks: [] }],
              },
            ],
          },
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Test before publishing', marks: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  expect(listResponse.request().postDataJSON()).toEqual({
    version: 1,
    data: { body: listBody },
  })
  expect((await listResponse.json()).data).toEqual({ body: listBody })

  const listRead = await page.request.get(entries + '/' + nestedEntry.id, {
    headers: { origin, authorization: 'Bearer ' + owner },
  })
  expect(listRead.status()).toBe(200)
  expect((await listRead.json()).data).toEqual({ body: listBody })

  await capture(
    'Rich text',
    'Saved outdented list after reopening',
    'A real page reload, owner-preserving Outdent and Backspace with native Undo/Redo finish in an exact versioned PUT and public GET.',
  )

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await editor.fill('Read guide')
  await editor.press('ControlOrMeta+a')
  await expect(
    page.getByRole('button', { name: 'Add link', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add link', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Link URL', exact: true })
    .fill('https://example.com/guide')

  await capture(
    'Rich text',
    'Reviewed HTTPS link',
    'Review an HTTPS address while entry saving and editor mutations wait for Apply or Cancel.',
  )
  await page.getByRole('button', { name: 'Apply link', exact: true }).click()
  await expect(editor.locator('a')).toHaveText('Read guide')
  await expect(editor.locator('a')).toHaveAttribute(
    'href',
    'https://example.com/guide',
  )

  const linkReply = page.waitForResponse(
    (response) =>
      response.url() === entries && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const linkResponse = await linkReply
  expect(linkResponse.status()).toBe(200)
  const linkBody = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com/guide',
            children: [{ type: 'text', text: 'Read guide', marks: [] }],
          },
        ],
      },
    ],
  }
  expect(linkResponse.request().postDataJSON()).toEqual({
    data: { body: linkBody },
  })
  expect((await linkResponse.json()).data).toEqual({ body: linkBody })

  await capture(
    'Rich text',
    'Saved structured link',
    'The actual entry POST retains a typed HTTPS link and literal label without opening its target.',
  )
}
