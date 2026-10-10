import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'

export async function richTextPreviews({
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
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()

  await page
    .getByRole('button', { name: 'Content models', exact: true })
    .click()
  await page.getByLabel('Model name', { exact: true }).fill('Articles')
  await page.getByRole('button', { name: 'Add field', exact: true }).click()
  await page.getByLabel('Field 1 label', { exact: true }).fill('Article body')
  await page.getByLabel('Field 1 key', { exact: true }).fill('body')
  await page
    .getByRole('checkbox', { name: 'Field 1 required', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Field 1 type', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Rich text', exact: true }),
  ).toBeVisible()
  await page.getByRole('option', { name: 'Rich text', exact: true }).click()

  await capture(
    'Rich text',
    'Versioned paragraph model',
    'Choose paragraph rich text through the content model form without editing a schema.',
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
      label: 'Article body',
      required: true,
      schema: { type: 'richText', schemaVersion: 1, astVersion: 1 },
    },
  ])

  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('button', { name: 'New collection', exact: true })
    .click()
  await page
    .getByLabel('Collection name', { exact: true })
    .fill('Private articles')
  await page
    .getByRole('combobox', { name: 'Content model', exact: true })
    .click()
  await page.getByRole('option', { name: 'Articles', exact: true }).click()
  await expect(
    page.getByText('Content model revision 1', { exact: true }),
  ).toBeVisible()

  const collectionReply = page.waitForResponse(
    (response) =>
      response.url() === origin + '/api/collections' &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Create collection', exact: true })
    .click()
  const collectionResponse = await collectionReply
  expect(collectionResponse.status()).toBe(200)
  const collection = await collectionResponse.json()

  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add paragraph to Article body', exact: true })
    .click()
  const firstText = page.getByLabel('Article body · Paragraph 1 · Text 1', {
    exact: true,
  })
  await firstText.fill('  <h1>First & ไทย</h1>  ')
  await page
    .getByRole('button', {
      name: 'Add text to Article body · Paragraph 1',
      exact: true,
    })
    .click()
  await page
    .getByRole('button', { name: 'Add paragraph to Article body', exact: true })
    .click()
  await page
    .getByLabel('Article body · Paragraph 2 · Text 1', { exact: true })
    .fill('Second paragraph')
  await capture(
    'Rich text',
    'Literal paragraph content',
    'Labeled paragraph and text forms preserve literal whitespace and markup as content.',
  )

  const body = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '  <h1>First & ไทย</h1>  ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Second paragraph' }],
      },
    ],
  }
  const entriesUrl = origin + '/api/collections/' + collection.id + '/entries'
  const createReply = page.waitForResponse(
    (response) =>
      response.url() === entriesUrl && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const createResponse = await createReply
  expect(createResponse.status()).toBe(200)
  expect(createResponse.request().postDataJSON()).toEqual({ data: { body } })
  const created = await createResponse.json()
  expect(created.data).toEqual({ body })
  await expect(firstText).toHaveValue('  <h1>First & ไทย</h1>  ')
  await expect(firstText).toBeDisabled()

  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await firstText.fill('  Revised <em>literal</em> text  ')
  const changedBody = {
    type: 'document',
    astVersion: 1,
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '  Revised <em>literal</em> text  ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Second paragraph' }],
      },
    ],
  }
  const detailUrl = entriesUrl + '/' + created.id
  const saveReply = page.waitForResponse(
    (response) =>
      response.url() === detailUrl && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  const savedResponse = await saveReply
  expect(savedResponse.status()).toBe(200)
  expect(savedResponse.request().postDataJSON()).toEqual({
    version: 1,
    data: { body: changedBody },
  })
  expect((await savedResponse.json()).data).toEqual({ body: changedBody })

  const read = await page.request.get(detailUrl, {
    headers: { origin, authorization: 'Bearer ' + owner },
  })
  expect(read.status()).toBe(200)
  const stored = await read.json()
  expect(stored.version).toBe(2)
  expect(stored.data).toEqual({ body: changedBody })
  await expect(
    page.getByLabel('Article body · Paragraph 1 · Text 2', { exact: true }),
  ).toHaveValue('')
  await expect(
    page.getByLabel('Article body · Paragraph 2 · Text 1', { exact: true }),
  ).toHaveValue('Second paragraph')
  await capture(
    'Rich text',
    'Saved structured paragraphs',
    'A real versioned edit retains every paragraph and empty text leaf in the structured response.',
  )
}
