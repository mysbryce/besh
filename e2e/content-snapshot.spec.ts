import { expect, type Page } from '@playwright/test'
import { signInPreview } from './preview-fixture'
import { htmlPreviewOrigin, test } from './rich-text-html-fixture'
import type { HtmlPreviewWorkspace } from './rich-text-html-seed'

test.use({ baseURL: htmlPreviewOrigin, locale: 'en-US' })

test.describe.configure({ lock: 'port-4395' })

async function reviewSavedHtml(page: Page) {
  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  await review
    .getByRole('button', { name: 'Review collection settings', exact: true })
    .click()
  await review
    .getByRole('combobox', { name: 'HTML settings', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Reviewed collection settings', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Generate HTML preview', exact: true })
    .click()
  await expect(
    review.getByRole('textbox', { name: 'HTML source', exact: true }),
  ).toHaveValue(/Saved heading ไทย/)

  return review
}

async function openSnapshotReview(page: Page, workspace: HtmlPreviewWorkspace) {
  await signInPreview(page, workspace.owner)
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: workspace.collectionName, exact: true })
    .click()
  await page
    .locator('.content-entry-row')
    .filter({ hasText: workspace.entryId })
    .click()
  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()

  return reviewSavedHtml(page)
}

test('owner chooses GraphQL Content API, publishes its fixed contract and calls it with a pinned query key', async ({
  page,
  htmlWorkspace,
}) => {
  const review = await openSnapshotReview(page, htmlWorkspace)
  await review.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await review
    .getByLabel('API name', { exact: true })
    .fill('Browser GraphQL article')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/browser-graphql-article')

  const entryPath =
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId
  const creation = page.waitForResponse(
    (response) =>
      response.url() ===
        htmlPreviewOrigin + entryPath + '/snapshot-flow/graphql' &&
      response.request().method() === 'POST',
  )
  await review
    .getByRole('button', { name: 'Create Content API', exact: true })
    .click()
  const response = await creation
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({
    name: 'Browser GraphQL article',
    path: '/browser-graphql-article',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 0,
    fieldPath: ['body'],
  })
  const draft = await response.json()
  expect(draft).toMatchObject({
    method: 'POST',
    publishedRevision: null,
    graphql: {
      schema: expect.stringContaining('contentSnapshot: CmsContentSnapshot!'),
    },
  })
  await review
    .getByRole('button', { name: 'Open API Studio', exact: true })
    .click()
  await expect(page.locator('.flow-card.cmsSnapshotResponse')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('textbox', { name: 'Fixed GraphQL schema', exact: true }),
  ).toHaveValue(draft.graphql.schema)
  await expect(
    page.getByRole('textbox', { name: 'Fixed GraphQL schema', exact: true }),
  ).toHaveAttribute('readonly', '')
  const example = page.getByRole('textbox', {
    name: 'Example GraphQL query',
    exact: true,
  })
  await expect(example).toHaveValue(/contentSnapshot/)
  await expect(example).toHaveAttribute('readonly', '')
  const query = await example.inputValue()
  const publication = page.waitForResponse(
    (reply) =>
      reply.url() ===
        htmlPreviewOrigin + '/api/flows/' + draft.id + '/publish' &&
      reply.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  expect((await publication).status()).toBe(200)
  await expect(
    page.getByLabel('Published endpoint URL', { exact: true }),
  ).toHaveValue(htmlPreviewOrigin + '/graphql/browser-graphql-article')

  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Release access', exact: true }),
  ).toHaveText('Only this release')
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Browser GraphQL reader')
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
  const issuance = page.waitForResponse(
    (reply) =>
      reply.url() === htmlPreviewOrigin + '/api/runtime-keys' &&
      reply.request().method() === 'POST',
  )
  await confirmation
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  const issued = await issuance
  expect(issued.status()).toBe(200)
  expect(issued.request().postDataJSON()).toMatchObject({
    flowId: draft.id,
    releaseRevision: 1,
    permissions: ['query'],
  })
  const key = await issued.json()
  expect(key.issuerBinding).toEqual({
    memberId: 'owner',
    action: 'runtime-keys.manage',
  })
  await expect(
    page.getByRole('textbox', { name: 'New API key', exact: true }),
  ).toHaveValue(key.token)

  const endpoint = htmlPreviewOrigin + '/graphql/browser-graphql-article'
  const caller = await page.request.post(endpoint, {
    headers: { authorization: 'Bearer ' + key.token },
    data: { query },
  })
  expect(caller.status()).toBe(200)
  const selected = await caller.json()
  expect(selected.errors).toBeUndefined()
  expect(selected.data.contentSnapshot).toMatchObject({
    document: { type: 'document', astVersion: 2 },
    html: '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>',
    provenance: {
      entryVersion: '1',
      rendererVersion: '0',
      releaseRevision: '1',
    },
  })
  expect(
    (
      await page.request.post(endpoint, {
        headers: { authorization: 'Bearer ' + htmlWorkspace.owner },
        data: { query },
      })
    ).status(),
  ).toBe(401)
})

