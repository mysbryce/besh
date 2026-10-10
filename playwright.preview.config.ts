import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
import { getPreviewWorkers } from './scripts/test-workers'

const directory = process.env.BESH_PREVIEW_DIR

if (!directory) throw new Error('Start previews with bun run preview:all')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'preview.spec.ts',
  workers: getPreviewWorkers(),
  retries: 0,
  timeout: 180_000,
  outputDir: join(directory, 'test-output'),
  use: {
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    // Native scrollbar styling must remain visible in captured previews.
    launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'off',
    video: 'off',
  },
})
