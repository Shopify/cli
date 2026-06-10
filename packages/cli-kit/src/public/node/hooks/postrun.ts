/**
 * Postrun hook — uses dynamic imports to avoid loading heavy modules (base-command, analytics)
 * at module evaluation time. These are only needed after the command has already finished.
 */
import {treeKill} from '../tree-kill.js'
import {Command, Hook} from '@oclif/core'

let postRunHookCompleted = false

/**
 * Check if post run hook has completed.
 *
 * @returns Whether post run hook has completed.
 */
export function postRunHookHasCompleted(): boolean {
  return postRunHookCompleted
}

/**
 * Wait for the postrun hook to finish (so auto-upgrade has a chance to run) and then
 * tree-kill the current process tree before exiting.
 *
 * Long-running interactive commands like `app dev` need this when the user terminates
 * the command via `q` or Ctrl+C. The dev sub-processes such as servers and watchers keep
 * the event loop alive, so even after oclif's postrun hook completes the node process
 * won't exit on its own and we have to `treeKill` the process tree. We must not do that
 * before the postrun hook has actually finished running auto-upgrade, otherwise we would
 * kill the upgrade mid-way while `npm install` is still running.
 *
 * The flag `postRunHookCompleted` is flipped at the very end of the hook after
 * `autoUpgradeIfNeeded` resolves, so polling it here is safe.
 */
export function waitForPostRunHookAndExit(): void {
  const pollIntervalMs = 100
  // Auto-upgrade can take a while (npm/pnpm/yarn install). Cap the wait generously so
  // a stuck upgrade still terminates the process eventually.
  const maxWaitMs = 120000

  let elapsed = 0
  let terminating = false
  const handle = setInterval(() => {
    if (terminating) return
    if (postRunHookHasCompleted() || elapsed >= maxWaitMs) {
      terminating = true
      clearInterval(handle)
      treeKill(process.pid, 'SIGINT', false, () => {
        process.exit(0)
      })
      return
    }
    elapsed += pollIntervalMs
  }, pollIntervalMs)
}

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await detectStopCommand(Command as unknown as typeof Command)

  const {reportAnalyticsEvent} = await import('../analytics.js')
  await reportAnalyticsEvent({config, exitMode: 'ok'})

  const {postrun: deprecationsHook} = await import('./deprecations.js')
  deprecationsHook(Command)

  const {outputDebug} = await import('../output.js')
  const command = Command.id.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)

  if (!command.includes('notifications') && !command.includes('upgrade') && !command.includes('send-analytics'))
    await autoUpgradeIfNeeded()
  postRunHookCompleted = true
}

/**
 * Auto-upgrades the CLI after a command completes, if a newer version is available.
 * The entire flow is rate-limited to once per day unless forced via SHOPIFY_CLI_FORCE_AUTO_UPGRADE.
 *
 * @returns Resolves when the upgrade attempt (or fallback warning) is complete.
 */
export async function autoUpgradeIfNeeded(): Promise<void> {
  const {versionToAutoUpgrade, warnIfUpgradeAvailable} = await import('../upgrade.js')
  const newerVersion = versionToAutoUpgrade()
  if (!newerVersion) {
    await warnIfUpgradeAvailable()
    return
  }

  const forced = process.env.SHOPIFY_CLI_FORCE_AUTO_UPGRADE === '1'

  // SHOPIFY_CLI_FORCE_AUTO_UPGRADE bypasses the daily rate limit so tests and intentional upgrades always run.
  if (forced) {
    await performAutoUpgrade(newerVersion)
  } else {
    const {runAtMinimumInterval} = await import('../../../private/node/conf-store.js')
    // Rate-limit the entire upgrade flow to once per day to avoid repeated attempts and major-version warnings.
    await runAtMinimumInterval('auto-upgrade', {days: 1}, async () => {
      await performAutoUpgrade(newerVersion)
    })
  }
}

async function performAutoUpgrade(newerVersion: string): Promise<void> {
  const [
    {CLI_KIT_VERSION},
    {isMajorVersionChange},
    {outputWarn, outputDebug},
    {getOutputUpdateCLIReminder, runCLIUpgrade, hasBlockingAutoUpgradeNotification},
    metadata,
  ] = await Promise.all([
    import('../../common/version.js'),
    import('../version.js'),
    import('../output.js'),
    import('../upgrade.js'),
    import('../metadata.js'),
  ])

  if (isMajorVersionChange(CLI_KIT_VERSION, newerVersion)) {
    outputWarn(getOutputUpdateCLIReminder(newerVersion, true))
    await metadata.addPublicMetadata(() => ({
      env_auto_upgrade_skipped_reason: 'major_version',
    }))
    return
  }

  // Notification kill switch: an `error`-type notification on the `autoupgrade` surface
  // silently disables auto-upgrade. Checked last — after every other gate, including the
  // daily rate limit and the major-version check — so the network fetch only happens when
  // we're about to actually run the upgrade.
  if (await hasBlockingAutoUpgradeNotification()) {
    await metadata.addPublicMetadata(() => ({
      env_auto_upgrade_skipped_reason: 'blocked_by_notification',
    }))
    return
  }

  try {
    await runCLIUpgrade({autoupgrade: true})
    await metadata.addPublicMetadata(() => ({env_auto_upgrade_success: true}))
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const errorMessage = `Auto-upgrade failed: ${error}`
    outputDebug(errorMessage)
    outputWarn(getOutputUpdateCLIReminder(newerVersion))
    await metadata.addPublicMetadata(() => ({env_auto_upgrade_success: false}))
    // Report to Observe as a handled error without showing anything extra to the user
    const [{sendErrorToBugsnag}, {inferPackageManagerForGlobalCLI}] = await Promise.all([
      import('../error-handler.js'),
      import('../is-global.js'),
    ])
    const enrichedError = Object.assign(new Error(errorMessage), {
      packageManager: inferPackageManagerForGlobalCLI(),
      platform: process.platform,
      cliVersion: CLI_KIT_VERSION,
    })
    await sendErrorToBugsnag(enrichedError, 'expected_error')
  }
}

/**
 * Override the command name with the stop one for analytics purposes.
 *
 * @param commandClass - Command.Class.
 */
async function detectStopCommand(commandClass: Command.Class): Promise<void> {
  const currentTime = new Date().getTime()
  // Check for analyticsStopCommand without importing BaseCommand
  if (
    commandClass &&
    'analyticsStopCommand' in commandClass &&
    typeof commandClass.analyticsStopCommand === 'function'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stopCommand = (commandClass as any).analyticsStopCommand()
    if (stopCommand) {
      const metadata = await import('../metadata.js')
      const {commandStartOptions} = metadata.getAllSensitiveMetadata()
      if (!commandStartOptions) return
      await metadata.addSensitiveMetadata(() => ({
        commandStartOptions: {
          ...commandStartOptions,
          startTime: currentTime,
          startCommand: stopCommand,
        },
      }))
    }
  }
}
