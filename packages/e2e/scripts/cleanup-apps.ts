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
import * as fs from 'fs'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT} from '../setup/constants.js'
import {getLastPageStatus, navigateToDashboard, refreshIfPageError, trackMainFrameStatus} from '../setup/browser.js'
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
  /** Playwright browser storage state path (default: E2E_BROWSER_STATE_PATH or global-auth path) */
  storageStatePath?: string
}

interface DashboardApp {
  name: string
  url: string
  installs: number
}

interface CleanupStats {
  found: number
  succeeded: number
  skipped: number
  failed: number
}

const APP_CARD_SELECTOR = 'a[href*="/apps/"]'
const EMPTY_APPS_PATTERN =
  /(no apps matched your search|don't have any apps|do not have any apps|haven't created any apps)/i
const DASHBOARD_ERROR_PATTERN = /(unprocessable entity|request can't be processed|server error|something went wrong)/i

function isAccountsShopifyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === 'accounts.shopify.com'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

function defaultStorageStatePath(): string {
  const tmpBase = process.env.E2E_TEMP_DIR ?? path.resolve(__dirname, '../../../.e2e-tmp')
  return path.join(tmpBase, 'global-auth', 'browser-storage-state.json')
}

function existingStorageStatePath(candidate?: string): string | undefined {
  return [candidate, process.env.E2E_BROWSER_STATE_PATH, defaultStorageStatePath()].find(
    (storageStatePath): storageStatePath is string => Boolean(storageStatePath && fs.existsSync(storageStatePath)),
  )
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
  const storageStatePath = existingStorageStatePath(opts.storageStatePath)

  // Banner
  console.log('')
  console.log(`[cleanup-apps] Mode:    ${MODE_LABELS[mode]}`)
  console.log(`[cleanup-apps] Org:     ${orgId || '(not set)'}`)
  console.log(`[cleanup-apps] Pattern: "${pattern}"`)
  console.log('')

  if (!storageStatePath && (!email || !password)) {
    throw new Error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required when no browser storage state is available')
  }

  if (!orgId) {
    throw new Error('E2E_ORG_ID is required')
  }

  const browser = await chromium.launch({headless: !opts.headed})
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
    },
    ...(storageStatePath ? {storageState: storageStatePath} : {}),
  })
  context.setDefaultTimeout(BROWSER_TIMEOUT.max)
  context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
  const page = await context.newPage()
  trackMainFrameStatus(page)
  const totalStart = Date.now()

  try {
    // Step 1: Reuse Playwright's global auth storage when available; otherwise log in directly.
    if (storageStatePath) {
      console.log('[cleanup-apps] Reusing browser storage state.')
    } else if (email && password) {
      console.log('[cleanup-apps] Logging in...')
      await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)
      console.log('[cleanup-apps] Logged in successfully.')
    }

    // Step 2: Navigate to dashboard (retry on 500/502).
    // navigateToDashboard already refreshes once on error; this loop is extra resilience.
    console.log('[cleanup-apps] Navigating to dashboard...')
    await navigateToDashboard({browserPage: page, email, orgId, searchTerm: pattern})
    if (isAccountsShopifyUrl(page.url()) && email && password) {
      console.log('[cleanup-apps] Browser storage state was not accepted; logging in...')
      await completeLogin(page, page.url(), email, password)
      await navigateToDashboard({browserPage: page, email, orgId, searchTerm: pattern})
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await refreshIfPageError(page))) break
      if (attempt === 3) throw new Error('Dashboard returned server error after 3 attempts, aborting cleanup')
      console.log(`[cleanup-apps] Dashboard server error (${attempt}/3), retrying...`)
    }
    console.log('[cleanup-apps] Dashboard loaded.')

    // Step 3: Process matching apps page by page. This intentionally does useful
    // cleanup work before loading the full app list, because the dashboard can
    // return transient 5xx responses after many pages.
    const stats: CleanupStats = {found: 0, succeeded: 0, skipped: 0, failed: 0}
    await cleanupAppsPageByPage({page, mode, pattern, email, orgId, stats})

    // Summary
    const parts = [`${stats.found} found`, `${stats.succeeded} succeeded`]
    if (stats.skipped > 0) parts.push(`${stats.skipped} skipped`)
    if (stats.failed > 0) parts.push(`${stats.failed} failed`)
    console.log('')
    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
    console.log(`[cleanup-apps] Complete: ${parts.join(', ')} (${totalElapsed}s total)`)
    if (stats.failed > 0) process.exitCode = 1
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Dashboard browser helpers — bulk discovery and cleanup
// ---------------------------------------------------------------------------

