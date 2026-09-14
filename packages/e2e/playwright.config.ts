/* eslint-disable line-comment-position */
import {TEST_TIMEOUT} from './setup/constants.js'
import {config} from 'dotenv'
import {defineConfig} from '@playwright/test'

config()

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: 10,
  maxFailures: isCI ? 3 : 0, // Stop early in CI after 3 failures
  reporter: isCI ? [['html', {open: 'never'}], ['list']] : [['list']],
  timeout: TEST_TIMEOUT.default, // Heavy tests override via test.setTimeout()
  globalTimeout: 20 * 60 * 1000,

  use: {
    trace: isCI ? 'on' : 'off',
    screenshot: isCI ? 'on' : 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'local',
      testMatch: [
        'tests/smoke.spec.ts',
        'tests/smoke-pty.spec.ts',
        'tests/fixture-toml.spec.ts',
        'tests/auth-diagnostics.spec.ts',
        'tests/app-management-api.spec.ts',
      ],
    },
    {
      name: 'remote-auth',
      testMatch: 'setup/global-auth.setup.ts',
    },
    {
      name: 'remote',
      testMatch: 'tests/*.spec.ts',
      testIgnore: [
        'tests/smoke.spec.ts',
        'tests/smoke-pty.spec.ts',
        'tests/fixture-toml.spec.ts',
        'tests/auth-diagnostics.spec.ts',
        'tests/app-management-api.spec.ts',
      ],
      dependencies: ['remote-auth'],
    },
  ],
})
