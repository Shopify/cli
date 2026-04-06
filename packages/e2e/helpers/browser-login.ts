import type {Page} from '@playwright/test'

/**
 * Sets an input field's value via the DOM, bypassing Playwright's fill() API.
 *
 * Security (shopify/bugbounty#3638393): Playwright's test runner logs every
 * fill() call — including the literal value — into trace files, which are
 * uploaded as publicly downloadable CI artifacts. Using evaluate() to set
 * the value directly avoids the Playwright action log entirely. The runner's
 * tracing instruments at a level above context.tracing, so context.tracing.stop()
 * does NOT prevent the leak.
 */
async function fillSensitive(page: Page, selector: string, value: string): Promise<void> {
  const locator = page.locator(selector).first()
  await locator.evaluate((el, val) => {
    ;(el as unknown as {value: string}).value = val
    el.dispatchEvent(new Event('input', {bubbles: true}))
    el.dispatchEvent(new Event('change', {bubbles: true}))
  }, value)
}

/**
 * Completes the Shopify OAuth login flow on a Playwright page.
 */
export async function completeLogin(page: Page, loginUrl: string, email: string, password: string): Promise<void> {
  await page.goto(loginUrl)

  try {
    // Fill in email
    await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 60_000})
    await fillSensitive(page, 'input[name="account[email]"], input[type="email"]', email)
    await page.locator('button[type="submit"]').first().click()

    // Fill in password
    await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 60_000})
    await fillSensitive(page, 'input[name="account[password]"], input[type="password"]', password)
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
    const pageUrl = page.url()
    // Clear the page so failure artifacts (screenshots, trace snapshots) do
    // not capture the login form with credentials still populated.
    await page.goto('about:blank').catch(() => {})
    throw new Error(`Login failed at ${pageUrl}\nOriginal error: ${error}`)
  }
}
