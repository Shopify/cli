import {postrun as deprecationsHook} from './deprecations.js'
import {reportAnalyticsEvent} from '../analytics.js'
import {outputDebug, outputWarn} from '../output.js'
import {getOutputUpdateCLIReminder, runCLIUpgrade, versionToAutoUpgrade, warnIfUpgradeAvailable} from '../upgrade.js'
import {inferPackageManagerForGlobalCLI} from '../is-global.js'
import BaseCommand from '../base-command.js'
import * as metadata from '../metadata.js'
import {runAtMinimumInterval} from '../../../private/node/conf-store.js'
import {CLI_KIT_VERSION} from '../../common/version.js'
import {isMajorVersionChange} from '../version.js'
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

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await detectStopCommand(Command as unknown as typeof Command)
  await reportAnalyticsEvent({config, exitMode: 'ok'})
  deprecationsHook(Command)

  const command = Command.id.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)
  postRunHookCompleted = true

  if (!command.includes('notifications') && !command.includes('upgrade')) {
    try {
      await autoUpgradeIfNeeded()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputDebug(`Auto-upgrade check failed: ${error}`)
    }
  }
}

/**
 * Auto-upgrades the CLI after a command completes, if a newer version is available.
 * The entire flow is rate-limited to once per day unless forced via SHOPIFY_CLI_FORCE_AUTO_UPGRADE.
 *
 * @returns Resolves when the upgrade attempt (or fallback warning) is complete.
 */
export async function autoUpgradeIfNeeded(): Promise<void> {
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
    // Rate-limit the entire upgrade flow to once per day to avoid repeated attempts and major-version warnings.
    await runAtMinimumInterval('auto-upgrade', {days: 1}, async () => {
      await performAutoUpgrade(newerVersion)
    })
  }
}

async function performAutoUpgrade(newerVersion: string): Promise<void> {
  if (isMajorVersionChange(CLI_KIT_VERSION, newerVersion)) {
    return outputWarn(getOutputUpdateCLIReminder(newerVersion))
  }

  try {
    await runCLIUpgrade()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const errorMessage = `Auto-upgrade failed: ${error}`
    outputDebug(errorMessage)
    outputWarn(getOutputUpdateCLIReminder(newerVersion))
    // Report to Observe as a handled error without showing anything extra to the user
    const {sendErrorToBugsnag} = await import('../error-handler.js')
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
 * @param commandClass - Oclif command class.
 */
async function detectStopCommand(commandClass: Command.Class | typeof BaseCommand): Promise<void> {
  const currentTime = new Date().getTime()
  if (commandClass && Object.prototype.hasOwnProperty.call(commandClass, 'analyticsStopCommand')) {
    const stopCommand = (commandClass as typeof BaseCommand).analyticsStopCommand()
    if (stopCommand) {
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
