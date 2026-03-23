/**
 * Cleans up test apps from the e2e org via browser automation.
 *
 * Requires E2E_ACCOUNT_EMAIL + E2E_ACCOUNT_PASSWORD (+ E2E_ORG_ID, E2E_STORE_FQDN).
 * Logs in once and processes all filters in a single browser session.
 *
 * Run: npx tsx packages/e2e/scripts/cleanup-test-apps.ts
 * Options:
 *   --delete <pat>     uninstall from store + delete from dashboard (apps matching <pat>)
 *   --uninstall <pat>  uninstall from store only (apps matching <pat>)
 *   --dry-run          list matching apps without taking action
 *   --headed           show browser window (default in non-CI)
 *
 * Example (teardown):
 *   npx tsx cleanup-test-apps.ts --delete QA-E2E-1st- --delete QA-E2E-2nd- --uninstall QA-E2E-1st --uninstall QA-E2E-2nd
 */

/* eslint-disable no-restricted-imports */
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {loadEnv} from '../helpers/load-env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const cliPath = path.join(rootDir, 'packages/cli/bin/run.js')

loadEnv(path.join(__dirname, '..'))

// Args
const dryRun = process.argv.includes('--dry-run')
const headed = process.argv.includes('--headed') || !process.env.CI

// Collect --delete and --uninstall patterns
const deletePatterns: string[] = []
const uninstallPatterns: string[] = []
for (let ii = 0; ii < process.argv.length; ii++) {
  if (process.argv[ii] === '--delete' && process.argv[ii + 1]) {
    deletePatterns.push(process.argv[++ii]!)
  } else if (process.argv[ii] === '--uninstall' && process.argv[ii + 1]) {
    uninstallPatterns.push(process.argv[++ii]!)
  }
}

if (deletePatterns.length === 0 && uninstallPatterns.length === 0) {
  console.error('At least one --delete or --uninstall pattern is required')
  process.exit(1)
}

// Browser automation

type Page = import('@playwright/test').Page

async function loginAndGetPage(): Promise<{page: Page}> {
  const {execa} = await import('execa')
  const {chromium} = await import('@playwright/test')
  const {completeLogin} = await import('../helpers/browser-login.js')
  const {stripAnsi} = await import('../helpers/strip-ansi.js')
  const {waitForText} = await import('../helpers/wait-for-text.js')

  const email = process.env.E2E_ACCOUNT_EMAIL!
  const password = process.env.E2E_ACCOUNT_PASSWORD!

  const baseEnv: {[key: string]: string} = {
    ...(process.env as {[key: string]: string}),
    NODE_OPTIONS: '',
    SHOPIFY_RUN_AS_USER: '0',
  }
  delete baseEnv.SHOPIFY_CLI_PARTNERS_TOKEN

  console.log('--- Logging out ---')
  await execa('node', [cliPath, 'auth', 'logout'], {env: baseEnv, reject: false})

  console.log('--- Logging in via OAuth ---')
  const nodePty = await import('node-pty')
  const pty = nodePty.spawn('node', [cliPath, 'auth', 'login'], {
    name: 'xterm-color',
    cols: 120,
    rows: 30,
    env: {...baseEnv, CI: '', BROWSER: 'none', CODESPACES: 'true'},
  })

  let output = ''
  pty.onData((data: string) => {
    output += data
  })

  await waitForText(() => output, 'start the auth process', 30_000)

  const stripped = stripAnsi(output)
  const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
  if (!urlMatch) throw new Error(`No login URL found:\n${stripped}`)

  const browser = await chromium.launch({headless: !headed})
  const context = await browser.newContext({
    extraHTTPHeaders: {'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true'},
  })
  context.setDefaultTimeout(60_000)
  context.setDefaultNavigationTimeout(60_000)
  const page = await context.newPage()

  await completeLogin(page, urlMatch[0], email, password)
  await waitForText(() => output, 'Logged in', 60_000)
  console.log('Logged in successfully!\n')
  try {
    pty.kill()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_err) {
    // already dead
  }

  return {page}
}

/** Collect all apps from the dev dashboard matching any of the given patterns. */
async function collectApps(
  page: Page,
  patterns: string[],
): Promise<{name: string; url: string}[]> {
  const email = process.env.E2E_ACCOUNT_EMAIL!
  const orgId = process.env.E2E_ORG_ID
  const dashboardUrl = orgId
    ? `https://dev.shopify.com/dashboard/${orgId}/apps`
    : 'https://dev.shopify.com/dashboard'

  await page.goto(dashboardUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  // Handle account picker
  const accountButton = page.locator(`text=${email}`).first()
  if (await accountButton.isVisible({timeout: 5000}).catch(() => false)) {
    console.log('Account picker detected, selecting account...')
    await accountButton.click()
    await page.waitForTimeout(3000)
  }

  await page.waitForTimeout(2000)

  const pageText = (await page.textContent('body')) ?? ''
  if (pageText.includes('500') || pageText.includes('Internal Server Error')) {
    console.log('Got 500 error, retrying...')
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)
  }

  const appCards = await page.locator('a[href*="/apps/"]').all()
  const apps: {name: string; url: string}[] = []
  for (const card of appCards) {
    const href = await card.getAttribute('href')
    const text = await card.textContent()
    if (href && text && href.match(/\/apps\/\d+/)) {
      const name = text.split(/\d+ install/)[0]?.trim() || text.split('\n')[0]?.trim() || text.trim()
      if (!name || name.length > 200) continue
      if (!patterns.some((pat) => name.toLowerCase().includes(pat.toLowerCase()))) continue
      const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
      apps.push({name, url})
    }
  }
  return apps
}

