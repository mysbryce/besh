import {
  expect,
  type Page,
  type Request,
  type Response,
  type Route,
} from '@playwright/test'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const languages = [
  [
    'en',
    'English',
    'Content models',
    'Model name',
    'Field 1 label',
    'Save draft',
    'Draft revision 2',
    'Content model draft saved.',
  ],
  [
    'th',
    'ไทย',
    'โมเดลเนื้อหา',
    'ชื่อโมเดล',
    'ชื่อแสดงของฟิลด์ 1',
    'บันทึกฉบับร่าง',
    'ฉบับร่างเวอร์ชัน 2',
    'บันทึกฉบับร่างโมเดลเนื้อหาแล้ว',
  ],
  [
    'zh',
    '中文',
    '内容模型',
    '模型名称',
    '字段 1 标签',
    '保存草稿',
    '草稿版本 2',
    '内容模型草稿已保存。',
  ],
  [
    'ru',
    'Русский',
    'Модели содержимого',
    'Название модели',
    'Подпись поля 1',
    'Сохранить черновик',
    'Ревизия черновика 2',
    'Черновик модели содержимого сохранён.',
  ],
  [
    'ja',
    '日本語',
    'コンテンツモデル',
    'モデル名',
    'フィールド 1 のラベル',
    '下書きを保存',
    '下書きリビジョン 2',
    'コンテンツモデルの下書きを保存しました。',
  ],
  [
    'ko',
    '한국어',
    '콘텐츠 모델',
    '모델 이름',
    '필드 1 레이블',
    '초안 저장',
    '초안 리비전 2',
    '콘텐츠 모델 초안을 저장했습니다.',
  ],
  [
    'pt',
    'Português',
    'Modelos de conteúdo',
    'Nome do modelo',
    'Rótulo do campo 1',
    'Salvar rascunho',
    'Revisão do rascunho 2',
    'Rascunho do modelo de conteúdo salvo.',
  ],
] as const

async function holdSave(page: Page, url: string, inspect: () => Promise<void>) {
  let release!: () => void
  let markReady!: () => void
  let markDone!: () => void
  const released = new Promise<void>((done) => {
    release = done
  })
  const ready = new Promise<void>((done) => {
    markReady = done
  })
  const done = new Promise<void>((finish) => {
    markDone = finish
  })
  let started = false
  let failure: unknown
  let ownedRequest: Request | undefined
  let settleDelivery!: (
    value: { response: Response } | { error: unknown },
  ) => void
  const delivered = new Promise<{ response: Response } | { error: unknown }>(
    (finish) => {
      settleDelivery = finish
    },
  )
  const receive = (response: Response) => {
    if (response.request() === ownedRequest) settleDelivery({ response })
  }
  const failed = (request: Request) => {
    if (request === ownedRequest)
      settleDelivery({ error: new Error('Held Struct save failed') })
  }
  const hold = async (route: Route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue()
      return
    }

    started = true
    ownedRequest = route.request()

    try {
      const response = await route.fetch({ maxRedirects: 0 })
      expect(response.status()).toBe(200)
      markReady()
      await released
      await route.fulfill({ response })
    } catch (reason) {
      failure = reason
      markReady()
      await route.abort().catch(() => {})
    } finally {
      markDone()
    }
  }

  page.on('response', receive)
  page.on('requestfailed', failed)

  try {
    await page.route(url, hold)
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await ready
    if (failure) throw failure

    await inspect()
  } finally {
    release()

    try {
      if (started) {
        await done
        const result = await delivered
        if ('response' in result) failure ??= await result.response.finished()
        else failure ??= result.error
      }
    } finally {
      page.off('response', receive)
      page.off('requestfailed', failed)
      await page.unroute(url, hold)
    }
  }

  if (failure) throw failure
}

