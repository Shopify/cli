/* eslint-disable no-console, no-await-in-loop, no-restricted-imports */
/**
 * Deep-clean leftover E2E test apps.
 *
 *   npx tsx packages/e2e/scripts/cleanup.ts              # full cleanup: uninstall + delete
 *   npx tsx packages/e2e/scripts/cleanup.ts --list       # list matching apps without action
 *   npx tsx packages/e2e/scripts/cleanup.ts --uninstall  # uninstall from all stores only (no delete)
 *   npx tsx packages/e2e/scripts/cleanup.ts --delete     # delete only apps with 0 installs (skip installed)
 *   npx tsx packages/e2e/scripts/cleanup.ts --headed     # show browser window
 *
 * Discovers every store an app is installed on (via the /installs page),
 * uninstalls from each, then deletes the app. Also removes leftover .e2e-tmp.
 */

import {loadEnv} from '../helpers/load-env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {chromium, type Page} from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const cliPath = path.join(rootDir, 'packages/cli/bin/run.js')

loadEnv(path.join(__dirname, '..'))

const APP_MATCH = 'QA-E2E'
// Permanent test apps — never delete these
const EXCLUDE_EXACT = ['QA-E2E-1st', 'QA-E2E-2nd']

const dryRun = process.argv.includes('--list')
const uninstallOnly = process.argv.includes('--uninstall')
const deleteOnly = process.argv.includes('--delete')
const headed = process.argv.includes('--headed')

async function main() {
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD
  if (!email || !password) {
    console.error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD must be set')
    process.exit(1)
  }

  // Step 0: OAuth login
  const {execa} = await import('execa')
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
    extraHTTPHeaders: {
      'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
    },
  })
  context.setDefaultTimeout(60_000)
  context.setDefaultNavigationTimeout(60_000)
  const page = await context.newPage()
  await completeLogin(page, urlMatch[0], email, password)

  await waitForText(() => output, 'Logged in', 60_000)
  console.log('Logged in successfully!')
  try {
    pty.kill()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_err) {
    /* already dead */
  }

  try {
    // Step 1: Navigate to dev dashboard
    await navigateToDashboard(page, email)

    const dashboardUrl = page.url()
    console.log(`Dashboard URL: ${dashboardUrl}`)

    if (!dashboardUrl.includes('dev.shopify.com/dashboard')) {
      throw new Error(
        `Login session expired — landed on ${dashboardUrl} instead of the dashboard.\n` +
          `This is usually transient. Please retry the command.`,
      )
    }

    // Step 2: Find all apps matching QA-E2E- prefix
    const apps = await findMatchingApps(page)
    if (apps.length === 0) {
      console.log('No matching apps found on dashboard.')
    } else {
      // eslint-disable-next-line no-nested-ternary
      const mode = dryRun ? 'list' : deleteOnly ? 'delete only' : uninstallOnly ? 'uninstall only' : 'uninstall + delete'
      console.log(`\nFound ${apps.length} app(s) to clean up (${mode}):`)
      for (const app of apps) {
        console.log(`  - ${app.name} (${app.url})`)
      }

      if (dryRun) {
        console.log('\n--list: not taking any action.')
      } else {
        let cleaned = 0
        let failed = 0
        for (const app of apps) {
          try {
            console.log(`\n[${cleaned + failed + 1}/${apps.length}] "${app.name}"`)

            if (deleteOnly) {
              // --delete: only delete apps that have 0 installs
              const hasInstalls = await checkHasInstalls(page, app.url)
              if (hasInstalls) {
                console.log(`  Skipping — still installed on stores`)
                continue
              }
              await deleteApp(page, app.url)
              cleaned++
              console.log(`  ✓ Deleted`)
              continue
            }

            const uninstalled = await uninstallFromAllStores(page, app.url, app.name)
            if (uninstallOnly) {
              if (uninstalled) {
                cleaned++
                console.log(`  ✓ Uninstalled`)
              } else {
                failed++
                console.log(`  ✗ Failed to uninstall from all stores`)
              }
              continue
            }
            if (!uninstalled) {
              failed++
              console.log(`  Skipping delete — still installed somewhere`)
              continue
            }
            await deleteApp(page, app.url)
            cleaned++
            console.log(`  ✓ Deleted`)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (err) {
            failed++
            console.log(`  ✗ Failed: ${err}`)
            await page.screenshot({path: path.join(os.tmpdir(), `e2e-cleanup-error-${cleaned + failed}.png`)})
          }
        }
        const verb = deleteOnly ? 'deleted' : uninstallOnly ? 'uninstalled' : 'cleaned'
        console.log(`\n--- Done: ${verb} ${cleaned}/${apps.length} apps ---`)
        if (failed > 0) {
          process.exitCode = 1
        }
      }
    }
  } finally {
    await browser.close()
  }

  // Step 4: Remove leftover .e2e-tmp directories
  const e2eTmpDir = path.join(rootDir, '.e2e-tmp')
  if (fs.existsSync(e2eTmpDir)) {
    const entries = fs.readdirSync(e2eTmpDir)
    if (entries.length > 0) {
      console.log(`\nCleaning up ${entries.length} leftover .e2e-tmp entries...`)
      fs.rmSync(e2eTmpDir, {recursive: true, force: true})
      console.log('  ✓ Removed .e2e-tmp')
    }
  }
}

