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
import {findAppsOnDashboard, uninstallApp, deleteApp} from '../setup/app.js'
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
    await browserLogin(page, email, password)

    // Step 2: Navigate to dashboard
    console.log('[cleanup] Navigating to dashboard...')
    await navigateToDashboard({browserPage: page, email, orgId})

    // Step 3: Find matching apps
    const apps = await findAppsOnDashboard({browserPage: page, namePattern: pattern})
    console.log(`[cleanup] Found ${apps.length} app(s)`)
    console.log('')

    if (apps.length === 0) return

    for (let i = 0; i < apps.length; i++) {
      console.log(`  ${i + 1}. ${apps[i]!.name}`)
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
            const noInstalls = await checkNoInstalls(page, app.url)
            if (noInstalls) {
              console.log('  Not installed')
            } else {
              console.log('  Uninstalling...')
              const allUninstalled = await uninstallApp({browserPage: page, appUrl: app.url, appName: app.name, orgId})
              if (!allUninstalled) {
                throw new Error('Uninstall incomplete — some stores may remain')
              }
              console.log('  Uninstalled')
            }
          }

          if (mode === 'full' || mode === 'delete') {
            if (mode === 'delete') {
              const noInstalls = await checkNoInstalls(page, app.url)
              if (!noInstalls) {
                console.log('  Delete skipped (still installed)')
                wasSkipped = true
                skipped++
                break
              }
            }
            console.log('  Deleting...')
            await deleteApp({browserPage: page, appUrl: app.url})
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
// Browser-only login — go to accounts.shopify.com directly
// ---------------------------------------------------------------------------

async function browserLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('https://accounts.shopify.com/lookup', {waitUntil: 'domcontentloaded'})

  // Fill email
  await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 30_000})
  await page.locator('input[name="account[email]"], input[type="email"]').first().fill(email)
  await page.locator('button[type="submit"]').first().click()

  // Fill password
  await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 30_000})
  await page.locator('input[name="account[password]"], input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()

  // Wait for login to complete
  await page.waitForTimeout(3000)

  console.log('[cleanup] Logged in successfully.')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if an app has no store installs (by visiting its installs page). */
async function checkNoInstalls(page: Page, appUrl: string): Promise<boolean> {
  await page.goto(`${appUrl}/installs`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(3000)

  const emptyStatePatterns = ['no install', 'not installed', '0 install']
  const rows = await page.locator('table tbody tr').all()

  if (rows.length === 0) {
    // No table rows — check body text for empty state indicators
    const bodyText = (await page.textContent('body'))?.toLowerCase() ?? ''
    return emptyStatePatterns.some((pattern) => bodyText.includes(pattern))
  }

  for (const row of rows) {
    const text = (await row.locator('td').first().textContent())?.trim().toLowerCase() ?? ''
    if (text && !emptyStatePatterns.some((pattern) => text.includes(pattern))) return false
  }
  return true
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
