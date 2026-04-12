/* eslint-disable no-console, no-restricted-imports, no-await-in-loop */

/**
 * E2E Store Cleanup Utility
 *
 * Finds and deletes leftover E2E dev stores from the Dev Dashboard.
 * Stores are matched by the "e2e-w" prefix in their name (default).
 *
 * Usage:
 *   npx tsx packages/e2e/scripts/cleanup-stores.ts              # Full: uninstall apps + delete stores
 *   npx tsx packages/e2e/scripts/cleanup-stores.ts --list        # List stores with app counts
 *   npx tsx packages/e2e/scripts/cleanup-stores.ts --delete      # Delete only stores with 0 apps installed
 *   npx tsx packages/e2e/scripts/cleanup-stores.ts --headed      # Show browser window
 *   npx tsx packages/e2e/scripts/cleanup-stores.ts --pattern X   # Match stores containing "X" (default: "e2e-w")
 *
 * Environment variables (loaded from packages/e2e/.env):
 *   E2E_ACCOUNT_EMAIL    — Shopify account email for login
 *   E2E_ACCOUNT_PASSWORD — Shopify account password
 *   E2E_ORG_ID           — Organization ID to scan for stores
 */

import {config} from 'dotenv'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT} from '../setup/constants.js'
import {completeLogin} from '../helpers/browser-login.js'
import type {Page} from '@playwright/test'

// Load .env from packages/e2e/ (not cwd) only if not already configured
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.E2E_ACCOUNT_EMAIL) {
  config({path: path.resolve(__dirname, '../.env')})
}

// ---------------------------------------------------------------------------
// Core cleanup logic
// ---------------------------------------------------------------------------

export type CleanupStoresMode = 'full' | 'list' | 'delete'

const MODE_LABELS: Record<CleanupStoresMode, string> = {
  full: 'Uninstall apps + Delete stores',
  list: 'List only',
  delete: 'Delete empty stores only',
}

export interface CleanupStoresOptions {
  /** Cleanup mode (default: "full") */
  mode?: CleanupStoresMode
  /** Store name pattern to match (default: "e2e-w") */
  pattern?: string
  /** Show browser window */
  headed?: boolean
  /** Organization ID (default: from E2E_ORG_ID env) */
  orgId?: string
}

