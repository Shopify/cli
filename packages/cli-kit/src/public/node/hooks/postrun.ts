/**
 * Postrun hook — uses dynamic imports to avoid loading heavy modules (base-command, analytics)
 * at module evaluation time. These are only needed after the command has already finished.
 */
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

  const {reportAnalyticsEvent} = await import('../analytics.js')
  await reportAnalyticsEvent({config, exitMode: 'ok'})

  const {postrun: deprecationsHook} = await import('./deprecations.js')
  deprecationsHook(Command)

  const {outputDebug} = await import('../output.js')
  const command = Command.id.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)
  postRunHookCompleted = true
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
