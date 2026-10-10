import { expect, type Page, type Response, type Route } from '@playwright/test'
import type { Flow } from '../src/flows/model'
import type { PreviewCapture } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'

const choices = [
  ['en', 'English'],
  ['th', 'ไทย'],
  ['zh', '中文'],
  ['ru', 'Русский'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['pt', 'Português'],
] as const

type Language = (typeof choices)[number][0]
type Messages = {
  action: string
  help: string
  confirm: string
  complete: string
}

// These fixed acceptance literals do not read application dictionaries.
export const deletionMessages: Record<Language, Messages> = {
  en: {
    action: 'Delete data source',
    help: 'Data sources used by a draft or published API cannot be deleted.',
    confirm: 'Delete data source {source}? This cannot be undone.',
    complete: 'Data source deleted.',
  },
  th: {
    action: 'ลบแหล่งข้อมูล',
    help: 'แหล่งข้อมูลที่ใช้โดย API ฉบับร่างหรือ API ที่เผยแพร่อยู่ไม่สามารถลบได้',
    confirm:
      'ลบแหล่งข้อมูล {source} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
    complete: 'ลบแหล่งข้อมูลแล้ว',
  },
  zh: {
    action: '删除数据源',
    help: '草稿 API 或当前已发布 API 使用的数据源无法删除。',
    confirm: '删除数据源 {source}？此操作无法撤销。',
    complete: '数据源已删除。',
  },
  ru: {
    action: 'Удалить источник данных',
    help: 'Источники данных, используемые черновиком или текущим опубликованным API, нельзя удалить.',
    confirm: 'Удалить источник данных {source}? Это действие нельзя отменить.',
    complete: 'Источник данных удалён.',
  },
  ja: {
    action: 'データソースを削除',
    help: '下書きまたは現在公開中の API が使用しているデータソースは削除できません。',
    confirm: 'データソース {source} を削除しますか？この操作は元に戻せません。',
    complete: 'データソースを削除しました。',
  },
  ko: {
    action: '데이터 소스 삭제',
    help: '초안 또는 현재 게시된 API에서 사용하는 데이터 소스는 삭제할 수 없습니다.',
    confirm:
      '데이터 소스 {source}을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    complete: '데이터 소스를 삭제했습니다.',
  },
  pt: {
    action: 'Excluir fonte de dados',
    help: 'Fontes de dados usadas por um rascunho ou uma API atualmente publicada não podem ser excluídas.',
    confirm:
      'Excluir a fonte de dados {source}? Esta ação não pode ser desfeita.',
    complete: 'Fonte de dados excluída.',
  },
}

type Source = {
  id: string
  name: string
  version: number
  columns: {
    key: string
    label: string
    type: string
    nullable: boolean
  }[]
  rows: Record<string, unknown>[]
}
type SavedFlow = Flow & {
  id: string
  revision: number
  publishedRevision: number | null
}
type Audit = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}

const sourceName = 'Delete data source'
const csv = 'Text,Count,Active\nSave draft,12,true\nPublish,15,false\n'
const rows = [
  { text: 'Save draft', count: 12, active: true },
  { text: 'Publish', count: 15, active: false },
]
const columns = [
  { key: 'text', label: 'Text', type: 'string', nullable: false },
  { key: 'count', label: 'Count', type: 'number', nullable: false },
  { key: 'active', label: 'Active', type: 'boolean', nullable: false },
]
const referencedError =
  'This data source is used by a draft or published API. Remove those references before deleting it.'

async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)

  expect(
    await page
      .locator('.source-actions, .source-actions > *, .source-table')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .every((element) => {
            const parent = element.parentElement!.getBoundingClientRect()
            const child = element.getBoundingClientRect()

            return (
              child.left >= parent.left - 1 && child.right <= parent.right + 1
            )
          }),
      ),
  ).toBe(true)
}

