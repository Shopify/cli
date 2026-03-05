/* eslint-disable line-comment-position */
/* eslint-disable no-restricted-imports */
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
    process.env[key] ??= value
  }
}

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  maxFailures: isCI ? 3 : 0, // Stop early in CI after 3 failures
  reporter: isCI ? [['html', {open: 'never'}], ['list']] : [['list']],
  timeout: 3 * 60 * 1000, // 3 minutes per test
  globalTimeout: 15 * 60 * 1000, // 15 minutes total

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
})
