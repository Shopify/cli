import {uninstallAppWithAdminApi} from './admin-api.js'
import {createLogger, e2eSection} from './env.js'
import {findAppOnDevDashboard, deleteAppFromDevDashboard} from './app.js'
import type {CLIProcess} from './cli.js'
import type {Page} from '@playwright/test'

const log = createLogger('teardown')

interface BaseTeardownCtx {
  browserPage: Page
  appName: string
  /** Direct dashboard URL for app cleanup. */
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

  if (ctx.storeFqdn && ctx.appDir) {
    const {cli, appDir, storeFqdn} = ctx
    e2eSection(wCtx, `Teardown: app ${ctx.appName} on ${storeFqdn}`)
    await attemptRemoteCleanup(ctx, 'preview removal', async () => {
      const result = await cli.exec(['app', 'dev', 'clean', '--path', appDir, '--store', storeFqdn, '--json'])
      if (result.exitCode !== 0 || JSON.parse(result.stdout).status !== 'success') {
        throw new Error(`Failed to clean the dev preview:\n${result.stdout}\n${result.stderr}`)
      }
    })
    await attemptRemoteCleanup(ctx, 'app uninstall', () => uninstallAppWithAdminApi({cli, appDir, storeFqdn}))
  }

  e2eSection(wCtx, `Teardown: app ${ctx.appName}`)
  await attemptRemoteCleanup(ctx, 'app deletion', async () => {
    const appUrl = ctx.appUrl ?? (await findAppOnDevDashboard(ctx.browserPage, ctx.appName, ctx.orgId))
    if (appUrl && !(await deleteAppFromDevDashboard(ctx.browserPage, appUrl))) {
      throw new Error('App deletion was not confirmed')
    }
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