export async function cleanupStores(opts: CleanupStoresOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'full'
  const pattern = opts.pattern ?? 'e2e-w'
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD

  console.log('')
  console.log(`[cleanup-stores] Mode:    ${MODE_LABELS[mode]}`)
  console.log(`[cleanup-stores] Org:     ${orgId || '(not set)'}`)
  console.log(`[cleanup-stores] Pattern: "${pattern}"`)
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
  context.setDefaultTimeout(BROWSER_TIMEOUT.max)
  context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
  const page = await context.newPage()

  const totalStart = Date.now()

  try {
    // Step 1: Log in
    console.log('[cleanup-stores] Logging in...')
    await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)
    console.log('[cleanup-stores] Logged in successfully.')

    // Step 2: Navigate to stores page and find matching stores
    console.log('[cleanup-stores] Navigating to stores page...')
    await page.goto(`https://dev.shopify.com/dashboard/${orgId}/stores`, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)

    // Handle account picker
    const accountButton = page.locator(`text=${email}`).first()
    if (await accountButton.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false)) {
      await accountButton.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }

    const stores = await findStoresOnDashboard(page, pattern)
    console.log(`[cleanup-stores] Found ${stores.length} store(s)`)
    console.log('')

    if (stores.length === 0) return

    if (mode === 'list') {
      // List mode: count apps for each store, then print summary
      for (const store of stores) {
        store.appCount = await countInstalledApps(page, store.fqdn)
      }
      for (let i = 0; i < stores.length; i++) {
        const store = stores[i]!
        console.log(`  ${i + 1}. ${store.name} (${store.appCount} app${store.appCount !== 1 ? 's' : ''} installed)`)
      }
      console.log('')
      return
    }

    // Step 3: Process each store in a single visit (count + uninstall + delete)
    let succeeded = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i]!
      const tag = `[cleanup-stores] [${i + 1}/${stores.length}]`
      const storeStart = Date.now()

      console.log(`${tag} ${store.name}`)

      try {
        const storeSlug = store.fqdn.replace('.myshopify.com', '')

        // Navigate to apps settings page once
        await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
          waitUntil: 'domcontentloaded',
        })
        await page.waitForTimeout(BROWSER_TIMEOUT.long)
        await dismissDevConsole(page)

        // Count installed apps
        const appMenuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
        const appCount = appMenuButtons.length
        console.log(`  ${appCount} app${appCount !== 1 ? 's' : ''} installed`)

        // In delete mode, skip stores that have apps installed
        if (mode === 'delete' && appCount > 0) {
          console.log(`  Skipped (still has apps)`)
          skipped++
        } else {
          // In full mode, uninstall apps on the current page (already navigated)
          if (appCount > 0) {
            console.log(`  Uninstalling ${appCount} app(s)...`)
            await uninstallAllAppsOnPage(page)

            // Verify all apps were uninstalled before deleting
            await page.reload({waitUntil: 'domcontentloaded'})
            await page.waitForTimeout(BROWSER_TIMEOUT.long)
            await dismissDevConsole(page)
            const remaining = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
            if (remaining.length > 0) {
              console.warn(`  ${remaining.length} app(s) still installed — skipping delete`)
              skipped++
              continue
            }
            console.log('  Apps uninstalled')
          }

          console.log('  Deleting store...')
          await deleteStore(page, storeSlug)
          console.log('  Deleted')
          succeeded++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Failed: ${msg}`)
        failed++
      }

      const storeElapsed = ((Date.now() - storeStart) / 1000).toFixed(1)
      console.log(`  (${storeElapsed}s)`)
      console.log('')
    }

    // Summary
    const parts = [`${succeeded} succeeded`]
    if (skipped > 0) parts.push(`${skipped} skipped`)
    if (failed > 0) parts.push(`${failed} failed`)
    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
    console.log('')
    console.log(`[cleanup-stores] Complete: ${parts.join(', ')} (${totalElapsed}s total)`)
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

interface StoreInfo {
  name: string
  fqdn: string
  appCount: number
}

/** Dismiss the Dev Console panel if visible, so it doesn't interfere with table queries. */
async function dismissDevConsole(page: Page): Promise<void> {
  // Try clicking the Cancel button (shown when Dev Console first appears as a dialog)
  const cancelBtn = page.locator('button:has-text("Cancel")')
  if (await cancelBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
    await cancelBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  // Minimize the Dev Console bottom panel if it's expanded
  const minimizeBtn = page.locator('button._MinimizeButton_1pqn9_122, button[aria-label="hide"]')
  if (await minimizeBtn.isVisible({timeout: BROWSER_TIMEOUT.short}).catch(() => false)) {
    await minimizeBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }
}

/** Find stores matching a name pattern on the stores page. */
async function findStoresOnDashboard(page: Page, namePattern: string): Promise<StoreInfo[]> {
  const stores: StoreInfo[] = []

  const bodyText = (await page.textContent('body')) ?? ''
  const fqdnRegex = /([\w-]+)\.myshopify\.com/g
  const seen = new Set<string>()
  let match = fqdnRegex.exec(bodyText)

  while (match) {
    const slug = match[1]!
    const fqdn = `${slug}.myshopify.com`

    if (!seen.has(fqdn) && slug.toLowerCase().includes(namePattern.toLowerCase())) {
      seen.add(fqdn)
      stores.push({name: slug, fqdn, appCount: 0})
    }

    match = fqdnRegex.exec(bodyText)
  }

  return stores
}

/** Count installed apps on a store (used by --list mode only). */
async function countInstalledApps(page: Page, storeFqdn: string): Promise<number> {
  const storeSlug = storeFqdn.replace('.myshopify.com', '')
  await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(BROWSER_TIMEOUT.long)
  await dismissDevConsole(page)
  const appMenuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
  return appMenuButtons.length
}

/**
 * Uninstall all apps on the currently loaded apps settings page.
 * Caller must have already navigated to /settings/apps and dismissed Dev Console.
 */
async function uninstallAllAppsOnPage(page: Page): Promise<void> {
  // Uninstall apps one at a time using the ⋯ "More actions" menu buttons.
  // After each uninstall the page reloads, so we always target the first button.
  let round = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const menuBtn = page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').first()
    if (!(await menuBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) break

    round++

    // Get the app name from the nearest parent list item / section
    const parent = menuBtn.locator('xpath=ancestor::*[contains(@class,"Polaris-ResourceItem") or contains(@class,"Polaris-IndexTable-Row") or self::tr or self::li]')
    const appName = ((await parent.first().textContent({timeout: BROWSER_TIMEOUT.short}).catch(() => null)) ?? '').split('\n')[0]?.trim() || 'unknown'

    await menuBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)

    const uninstallOpt = page.locator('text=Uninstall').last()
    if (!(await uninstallOpt.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) break
    await uninstallOpt.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)

    const confirmBtn = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
    if (await confirmBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }

    console.log(`    Uninstalled ${appName}`)

    // Reload to refresh the list
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.long)
    await dismissDevConsole(page)
  }
}

/**
 * Delete a store via the admin settings plan page.
 * Caller must ensure all apps are already uninstalled.
 */
async function deleteStore(page: Page, storeSlug: string): Promise<void> {
  const planUrl = `https://admin.shopify.com/store/${storeSlug}/settings/plan`
  await page.goto(planUrl, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.long)

  const deleteButton = page.locator('s-internal-button[tone="critical"]').locator('button')
  await deleteButton.click({timeout: BROWSER_TIMEOUT.max})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  const modal = page.locator('.Polaris-Modal-Dialog__Modal')

  // Step 2: Check checkbox (retry step 1+2 if fails)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const checkbox = modal.locator('input[type="checkbox"]')
    if (await checkbox.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
      await checkbox.check({force: true})
      await page.waitForTimeout(BROWSER_TIMEOUT.short)
      break
    }
    if (attempt === 3) throw new Error('Checkbox not visible after 3 attempts')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
    await deleteButton.click({timeout: BROWSER_TIMEOUT.max})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Step 3: Click confirm (retry step 2+3 if button is disabled)
  const confirmButton = modal.locator('button:has-text("Delete store")')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const isDisabled = await confirmButton.evaluate(
      (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    ).catch(() => true)
    if (!isDisabled) break
    if (attempt === 3) throw new Error('Confirm button still disabled after 3 attempts')
    const checkbox = modal.locator('input[type="checkbox"]')
    await checkbox.check({force: true})
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  await confirmButton.click({force: true})
  await page.waitForURL(/access_account/, {timeout: BROWSER_TIMEOUT.max})
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
      console.error('[cleanup-stores] --pattern requires a value')
      process.exitCode = 1
      return
    }
    pattern = nextArg
  }

  let mode: CleanupStoresMode = 'full'
  if (args.includes('--list')) mode = 'list'
  else if (args.includes('--delete')) mode = 'delete'

  await cleanupStores({mode, pattern, headed})
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((err) => {
    console.error('[cleanup-stores] Fatal error:', err)
    process.exitCode = 1
  })
}
