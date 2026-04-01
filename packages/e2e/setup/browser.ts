import {cliFixture} from './cli.js'
import {chromium, type Page} from '@playwright/test'

/**
 * Worker-scoped fixture providing a persistent Playwright browser page.
 *
 * The browser launches once per worker and stays open for the entire run.
 * Downstream fixtures (auth) and tests use `browserPage` for any browser-based
 * actions: OAuth login, dashboard navigation, app uninstall/deletion, etc.
 *
 * Fixture chain: envFixture → cliFixture → browserFixture
 */
export const browserFixture = cliFixture.extend<{}, {browserPage: Page}>({
  browserPage: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const browser = await chromium.launch({headless: !process.env.E2E_HEADED})
      const context = await browser.newContext({
        extraHTTPHeaders: {
          'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
        },
      })
      context.setDefaultTimeout(60_000)
      context.setDefaultNavigationTimeout(60_000)
      const page = await context.newPage()
      await use(page)
      await browser.close()
    },
    {scope: 'worker'},
  ],
})
