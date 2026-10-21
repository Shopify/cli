import {uninstallAppWithAdminApi} from './admin-api.js'
import {createLogger, e2eSection} from './env.js'
import type {CLIProcess} from './cli.js'
import type {DevDashboardClient} from './dashboard.js'

const log = createLogger('teardown')

interface BaseTeardownCtx {
  dashboard: Pick<DevDashboardClient, 'deleteApp'>
  appName: string
  /** Expected app URL, checked against the app found by its exact name. */
  appUrl?: string
  /** Local app directory used to clean the preview and uninstall through the Admin API. */
  appDir?: string
  workerIndex?: number
}

type TeardownCtx = BaseTeardownCtx &
  ({storeFqdn: string; orgId: string; cli: CLIProcess} | {storeFqdn?: undefined; orgId?: string; cli?: CLIProcess})

/**
 * Stop owned processes, then attempt each remote cleanup step independently.
 * Remote cleanup failures are reported without preventing reuse of the store.
 */
export async function teardownAll(ctx: TeardownCtx): Promise<void> {
  const wCtx = {workerIndex: ctx.workerIndex ?? 0}
  await ctx.cli?.stopAll()
  let uninstallConfirmed = false

  if (ctx.storeFqdn && ctx.appDir) {
    const {cli, appDir, storeFqdn} = ctx
    e2eSection(wCtx, `Teardown: app ${ctx.appName} on ${storeFqdn}`)
    await attemptRemoteCleanup(ctx, 'preview removal', async () => {
      const result = await cli.exec(['app', 'dev', 'clean', '--path', appDir, '--store', storeFqdn, '--json'])
      if (result.exitCode !== 0 || JSON.parse(result.stdout).status !== 'success') {
        throw new Error(`Failed to clean the dev preview:\n${result.stdout}\n${result.stderr}`)
      }
    })
    await attemptRemoteCleanup(ctx, 'app uninstall', async () => {
      await uninstallAppWithAdminApi({cli, appDir, storeFqdn})
      uninstallConfirmed = true
    })
  }

  e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
  await attemptRemoteCleanup(ctx, 'app deletion', async () => {
    await ctx.dashboard.deleteApp({name: ctx.appName, url: ctx.appUrl, uninstallConfirmed})
    log.log(wCtx, 'app deletion confirmed')
  })
}

async function attemptRemoteCleanup(ctx: TeardownCtx, phase: string, cleanup: () => Promise<void>): Promise<void> {
  try {
    await cleanup()
    // eslint-disable-next-line no-catch-all/no-catch-all -- Remote cleanup failures must not prevent later cleanup or store reuse.
  } catch (error) {
    const store = ctx.storeFqdn ? ` on ${ctx.storeFqdn}` : ''
    // eslint-disable-next-line no-console -- Cleanup failures must be visible even when DEBUG is disabled.
    console.warn(
      `[e2e][w${ctx.workerIndex ?? 0}][cleanup] ${phase} failed for ${ctx.appName}${store}: ${
        error instanceof Error ? error.message : String(error)
      }. Recover this app with cleanup-apps.ts --pattern "${ctx.appName}".`,
    )
  }
}
