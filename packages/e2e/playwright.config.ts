import {defineConfig} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env file if present (CI provides env vars directly)
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['html', {open: 'never'}], ['list']] : [['list']],
  timeout: 5 * 60 * 1000, // 5 minutes per test
  globalTimeout: 30 * 60 * 1000, // 30 minutes total

  use: {
    trace: isCI ? 'on-first-retry' : 'off',
    screenshot: isCI ? 'only-on-failure' : 'off',
    video: isCI ? 'on-first-retry' : 'off',
  },

  projects: [
    {
      name: 'phase1',
      grep: /@phase1/,
      timeout: 5 * 60 * 1000,
    },
    {
      name: 'phase2',
      grep: /@phase2/,
      timeout: 5 * 60 * 1000,
    },
    {
      name: 'phase3',
      grep: /@phase3/,
      timeout: 5 * 60 * 1000,
      use: {
        browserName: 'chromium',
        trace: isCI ? 'on-first-retry' : 'off',
      },
    },
  ],
})