async function cleanupAppsPageByPage(opts: {
  page: Page
  mode: CleanupMode
  pattern: string
  email: string
  orgId: string
  stats: CleanupStats
}): Promise<void> {
  const {page, mode, pattern, email, orgId, stats} = opts
  let totalSeen = 0
  let pageNumber = 1
  const handledAppUrls = new Set<string>()

  console.log('[cleanup-apps] Finding matching apps...')

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await recoverFromAppsPageError(page)
    await waitForAppsIndex(page)
    const nextUrl = await nextAppsPageUrl(page)
    const {seen, matches} = await findAppsOnCurrentDashboardPage(page, pattern, handledAppUrls)
    const matchOffset = stats.found
    totalSeen += seen
    stats.found += matches.length

    console.log(`[cleanup-apps]   page ${pageNumber}: loaded ${totalSeen} apps, found ${matches.length} match(es)`)

    for (const [index, app] of matches.entries()) {
      const installLabel = app.installs === 1 ? 'install' : 'installs'
      console.log(`  ${matchOffset + index + 1}. ${app.name} (${app.installs} ${installLabel})`)
    }
    if (matches.length > 0) console.log('')

    if (mode !== 'list') {
      for (const app of matches) {
        await cleanupApp({page, mode, app, email, orgId, stats})
        handledAppUrls.add(app.url)
      }
    }

    if (mode !== 'list' && matches.length > 0) {
      // Re-paginate from page 1 after any mutation. This is intentionally O(pages²)
      // for an org with matches spread across many pages: re-scanning from the top
      // avoids stale next_cursor links that point past now-deleted apps. Don't
      // "optimize" this into carrying the cursor across mutations.
      await navigateToDashboard({browserPage: page, email, orgId, searchTerm: pattern})
      totalSeen = 0
      pageNumber = 1
      continue
    }

    if (!nextUrl) break
    await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    pageNumber++
  }
}

