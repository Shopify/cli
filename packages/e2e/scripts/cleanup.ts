/* eslint-disable no-console, no-restricted-imports, no-await-in-loop */

/**
 * E2E Cleanup Utility
 *
 * Finds and deletes leftover E2E test apps from the Dev Dashboard.
 * Apps are matched by the "E2E-" prefix in their name.
 *
 * Usage:
 *   npx tsx packages/e2e/scripts/cleanup.ts              # Full cleanup: uninstall + delete
 *   npx tsx packages/e2e/scripts/cleanup.ts --list        # List matching apps without action
 *   npx tsx packages/e2e/scripts/cleanup.ts --uninstall   # Uninstall from all stores only (no delete)
 *   npx tsx packages/e2e/scripts/cleanup.ts --delete      # Delete only (skip uninstall — delete only apps with 0 installs)
 *   npx tsx packages/e2e/scripts/cleanup.ts --headed      # Show browser window
 *   npx tsx packages/e2e/scripts/cleanup.ts --pattern X   # Match apps containing "X" (default: "E2E-")
 *
 * Environment variables (loaded from packages/e2e/.env):
 *   E2E_ACCOUNT_EMAIL    — Shopify account email for login
 *   E2E_ACCOUNT_PASSWORD — Shopify account password
 *   E2E_ORG_ID           — Organization ID to scan for apps
 *
 * This module also exports `cleanupAllApps()` for use as a Playwright globalTeardown
 * or from other scripts/tests.
 */

import {config} from 'dotenv'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {navigateToDashboard} from '../setup/browser.js'
import {completeLogin} from '../helpers/browser-login.js'
import type {Page} from '@playwright/test'

// Load .env from packages/e2e/ (not cwd) only if not already configured
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.E2E_ACCOUNT_EMAIL) {
  config({path: path.resolve(__dirname, '../.env')})
}

// ---------------------------------------------------------------------------
// Core cleanup logic — reusable from tests, teardown, or CLI
// ---------------------------------------------------------------------------

export type CleanupMode = 'full' | 'list' | 'uninstall' | 'delete'

const MODE_LABELS: Record<CleanupMode, string> = {
  full: 'Uninstall + Delete',
  list: 'List only',
  uninstall: 'Uninstall only',
  delete: 'Delete only',
}

export interface CleanupOptions {
  /** Cleanup mode (default: "full" — uninstall + delete) */
  mode?: CleanupMode
  /** App name pattern to match (default: "E2E-") */
  pattern?: string
  /** Show browser window */
  headed?: boolean
  /** Organization ID (default: from E2E_ORG_ID env) */
  orgId?: string
  /** Max retries per app on failure (default: 2) */
  retries?: number
}

/**
 * Find and delete all E2E test apps matching a pattern.
 * Handles browser login, dashboard navigation, uninstall, and deletion.
 */
