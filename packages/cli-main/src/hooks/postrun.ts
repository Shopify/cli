import {analytics} from '@shopify/cli-kit'
import {Hook} from '@oclif/core'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Postrun = async (options) => {
  const command = options.Command.id.replace(/:/g, ' ')
  await analytics.reportEvent(command, options.argv)
}
