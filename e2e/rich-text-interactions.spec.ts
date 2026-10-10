import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import type { PreviewCapture } from './preview-fixture'
import {
  verifyRichTextLinkInteraction,
  verifyRichTextClipboardInteraction,
  verifyRichTextPendingInteraction,
  type RichTextArticle as Article,
} from './rich-text-interaction-previews'

const test = base.extend<{ article: Article }>({
  article: async ({ page }, use) => {
    const prefix = 'besh-rich-interactions-'
    const directory = mkdtempSync(join(tmpdir(), prefix))
    const origin = 'http://127.0.0.1:4392'
    const owner = crypto.randomUUID() + crypto.randomUUID()
    const headers = { origin, authorization: 'Bearer ' + owner }
    const errors: string[] = []

    page.on('pageerror', (error) => errors.push(error.message))

    const server = spawn('bun', ['src/index.ts'], {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: '4392',
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
        headers,
        data: {
          name: 'Interaction articles',
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
          data: {
            name: 'Interaction articles',
            structId: model.id,
            structVersion: 1,
          },
        },
      )
      expect(collectionResponse.status()).toBe(200)
      const collection = await collectionResponse.json()

      await page.goto(origin)
      await page.getByLabel('Workspace token', { exact: true }).fill(owner)
      await page
        .getByRole('button', { name: 'Open workspace', exact: true })
        .click()
      await page.getByRole('button', { name: 'Content', exact: true }).click()
      await page
        .getByRole('combobox', { name: 'Choose a collection', exact: true })
        .click()
      await page
        .getByRole('option', { name: 'Interaction articles', exact: true })
        .click()
      await page.getByRole('button', { name: 'New entry', exact: true }).click()

      await use({
        origin,
        headers,
        entries: origin + '/api/collections/' + collection.id + '/entries',
      })

      expect(errors).toEqual([])
    } finally {
      await page.close()
      server.kill()
      await stopped

      const target = resolve(directory)
      const parent = resolve(tmpdir()) + sep
      if (
        !target.toLowerCase().startsWith(parent.toLowerCase()) ||
        !basename(target).startsWith(prefix)
      ) {
        throw new Error(
          'Rich-text interaction cleanup must stay inside its temporary root',
        )
      }

      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      })
    }
  },
})

test.use({ locale: 'en-US' })

function diagnosticCapture(page: Page, info: TestInfo): PreviewCapture {
  return async (_, title) => {
    const filename =
      title === 'Pending HTTPS link review'
        ? 'link-review.png'
        : title === 'Held entry creation response'
          ? 'held-entry-response.png'
          : undefined

    if (!filename) return

    await page.screenshot({
      path: info.outputPath(filename),
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('[data-private]')],
    })
  }
}

test('link review supports keyboard apply and cancel without navigation or early saving', async ({
  page,
  article,
}, info) => {
  await verifyRichTextLinkInteraction(
    page,
    article,
    diagnosticCapture(page, info),
  )
})

test('clipboard paste saves literal plain text instead of hostile HTML', async ({
  page,
  article,
}, info) => {
  await verifyRichTextClipboardInteraction(
    page,
    article,
    diagnosticCapture(page, info),
  )
})

test('pending real entry creation locks formatting until its response arrives', async ({
  page,
  article,
}, info) => {
  await verifyRichTextPendingInteraction(
    page,
    article,
    diagnosticCapture(page, info),
  )
})
