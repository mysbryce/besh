import {
  expect,
  type Frame,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'

export type RichTextArticle = {
  entries: string
  origin: string
  headers: {
    origin: string
    authorization: string
  }
}

// Link review contributes four images, paste one, and pending-save recovery two.
export const richTextInteractionPreviewCount = 7

async function createEntry(page: Page, article: RichTextArticle) {
  const reply = page.waitForResponse(
    (response) =>
      response.url() === article.entries &&
      response.request().method() === 'POST',
  )

  await page.getByRole('button', { name: 'Create entry', exact: true }).click()

  const response = await reply
  expect(response.status()).toBe(200)

  return response.json()
}

export async function verifyRichTextLinkInteraction(
  page: Page,
  article: RichTextArticle,
  capture: PreviewCapture,
) {
  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  const review = page.getByRole('group', { name: 'Link URL', exact: true })
  const url = page.getByRole('textbox', { name: 'Link URL', exact: true })
  const create = page.getByRole('button', { name: 'Create entry', exact: true })
  const location = page.url()
  const navigations: string[] = []
  const writes: string[] = []
  const popups: Page[] = []

  const observeNavigation = (frame: Frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url())
  }
  const observePopup = (popup: Page) => {
    popups.push(popup)
  }
  const observeWrite = (request: Request) => {
    if (request.url() === article.entries && request.method() === 'POST') {
      writes.push(request.url())
    }
  }

  page.on('framenavigated', observeNavigation)
  page.on('popup', observePopup)
  page.on('request', observeWrite)

  try {
    await editor.fill('Read guide')
    await editor.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Add link', exact: true }).click()
    await expect(url).toBeFocused()
    await expect(create).toBeDisabled()
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    await expect(editor).toHaveText('Read guide')

    await url.fill('https://example.com/guide')
    await capture(
      'Rich text',
      'Pending HTTPS link review',
      'The selected text stays unchanged and entry saving waits for explicit link application or cancellation.',
    )

    await url.fill('http://example.com/unsafe')
    await url.press('Enter')
    await expect(review).toBeVisible()
    await expect(url).toHaveAttribute('aria-invalid', 'true')
    await expect(review.getByRole('alert')).toHaveText(
      'Enter a complete HTTPS URL without credentials.',
    )
    await expect(create).toBeDisabled()
    await expect(editor.locator('a')).toHaveCount(0)
    expect(writes).toEqual([])
    await capture(
      'Rich text',
      'Rejected unsafe link URL',
      'A non-HTTPS URL shows its correction message, creates no link and keeps entry saving blocked.',
    )

    await url.fill('https://example.com/guide')
    await url.press('Enter')

    await expect(review).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expect(editor.locator('a')).toHaveAttribute(
      'href',
      'https://example.com/guide',
    )
    await expect(create).toBeEnabled()
    expect(writes).toEqual([])
    await capture(
      'Rich text',
      'Keyboard applied safe link',
      'Enter applies the reviewed HTTPS URL and returns focus to the article without saving or navigating.',
    )

    await editor.locator('a').click()
    await expect(page).toHaveURL(location)
    await editor.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Edit link', exact: true }).click()
    await expect(url).toHaveValue('https://example.com/guide')
    await url.fill('https://example.com/canceled-keyboard')
    await url.press('Escape')

    await expect(review).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expect(editor.locator('a')).toHaveAttribute(
      'href',
      'https://example.com/guide',
    )
    await expect(create).toBeEnabled()

    await editor.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Edit link', exact: true }).click()
    await url.fill('https://example.com/reviewed')
    await review
      .getByRole('button', { name: 'Apply link', exact: true })
      .click()
    await expect(editor.locator('a')).toHaveAttribute(
      'href',
      'https://example.com/reviewed',
    )
    await capture(
      'Rich text',
      'Reviewed link edit',
      'An explicitly applied URL edit keeps the selected authored text and does not navigate to the destination.',
    )

    await editor.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Edit link', exact: true }).click()
    await url.fill('https://example.com/canceled-button')
    await review.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(review).toHaveCount(0)
    await expect(editor).toBeFocused()
    await expect(editor.locator('a')).toHaveAttribute(
      'href',
      'https://example.com/reviewed',
    )

    await editor.press('ControlOrMeta+a')
    await page.getByRole('button', { name: 'Remove link', exact: true }).click()
    await expect(editor.locator('a')).toHaveCount(0)
    await expect(editor).toHaveText('Read guide')
    expect(writes).toEqual([])

    const created = await createEntry(page, article)
    const body = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Read guide', marks: [] }],
        },
      ],
    }
    expect(created.data).toEqual({ body })

    const read = await page.request.get(article.entries + '/' + created.id, {
      headers: article.headers,
    })
    expect(read.status()).toBe(200)
    expect((await read.json()).data).toEqual({ body })
    expect(writes).toHaveLength(1)
    expect(navigations).toEqual([])
    expect(popups).toEqual([])
  } finally {
    page.off('framenavigated', observeNavigation)
    page.off('popup', observePopup)
    page.off('request', observeWrite)
  }
}

