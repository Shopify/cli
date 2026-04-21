/* eslint-disable no-console, no-restricted-imports, no-await-in-loop */

/**
 * E2E Cleanup Utility
 *
 * Finds and deletes leftover E2E test apps from the Dev Dashboard.
 * Apps are matched by the "E2E-" prefix in their name.
 *
 * Usage:
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts              # Full cleanup: uninstall + delete
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts --list        # List matching apps without action
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts --uninstall   # Uninstall from all stores only (no delete)
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts --delete      # Delete only (skip uninstall — delete only apps with 0 installs)
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts --headed      # Show browser window
 *   pnpm --filter e2e exec tsx scripts/cleanup-apps.ts --pattern X   # Match apps containing "X" (default: "E2E-")
 *
 * Environment variables (loaded from packages/e2e/.env):
 *   E2E_ACCOUNT_EMAIL    — Shopify account email for login
 *   E2E_ACCOUNT_PASSWORD — Shopify account password
 *   E2E_ORG_ID           — Organization ID to scan for apps
 */

import {config} from 'dotenv'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT} from '../setup/constants.js'
import {navigateToDashboard, refreshIfPageError, trackMainFrameStatus} from '../setup/browser.js'
import {deleteAppFromDevDashboard} from '../setup/app.js'
import {uninstallAppFromStore} from '../setup/store.js'
import {completeLogin} from '../helpers/browser-login.js'
import type {Page} from '@playwright/test'

// Load .env from packages/e2e/ (not cwd) only if not already configured
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.E2E_ACCOUNT_EMAIL || !process.env.E2E_ACCOUNT_PASSWORD || !process.env.E2E_ORG_ID) {
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
}

/**
 * Find and delete all E2E test apps matching a pattern.
 * Handles browser login, dashboard navigation, uninstall, and deletion.
 */
export async function cleanupAllApps(opts: CleanupOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'full'
  const pattern = opts.pattern ?? 'E2E-'
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD

  // Banner
  console.log('')
  console.log(`[cleanup-apps] Mode:    ${MODE_LABELS[mode]}`)
  console.log(`[cleanup-apps] Org:     ${orgId || '(not set)'}`)
  console.log(`[cleanup-apps] Pattern: "${pattern}"`)
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
    // Step 1: Log into Shopify directly in the browser
    console.log('[cleanup-apps] Logging in...')
    await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)
    console.log('[cleanup-apps] Logged in successfully.')

    // Step 2: Navigate to dashboard (retry on 500/502).
    // navigateToDashboard already refreshes once on error; this loop is extra resilience.
    console.log('[cleanup-apps] Navigating to dashboard...')
    await navigateToDashboard({browserPage: page, email, orgId})
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await refreshIfPageError(page))) break
      if (attempt === 3) throw new Error('Dashboard returned server error after 3 attempts, aborting cleanup')
      console.log(`[cleanup-apps] Dashboard server error (${attempt}/3), retrying...`)
    }
    console.log('[cleanup-apps] Dashboard loaded.')

    // Step 3: Find matching apps
    console.log('[cleanup-apps] Finding matching apps...')
    const apps = await findAppsOnDashboard(page, pattern)
    console.log(`[cleanup-apps] Found ${apps.length} app(s) matching pattern "${pattern}"`)
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
      const tag = `[cleanup-apps] [${i + 1}/${apps.length}]`
      const appStart = Date.now()
      let uninstalled = false
      let wasSkipped = false

      console.log(`${tag} ${app.name}`)

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`  (${attempt}/3) retrying...`)
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
              const allUninstalled = await uninstallApp(page, app.url, app.name)
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
            const deleted = await deleteAppFromDevDashboard(page, app.url)
            if (!deleted) throw new Error('App deletion could not be verified')
            console.log('  Deleted')
          }

          uninstalled = true
          break
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // Fail fast if the app still has installs — retries won't help
          if (msg === 'STILL_HAS_INSTALLS') {
            console.log('  Delete skipped (still has installs — dashboard count may be stale)')
            wasSkipped = true
            skipped++
            break
          }
          if (attempt < 3) {
            console.warn(`  (${attempt}/3) failed: ${msg}`)
            await page.waitForTimeout(BROWSER_TIMEOUT.medium)
          } else {
            console.warn(`  Failed: ${msg}`)
          }
        }
      }

      if (uninstalled) succeeded++
      else if (!wasSkipped) failed++
      const appElapsed = ((Date.now() - appStart) / 1000).toFixed(1)
      console.log(`  (${appElapsed}s)`)
      console.log('')
    }

    // Summary
    const parts = [`${succeeded} succeeded`]
    if (skipped > 0) parts.push(`${skipped} skipped`)
    if (failed > 0) parts.push(`${failed} failed`)
    console.log('')
    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
    console.log(`[cleanup-apps] Complete: ${parts.join(', ')} (${totalElapsed}s total)`)
    if (failed > 0) process.exitCode = 1
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
  let totalSeen = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Recover from transient 500/502 before parsing the page
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await refreshIfPageError(page))) break
      if (attempt === 3) throw new Error('Apps page returned server error after 3 attempts')
      console.log(`[cleanup-apps]   ...server error on apps page (${attempt}/3), retrying`)
    }

    const appCards = await page.locator('a[href*="/apps/"]').all()

    for (const card of appCards) {
      const href = await card.getAttribute('href')
      const text = await card.textContent()
      if (!href || !text || !href.match(/\/apps\/\d+/)) continue

      totalSeen++

      const name = text.split(/\d+\s+install/i)[0]?.trim() ?? text.split('\n')[0]?.trim() ?? text.trim()
      if (!name || name.length > 200) continue
      if (!name.includes(namePattern)) continue

      const installMatch = text.match(/(\d+)\s+install/i)
      const installs = installMatch ? parseInt(installMatch[1]!, 10) : 0

      const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
      apps.push({name, url, installs})
    }

    console.log(`[cleanup-apps]   ...loaded ${totalSeen} apps`)

    // Check for next page — navigate via href since the button click may not work
    const nextLink = page.locator('a[href*="next_cursor"]').first()
    if (!(await nextLink.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) break
    const nextHref = await nextLink.getAttribute('href')
    if (!nextHref) break
    const nextUrl = nextHref.startsWith('http') ? nextHref : `https://dev.shopify.com${nextHref}`
    await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  return apps
}

