import {cliFixture as test} from '../fixtures/cli-process.js'
import {expect, chromium} from '@playwright/test'

test.describe('Auth login @phase1', () => {
  test('login via browser automation', async ({cli, env}) => {
    const email = process.env.E2E_ACCOUNT_EMAIL
    const password = process.env.E2E_ACCOUNT_PASSWORD
    if (!email || !password) {
      throw new Error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required')
    }

    // Step 0: Clear any existing session
    await cli.exec(['auth', 'logout'])

    // Step 1: Spawn auth login via PTY.
    // We must NOT set CI=1 here — the device auth flow aborts in CI mode.
    // We also suppress the system browser from opening by setting BROWSER=none.
    const proc = await cli.spawn(['auth', 'login'], {
      env: {
        CI: '',
        BROWSER: 'none',
      },
    })

    // Step 2: Wait for the "press any key" prompt, then send a key
    await proc.waitForOutput('Press any key to open the login page', 30_000)
    proc.sendKey(' ')

    // Step 3: Wait for the verification URL to appear in output
    await proc.waitForOutput('start the auth process', 10_000)

    const output = proc.getOutput()
    // Extract the URL from the output
    const urlMatch = output.match(/https:\/\/accounts\.shopify\.com\S+/)
    if (!urlMatch) {
      throw new Error(`Could not find login URL in output:\n${output}`)
    }
    // Clean up any trailing ANSI or punctuation
    const loginUrl = urlMatch[0].replace(/[\s\u001b\]]+$/, '')
    console.log(`[e2e] Login URL: ${loginUrl}`)

    // Step 4: Open the URL in Playwright browser
    const browser = await chromium.launch({headless: false})
    const page = await browser.newPage()
    await page.goto(loginUrl)

    // Step 5: Fill in credentials on accounts.shopify.com
    // The login page has email field first, then password after clicking continue
    await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 15_000})
    const emailInput = page.locator('input[name="account[email]"], input[type="email"]').first()
    await emailInput.fill(email)

    // Click continue/next
    const continueButton = page.locator('button[type="submit"]').first()
    await continueButton.click()

    // Wait for password field
    await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 15_000})
    const passwordInput = page.locator('input[name="account[password]"], input[type="password"]').first()
    await passwordInput.fill(password)

    // Click login
    const loginButton = page.locator('button[type="submit"]').first()
    await loginButton.click()

    // Step 6: Handle any confirmation/approval page for the device code
    // Give the page time to transition
    await page.waitForTimeout(3000)

    // Check for a confirm/approve button (device code confirmation)
    try {
      const confirmButton = page.locator('button[type="submit"]').first()
      if (await confirmButton.isVisible({timeout: 5000})) {
        await confirmButton.click()
      }
    } catch {
      // No confirmation page — that's fine
    }

    // Step 7: Wait for the CLI to detect the successful auth
    // The CLI polls and should output the logged-in account
    await proc.waitForOutput('Logged in', 60_000)

    const finalOutput = proc.getOutput()
    console.log(`[e2e] Auth login completed!`)
    console.log(`[e2e] Final output:\n${finalOutput}`)

    await browser.close()
    proc.kill()
  })
})
