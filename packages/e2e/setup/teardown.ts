/* eslint-disable no-await-in-loop */
import {uninstallAppWithAdminApi} from './admin-api.js'
import {findAppByClientId, findAppByName, appInstallCount, waitForZeroInstalls} from './app-management-api.js'
import {deleteAppFromDevDashboard, extractClientId} from './app.js'
import {createLogger, e2eSection} from './env.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {deleteDevStoreWithCli} from './store.js'
import type {AppManagementApp} from './app-management-api.js'
import type {CLIProcess} from './cli.js'
import type {E2EEnv} from './env.js'
import type {Page} from '@playwright/test'

const log = createLogger('teardown')

interface BaseTeardownCtx {
  browserPage: Page
  appName: string
  env: E2EEnv
  /** Direct Dev Dashboard app URL. Prefer this when available to avoid an app search by name. */
  appUrl?: string
}

type TeardownCtx = BaseTeardownCtx &
  (
    | {storeFqdn: string; cli: CLIProcess; appDir: string | undefined}
    | {storeFqdn?: undefined; cli?: CLIProcess; appDir?: string}
  )

/**
 * Best-effort per-test teardown. Each phase retries up to 3 times.
 *
 * App + store flow:
 *   Phase 1: uninstall app from store over the Admin API
 *   Phase 2: delete store (skipped until the app reports zero installs)
 *   Phase 3: delete app from dev dashboard (browser — the App Management API
 *            has no delete mutation)
 *
 * App-only flow:
 *   Phase 3 only
 *
 * The app's identity and install state come from the App Management API; the
 * browser is only used for the final delete click.
 */
export async function teardownAll(ctx: TeardownCtx): Promise<void> {
  const wCtx = {workerIndex: ctx.env.workerIndex}
  const sessionEnv = ctx.env.processEnv

  // Resolve the app via the App Management API. `undefined` app after a
  // successful lookup means it does not exist (already deleted).
  let app: AppManagementApp | undefined
  let appResolved = false
  const clientId = resolveClientId(ctx)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (clientId && ctx.env.orgId) {
        app = await findAppByClientId(sessionEnv, clientId, ctx.env.orgId)
      }
      if (!app && ctx.env.orgId) {
        app = await findAppByName(sessionEnv, ctx.appName, ctx.env.orgId)
      }
      appResolved = true
      break
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      log.log(wCtx, `(${attempt}/3) app lookup failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Phase 1: Uninstall app from store over the Admin API (app+store tests
  // only). No browser fallback: an API failure must surface loudly so it gets
  // fixed instead of hiding behind a flaky store-admin click-through.
  if (ctx.storeFqdn) {
    e2eSection(wCtx, `Teardown: store ${ctx.storeFqdn}`)
    if (ctx.appDir) {
      log.log(wCtx, 'uninstalling app via admin API')
      await uninstallAppWithAdminApi({cli: ctx.cli, appDir: ctx.appDir, storeFqdn: ctx.storeFqdn})
      log.log(wCtx, 'app uninstalled via admin API')
    } else {
      // The test failed before createApp finished — nothing was installed.
      log.log(wCtx, 'no app dir, skipping uninstall')
    }
  }

  // Install state gates both store deletion (an install record would strand
  // the app in the Dev Dashboard) and app deletion (the Delete button stays
  // disabled while installs exist, so the browser flow would just spin).
  // Uninstall records clear asynchronously, hence the poll after uninstall.
  let installsCleared = false
  if (appResolved) {
    if (!app) {
      installsCleared = true
    } else if (ctx.storeFqdn) {
      installsCleared = await waitForZeroInstalls(sessionEnv, app.id)
    } else {
      installsCleared = (await appInstallCount(sessionEnv, app.id)) === 0
    }
  }

  // Phase 2: Delete store
  if (ctx.storeFqdn) {
    if (appResolved && installsCleared) {
      log.log(wCtx, 'deleting store')
      let storeDeletionRequested = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const deletionConfirmed = await deleteDevStoreWithCli({
            cli: ctx.cli,
            storeFqdn: ctx.storeFqdn,
            orgId: ctx.env.orgId,
          })
          log.log(wCtx, deletionConfirmed ? 'store deletion confirmed by CLI' : 'store deletion requested with CLI')
          storeDeletionRequested = true
          break
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (err) {
          log.log(wCtx, `(${attempt}/3) store deletion failed: ${err instanceof Error ? err.message : err}`)
        }
      }
      if (!storeDeletionRequested) {
        log.error(wCtx, 'store deletion request failed after 3 attempts')
      }
    } else {
      const reason = appResolved ? 'app still reports installs' : 'install state unknown (app lookup failed)'
      log.error(wCtx, `${reason}, skipping store delete`)
    }
  }

  // Phase 3: Delete app from dev dashboard
  e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
  if (!appResolved) {
    log.error(wCtx, 'skipping app delete — app lookup failed, run `pnpm test:e2e-cleanup-apps` after')
    return
  }
  if (!app) {
    log.log(wCtx, 'app already deleted')
    return
  }
  if (!installsCleared) {
    log.log(wCtx, 'app delete skipped — still has installs, run `pnpm test:e2e-cleanup-apps` after')
    return
  }

  const appUrl = ctx.appUrl ?? `https://dev.shopify.com/dashboard/${ctx.env.orgId}/apps/${app.key}`
  log.log(wCtx, 'deleting app')
  let appDeleted = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const deleted = await deleteAppFromDevDashboard(ctx.browserPage, appUrl)
      if (deleted) {
        log.log(wCtx, 'app deleted')
        appDeleted = true
        break
      }
      log.log(wCtx, `(${attempt}/3) app deletion failed`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      // Defense in depth: the API said zero installs, but the dashboard can
      // still show the Delete button disabled if a record lags behind.
      if (err instanceof Error && err.message === 'STILL_HAS_INSTALLS') {
        log.log(wCtx, 'app delete skipped — still has installs, run `pnpm test:e2e-cleanup-apps` after')
        return
      }
      log.log(wCtx, `(${attempt}/3) app deletion failed: ${err instanceof Error ? err.message : err}`)
    }
    await ctx.browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
  }
  if (!appDeleted) {
    log.error(wCtx, 'app deletion failed after 3 attempts')
  }
}

/**
 * The app's client_id: read from the local TOML when the app dir is known,
 * otherwise from the Dev Dashboard app URL. Dashboard URLs come in two
 * shapes — apps/[clientId] (built by devDashboardAppUrl) and
 * apps/[numericAppId] (parsed from deploy output) — and only the former is
 * usable as an API key, so numeric segments resolve via name search instead.
 */
function resolveClientId(ctx: TeardownCtx): string | undefined {
  if (ctx.appDir) {
    try {
      return extractClientId(ctx.appDir)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // TOML may be missing when the test failed before app creation.
    }
  }
  const urlSegment = ctx.appUrl?.match(/\/apps\/([^/?#]+)/)?.[1]
  return urlSegment && !/^\d+$/.test(urlSegment) ? urlSegment : undefined
}
