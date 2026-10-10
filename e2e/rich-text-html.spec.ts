import { expect } from '@playwright/test'
import { signInPreview } from './preview-fixture'
import { htmlPreviewOrigin, test } from './rich-text-html-fixture'
import { richTextHtmlPreviews } from './rich-text-html-previews'
import { richTextHtmlGuardPreviews } from './rich-text-html-guard-previews'

test.use({ baseURL: htmlPreviewOrigin, locale: 'en-US' })

test('owner can choose HTML preview for a reviewed saved formatted entry', async ({
  page,
  htmlWorkspace,
}) => {
  await signInPreview(page, htmlWorkspace.owner)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: htmlWorkspace.collectionName, exact: true })
    .click()
  await page
    .locator('.content-entry-row')
    .filter({ hasText: htmlWorkspace.entryId })
    .click()

  await expect(
    page.getByRole('heading', { name: 'Saved entry', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    htmlWorkspace.title,
  )

  await expect(
    page.getByRole('button', { name: 'Preview HTML', exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()

  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  await expect(review).toBeVisible()
  await expect(
    review.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()

  const previewPath =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/render-preview'
  const generate = review.getByRole('button', {
    name: 'Generate HTML preview',
    exact: true,
  })
  await expect(generate).toBeVisible()

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === previewPath && response.request().method() === 'POST',
  )
  await generate.click()

  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({
    entryVersion: 1,
    fieldKey: 'body',
    renderer: { schemaVersion: 1, elements: {} },
  })

  const html =
    '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
  expect(await response.json()).toMatchObject({
    collectionId: htmlWorkspace.collectionId,
    collectionVersion: 1,
    structId: htmlWorkspace.structId,
    structVersion: 1,
    entryId: htmlWorkspace.entryId,
    entryVersion: 1,
    fieldKey: 'body',
    schemaVersion: 2,
    astVersion: 2,
    rendererSchemaVersion: 1,
    consumerContract: null,
    html,
  })
  await expect(
    review.getByRole('textbox', { name: 'HTML source', exact: true }),
  ).toHaveValue(html)
  await expect(
    review.getByRole('textbox', { name: 'HTML source', exact: true }),
  ).toHaveAttribute('readonly', '')

  const frame = review.locator('iframe[title="Rendered HTML preview"]')
  await expect(frame).toHaveAttribute('sandbox', '')
  await expect(frame).toHaveAttribute('tabindex', '-1')
  await expect(frame).toHaveAttribute('aria-hidden', 'true')
  await expect(frame.contentFrame().locator('h1')).toHaveText(
    'Saved heading ไทย',
  )
  await expect(frame.contentFrame().locator('a')).toHaveAttribute(
    'href',
    'https://example.invalid/preview?note=a&tag=b',
  )
  await expect(frame.contentFrame().locator('script')).toHaveCount(0)

  const externalAttempts: string[] = []
  const popupUrls: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'example.invalid')
      externalAttempts.push(request.url())
  })
  page.context().on('page', (popup) => popupUrls.push(popup.url()))
  await page.context().route('https://example.invalid/**', async (route) => {
    externalAttempts.push(route.request().url())
    await route.abort()
  })

  const parentUrl = page.url()
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  async function savedState() {
    const result = []
    for (const path of [
      '/api/collections/' + htmlWorkspace.collectionId,
      '/api/collections/' +
        htmlWorkspace.collectionId +
        '/entries/' +
        htmlWorkspace.entryId,
      '/api/audit',
    ]) {
      const savedResponse = await page.request.get(htmlPreviewOrigin + path, {
        headers,
      })
      expect(savedResponse.status()).toBe(200)
      result.push(await savedResponse.json())
    }

    return result
  }
  const before = await savedState()
  const link = frame.contentFrame().locator('a')
  await link.scrollIntoViewIfNeeded()
  const box = await link.boundingBox()
  if (!box) throw new Error('Rendered link has no visible geometry')

  // Use a real pointer because an inert link intentionally fails click actionability.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  expect(page.url()).toBe(parentUrl)
  expect(
    page.frames().filter((child) => child.url() === 'about:srcdoc'),
  ).toHaveLength(1)

  const source = review.getByRole('textbox', {
    name: 'HTML source',
    exact: true,
  })
  await source.click()
  await page.keyboard.press('Shift+Tab')
  await expect(generate).toBeFocused()
  const keyboardResponse = page.waitForResponse(
    (reply) =>
      reply.url() === previewPath && reply.request().method() === 'POST',
  )
  await page.keyboard.press('Enter')
  expect((await keyboardResponse).status()).toBe(200)
  await expect(source).toHaveValue(html)
  await expect(frame.contentFrame().locator('h1')).toHaveText(
    'Saved heading ไทย',
  )

  await source.click()
  await page.keyboard.press('Shift+Tab')
  await expect(generate).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(source).toBeFocused()
  expect(await savedState()).toEqual(before)
  expect(externalAttempts).toEqual([])
  expect(popupUrls).toEqual([])
  expect(page.context().pages()).toHaveLength(1)
  expect(page.url()).toBe(parentUrl)
  expect(
    page.frames().filter((child) => child.url() === 'about:srcdoc'),
  ).toHaveLength(1)
})

