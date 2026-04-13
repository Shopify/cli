/**
 * Deletes all test apps from the dev dashboard via browser automation.
 * Run: pnpx tsx packages/e2e/scripts/cleanup-test-apps.ts
 *
 * Pass --dry-run to list apps without deleting.
 * Pass --filter <pattern> to only delete apps matching the pattern.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {execa} from 'execa'
import {chromium, type Page} from '@playwright/test'
import {completeLogin} from '../helpers/browser-login.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const cliPath = path.join(rootDir, 'packages/cli/bin/run.js')

const dryRun = process.argv.includes('--dry-run')
const filterIdx = process.argv.indexOf('--filter')
if (filterIdx >= 0 && !process.argv[filterIdx + 1]) {
  console.error('--filter requires a value')
  process.exit(1)
}
const filterPattern = filterIdx >= 0 ? process.argv[filterIdx + 1] : undefined
const headed = process.argv.includes('--headed') || !process.env.CI

// Load .env
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

const email = process.env.E2E_ACCOUNT_EMAIL
const password = process.env.E2E_ACCOUNT_PASSWORD
if (!email || !password) {
  console.error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD must be set')
  process.exit(1)
}

const baseEnv: {[key: string]: string} = {
  ...(process.env as {[key: string]: string}),
  NODE_OPTIONS: '',
  SHOPIFY_RUN_AS_USER: '0',
}
delete baseEnv.SHOPIFY_CLI_PARTNERS_TOKEN

async function main() {
  // Step 1: OAuth login to get a browser session
  console.log('--- Logging out ---')
  await execa('node', [cliPath, 'auth', 'logout'], {env: baseEnv, reject: false})

  console.log('--- Logging in via OAuth ---')
  const nodePty = await import('node-pty')
  const spawnEnv = {...baseEnv, CI: '', BROWSER: 'none'}
  const pty = nodePty.spawn('node', [cliPath, 'auth', 'login'], {
    name: 'xterm-color',
    cols: 120,
    rows: 30,
    env: spawnEnv,
  })

  let output = ''
  pty.onData((data: string) => {
    output += data
  })

  await waitForText(() => output, 'Press any key to open the login page', 30_000)
  pty.write(' ')
  await waitForText(() => output, 'start the auth process', 10_000)

  const stripped = stripAnsi(output)
  const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
  if (!urlMatch) throw new Error(`No login URL found:\n${stripped}`)

  // Launch browser - we'll reuse this session for dashboard navigation
  const browser = await chromium.launch({headless: !headed})
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
    },
  })
  const page = await context.newPage()

  // Complete OAuth login using shared helper
  await completeLogin(page, urlMatch[0], email!, password!)

  await waitForText(() => output, 'Logged in', 60_000)
  console.log('Logged in successfully!')
  try {
    pty.kill()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_err) {
    // already dead
  }

  try {
    // Step 2: Navigate to dev dashboard
    console.log('\n--- Navigating to dev dashboard ---')
    await page.goto('https://dev.shopify.com/dashboard', {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)

    // Handle account picker if shown
    const accountButton = page.locator(`text=${email}`).first()
    if (await accountButton.isVisible({timeout: 5000}).catch(() => false)) {
      console.log('Account picker detected, selecting account...')
      await accountButton.click()
      await page.waitForTimeout(3000)
    }

    // May need to handle org selection or retry on error
    await page.waitForTimeout(2000)

    // Check for 500 error and retry
    const pageText = (await page.textContent('body')) ?? ''
    if (pageText.includes('500') || pageText.includes('Internal Server Error')) {
      console.log('Got 500 error, retrying...')
      await page.reload({waitUntil: 'domcontentloaded'})
      await page.waitForTimeout(3000)
    }

    // Check for org selection page
    const orgLink = page
      .locator('a, button')
      .filter({hasText: /core-build|cli-e2e/i})
      .first()
    if (await orgLink.isVisible({timeout: 3000}).catch(() => false)) {
      console.log('Org selection detected, clicking...')
      await orgLink.click()
      await page.waitForTimeout(3000)
    }

    const dashboardScreenshot = path.join(os.tmpdir(), 'e2e-dashboard.png')
    await page.screenshot({path: dashboardScreenshot})
    console.log(`Dashboard URL: ${page.url()}`)
    console.log(`Dashboard screenshot saved to ${dashboardScreenshot}`)

    // Step 3: Find all app cards on the dashboard
    // Each app is a clickable card/row with the app name visible
    const appCards = await page.locator('a[href*="/apps/"]').all()
    console.log(`Found ${appCards.length} app links on dashboard`)

    // Collect app names and URLs
    const apps: {name: string; url: string}[] = []
    for (const card of appCards) {
      const href = await card.getAttribute('href')
      const text = await card.textContent()
      if (href && text && href.match(/\/apps\/\d+/)) {
        // Extract just the app name (first line of text, before "installs")
        const name = text.split(/\d+ install/)[0]?.trim() || text.split('\n')[0]?.trim() || text.trim()
        if (!name || name.length > 200) continue
        if (filterPattern && !name.toLowerCase().includes(filterPattern.toLowerCase())) continue
        const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
        apps.push({name, url})
      }
    }

    if (apps.length === 0) {
      console.log('No apps found to delete.')
      return
    }

    console.log(`\nApps to delete (${apps.length}):`)
    for (const app of apps) {
      console.log(`  - ${app.name}`)
    }

    if (dryRun) {
      console.log('\n--dry-run: not deleting anything.')
      return
    }

    // Step 4: Delete each app
    let deleted = 0
    for (const [index, app] of apps.entries()) {
      console.log(`\nDeleting "${app.name}"...`)
      try {
        await deleteApp(page, app.url)
        deleted++
        console.log(`  Deleted "${app.name}"`)
      } catch (err) {
        console.error(`  Failed to delete "${app.name}":`, err)
        await page.screenshot({path: path.join(os.tmpdir(), `e2e-delete-error-${index}.png`)})
      }
    }

    console.log(`\n--- Done: deleted ${deleted}/${apps.length} apps ---`)
  } finally {
    await browser.close()
  }
}

async function deleteApp(page: Page, appUrl: string): Promise<void> {
  // Navigate to the app page
  await page.goto(appUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  // Click "Settings" in the sidebar nav (last matches the desktop nav, first is mobile)
  await page.locator('a[aria-label="Settings"]').last().click({force: true})
  await page.waitForTimeout(3000)

  // Take screenshot for debugging
  await page.screenshot({path: path.join(os.tmpdir(), 'e2e-settings-page.png')})

  // Look for delete button
  const deleteButton = page.locator('button:has-text("Delete app")').first()
  await deleteButton.scrollIntoViewIfNeeded()
  await deleteButton.click()
  await page.waitForTimeout(2000)

  // Take screenshot of confirmation dialog
  await page.screenshot({path: path.join(os.tmpdir(), 'e2e-delete-confirm.png')})

  // Handle confirmation dialog - may need to type app name or click confirm
  const confirmInput = page.locator('input[type="text"]').last()
  if (await confirmInput.isVisible({timeout: 3000}).catch(() => false)) {
    await confirmInput.fill('DELETE')
    await page.waitForTimeout(500)
  }

  // Click the final delete/confirm button in the dialog
  const confirmButton = page.locator('button:has-text("Delete app")').last()
  await confirmButton.click()
  await page.waitForTimeout(3000)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
