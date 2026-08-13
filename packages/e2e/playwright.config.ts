/* eslint-disable line-comment-position */
import {TEST_TIMEOUT} from './setup/constants.js'
import {config} from 'dotenv'
import {defineConfig} from '@playwright/test'

config()

const isCI = Boolean(process.env.CI)

export default defineConfig({
  globalSetup: './setup/global-auth.ts',
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0, // One retry in CI; flaky-on-retry is reported, not ignored (scripts/report-flaky.js)
  workers: 10,
  maxFailures: isCI ? 5 : 0, // Stop early in CI; first attempts of flaky tests count, so leave room for retries
  reporter: isCI
    ? [['html', {open: 'never'}], ['list'], ['json', {outputFile: 'test-results/results.json'}]]
    : [['list']],
  timeout: TEST_TIMEOUT.default, // Heavy tests override via test.setTimeout()
  globalTimeout: 20 * 60 * 1000,

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
})
