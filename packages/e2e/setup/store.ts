/* eslint-disable no-await-in-loop */
import {appTestFixture} from './app.js'
import {isVisibleWithin} from './browser.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {createLogger, e2eSection} from './env.js'
import * as fs from 'fs'
import type {BrowserContext} from './browser.js'
import type {Page} from '@playwright/test'

const log = createLogger('browser')

// ---------------------------------------------------------------------------
// Dev store provisioning — create new stores via browser automation
// ---------------------------------------------------------------------------

/** Generate a unique store name for a worker. */
export function generateStoreName(workerIndex: number): string {
  return `e2e-w${workerIndex}-${Date.now()}`
}

interface WorkerCtx {
  workerIndex: number
}

/**
 * Create a dev store via the admin store creation form.
 * Returns the store FQDN (e.g., "e2e-w0-1712345678.myshopify.com").
 */
export async function createDevStore(
  ctx: BrowserContext &
    WorkerCtx & {
      storeName: string
      email?: string
      orgId?: string
    },
): Promise<string> {
  const {browserPage} = ctx
  const orgId = ctx.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()

  e2eSection(ctx, `Setup: store ${ctx.storeName}`)
  log.log(ctx, 'store creating')

  // Navigate directly to the store creation form on admin.shopify.com
  const email = ctx.email ?? process.env.E2E_ACCOUNT_EMAIL
  await browserPage.goto(`https://admin.shopify.com/store-create/organization/${orgId}`, {
    waitUntil: 'domcontentloaded',
  })
  await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Handle login redirect — reload storageState and retry if needed
  if (browserPage.url().includes('accounts.shopify.com')) {
    log.log(ctx, 'redirected to login, reloading session')

    const storageStatePath = process.env.E2E_BROWSER_STATE_PATH
    if (storageStatePath) {
      const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'))
      await browserPage.context().addCookies(state.cookies)
    }

    await browserPage.goto(`https://admin.shopify.com/store-create/organization/${orgId}`, {
      waitUntil: 'domcontentloaded',
    })
    await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

    if (browserPage.url().includes('accounts.shopify.com') && email) {
      const accountButton = browserPage.locator(`text=${email}`).first()
      if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.long)) {
        await accountButton.click()
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
      }
    }
  }

  // Wait for the store creation form to load — retry if page didn't render
  const nameInput = browserPage.locator('s-internal-text-field[label="Store name"]').locator('input')
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await isVisibleWithin(nameInput, BROWSER_TIMEOUT.max)) break

    log.log(ctx, `store form not loaded (attempt ${attempt}/3), url=${browserPage.url()}`)
    await browserPage.goto(`https://admin.shopify.com/store-create/organization/${orgId}`, {
      waitUntil: 'domcontentloaded',
    })
    await browserPage.waitForTimeout(BROWSER_TIMEOUT.long)
  }

  // Fill store name and select plan (inputs are inside shadow DOM)
  const plans = [
    'BASIC_APP_DEVELOPMENT',
    'PROFESSIONAL_APP_DEVELOPMENT',
    'UNLIMITED_APP_DEVELOPMENT',
    'SHOPIFY_PLUS_APP_DEVELOPMENT',
  ]
  const plan = plans[Date.now() % plans.length]!
  log.log(ctx, `store plan=${plan}`)

  // Fill store name — chained locator pierces shadow DOM (pattern from admin-web E2E)
  await nameInput.click({timeout: BROWSER_TIMEOUT.max})
  await nameInput.fill('')
  await nameInput.type(ctx.storeName)
  await browserPage.waitForTimeout(BROWSER_TIMEOUT.short)

  // Select plan — chained locator into shadow DOM select
  const planSelect = browserPage.locator('s-internal-select[label="Shopify plan"]').locator('select')
  await planSelect.selectOption(plan)
  await browserPage.waitForTimeout(BROWSER_TIMEOUT.short)

  // Click "Create store"
  const createButton = browserPage.locator('s-internal-button[variant="primary"]').locator('button')
  await createButton.click()

  // Wait for redirect to store admin (provisioning can be slow)
  await browserPage.waitForURL(/admin\.shopify\.com\/store\/(?!store-create)/, {timeout: BROWSER_TIMEOUT.max})

  // Extract store slug from URL: https://admin.shopify.com/store/{slug}
  const slugMatch = browserPage.url().match(/admin\.shopify\.com\/store\/([^/]+)/)
  if (!slugMatch?.[1]) {
    throw new Error(`Could not extract store slug from URL: ${browserPage.url()}`)
  }

  const storeFqdn = `${slugMatch[1]}.myshopify.com`
  log.log(ctx, `store created ${storeFqdn}`)
  return storeFqdn
}

// ---------------------------------------------------------------------------
// Store admin browser actions — uninstall apps, delete stores, and helpers
// ---------------------------------------------------------------------------

/** Dismiss the Dev Console panel if visible on a store admin page. */
export async function dismissDevConsole(page: Page): Promise<void> {
  const devConsole = page.locator('h2:has-text("Dev Console")')
  if (!(await isVisibleWithin(devConsole, BROWSER_TIMEOUT.medium))) return

  const hideBtn = page.locator('button[aria-label="hide"]').first()
  if (await isVisibleWithin(hideBtn, BROWSER_TIMEOUT.short)) {
    await hideBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }
}

/**
 * Uninstall an app from a store's admin settings/apps page. Returns true if confirmed uninstalled.
 *
 * Single attempt — caller owns the retry loop.
 */
