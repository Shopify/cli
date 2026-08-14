/* eslint-disable no-await-in-loop */
import {appTestFixture} from './app.js'
import {isVisibleWithin} from './browser.js'
import {BROWSER_TIMEOUT, CLI_TIMEOUT} from './constants.js'
import {createLogger, e2eRunSegment, e2eSection, requireEnv} from './env.js'
import type {CLIProcess, ExecResult} from './cli.js'
import type {Locator, Page} from '@playwright/test'

const log = createLogger('cli')

// ---------------------------------------------------------------------------
// Dev store provisioning
// ---------------------------------------------------------------------------

/** Generate a unique store name for a worker. */
export function generateStoreName(workerIndex: number): string {
  const timestampSegment = Date.now().toString(36)
  return `e2e-w${workerIndex}-${e2eRunSegment()}-${timestampSegment}`
}

interface WorkerCtx {
  workerIndex: number
}

interface StoreCommandJson {
  store?: {
    domain?: unknown
    deletionRequested?: unknown
    deletionConfirmed?: unknown
  }
}

/** Create a development store with the CLI and return its FQDN. */
export async function createDevStoreWithCli(
  ctx: WorkerCtx & {cli: CLIProcess; storeName: string; orgId: string},
): Promise<string> {
  e2eSection(ctx, `Setup: store ${ctx.storeName}`)
  log.log(ctx, 'creating store')

  const result = await ctx.cli.exec(
    ['store', 'create', 'dev', '--name', ctx.storeName, '--organization-id', ctx.orgId, '--plan', 'basic', '--json'],
    {timeout: CLI_TIMEOUT.store},
  )
  assertCommandSucceeded('create development store', result)

  const storeFqdn = parseStoreDomain(result, 'create development store')
  log.log(ctx, `store created ${storeFqdn}`)
  return storeFqdn
}

/** Request development store deletion with the CLI and report whether the CLI confirmed it. */
export async function deleteDevStoreWithCli(options: {
  cli: Pick<CLIProcess, 'exec'>
  storeFqdn: string
  orgId: string
}): Promise<boolean> {
  const result = await options.cli.exec(
    ['store', 'delete', '--store', options.storeFqdn, '--organization-id', options.orgId, '--force', '--json'],
    {timeout: CLI_TIMEOUT.store},
  )
  assertCommandSucceeded('delete development store', result)

  const output = parseJsonOutput(result, 'delete development store')
  if (output.store?.deletionRequested !== true) {
    throw new Error(`CLI did not confirm the store deletion request:\n${result.stdout}`)
  }
  return output.store.deletionConfirmed === true
}

function assertCommandSucceeded(action: string, result: ExecResult): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to ${action} (exit code ${result.exitCode}):\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }
}

function parseStoreDomain(result: ExecResult, action: string): string {
  const output = parseJsonOutput(result, action)
  const domain = output.store?.domain
  if (typeof domain !== 'string' || !domain.endsWith('.myshopify.com')) {
    throw new Error(`CLI returned an invalid store domain:\n${result.stdout}`)
  }
  return domain
}

function parseJsonOutput(result: ExecResult, action: string): StoreCommandJson {
  try {
    return JSON.parse(result.stdout) as StoreCommandJson
  } catch {
    throw new Error(`CLI returned invalid JSON while trying to ${action}:\n${result.stdout}`)
  }
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
  const modal = page.locator('.Polaris-Modal-Dialog__Modal').last()
  const confirmBtn = modal.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
  if (await isVisibleWithin(confirmBtn, BROWSER_TIMEOUT.medium)) {
    await selectUninstallReason(page, modal)
    await fillUninstallFeedback(modal)
    await dismissOpenPopover(page, modal)

    let confirmEnabled = false
    for (let i = 1; i <= 3; i++) {
      if (await confirmBtn.isEnabled().catch(() => false)) {
        confirmEnabled = true
        break
      }
      await selectUninstallReason(page, modal)
      await fillUninstallFeedback(modal)
      await dismissOpenPopover(page, modal)
      await page.waitForTimeout(BROWSER_TIMEOUT.short)
    }

    // If still disabled, the force-click below no-ops; flag it so a stuck confirm
    // is distinguishable from a real uninstall in the logs (verified in step 5).
    if (!confirmEnabled) {
      // eslint-disable-next-line no-console
      console.warn(`    Uninstall confirm button never enabled for ${appName} — force-clicking anyway`)
    }

    // Force a DOM click to bypass Playwright actionability (the button can read as
    // disabled mid-transition).
    await confirmBtn.evaluate((button) => (button as HTMLButtonElement).click())
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

async function selectUninstallReason(page: Page, modal: Locator): Promise<void> {
  const nativeSelect = modal.locator('select').first()
  if (await isVisibleWithin(nativeSelect, BROWSER_TIMEOUT.short)) {
    await nativeSelect.selectOption({index: 1}).catch(() => {})
    return
  }

  const reasonTrigger = modal
    .locator('button, [role="combobox"]')
    .filter({hasText: /Select all that apply|Reason for uninstalling/i})
    .first()
  if (!(await isVisibleWithin(reasonTrigger, BROWSER_TIMEOUT.short))) return

  await reasonTrigger.click()
  await page.waitForTimeout(BROWSER_TIMEOUT.short)

  const preferredReason = page
    .locator('[role="option"], [role="menuitemcheckbox"], [role="checkbox"], label')
    .filter({hasText: /Other|No longer need|Don't need|Do not need|Not using|Testing/i})
    .first()
  if (await isVisibleWithin(preferredReason, BROWSER_TIMEOUT.short)) {
    await preferredReason.click()
    return
  }

  const options = await page.locator('[role="option"], [role="menuitemcheckbox"], [role="checkbox"]').all()
  for (const option of options) {
    if (await isVisibleWithin(option, BROWSER_TIMEOUT.short)) {
      await option.click()
      return
    }
  }
}

async function fillUninstallFeedback(modal: Locator): Promise<void> {
  const feedback = modal.locator('textarea').first()
  if (await isVisibleWithin(feedback, BROWSER_TIMEOUT.short)) {
    await feedback.fill('Automated E2E cleanup.')
  }
}

async function dismissOpenPopover(page: Page, modal: Locator): Promise<void> {
  const feedback = modal.locator('textarea').first()
  if (await isVisibleWithin(feedback, BROWSER_TIMEOUT.short)) {
    await feedback.click({force: true}).catch(() => {})
  } else {
    await modal
      .locator('h1, h2, h3')
      .first()
      .click({force: true})
      .catch(() => {})
  }
  await page.waitForTimeout(BROWSER_TIMEOUT.short)

  if (
    await page
      .locator('[data-portal-id^="popover-"]')
      .isVisible({timeout: BROWSER_TIMEOUT.short})
      .catch(() => false)
  ) {
    await modal
      .locator('textarea, h1, h2, h3')
      .first()
      .click({force: true})
      .catch(() => {})
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }
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
  storeFqdn: async ({cli, env}, use) => {
    requireEnv(env, 'orgId')
    const wi = env.workerIndex

    // Unique ports per worker to avoid EADDRINUSE when running in parallel
    const portBase = 3457 + wi * 10
    env.processEnv.SHOPIFY_FLAG_GRAPHIQL_PORT = String(portBase)
    env.processEnv.SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT = String(portBase + 2)

    const storeName = generateStoreName(wi)
    const fqdn = await createDevStoreWithCli({cli, workerIndex: wi, storeName, orgId: env.orgId})

    env.processEnv.SHOPIFY_FLAG_STORE = fqdn // eslint-disable-line require-atomic-updates

    await use(fqdn)
  },
})