async function cleanupApp(opts: {
  page: Page
  mode: CleanupMode
  app: DashboardApp
  email: string
  orgId: string
  stats: CleanupStats
}): Promise<void> {
  const {page, mode, app, email, orgId, stats} = opts
  const tag = `[cleanup-apps] [${stats.succeeded + stats.skipped + stats.failed + 1}/${stats.found}]`
  const appStart = Date.now()
  let uninstalled = false
  let wasSkipped = false

  console.log(`${tag} ${app.name}`)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  (${attempt}/3) retrying...`)
        await navigateToDashboard({browserPage: page, email, orgId, searchTerm: app.name})
      }

      if (mode === 'full' || mode === 'uninstall') {
        if (app.installs === 0) {
          if (mode === 'uninstall') {
            console.log('  Not installed (skipped)')
            wasSkipped = true
            stats.skipped++
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
          stats.skipped++
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
        stats.skipped++
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

  if (uninstalled) stats.succeeded++
  else if (!wasSkipped) stats.failed++
  const appElapsed = ((Date.now() - appStart) / 1000).toFixed(1)
  console.log(`  (${appElapsed}s)`)
  console.log('')
}

async function recoverFromAppsPageError(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!(await refreshIfPageError(page))) return
    if (attempt === 3) throw new Error('Apps page returned server error after 3 attempts')
    console.log(`[cleanup-apps]   ...server error on apps page (${attempt}/3), retrying`)
  }
}

async function waitForAppsIndex(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const status = getLastPageStatus(page)
    if (status !== undefined && status >= 400) {
      await retryAppsIndex(page, attempt, `HTTP ${status}`)
      continue
    }

    const hasAppCards = await page
      .locator(APP_CARD_SELECTOR)
      .first()
      .waitFor({state: 'attached', timeout: BROWSER_TIMEOUT.max})
      .then(() => true)
      .catch(() => false)
    if (hasAppCards) return

    const bodyText = await page
      .locator('body')
      .innerText({timeout: BROWSER_TIMEOUT.short})
      .catch(() => '')
    if (EMPTY_APPS_PATTERN.test(bodyText)) return

    const reason = DASHBOARD_ERROR_PATTERN.test(bodyText)
      ? `dashboard error page: ${compactPageText(bodyText)}`
      : 'no app cards or empty state'
    await retryAppsIndex(page, attempt, reason)
  }
}

async function retryAppsIndex(page: Page, attempt: number, reason: string): Promise<void> {
  if (attempt === 3) {
    throw new Error(`Apps page did not render a usable app list (${reason}; url: ${page.url()})`)
  }
  console.log(`[cleanup-apps]   ...apps page not ready (${reason}), retrying`)
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
}

function compactPageText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120)
}

async function findAppsOnCurrentDashboardPage(
  page: Page,
  namePattern: string,
  excludeAppUrls: Set<string> = new Set(),
): Promise<{seen: number; matches: DashboardApp[]}> {
  const matches: DashboardApp[] = []
  let seen = 0
  const appCards = await page.locator(APP_CARD_SELECTOR).all()

  for (const card of appCards) {
    const href = await card.getAttribute('href')
    const text = await card.textContent()
    if (!href || !text || !href.match(/\/apps\/\d+/)) continue

    seen++

    const name = extractDashboardAppName(text, namePattern)
    if (!name || name.length > 200) continue

    const installs = extractDashboardInstallCount(text, name)

    const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
    if (excludeAppUrls.has(url)) continue
    matches.push({name, url, installs})
  }

  return {seen, matches}
}

function extractDashboardAppName(cardText: string, namePattern: string): string | undefined {
  const dateStampedName = cardText.match(new RegExp(`${escapeRegExp(namePattern)}\\S*?\\d{13}`))?.[0]
  if (dateStampedName) return dateStampedName

  const lines = cardText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const matchingLine = lines.find((line) => line.includes(namePattern))
  if (matchingLine) return stripInstallCount(matchingLine)

  const patternIndex = cardText.indexOf(namePattern)
  if (patternIndex === -1) return undefined

  const fromPattern = cardText.slice(patternIndex)
  return stripInstallCount(fromPattern)
}

function extractDashboardInstallCount(cardText: string, appName: string): number {
  const appNameIndex = cardText.indexOf(appName)
  const textAfterAppName = appNameIndex === -1 ? cardText : cardText.slice(appNameIndex + appName.length)
  const installMatch = textAfterAppName.match(/(\d+)\s+installs?/i)
  if (installMatch?.[1]) return parseInt(installMatch[1], 10)

  const allInstallMatches = [...cardText.matchAll(/(\d+)\s+installs?/gi)]
  const lastInstallCount = allInstallMatches.at(-1)?.[1]
  return lastInstallCount ? parseInt(lastInstallCount, 10) : 0
}

function stripInstallCount(text: string): string {
  const installCount = text.match(/\d+\s+installs?/i)
  if (!installCount || installCount.index === undefined) return text.trim()

  // Date-stamped names are recovered earlier via extractDashboardAppName's 13-digit
  // anchor; this only trims the trailing "N installs" off the non-date-stamped fallback.
  return text.slice(0, installCount.index).trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function nextAppsPageUrl(page: Page): Promise<string | undefined> {
  const nextLink = page.locator('a[href*="next_cursor"]').first()
  if (!(await nextLink.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) return undefined
  const nextHref = await nextLink.getAttribute('href')
  if (!nextHref) return undefined
  return nextHref.startsWith('http') ? nextHref : `https://dev.shopify.com${nextHref}`
}

/** Uninstall an app from all stores via the admin UI menu. Returns true if fully uninstalled. */
async function uninstallApp(page: Page, appUrl: string, appName: string): Promise<boolean> {
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
    const isNextDisabled = await nextBtn
      .evaluate((el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'))
      .catch(() => true)
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
    const isNextDisabled = await nextBtn
      .evaluate((el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'))
      .catch(() => true)
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
