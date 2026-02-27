import {envFixture, executables} from './env.js'
import type {E2EEnv} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {execa} from 'execa'
import {chromium, type Browser, type Page} from '@playwright/test'

/**
 * Worker-scoped fixture that performs OAuth login via browser automation.
 * Runs once per worker and stores the session in the shared XDG dirs.
 * Subsequent CLI commands in the same worker will use this session.
 */
export const authFixture = envFixture.extend<{}, {authLogin: void}>({
  authLogin: [
    async ({env}, use) => {
      const email = process.env.E2E_ACCOUNT_EMAIL
      const password = process.env.E2E_ACCOUNT_PASSWORD

      if (!email || !password) {
        // If no browser credentials, skip OAuth login.
        await use()
        return
      }

      // Clear any existing session
      await execa('node', [executables.cli, 'auth', 'logout'], {
        env: env.processEnv,
        reject: false,
      })

      // Spawn auth login via PTY (must not have CI=1, which aborts device auth)
      const nodePty = await import('node-pty')

      const spawnEnv: Record<string, string> = {}
      for (const [key, value] of Object.entries(env.processEnv)) {
        if (value !== undefined) spawnEnv[key] = value
      }
      // Override CI to allow interactive device auth
      spawnEnv.CI = ''
      spawnEnv.BROWSER = 'none'

      const ptyProcess = nodePty.spawn('node', [executables.cli, 'auth', 'login'], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        env: spawnEnv,
      })

      let output = ''
      ptyProcess.onData((data: string) => {
        output += data
        if (process.env.DEBUG === '1') {
          process.stdout.write(data)
        }
      })

      // Wait for the "press any key" prompt
      await waitForText(() => output, 'Press any key to open the login page', 30_000)
      ptyProcess.write(' ')

      // Wait for the verification URL
      await waitForText(() => output, 'start the auth process', 10_000)

      const stripped = stripAnsi(output)
      const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
      if (!urlMatch) {
        throw new Error(`Could not find login URL in output:\n${stripped}`)
      }
      const loginUrl = urlMatch[0]

      // Open the URL in Playwright browser and complete login
      let browser: Browser | undefined
      try {
        browser = await chromium.launch({headless: !process.env.E2E_HEADED})
        const page = await browser.newPage()
        await completeLogin(page, loginUrl, email, password)
      } finally {
        await browser?.close()
      }

      // Wait for the CLI to detect the successful auth
      await waitForText(() => output, 'Logged in', 60_000)

      try {
        ptyProcess.kill()
      } catch {
        // Process may already be dead
      }

      await use()
    },
    {scope: 'worker'},
  ],
})

async function completeLogin(page: Page, loginUrl: string, email: string, password: string): Promise<void> {
  await page.goto(loginUrl)

  // Fill in email
  await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 15_000})
  await page.locator('input[name="account[email]"], input[type="email"]').first().fill(email)
  await page.locator('button[type="submit"]').first().click()

  // Fill in password
  await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 15_000})
  await page.locator('input[name="account[password]"], input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()

  // Handle any confirmation/approval page
  await page.waitForTimeout(3000)
  try {
    const confirmButton = page.locator('button[type="submit"]').first()
    if (await confirmButton.isVisible({timeout: 5000})) {
      await confirmButton.click()
    }
  } catch {
    // No confirmation page
  }
}

function waitForText(getOutput: () => string, text: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (stripAnsi(getOutput()).includes(text)) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve()
      }
    }, 200)

    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for: "${text}"\n\nOutput:\n${stripAnsi(getOutput())}`))
    }, timeoutMs)
  })
}
