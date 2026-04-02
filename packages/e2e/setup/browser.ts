import {cliFixture} from './cli.js'
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
      context.setDefaultTimeout(60_000)
      context.setDefaultNavigationTimeout(60_000)
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
  await browserPage.waitForTimeout(3000)

  // Handle account picker (skip if email not provided)
  if (ctx.email) {
    const accountButton = browserPage.locator(`text=${ctx.email}`).first()
    if (await accountButton.isVisible({timeout: 5000}).catch(() => false)) {
      await accountButton.click()
      await browserPage.waitForTimeout(3000)
    }
  }

  // Retry on 500 errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    const pageText = (await browserPage.textContent('body')) ?? '' // eslint-disable-line no-await-in-loop
    if (!pageText.includes('500') && !pageText.includes('Internal Server Error')) break
    await browserPage.waitForTimeout(3000) // eslint-disable-line no-await-in-loop
    await browserPage.reload({waitUntil: 'domcontentloaded'}) // eslint-disable-line no-await-in-loop
  }
}
