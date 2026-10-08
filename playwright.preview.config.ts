import { defineConfig } from '@playwright/test'
import { join, resolve } from 'node:path'

const directory = process.env.BESH_PREVIEW_DIR
const setupKey = process.env.BESH_PREVIEW_SETUP_KEY

if (!directory || !setupKey)
  throw new Error('Start previews with bun run preview:all')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'preview.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 180_000,
  outputDir: join(directory, 'test-output'),
  use: {
    actionTimeout: 10_000,
    baseURL: 'http://127.0.0.1:5180',
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: 'bun src/index.ts',
      url: 'http://127.0.0.1:4322/health',
      env: {
        PORT: '4322',
        BESH_HOST: '127.0.0.1',
        BESH_ADMIN_TOKEN: '',
        BESH_SETUP_KEY: setupKey,
        BESH_DATABASE_PATH: resolve(directory, 'workspace/besh.sqlite'),
        BESH_BACKUP_DIR: resolve(directory, 'workspace/backups'),
      },
    },
    {
      command: 'bunx vite --port 5180',
      url: 'http://127.0.0.1:5180',
      env: { BESH_API_URL: 'http://127.0.0.1:4322' },
    },
  ],
})
