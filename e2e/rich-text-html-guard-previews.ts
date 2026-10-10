import { expect, type Page } from '@playwright/test'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import {
  seedHtmlPreviewWorkspace,
  type HtmlPreviewWorkspace,
} from './rich-text-html-seed'

export const richTextHtmlGuardPreviewCount = 4

export async function richTextHtmlGuardPreviews({
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
  const htmlWorkspace =
    workspace ?? (await seedHtmlPreviewWorkspace(page, origin, owner))
  let count = 0

  async function record(title: string, detail: string) {
    const frame = page.locator('.collection-review iframe[sandbox=""][srcdoc]')
    const rendered = (await frame.count()) > 0
    if (rendered) {
      await expect(frame.contentFrame().locator('h1')).toHaveText(
        'Saved heading ไทย',
      )
      await frame.scrollIntoViewIfNeeded()
      await expect(frame).toBeInViewport()
    }

    await capture('Rich-text HTML', title, detail, {
      ...(rendered ? { fullPage: false } : {}),
    })
    count += 1
  }

  await signInPreview(page, htmlWorkspace.owner)
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Choose a collection', exact: true })
    .click()
  await page
    .getByRole('option', { name: htmlWorkspace.collectionName, exact: true })
    .click()
  const row = page
    .locator('.content-entry-row')
    .filter({ hasText: htmlWorkspace.entryId })
  await row.click()
  await expect(
    page.getByRole('heading', { name: 'Saved entry', exact: true }),
  ).toBeVisible()

  const headers = {
    origin: origin,
    authorization: 'Bearer ' + htmlWorkspace.owner,
  }
  const entryPath =
    origin +
    '/api/collections/' +
    htmlWorkspace.collectionId +
    '/entries/' +
    htmlWorkspace.entryId
  async function savedState() {
    const result = []
    for (const path of [
      origin + '/api/collections/' + htmlWorkspace.collectionId,
      entryPath,
      origin + '/api/audit',
    ]) {
      const response = await page.request.get(path, { headers })
      expect(response.status()).toBe(200)
      result.push(await response.json())
    }

    return result
  }
  const before = await savedState()
  const preview = page.getByRole('button', {
    name: 'Preview HTML',
    exact: true,
  })
  await expect(preview).toBeEnabled()
  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await expect(preview).toHaveCount(0)
  await page.getByLabel('Title', { exact: true }).fill('Unsaved title ไทย')
  await expect(preview).toHaveCount(0)
  expect(await savedState()).toEqual(before)
  await record(
    'Dirty entry excludes HTML preview',
    'An unsaved literal title stays in the editor while private HTML preview is absent and saved content remains unchanged.',
  )

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Discard unsaved entry changes?')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Reload entry', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    htmlWorkspace.title,
  )
  await expect(preview).toBeEnabled()
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await expect(preview).toHaveCount(0)
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Discard unsaved entry changes?')
    await dialog.accept()
  })
  await row.click()
  await expect(preview).toBeEnabled()

  const peer = await page.request.put(entryPath, {
    headers,
    data: {
      version: 1,
      data: { ...before[1].data, title: 'Peer saved title ไทย' },
    },
  })
  expect(peer.status()).toBe(200)
  expect((await peer.json()).version).toBe(2)
  const afterPeer = await savedState()
  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  await preview.click()

  const review = page.getByRole('region', {
    name: 'Private HTML preview',
    exact: true,
  })
  const previewPath = entryPath + '/render-preview'
  const staleReply = page.waitForResponse(
    (response) =>
      response.url() === previewPath && response.request().method() === 'POST',
  )
  await review
    .getByRole('button', { name: 'Generate HTML preview', exact: true })
    .click()
  const stale = await staleReply
  expect(stale.status()).toBe(409)
  expect(stale.request().postDataJSON().entryVersion).toBe(1)
  await expect(review).toHaveCount(0)
  await expect(preview).toBeDisabled()
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Content entry changed. Reload before previewing.' })
      .first(),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Edit entry', exact: true }),
  ).toBeDisabled()
  expect(await savedState()).toEqual(afterPeer)
  await record(
    'Real stale entry requires reload',
    'The actual peer update makes the original revision return 409; no HTML is shown, editing and preview are blocked, and explicit reload is required.',
  )

  await page.getByRole('button', { name: 'Reload entry', exact: true }).click()
  await expect(
    page.getByText('Entry revision 2', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Peer saved title ไทย',
  )
  await preview.click()

  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let received!: (status: number) => void
  const actualResponse = new Promise<number>((resolve) => {
    received = resolve
  })
  let routeStarted = false
  let finishRoute!: () => void
  const routeFinished = new Promise<void>((resolve) => {
    finishRoute = resolve
  })
  await page.route(previewPath, async (route) => {
    routeStarted = true

    try {
      const response = await route.fetch()
      received(response.status())
      await held
      await route.fulfill({ response })
    } finally {
      finishRoute()
    }
  })
  try {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url() === previewPath &&
        response.request().method() === 'POST',
    )
    await review
      .getByRole('button', { name: 'Generate HTML preview', exact: true })
      .click()
    expect(await actualResponse).toBe(200)
    await expect(
      review.getByRole('button', { name: 'Close HTML preview', exact: true }),
    ).toBeDisabled()
    await expect(
      review.getByRole('combobox', { name: 'Rich-text field', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toBeDisabled()
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveCount(0)
    await record(
      'Pending real HTML response blocks actions',
      'The real server has returned 200 while browser delivery waits; navigation, field selection and close remain disabled with no source shown.',
    )
    release()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON().entryVersion).toBe(2)
    await expect(
      review.getByRole('textbox', { name: 'HTML source', exact: true }),
    ).toHaveValue(
      '<h1>Saved heading ไทย</h1><p>&lt;script&gt;literal&lt;/script&gt; &amp; text <a href="https://example.invalid/preview?note=a&amp;tag=b">Open article</a></p>',
    )
    expect(await savedState()).toEqual(afterPeer)
    await record(
      'Reloaded revision two HTML recovered',
      'Explicit reload and completed real delivery show the exact source for saved revision two without further content or audit effects.',
    )
  } finally {
    release()

    if (routeStarted) await routeFinished

    await page.unroute(previewPath)
  }

  expect(count).toBe(richTextHtmlGuardPreviewCount)

  return count
}
