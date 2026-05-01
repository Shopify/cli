/* eslint-disable no-console, no-restricted-imports, no-await-in-loop */

/**
 * E2E Store Cleanup Utility
 *
 * Finds and deletes leftover E2E dev stores from the Dev Dashboard.
 * Stores are matched by the "e2e-w" prefix in their name (default).
 *
 * Usage:
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts              # Full: uninstall apps + delete stores
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --list        # List stores with app counts
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --delete      # Delete only stores with 0 apps installed
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --headed      # Show browser window
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --pattern X   # Match stores containing "X" (default: "e2e-w")
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
import {deleteStore, dismissDevConsole, isStoreAppsEmpty} from '../setup/store.js'
import {refreshIfPageError, trackMainFrameStatus} from '../setup/browser.js'
import {completeLogin} from '../helpers/browser-login.js'
import type {Page} from '@playwright/test'

// Load .env from packages/e2e/ (not cwd) only if not already configured
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.E2E_ACCOUNT_EMAIL || !process.env.E2E_ACCOUNT_PASSWORD || !process.env.E2E_ORG_ID) {
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
  trackMainFrameStatus(page)

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
    console.log(`[cleanup-stores] Found ${stores.length} store(s) matching pattern "${pattern}"`)
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

        // Wait for page to settle: either the empty state or at least one app menu button
        const emptyState = page.locator('text=Add apps to your store')
        const firstMenuBtn = page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').first()
        await Promise.race([
          emptyState.waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.max}).catch(() => {}),
          firstMenuBtn.waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.max}).catch(() => {}),
        ])

        // Gate: confirm zero apps before attempting delete.
        let safeToDelete = false
        if (await isStoreAppsEmpty(page)) {
          console.log('  No apps installed (empty state confirmed)')
          safeToDelete = true
        } else {
          const appMenuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
          console.log(`  ${appMenuButtons.length || '?'} app(s) installed`)

          if (mode === 'delete') {
            console.log('  Skipped (still has apps)')
            skipped++
          } else {
            // Full mode: uninstall all apps, then re-gate.
            console.log('  Uninstalling apps...')
            await uninstallAllAppsFromStore(page)
            if (await isStoreAppsEmpty(page)) {
              console.log('  Apps uninstalled (empty state confirmed)')
              safeToDelete = true
            } else {
              console.warn('  Apps may still be installed (empty state not confirmed) — skipping delete')
              skipped++
            }
          }
        }

        if (safeToDelete) {
          console.log('  Deleting store...')
          let deleted = false
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              if (await deleteStore(page, storeSlug)) {
                deleted = true
                break
              }
              console.log(`    (${attempt}/3) deletion failed`)
              // eslint-disable-next-line no-catch-all/no-catch-all
            } catch (err) {
              console.log(`    (${attempt}/3) deletion failed: ${err instanceof Error ? err.message : err}`)
            }
          }
          if (deleted) {
            console.log('  Deleted')
            succeeded++
          } else {
            console.warn('  Failed after 3 attempts')
            failed++
          }
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
    if (failed > 0) process.exitCode = 1
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

/**
 * Find stores matching a name pattern on the stores page (dev dashboard).
 *
 * The stores page lazy-loads rows as you scroll — each scroll-to-bottom triggers another batch to render.
 * Keep scrolling until the row count has been stable for several consecutive passes, then scrape all FQDNs from the final HTML.
 */
async function findStoresOnDashboard(page: Page, namePattern: string): Promise<StoreInfo[]> {
  // Recover from transient 500/502 before parsing.
  await refreshIfPageError(page)

  // Wait for initial rows to render — `<tbody id="stores-tbody">` holds every loaded row
  await page.locator('#stores-tbody tr').first().waitFor({state: 'attached', timeout: BROWSER_TIMEOUT.max})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Scroll until row count stops growing.
  // Short wait per scroll while actively loading,
  // longer wait once we hit a plateau (lazy-loader may need a beat to catch up).
  const MAX_IDLE_ROUNDS = 3
  const MAX_SCROLLS = 200
  let lastCount = 0
  let idleRounds = 0
  for (let i = 0; i < MAX_SCROLLS; i++) {
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#stores-tbody tr')
      const last = rows[rows.length - 1]
      if (last) last.scrollIntoView({block: 'end'})
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(idleRounds > 0 ? BROWSER_TIMEOUT.long : BROWSER_TIMEOUT.short)

    const count = await page.locator('#stores-tbody tr').count()
    if (count > lastCount) {
      console.log(`[cleanup-stores]   ...loaded ${count} stores`)
      lastCount = count
      idleRounds = 0
    } else {
      idleRounds++
      if (idleRounds >= MAX_IDLE_ROUNDS) break
    }
  }

  // Parse FQDNs from full HTML (href attrs + visible text), dedupe, filter by pattern
  const bodyHtml = await page.content()
  const seen = new Set<string>()
  const stores: StoreInfo[] = []

  const fqdnRegex = /([\w-]+)\.myshopify\.com/g
  let match = fqdnRegex.exec(bodyHtml)
  while (match) {
    const slug = match[1]!
    const fqdn = `${slug}.myshopify.com`
    if (!seen.has(fqdn) && slug.toLowerCase().includes(namePattern.toLowerCase())) {
      seen.add(fqdn)
      stores.push({name: slug, fqdn, appCount: 0})
    }
    match = fqdnRegex.exec(bodyHtml)
  }

  return stores
}

