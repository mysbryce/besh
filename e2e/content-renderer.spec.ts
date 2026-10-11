import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { signInPreview } from './preview-fixture'
import { chooseManagementLanguage } from './management-locale-previews'
import { collectionRendererLanguages } from './collection-renderer-languages'

const origin = 'http://127.0.0.1:4395'

test.use({ baseURL: origin, locale: 'en-US' })

test.describe.configure({ lock: 'port-4395' })

test('owner reviews and saves collection HTML settings without losing a stale draft', async ({
  page,
}, info) => {
  const prefix = 'besh-collection-renderer-browser-'
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const owner = crypto.randomUUID() + crypto.randomUUID()

  // Match the existing disposable real-server fixture; no renderer or store mocks.
  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4395',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'control.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'secrets.key'),
      BESH_RUNTIME_CODE_DIR: join(directory, 'runtime'),
    },
  })
  const stopped = new Promise<void>((done) => {
    server.once('close', () => done())
    server.once('error', () => done())
  })

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(origin + '/health')).status()
        } catch {
          return 0
        }
      })
      .toBe(200)

    const modelResponse = await page.request.post(origin + '/api/structs', {
      headers: { origin, authorization: 'Bearer ' + owner },
      data: {
        name: 'Articles model ไทย',
        fields: [
          {
            key: 'body',
            label: 'Article body ไทย',
            required: true,
            schema: { type: 'richText', schemaVersion: 2, astVersion: 2 },
          },
        ],
      },
    })
    expect(modelResponse.status()).toBe(200)

    const model = await modelResponse.json()

    await signInPreview(page, owner)
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Content', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'New collection', exact: true })
      .click()

    const collectionName = 'Articles ไทย'
    await page
      .getByLabel('Collection name', { exact: true })
      .fill(collectionName)
    await page
      .getByRole('combobox', { name: 'Content model', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Articles model ไทย', exact: true })
      .click()
    await expect(
      page.getByText('Content model revision 1', { exact: true }),
    ).toBeVisible()

    const created = page.waitForResponse(
      (response) =>
        response.url() === origin + '/api/collections' &&
        response.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Create collection', exact: true })
      .click()

    const response = await created
    expect(response.status()).toBe(200)

    const collection = await response.json()
    expect(collection).toMatchObject({
      name: collectionName,
      version: 1,
      struct: { id: model.id, version: 1, fields: model.fields },
    })
    await expect(
      page.getByRole('heading', { name: collectionName, exact: true }),
    ).toBeVisible()

    await expect(
      page.getByRole('button', { name: 'Review HTML settings', exact: true }),
    ).toBeVisible()

    const reviewed = page.waitForResponse(
      (response) =>
        response.url() ===
          origin + '/api/collections/' + collection.id + '/renderer' &&
        response.request().method() === 'GET',
    )
    await page
      .getByRole('button', { name: 'Review HTML settings', exact: true })
      .click()

    const rendererResponse = await reviewed
    expect(rendererResponse.status()).toBe(200)
    expect(await rendererResponse.json()).toMatchObject({
      collectionId: collection.id,
      collectionVersion: 1,
      structId: model.id,
      structVersion: 1,
      version: 0,
      renderer: { schemaVersion: 1, elements: {} },
      consumerContract: null,
      createdAt: null,
      updatedAt: null,
    })
    await expect(
      page.getByRole('heading', {
        name: 'Collection HTML settings',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Default HTML settings · not saved', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('No custom element settings', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Close HTML settings', exact: true }),
    ).toBeEnabled()

    const save = page.getByRole('button', {
      name: 'Save HTML settings',
      exact: true,
    })
    await expect(save).toBeDisabled()
    await page
      .getByRole('button', { name: 'Advanced element settings', exact: true })
      .click()
    await page.getByRole('combobox', { name: 'Element', exact: true }).click()
    await page
      .getByRole('option', { name: 'Heading 1 (h1)', exact: true })
      .click()
    await page
      .getByLabel('CSS classes', { exact: true })
      .fill('text-heading-1 article-title')
    await page
      .getByLabel('Title attribute', { exact: true })
      .fill('Title <article> & ไทย')
    await page
      .getByLabel('Accessibility label', { exact: true })
      .fill('Heading ไทย')
    await page
      .getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      })
      .check()
    await expect(save).toBeEnabled()

    const saving = page.waitForResponse(
      (response) =>
        response.url() ===
          origin + '/api/collections/' + collection.id + '/renderer' &&
        response.request().method() === 'PUT',
    )
    await save.click()

    const savedResponse = await saving
    expect(savedResponse.status()).toBe(200)
    expect(savedResponse.request().postDataJSON()).toEqual({
      version: 0,
      renderer: {
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
      },
    })
    expect(await savedResponse.json()).toMatchObject({
      collectionId: collection.id,
      version: 1,
      consumerContract: 'besh.fixed-heading-id.v1',
    })
    await expect(
      page.getByText('Renderer revision 1', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeDisabled()
    await expect(
      page.getByLabel('Title attribute', { exact: true }),
    ).toHaveValue('Title <article> & ไทย')

    await page.getByLabel('CSS classes', { exact: true }).fill('local-second')
    const rendererPath =
      origin + '/api/collections/' + collection.id + '/renderer'
    const peerRenderer = {
      schemaVersion: 1,
      elements: { p: { classes: ['peer-saved'] } },
    }
    const peerResponse = await page.request.put(rendererPath, {
      headers: { origin, authorization: 'Bearer ' + owner },
      data: { version: 1, renderer: peerRenderer },
    })
    expect(peerResponse.status()).toBe(200)
    const peer = await peerResponse.json()
    expect(peer.version).toBe(2)

    const staleReply = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'PUT',
    )
    await save.click()
    expect((await staleReply).status()).toBe(409)
    await expect(
      page
        .getByRole('alert')
        .filter({
          hasText: 'Collection renderer changed. Reload before saving.',
        })
        .first(),
    ).toBeVisible()
    await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'local-second',
    )
    await expect(
      page.getByLabel('Title attribute', { exact: true }),
    ).toHaveValue('Title <article> & ไทย')
    await expect(
      page.getByText('Renderer revision 1', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeDisabled()

    const reload = page.getByRole('button', {
      name: 'Reload HTML settings',
      exact: true,
    })
    await expect(reload).toBeEnabled()
    const reads: string[] = []
    page.on('request', (request) => {
      if (request.url() === rendererPath && request.method() === 'GET')
        reads.push(request.url())
    })
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard unsaved HTML settings?')
      await dialog.dismiss()
    })
    await reload.click()
    expect(reads).toEqual([])
    await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'local-second',
    )
    await expect(save).toBeDisabled()

    const reloaded = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'GET',
    )
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard unsaved HTML settings?')
      await dialog.accept()
    })
    await reload.click()
    expect((await reloaded).status()).toBe(200)
    await expect(
      page.getByText('Renderer revision 2', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeDisabled()
    await page.getByRole('combobox', { name: 'Element', exact: true }).click()
    await page
      .getByRole('option', { name: 'Paragraph (p)', exact: true })
      .click()
    await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'peer-saved',
    )
    const finalResponse = await page.request.get(rendererPath, {
      headers: { authorization: 'Bearer ' + owner },
    })
    expect(finalResponse.status()).toBe(200)
    expect(await finalResponse.json()).toEqual(peer)

    const defaults = page.getByRole('button', {
      name: 'Use default settings',
      exact: true,
    })
    await expect(defaults).toBeEnabled()
    await defaults.click()
    await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
      '',
    )
    await expect(
      page.getByText('Renderer revision 2', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeEnabled()

    const beforeDefaultSave = await page.request.get(rendererPath, {
      headers: { authorization: 'Bearer ' + owner },
    })
    expect(beforeDefaultSave.status()).toBe(200)
    expect(await beforeDefaultSave.json()).toEqual(peer)
    const defaultSaved = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'PUT',
    )
    await save.click()
    const defaultResponse = await defaultSaved
    expect(defaultResponse.status()).toBe(200)
    expect(defaultResponse.request().postDataJSON()).toEqual({
      version: 2,
      renderer: { schemaVersion: 1, elements: {} },
    })
    expect(await defaultResponse.json()).toMatchObject({
      version: 3,
      renderer: { schemaVersion: 1, elements: {} },
      consumerContract: null,
    })
    await expect(
      page.getByText('Renderer revision 3', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('No custom element settings', { exact: true }),
    ).toBeVisible()
    await expect(save).toBeDisabled()
    await expect(defaults).toBeDisabled()

    await page
      .getByLabel('CSS classes', { exact: true })
      .fill('uncertain-fourth')
    await expect(save).toBeEnabled()
    let received!: (value: { status: number; version: number }) => void
    const committed = new Promise<{ status: number; version: number }>(
      (done) => {
        received = done
      },
    )
    let routeStarted = false
    let finishRoute!: () => void
    const routeFinished = new Promise<void>((done) => {
      finishRoute = done
    })
    await page.route(rendererPath, async (route) => {
      routeStarted = true

      try {
        const response = await route.fetch({ maxRedirects: 0 })
        received({
          status: response.status(),
          version: (await response.json()).version,
        })
        await route.abort('failed')
      } finally {
        finishRoute()
      }
    })
    try {
      await save.click()
      expect(await committed).toEqual({ status: 200, version: 4 })
      await routeFinished
      await expect(save).toBeDisabled()
      await expect(
        page
          .getByRole('alert')
          .filter({
            hasText:
              'Save could not be confirmed. Reload HTML settings before trying again.',
          })
          .first(),
      ).toBeVisible()
      await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
        'uncertain-fourth',
      )
      await expect(
        page.getByText('Renderer revision 3', { exact: true }),
      ).toBeVisible()
    } finally {
      if (routeStarted) await routeFinished
      await page.unroute(rendererPath)
    }

    const confirmed = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'GET',
    )
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard unsaved HTML settings?')
      await dialog.accept()
    })
    await reload.click()
    expect((await confirmed).status()).toBe(200)
    await expect(
      page.getByText('Renderer revision 4', { exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('CSS classes', { exact: true })).toHaveValue(
      'uncertain-fourth',
    )
    await expect(save).toBeDisabled()

    await page.getByRole('combobox', { name: 'Element', exact: true }).click()
    await page
      .getByRole('option', { name: 'Heading 1 (h1)', exact: true })
      .click()
    await page.getByLabel('CSS classes', { exact: true }).fill('language-draft')
    await page
      .getByLabel('Title attribute', { exact: true })
      .fill('  Literal <title> & ไทย  ')
    await page
      .getByLabel('Accessibility label', { exact: true })
      .fill('Heading ไทย')
    await page
      .getByRole('checkbox', {
        name: 'Use fixed heading identifier',
        exact: true,
      })
      .check()
    const resourceRequests: string[] = []
    page.on('request', (request) => {
      if (
        /\/api\/(collections|structs|data-sources|database-connections|flows)(?:\/|$)/.test(
          request.url(),
        )
      )
        resourceRequests.push(request.url())
    })
    await chooseManagementLanguage(page, 'ไทย')
    await expect(
      page.getByRole('heading', {
        name: 'การตั้งค่า HTML ของคอลเลกชัน',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'บันทึกการตั้งค่า HTML', exact: true }),
    ).toBeEnabled()

    async function retained(
      language: (typeof collectionRendererLanguages)[number],
    ) {
      const panel = page.getByRole('region', {
        name: language.heading,
        exact: true,
      })
      await expect(panel).toBeVisible()
      await expect(
        panel.getByLabel(language.classes, { exact: true }),
      ).toHaveValue('language-draft')
      await expect(
        panel.getByLabel(language.title, { exact: true }),
      ).toHaveValue('  Literal <title> & ไทย  ')
      await expect(
        panel.getByLabel(language.aria, { exact: true }),
      ).toHaveValue('Heading ไทย')
      await expect(
        panel.getByRole('checkbox', { name: language.fixed, exact: true }),
      ).toBeChecked()
      await expect(
        panel.getByRole('button', { name: language.save, exact: true }),
      ).toBeEnabled()
      await expect(
        panel.getByRole('button', { name: language.reload, exact: true }),
      ).toBeEnabled()
      await expect(
        panel.getByRole('button', { name: language.defaults, exact: true }),
      ).toBeEnabled()

      return panel
    }

    for (const language of collectionRendererLanguages) {
      await chooseManagementLanguage(page, language.choice)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)
      await retained(language)
    }

    for (const [index, mode, option] of [
      [1, 'light', 'สว่าง'],
      [3, 'dark', 'Тёмная'],
    ] as const) {
      const language = collectionRendererLanguages[index]
      await chooseManagementLanguage(page, language.choice)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('#appearance').click()
      await page.getByRole('option', { name: option, exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode)

      const panel = await retained(language)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)
      const classes = panel.getByLabel(language.classes, { exact: true })
      await classes.click()
      await expect(classes).toBeFocused()
      for (const control of [
        classes,
        panel.getByLabel(language.title, { exact: true }),
        panel.getByRole('checkbox', { name: language.fixed, exact: true }),
      ]) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }
      await page.screenshot({
        path: info.outputPath('phone-' + mode + '-settings.png'),
        fullPage: false,
        animations: 'disabled',
        mask: [page.locator('[data-private]')],
      })

      const actions = [language.save, language.reload, language.defaults].map(
        (name) => panel.getByRole('button', { name, exact: true }),
      )
      await actions[0]!.scrollIntoViewIfNeeded()
      for (const action of actions) {
        const box = await action.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      }
      await page.screenshot({
        path: info.outputPath('phone-' + mode + '-actions.png'),
        fullPage: false,
        animations: 'disabled',
        mask: [page.locator('[data-private]')],
      })
    }
    expect(resourceRequests).toEqual([])

    await page.setViewportSize({ width: 1440, height: 1000 })
    await chooseManagementLanguage(page, 'English')

    const preserved = {
      schemaVersion: 1,
      elements: {
        h1: { classes: [], attributes: { title: '', 'aria-label': '' } },
        p: {},
        h2: { attributes: {} },
        em: { classes: ['second', 'first'] },
      },
      consumerContract: 'besh.fixed-heading-id.v1',
    }
    const wirePeer = await page.request.put(rendererPath, {
      headers: { origin, authorization: 'Bearer ' + owner },
      data: { version: 4, renderer: preserved },
    })
    expect(wirePeer.status()).toBe(200)
    expect(await wirePeer.json()).toMatchObject({
      version: 5,
      renderer: preserved,
    })

    const wireReview = page.waitForResponse(
      (response) =>
        response.url() === rendererPath &&
        response.request().method() === 'GET',
    )
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Discard unsaved HTML settings?')
      await dialog.accept()
    })
    await reload.click()
    expect((await wireReview).status()).toBe(200)
    await expect(
      page.getByText('Renderer revision 5', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel('Title attribute', { exact: true }),
    ).toHaveValue('')
    await expect(save).toBeDisabled()
    await page
      .getByLabel('Title attribute', { exact: true })
      .fill('Only changed title <literal>')

    // Hold the real accepted response, so pending controls face actual delivery.
    let releaseSave!: () => void
    const holdSave = new Promise<void>((done) => {
      releaseSave = done
    })
    let acceptedSave!: () => void
    const saveAccepted = new Promise<void>((done) => {
      acceptedSave = done
    })
    let finishSave!: () => void
    const saveFinished = new Promise<void>((done) => {
      finishSave = done
    })
    let heldSaveStarted = false
    await page.route(rendererPath, async (route) => {
      heldSaveStarted = true

      try {
        expect(route.request().method()).toBe('PUT')
        expect(route.request().postDataJSON()).toEqual({
          version: 5,
          renderer: {
            ...preserved,
            elements: {
              ...preserved.elements,
              h1: {
                classes: [],
                attributes: {
                  title: 'Only changed title <literal>',
                  'aria-label': '',
                },
              },
            },
          },
        })

        const response = await route.fetch({ maxRedirects: 0 })
        expect(response.status()).toBe(200)
        expect((await response.json()).version).toBe(6)
        acceptedSave()
        await holdSave
        await route.fulfill({ response })
      } finally {
        finishSave()
      }
    })
    try {
      await save.click()
      await saveAccepted
      for (const name of [
        'Save HTML settings',
        'Reload HTML settings',
        'Use default settings',
        'Close HTML settings',
        'New collection',
        'API Studio',
      ])
        await expect(
          page.getByRole('button', { name, exact: true }),
        ).toBeDisabled()
      await expect(
        page.getByRole('combobox', { name: 'Element', exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByLabel('Title attribute', { exact: true }),
      ).toBeDisabled()
      await chooseManagementLanguage(page, 'ไทย')
      await expect(
        page.getByRole('button', {
          name: 'บันทึกการตั้งค่า HTML',
          exact: true,
        }),
      ).toBeDisabled()
      releaseSave()
      await saveFinished
      await expect(
        page.getByText('การตั้งค่า HTML เวอร์ชัน 6', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByLabel('แอตทริบิวต์ title', { exact: true }),
      ).toHaveValue('Only changed title <literal>')
    } finally {
      releaseSave()
      if (heldSaveStarted) await saveFinished
      await page.unroute(rendererPath)
    }

    const finalWire = await page.request.get(rendererPath, {
      headers: { authorization: 'Bearer ' + owner },
    })
    expect(finalWire.status()).toBe(200)
    expect(await finalWire.json()).toMatchObject({
      version: 6,
      renderer: {
        ...preserved,
        elements: {
          ...preserved.elements,
          h1: {
            classes: [],
            attributes: {
              title: 'Only changed title <literal>',
              'aria-label': '',
            },
          },
        },
      },
    })
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    const parent = resolve(tmpdir()) + sep
    if (
      !target.toLowerCase().startsWith(parent.toLowerCase()) ||
      !basename(target).startsWith(prefix)
    )
      throw new Error(
        'Renderer browser cleanup must stay inside its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