test('GraphQL creation locks its type choice and rejects an unconfirmed altered schema reply', async ({
  page,
  htmlWorkspace,
}) => {
  const review = await openSnapshotReview(page, htmlWorkspace)
  await review.getByRole('combobox', { name: 'API type', exact: true }).click()
  await page.getByRole('option', { name: 'GraphQL', exact: true }).click()
  await review
    .getByLabel('API name', { exact: true })
    .fill('Unconfirmed GraphQL snapshot')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/unconfirmed-graphql-snapshot')
  const creationUrl =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/snapshot-flow/graphql'
  let release!: () => void
  let ready!: () => void
  let done!: () => void
  let started = false
  let createdId = ''
  let canonicalSchema = ''
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const committed = new Promise<void>((resolve) => {
    ready = resolve
  })
  const delivered = new Promise<void>((resolve) => {
    done = resolve
  })
  await page.route(creationUrl, async (route) => {
    started = true
    try {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(200)
      const body = await response.json()
      createdId = body.id
      canonicalSchema = body.graphql.schema
      body.graphql.schema += '\n'
      ready()
      await held
      await route.fulfill({ response, json: body })
    } finally {
      done()
    }
  })

  try {
    await review
      .getByRole('button', { name: 'Create Content API', exact: true })
      .click()
    await committed
    await expect(
      review.getByRole('combobox', { name: 'API type', exact: true }),
    ).toBeDisabled()
    await expect(review.getByLabel('API name', { exact: true })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Members', exact: true }),
    ).toBeDisabled()
    release()
    await delivered
    await expect(review.getByRole('alert')).toHaveText(
      'Creation could not be confirmed. Review the API list before creating again.',
    )
    await expect(
      review.getByRole('button', { name: 'Create Content API', exact: true }),
    ).toBeDisabled()
    await expect(
      review.getByRole('button', { name: 'Open API Studio', exact: true }),
    ).toHaveCount(0)
    const catalog = await page.request.get(htmlPreviewOrigin + '/api/flows', {
      headers: { authorization: 'Bearer ' + htmlWorkspace.owner },
    })
    expect(catalog.status()).toBe(200)
    const flows = (await catalog.json()).filter(
      (flow: { id: string }) => flow.id === createdId,
    )
    expect(flows).toHaveLength(1)
    expect(flows[0].graphql.schema).toBe(canonicalSchema)
    expect(flows[0].publishedRevision).toBeNull()
  } finally {
    release()
    if (started) await delivered
    await page.unroute(creationUrl)
  }
})