export async function cleanupAllApps(opts: CleanupOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'full'
  const pattern = opts.pattern ?? 'E2E-'
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const maxRetries = opts.retries ?? 2
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD

  // Banner
  console.log('')
  console.log(`[cleanup] Mode:    ${MODE_LABELS[mode]}`)
  console.log(`[cleanup] Org:     ${orgId || '(not set)'}`)
  console.log(`[cleanup] Pattern: "${pattern}"`)
  console.log('')

  if (!email || !password) {
    throw new Error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required')
  }

  if (!orgId) {
    throw new Error('E2E_ORG_ID is required')
  }

  const browser = await chromium.launch({headless: !opts.headed})
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
    },
  })
  context.setDefaultTimeout(30_000)
  context.setDefaultNavigationTimeout(30_000)
  const page = await context.newPage()

  try {
    // Step 1: Log into Shopify directly in the browser
    console.log('[cleanup] Logging in...')
    await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)
    console.log('[cleanup] Logged in successfully.')

    // Step 2: Navigate to dashboard
    console.log('[cleanup] Navigating to dashboard...')
    await navigateToDashboard({browserPage: page, email, orgId})

    // Step 3: Find matching apps
    const apps = await findAppsOnDashboard(page, pattern)
    console.log(`[cleanup] Found ${apps.length} app(s)`)
    console.log('')

    if (apps.length === 0) return

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i]!
      console.log(`  ${i + 1}. ${app.name} (${app.installs} install${app.installs !== 1 ? 's' : ''})`)
    }
    console.log('')

    if (mode === 'list') return

    // Step 4: Process each app with retries
    let succeeded = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i]!
      const tag = `[cleanup] [${i + 1}/${apps.length}]`
      let ok = false
      let wasSkipped = false

      console.log(`${tag} ${app.name}`)

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`  Retry ${attempt - 1}/${maxRetries}...`)
            await navigateToDashboard({browserPage: page, email, orgId})
          }

          if (mode === 'full' || mode === 'uninstall') {
            if (app.installs === 0) {
              if (mode === 'uninstall') {
                console.log('  Not installed (skipped)')
                wasSkipped = true
                skipped++
                break
              }
              console.log('  Not installed')
            } else {
              console.log('  Uninstalling...')
              const allUninstalled = await uninstallApp(page, app.url, app.name, orgId)
              if (!allUninstalled) {
                throw new Error('Uninstall incomplete — some stores may remain')
              }
              console.log('  Uninstalled')
            }
          }

          if (mode === 'full' || mode === 'delete') {
            if (mode === 'delete' && app.installs > 0) {
              console.log('  Delete skipped (still installed)')
              wasSkipped = true
              skipped++
              break
            }
            console.log('  Deleting...')
            await deleteApp(page, app.url)
            console.log('  Deleted')
          }

          ok = true
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (attempt <= maxRetries) {
            console.warn(`  Attempt ${attempt} failed: ${msg}`)
            await page.waitForTimeout(3000)
          } else {
            console.warn(`  Failed: ${msg}`)
          }
        }
      }

      if (ok) succeeded++
      else if (!wasSkipped) failed++
      console.log('')
    }

    // Summary
    const parts = [`${succeeded} succeeded`]
    if (skipped > 0) parts.push(`${skipped} skipped`)
    if (failed > 0) parts.push(`${failed} failed`)
    console.log('')
    console.log(`[cleanup] Complete: ${parts.join(', ')}`)
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Dashboard browser helpers — bulk discovery and cleanup
// ---------------------------------------------------------------------------

/** Find apps matching a name pattern on the dashboard. Handles pagination. */
async function findAppsOnDashboard(
  page: Page,
  namePattern: string,
): Promise<{name: string; url: string; installs: number}[]> {
  const apps: {name: string; url: string; installs: number}[] = []

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const appCards = await page.locator('a[href*="/apps/"]').all()

    for (const card of appCards) {
      const href = await card.getAttribute('href')
      const text = await card.textContent()
      if (!href || !text || !href.match(/\/apps\/\d+/)) continue

      const name = text.split(/\d+\s+install/i)[0]?.trim() ?? text.split('\n')[0]?.trim() ?? text.trim()
      if (!name || name.length > 200) continue
      if (!name.includes(namePattern)) continue

      const installMatch = text.match(/(\d+)\s+install/i)
      const installs = installMatch ? parseInt(installMatch[1]!, 10) : 0

      const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
      apps.push({name, url, installs})
    }

    // Check for next page — navigate via href since the button click may not work
    const nextLink = page.locator('a[href*="next_cursor"]').first()
    if (!(await nextLink.isVisible({timeout: 2000}).catch(() => false))) break
    const nextHref = await nextLink.getAttribute('href')
    if (!nextHref) break
    const nextUrl = nextHref.startsWith('http') ? nextHref : `https://dev.shopify.com${nextHref}`
    await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)
  }

  return apps
}

