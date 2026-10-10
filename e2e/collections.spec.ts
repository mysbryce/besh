import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { collectionPreviews } from './collection-previews'

test.use({ locale: 'en-US' })

test('owner creates private collections and typed content using a reviewed saved model', async ({
  page,
}, info) => {
  const prefix = join(tmpdir(), 'besh-collection-browser-')
  const directory = mkdtempSync(prefix)
  const origin = 'http://127.0.0.1:4337'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const errors: string[] = []
  let number = 0

  page.on('pageerror', (error) => errors.push(error.message))

  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4337',
      BESH_HOST: '127.0.0.1',
      BESH_WEB_URL: origin,
      BESH_ADMIN_TOKEN: owner,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
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

    await collectionPreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title) => {
        if (
          ![
            'Edited nested private entry',
            'Phone light nested private entry',
            'Phone dark nested private entry',
          ].includes(title)
        )
          return

        await page.screenshot({
          path: info.outputPath(
            `${++number}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: true,
          style: 'html { scrollbar-gutter: stable !important }',
          animations: 'disabled',
          mask: [
            page.locator('[data-private]'),
            page.locator('input[type="password"]'),
          ],
        })
      },
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
      !basename(target).startsWith('besh-collection-browser-')
    )
      throw new Error(
        'Collection browser cleanup must stay inside its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
