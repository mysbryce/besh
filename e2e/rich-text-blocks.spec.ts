import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { richTextBlockPreviews } from './rich-text-block-previews'

test.use({ locale: 'en-US' })

test('owner saves typed tables, quotes, literal code and dividers', async ({
  page,
}, info) => {
  const directory = mkdtempSync(join(tmpdir(), 'besh-rich-blocks-'))
  const origin = 'http://127.0.0.1:4391'
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const server = spawn('bun', ['src/index.ts'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: '4391',
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

    await richTextBlockPreviews({
      page,
      owner,
      apiOrigin: origin,
      capture: async (_group, title) => {
        if (title !== 'Typed two-by-two table') return

        await page.screenshot({
          path: info.outputPath('formatted-table.png'),
          fullPage: true,
          animations: 'disabled',
          mask: [page.locator('[data-private]')],
        })
      },
    })
  } finally {
    await page.close()
    server.kill()
    await stopped

    const target = resolve(directory)
    if (
      !target
        .toLowerCase()
        .startsWith((resolve(tmpdir()) + sep).toLowerCase()) ||
      !basename(target).startsWith('besh-rich-blocks-')
    )
      throw new Error(
        'Rich-text blocks cleanup must stay in its temporary root',
      )

    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
  }
})
