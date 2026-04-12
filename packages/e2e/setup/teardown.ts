/* eslint-disable no-await-in-loop */
import {findAppOnDevDashboard, deleteAppFromDevDashboard} from './app.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {createLogger, e2eSection} from './env.js'
import {uninstallAppFromStoreAdmin, deleteStoreFromAdmin} from './store.js'
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
    try {
      log.log(wCtx, 'uninstalling app from store')
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          uninstalled = await uninstallAppFromStoreAdmin(page, storeSlug, ctx.appName)
          if (uninstalled) {
            log.log(wCtx, 'app uninstalled')
            break
          }
          log.log(wCtx, `uninstall not verified (${attempt}/3)`)
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (_err) {
          log.log(wCtx, `uninstall failed (${attempt}/3)`)
        }
        if (attempt < 3) {
          await page.goto('about:blank').catch(() => {})
          await page.waitForTimeout(BROWSER_TIMEOUT.short)
        }
      }
      if (!uninstalled) log.error(wCtx, 'uninstall failed after 3 attempts')
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      log.error(wCtx, `uninstall phase error: ${err instanceof Error ? err.message : err}`)
    }

    // Phase 2: Delete store (escalates to phase 1 on failure)
    try {
      log.log(wCtx, 'deleting store')
      let storeDeleted = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const deleted = await deleteStoreFromAdmin(page, storeSlug)
          if (deleted) {
            log.log(wCtx, 'store deleted')
            storeDeleted = true
            break
          }
          // deleteStoreFromAdmin returns false = apps still installed
          log.log(wCtx, `store has apps, escalating to re-uninstall (${attempt}/3)`)
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (_err) {
          log.log(wCtx, `store deletion failed (${attempt}/3)`)
        }
        if (attempt < 3) {
          // Escalate: go back to phase 1 (re-uninstall) then retry phase 2
          await page.goto('about:blank').catch(() => {})
          await page.waitForTimeout(BROWSER_TIMEOUT.short)
          try {
            await uninstallAppFromStoreAdmin(page, storeSlug, ctx.appName)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (_err) {
            // best effort
          }
        }
      }
      if (!storeDeleted) log.error(wCtx, 'store deletion failed after 3 attempts')
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      log.error(wCtx, `store delete phase error: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Phase 3: Delete app from dev dashboard — ALWAYS runs
  try {
    e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
    log.log(wCtx, 'deleting app')
    let appDeleted = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const appUrl = await findAppOnDevDashboard(page, ctx.appName, ctx.orgId)
        if (!appUrl) {
          // App not on dashboard = already deleted (possibly by a previous attempt)
          log.log(wCtx, 'app deleted')
          appDeleted = true
          break
        }
        const deleted = await deleteAppFromDevDashboard(page, appUrl)
        if (deleted) {
          log.log(wCtx, 'app deleted')
          appDeleted = true
          break
        }
        log.log(wCtx, `app delete pending, retrying (${attempt}/3)`)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_err) {
        log.log(wCtx, `app deletion failed (${attempt}/3)`)
      }
      if (attempt < 3) {
        await page.goto('about:blank').catch(() => {})
        await page.waitForTimeout(BROWSER_TIMEOUT.short)
      }
    }
    if (!appDeleted) log.error(wCtx, 'app deletion failed after 3 attempts')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    log.error(wCtx, `teardown: failed for ${ctx.appName}: ${err instanceof Error ? err.message : err}`)
  }
}
