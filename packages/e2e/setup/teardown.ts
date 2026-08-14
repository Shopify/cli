/* eslint-disable no-await-in-loop */
import {uninstallAppWithAdminApi} from './admin-api.js'
import {waitForAppDeletionReadiness} from './app-management-api.js'
import {deleteAppFromDevDashboard, extractClientId} from './app.js'
import {runTeardown} from './teardown-orchestrator.js'
import {e2eSection} from './env.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {deleteDevStoreWithCli} from './store.js'
import type {CleanupPhaseRecord} from './teardown-orchestrator.js'
import type {CLIProcess} from './cli.js'
import type {E2EEnv} from './env.js'
import type {Page} from '@playwright/test'

interface BaseTeardownContext {
  browserPage: Page
  appName: string
  env: E2EEnv
  appUrl?: string
}

type StoreTeardownContext = BaseTeardownContext & {
  storeFqdn: string
  cli: CLIProcess
  appDir: string | undefined
}

type TeardownContext = StoreTeardownContext | (BaseTeardownContext & {storeFqdn?: undefined; appDir?: string})

/**
 * Best-effort per-test teardown.
 *
 * Store-backed tests use this order:
 * uninstall app, wait for zero installs, delete app, then delete store.
 * Every phase records its own result and teardown never replaces the test result.
 */
export async function teardownAll(context: TeardownContext): Promise<void> {
  const workerContext = {workerIndex: context.env.workerIndex}
  const clientId = resolveClientId(context)
  const storeContext = hasStore(context) ? context : undefined
  const appDir = storeContext?.appDir

  e2eSection(workerContext, `Teardown: app ${context.appName}`)

  await runTeardown({
    hasStore: Boolean(storeContext),
    uninstallApp:
      storeContext && appDir
        ? () =>
            uninstallAppWithAdminApi({
              cli: storeContext.cli,
              appDir,
              storeFqdn: storeContext.storeFqdn,
            })
        : undefined,
    waitForAppDeletionReadiness: () =>
      waitForAppDeletionReadiness(context.env.processEnv, {
        appName: context.appName,
        clientId,
        orgId: context.env.orgId,
      }),
    deleteApp: (app) => deleteAppWithRetry(context, app),
    deleteStore: storeContext ? () => deleteStoreWithRetry(storeContext) : undefined,
    record: (record) => recordCleanupPhase(context.env.workerIndex, record),
  })
}

function hasStore(context: TeardownContext): context is StoreTeardownContext {
  return context.storeFqdn !== undefined
}

async function deleteAppWithRetry(context: TeardownContext, app: {id: string; key: string}): Promise<boolean> {
  const numericAppId = app.id.match(/(\d+)$/)?.[1]
  // The dashboard exposes the Delete button on its numeric app route. Keep the
  // client-key URL only as a fallback when the API does not return a numeric GID.
  const appUrl =
    numericAppId && context.env.orgId
      ? `https://dev.shopify.com/dashboard/${context.env.orgId}/apps/${numericAppId}`
      : (context.appUrl ?? `https://dev.shopify.com/dashboard/${context.env.orgId}/apps/${app.key}`)

  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (await deleteAppFromDevDashboard(context.browserPage, appUrl)) return true
      lastError = new Error('app deletion was not confirmed')
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      lastError = error
    }

    if (attempt < 3) {
      await context.browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function deleteStoreWithRetry(context: StoreTeardownContext): Promise<boolean> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await deleteDevStoreWithCli({
        cli: context.cli,
        storeFqdn: context.storeFqdn,
        orgId: context.env.orgId,
      })
      return true
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function recordCleanupPhase(workerIndex: number, record: CleanupPhaseRecord): void {
  const output = record.status === 'failed' ? process.stderr : process.stdout
  output.write(
    `[e2e][w${workerIndex}][teardown] phase=${record.phase} status=${record.status} detail=${record.detail}\n`,
  )
}

function resolveClientId(context: TeardownContext): string | undefined {
  if (context.appDir) {
    try {
      return extractClientId(context.appDir)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // The app TOML can be unavailable when setup failed partway through.
    }
  }

  const urlSegment = context.appUrl?.match(/\/apps\/([^/?#]+)/)?.[1]
  return urlSegment && !/^\d+$/.test(urlSegment) ? urlSegment : undefined
}