test('owner selects saved literal and nested rich text through labelled fields', async ({
  page,
  htmlWorkspace,
}) => {
  await signInPreview(page, htmlWorkspace.owner)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: htmlWorkspace.collectionName, exact: true })
    .click()
  await page
    .locator('.content-entry-row')
    .filter({ hasText: htmlWorkspace.entryId })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Saved entry', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()

  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  const selector = review.getByRole('combobox', {
    name: 'Rich-text field',
    exact: true,
  })
  await expect(selector).toBeVisible()
  const previewPath =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/render-preview'
  let previewCount = 0
  page.on('request', (request) => {
    if (request.url() === previewPath && request.method() === 'POST')
      previewCount += 1
  })
  const generate = review.getByRole('button', {
    name: 'Generate HTML preview',
    exact: true,
  })
  const source = review.getByRole('textbox', {
    name: 'HTML source',
    exact: true,
  })

  await selector.click()
  await page.getByRole('option', { name: 'Summary', exact: true }).click()
  expect(previewCount).toBe(0)
  const literalReply = page.waitForResponse(
    (response) =>
      response.url() === previewPath && response.request().method() === 'POST',
  )
  await generate.click()
  const literal = await literalReply
  expect(literal.status()).toBe(200)
  expect(literal.request().postDataJSON()).toEqual({
    entryVersion: 1,
    fieldKey: 'summary',
    renderer: { schemaVersion: 1, elements: {} },
  })
  expect(await literal.json()).toMatchObject({
    structId: htmlWorkspace.structId,
    structVersion: 1,
    entryId: htmlWorkspace.entryId,
    entryVersion: 1,
    fieldKey: 'summary',
    schemaVersion: 1,
    astVersion: 1,
    html: '<p>  Summary &lt;em&gt;literal&lt;/em&gt; &amp; ไทย  </p>',
  })
  await expect(source).toHaveValue(
    '<p>  Summary &lt;em&gt;literal&lt;/em&gt; &amp; ไทย  </p>',
  )

  await selector.click()
  await page
    .getByRole('option', {
      name: 'Details · Sections · Item 2 · Body',
      exact: true,
    })
    .click()
  await expect(source).toHaveCount(0)
  expect(previewCount).toBe(1)
  const nestedReply = page.waitForResponse(
    (response) =>
      response.url() === previewPath && response.request().method() === 'POST',
  )
  await generate.click()
  const nested = await nestedReply
  expect(nested.status()).toBe(200)
  expect(nested.request().postDataJSON()).toEqual({
    entryVersion: 1,
    fieldPath: ['details', 'sections', 1, 'body'],
    renderer: { schemaVersion: 1, elements: {} },
  })
  expect(await nested.json()).toMatchObject({
    structId: htmlWorkspace.structId,
    structVersion: 1,
    entryId: htmlWorkspace.entryId,
    entryVersion: 1,
    fieldKey: 'body',
    fieldPath: ['details', 'sections', 1, 'body'],
    schemaVersion: 2,
    astVersion: 2,
    html: '<p>  Second nested &lt;p&gt;literal&lt;/p&gt; &amp; ไทย  </p>',
  })
  await expect(source).toHaveValue(
    '<p>  Second nested &lt;p&gt;literal&lt;/p&gt; &amp; ไทย  </p>',
  )
  expect(previewCount).toBe(2)
})

