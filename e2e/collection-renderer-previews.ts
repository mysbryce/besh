import { expect, type Page, type Request, type Route } from '@playwright/test'
import { createHash } from 'node:crypto'
import { collectionRendererLanguages } from './collection-renderer-languages'
import { chooseManagementLanguage } from './management-locale-previews'
import { signInPreview, type PreviewCapture } from './preview-fixture'
import {
  seedHtmlPreviewWorkspace,
  type HtmlPreviewWorkspace,
} from './rich-text-html-seed'

export const collectionRendererPreviewCount = 22

type RendererWire = {
  schemaVersion: 1
  elements: Record<
    string,
    {
      classes?: string[]
      attributes?: Record<string, string>
    }
  >
  consumerContract?: 'besh.fixed-heading-id.v1'
}

type RendererRecord = {
  collectionId: string
  collectionVersion: number
  structId: string
  structVersion: number
  version: number
  renderer: RendererWire
  rendererSha256: string
  consumerContract: string | null
  createdAt: string | null
  updatedAt: string | null
}

type AuditEvent = {
  id: number
  actor: string
  action: string
  resource: string
  created_at: string
}

const defaultRenderer: RendererWire = { schemaVersion: 1, elements: {} }
const firstRenderer: RendererWire = {
  schemaVersion: 1,
  elements: {
    h1: {
      classes: ['text-heading-1', 'article-title'],
      attributes: {
        title: 'Title <article> & ไทย',
        'aria-label': 'Heading ไทย',
        'x-data': 'h1',
      },
    },
  },
  consumerContract: 'besh.fixed-heading-id.v1',
}
const peerRenderer: RendererWire = {
  schemaVersion: 1,
  elements: { p: { classes: ['peer-saved'] } },
}
const uncertainRenderer: RendererWire = {
  schemaVersion: 1,
  elements: { p: { classes: ['uncertain-fourth'] } },
}
const pendingRenderer: RendererWire = {
  schemaVersion: 1,
  elements: {
    p: { classes: ['uncertain-fourth'] },
    h1: {
      classes: ['pending-fifth'],
      attributes: {
        title: 'Pending <title> & ไทย',
        'aria-label': 'Heading ไทย',
        'x-data': 'h1',
      },
    },
  },
  consumerContract: 'besh.fixed-heading-id.v1',
}

const defaultCanonical =
  '{"consumerContract":null,"elements":{},"schemaVersion":1}'
const firstCanonical =
  '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"aria-label":"Heading ไทย","title":"Title <article> & ไทย","x-data":"h1"},"classes":["text-heading-1","article-title"]}},"schemaVersion":1}'
const peerCanonical =
  '{"consumerContract":null,"elements":{"p":{"classes":["peer-saved"]}},"schemaVersion":1}'
const uncertainCanonical =
  '{"consumerContract":null,"elements":{"p":{"classes":["uncertain-fourth"]}},"schemaVersion":1}'
const pendingCanonical =
  '{"consumerContract":"besh.fixed-heading-id.v1","elements":{"h1":{"attributes":{"aria-label":"Heading ไทย","title":"Pending <title> & ไทย","x-data":"h1"},"classes":["pending-fifth"]},"p":{"classes":["uncertain-fourth"]}},"schemaVersion":1}'
const uncertainty =
  'Save could not be confirmed. Reload HTML settings before trying again.'

