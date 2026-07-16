/* eslint-disable no-console, no-restricted-imports */

/**
 * Prime Playwright browser storage state for standalone E2E maintenance scripts.
 *
 * Playwright global setup creates this state before test workers start, but
 * standalone GitHub Actions jobs need a small auth-only entrypoint so follow-up
 * cleanup jobs can reuse browser cookies without each cleanup operation going
 * through Shopify Accounts again.
 */

import {config} from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT} from '../setup/constants.js'
import {isVisibleWithin} from '../setup/browser.js'
import {completeLogin} from '../helpers/browser-login.js'
import type {Page} from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.E2E_ACCOUNT_EMAIL || !process.env.E2E_ACCOUNT_PASSWORD || !process.env.E2E_ORG_ID) {
  config({path: path.resolve(__dirname, '../.env')})
}

interface PrimeBrowserAuthOptions {
  /** Playwright browser storage state path (default: E2E_BROWSER_STATE_PATH or global-auth path) */
  storageStatePath?: string
  /** Show browser window */
  headed?: boolean
  /** Organization ID (default: from E2E_ORG_ID env) */
  orgId?: string
}

const LOADTEST_HEADER = 'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9'

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

export async function primeBrowserAuthStorage(opts: PrimeBrowserAuthOptions = {}): Promise<string> {
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const storageStatePath = opts.storageStatePath ?? process.env.E2E_BROWSER_STATE_PATH ?? defaultStorageStatePath()

  if (!email || !password) {
    throw new Error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required')
  }

  if (!orgId) {
    throw new Error('E2E_ORG_ID is required')
  }

  fs.mkdirSync(path.dirname(storageStatePath), {recursive: true})

  const browser = await chromium.launch({headless: !opts.headed})
  try {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        [LOADTEST_HEADER]: 'true',
      },
    })
    context.setDefaultTimeout(BROWSER_TIMEOUT.max)
    context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
    const page = await context.newPage()

    console.log('[prime-browser-auth] Logging in...')
    await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)

    await attemptVisitAndHandleAccountPicker(page, 'https://admin.shopify.com/', email, 'admin')
    await attemptVisitAndHandleAccountPicker(
      page,
      `https://dev.shopify.com/dashboard/${orgId}/apps`,
      email,
      'dev dashboard',
    )

    await context.storageState({path: storageStatePath})
    console.log(`[prime-browser-auth] Browser storage state saved to ${storageStatePath}`)
    return storageStatePath
  } finally {
    await browser.close()
  }
}

async function attemptVisitAndHandleAccountPicker(page: Page, url: string, email: string, label: string) {
  try {
    await visitAndHandleAccountPicker(page, url, email)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    console.warn(
      `[prime-browser-auth] Browser session prewarm for ${label} failed: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/** Navigate to a URL and dismiss the account picker if it appears. */
async function visitAndHandleAccountPicker(page: Page, url: string, email: string) {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  if (isAccountsShopifyUrl(page.url())) {
    const accountButton = page.locator(`text=${email}`).first()
    if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.long)) {
      await accountButton.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  primeBrowserAuthStorage({headed: process.argv.includes('--headed')}).catch((err) => {
    console.error('[prime-browser-auth] Fatal error:', err)
    process.exitCode = 1
  })
}
