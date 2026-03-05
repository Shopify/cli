import type {Page} from '@playwright/test'

/**
 * Completes the Shopify OAuth login flow on a Playwright page.
 */
export async function completeLogin(page: Page, loginUrl: string, email: string, password: string): Promise<void> {
  await page.goto(loginUrl)

  try {
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
    const pageContent = await page.content().catch(() => '(failed to get content)')
    const pageUrl = page.url()
    throw new Error(
      `Login failed at ${pageUrl}\n` +
        `Original error: ${error}\n` +
        `Page HTML (first 2000 chars): ${pageContent.slice(0, 2000)}`,
    )
  }
}