/** Count installed apps on a store (used by --list mode only). Handles pagination on store admin settings/apps page. */
async function countInstalledApps(page: Page, storeFqdn: string): Promise<number> {
  const storeSlug = storeFqdn.replace('.myshopify.com', '')
  await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(BROWSER_TIMEOUT.long)
  await dismissDevConsole(page)

  // Wait for page to settle: either the empty state or at least one app menu button should appear
  const emptyState = page.locator('text=Add apps to your store')
  const firstMenuBtn = page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').first()
  await Promise.race([
    emptyState.waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.max}).catch(() => {}),
    firstMenuBtn.waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.max}).catch(() => {}),
  ])

  // Check empty state after page has settled
  if (await isStoreAppsEmpty(page)) return 0

  let total = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const appMenuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
    total += appMenuButtons.length

    const nextBtn = page.locator('button#nextURL')
    if (!(await nextBtn.isVisible({timeout: BROWSER_TIMEOUT.short}).catch(() => false))) break
    const isNextDisabled = await nextBtn.evaluate(
      (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    ).catch(() => true)
    if (isNextDisabled) break

    await nextBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.long)
    await dismissDevConsole(page)
  }

  return total
}

/**
 * Uninstall every app from the store's admin settings/apps page.
 * Caller must have already navigated to /settings/apps and dismissed Dev Console.
 */
async function uninstallAllAppsFromStore(page: Page): Promise<void> {
  // Uninstall apps one at a time using the ⋯ "More actions" menu buttons.
  // The admin paginates installed apps, so after clearing the current page
  // we check for a "Next" button and continue on subsequent pages.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Uninstall all apps visible on the current page
    let consecutiveSkips = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Primary termination: store is empty (all apps uninstalled).
      if (await isStoreAppsEmpty(page)) break

      // Backstop: no menu button at current position — remaining apps are all "stuck"
      // (Uninstall option never appeared). Give up; outer caller will log a skip.
      const menuBtn = page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').nth(consecutiveSkips)
      if (!(await menuBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) break

      // Get the app name from the list item container
      const appName = await menuBtn.evaluate((el) => {
        const row = el.closest('div[role="listitem"]')
        if (!row) return 'unknown'
        // The app name is in a <span> inside the clickable <a> link
        const link = row.querySelector('a span')
        return link?.textContent?.trim() || 'unknown'
      }).catch(() => 'unknown')

      await menuBtn.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.short)

      const uninstallOpt = page.locator('text=Uninstall').last()
      if (!(await uninstallOpt.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) {
        // Close the menu and skip this app — try the next one in the list
        await page.keyboard.press('Escape')
        await page.waitForTimeout(BROWSER_TIMEOUT.short)
        consecutiveSkips++
        continue
      }
      await uninstallOpt.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)

      const confirmBtn = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
      if (await confirmBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
        await confirmBtn.click()
        await page.waitForTimeout(BROWSER_TIMEOUT.medium)
        consecutiveSkips = 0
        console.log(`    Uninstalled ${appName}`)
      } else {
        // Confirm never appeared — skip this app to avoid infinite loop
        console.log(`    Uninstall confirm not found for ${appName}, skipping`)
        consecutiveSkips++
      }

      // Reload to refresh the list
      await page.reload({waitUntil: 'domcontentloaded'})
      await page.waitForTimeout(BROWSER_TIMEOUT.long)
      await dismissDevConsole(page)
    }

    // Check for pagination — if there's a next page, navigate to it
    const nextBtn = page.locator('button#nextURL')
    if (!(await nextBtn.isVisible({timeout: BROWSER_TIMEOUT.short}).catch(() => false))) break
    const isNextDisabled = await nextBtn.evaluate(
      (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    ).catch(() => true)
    if (isNextDisabled) break

    await nextBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.long)
    await dismissDevConsole(page)
  }
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