// --- Helpers ---

async function navigateToDashboard(page: Page, email: string) {
  const orgId = (process.env.E2E_ORG_ID ?? '').split('#')[0]!.trim()
  const dashboardUrl = orgId ? `https://dev.shopify.com/dashboard/${orgId}/apps` : 'https://dev.shopify.com/dashboard'
  console.log(`\nNavigating to dev dashboard: ${dashboardUrl}`)
  await page.goto(dashboardUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

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
}

async function findMatchingApps(page: Page): Promise<{name: string; url: string}[]> {
  const appCards = await page.locator('a[href*="/apps/"]').all()
  const apps: {name: string; url: string}[] = []

  for (const card of appCards) {
    const href = await card.getAttribute('href')
    const text = await card.textContent()
    if (!href || !text || !href.match(/\/apps\/\d+/)) continue

    const name = text.split(/\d+ install/)[0]?.trim() ?? text.split('\n')[0]?.trim() ?? text.trim()
    if (!name || name.length > 200) continue
    if (!name.includes(APP_MATCH)) continue
    if (EXCLUDE_EXACT.includes(name)) continue

    const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
    apps.push({name, url})
  }

  return apps
}

async function checkHasInstalls(page: Page, appUrl: string): Promise<boolean> {
  const installsUrl = `${appUrl}/installs`
  await page.goto(installsUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  const rows = await page.locator('table tbody tr').all()
  for (const row of rows) {
    const firstCell = row.locator('td').first()
    const text = (await firstCell.textContent())?.trim()
    if (text && !text.toLowerCase().includes('no installed')) return true
  }
  return false
}

async function uninstallFromAllStores(page: Page, appUrl: string, appName: string): Promise<boolean> {
  const installsUrl = `${appUrl}/installs`
  await page.goto(installsUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  const rows = await page.locator('table tbody tr').all()
  const storeNames: string[] = []
  for (const row of rows) {
    const firstCell = row.locator('td').first()
    const text = (await firstCell.textContent())?.trim()
    if (text && !text.toLowerCase().includes('no installed')) storeNames.push(text)
  }

  if (storeNames.length === 0) {
    console.log('  Not installed on any store.')
    return true
  }

  console.log(`  Installed on ${storeNames.length} store(s): ${storeNames.join(', ')}`)
  let allUninstalled = true
  for (const storeName of storeNames) {
    try {
      await uninstallAppFromStore(page, storeName, appName)
      console.log(`  Uninstalled from ${storeName}`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      console.log(`  Warning: failed to uninstall from ${storeName}: ${err}`)
      allUninstalled = false
    }
  }
  return allUninstalled
}

async function uninstallAppFromStore(page: Page, storeName: string, appName: string) {
  // Navigate to the store admin via the dev dashboard's top-right dropdown.
  // The store display name (e.g. "qa-e2e") doesn't match the URL slug (e.g. "qa-e2e-2"),
  // so we can't construct the URL directly — we click through the dropdown instead.
  // Retry on 500 errors or dropdown failures.
  const orgId = (process.env.E2E_ORG_ID ?? '').split('#')[0]!.trim()
  const dashboardUrl = `https://dev.shopify.com/dashboard/${orgId}/apps`

  let navigated = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(dashboardUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)

    // Check for 500 error
    const pageText = (await page.textContent('body')) ?? ''
    if (pageText.includes('500') || pageText.includes('Internal Server Error')) {
      console.log(`  Got 500 error (attempt ${attempt}/3), retrying...`)
      continue
    }

    const orgButton = page.locator('header button').last()
    if (!(await orgButton.isVisible({timeout: 5000}).catch(() => false))) {
      console.log(`  Dropdown button not found (attempt ${attempt}/3), retrying...`)
      continue
    }
    await orgButton.click()
    await page.waitForTimeout(1000)

    const storeLink = page.locator(`a, button`).filter({hasText: storeName}).first()
    if (!(await storeLink.isVisible({timeout: 5000}).catch(() => false))) {
      console.log(`  Store "${storeName}" not in dropdown (attempt ${attempt}/3), retrying...`)
      continue
    }
    await storeLink.click()
    await page.waitForTimeout(3000)
    navigated = true
    break
  }

  if (!navigated) {
    await page.screenshot({path: path.join(os.tmpdir(), 'e2e-cleanup-dropdown.png')})
    throw new Error(`Could not navigate to store "${storeName}" after 3 attempts`)
  }

  // Now we're on the store admin — navigate to apps settings
  const storeAdminUrl = page.url()
  console.log(`  Store admin URL: ${storeAdminUrl}`)
  const appsSettingsUrl = `${storeAdminUrl.replace(/\/$/, '')}/settings/apps`
  await page.goto(appsSettingsUrl, {waitUntil: 'networkidle'})
  await page.waitForTimeout(5000)

  // Dismiss any Dev Console dialog that might be blocking
  const cancelButton = page.locator('button:has-text("Cancel")')
  if (await cancelButton.isVisible({timeout: 2000}).catch(() => false)) {
    await cancelButton.click()
    await page.waitForTimeout(1000)
  }

  // Find the app name in the installed apps list.
  // Main content uses plain <span>, Dev Console uses <span class="Polaris-Text--...">
  const appSpan = page.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first()
  if (!(await appSpan.isVisible({timeout: 5000}).catch(() => false))) {
    throw new Error(`App "${appName}" not found on ${storeName} apps page`)
  }

  // The ⋯ button is the next button after this span in DOM order
  const menuButton = appSpan.locator('xpath=./following::button[1]')
  await menuButton.click()
  await page.waitForTimeout(1000)

  // Click "Uninstall" in the dropdown menu
  const uninstallOption = page.locator('text=Uninstall').last()
  if (!(await uninstallOption.isVisible({timeout: 3000}).catch(() => false))) {
    throw new Error(`Uninstall option not found in menu for "${appName}"`)
  }
  await uninstallOption.click()
  await page.waitForTimeout(2000)

  // Handle confirmation dialog if present
  const confirmButton = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
  if (await confirmButton.isVisible({timeout: 3000}).catch(() => false)) {
    await confirmButton.click()
    await page.waitForTimeout(3000)
  }
}

async function deleteApp(page: Page, appUrl: string) {
  await page.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  const deleteButton = page.locator('button:has-text("Delete app")').first()
  for (let attempt = 1; attempt <= 5; attempt++) {
    await deleteButton.scrollIntoViewIfNeeded()
    const isDisabled = await deleteButton.getAttribute('disabled')
    if (!isDisabled) break
    console.log(`  Delete button disabled (attempt ${attempt}/5), waiting for uninstall to propagate...`)
    await page.waitForTimeout(5000)
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)
  }

  await deleteButton.click({timeout: 10_000})
  await page.waitForTimeout(2000)

  const confirmInput = page.locator('input[type="text"]').last()
  if (await confirmInput.isVisible({timeout: 3000}).catch(() => false)) {
    await confirmInput.fill('DELETE')
    await page.waitForTimeout(500)
  }

  const confirmButton = page.locator('button:has-text("Delete app")').last()
  await confirmButton.click()
  await page.waitForTimeout(3000)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