/** Uninstall an app from all stores via the store switcher dropdown. Returns true if fully uninstalled. */
async function uninstallApp(
  page: Page,
  appUrl: string,
  appName: string,
  orgId: string,
): Promise<boolean> {
  await page.goto(`${appUrl}/installs`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  const rows = await page.locator('table tbody tr').all()
  const storeNames: string[] = []
  for (const row of rows) {
    const firstCell = row.locator('td').first()
    const text = (await firstCell.textContent())?.trim()
    if (text && !text.toLowerCase().includes('no installed')) storeNames.push(text)
  }

  if (storeNames.length === 0) return true

  let allUninstalled = true
  for (const storeName of storeNames) {
    try {
      // Click the store switcher dropdown to navigate to the store admin
      let navigated = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        const orgButton = page.locator('button[popovertarget="store-switcher-popover"]').first()
        if (!(await orgButton.isVisible({timeout: 5000}).catch(() => false))) continue
        await orgButton.click()
        await page.waitForTimeout(1000)

        const storeLink = page.locator('a, button').filter({hasText: storeName}).first()
        if (!(await storeLink.isVisible({timeout: 5000}).catch(() => false))) continue
        await storeLink.click()
        await page.waitForTimeout(3000)
        navigated = true
        break
      }

      if (!navigated) {
        allUninstalled = false
        continue
      }

      // Navigate to store's apps settings page
      const storeAdminUrl = page.url()
      await page.goto(`${storeAdminUrl.replace(/\/$/, '')}/settings/apps`, {waitUntil: 'domcontentloaded'})
      await page.waitForTimeout(5000)

      // Dismiss any Dev Console dialog
      const cancelButton = page.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible({timeout: 2000}).catch(() => false)) {
        await cancelButton.click()
        await page.waitForTimeout(1000)
      }

      // Find the app in the installed list
      const appSpan = page.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first()
      if (!(await appSpan.isVisible({timeout: 5000}).catch(() => false))) {
        allUninstalled = false
        continue
      }

      // Click the ⋯ menu button next to the app name
      const menuButton = appSpan.locator('xpath=./following::button[1]')
      await menuButton.click()
      await page.waitForTimeout(1000)

      // Click "Uninstall" in the dropdown menu
      const uninstallOption = page.locator('text=Uninstall').last()
      if (!(await uninstallOption.isVisible({timeout: 3000}).catch(() => false))) {
        allUninstalled = false
        continue
      }
      await uninstallOption.click()
      await page.waitForTimeout(2000)

      // Handle confirmation dialog
      const confirmButton = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
      if (await confirmButton.isVisible({timeout: 3000}).catch(() => false)) {
        await confirmButton.click()
        await page.waitForTimeout(3000)
      }
    } catch (_err) {
      allUninstalled = false
    }
  }

  return allUninstalled
}

/** Delete an app from the dev dashboard settings page. */
async function deleteApp(page: Page, appUrl: string): Promise<void> {
  await page.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  // Retry if delete button is disabled (uninstall propagation delay)
  const deleteButton = page.locator('button:has-text("Delete app")').first()
  for (let attempt = 1; attempt <= 5; attempt++) {
    await deleteButton.scrollIntoViewIfNeeded()
    const isDisabled = await deleteButton.getAttribute('disabled')
    if (!isDisabled) break
    await page.waitForTimeout(5000)
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(3000)
  }

  await deleteButton.click({timeout: 10_000})
  await page.waitForTimeout(2000)

  // Handle confirmation dialog — may need to type "DELETE"
  const confirmInput = page.locator('input[type="text"]').last()
  if (await confirmInput.isVisible({timeout: 3000}).catch(() => false)) {
    await confirmInput.fill('DELETE')
    await page.waitForTimeout(500)
  }

  const confirmButton = page.locator('button:has-text("Delete app")').last()
  await confirmButton.click()
  await page.waitForTimeout(3000)
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const headed = args.includes('--headed')
  const patternIdx = args.indexOf('--pattern')
  let pattern: string | undefined
  if (patternIdx !== -1) {
    const nextArg = args[patternIdx + 1]
    if (!nextArg || nextArg.startsWith('--')) {
      console.error('[cleanup] --pattern requires a value')
      process.exitCode = 1
      return
    }
    pattern = nextArg
  }

  let mode: CleanupMode = 'full'
  if (args.includes('--list')) mode = 'list'
  else if (args.includes('--uninstall')) mode = 'uninstall'
  else if (args.includes('--delete')) mode = 'delete'

  await cleanupAllApps({mode, pattern, headed})
}

// Run if executed directly (not imported)
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((err) => {
    console.error('[cleanup] Fatal error:', err)
    process.exitCode = 1
  })
}
