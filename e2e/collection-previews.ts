import { expect, type Page } from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const contentLanguages = [
  [
    'en',
    'English',
    'Content',
    'Save entry',
    'Delete entry',
    'Tags item 1',
    'View content model',
  ],
  [
    'th',
    'ไทย',
    'เนื้อหา',
    'บันทึกรายการ',
    'ลบรายการ',
    'Tags รายการที่ 1',
    'ดูโมเดลเนื้อหา',
  ],
  ['zh', '中文', '内容', '保存条目', '删除条目', 'Tags 项 1', '查看内容模型'],
  [
    'ru',
    'Русский',
    'Контент',
    'Сохранить запись',
    'Удалить запись',
    'Tags, элемент 1',
    'Посмотреть модель контента',
  ],
  [
    'ja',
    '日本語',
    'コンテンツ',
    '項目を保存',
    '項目を削除',
    'Tags の項目 1',
    'コンテンツモデルを表示',
  ],
  [
    'ko',
    '한국어',
    '콘텐츠',
    '항목 저장',
    '항목 삭제',
    'Tags 항목 1',
    '콘텐츠 모델 보기',
  ],
  [
    'pt',
    'Português',
    'Conteúdo',
    'Salvar entrada',
    'Excluir entrada',
    'Tags item 1',
    'Ver modelo de conteúdo',
  ],
] as const

