/* eslint-disable no-await-in-loop */
import {appTestFixture} from './app.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {createLogger, e2eSection} from './env.js'
import * as fs from 'fs'
import type {BrowserContext} from './browser.js'
import type {Page} from '@playwright/test'

const log = createLogger('browser')

// ---------------------------------------------------------------------------
// Dev store management — create and delete stores via browser automation
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
      if (await accountButton.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false)) {
        await accountButton.click()
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
      }
    }
  }

  // Wait for the store creation form to load — retry if page didn't render
  const nameInput = browserPage.locator('s-internal-text-field[label="Store name"]').locator('input')
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await nameInput.isVisible({timeout: BROWSER_TIMEOUT.max}).catch(() => false)) break

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
// Store admin browser actions — uninstall apps and delete stores
// ---------------------------------------------------------------------------

/**
 * Uninstall an app from a store's admin settings page.
 * Navigates to /settings/apps, finds the app by name, uninstalls it, and verifies removal.
 * Returns true if app is confirmed gone, false if still present.
 */
export async function uninstallAppFromStoreAdmin(page: Page, storeSlug: string, appName: string): Promise<boolean> {
  await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(BROWSER_TIMEOUT.long)

  // Dismiss any Dev Console dialog
  const cancelBtn = page.locator('button:has-text("Cancel")')
  if (await cancelBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
    await cancelBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  // Check if already uninstalled
  if (await isAppsPageEmpty(page)) return true

  const appSpan = page.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first()
  if (!(await appSpan.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false))) return true

  // Click ⋯ menu → Uninstall → Confirm
  await appSpan.locator('xpath=./following::button[1]').click()
  await page.waitForTimeout(BROWSER_TIMEOUT.short)

  const uninstallOpt = page.locator('text=Uninstall').last()
  if (!(await uninstallOpt.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) return false
  await uninstallOpt.click()
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  const confirmBtn = page.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
  if (await confirmBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
    await confirmBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Verify: reload and check app is gone
  await page.reload({waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.long)

  if (await isAppsPageEmpty(page)) return true

  // App name no longer visible = success even if other apps remain
  const stillVisible = await page
    .locator(`span:has-text("${appName}"):not([class*="Polaris"])`)
    .first()
    .isVisible({timeout: BROWSER_TIMEOUT.medium})
    .catch(() => false)
  return !stillVisible
}

/** Check if the store apps page shows the empty state (zero apps installed). */
async function isAppsPageEmpty(page: Page): Promise<boolean> {
  // "Add apps to your store" empty state is the definitive zero-apps signal
  const emptyState = page.locator('text=Add apps to your store')
  if (await emptyState.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) return true

  // Fallback: no "More actions" menu buttons in the app list
  const menuButtons = await page.locator('.Polaris-Layout__Section button[aria-label="More actions"]').all()
  return menuButtons.length === 0
}

/**
 * Delete a store from the admin settings plan page.
 * Verifies no apps are installed first — refuses to delete if apps remain.
 * Returns true if deleted, false if skipped.
 */
export async function deleteStoreFromAdmin(page: Page, storeSlug: string): Promise<boolean> {
  // Verify no apps are installed before deleting
  await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(BROWSER_TIMEOUT.long)

  const cancelBtn = page.locator('button:has-text("Cancel")')
  if (await cancelBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
    await cancelBtn.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  if (!(await isAppsPageEmpty(page))) {
    // Apps still installed — refuse to delete
    return false
  }

  // Delete the store
  // Step 1: Navigate to plan page and click delete button to open modal (retry navigation on failure)
  const planUrl = `https://admin.shopify.com/store/${storeSlug}/settings/plan`
  const deleteButton = page.locator('s-internal-button[tone="critical"]').locator('button')

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(planUrl, {waitUntil: 'domcontentloaded'})
      await page.waitForTimeout(BROWSER_TIMEOUT.long)
      await deleteButton.click({timeout: BROWSER_TIMEOUT.long})
      break
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_err) {
      if (attempt === 3) return false
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  const modal = page.locator('.Polaris-Modal-Dialog__Modal')

  // Step 2: Check the confirmation checkbox (retry step 1+2 if fails)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const checkbox = modal.locator('input[type="checkbox"]')
    if (await checkbox.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
      await checkbox.check({force: true})
      await page.waitForTimeout(BROWSER_TIMEOUT.short)
      break
    }
    if (attempt === 3) return false
    // Retry: close modal and re-click delete
    await page.keyboard.press('Escape')
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
    await deleteButton.click({timeout: BROWSER_TIMEOUT.max})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Step 3: Click confirm (retry step 2+3 if button is still disabled)
  const confirmButton = modal.locator('button:has-text("Delete store")')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const isDisabled = await confirmButton
      .evaluate((el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'))
      .catch(() => true)
    if (!isDisabled) break
    if (attempt === 3) return false
    // Retry: re-check the checkbox
    const checkbox = modal.locator('input[type="checkbox"]')
    await checkbox.check({force: true})
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  await confirmButton.click({force: true})
  await page.waitForURL(/access_account/, {timeout: BROWSER_TIMEOUT.max})

  // Verify: "Your plan was canceled" confirms the store is deleted
  const canceled = page.locator('text=Your plan was canceled')
  const verified = await canceled.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false)
  return verified || page.url().includes('access_account')
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