/** Uninstall a specific app from the store via the store admin. */
async function uninstallAppFromStore(page: Page, appName: string): Promise<void> {
  const storeFqdn = process.env.E2E_STORE_FQDN
  if (!storeFqdn) return

  await page.goto(`https://${storeFqdn}/admin/settings/apps`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(5000)

  const appRow = page.locator('div[role="listitem"]').filter({hasText: appName}).first()
  if (!(await appRow.isVisible({timeout: 5000}).catch(() => false))) {
    console.log(`  Not found on store, skipping uninstall.`)
    return
  }

  const menuButton = appRow.locator('button').first()
  await menuButton.click({force: true})
  await page.waitForTimeout(1000)

  const uninstallOption = page.getByText('Uninstall', {exact: true}).first()
  if (!(await uninstallOption.isVisible({timeout: 5000}).catch(() => false))) {
    console.log(`  Could not find Uninstall option in menu`)
    return
  }

  console.log(`  Uninstalling from store...`)
  await uninstallOption.click()
  await page.waitForTimeout(2000)
  await page.screenshot({path: path.join(os.tmpdir(), 'e2e-uninstall-confirm.png')})

  // Confirm uninstall dialog
  const confirmBtn = page.getByRole('button', {name: 'Uninstall'}).last()
  if (await confirmBtn.isVisible({timeout: 5000}).catch(() => false)) {
    await confirmBtn.click()
    await page.waitForTimeout(3000)
  }

  // Verify uninstall succeeded
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)
  const stillInstalled = page.locator('div[role="listitem"]').filter({hasText: appName}).first()
  if (await stillInstalled.isVisible({timeout: 3000}).catch(() => false)) {
    await page.screenshot({path: path.join(os.tmpdir(), 'e2e-uninstall-failed.png')})
    console.log(`  WARNING: app still shows as installed after uninstall`)
  } else {
    console.log(`  Uninstalled from store.`)
  }
}

/** Delete an app from the dev dashboard. Retries uninstall if delete button is disabled. */
async function deleteAppFromDashboard(page: Page, appUrl: string, appName: string): Promise<void> {
  const settingsUrl = appUrl.replace(/\/?$/, '/settings')

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(settingsUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)

    const deleteButton = page.locator('button:has-text("Delete app")').first()
    await deleteButton.scrollIntoViewIfNeeded()

    const isDisabled = await deleteButton.evaluate((el) => (el as HTMLButtonElement).disabled)
    if (!isDisabled) {
      await deleteButton.click()
      await page.waitForTimeout(2000)

      const confirmInput = page.locator('input[type="text"]').last()
      if (await confirmInput.isVisible({timeout: 3000}).catch(() => false)) {
        await confirmInput.fill('DELETE')
        await page.waitForTimeout(500)
      }

      const confirmButton = page.locator('button:has-text("Delete app")').last()
      await confirmButton.click()
      await page.waitForTimeout(3000)
      return
    }

    console.log(`  Delete button disabled (attempt ${attempt + 1}/3), trying to uninstall from store...`)
    await uninstallAppFromStore(page, appName)
    await page.waitForTimeout(3000)
  }

  throw new Error('Delete button remained disabled after 3 attempts')
}

// Main
async function main() {
  if (!process.env.E2E_ACCOUNT_EMAIL || !process.env.E2E_ACCOUNT_PASSWORD) {
    console.error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD must be set')
    process.exit(1)
  }

  const allPatterns = [...deletePatterns, ...uninstallPatterns]
  const {page} = await loginAndGetPage()

  try {
    const apps = await collectApps(page, allPatterns)

    if (apps.length === 0) {
      console.log('No matching apps found.')
      return
    }

    console.log(`\nMatching apps (${apps.length}):`)
    for (const app of apps) console.log(`  - ${app.name}`)

    if (dryRun) {
      console.log('\n--dry-run: not taking any action.')
      return
    }

    // Process each app: delete (timestamped) or uninstall-only (pre-existing)
    let processed = 0
    for (const [index, app] of apps.entries()) {
      const shouldDelete = deletePatterns.some((pat) => app.name.toLowerCase().includes(pat.toLowerCase()))
      const action = shouldDelete ? 'delete' : 'uninstall'
      console.log(`\n[${index + 1}/${apps.length}] "${app.name}" (${action})`)

      try {
        await uninstallAppFromStore(page, app.name)
        if (shouldDelete) {
          await deleteAppFromDashboard(page, app.url, app.name)
        }
        processed++
        console.log(shouldDelete ? `  ✓ Deleted` : `  ✓ Uninstalled`)
      } catch (err) {
        console.error(`  ✗ Failed:`, err)
        await page.screenshot({path: path.join(os.tmpdir(), `e2e-cleanup-error-${index}.png`)})
      }
    }

    console.log(`\n--- Done: processed ${processed}/${apps.length} apps ---`)
    if (processed < apps.length) {
      throw new Error(`Failed to process ${apps.length - processed} app(s)`)
    }
  } finally {
    await page.context().browser()?.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
