import { expect, test as base, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type { PreviewRecord } from '../scripts/preview-report'
import { previewStories, type PreviewStory } from './preview-order'

export type PreviewCapture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

type Workspace = {
  directory: string
  origin: string
  owner: string
  setupKey: string
}

export const test = base.extend<{ previewWorkspace: Workspace }>({
  previewWorkspace: async ({}, use, info) => {
    const story = info.title as PreviewStory
    if (!previewStories.some((entry) => entry.id === story))
      throw new Error('Unknown preview story')
    if (info.parallelIndex > 3)
      throw new Error('Previews allow at most 4 workers')

    const prefix = resolve(tmpdir(), 'besh-preview-')
    const directory = mkdtempSync(prefix)
    const origin = `http://127.0.0.1:${4340 + info.parallelIndex}`
    const owner = crypto.randomUUID() + crypto.randomUUID()
    const setupKey = crypto.randomUUID() + crypto.randomUUID()
    const child = spawn('bun', ['e2e/preview-server.ts'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(4340 + info.parallelIndex),
        BESH_WEB_URL: origin,
        BESH_ADMIN_TOKEN: story === 'core' ? '' : owner,
        BESH_SETUP_KEY: setupKey,
        BESH_DATABASE_PATH: join(directory, 'workspace', 'besh.sqlite'),
        BESH_BACKUP_DIR: join(directory, 'workspace', 'backups'),
        BESH_SECRET_KEY_PATH: join(directory, 'workspace', 'besh-secrets.key'),
        BESH_RUNTIME_CODE_DIR: join(directory, 'workspace', 'runtime'),
      },
    })
    // Resolve once even if startup fails, so cleanup always awaits the child.
    const exited = new Promise<void>((done) =>
      child.once('close', () => done()),
    )
    const ready = new Promise<void>((done, fail) => {
      let output = ''
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString()
        if (output.includes('Isolated preview ready')) done()
      })
      child.once('error', fail)
      child.once('exit', () =>
        fail(new Error('Preview server exited before ready')),
      )
    })
    // Never copy process output into a gallery or log: setup and keys are local.
    child.stderr.resume()
    child.stdin.on('error', () => {})
    try {
      let startupTimer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          ready,
          new Promise<never>((_, fail) => {
            startupTimer = setTimeout(
              () => fail(new Error('Preview server startup timed out')),
              10_000,
            )
          }),
        ])
      } finally {
        clearTimeout(startupTimer)
      }
      const response = await fetch(`${origin}/health`)
      expect(response.ok).toBe(true)
      console.log(
        `Preview workspace ${story}: ${origin} (worker ${info.parallelIndex})`,
      )
      await use({ directory, origin, owner, setupKey })
    } finally {
      child.stdin.end()
      const force = setTimeout(() => child.kill(), 5_000)
      await exited
      clearTimeout(force)
      const target = resolve(directory)
      if (
        !target.startsWith(prefix) ||
        !target.startsWith(resolve(tmpdir()) + sep)
      )
        throw new Error('Invalid preview cleanup path')
      rmSync(target, { recursive: true, force: true })
    }
  },
  baseURL: async ({ previewWorkspace }, use) => use(previewWorkspace.origin),
})

export function storyCapture(page: Page, story: PreviewStory) {
  const directory = resolve(process.env.BESH_PREVIEW_DIR!, 'stories', story)
  const records: PreviewRecord[] = []
  mkdirSync(join(directory, 'images'), { recursive: true })

  const capture: PreviewCapture = async (group, title, detail, options) => {
    const dropdownOpen = (await page.getByRole('listbox').count()) > 0
    if (dropdownOpen)
      await expect(page.getByRole('listbox')).toHaveCSS('opacity', '1')
    if (!dropdownOpen && (await page.locator('.theme-control').count()))
      await expect(page.locator('#appearance')).toBeVisible()
    if (!dropdownOpen && options?.fullPage !== false)
      await page.evaluate(() => window.scrollTo(0, 0))
    const image = `images/${String(records.length + 1).padStart(2, '0')}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-$/, '')}.png`
    await page.screenshot({
      path: join(directory, image),
      fullPage: options?.fullPage ?? !dropdownOpen,
      animations: 'disabled',
      mask: [
        page.locator('input[type="password"]'),
        page.locator('[data-private="true"]'),
        page.getByLabel('Your owner key', { exact: true }),
        page.getByLabel('Workspace token', { exact: true }),
        page.getByLabel('Setup key', { exact: true }),
        page.getByLabel('New member token', { exact: true }),
        page.getByLabel('New API key', { exact: true }),
        page.getByLabel('Invitation link', { exact: true }),
      ],
      maskColor: '#dfe4ec',
    })
    records.push({ page: group, title, detail, image })
    writeFileSync(
      join(directory, 'manifest.json'),
      JSON.stringify(records, null, 2),
    )
    console.log(`Preview ${story} ${records.length}: ${group} / ${title}`)
  }

  function complete() {
    const expected = previewStories.find((entry) => entry.id === story)!.count
    expect(records).toHaveLength(expected)
    writeFileSync(
      join(directory, 'complete.json'),
      JSON.stringify({ count: records.length }),
    )
  }

  return { capture, complete }
}

export async function signInPreview(page: Page, owner: string) {
  await page.goto('/')
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: /API Studio/ })).toBeVisible()
}
