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
 * Best-effort per-test teardown. Each phase retries up to 3 times.
 *
 * App + store flow:
 *   Phase 1: uninstall app from store admin
 *   Phase 2: delete store (skipped if phase 1 failed)
 *   Phase 3: delete app from dev dashboard (skipped if phase 1 failed)
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
    let safeToDelete = false

    // Gate: confirm the store has zero apps before attempting delete store.
    try {
      await page.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
        waitUntil: 'domcontentloaded',
      })
      await page.waitForTimeout(BROWSER_TIMEOUT.long)

      if (page.url().includes('access_account')) {
        log.log(wCtx, 'store already deleted')
        storeDeleted = true
      } else {
        await dismissDevConsole(page)
        // Reload once in case the page is stale (Phase 1 just uninstalled)
        if (!(await isStoreAppsEmpty(page))) {
          await page.reload({waitUntil: 'domcontentloaded'})
          await page.waitForTimeout(BROWSER_TIMEOUT.long)
          await dismissDevConsole(page)
        }
        if (await isStoreAppsEmpty(page)) {
          safeToDelete = true
        } else {
          log.error(wCtx, 'store has apps installed, skipping delete')
        }
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      log.error(wCtx, `store empty state unclear, skipping delete: ${err instanceof Error ? err.message : err}`)
    }

    if (safeToDelete) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (await deleteStore(page, storeSlug)) {
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

    // Gate: confirm the store has zero apps before attempting delete app.
    if (!uninstalled) {
      log.log(wCtx, 'skipping app delete — uninstall failed, run `pnpm test:e2e-cleanup-apps` after')
      return
    }
  }

  // Phase 3: Delete app from dev dashboard
  e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
  log.log(wCtx, 'deleting app')
  let appDeleted = false
  let stillHasInstalls = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const appUrl = await findAppOnDevDashboard(page, ctx.appName, ctx.orgId)
      if (!appUrl) {
        // null could mean "app not in the list" OR "pagination ended on a stuck error page"
        // — findAppOnDevDashboard's refresh-on-error doesn't cover every iteration.
        // Detect and retry so we don't misclassify an error page as "already deleted".
        if (await refreshIfPageError(page)) {
          log.log(wCtx, `page error, refreshing...`)
          continue
        }
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
      // Fail fast: Delete button stays disabled while installs exist — retries won't help.
      // cleanup-apps.ts reaps the orphan.
      if (err instanceof Error && err.message === 'STILL_HAS_INSTALLS') {
        log.log(wCtx, 'app delete skipped — still has installs, run `pnpm test:e2e-cleanup-apps` after')
        stillHasInstalls = true
        break
      }
      log.log(wCtx, `(${attempt}/3) app deletion failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  if (!appDeleted && !stillHasInstalls) {
    log.error(wCtx, 'app deletion failed after 3 attempts')
  }
}
