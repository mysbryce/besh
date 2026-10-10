import { defineConfig } from '@playwright/test'
import { join } from 'node:path'

const directory = process.env.BESH_PREVIEW_DIR

if (!directory) throw new Error('Start previews with bun run preview:all')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'preview.spec.ts',
  workers: 4,
  retries: 0,
  timeout: 180_000,
  outputDir: join(directory, 'test-output'),
  use: {
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'off',
    video: 'off',
  },
})