const product = {
  name: 'Products',
  fields: [
    {
      key: 'title',
      label: 'Title',
      required: true,
      schema: { type: 'text' },
    },
    {
      key: 'details',
      label: 'Details',
      required: false,
      schema: {
        type: 'object',
        fields: [
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
}

export async function structPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: PreviewCapture
}) {
  await page.goto(apiOrigin)
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()

  await page
    .getByRole('button', { name: 'Content models', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Content models', exact: true }),
  ).toBeVisible()
  await capture(
    'Content models',
    'Empty content models',
    'Owner opens the visual Struct draft editor. No content or live route is created.',
  )

  async function select(name: string, option: string) {
    await page.getByRole('combobox', { name, exact: true }).click()
    await page.getByRole('option', { name: option, exact: true }).click()
  }

  async function field(
    path: string,
    key: string,
    label: string,
    type = 'Text',
    parent?: string,
  ) {
    await page
      .getByRole('button', {
        name: parent ? 'Add field to ' + parent : 'Add field',
        exact: true,
      })
      .click()
    await page.getByLabel('Field ' + path + ' key', { exact: true }).fill(key)
    await page
      .getByLabel('Field ' + path + ' label', { exact: true })
      .fill(label)
    if (type !== 'Text') await select('Field ' + path + ' type', type)
  }

  await page.getByLabel('Model name', { exact: true }).fill('Products')
  await field('1', 'title', 'Title')
  await page
    .getByRole('checkbox', { name: 'Field 1 required', exact: true })
    .check()
  await field('2', 'details', 'Details', 'Group')
  await field('2.1', 'price', 'Price', 'Number', '2')
  await page
    .getByRole('checkbox', { name: 'Field 2.1 required', exact: true })
    .check()
  await field('2.2', 'available', 'Available', 'True or false', '2')
  await field('3', 'tags', 'Tags', 'List')
  await field('4', 'category', 'Category', 'Choice')
  await page
    .getByRole('checkbox', { name: 'Field 4 required', exact: true })
    .check()
  await page.getByLabel('Option 4.1 value', { exact: true }).fill('retail')
  await page.getByLabel('Option 4.1 label', { exact: true }).fill('Retail')
  await page
    .getByRole('button', { name: 'Add option to 4', exact: true })
    .click()
  await page.getByLabel('Option 4.2 value', { exact: true }).fill('wholesale')
  await page.getByLabel('Option 4.2 label', { exact: true }).fill('Wholesale')
  await page.getByRole('button', { name: 'Add field', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Save draft', exact: true }),
  ).toBeDisabled()
  const removeField = page.getByRole('button', {
    name: 'Remove field 5',
    exact: true,
  })
  await removeField.focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Add field', exact: true }),
  ).toBeFocused()
  await page
    .getByRole('button', { name: 'Add option to 4', exact: true })
    .click()
  const removeOption = page.getByRole('button', {
    name: 'Remove option 4.3',
    exact: true,
  })
  await removeOption.focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Add option to 4', exact: true }),
  ).toBeFocused()
  await capture(
    'Content models',
    'Nested content model draft',
    'Text, group, number, boolean, list and choice are configured through custom controls.',
  )

  const creating = page.waitForResponse(
    (response) =>
      response.url() === apiOrigin + '/api/structs' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  const created = await creating
  expect(created.status()).toBe(200)
  const saved = await created.json()
  expect(saved).toMatchObject({ ...product, version: 1 })
  await expect(
    page.getByText('Draft revision 1', { exact: true }),
  ).toBeVisible()
  await capture(
    'Content models',
    'Saved content model draft',
    'The actual management API saves revision 1; model fields remain literal.',
  )

  const headers = { authorization: 'Bearer ' + owner }
  const stored = await page.request.get(
    apiOrigin + '/api/structs/' + saved.id,
    { headers },
  )
  expect(stored.status()).toBe(200)
  expect(await stored.json()).toEqual(saved)

  await page.getByLabel('Field 2.1 label', { exact: true }).fill('Unit price')
  let prompts = 0
  const cancelNew = async (dialog: import('@playwright/test').Dialog) => {
    prompts++
    await dialog.dismiss()
  }
  page.on('dialog', cancelNew)
  await page.getByRole('button', { name: 'New model', exact: true }).click()
  page.off('dialog', cancelNew)
  expect(prompts).toBe(1)
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Unit price',
  )
  await capture(
    'Content models',
    'Canceled new content model',
    'Canceling a dirty transition keeps the exact draft and saved revision.',
  )

  const requests: string[] = []
  const observe = (request: Request) => {
    if (
      [
        '/api/structs',
        '/api/flows',
        '/api/data-sources',
        '/api/database-connections',
      ].some((path) => request.url().startsWith(apiOrigin + path))
    )
      requests.push(request.method() + ' ' + request.url())
  }
  await holdSave(page, apiOrigin + '/api/structs/' + saved.id, async () => {
    const committed = await page.request.get(
      apiOrigin + '/api/structs/' + saved.id,
      { headers },
    )
    expect(committed.status()).toBe(200)
    expect(await committed.json()).toMatchObject({
      version: 2,
      fields: [
        product.fields[0],
        {
          ...product.fields[1],
          schema: {
            type: 'object',
            fields: [
              { ...product.fields[1]!.schema.fields![0], label: 'Unit price' },
              product.fields[1]!.schema.fields![1],
            ],
          },
        },
        ...product.fields.slice(2),
      ],
    })
    await chooseManagementLanguage(page, 'ไทย')
    await expect(page.getByLabel('ชื่อโมเดล', { exact: true })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }),
    ).toBeDisabled()
    await capture(
      'Content models',
      'Pending Thai content model save',
      'The real save is committed while its browser response is held; editing remains disabled.',
    )
  })
  await expect(page.getByRole('status')).toHaveText(
    'บันทึกฉบับร่างโมเดลเนื้อหาแล้ว',
  )
  page.on('request', observe)

  for (const [
    language,
    label,
    heading,
    name,
    fieldLabel,
    save,
    revision,
    notice,
  ] of languages) {
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel(name, { exact: true })).toHaveValue('Products')
    await expect(page.getByLabel(fieldLabel, { exact: true })).toHaveValue(
      'Title',
    )
    await expect(
      page.getByRole('button', { name: save, exact: true }),
    ).toBeDisabled()
    await expect(page.getByText(revision, { exact: true })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText(notice)
    expect(
      await page
        .locator('.struct-option input')
        .evaluateAll((inputs) =>
          inputs.map((input) => (input as HTMLInputElement).value),
        ),
    ).toEqual(['retail', 'Retail', 'wholesale', 'Wholesale'])
    await capture(
      'Content models',
      language + ' saved content model',
      'Language changes preserve the authored model and revision without reading or saving again.',
    )
  }
  page.off('request', observe)
  expect(requests).toEqual([])
  await chooseManagementLanguage(page, 'English')
  await capture(
    'Content models',
    'Updated nested content model',
    'An explicit versioned save changes the nested display label without changing its API key.',
  )

  const latestResponse = await page.request.get(
    apiOrigin + '/api/structs/' + saved.id,
    { headers },
  )
  expect(latestResponse.status()).toBe(200)
  const latest = await latestResponse.json()
  const newerResponse = await page.request.put(
    apiOrigin + '/api/structs/' + saved.id,
    {
      headers,
      data: {
        name: latest.name,
        version: latest.version,
        fields: [
          { ...latest.fields[0], label: 'Remote title' },
          ...latest.fields.slice(1),
        ],
      },
    },
  )
  expect(newerResponse.status()).toBe(200)
  const newer = await newerResponse.json()
  await page.getByLabel('Field 2.1 label', { exact: true }).fill('Local cost')
  const staleResponse = page.waitForResponse(
    (response) =>
      response.url() === apiOrigin + '/api/structs/' + saved.id &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  expect((await staleResponse).status()).toBe(409)
  await expect(page.getByRole('alert')).toHaveText(
    'Struct draft changed. Refresh before saving.',
  )
  await expect(page.getByRole('status')).toHaveText(
    'Struct draft changed. Refresh before saving.',
  )
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Local cost',
  )
  await capture(
    'Content models',
    'Conflicting content model save',
    'A real 409 keeps the authored local draft and offers an explicit reviewed reload.',
  )
  page.on('dialog', cancelNew)
  await page
    .getByRole('button', { name: 'Reload saved version', exact: true })
    .click()
  page.off('dialog', cancelNew)
  expect(prompts).toBe(2)
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Local cost',
  )
  await capture(
    'Content models',
    'Canceled content model reload',
    'Canceling the reload preserves local edits and the conflict warning.',
  )
  const refreshedCatalog = page.waitForResponse(
    (response) =>
      response.url() === apiOrigin + '/api/structs' &&
      response.request().method() === 'GET',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  expect((await refreshedCatalog).status()).toBe(200)
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveText(
    'Struct draft changed. Refresh before saving.',
  )
  await expect(page.getByRole('status')).toHaveText(
    'Struct draft changed. Refresh before saving.',
  )
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Local cost',
  )
  await capture(
    'Content models',
    'Catalog refresh preserves content model conflict',
    'Reloading the catalog leaves the stale draft, its warning and the explicit saved-version reload intact.',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Reload saved version', exact: true })
    .click()
  await expect(
    page.getByText('Draft revision 3', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Field 1 label', { exact: true })).toHaveValue(
    'Remote title',
  )
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Unit price',
  )
  const afterConflict = await page.request.get(
    apiOrigin + '/api/structs/' + saved.id,
    { headers },
  )
  expect(await afterConflict.json()).toEqual(newer)
  await expect(page.getByRole('status')).toHaveText('Draft loaded.')
  await capture(
    'Content models',
    'Reloaded saved content model',
    'Only an accepted discard reloads the independently saved revision; stale edits never overwrite it.',
  )

  await page.reload()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
  await page
    .getByRole('button', { name: 'Content models', exact: true })
    .click()
  await select('Choose a model', 'Products')
  await expect(
    page.getByText('Draft revision 3', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Field 2.1 label', { exact: true })).toHaveValue(
    'Unit price',
  )

  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 390, height: 900 })
    await select('Appearance', mode)
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      mode.toLowerCase(),
    )
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
    for (const name of ['Remove field 1', 'Remove option 4.1', 'Save draft']) {
      const bounds = await page
        .getByRole('button', { name, exact: true })
        .boundingBox()
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
    }
    const checkbox = await page
      .getByRole('checkbox', { name: 'Field 1 required', exact: true })
      .boundingBox()
    expect(checkbox?.width).toEqual(checkbox?.height)
    await capture(
      'Content models',
      'Phone ' + mode.toLowerCase() + ' nested content model',
      'Native-width nested cards and controls preserve readable labels and keyboard focus.',
    )
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await select('Appearance', 'Light')
  await page.getByLabel('Model name', { exact: true }).fill('Unfinished model')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'New model', exact: true }).click()
  await expect(page.getByLabel('Model name', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Field 1 label', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('New model')
  await capture(
    'Content models',
    'Accepted new content model',
    'An accepted discard opens a blank draft with a current notice; the saved model remains available.',
  )
  await select('Choose a model', 'Products')
  await expect(page.getByLabel('Model name', { exact: true })).toHaveValue(
    'Products',
  )
  await expect(page.getByRole('status')).toHaveText('Draft loaded.')
}
