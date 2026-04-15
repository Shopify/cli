import {cliFixture} from './cli.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {chromium, type Page} from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared browser context type
// ---------------------------------------------------------------------------

export interface BrowserContext {
  browserPage: Page
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

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
      context.setDefaultTimeout(BROWSER_TIMEOUT.max)
      context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
      const page = await context.newPage()
      await use(page)
      await browser.close()
    },
    {scope: 'worker'},
  ],
})

// ---------------------------------------------------------------------------
// Browser helpers — generic dashboard navigation
// ---------------------------------------------------------------------------
/** Navigate to the dev dashboard for the configured org. */
export async function navigateToDashboard(
  ctx: BrowserContext & {
    email?: string
    orgId?: string
  },
): Promise<void> {
  const {browserPage} = ctx
  const orgId = ctx.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const dashboardUrl = orgId ? `https://dev.shopify.com/dashboard/${orgId}/apps` : 'https://dev.shopify.com/dashboard'
  await browserPage.goto(dashboardUrl, {waitUntil: 'domcontentloaded'})
  await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Handle account picker (skip if email not provided)
  if (ctx.email) {
    const accountButton = browserPage.locator(`text=${ctx.email}`).first()
    if (await accountButton.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
      await accountButton.click()
      await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }

  // Retry on 500 errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    const pageText = (await browserPage.textContent('body')) ?? '' // eslint-disable-line no-await-in-loop
    if (!pageText.includes('500: Internal Server Error') && !pageText.includes('Internal Server Error')) break
    await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium) // eslint-disable-line no-await-in-loop
    await browserPage.reload({waitUntil: 'domcontentloaded'}) // eslint-disable-line no-await-in-loop
  }
}