async function contentLanguagePreviews({
  page,
  origin,
  capture,
}: {
  page: Page
  origin: string
  capture: PreviewCapture
}) {
  const requests: string[] = []
  const observe = (request: import('@playwright/test').Request) => {
    if (
      request.url().startsWith(origin + '/api/collections') ||
      request.url().startsWith(origin + '/api/structs')
    )
      requests.push(request.method() + ' ' + request.url())
  }

  page.on('request', observe)

  try {
    for (const [
      language,
      label,
      heading,
      save,
      remove,
      item,
      model,
    ] of contentLanguages) {
      await chooseManagementLanguage(page, label)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: save, exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('button', { name: remove, exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('button', { name: model, exact: true }),
      ).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
        '  Hand edited  ',
      )
      await expect(page.getByLabel('Price', { exact: true })).toHaveValue(
        '12.5',
      )
      await expect(
        page.getByLabel('Details · Description', { exact: true }),
      ).toHaveValue('Public description <em>literal</em>')
      await expect(page.getByLabel(item, { exact: true })).toHaveValue(
        'Literal after removal',
      )
      await expect(
        page.getByRole('combobox', { name: 'Category', exact: true }),
      ).toHaveText('Wholesale')
      await capture(
        'Content',
        `Edited private content ${language}`,
        'Language changes keep authored labels, choice values, whitespace, raw number text and nested list content unchanged without fetching or writing a schema, collection or entry.',
      )
      await page.setViewportSize({ width: 390, height: 844 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390)
      for (const name of [save, remove]) {
        const target = await page
          .getByRole('button', { name, exact: true })
          .boundingBox()
        expect(target).not.toBeNull()
        expect(target!.width).toBeGreaterThanOrEqual(44)
        expect(target!.height).toBeGreaterThanOrEqual(44)
      }
      await capture(
        'Content',
        `Phone edited private content ${language}`,
        'The translated private entry form remains contained at 390 pixels with readable nested fields and touch-sized save and deletion controls.',
      )
      await page.setViewportSize({ width: 1440, height: 1000 })
    }

    expect(requests).toEqual([])
  } finally {
    page.off('request', observe)
  }

  await chooseManagementLanguage(page, 'English')
}

export async function collectionPreviews({
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
  const modelResponse = await page.request.post(origin + '/api/structs', {
    headers: { authorization: 'Bearer ' + owner, origin },
    data: {
      name: 'Products',
      fields: [
        {
          key: 'title',
          label: 'Title',
          required: true,
          schema: { type: 'text' },
        },
        {
          key: 'price',
          label: 'Price',
          required: true,
          schema: { type: 'number' },
        },
        {
          key: 'available',
          label: 'Available',
          required: false,
          schema: { type: 'boolean' },
        },
        {
          key: 'details',
          label: 'Details',
          required: false,
          schema: {
            type: 'object',
            fields: [
              {
                key: 'description',
                label: 'Description',
                required: false,
                schema: { type: 'text' },
              },
            ],
          },
        },
        {
          key: 'tags',
          label: 'Tags',
          required: false,
          schema: { type: 'array', items: { type: 'text' } },
        },
        {
          key: 'category',
          label: 'Category',
          required: true,
          schema: {
            type: 'select',
            options: [
              { value: 'retail', label: 'Retail' },
              { value: 'wholesale', label: 'Wholesale' },
            ],
          },
        },
      ],
    },
  })
  expect(modelResponse.status()).toBe(200)
  const model = await modelResponse.json()

  await page.goto(origin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Content', exact: true }),
  ).toBeVisible()
  await capture(
    'Content',
    'Private content catalog',
    'Owner-only Content keeps private collection management separate from published APIs.',
  )
  await page
    .getByRole('button', { name: 'New collection', exact: true })
    .click()
  await capture(
    'Content',
    'New private collection',
    'Name a collection and choose an existing saved content model without editing JSON.',
  )
  await page
    .getByLabel('Collection name', { exact: true })
    .fill('Shop inventory')
  await page
    .getByRole('combobox', { name: 'Content model', exact: true })
    .click()
  await capture(
    'Content',
    'Choose saved content model',
    'The custom accessible selector lists saved content models for explicit review.',
    { region: 'listbox' },
  )
  await page.getByRole('option', { name: 'Products', exact: true }).click()
  await expect(
    page.getByText('Content model revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Content',
    'Reviewed saved content model',
    'Review the exact saved model revision and all six typed fields before binding a private collection.',
  )

  const entryPagePattern =
    /\/api\/collections\/[^/?]+\/entries\?offset=0&limit=20$/
  let firstCatalogFailed = false
  await page.route(entryPagePattern, async (route) => {
    if (!firstCatalogFailed && route.request().method() === 'GET') {
      firstCatalogFailed = true
      await route.abort('failed')
      return
    }

    await route.continue()
  })

  const savedResponse = page.waitForResponse(
    (response) =>
      response.url() === origin + '/api/collections' &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Create collection', exact: true })
    .click()
  const response = await savedResponse
  expect(response.status()).toBe(200)
  const collection = await response.json()
  expect(collection).toEqual({
    id: expect.any(String),
    name: 'Shop inventory',
    version: 1,
    struct: {
      id: model.id,
      version: 1,
      name: 'Products',
      fields: model.fields,
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })
  await expect(
    page.getByRole('heading', { name: 'Shop inventory', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Private collection', { exact: true }),
  ).toBeVisible()

  await expect(
    page.getByRole('button', { name: 'View content model', exact: true }),
  ).toBeVisible()
  const savedFields = page.getByRole('region', {
    name: 'Saved content model',
    exact: true,
  })
  await expect(savedFields.getByText('title', { exact: true })).toBeHidden()
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(
    page.getByRole('heading', { name: 'Entries', exact: true }),
  ).toBeInViewport()
  await page
    .getByRole('button', { name: 'View content model', exact: true })
    .click()
  await expect(savedFields.getByText('title', { exact: true })).toBeVisible()
  await capture(
    'Content',
    'Inspect frozen collection fields',
    'Saved field structure remains available through an explicit accessible disclosure, separate from the common entry workflow.',
  )
  await page
    .getByRole('button', { name: 'Hide content model', exact: true })
    .click()
  await expect(savedFields.getByText('title', { exact: true })).toBeHidden()
  await capture(
    'Content',
    'Compact private collection',
    'Collapsing the saved model keeps entry actions reachable without repeatedly showing the complete nested schema.',
  )

  await expect(page.locator('.content-entries [role="alert"]')).toBeVisible()
  expect(firstCatalogFailed).toBe(true)
  await capture(
    'Content',
    'Private entry catalog failure',
    'Controlled network failure exposes a recoverable entry catalog error without losing the successfully created collection.',
  )
  const refreshedEntries = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin +
          '/api/collections/' +
          collection.id +
          '/entries?offset=0&limit=20' && reply.request().method() === 'GET',
  )
  await page
    .getByRole('button', { name: 'Refresh entries', exact: true })
    .click()
  expect((await refreshedEntries).status()).toBe(200)
  await expect(page.locator('.content-entries [role="alert"]')).toHaveCount(0)
  await expect(page.locator('.statusbar [role="status"]')).toHaveText(
    'Workspace ready.',
  )
  await page.unroute(entryPagePattern)
  await capture(
    'Content',
    'Private entry catalog recovery',
    'A real successful explicit refresh removes the resolved catalog error and restores the ready status.',
  )

  const changedModel = await page.request.put(
    origin + '/api/structs/' + model.id,
    {
      headers: { authorization: 'Bearer ' + owner, origin },
      data: {
        version: 1,
        name: 'Changed products',
        fields: [model.fields[0]],
      },
    },
  )
  expect(changedModel.status()).toBe(200)
  await capture(
    'Content',
    'Frozen private collection',
    'Later saved-model edits leave the reviewed collection definition unchanged.',
  )
  await page.getByRole('button', { name: 'New entry', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('')
  await page.getByLabel('Price', { exact: true }).fill('0')
  await page
    .getByRole('checkbox', { name: 'Include Available', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', { name: 'Available', exact: true }),
  ).not.toBeChecked()
  await page
    .getByRole('checkbox', { name: 'Include Details', exact: true })
    .click()
  await page
    .getByRole('checkbox', { name: 'Include Tags', exact: true })
    .click()
  await page.getByRole('combobox', { name: 'Category', exact: true }).click()
  await page.getByRole('option', { name: 'Retail', exact: true }).click()
  await capture(
    'Content',
    'New typed private entry',
    'Labeled fields preserve empty text, zero, false, an empty group and empty list; optional inclusion is explicit.',
  )

  const entryResponse = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin + '/api/collections/' + collection.id + '/entries' &&
      reply.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create entry', exact: true }).click()
  const reply = await entryResponse
  expect(reply.status()).toBe(200)
  const entry = await reply.json()
  expect(entry).toEqual({
    id: expect.any(String),
    collectionId: collection.id,
    version: 1,
    data: {
      title: '',
      price: 0,
      available: false,
      details: {},
      tags: [],
      category: 'retail',
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })
  await expect(
    page.getByText('Entry revision 1', { exact: true }),
  ).toBeVisible()
  const detailResponse = await page.request.get(
    origin + '/api/collections/' + collection.id + '/entries/' + entry.id,
    { headers: { authorization: 'Bearer ' + owner } },
  )
  expect(detailResponse.status()).toBe(200)
  expect(await detailResponse.json()).toEqual(entry)
  await capture(
    'Content',
    'Saved private typed entry',
    'An actual created entry is read-only until Edit is selected; its saved revision stays visible.',
  )

  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('  Hand edited  ')
  await page.getByLabel('Price', { exact: true }).fill('12.5')
  await page
    .getByRole('checkbox', { name: 'Include Available', exact: true })
    .click()
  await page
    .getByRole('checkbox', {
      name: 'Include Details · Description',
      exact: true,
    })
    .click()
  await page
    .getByLabel('Details · Description', { exact: true })
    .fill('Public description <em>literal</em>')
  await page
    .getByRole('button', { name: 'Add item to Tags', exact: true })
    .click()
  await page.getByLabel('Tags item 1', { exact: true }).fill('First item')
  await page
    .getByRole('button', { name: 'Add item to Tags', exact: true })
    .click()
  await page
    .getByLabel('Tags item 2', { exact: true })
    .fill('Literal after removal')

  await page.setViewportSize({ width: 390, height: 844 })
  for (const appearance of ['Light', 'Dark']) {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: appearance, exact: true }).click()
    const target = await page
      .getByRole('button', { name: 'Remove Tags item 1', exact: true })
      .boundingBox()
    expect(target).not.toBeNull()
    expect(target!.width).toBeGreaterThanOrEqual(44)
    expect(target!.height).toBeGreaterThanOrEqual(44)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
    await capture(
      'Content',
      `Phone ${appearance.toLowerCase()} nested private entry`,
      'Nested groups and stable list items remain readable with custom controls and 44-pixel actions in both appearances.',
    )
  }
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page
    .getByRole('button', { name: 'Remove Tags item 1', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Add item to Tags', exact: true }),
  ).toBeFocused()
  await expect(page.getByLabel('Tags item 1', { exact: true })).toHaveValue(
    'Literal after removal',
  )
  await page.getByRole('combobox', { name: 'Category', exact: true }).click()
  await page.getByRole('option', { name: 'Wholesale', exact: true }).click()
  await capture(
    'Content',
    'Edited nested private entry',
    'Edit typed content, remove an optional field and a list item, and preserve literal markup as ordinary text.',
  )

  await contentLanguagePreviews({ page, origin, capture })

  const updatedResponse = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin + '/api/collections/' + collection.id + '/entries/' + entry.id &&
      reply.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  const updatedReply = await updatedResponse
  expect(updatedReply.status()).toBe(200)
  expect(updatedReply.request().postDataJSON()).toEqual({
    version: 1,
    data: {
      title: '  Hand edited  ',
      price: 12.5,
      details: { description: 'Public description <em>literal</em>' },
      tags: ['Literal after removal'],
      category: 'wholesale',
    },
  })
  const updated = await updatedReply.json()
  expect(updated).toEqual({
    ...entry,
    version: 2,
    data: {
      title: '  Hand edited  ',
      price: 12.5,
      details: { description: 'Public description <em>literal</em>' },
      tags: ['Literal after removal'],
      category: 'wholesale',
    },
    updatedAt: expect.any(String),
  })
  await expect(
    page.getByText('Entry revision 2', { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Edit entry', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Unsaved local change')
  const concurrentResponse = await page.request.put(
    origin + '/api/collections/' + collection.id + '/entries/' + entry.id,
    {
      headers: { authorization: 'Bearer ' + owner, origin },
      data: {
        version: 2,
        data: { ...updated.data, title: 'Current server copy' },
      },
    },
  )
  expect(concurrentResponse.status()).toBe(200)
  const concurrent = await concurrentResponse.json()
  const conflictingReply = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin + '/api/collections/' + collection.id + '/entries/' + entry.id &&
      reply.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  expect((await conflictingReply).status()).toBe(409)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved local change',
  )
  await expect(
    page.getByText('Entry revision 2', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save entry', exact: true }),
  ).toBeDisabled()
  await expect(page.locator('.content-entries [role="alert"]')).toHaveText(
    'Content entry changed. Reload before saving.',
  )
  await capture(
    'Content',
    'Concurrent private entry edit rejected',
    'A stale save preserves unsaved local input and requires an explicit review of the current entry.',
  )

  const refreshedConflict = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin +
          '/api/collections/' +
          collection.id +
          '/entries?offset=0&limit=20' && reply.request().method() === 'GET',
  )
  await page
    .getByRole('button', { name: 'Refresh entries', exact: true })
    .click()
  expect((await refreshedConflict).status()).toBe(200)
  await expect(page.locator('.statusbar [role="status"]')).toHaveText(
    'Content entry changed. Reload before saving.',
  )
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved local change',
  )

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Content', exact: true }),
  ).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Reload entry', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Unsaved local change',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await capture(
    'Content',
    'Cancelled private entry reload',
    'Cancelling reload leaves the unsaved local edit and original revision intact.',
  )
  await page.getByRole('button', { name: 'Reload entry', exact: true }).click()
  await expect(
    page.getByText('Entry revision 3', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Current server copy',
  )
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled()
  await expect(page.locator('.content-entries [role="alert"]')).toHaveCount(0)
  await expect(page.locator('.statusbar [role="status"]')).toHaveText(
    'Entry loaded.',
  )
  expect(concurrent.version).toBe(3)
  await capture(
    'Content',
    'Reloaded private entry',
    'Explicitly confirmed reload adopts the current server revision without retrying the stale save.',
  )

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click()
  await expect(
    page.getByText('Entry revision 3', { exact: true }),
  ).toBeVisible()
  await capture(
    'Content',
    'Cancelled private entry deletion',
    'Cancelling deletion sends no deletion request and preserves the saved content.',
  )
  const newerResponse = await page.request.put(
    origin + '/api/collections/' + collection.id + '/entries/' + entry.id,
    {
      headers: { authorization: 'Bearer ' + owner, origin },
      data: {
        version: 3,
        data: { ...concurrent.data, title: 'Review before deletion' },
      },
    },
  )
  expect(newerResponse.status()).toBe(200)
  const staleDelete = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin + '/api/collections/' + collection.id + '/entries/' + entry.id &&
      reply.request().method() === 'DELETE',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click()
  expect((await staleDelete).status()).toBe(409)
  await expect(page.locator('.content-entries [role="alert"]')).toHaveText(
    'Content entry changed. Reload before deleting.',
  )
  await expect(
    page.getByRole('button', { name: 'Delete entry', exact: true }),
  ).toBeDisabled()
  await capture(
    'Content',
    'Concurrent private entry deletion rejected',
    'The reviewed version changed before deletion; content remains saved and deletion is blocked until reload.',
  )
  await page.getByRole('button', { name: 'Reload entry', exact: true }).click()
  await expect(
    page.getByText('Entry revision 4', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Review before deletion',
  )
  await capture(
    'Content',
    'Reviewed current entry before deletion',
    'The current version is visibly reloaded before a separate explicit deletion confirmation.',
  )
  const deletedResponse = page.waitForResponse(
    (reply) =>
      reply.url() ===
        origin + '/api/collections/' + collection.id + '/entries/' + entry.id &&
      reply.request().method() === 'DELETE',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click()
  const deletedReply = await deletedResponse
  expect(deletedReply.status()).toBe(200)
  expect(deletedReply.request().postDataJSON()).toEqual({ version: 4 })
  expect(await deletedReply.json()).toEqual({ ok: true })
  await expect(page.getByText('No entries yet', { exact: true })).toBeVisible()
  await expect(page.getByText('0 saved entries', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Shop inventory', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.statusbar [role="status"]')).toHaveText(
    'Entry deleted.',
  )
  const removedEntry = await page.request.get(
    origin + '/api/collections/' + collection.id + '/entries/' + entry.id,
    { headers: { authorization: 'Bearer ' + owner } },
  )
  expect(removedEntry.status()).toBe(404)

  await capture(
    'Content',
    'Private collection after entry deletion',
    'Reviewed deletion removes only the current saved entry and retains its private collection and frozen content model.',
  )
}
