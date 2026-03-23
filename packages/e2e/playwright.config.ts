/* eslint-disable line-comment-position */
import {loadEnv} from './helpers/load-env.js'
import {defineConfig} from '@playwright/test'

loadEnv(import.meta.url)

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
  // Runs after all tests (pass or fail) — deletes QA-E2E-1st-*/QA-E2E-2nd-* test apps
  globalTeardown: './setup/global-teardown.ts',

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
})
