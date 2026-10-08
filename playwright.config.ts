import { defineConfig } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'besh-browser-'))

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/preview.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    viewport: { width: 1440, height: 1000 },
    baseURL: 'http://127.0.0.1:5179',
    trace: 'off',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: [
    {
      command: 'bun src/index.ts',
      url: 'http://127.0.0.1:4311/health',
      env: {
        PORT: '4311',
        BESH_ADMIN_TOKEN: '',
        BESH_SETUP_KEY: 'browser-test-setup-key-32-characters-long',
        BESH_WEB_URL: 'http://127.0.0.1:5179',
        BESH_DATABASE_PATH: join(directory, 'besh.sqlite'),
        BESH_BACKUP_DIR: join(directory, 'backups'),
        BESH_SECRET_KEY_PATH: join(directory, 'besh-secrets.key'),
      },
    },
    {
      command: 'bunx vite --port 5179',
      url: 'http://127.0.0.1:5179',
      env: { BESH_API_URL: 'http://127.0.0.1:4311' },
    },
  ],
})
