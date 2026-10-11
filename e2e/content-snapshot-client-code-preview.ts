import { expect, type Page, type Request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openApiTools } from './api-tools'
import { signInPreview } from './preview-fixture'
import {
  seedHtmlPreviewWorkspace,
  type HtmlPreviewWorkspace,
} from './rich-text-html-seed'

type Capture = (group: string, title: string, detail: string) => Promise<void>

const targets = [
  ['JavaScript — Axios', 'javascript-axios', 'request.mjs'],
  ['JavaScript — Fetch', 'javascript-fetch', 'request.mjs'],
  ['PHP — cURL', 'php-curl', 'request.php'],
  ['cURL — shell', 'curl', 'request.sh'],
  ['Rust — reqwest', 'rust-reqwest', 'main.rs'],
  ['Go — net/http', 'go-net-http', 'main.go'],
  ['Java — java.net.http', 'java-http-client', 'Main.java'],
  ['C++ — libcurl', 'cpp-libcurl', 'main.cpp'],
] as const

export async function contentSnapshotClientCodePreviews({
  page,
  owner,
  capture,
  apiOrigin,
  workspace,
}: {
  page: Page
  owner: string
  capture: Capture
  apiOrigin: string
  workspace?: HtmlPreviewWorkspace
}) {
  const saved =
    workspace ?? (await seedHtmlPreviewWorkspace(page, apiOrigin, owner))
  const headers = { origin: apiOrigin, authorization: 'Bearer ' + owner }
  const snapshots: {
    name: string
    id: string
    path: string
    graphql: boolean
  }[] = []

  for (const graphql of [true, false]) {
    const mode = graphql ? 'GraphQL' : 'REST'
    const path = '/content-client-' + mode.toLowerCase()
    const creation = await page.request.post(
      apiOrigin +
        '/api/collections/' +
        saved.collectionId +
        '/entries/' +
        saved.entryId +
        '/snapshot-flow' +
        (graphql ? '/graphql' : ''),
      {
        headers,
        data: {
          name: 'Content ' + mode + ' client examples',
          path,
          collectionVersion: 1,
          entryVersion: 1,
          rendererVersion: 0,
          fieldPath: ['body'],
        },
      },
    )
    expect(creation.status()).toBe(200)

    const flow = await creation.json()
    expect(
      (
        await page.request.post(
          apiOrigin + '/api/flows/' + flow.id + '/publish',
          {
            headers,
            data: { revision: 1 },
          },
        )
      ).status(),
    ).toBe(200)
    snapshots.push({ name: flow.name, id: flow.id, path, graphql })
  }

  const forbidden: string[] = []
  const onRequest = (request: Request) => {
    const path = new URL(request.url()).pathname
    if (
      /^\/(run|graphql)\//.test(path) ||
      /\/(?:test|graphql-test|openapi|backend-code|releases(?:\/\d+)?|rollback)$/.test(
        path,
      ) ||
      path.startsWith('/api/runtime-keys') ||
      path.startsWith('/api/collections/')
    )
      forbidden.push(request.method() + ' ' + path)
  }
  page.on('request', onRequest)

  const panel = page.getByRole('region', { name: 'Use this API', exact: true })
  async function select(label: string, name: string) {
    await panel.getByRole('combobox', { name: label, exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(
      panel.getByRole('combobox', { name: label, exact: true }),
    ).toHaveText(name)
  }
  async function appearance(mode: 'Light' | 'Dark') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      mode.toLowerCase(),
    )
  }
  async function generate(
    id: string,
    source: 'published' | 'draft' = 'published',
  ) {
    const reply = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/flows/' + id + '/client-code' &&
        response.request().method() === 'POST',
    )
    await panel
      .getByRole('button', { name: 'Generate example', exact: true })
      .click()
    const response = await reply
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toMatchObject({
      source,
      revision: 1,
    })

    const generated = await response.json()
    await expect(panel.getByLabel('Generated client code')).toHaveText(
      generated.code,
    )
    expect(generated.code).toContain('BESH_RUNTIME_API_KEY')
    expect(generated.code).not.toContain('Saved heading ไทย')
    expect(generated.code).not.toContain('<script>literal</script>')
    expect(generated.code).not.toContain(owner)

    return generated
  }

  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    if (
      await page.getByRole('button', { name: 'Sign out', exact: true }).count()
    ) {
      await page.reload()
      await expect(
        page.getByRole('heading', { name: /API Studio/ }),
      ).toBeVisible()
    } else {
      await signInPreview(page, owner)
    }

    for (const flow of snapshots) {
      const mode = flow.graphql ? 'GraphQL' : 'REST'
      await appearance('Light')
      await page.getByRole('button', { name: /^API Studio/ }).click()
      await page
        .locator('.api-list button')
        .filter({ hasText: flow.name })
        .click()
      await openApiTools(page)
      if (!(await panel.count()))
        await page
          .getByRole('button', { name: 'Use this API', exact: true })
          .click()
      await expect(
        panel.getByText('Published release · revision 1', { exact: true }),
      ).toBeVisible()
      await expect(
        panel.getByRole('combobox', { name: 'Example source', exact: true }),
      ).toHaveText('Published release')
      if (flow.graphql)
        await expect(panel.getByLabel('Client GraphQL operation')).toHaveValue(
          /\.\.\. on CmsText \{ text \}/,
        )
      else
        await expect(panel.getByLabel('Client GraphQL operation')).toHaveCount(
          0,
        )
      await capture(
        'Content client code',
        mode + ' sealed published client form',
        'Saved publication revision 1 supplies the structural contract. The sealed graph remains read-only and no source content or caller key is fetched.',
      )

      await panel
        .getByRole('combobox', { name: 'Client language', exact: true })
        .click()
      await capture(
        'Content client code',
        mode + ' client language choices',
        'Eight custom accessible target options retain the existing language and HTTP library labels.',
      )
      await page.keyboard.press('Escape')
      await expect(page.getByRole('listbox')).toHaveCount(0)

      for (const [label, target, filename] of targets) {
        await select('Client language', label)
        const generated = await generate(flow.id)
        expect(generated).toMatchObject({
          target,
          filename,
          method: flow.graphql ? 'POST' : 'GET',
          url: apiOrigin + (flow.graphql ? '/graphql' : '/run') + flow.path,
        })
        if (flow.graphql) {
          expect(generated.code).toContain('CmsHeading')
          expect(generated.code).toContain('CmsText')
        }

        const downloadReply = page.waitForEvent('download')
        await panel
          .getByRole('button', { name: 'Download code', exact: true })
          .click()
        const download = await downloadReply
        expect(download.suggestedFilename()).toBe(filename)
        expect(readFileSync((await download.path())!, 'utf8')).toBe(
          generated.code,
        )

        await panel
          .getByRole('button', { name: 'Copy code', exact: true })
          .click()
        await expect(
          panel.getByRole('button', { name: 'Code copied', exact: true }),
        ).toBeVisible()
        expect(
          (
            await page.evaluate(() => navigator.clipboard.readText())
          ).replaceAll('\r\n', '\n'),
        ).toBe(generated.code)
        await capture(
          'Content client code',
          mode + ' ' + label + ' client example',
          'Real saved-source generation supplies code, requirements and the owner-issued current-release pin warning. Copy and downloaded UTF-8 bytes match the displayed example; the API is not invoked.',
        )
      }

      await select('Client language', 'JavaScript — Fetch')
      await select('Example source', 'Saved draft')
      await expect(
        panel.getByText('Saved draft · revision 1', { exact: true }),
      ).toBeVisible()
      await generate(flow.id, 'draft')
      await expect(
        panel.getByText(
          'Publish this saved revision first. The current live release may differ.',
          { exact: true },
        ),
      ).toBeVisible()
      await capture(
        'Content client code',
        mode + ' explicit saved draft example',
        'Saved draft is an explicit source choice with a server-delivered publish-first warning. It does not enable draft testing or an archived caller.',
      )

      await select('Example source', 'Published release')
      await expect(
        panel.getByText('Published release · revision 1', { exact: true }),
      ).toBeVisible()
      await generate(flow.id)
      await appearance('Dark')
      await capture(
        'Appearance',
        mode + ' dark Content client panel',
        'Published source, typed operation, code and server-delivered warnings remain readable in dark appearance.',
      )
      await page.setViewportSize({ width: 390, height: 844 })
      await capture(
        'Mobile',
        mode + ' dark Content client phone',
        'Client controls stack and code remains bounded within its phone panel. No runtime credential is entered.',
      )
      await appearance('Light')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await capture(
        'Mobile',
        mode + ' light Content client phone',
        'The light 390-pixel view contains custom source/language controls, code and copy/download actions.',
      )
      await page.setViewportSize({ width: 1440, height: 1000 })
    }

    expect(forbidden).toEqual([])
  } finally {
    page.off('request', onRequest)
    await page.context().clearPermissions()
    if (!page.isClosed())
      await page.setViewportSize({ width: 1440, height: 1000 })
  }
}