export async function uninstallAppFromStore(page: Page, storeSlug: string, appName: string): Promise<boolean> {
  // Step 1: Navigate to the store's settings/apps page.
  await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(BROWSER_TIMEOUT.long)
  await dismissDevConsole(page)

  // Step 2: Find the app by name. Not visible → already uninstalled.
  const appSpan = page.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first()
  if (!(await isVisibleWithin(appSpan, BROWSER_TIMEOUT.long))) return true

  // Step 3: Open the ⋯ menu and click Uninstall.
  await appSpan.locator('xpath=./following::button[1]').click()
  await page.waitForTimeout(BROWSER_TIMEOUT.short)
  const uninstallOpt = page.locator('text=Uninstall').last()
  if (!(await isVisibleWithin(uninstallOpt, BROWSER_TIMEOUT.medium))) return false
  await uninstallOpt.click()
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Step 4: Confirm the uninstall in the modal (if one appears).
  const confirmBtn = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
  if (await isVisibleWithin(confirmBtn, BROWSER_TIMEOUT.medium)) {
    await confirmBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Step 5: Reload the page to confirm the app is no longer listed.
  // Success → app is not on listed on the page.
  // Failure → app is still listed.
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.long)
  await dismissDevConsole(page)
  const stillVisible = await isVisibleWithin(
    page.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first(),
    BROWSER_TIMEOUT.medium,
  )
  return !stillVisible
}

/** Check if the current page shows the empty state (zero apps installed). Caller must navigate first. */
export async function isStoreAppsEmpty(page: Page): Promise<boolean> {
  // "Add apps to your store" empty state is the definitive zero-apps signal
  const emptyState = page.locator('text=Add apps to your store')
  if (await isVisibleWithin(emptyState, BROWSER_TIMEOUT.medium)) return true

  // Fallback: no "More actions" menu buttons in the app list
  const menuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
  return menuButtons.length === 0
}

/**
 * Delete a store via the admin /settings/plan/cancel page. Returns true if deleted.
 *
 * Gate: store must have zero apps installed.
 * Caller should verify via `isStoreAppsEmpty` and skip this call if apps remain,
 * otherwise step 4 will exhaust its micro-retry (Delete button never enables) and throw.
 *
 * Single attempt — caller owns the retry loop.
 */
export async function deleteStore(page: Page, storeSlug: string): Promise<boolean> {
  // Step 1: Navigate to /settings/plan/cancel (auto-opens the "Review before deleting store" modal).
  const cancelUrl = `https://admin.shopify.com/store/${storeSlug}/settings/plan/cancel`
  await page.goto(cancelUrl, {waitUntil: 'domcontentloaded'})

  // Step 2: Race — modal renders (normal) vs. redirect to /access_account (already deleted).
  // The redirect can fire post-DOMContentLoaded, so a URL check right after goto is too early.
  const modal = page.locator('.Polaris-Modal-Dialog__Modal:has-text("Review before deleting store")')
  const checkbox = modal.locator('input[type="checkbox"]')
  try {
    await Promise.race([
      checkbox.waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.max}),
      page.waitForURL(/access_account/, {timeout: BROWSER_TIMEOUT.max}),
    ])
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // Both branches timed out — fall through so outer retry can decide.
  }
  if (page.url().includes('access_account')) return true

  // Step 3: Check the confirmation checkbox (enables the Delete button).
  await checkbox.check()

  // Step 4: Wait for the Delete button to enable, then click.
  // Micro-retry for flaky checkbox state — different concern from caller's retry loop.
  const confirmButton = modal.locator('button:has-text("Delete store")')
  for (let i = 1; i <= 3; i++) {
    if (await confirmButton.isEnabled().catch(() => false)) break
    if (i === 3) throw new Error('Confirm button still disabled')
    await checkbox.check()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }
  await confirmButton.click()

  // Step 5: Wait for the delete POST to finish before reloading.
  try {
    await page.waitForLoadState('networkidle', {timeout: BROWSER_TIMEOUT.max})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // networkidle can miss on busy pages — fall through to reload anyway.
  }

  // Step 6: Reload /settings/plan/cancel to confirm deletion.
  // Success → redirect to /access_account.
  // Failure → still on /settings/plan/cancel
  await page.reload({waitUntil: 'domcontentloaded'})
  return page.url().includes('access_account')
}

// ---------------------------------------------------------------------------
// Fixture — per-test dev store for tests that need `app dev`
// ---------------------------------------------------------------------------

/**
 * Test-scoped fixture that creates a fresh dev store per test.
 *
 * Each test gets its own isolated store — no shared state between tests.
 * Store + app cleanup is handled by teardownAll() in the test's finally block.
 *
 * Fixture chain: envFixture → cliFixture → browserFixture → authFixture → appTestFixture → storeTestFixture
 *
 * Tests that need a dev store (app dev, hot reload, multi-config dev) use this fixture.
 * Tests that don't (scaffold, deploy, commands, smoke) stay on appTestFixture.
 */
export const storeTestFixture = appTestFixture.extend<{storeFqdn: string}>({
  storeFqdn: async ({browserPage, env}, use) => {
    const wi = env.workerIndex

    // Unique ports per worker to avoid EADDRINUSE when running in parallel
    const portBase = 3457 + wi * 10
    env.processEnv.SHOPIFY_FLAG_GRAPHIQL_PORT = String(portBase)
    env.processEnv.SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT = String(portBase + 2)

    const storeName = generateStoreName(wi)
    const fqdn = await createDevStore({browserPage, workerIndex: wi, storeName, orgId: env.orgId})

    env.processEnv.SHOPIFY_FLAG_STORE = fqdn // eslint-disable-line require-atomic-updates

    await use(fqdn)
  },
})
