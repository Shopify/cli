import {defineConfig} from '@playwright/test'

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
