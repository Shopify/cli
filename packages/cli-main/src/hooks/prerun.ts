import {analytics} from '@shopify/cli-kit'
import {Hook} from '@oclif/core'

// This hook is called before each command run. More info: https://oclif.io/docs/hooks
export const hook: Hook.Prerun = async (options) => {
  const command = options.Command.id.replace(/:/g, ' ')
  const args = options.argv.join(' ')
  analytics.start({command, args})
}
