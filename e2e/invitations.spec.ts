import { expect, test } from '@playwright/test'
import { invitationPreviews } from './invitation-previews'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

test.describe.configure({ lock: ['port-4330', 'clipboard'] })

test('owner opens sign-in invitation for an existing key-only member', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  page.setDefaultTimeout(10_000)
  const directory = mkdtempSync(join(tmpdir(), 'besh-invitations-'))
  const owner = crypto.randomUUID() + crypto.randomUUID()
  const backend = 'http://127.0.0.1:4330'
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  const server = spawn('bun', ['src/index.ts'], {
    env: {
      ...process.env,
      PORT: '4330',
      BESH_HOST: '127.0.0.1',
      BESH_ADMIN_TOKEN: owner,
      BESH_WEB_URL: backend,
      BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
      BESH_BACKUP_DIR: join(directory, 'backups'),
      BESH_SECRET_KEY_PATH: join(directory, 'secrets.key'),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
  const stopped = new Promise<void>((finish) => {
    server.once('exit', () => finish())
    server.once('error', () => finish())
  })

  try {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get(`${backend}/health`)).status()
        } catch {
          return 0
        }
      })
      .toBe(200)
    await page.goto(backend, { timeout: 30_000 })
    await invitationPreviews({
      page,
      owner,
      apiOrigin: backend,
      capture: async (_group, title, _detail, options) => {
        await page.screenshot({
          path: testInfo.outputPath(
            `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
          ),
          fullPage: options?.fullPage ?? true,
          animations: 'disabled',
          mask: [
            page.getByLabel('Workspace token', { exact: true }),
            page.getByLabel('Invitation link', { exact: true }),
            page.locator('input[type="password"]'),
          ],
          maskColor: '#dfe4ec',
        })
      },
    })
    expect(browserErrors).toEqual([])
  } catch (error) {
    await page.screenshot({
      path: testInfo.outputPath('invitation-owner-entry-failure-masked.png'),
      fullPage: true,
      animations: 'disabled',
      mask: [
        page.getByLabel('Workspace token', { exact: true }),
        page.getByLabel('Invitation link', { exact: true }),
        page.locator('input[type="password"]'),
      ],
      maskColor: '#dfe4ec',
    })
    throw error
  } finally {
    await page.close()
    server.kill()
    await stopped
    if (!resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`))
      throw new Error(
        'Fixture directory must remain inside the temporary root.',
      )
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
})
