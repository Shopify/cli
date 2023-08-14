import {postrun as deprecationsHook} from './deprecations.js'
import {reportAnalyticsEvent} from '../analytics.js'
import {outputDebug} from '../../../public/node/output.js'
import BaseCommand from '../base-command.js'
import * as metadata from '../../../public/node/metadata.js'
import {Command, Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async ({config, Command}) => {
  await detectStopCommand(Command as unknown as typeof Command)
  await reportAnalyticsEvent({config})
  deprecationsHook(Command)

  const command = Command?.id?.replace(/:/g, ' ')
  outputDebug(`Completed command ${command}`)
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
      await metadata.addSensitiveMetadata(() => ({
        commandStartOptions: {
          ...commandStartOptions!,
          startTime: currentTime,
          startCommand: stopCommand,
        },
      }))
    }
  }
}