export async function verifyRichTextClipboardInteraction(
  page: Page,
  article: RichTextArticle,
  capture: PreviewCapture,
) {
  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  const imageRequests: string[] = []

  const observeImage = (request: Request) => {
    if (request.url() === article.origin + '/clipboard-probe') {
      imageRequests.push(request.url())
    }
  }

  page.on('request', observeImage)

  try {
    await editor.fill('Replace this selection')
    await editor.press('ControlOrMeta+a')

    // Exercise browser paste handlers without claiming an OS clipboard journey.
    await editor.evaluate((element) => {
      const clipboard = new DataTransfer()
      clipboard.setData(
        'text/html',
        '<h1 onclick="document.body.dataset.clipboardExecuted=\'yes\'">Injected heading</h1>' +
          '<script>document.body.dataset.clipboardExecuted="yes"</script>' +
          '<img src="/clipboard-probe" onerror="document.body.dataset.clipboardExecuted=\'yes\'">' +
          '<a href="javascript:document.body.dataset.clipboardExecuted=\'yes\'">Unsafe link</a>',
      )
      clipboard.setData(
        'text/plain',
        'Literal <script>never run</script> & ไทย',
      )

      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboard,
        }),
      )
    })

    await expect(editor).toHaveText('Literal <script>never run</script> & ไทย')
    await expect(editor.locator('h1, script, img, a')).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveAttribute(
      'data-clipboard-executed',
      'yes',
    )
    await capture(
      'Rich text',
      'Literal browser paste content',
      'The browser paste-event fixture preserves plain text literally while hostile HTML creates no elements or image requests.',
    )

    const created = await createEntry(page, article)
    const body = {
      type: 'document',
      astVersion: 2,
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: 'Literal <script>never run</script> & ไทย',
              marks: [],
            },
          ],
        },
      ],
    }
    expect(created.data).toEqual({ body })

    const read = await page.request.get(article.entries + '/' + created.id, {
      headers: article.headers,
    })
    expect(read.status()).toBe(200)
    expect((await read.json()).data).toEqual({ body })
    expect(imageRequests).toEqual([])
  } finally {
    page.off('request', observeImage)
  }
}