test('owner reviews literal element settings without saving them into content', async ({
  page,
  htmlWorkspace,
}) => {
  await signInPreview(page, htmlWorkspace.owner)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: htmlWorkspace.collectionName, exact: true })
    .click()
  await page
    .locator('.content-entry-row')
    .filter({ hasText: htmlWorkspace.entryId })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Saved entry', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()

  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  const advanced = review.getByRole('button', {
    name: 'Advanced element settings',
    exact: true,
  })
  await expect(advanced).toBeVisible()
  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await advanced.click()
  await review.getByRole('combobox', { name: 'Element', exact: true }).click()
  await page
    .getByRole('option', { name: 'Heading 1 (h1)', exact: true })
    .click()
  await review
    .getByLabel('CSS classes', { exact: true })
    .fill('text-heading-1 article-title')
  await review
    .getByLabel('Title attribute', { exact: true })
    .fill('Title "ไทย" & <saved>')
  await review
    .getByLabel('Accessibility label', { exact: true })
    .fill('Heading ไทย')
  await review
    .getByRole('checkbox', {
      name: 'Use fixed heading identifier',
      exact: true,
    })
    .check()

  const fixedIdentifier = review.getByRole('checkbox', {
    name: 'Use fixed heading identifier',
    exact: true,
  })
  const fixedBounds = await fixedIdentifier.boundingBox()
  expect(fixedBounds).not.toBeNull()
  expect(Math.abs(fixedBounds!.width - fixedBounds!.height)).toBeLessThan(1)
  const labelBounds = await review
    .locator('label')
    .filter({
      has: page.getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      }),
    })
    .boundingBox()
  expect(labelBounds).not.toBeNull()
  expect(labelBounds!.height).toBeGreaterThanOrEqual(44)

  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  async function savedState() {
    const result = []
    for (const path of [
      '/api/collections/' + htmlWorkspace.collectionId,
      '/api/collections/' +
        htmlWorkspace.collectionId +
        '/entries/' +
        htmlWorkspace.entryId,
      '/api/audit',
    ]) {
      const reply = await page.request.get(htmlPreviewOrigin + path, {
        headers,
      })
      expect(reply.status()).toBe(200)
      result.push(await reply.json())
    }

    return result
  }
  const before = await savedState()
  const previewPath =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/render-preview'
  let previewCount = 0
  page.on('request', (request) => {
    if (request.url() === previewPath && request.method() === 'POST')
      previewCount += 1
  })
  const replyPromise = page.waitForResponse(
    (reply) =>
      reply.url() === previewPath && reply.request().method() === 'POST',
  )
  await review
    .getByRole('button', { name: 'Generate HTML preview', exact: true })
    .click()
  const reply = await replyPromise
  expect(reply.status()).toBe(200)
  expect(reply.request().postDataJSON()).toEqual({
    entryVersion: 1,
    fieldKey: 'body',
    renderer: {
      schemaVersion: 1,
      elements: {
        h1: {
          classes: ['text-heading-1', 'article-title'],
          attributes: {
            title: 'Title "ไทย" & <saved>',
            'aria-label': 'Heading ไทย',
            'x-data': 'h1',
          },
        },
      },
      consumerContract: 'besh.fixed-heading-id.v1',
    },
  })
  const html =
    '<h1 class="text-heading-1 article-title" aria-label="Heading ไทย" title="Title &quot;ไทย&quot; &amp; &lt;saved&gt;" x-data="h1">Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
  expect(await reply.json()).toMatchObject({
    entryId: htmlWorkspace.entryId,
    entryVersion: 1,
    consumerContract: 'besh.fixed-heading-id.v1',
    html,
  })
  const source = review.getByRole('textbox', {
    name: 'HTML source',
    exact: true,
  })
  await expect(source).toHaveValue(html)
  const frame = review.locator('iframe[title="Rendered HTML preview"]')
  await expect(frame.contentFrame().locator('h1')).toHaveAttribute(
    'x-data',
    'h1',
  )
  await expect(frame.contentFrame().locator('script')).toHaveCount(0)
  expect(await savedState()).toEqual(before)

  await review
    .getByLabel('CSS classes', { exact: true })
    .fill('text-heading-1 refreshed-heading')
  await expect(source).toHaveCount(0)
  expect(await savedState()).toEqual(before)
  expect(previewCount).toBe(1)
  await expect(
    review.getByLabel('Title attribute', { exact: true }),
  ).toHaveValue('Title "ไทย" & <saved>')
})

