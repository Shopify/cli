/* eslint-disable no-console */
import type {Page} from '@playwright/test'

/**
 * Completes the Shopify OAuth login flow on a Playwright page.
 */
export async function completeLogin(page: Page, loginUrl: string, email: string, password: string): Promise<void> {
  const tracing = page.context().tracing

  // Traces are uploaded as public CI artifacts, so we must stop
  // tracing before entering credentials and restart it after login completes.
  let tracingWasActive = false
  try {
    await tracing.stop()
    tracingWasActive = true
    console.log('[e2e] Tracing paused for credential entry')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // tracing.stop() throws if tracing was never started — that's fine
  }

  try {
    await page.goto(loginUrl)

    // Fill in email
    await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 60_000})
    await page.locator('input[name="account[email]"], input[type="email"]').first().fill(email)
    await page.locator('button[type="submit"]').first().click()

    // Fill in password
    await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 60_000})
    await page.locator('input[name="account[password]"], input[type="password"]').first().fill(password)
    await page.locator('button[type="submit"]').first().click()

    // Handle any confirmation/approval page
    await page.waitForTimeout(3000)
    try {
      const btn = page.locator('button[type="submit"]').first()
      if (await btn.isVisible({timeout: 5000})) await btn.click()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_error) {
      // No confirmation page — expected
    }
  } catch (error) {
    // Intentionally omit page HTML from the error — it may contain filled
    // credential values in input elements, which would leak into test reports.
    const pageUrl = page.url()
    throw new Error(
      `Login failed at ${pageUrl}\n` +
        `Original error: ${error}`,
    )
  } finally {
    if (tracingWasActive) {
      // Navigate to blank page before restarting tracing so the first snapshot
      // does not capture any residual credentials on the login form.
      await page.goto('about:blank').catch(() => {})
      await tracing.start({screenshots: true, snapshots: true})
      console.log('[e2e] Tracing resumed after credential entry')
    }
  }
}