test('creation blocks navigation and duplicate actions while its real committed reply is held', async ({
  page,
  htmlWorkspace,
}) => {
  const review = await openSnapshotReview(page, htmlWorkspace)
  await review.getByLabel('API name', { exact: true }).fill('Held Content API')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/held-content-api')
  const url =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/snapshot-flow'
  let release!: () => void
  let ready!: () => void
  let done!: () => void
  let started = false
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const committed = new Promise<void>((resolve) => {
    ready = resolve
  })
  const delivered = new Promise<void>((resolve) => {
    done = resolve
  })
  await page.route(url, async (route) => {
    started = true
    try {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(200)
      ready()
      await held
      await route.fulfill({ response })
    } finally {
      done()
    }
  })

  try {
    await review
      .getByRole('button', { name: 'Create Content API', exact: true })
      .click()
    await committed
    for (const name of [
      'Create Content API',
      'Close HTML preview',
      'Generate HTML preview',
      'Copy HTML',
    ]) {
      await expect(
        review.getByRole('button', { name, exact: true }),
      ).toBeDisabled()
    }
    await expect(review.getByLabel('API name', { exact: true })).toBeDisabled()
    await expect(
      review.getByLabel('Endpoint path', { exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Members', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeDisabled()

    release()
    await delivered
    await expect(
      review.getByText('Content API draft created.', { exact: true }),
    ).toBeVisible()
  } finally {
    release()
    if (started) await delivered
    await page.unroute(url)
  }
})

test('unconfirmed creation cannot silently retry after edits or a fresh local review', async ({
  page,
  htmlWorkspace,
}) => {
  const review = await openSnapshotReview(page, htmlWorkspace)
  await review
    .getByLabel('API name', { exact: true })
    .fill('Unconfirmed Content API')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/unconfirmed-content-api')
  const url =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/snapshot-flow'
  let creates = 0
  let done!: () => void
  const handled = new Promise<void>((resolve) => {
    done = resolve
  })
  await page.route(url, async (route) => {
    creates++
    try {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(200)
      await route.abort('failed')
    } finally {
      done()
    }
  })

  await review
    .getByRole('button', { name: 'Create Content API', exact: true })
    .click()
  await handled
  await page.unroute(url)
  const warning =
    'Creation could not be confirmed. Review the API list before creating again.'
  await expect(review.getByRole('alert')).toHaveText(warning)
  await review
    .getByLabel('API name', { exact: true })
    .fill('Edited unconfirmed name')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/edited-unconfirmed-path')
  await expect(
    review.getByRole('button', { name: 'Create Content API', exact: true }),
  ).toBeDisabled()
  await review
    .getByRole('button', { name: 'Close HTML preview', exact: true })
    .click()
  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()
  const freshReview = await reviewSavedHtml(page)
  await freshReview
    .getByLabel('API name', { exact: true })
    .fill('Another local attempt')
  await freshReview
    .getByLabel('Endpoint path', { exact: true })
    .fill('/another-local-attempt')
  await expect(freshReview.getByRole('alert')).toHaveText(warning)
  await expect(
    freshReview.getByRole('button', {
      name: 'Create Content API',
      exact: true,
    }),
  ).toBeDisabled()
  await freshReview.getByLabel('API name', { exact: true }).press('Enter')
  expect(creates).toBe(1)

  const catalog = await page.request.get(htmlPreviewOrigin + '/api/flows', {
    headers: {
      origin: htmlPreviewOrigin,
      authorization: 'Bearer ' + htmlWorkspace.owner,
    },
  })
  expect(catalog.status()).toBe(200)
  expect(
    (await catalog.json()).map((flow: { name: string }) => flow.name),
  ).toEqual(['Unconfirmed Content API'])
})

test('a stale saved renderer blocks creation until the owner explicitly reviews it again', async ({
  page,
  htmlWorkspace,
}) => {
  const review = await openSnapshotReview(page, htmlWorkspace)
  await review
    .getByLabel('API name', { exact: true })
    .fill('Stale reviewed API')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/stale-reviewed-api')
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const rendererUrl =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/renderer'
  const update = await page.request.put(rendererUrl, {
    headers,
    data: {
      version: 0,
      renderer: {
        schemaVersion: 1,
        elements: { h1: { classes: ['fresh-heading'] } },
      },
    },
  })
  expect(update.status()).toBe(200)
  const url =
    htmlPreviewOrigin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId +
    '/snapshot-flow'
  const rejected = page.waitForResponse(
    (response) =>
      response.url() === url && response.request().method() === 'POST',
  )
  await review
    .getByRole('button', { name: 'Create Content API', exact: true })
    .click()
  expect((await rejected).status()).toBe(409)
  await expect(review.getByRole('alert')).toHaveText(
    'The reviewed content changed. Review it again before creating a Content API.',
  )
  await expect(review.getByLabel('API name', { exact: true })).toHaveValue(
    'Stale reviewed API',
  )
  await review
    .getByLabel('API name', { exact: true })
    .fill('Retained after conflict')
  await expect(
    review.getByRole('button', { name: 'Create Content API', exact: true }),
  ).toBeDisabled()
  const empty = await page.request.get(htmlPreviewOrigin + '/api/flows', {
    headers,
  })
  expect(empty.status()).toBe(200)
  expect(await empty.json()).toEqual([])

  const fresh = await reviewSavedHtml(page)
  await expect(
    fresh.getByRole('textbox', { name: 'HTML source', exact: true }),
  ).toHaveValue(/class="fresh-heading"/)
  await fresh.getByLabel('API name', { exact: true }).fill('Fresh reviewed API')
  await fresh
    .getByLabel('Endpoint path', { exact: true })
    .fill('/fresh-reviewed-api')
  await expect(
    fresh.getByRole('button', { name: 'Create Content API', exact: true }),
  ).toBeEnabled()
  const accepted = page.waitForResponse(
    (response) =>
      response.url() === url && response.request().method() === 'POST',
  )
  await fresh
    .getByRole('button', { name: 'Create Content API', exact: true })
    .click()
  const response = await accepted
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({
    rendererVersion: 1,
    name: 'Fresh reviewed API',
    path: '/fresh-reviewed-api',
  })
  await expect(
    fresh.getByText('Content API draft created.', { exact: true }),
  ).toBeVisible()
})

test('owner creates a Content API from explicitly reviewed saved HTML settings', async ({
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
  await page.getByRole('button', { name: 'Preview HTML', exact: true }).click()

  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  await review
    .getByRole('button', { name: 'Review collection settings', exact: true })
    .click()
  await review
    .getByRole('combobox', { name: 'HTML settings', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Reviewed collection settings', exact: true })
    .click()
  await review
    .getByRole('button', { name: 'Generate HTML preview', exact: true })
    .click()
  await expect(
    review.getByRole('textbox', { name: 'HTML source', exact: true }),
  ).toHaveValue(/Saved heading ไทย/)
  await expect(
    review.getByRole('button', { name: 'Create Content API', exact: true }),
  ).toBeVisible()
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const collectionPath = '/api/collections/' + htmlWorkspace.collectionId
  const entryPath = collectionPath + '/entries/' + htmlWorkspace.entryId
  const protectedPaths = [
    '/api/structs/' + htmlWorkspace.structId,
    collectionPath,
    entryPath,
    collectionPath + '/renderer',
  ]
  async function savedContent() {
    return Promise.all(
      protectedPaths.map(async (path) => {
        const response = await page.request.get(htmlPreviewOrigin + path, {
          headers,
        })
        expect(response.status()).toBe(200)
        return response.json()
      }),
    )
  }
  const before = await savedContent()
  let creates = 0
  let resourceReads = 0
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path === entryPath + '/snapshot-flow' && request.method() === 'POST')
      creates++
    if (protectedPaths.includes(path) && request.method() === 'GET')
      resourceReads++
  })
  await review
    .getByLabel('API name', { exact: true })
    .fill('Reviewed article API')
  await review
    .getByLabel('Endpoint path', { exact: true })
    .fill('/reviewed-article')
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url() === htmlPreviewOrigin + entryPath + '/snapshot-flow' &&
      response.request().method() === 'POST',
  )
  await review
    .getByRole('button', { name: 'Create Content API', exact: true })
    .click()
  const response = await createdResponse
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({
    name: 'Reviewed article API',
    path: '/reviewed-article',
    collectionVersion: 1,
    entryVersion: 1,
    rendererVersion: 0,
    fieldPath: ['body'],
  })
  const created = await response.json()
  expect(created).toMatchObject({
    name: 'Reviewed article API',
    path: '/reviewed-article',
    method: 'GET',
    revision: 1,
    publishedRevision: null,
    publishedEndpoint: null,
  })
  expect(created.nodes.map((node: { type: string }) => node.type)).toEqual([
    'request',
    'cmsSnapshotResponse',
  ])
  await expect(
    review.getByText('Content API draft created.', { exact: true }),
  ).toBeVisible()
  expect(creates).toBe(1)
  expect(resourceReads).toBe(0)
  expect(await savedContent()).toEqual(before)
  const detail = await page.request.get(
    htmlPreviewOrigin + '/api/flows/' + created.id,
    { headers },
  )
  expect(detail.status()).toBe(200)
  expect(await detail.json()).toEqual(created)
  await review
    .getByRole('button', { name: 'Open API Studio', exact: true })
    .click()
  await expect(page.locator('.flow-card.cmsSnapshotResponse')).toBeVisible()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Reviewed article API',
  )
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeEnabled()
  const publication = page.waitForResponse(
    (response) =>
      response.url() ===
        htmlPreviewOrigin + '/api/flows/' + created.id + '/publish' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const publishedResponse = await publication
  expect(publishedResponse.status()).toBe(200)
  expect(publishedResponse.request().postDataJSON()).toEqual({ revision: 1 })
  const published = await publishedResponse.json()
  expect(published.publishedRevision).toBe(1)
  await expect(
    page.getByLabel('Published endpoint URL', { exact: true }),
  ).toHaveValue(htmlPreviewOrigin + '/run/reviewed-article')
  expect(await savedContent()).toEqual(before)
  const keyResponse = await page.request.post(
    htmlPreviewOrigin + '/api/runtime-keys',
    {
      headers,
      data: {
        name: 'Reviewed article caller',
        flowId: created.id,
        releaseRevision: 1,
        permissions: ['rest'],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    },
  )
  expect(keyResponse.status()).toBe(200)
  const key = await keyResponse.json()
  expect(key.issuerBinding).toEqual({
    memberId: 'owner',
    action: 'runtime-keys.manage',
  })
  const runtime = htmlPreviewOrigin + '/run/reviewed-article?index=9'
  expect((await page.request.get(runtime, { headers })).status()).toBe(401)
  const reply = await page.request.get(runtime, {
    headers: { authorization: 'Bearer ' + key.token },
  })
  expect(reply.status()).toBe(200)
  const body = await reply.json()
  expect(body.html).toBe(
    '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>',
  )
  expect(body.document).toMatchObject({ type: 'document', astVersion: 2 })
  expect(body.provenance).toMatchObject({
    flowId: created.id,
    releaseRevision: 1,
    entryVersion: 1,
    rendererVersion: 0,
    fieldPath: ['body'],
  })
  await page.getByRole('button', { name: 'API keys', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Release access', exact: true }),
  ).toHaveText('Only this release')
  await page
    .getByRole('combobox', { name: 'Release access', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Follow published changes', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('option', { name: 'Only this release', exact: true })
    .click()
  await page
    .getByLabel('Key name', { exact: true })
    .fill('Browser Content caller')
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
  const browserIssue = page.waitForResponse(
    (response) =>
      response.url() === htmlPreviewOrigin + '/api/runtime-keys' &&
      response.request().method() === 'POST',
  )
  await confirmation
    .getByRole('button', { name: 'Create pinned key', exact: true })
    .click()
  const issuedResponse = await browserIssue
  expect(issuedResponse.status()).toBe(200)
  expect(issuedResponse.request().postDataJSON()).toMatchObject({
    flowId: created.id,
    releaseRevision: 1,
    permissions: ['rest'],
  })
  const browserKey = await issuedResponse.json()
  expect(browserKey.issuerBinding).toEqual({
    memberId: 'owner',
    action: 'runtime-keys.manage',
  })
  await expect(
    page.getByRole('textbox', { name: 'New API key', exact: true }),
  ).toHaveValue(browserKey.token)
  const browserCaller = await page.request.get(runtime, {
    headers: { authorization: 'Bearer ' + browserKey.token },
  })
  expect(browserCaller.status()).toBe(200)
  expect(await browserCaller.json()).toEqual(body)
  await page
    .getByRole('button', { name: 'I saved this API key', exact: true })
    .click()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('combobox', { name: 'Member role', exact: true }).click()
  await page
    .getByRole('option', { name: 'Viewer · read APIs', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'New member API access', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Selected APIs only', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', {
      name: 'Share Reviewed article API',
      exact: true,
    }),
  ).toHaveCount(0)
})

test('owner opens a sealed Content snapshot as a read-only Studio graph', async ({
  page,
  htmlWorkspace,
}) => {
  const headers = {
    origin: htmlPreviewOrigin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const createdResponse = await page.request.post(
    htmlPreviewOrigin +
      '/api/collections/' +
      htmlWorkspace.collectionId +
      '/entries/' +
      htmlWorkspace.entryId +
      '/snapshot-flow',
    {
      headers,
      data: {
        name: 'Article snapshot',
        path: '/article-snapshot',
        collectionVersion: 1,
        entryVersion: 1,
        rendererVersion: 0,
        fieldPath: ['body'],
      },
    },
  )
  expect(createdResponse.status()).toBe(200)

  const created = await createdResponse.json()
  const flowUrl = htmlPreviewOrigin + '/api/flows/' + created.id
  const terminal = created.nodes.find(
    (node: { type: string }) => node.type === 'cmsSnapshotResponse',
  )
  let writes = 0
  page.on('request', (request) => {
    if (request.url() === flowUrl && request.method() !== 'GET') writes += 1
  })

  await signInPreview(page, htmlWorkspace.owner)
  const card = page.locator('.flow-card.cmsSnapshotResponse')
  await expect(card).toBeVisible()
  await expect(
    card.getByText('Content snapshot', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Article snapshot',
  )
  await expect(page.getByLabel('API name', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Endpoint path', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('combobox', { name: 'API type', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('combobox', { name: 'HTTP method', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Add step', exact: true }),
  ).toBeDisabled()

  await card.click()
  const inspector = page.locator('.inspector')
  await expect(
    inspector.getByRole('heading', { name: 'Content snapshot', exact: true }),
  ).toBeVisible()
  await expect(
    inspector.getByLabel('Snapshot ID', { exact: true }),
  ).toHaveValue(terminal.config.snapshotId)
  await expect(
    inspector.getByLabel('Snapshot SHA-256', { exact: true }),
  ).toHaveValue(terminal.config.snapshotSha256)
  await expect(
    inspector.getByRole('button', {
      name: 'Advanced configuration',
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    inspector.getByRole('button', { name: 'Remove node', exact: true }),
  ).toHaveCount(0)

  await page.keyboard.press('Delete')
  await expect(page.locator('.flow-card')).toHaveCount(2)
  expect(writes).toBe(0)
  const after = await page.request.get(flowUrl, { headers })
  expect(after.status()).toBe(200)
  expect(await after.json()).toEqual(created)
})
