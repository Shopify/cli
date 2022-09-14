import {start} from '../../analytics.js'
import {debug} from '../../output.js'
import Command from '../base-command.js'
import {Hook} from '@oclif/core'

// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (options) => {
  const cmd = options.Command.aliases.length === 0 ? options.Command.id : options.Command.aliases[0]!
  const command = cmd.replace(/:/g, ' ')
  const args = options.argv
  debug(`Running command ${command}`)
  await start({command, args, commandClass: options.Command as unknown as typeof Command})
}
