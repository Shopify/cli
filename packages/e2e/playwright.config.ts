/* eslint-disable line-comment-position */
import {config} from 'dotenv'
import {defineConfig} from '@playwright/test'

config()

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
  globalTimeout: 30 * 60 * 1000, // 30 minutes total

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
})
