/* eslint-disable no-await-in-loop */
import {uninstallAppWithAdminApi} from './admin-api.js'
import {waitForAppDeletionReadiness} from './app-management-api.js'
import {deleteAppFromDevDashboard, extractClientId} from './app.js'
import {e2eSection} from './env.js'
import {BROWSER_TIMEOUT} from './constants.js'
import {deleteDevStoreWithCli} from './store.js'
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

interface CleanupPhaseRecord {
  phase: CleanupPhase
  status: 'completed' | 'failed' | 'skipped'
  detail: string
}

type CleanupPhase = 'uninstall-app' | 'wait-for-zero-installs' | 'delete-app' | 'delete-store'

/**
 * Best-effort per-test teardown.
 *
 * Store-backed tests use this order:
 * uninstall app, wait for zero installs, delete app, then delete store.
 * Every phase records its own result and teardown never replaces the test result.
 */
export async function teardownAll(context: TeardownContext): Promise<void> {
  const {workerIndex} = context.env
  const clientId = resolveClientId(context)
  const storeContext = hasStore(context) ? context : undefined
  e2eSection({workerIndex}, `Teardown: app ${context.appName}`)

  if (storeContext) {
    const {appDir} = storeContext
    if (appDir) {
      await runCleanupPhase(workerIndex, 'uninstall-app', 'app uninstalled', () =>
        uninstallAppWithAdminApi({
          cli: storeContext.cli,
          appDir,
          storeFqdn: storeContext.storeFqdn,
        }),
      )
    } else {
      recordCleanupPhase(workerIndex, {
        phase: 'uninstall-app',
        status: 'skipped',
        detail: 'app directory unavailable',
      })
    }
  }

  let readiness
  try {
    readiness = await waitForAppDeletionReadiness(context.env.processEnv, {
      appName: context.appName,
      clientId,
      orgId: context.env.orgId,
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    recordCleanupPhase(workerIndex, {
      phase: 'wait-for-zero-installs',
      status: 'failed',
      detail: errorMessage(error),
    })
    recordSkippedDeletion(workerIndex, Boolean(storeContext), 'installation state is unknown')
    return
  }

  if (readiness.status === 'still-installed') {
    recordCleanupPhase(workerIndex, {
      phase: 'wait-for-zero-installs',
      status: 'failed',
      detail: `app still has ${readiness.installCount} install(s)`,
    })
    recordSkippedDeletion(workerIndex, Boolean(storeContext), 'app still has installs')
    return
  }

  recordCleanupPhase(workerIndex, {
    phase: 'wait-for-zero-installs',
    status: 'completed',
    detail: readiness.status === 'already-deleted' ? 'app already deleted' : 'app has zero installs',
  })

  let appDeleted = true
  if (readiness.status === 'already-deleted') {
    recordCleanupPhase(workerIndex, {phase: 'delete-app', status: 'completed', detail: 'app already deleted'})
  } else {
    appDeleted = await runCleanupPhase(workerIndex, 'delete-app', 'app deleted', () =>
      deleteAppWithRetry(context, readiness.app),
    )
  }

  if (!appDeleted) {
    if (storeContext) {
      recordCleanupPhase(workerIndex, {phase: 'delete-store', status: 'skipped', detail: 'app deletion failed'})
    }
    return
  }

  if (storeContext) {
    await runCleanupPhase(workerIndex, 'delete-store', 'store deletion requested', () =>
      deleteStoreWithRetry(storeContext),
    )
  }
}

function hasStore(context: TeardownContext): context is StoreTeardownContext {
  return context.storeFqdn !== undefined
}

async function runCleanupPhase(
  workerIndex: number,
  phase: CleanupPhase,
  detail: string,
  operation: () => Promise<void>,
): Promise<boolean> {
  try {
    await operation()
    recordCleanupPhase(workerIndex, {phase, status: 'completed', detail})
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    recordCleanupPhase(workerIndex, {phase, status: 'failed', detail: errorMessage(error)})
    return false
  }
}

function recordSkippedDeletion(workerIndex: number, hasStore: boolean, detail: string): void {
  recordCleanupPhase(workerIndex, {phase: 'delete-app', status: 'skipped', detail})
  if (hasStore) recordCleanupPhase(workerIndex, {phase: 'delete-store', status: 'skipped', detail})
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function deleteAppWithRetry(context: TeardownContext, app: {id: string; key: string}): Promise<void> {
  const numericAppId = app.id.match(/(\d+)$/)?.[1]
  // The dashboard exposes the Delete button on its numeric app route. Keep the
  // client-key URL only as a fallback when the API does not return a numeric GID.
  const appUrl =
    numericAppId && context.env.orgId
      ? `https://dev.shopify.com/dashboard/${context.env.orgId}/apps/${numericAppId}`
      : (context.appUrl ?? `https://dev.shopify.com/dashboard/${context.env.orgId}/apps/${app.key}`)

  await retryCleanup(
    async () => {
      if (!(await deleteAppFromDevDashboard(context.browserPage, appUrl))) {
        throw new Error('app deletion was not confirmed')
      }
    },
    () => context.browserPage.waitForTimeout(BROWSER_TIMEOUT.medium),
  )
}

async function deleteStoreWithRetry(context: StoreTeardownContext): Promise<void> {
  await retryCleanup(async () => {
    await deleteDevStoreWithCli({
      cli: context.cli,
      storeFqdn: context.storeFqdn,
      orgId: context.env.orgId,
    })
  })
}

async function retryCleanup(operation: () => Promise<void>, waitBeforeRetry?: () => Promise<void>): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await operation()
      return
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      lastError = error
    }

    if (attempt < 3) await waitBeforeRetry?.()
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