test.describe('HTML copying', { lock: 'clipboard' }, () => {
  test('owner copies reviewed HTML without saving content or issuing another preview', async ({
    page,
    htmlWorkspace,
  }) => {
    await signInPreview(page, htmlWorkspace.owner)
    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: htmlWorkspace.collectionName, exact: true })
      .click()
    await page
      .locator('.content-entry-row')
      .filter({ hasText: htmlWorkspace.entryId })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Saved entry', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Preview HTML', exact: true })
      .click()

    const review = page.getByRole('region', {
      name: 'Private HTML preview',
      exact: true,
    })
    const previewPath =
      htmlPreviewOrigin +
      '/api/collections/' +
      htmlWorkspace.collectionId +
      '/entries/' +
      htmlWorkspace.entryId +
      '/render-preview'
    const headers = {
      origin: htmlPreviewOrigin,
      authorization: 'Bearer ' + htmlWorkspace.owner,
    }
    async function savedState() {
      const result = []
      for (const path of [
        '/api/collections/' + htmlWorkspace.collectionId,
        '/api/collections/' +
          htmlWorkspace.collectionId +
          '/entries/' +
          htmlWorkspace.entryId,
        '/api/audit',
      ]) {
        const reply = await page.request.get(htmlPreviewOrigin + path, {
          headers,
        })
        expect(reply.status()).toBe(200)
        result.push(await reply.json())
      }

      return result
    }
    const before = await savedState()
    let previewCount = 0
    page.on('request', (request) => {
      if (request.url() === previewPath && request.method() === 'POST')
        previewCount += 1
    })
    const replyPromise = page.waitForResponse(
      (reply) =>
        reply.url() === previewPath && reply.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Generate HTML preview', exact: true })
      .click()
    expect((await replyPromise).status()).toBe(200)

    const html =
      '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>'
    const source = review.getByRole('textbox', {
      name: 'HTML source',
      exact: true,
    })
    await expect(source).toHaveValue(html)
    const copy = review.getByRole('button', { name: 'Copy HTML', exact: true })
    await expect(copy).toBeVisible()
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: htmlPreviewOrigin,
      })
    await copy.click()
    await expect(
      review.getByRole('button', { name: 'HTML copied', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        async (expected) => (await navigator.clipboard.readText()) === expected,
        html,
      ),
    ).toBe(true)
    expect(await savedState()).toEqual(before)
    expect(previewCount).toBe(1)

    await review
      .getByRole('button', { name: 'Close HTML preview', exact: true })
      .click()
    await expect(review).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Preview HTML', exact: true })
      .click()
    await expect(source).toHaveCount(0)
    await expect(
      review.getByRole('button', { name: 'HTML copied', exact: true }),
    ).toHaveCount(0)
    expect(await savedState()).toEqual(before)
    expect(previewCount).toBe(1)
    await page.context().clearPermissions()
  })
})

test('saved HTML review excludes edits and requires reload after a real peer update', async ({
  page,
  htmlWorkspace,
}) => {
  await richTextHtmlGuardPreviews({
    page,
    origin: htmlPreviewOrigin,
    owner: htmlWorkspace.owner,
    workspace: htmlWorkspace,
    capture: async () => {},
  })
})
test('seven languages and phone appearances preserve reviewed HTML and literal settings', async ({
  page,
  htmlWorkspace,
}, info) => {
  await richTextHtmlPreviews({
    page,
    origin: htmlPreviewOrigin,
    owner: htmlWorkspace.owner,
    workspace: htmlWorkspace,
    capture: async (_group, title) => {
      if (!title.startsWith('Phone ')) return

      await page.screenshot({
        path: info.outputPath(
          title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png',
        ),
        fullPage: false,
        animations: 'disabled',
        mask: [
          page.locator('[data-private]'),
          page.locator('input[type="password"]'),
        ],
      })
    },
  })
})
