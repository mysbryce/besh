import { expect, test as base } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import {
  seedHtmlPreviewWorkspace,
  type HtmlPreviewWorkspace,
} from './rich-text-html-seed'

export const htmlPreviewOrigin = 'http://127.0.0.1:4395'

export const test = base.extend<{ htmlWorkspace: HtmlPreviewWorkspace }>({
  htmlWorkspace: async ({ page }, use) => {
    const prefix = 'besh-rich-html-'
    const directory = mkdtempSync(join(tmpdir(), prefix))
    const owner = crypto.randomUUID() + crypto.randomUUID()

    const server = spawn('bun', ['src/index.ts'], {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: '4395',
        BESH_HOST: '127.0.0.1',
        BESH_WEB_URL: htmlPreviewOrigin,
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
            return (
              await page.request.get(htmlPreviewOrigin + '/health')
            ).status()
          } catch {
            return 0
          }
        })
        .toBe(200)

      const htmlWorkspace = await seedHtmlPreviewWorkspace(
        page,
        htmlPreviewOrigin,
        owner,
      )
      await use(htmlWorkspace)
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
          'HTML preview cleanup must stay inside its temporary root',
        )

      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      })
    }
  },
})
