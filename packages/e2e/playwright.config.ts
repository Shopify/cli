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
  retries: 0,
  workers: 5,
  maxFailures: isCI ? 3 : 0, // Stop early in CI after 3 failures
  reporter: isCI ? [['html', {open: 'never'}], ['list']] : [['list']],
  timeout: TEST_TIMEOUT.default, // Heavy tests override via test.setTimeout()
  globalTimeout: 20 * 60 * 1000,

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
})