export async function dataSourceDeleteLocalePreviews({
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
  const headers = { authorization: `Bearer ${owner}` }
  const requests: string[] = []
  const actions: string[] = []
  const observe = (request: { url(): string; method(): string }) => {
    const path = new URL(request.url()).pathname
    if (!/^\/api\/(data-sources|flows)(\/|$)/.test(path)) return

    const event = `${request.method()} ${path}`
    requests.push(event)
    if (request.method() !== 'GET') actions.push(event)
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(apiOrigin)
  await chooseManagementLanguage(page, 'English')
  await page.locator('#appearance').click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Data sources', exact: true }).click()
  await expect(page.locator('.runtime-key-empty')).toBeVisible()

  page.on('request', observe)

  const preview = page
    .locator('.data-source-grid .source-preview')
    .filter({ has: page.locator('table') })
  const sourceActions = preview.locator('.source-actions')

  async function choose(language: Language, label: string) {
    const before = [...requests]
    await chooseManagementLanguage(page, label)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(requests).toEqual(before)
  }

  async function confirm(language: Language, name: string, accept: boolean) {
    const ready = page.waitForEvent('dialog')
    const clicked = sourceActions
      .getByRole('button', {
        name: deletionMessages[language].action,
        exact: true,
      })
      .click()
    const dialog = await ready
    const message = dialog.message()

    if (accept) await dialog.accept()
    else await dialog.dismiss()
    await clicked

    expect(message).toBe(
      deletionMessages[language].confirm.replace('{source}', name),
    )
  }

  async function controls(language: Language, name: string) {
    await expect(preview.locator('h2')).toHaveText(name)
    await expect(
      sourceActions.getByRole('button', {
        name: deletionMessages[language].action,
        exact: true,
      }),
    ).toBeEnabled()
    await expect(sourceActions.locator('.field-help').last()).toHaveText(
      deletionMessages[language].help,
    )
    await expect(preview.locator('tbody tr')).toHaveText([
      'Save draft12true',
      'Publish15false',
    ])
    expect(
      await preview
        .locator('th')
        .evaluateAll((elements) =>
          elements.map((element) => element.firstChild?.textContent?.trim()),
        ),
    ).toEqual(['Text', 'Count', 'Active'])
  }

  async function selectSource(name: string) {
    await page.locator('#saved-source').click()
    await page
      .getByRole('option', { name: `${name} · 2 rows`, exact: true })
      .click()
    await expect(preview.locator('h2')).toHaveText(name)
  }

  async function signIn(token: string) {
    await choose('en', 'English')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByLabel('Workspace token', { exact: true }).fill(token)
    await page
      .getByRole('button', { name: 'Open workspace', exact: true })
      .click()

    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()
  }

  async function saved(id: string) {
    const response = await page.request.get(
      `${apiOrigin}/api/data-sources/${id}`,
      { headers },
    )
    expect(response.status()).toBe(200)

    return (await response.json()) as Source
  }

  async function audit() {
    const response = await page.request.get(`${apiOrigin}/api/audit`, {
      headers,
    })
    expect(response.status()).toBe(200)

    return (await response.json()) as Audit[]
  }

  try {
    await page.locator('#source-name').fill(sourceName)
    await page.locator('#spreadsheet-file').setInputFiles({
      name: 'delete-review.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    const importedReady = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}/api/data-sources/import` &&
        response.request().method() === 'POST',
    )
    await page
      .locator('.source-import-form')
      .getByRole('button', { name: 'Import spreadsheet', exact: true })
      .click()
    const imported = await importedReady
    expect(imported.status()).toBe(200)

    const source = (await imported.json()) as Source
    expect(source).toMatchObject({
      name: sourceName,
      version: 1,
      columns,
      rows,
    })
    await controls('en', sourceName)
    const initialAudit = await audit()

    for (const [language, label] of choices) {
      await choose(language, label)
      await controls(language, sourceName)
      await confirm(language, sourceName, false)
      expect(actions).toEqual(['POST /api/data-sources/import'])
      await contained(page)
      await capture(
        'Languages',
        `${label} unused source deletion canceled`,
        'Trusted deletion action, full reference warning and native confirmation use current language. Authored source name, columns/types and saved cells remain literal. Cancel sends no DELETE or flow mutation.',
      )
    }
    expect(await saved(source.id)).toMatchObject({
      name: sourceName,
      version: 1,
      columns,
      rows,
    })
    expect(await audit()).toEqual(initialAudit)

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await contained(page)
    await capture(
      'Languages',
      'Phone light Thai source deletion review',
      'The real saved upload, full deletion warning and disabled-empty replacement controls fit native 390px. No deletion is implied by choosing language.',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await choose('en', 'English')

    // Public fixture provisioning isolates current draft and publication
    // references. It is not an all-history deletion-resistance claim.
    async function upload(name: string) {
      const response = await page.request.post(
        `${apiOrigin}/api/data-sources/import`,
        {
          headers,
          multipart: {
            name,
            file: {
              name: 'references.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from(csv),
            },
          },
        },
      )
      expect(response.status()).toBe(200)

      return (await response.json()) as Source
    }

    const draftSource = await upload('Save draft')
    const publishedSource = await upload('Publish')
    const created = await page.request.post(
      `${apiOrigin}/api/data-sources/${publishedSource.id}/api`,
      {
        headers,
        data: {
          name: 'Delete data source',
          path: '/deletion-review',
          protocol: 'rest',
          columns: ['text', 'count', 'active'],
          limit: 10,
        },
      },
    )
    expect(created.status()).toBe(200)

    const flow = (await created.json()) as SavedFlow
    const published = await page.request.post(
      `${apiOrigin}/api/flows/${flow.id}/publish`,
      { headers, data: { revision: flow.revision } },
    )
    expect(published.status()).toBe(200)

    const updated = await page.request.put(
      `${apiOrigin}/api/flows/${flow.id}`,
      {
        headers,
        data: {
          ...flow,
          nodes: flow.nodes.map((node) =>
            node.type === 'data'
              ? {
                  ...node,
                  config: { ...node.config, sourceId: draftSource.id },
                }
              : node,
          ),
        },
      },
    )
    expect(updated.status()).toBe(200)

    const currentDraft = (await updated.json()) as SavedFlow
    expect(currentDraft).toMatchObject({ revision: 2, publishedRevision: 1 })
    expect(
      currentDraft.nodes
        .filter((node) => node.type === 'data')
        .map((node) => node.config.sourceId),
    ).toEqual([draftSource.id])

    const releaseResponse = await page.request.get(
      `${apiOrigin}/api/flows/${flow.id}/releases/1`,
      { headers },
    )
    expect(releaseResponse.status()).toBe(200)

    const currentRelease = (await releaseResponse.json()) as {
      current: boolean
      definition: Flow
    }
    expect(currentRelease.current).toBe(true)
    expect(
      currentRelease.definition.nodes
        .filter((node) => node.type === 'data')
        .map((node) => node.config.sourceId),
    ).toEqual([publishedSource.id])

    await page
      .getByRole('button', { name: 'Refresh list', exact: true })
      .click()

    for (const [referenced, title] of [
      [draftSource, 'Current draft reference blocks source deletion'],
      [publishedSource, 'Current publication reference blocks source deletion'],
    ] as const) {
      await selectSource(referenced.name)
      await controls('en', referenced.name)
      const failedReady = page.waitForResponse(
        (response) =>
          response.url() === `${apiOrigin}/api/data-sources/${referenced.id}` &&
          response.request().method() === 'DELETE',
      )
      await confirm('en', referenced.name, true)
      const failed = await failedReady
      expect(failed.status()).toBe(409)
      expect(await failed.json()).toEqual({ error: referencedError })
      await expect(page.getByRole('alert')).toHaveText(referencedError)
      expect(await saved(referenced.id)).toMatchObject({
        name: referenced.name,
        version: 1,
        columns,
        rows,
      })
      await capture(
        'Languages',
        title,
        'Real server rejects confirmed deletion with its literal 409 reference error. The saved rows remain unchanged. This state proves the named current reference, not retention of every historical release.',
      )
    }

    const roleResponse = await page.request.post(`${apiOrigin}/api/roles`, {
      headers,
      data: {
        name: 'Deletion reader',
        permissions: ['flows.read', 'sources.read'],
      },
    })
    expect(roleResponse.status()).toBe(200)

    const role = (await roleResponse.json()) as { id: string }
    const readerResponse = await page.request.post(`${apiOrigin}/api/members`, {
      headers,
      data: { name: 'Deletion reader', role: 'custom', roleId: role.id },
    })
    expect(readerResponse.status()).toBe(200)

    const reader = (await readerResponse.json()) as { token: string }
    await signIn(reader.token)
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await selectSource(sourceName)
    await choose('th', 'ไทย')
    await expect(
      sourceActions.getByRole('button', {
        name: deletionMessages.th.action,
        exact: true,
      }),
    ).toBeDisabled()
    await expect(sourceActions.locator('.field-help').last()).toHaveText(
      deletionMessages.th.help,
    )
    await expect(preview.locator('tbody tr')).toHaveText([
      'Save draft12true',
      'Publish15false',
    ])

    const readerDenied = await page.request.delete(
      `${apiOrigin}/api/data-sources/${source.id}`,
      { headers: { authorization: `Bearer ${reader.token}` } },
    )
    expect(readerDenied.status()).toBe(403)
    expect(await saved(source.id)).toMatchObject({ version: 1, columns, rows })
    await capture(
      'Languages',
      'Thai read-only source deletion denied',
      'A real custom reader can see the saved rows, but the translated delete control stays disabled. Direct management DELETE returns 403 and leaves the unused source intact.',
    )

    const selectedResponse = await page.request.post(
      `${apiOrigin}/api/members`,
      {
        headers,
        data: {
          name: 'Selected deletion viewer',
          role: 'viewer',
          access: {
            mode: 'selected',
            flowIds: [flow.id],
            dependencyUse: {
              sources: [],
              databaseConnections: [],
              authConnections: [],
            },
          },
        },
      },
    )
    expect(selectedResponse.status()).toBe(200)

    const selected = (await selectedResponse.json()) as { token: string }
    const selectedReadsBefore = requests.filter((request) =>
      request.startsWith('GET /api/data-sources'),
    )
    await signIn(selected.token)
    await expect(
      page.getByRole('button', { name: 'Data sources', exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('.source-delete')).toHaveCount(0)
    expect(
      requests.filter((request) => request.startsWith('GET /api/data-sources')),
    ).toEqual(selectedReadsBefore)

    const selectedDenied = await page.request.delete(
      `${apiOrigin}/api/data-sources/${source.id}`,
      { headers: { authorization: `Bearer ${selected.token}` } },
    )
    expect(selectedDenied.status()).toBe(403)
    expect(await saved(source.id)).toMatchObject({ version: 1, columns, rows })

    await signIn(owner)
    await page
      .getByRole('button', { name: 'Data sources', exact: true })
      .click()
    await selectSource(sourceName)
    await choose('th', 'ไทย')

    const sourceUrl = `${apiOrigin}/api/data-sources/${source.id}`
    let releaseHeld!: () => void
    let markReady!: () => void
    let markDone!: () => void
    let settleDelivery!: (
      result: { response: Response } | { error: unknown },
    ) => void
    const release = new Promise<void>((resolve) => {
      releaseHeld = resolve
    })
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
    })
    const done = new Promise<void>((resolve) => {
      markDone = resolve
    })
    const delivered = new Promise<{ response: Response } | { error: unknown }>(
      (resolve) => {
        settleDelivery = resolve
      },
    )
    let started = false
    let heldStatus = 0
    let handlerError: unknown
    const receiveDelivery = (response: Response) => {
      if (
        response.url() === sourceUrl &&
        response.request().method() === 'DELETE'
      )
        settleDelivery({ response })
    }
    const holdDelete = async (route: Route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue()
        return
      }

      started = true

      try {
        const response = await route.fetch()
        heldStatus = response.status()
        markReady()
        await release
        await route.fulfill({ response })
      } catch (error) {
        handlerError = error
        markReady()
        settleDelivery({ error })
      } finally {
        markDone()
      }
    }

    page.on('response', receiveDelivery)

    try {
      await page.route(sourceUrl, holdDelete)
      await confirm('th', sourceName, true)
      await ready
      if (handlerError) throw handlerError

      expect(heldStatus).toBe(200)
      await expect(
        sourceActions.getByRole('button', {
          name: deletionMessages.th.action,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(page.locator('#saved-source')).toBeDisabled()
      await expect(preview.locator('h2')).toHaveText(sourceName)
      await expect(preview.locator('tbody tr')).toHaveText([
        'Save draft12true',
        'Publish15false',
      ])

      const gone = await page.request.get(sourceUrl, { headers })
      expect(gone.status()).toBe(404)
      await choose('ru', 'Русский')
      await expect(
        sourceActions.getByRole('button', {
          name: deletionMessages.ru.action,
          exact: true,
        }),
      ).toBeDisabled()
      await expect(sourceActions.locator('.field-help').last()).toHaveText(
        deletionMessages.ru.help,
      )
      await capture(
        'Languages',
        'Russian committed deletion response pending',
        'The real unused-source DELETE has committed and a public GET now returns 404. Browser delivery alone waits; old authored rows remain visible, delete and selection stay disabled, and language choice performs no second action.',
      )

      releaseHeld()
      const result = await delivered
      if ('error' in result) throw result.error

      expect(result.response.status()).toBe(200)
      expect(await result.response.json()).toEqual({ ok: true })
      await done
      if (handlerError) throw handlerError
    } finally {
      releaseHeld()
      if (started) await done

      settleDelivery({
        error:
          handlerError ??
          new Error('Deletion delivery observer closed during cleanup'),
      })
      await delivered
      page.off('response', receiveDelivery)
      await page.unroute(sourceUrl, holdDelete)
    }

    await expect(page.getByRole('status')).toContainText(
      deletionMessages.ru.complete,
    )
    await expect(preview.locator('h2')).not.toHaveText(sourceName)
    const remainingName = await preview.locator('h2').textContent()
    expect([draftSource.name, publishedSource.name]).toContain(remainingName)
    const gone = await page.request.get(sourceUrl, { headers })
    expect(gone.status()).toBe(404)

    const deletionAudit = (await audit()).filter(
      (event) => event.action === 'data-source.deleted',
    )
    expect(deletionAudit).toHaveLength(1)
    expect(deletionAudit[0]).toMatchObject({
      action: 'data-source.deleted',
      resource: source.id,
      actor: expect.any(String),
      id: expect.any(Number),
      created_at: expect.any(String),
    })
    expect(Object.keys(deletionAudit[0]!).sort()).toEqual([
      'action',
      'actor',
      'created_at',
      'id',
      'resource',
    ])
    expect(JSON.stringify(deletionAudit[0])).not.toContain('Save draft')
    expect(JSON.stringify(deletionAudit[0])).not.toContain('Publish')
    expect(JSON.stringify(deletionAudit[0])).not.toContain(csv)

    for (const [language, label] of choices) {
      await choose(language, label)
      await expect(page.getByRole('status')).toContainText(
        deletionMessages[language].complete,
      )
      await expect(preview.locator('h2')).toHaveText(remainingName!)
      await expect(preview.locator('tbody tr')).toHaveText([
        'Save draft12true',
        'Publish15false',
      ])
      expect(
        await preview
          .locator('th')
          .evaluateAll((elements) =>
            elements.map((element) => element.firstChild?.textContent?.trim()),
          ),
      ).toEqual(['Text', 'Count', 'Active'])
      await expect(sourceActions.locator('.field-help').last()).toHaveText(
        deletionMessages[language].help,
      )
      await contained(page)
      await capture(
        'Languages',
        `${label} unused source deletion completed`,
        'The unused source is actually gone and its metadata-only deletion audit exists. Current-language completion remains reactive. Remaining referenced sources keep literal names and rows; no graph or release changes accompany language choice.',
      )
    }

    await choose('th', 'ไทย')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'มืด', exact: true }).click()
    await contained(page)
    await capture(
      'Languages',
      'Phone dark Thai source deletion completed',
      'Translated completion and reference guidance stay readable at native 390px dark appearance. A remaining saved source and its authored cells are visible; the deleted source is not restored.',
    )

    expect(await saved(draftSource.id)).toMatchObject({
      version: 1,
      columns,
      rows,
    })
    expect(await saved(publishedSource.id)).toMatchObject({
      version: 1,
      columns,
      rows,
    })
    const finalDraft = await page.request.get(
      `${apiOrigin}/api/flows/${flow.id}`,
      { headers },
    )
    expect(finalDraft.status()).toBe(200)
    expect(await finalDraft.json()).toEqual(currentDraft)

    const finalRelease = await page.request.get(
      `${apiOrigin}/api/flows/${flow.id}/releases/1`,
      { headers },
    )
    expect(finalRelease.status()).toBe(200)
    expect(await finalRelease.json()).toEqual(currentRelease)
    expect(actions).toEqual([
      'POST /api/data-sources/import',
      `DELETE /api/data-sources/${draftSource.id}`,
      `DELETE /api/data-sources/${publishedSource.id}`,
      `DELETE /api/data-sources/${source.id}`,
    ])
  } finally {
    page.off('request', observe)
  }
}
