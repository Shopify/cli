import {reportEvent} from '../services/monorail'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async (options) => {
  const command = options.Command.id.replace(/:/g, ' ')
  await reportEvent(command, options.argv)
}