/** Uninstall an app from all stores via the admin UI menu. Returns true if fully uninstalled. */
async function uninstallApp(
  page: Page,
  appUrl: string,
  appName: string,
): Promise<boolean> {
  // Collect store slugs from the installs page (with pagination)
  const storeSlugs: string[] = []
  await page.goto(`${appUrl}/installs`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Use full HTML to catch FQDNs in hrefs/attributes and visible text
    const slugsBefore = storeSlugs.length
    const pageHtml = await page.content()
    const fqdnRegex = /([\w-]+)\.myshopify\.com/g
    let fqdnMatch = fqdnRegex.exec(pageHtml)
    while (fqdnMatch) {
      const slug = fqdnMatch[1]!
      if (!storeSlugs.includes(slug)) storeSlugs.push(slug)
      fqdnMatch = fqdnRegex.exec(pageHtml)
    }

    // If no FQDNs found on this page, fall back to table row text (store names = slugs)
    if (storeSlugs.length === slugsBefore) {
      const rows = await page.locator('table tbody tr').all()
      for (const row of rows) {
        const firstCell = row.locator('td').first()
        const text = (await firstCell.textContent())?.trim()
        if (text && !text.toLowerCase().includes('no installed')) {
          // Store name in the table is the slug (e.g., "e2e-w0-12345")
          const slug = text.replace('.myshopify.com', '').trim()
          if (slug && !storeSlugs.includes(slug)) storeSlugs.push(slug)
        }
      }
    }

    // Check for next page
    const nextBtn = page.locator('button#nextURL')
    if (!(await nextBtn.isVisible({timeout: BROWSER_TIMEOUT.short}).catch(() => false))) break
    const isNextDisabled = await nextBtn.evaluate(
      (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    ).catch(() => true)
    if (isNextDisabled) break

    await nextBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  if (storeSlugs.length === 0) return true

  let allUninstalled = true
  for (const storeSlug of storeSlugs) {
    try {
      const uninstalled = await uninstallAppFromStore(page, storeSlug, appName)
      if (!uninstalled) allUninstalled = false
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      console.warn(`    Failed to uninstall from ${storeSlug}: ${err instanceof Error ? err.message : String(err)}`)
      allUninstalled = false
    }
  }

  // Final verification: check the installs page shows 0 installs (with pagination)
  await page.goto(`${appUrl}/installs`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const remainingRows = await page.locator('table tbody tr').all()
    for (const row of remainingRows) {
      const text = (await row.locator('td').first().textContent())?.trim() ?? ''
      if (text && !text.toLowerCase().includes('no installed')) {
        return false
      }
    }

    const nextBtn = page.locator('button#nextURL')
    if (!(await nextBtn.isVisible({timeout: BROWSER_TIMEOUT.short}).catch(() => false))) break
    const isNextDisabled = await nextBtn.evaluate(
      (el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'),
    ).catch(() => true)
    if (isNextDisabled) break

    await nextBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  return allUninstalled
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
      console.error('[cleanup-apps] --pattern requires a value')
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
    console.error('[cleanup-apps] Fatal error:', err)
    process.exitCode = 1
  })
}
