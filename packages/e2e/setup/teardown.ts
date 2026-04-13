/* eslint-disable no-await-in-loop */
import {findAppOnDevDashboard, deleteAppFromDevDashboard} from './app.js'
import {refreshIfPageError} from './browser.js'
import {createLogger, e2eSection} from './env.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {uninstallAppFromStore, deleteStore, isStoreAppsEmpty, dismissDevConsole} from './store.js'
import type {Page} from '@playwright/test'

const log = createLogger('browser')

interface TeardownCtx {
  browserPage: Page
  appName: string
  orgId?: string
  workerIndex?: number
  /** If set, uninstalls app from store + deletes store before deleting the app */
  storeFqdn?: string
}

/**
 * Best-effort per-test teardown with escalating retry.
 *
 * Each phase is independent — failure never prevents later phases.
 * Escalation: retry same step → go back one step and retry both.
 *
 * App + store flow:
 *   Phase 1: uninstall app from store admin
 *   Phase 2: delete store (escalates to phase 1 on failure)
 *   Phase 3: delete app from dev dashboard (always runs)
 *
 * App-only flow:
 *   Phase 3 only
 */
export async function teardownAll(ctx: TeardownCtx): Promise<void> {
  const wCtx = {workerIndex: ctx.workerIndex ?? 0}
  const page = ctx.browserPage

  // Phase 1 + 2: Store cleanup (app+store tests only)
  if (ctx.storeFqdn) {
    const storeSlug = ctx.storeFqdn.replace('.myshopify.com', '')
    e2eSection(wCtx, `Teardown: store ${ctx.storeFqdn}`)

    // Phase 1: Uninstall app from store
    let uninstalled = false
    log.log(wCtx, 'uninstalling app from store')
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        uninstalled = await uninstallAppFromStore(page, storeSlug, ctx.appName)
        if (uninstalled) {
          log.log(wCtx, 'app uninstalled')
          break
        }
        log.log(wCtx, `(${attempt}/3) app uninstall attempt failed, app still visible`)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err) {
        log.log(wCtx, `(${attempt}/3) app uninstall attempt failed: ${err instanceof Error ? err.message : err}`)
      }
    }
    if (!uninstalled) {
      log.error(wCtx, 'app uninstall failed after 3 attempts')
    }

    // Phase 2: Delete store
    log.log(wCtx, 'deleting store')
    let storeDeleted = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Navigate to apps page to check state
        await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
          waitUntil: 'domcontentloaded',
        })
        await page.waitForTimeout(BROWSER_TIMEOUT.long)

        // Store already deleted?
        if (page.url().includes('access_account')) {
          log.log(wCtx, 'store already deleted')
          storeDeleted = true
          break
        }

        await dismissDevConsole(page)

        // Apps still installed? Reload once in case page is stale
        if (!(await isStoreAppsEmpty(page))) {
          await page.reload({waitUntil: 'domcontentloaded'})
          await page.waitForTimeout(BROWSER_TIMEOUT.long)
          await dismissDevConsole(page)
          if (!(await isStoreAppsEmpty(page))) {
            log.error(wCtx, 'store still has apps installed, skipping delete')
            break
          }
        }

        // Safe to delete
        const deleted = await deleteStore(page, storeSlug)
        if (deleted) {
          log.log(wCtx, 'store deleted')
          storeDeleted = true
          break
        }
        log.log(wCtx, `(${attempt}/3) store deletion failed`)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err) {
        log.log(wCtx, `(${attempt}/3) store deletion failed: ${err instanceof Error ? err.message : err}`)
      }
    }
    if (!storeDeleted) {
      log.error(wCtx, 'store deletion failed after 3 attempts')
    }
  }

  // Phase 3: Delete app from dev dashboard — ALWAYS runs
  e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
  log.log(wCtx, 'deleting app')
  let appDeleted = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const appUrl = await findAppOnDevDashboard(page, ctx.appName, ctx.orgId)
      if (!appUrl) {
        // Check if the page actually loaded — a 500/502 page also returns null
        if (await refreshIfPageError(page)) {
          log.log(wCtx, `page error, refreshing...`)
          continue
        }
        // Page loaded correctly and app wasn't found = already deleted
        log.log(wCtx, 'app already deleted')
        appDeleted = true
        break
      }
      log.log(wCtx, 'app found, deleting')
      const deleted = await deleteAppFromDevDashboard(page, appUrl)
      if (deleted) {
        log.log(wCtx, 'app deleted')
        appDeleted = true
        break
      }
      log.log(wCtx, `(${attempt}/3) app deletion failed`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      log.log(wCtx, `(${attempt}/3) app deletion failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  if (!appDeleted) {
    log.error(wCtx, 'app deletion failed after 3 attempts')
  }
}