export async function verifyRichTextPendingInteraction(
  page: Page,
  article: RichTextArticle,
  capture: PreviewCapture,
) {
  const editor = page.getByRole('textbox', { name: 'Body', exact: true })
  const create = page.getByRole('button', { name: 'Create entry', exact: true })
  const body = {
    type: 'document',
    astVersion: 2,
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Saved while held', marks: [] }],
      },
    ],
  }
  let release!: () => void
  let markCommitted!: () => void
  let markFinished!: () => void
  let ownedRequest: Request | undefined
  let committedEntry: { id: string; data: unknown } | undefined
  let failure: unknown
  const released = new Promise<void>((done) => {
    release = done
  })
  const committed = new Promise<void>((done) => {
    markCommitted = done
  })
  const finished = new Promise<void>((done) => {
    markFinished = done
  })
  let settleDelivery!: (
    result: { response: Response } | { error: unknown },
  ) => void
  const delivery = new Promise<{ response: Response } | { error: unknown }>(
    (done) => {
      settleDelivery = done
    },
  )
  const receive = (response: Response) => {
    if (response.request() === ownedRequest) settleDelivery({ response })
  }
  const failed = (request: Request) => {
    if (request === ownedRequest) {
      settleDelivery({ error: new Error('Held entry response failed') })
    }
  }
  const hold = async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    ownedRequest = route.request()

    try {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(200)
      committedEntry = await response.json()
      markCommitted()

      await released
      await route.fulfill({ response })
    } catch (reason) {
      failure = reason
      markCommitted()

      await route.abort().catch(() => {})
    } finally {
      markFinished()
    }
  }

  await editor.fill('Saved while held')
  page.on('response', receive)
  page.on('requestfailed', failed)

  try {
    await page.route(article.entries, hold)
    await create.click()
    await committed

    if (failure) throw failure
    expect(committedEntry?.data).toEqual({ body })
    expect(ownedRequest?.postDataJSON()).toEqual({ data: { body } })

    const read = await page.request.get(
      article.entries + '/' + committedEntry!.id,
      { headers: article.headers },
    )
    expect(read.status()).toBe(200)
    expect((await read.json()).data).toEqual({ body })

    await expect(create).toBeDisabled()
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    await expect(editor).toHaveAttribute('aria-disabled', 'true')
    await expect(
      page.getByRole('button', { name: 'New entry', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('combobox', { name: 'Body block style', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Bold', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Add link', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Insert table', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled()

    await editor.press('x')
    await expect(editor).toHaveText('Saved while held')
    await capture(
      'Rich text',
      'Held entry creation response',
      'The real entry is committed while its response waits; article editing, formatting and navigation remain disabled.',
    )
  } finally {
    release()

    try {
      if (ownedRequest) {
        await finished

        const result = await delivery
        if ('response' in result) {
          failure ??= await result.response.finished()
        } else {
          failure ??= result.error
        }
      }
    } finally {
      page.off('response', receive)
      page.off('requestfailed', failed)

      await page.unroute(article.entries, hold)
    }
  }

  if (failure) throw failure

  await expect(
    page.getByRole('heading', { name: 'Saved entry', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'New entry', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()

  await expect(editor).toHaveAttribute('contenteditable', 'true')
  await expect(
    page.getByRole('combobox', { name: 'Body block style', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Bold', exact: true }),
  ).toBeEnabled()
  await editor.fill('Can edit again')
  await expect(editor).toHaveText('Can edit again')
  await capture(
    'Rich text',
    'Recovered article editing',
    'After the real save response arrives, explicit Edit entry restores formatting and unsaved typing without changing saved content.',
  )

  const read = await page.request.get(
    article.entries + '/' + committedEntry!.id,
    { headers: article.headers },
  )
  expect(read.status()).toBe(200)
  expect((await read.json()).data).toEqual({ body })
}

export async function richTextInteractionPreviews({
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
  const name = 'Interaction preview articles'
  const modelResponse = await page.request.post(origin + '/api/structs', {
    headers,
    data: {
      name,
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
      data: { name, structId: model.id, structVersion: 1 },
    },
  )
  expect(collectionResponse.status()).toBe(200)
  const collection = await collectionResponse.json()
  const article: RichTextArticle = {
    origin,
    headers,
    entries: origin + '/api/collections/' + collection.id + '/entries',
  }

  for (const journey of [
    verifyRichTextLinkInteraction,
    verifyRichTextClipboardInteraction,
    verifyRichTextPendingInteraction,
  ]) {
    await page.goto(origin)

    const token = page.getByLabel('Workspace token', { exact: true })
    const content = page.getByRole('button', { name: 'Content', exact: true })
    await expect(token.or(content)).toBeVisible()

    if (await token.isVisible()) {
      await token.fill(owner)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
    }

    await content.click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page.getByRole('option', { name, exact: true }).click()
    await page.getByRole('button', { name: 'New entry', exact: true }).click()

    await journey(page, article, capture)
  }
}