export async function collectionRendererPreviews({
  page,
  owner,
  origin,
  capture,
  workspace,
}: {
  page: Page
  owner: string
  origin: string
  capture: PreviewCapture
  workspace?: HtmlPreviewWorkspace
}) {
  const viewport = page.viewportSize()
  const errors: string[] = []
  const browserWrites: string[] = []
  const resourceRequests: string[] = []
  let count = 0
  const observeError = (error: Error) => errors.push(error.message)
  const observeWrite = (request: Request) => {
    if (
      request.url().startsWith(origin + '/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
    )
      browserWrites.push(request.method() + ' ' + request.url())
  }
  const observeResource = (request: Request) => {
    if (
      /\/api\/(collections|structs|data-sources|database-connections|flows)(?:\/|$)/.test(
        request.url(),
      )
    )
      resourceRequests.push(request.method() + ' ' + request.url())
  }

  async function record(
    title: string,
    detail: string,
    options?: Parameters<PreviewCapture>[3],
  ) {
    await capture('Collection HTML settings', title, detail, options)
    count += 1
  }

  page.on('pageerror', observeError)

  try {
    const saved =
      workspace ?? (await seedHtmlPreviewWorkspace(page, origin, owner))
    expect(saved.owner).toBe(owner)

    await signInPreview(page, owner)
    await chooseManagementLanguage(page, 'English')
    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Choose a collection', exact: true })
      .click()
    await page
      .getByRole('option', { name: saved.collectionName, exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: saved.collectionName, exact: true }),
    ).toBeVisible()

    const headers = { origin, authorization: 'Bearer ' + owner }
    const collectionPath = origin + '/api/collections/' + saved.collectionId
    const rendererPath = collectionPath + '/renderer'
    const contentPaths = [
      origin + '/api/structs/' + saved.structId,
      collectionPath,
      collectionPath + '/entries/' + saved.entryId,
      collectionPath + '/entries',
    ]

    async function get(path: string) {
      const response = await page.request.get(path, { headers })
      expect(response.status()).toBe(200)

      return response.json()
    }

    async function contentState() {
      return Promise.all(contentPaths.map(get))
    }

    const beforeContent = await contentState()
    const beforeAudit: AuditEvent[] = await get(origin + '/api/audit')
    const originalIds = new Set(beforeAudit.map((event) => event.id))
    const ownerActor = beforeAudit.find(
      (event) =>
        event.action === 'collection.created' &&
        event.resource === saved.collectionId,
    )?.actor
    expect(ownerActor).toEqual(expect.any(String))
    const collection = beforeContent[1]
    expect(collection).toMatchObject({
      id: saved.collectionId,
      version: 1,
      struct: { id: saved.structId, version: 1 },
    })
    expect(beforeContent[2]).toMatchObject({
      id: saved.entryId,
      version: 1,
      data: { title: saved.title },
    })

    async function unchanged(successfulSaves: number) {
      expect(await contentState()).toEqual(beforeContent)
      const audit: AuditEvent[] = await get(origin + '/api/audit')
      const additions = audit.filter((event) => !originalIds.has(event.id))
      expect(additions).toHaveLength(successfulSaves)
      expect(audit.filter((event) => originalIds.has(event.id))).toEqual(
        beforeAudit,
      )

      for (const event of additions)
        expect(event).toEqual({
          id: expect.any(Number),
          actor: ownerActor,
          action: 'collection.renderer.saved',
          resource: saved.collectionId,
          created_at: expect.any(String),
        })
    }

    function rendererIdentity(
      value: RendererRecord,
      version: number,
      renderer: RendererWire,
      canonical: string,
      createdAt?: string | null,
    ) {
      expect(value).toEqual({
        collectionId: saved.collectionId,
        collectionVersion: collection.version,
        structId: collection.struct.id,
        structVersion: collection.struct.version,
        version,
        renderer,
        rendererSha256: createHash('sha256')
          .update(canonical, 'utf8')
          .digest('hex'),
        consumerContract: renderer.consumerContract ?? null,
        createdAt: version === 0 ? null : expect.any(String),
        updatedAt: version === 0 ? null : expect.any(String),
      })

      if (createdAt !== undefined) expect(value.createdAt).toBe(createdAt)
      if (version > 0) {
        expect(new Date(value.createdAt!).toISOString()).toBe(value.createdAt)
        expect(new Date(value.updatedAt!).toISOString()).toBe(value.updatedAt)
      }
    }

    function reply(method: 'GET' | 'PUT') {
      return page.waitForResponse(
        (response) =>
          response.url() === rendererPath &&
          response.request().method() === method,
      )
    }

    const panel = page.getByRole('region', {
      name: 'Collection HTML settings',
      exact: true,
    })
    const save = panel.getByRole('button', {
      name: 'Save HTML settings',
      exact: true,
    })
    const reload = panel.getByRole('button', {
      name: 'Reload HTML settings',
      exact: true,
    })
    const defaults = panel.getByRole('button', {
      name: 'Use default settings',
      exact: true,
    })

    async function selectElement(name: string) {
      await panel
        .getByRole('combobox', { name: 'Element', exact: true })
        .click()
      await page.getByRole('option', { name, exact: true }).click()
    }

    async function savedRevision(version: number) {
      await expect(
        panel.getByText('Renderer revision ' + version, { exact: true }),
      ).toBeVisible()
      await expect(save).toBeDisabled()
      await expect(reload).toBeEnabled()
    }

    async function saveRenderer(
      version: number,
      renderer: RendererWire,
      canonical: string,
      createdAt?: string | null,
    ) {
      const receiving = reply('PUT')
      await save.click()
      const response = await receiving
      expect(response.status()).toBe(200)
      expect(response.request().postDataJSON()).toEqual({ version, renderer })

      const value: RendererRecord = await response.json()
      rendererIdentity(value, version + 1, renderer, canonical, createdAt)
      await savedRevision(version + 1)
      expect(await get(rendererPath)).toEqual(value)

      return value
    }

    async function acceptReload(expected: RendererRecord) {
      const receiving = reply('GET')
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toBe('Discard unsaved HTML settings?')
        await dialog.accept()
      })
      await reload.click()
      const response = await receiving
      expect(response.status()).toBe(200)
      expect(await response.json()).toEqual(expected)
      await savedRevision(expected.version)
      await expect(panel.getByRole('alert')).toHaveCount(0)
    }

    page.on('request', observeWrite)
    const reviewing = reply('GET')
    await page
      .getByRole('button', { name: 'Review HTML settings', exact: true })
      .click()
    const reviewed = await reviewing
    expect(reviewed.status()).toBe(200)
    rendererIdentity(
      await reviewed.json(),
      0,
      defaultRenderer,
      defaultCanonical,
    )
    await expect(panel).toBeVisible()
    await expect(
      panel.getByText('Default HTML settings · not saved', { exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByText('No custom element settings', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeDisabled()
    await expect(defaults).toBeDisabled()
    await unchanged(0)
    await record(
      'Default collection HTML settings revision zero',
      'Explicit owner review reads the frozen collection binding and unsaved default settings without creating a renderer revision or changing content.',
    )

    await panel
      .getByRole('button', { name: 'Advanced element settings', exact: true })
      .click()
    await selectElement('Heading 1 (h1)')
    await panel
      .getByLabel('CSS classes', { exact: true })
      .fill('text-heading-1 article-title')
    await panel
      .getByLabel('Title attribute', { exact: true })
      .fill('Title <article> & ไทย')
    await panel
      .getByLabel('Accessibility label', { exact: true })
      .fill('Heading ไทย')
    await panel
      .getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      })
      .check()
    await expect(save).toBeEnabled()
    expect(browserWrites).toEqual([])
    await unchanged(0)
    await record(
      'Dirty reviewed heading settings',
      'Literal classes, title, accessibility label and explicit fixed heading identifier remain an unsaved local edit until Save.',
    )

    const first = await saveRenderer(0, firstRenderer, firstCanonical)
    expect(first.updatedAt).toBe(first.createdAt)
    await unchanged(1)
    await record(
      'Saved collection HTML settings revision one',
      'The real owner PUT saves the exact reviewed heading wire, canonical hash and frozen identities with one metadata-only audit event.',
    )

    await panel.getByLabel('CSS classes', { exact: true }).fill('local-second')
    const peerResponse = await page.request.put(rendererPath, {
      headers,
      data: { version: 1, renderer: peerRenderer },
    })
    expect(peerResponse.status()).toBe(200)
    const peer: RendererRecord = await peerResponse.json()
    rendererIdentity(peer, 2, peerRenderer, peerCanonical, first.createdAt)

    const staleReceiving = reply('PUT')
    await save.click()
    const stale = await staleReceiving
    expect(stale.status()).toBe(409)
    expect(stale.request().postDataJSON()).toEqual({
      version: 1,
      renderer: {
        ...firstRenderer,
        elements: {
          h1: {
            ...firstRenderer.elements.h1,
            classes: ['local-second'],
          },
        },
      },
    })
    await expect(panel.getByRole('alert')).toHaveText(
      'Collection renderer changed. Reload before saving.',
    )
    await expect(panel.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'local-second',
    )
    await expect(
      panel.getByLabel('Title attribute', { exact: true }),
    ).toHaveValue('Title <article> & ไทย')
    await savedRevision(1)
    expect(await get(rendererPath)).toEqual(peer)
    await unchanged(2)
    await record(
      'Stale renderer save preserves local review',
      'An actual peer revision makes Save return 409; the local heading edit and reviewed revision one remain visible while Save is blocked.',
    )

    const reads: string[] = []
    const observeRead = (request: Request) => {
      if (request.url() === rendererPath && request.method() === 'GET')
        reads.push(request.url())
    }
    page.on('request', observeRead)
    try {
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toBe('Discard unsaved HTML settings?')
        await dialog.dismiss()
      })
      await reload.click()
      expect(reads).toEqual([])
      await expect(
        panel.getByLabel('CSS classes', { exact: true }),
      ).toHaveValue('local-second')
      await savedRevision(1)
      await record(
        'Cancelled reload retains conflicting settings',
        'Dismissing the explicit discard confirmation keeps the dirty local settings and conflict state without another renderer GET.',
      )
    } finally {
      page.off('request', observeRead)
    }

    await acceptReload(peer)
    await selectElement('Paragraph (p)')
    await expect(panel.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'peer-saved',
    )
    await unchanged(2)
    await record(
      'Accepted reload reviews peer revision two',
      'Explicit accepted reload adopts the actual peer settings and current revision, clears the conflict and keeps saved content unchanged.',
    )

    await defaults.click()
    await expect(panel.getByLabel('CSS classes', { exact: true })).toHaveValue(
      '',
    )
    await expect(save).toBeEnabled()
    await expect(defaults).toBeDisabled()
    await expect(
      panel.getByText('Renderer revision 2', { exact: true }),
    ).toBeVisible()
    expect(await get(rendererPath)).toEqual(peer)
    await unchanged(2)
    await record(
      'Default settings remain an unsaved draft',
      'Use default settings clears only the local renderer draft; the peer revision remains stored until an explicit Save.',
    )

    await saveRenderer(2, defaultRenderer, defaultCanonical, first.createdAt)
    await expect(
      panel.getByText('No custom element settings', { exact: true }),
    ).toBeVisible()
    await expect(defaults).toBeDisabled()
    await unchanged(3)
    await record(
      'Default collection HTML settings saved',
      'The real revision-three PUT stores default wire without a consumer contract and adds exactly one renderer audit event.',
    )

    await panel
      .getByLabel('CSS classes', { exact: true })
      .fill('uncertain-fourth')
    let receiveCommit!: (value: RendererRecord) => void
    let rejectCommit!: (reason: unknown) => void
    const committed = new Promise<RendererRecord>((resolve, reject) => {
      receiveCommit = resolve
      rejectCommit = reject
    })
    let abortStarted = false
    let finishAbort!: () => void
    const abortFinished = new Promise<void>((resolve) => {
      finishAbort = resolve
    })
    const abortDelivery = async (route: Route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue()
        return
      }

      abortStarted = true

      try {
        expect(route.request().postDataJSON()).toEqual({
          version: 3,
          renderer: uncertainRenderer,
        })
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
        expect(response.status()).toBe(200)
        receiveCommit(await response.json())
        await route.abort('failed')
      } catch (reason) {
        rejectCommit(reason)
        throw reason
      } finally {
        finishAbort()
      }
    }

    let fourth!: RendererRecord
    await page.route(rendererPath, abortDelivery)
    try {
      await save.click()
      fourth = await committed
      rendererIdentity(
        fourth,
        4,
        uncertainRenderer,
        uncertainCanonical,
        first.createdAt,
      )
      await abortFinished
      await expect(panel.getByRole('alert')).toHaveText(uncertainty)
      await expect(save).toBeDisabled()
      await expect(reload).toBeEnabled()
      await expect(
        panel.getByLabel('CSS classes', { exact: true }),
      ).toHaveValue('uncertain-fourth')
      await expect(
        panel.getByText('Renderer revision 3', { exact: true }),
      ).toBeVisible()
      expect(await get(rendererPath)).toEqual(fourth)
      await unchanged(4)
      await record(
        'Committed save delivery remains unconfirmed',
        'The real PUT commits revision four but browser delivery is aborted; the original reviewed revision and dirty literal stay visible, with Save blocked until explicit reload.',
      )
    } finally {
      if (abortStarted) await abortFinished

      await page.unroute(rendererPath, abortDelivery)
    }

    await acceptReload(fourth)
    await expect(panel.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'uncertain-fourth',
    )
    await unchanged(4)
    await record(
      'Reload confirms committed renderer revision four',
      'Accepted reload retrieves the actual committed renderer, clears delivery uncertainty and restores a clean reviewed revision without retrying Save.',
    )

    await selectElement('Heading 1 (h1)')
    await panel.getByLabel('CSS classes', { exact: true }).fill('pending-fifth')
    await panel
      .getByLabel('Title attribute', { exact: true })
      .fill('Pending <title> & ไทย')
    await panel
      .getByLabel('Accessibility label', { exact: true })
      .fill('Heading ไทย')
    await panel
      .getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      })
      .check()

    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let receiveActual!: (value: RendererRecord) => void
    let rejectActual!: (reason: unknown) => void
    const actual = new Promise<RendererRecord>((resolve, reject) => {
      receiveActual = resolve
      rejectActual = reject
    })
    let holdStarted = false
    let finishHold!: () => void
    const holdFinished = new Promise<void>((resolve) => {
      finishHold = resolve
    })
    const holdDelivery = async (route: Route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue()
        return
      }

      holdStarted = true

      try {
        expect(route.request().postDataJSON()).toEqual({
          version: 4,
          renderer: pendingRenderer,
        })
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
        expect(response.status()).toBe(200)
        receiveActual(await response.json())
        await held
        await route.fulfill({ response })
      } catch (reason) {
        rejectActual(reason)
        throw reason
      } finally {
        finishHold()
      }
    }

    let fifth!: RendererRecord
    await page.route(rendererPath, holdDelivery)
    try {
      const receiving = reply('PUT')
      await save.click()
      fifth = await actual
      rendererIdentity(
        fifth,
        5,
        pendingRenderer,
        pendingCanonical,
        first.createdAt,
      )
      for (const control of [
        save,
        reload,
        defaults,
        panel.getByRole('button', {
          name: 'Close HTML settings',
          exact: true,
        }),
        page.getByRole('button', { name: 'New collection', exact: true }),
        page.getByRole('button', { name: 'API Studio', exact: true }),
        panel.getByRole('combobox', { name: 'Element', exact: true }),
        panel.getByLabel('Title attribute', { exact: true }),
      ])
        await expect(control).toBeDisabled()
      await expect(
        panel.getByText('Renderer revision 4', { exact: true }),
      ).toBeVisible()
      expect(await get(rendererPath)).toEqual(fifth)
      await unchanged(5)
      await record(
        'Accepted renderer save waits for real delivery',
        'The server has accepted revision five while delivery is held; renderer controls and navigation remain disabled and the prior reviewed revision stays visible.',
      )

      await chooseManagementLanguage(page, 'ไทย')
      const thaiPanel = page.getByRole('region', {
        name: collectionRendererLanguages[1].heading,
        exact: true,
      })
      await expect(
        thaiPanel.getByRole('button', {
          name: collectionRendererLanguages[1].save,
          exact: true,
        }),
      ).toBeDisabled()
      release()
      const delivered = await receiving
      expect(delivered.status()).toBe(200)
      expect(await delivered.json()).toEqual(fifth)
      await expect(
        thaiPanel.getByText('การตั้งค่า HTML เวอร์ชัน 5', { exact: true }),
      ).toBeVisible()
      await expect(
        thaiPanel.getByRole('button', {
          name: collectionRendererLanguages[1].reload,
          exact: true,
        }),
      ).toBeEnabled()
      await holdFinished
    } finally {
      release()

      if (holdStarted) await holdFinished

      await page.unroute(rendererPath, holdDelivery)
    }

    await chooseManagementLanguage(page, 'English')
    await savedRevision(5)
    await panel
      .getByLabel('CSS classes', { exact: true })
      .fill('language-draft')
    await panel
      .getByLabel('Title attribute', { exact: true })
      .fill('  Literal <title> & ไทย  ')

    async function retained(
      language: (typeof collectionRendererLanguages)[number],
    ) {
      const translated = page.getByRole('region', {
        name: language.heading,
        exact: true,
      })
      await expect(translated).toBeVisible()
      await expect(
        translated.getByLabel(language.classes, { exact: true }),
      ).toHaveValue('language-draft')
      await expect(
        translated.getByLabel(language.title, { exact: true }),
      ).toHaveValue('  Literal <title> & ไทย  ')
      await expect(
        translated.getByLabel(language.aria, { exact: true }),
      ).toHaveValue('Heading ไทย')
      await expect(
        translated.getByRole('checkbox', { name: language.fixed, exact: true }),
      ).toBeChecked()
      for (const name of [language.save, language.reload, language.defaults])
        await expect(
          translated.getByRole('button', { name, exact: true }),
        ).toBeEnabled()

      return translated
    }

    page.on('request', observeResource)
    for (const language of collectionRendererLanguages) {
      await chooseManagementLanguage(page, language.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)
      await retained(language)
      expect(resourceRequests).toEqual([])
      await record(
        'Dirty collection HTML settings ' + language.code,
        'Translated owner controls preserve authored classes, literal title, accessibility label and fixed checkbox without automatically reading or saving resources.',
      )
    }

    async function phone(
      language: (typeof collectionRendererLanguages)[number],
      mode: 'light' | 'dark',
      option: string,
    ) {
      await chooseManagementLanguage(page, language.choice)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('#appearance').click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode)

      const translated = await retained(language)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)
      const classes = translated.getByLabel(language.classes, { exact: true })
      for (const control of [
        classes,
        translated.getByLabel(language.title, { exact: true }),
        translated.getByLabel(language.aria, { exact: true }),
        translated.getByRole('checkbox', {
          name: language.fixed,
          exact: true,
        }),
      ]) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }

      // Settings and actions occupy separate phone scroll positions.
      await classes.evaluate((element) =>
        element.scrollIntoView({ block: 'start' }),
      )
      await page.evaluate(() => window.scrollBy(0, -100))
      await classes.click()
      await expect(classes).toBeFocused()
      expect(resourceRequests).toEqual([])
      await record(
        'Phone ' + mode + ' collection settings ' + language.code,
        'Focused literal class input and reviewed attribute controls remain contained at 390 pixels; the fixed checkbox retains its authored state.',
        { fullPage: false },
      )

      const actions = [language.save, language.reload, language.defaults].map(
        (name) => translated.getByRole('button', { name, exact: true }),
      )
      await actions[0]!
        .locator('..')
        .evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await actions[0]!.focus()
      await expect(actions[0]!).toBeFocused()
      for (const action of actions) {
        await expect(action).toBeInViewport()
        const box = await action.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }
      expect(resourceRequests).toEqual([])
      await record(
        'Phone ' + mode + ' collection actions ' + language.code,
        'Save, Reload and Use default settings remain enabled, contained and at least 44 pixels; keyboard focus changes no authored settings or saved resources.',
        { fullPage: false },
      )
    }

    await phone(collectionRendererLanguages[1], 'light', 'สว่าง')
    await phone(collectionRendererLanguages[3], 'dark', 'Тёмная')
    await page.setViewportSize(viewport ?? { width: 1440, height: 1000 })
    await chooseManagementLanguage(page, 'English')
    await page.locator('#appearance').click()
    await page.getByRole('option', { name: 'Light', exact: true }).click()
    await retained(collectionRendererLanguages[0])

    expect(resourceRequests).toEqual([])
    expect(browserWrites).toEqual(Array(5).fill('PUT ' + rendererPath))
    expect(await get(rendererPath)).toEqual(fifth)
    await unchanged(5)
    expect(errors).toEqual([])
    expect(count).toBe(collectionRendererPreviewCount)

    return count
  } finally {
    page.off('pageerror', observeError)
    page.off('request', observeWrite)
    page.off('request', observeResource)

    if (viewport && !page.isClosed()) await page.setViewportSize(viewport)
  }
}
