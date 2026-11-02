import {BROWSER_TIMEOUT} from './constants.js'
import type {Locator, Page} from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared browser context type
// ---------------------------------------------------------------------------

export interface BrowserContext {
  browserPage: Page
}

// ---------------------------------------------------------------------------
// Main-frame response status tracking
// ---------------------------------------------------------------------------

/**
 * Records the HTTP status of the most recent main-frame document response per
 * page. Populated by a `response` listener attached when the page is created
 * (see `trackMainFrameStatus`). Read via `getLastPageStatus(page)`.
 *
 * A WeakMap lets the entry be garbage-collected with the page — no manual
 * cleanup required.
 */
const lastMainFrameStatus = new WeakMap<Page, number>()

export function trackMainFrameStatus(page: Page): void {
  page.on('response', (response) => {
    if (response.frame() !== page.mainFrame()) return
    if (response.request().resourceType() !== 'document') return
    lastMainFrameStatus.set(page, response.status())
  })
}

/** Get the HTTP status of the last main-frame document response on `page`. */
export function getLastPageStatus(page: Page): number | undefined {
  return lastMainFrameStatus.get(page)
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

/**
 * Wait up to `timeoutMs` for `locator` to become visible. Returns `true` if it
 * appears in time, `false` on timeout or any other locator error (detached
 * element, closed context, etc.).
 *
 * Use this instead of `locator.isVisible({timeout})` — that API does not
 * actually wait in modern Playwright; it returns the current visibility state.
 * This helper uses `waitFor({state: 'visible', timeout})` for true polling.
 */
export async function isVisibleWithin(locator: Locator, timeoutMs: number): Promise<boolean> {
  return locator
    .waitFor({state: 'visible', timeout: timeoutMs})
    .then(() => true)
    .catch(() => false)
}

/**
 * If the most recent main-frame response was a 5xx server error, reload the
 * page and return true. Otherwise return false. Call this in retry loops when
 * a selector isn't found — the page might be an error page.
 *
 * Uses the HTTP status captured by `trackMainFrameStatus` rather than scraping
 * body text, so it works regardless of how an error page is rendered.
 */
export async function refreshIfPageError(page: Page): Promise<boolean> {
  const status = getLastPageStatus(page)
  if (status === undefined || status < 500) return false
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  return true
}

/** Navigate to the dev dashboard for the configured org. */
export async function navigateToDashboard(
  ctx: BrowserContext & {
    email?: string
    orgId?: string
    searchTerm?: string
  },
): Promise<void> {
  const {browserPage} = ctx
  const orgId = ctx.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const dashboardUrl = new URL(
    orgId ? `https://dev.shopify.com/dashboard/${orgId}/apps` : 'https://dev.shopify.com/dashboard',
  )
  if (ctx.searchTerm) dashboardUrl.searchParams.set('search_term', ctx.searchTerm)
  await browserPage.goto(dashboardUrl.toString(), {waitUntil: 'domcontentloaded'})
  await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Retry on server errors
  await refreshIfPageError(browserPage)

  // Handle account picker (skip if email not provided)
  if (ctx.email) {
    const accountButton = browserPage.locator(`text=${ctx.email}`).first()
    if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.medium)) {
      await accountButton.click()
      await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
}
