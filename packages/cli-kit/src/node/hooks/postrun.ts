import {reportEvent} from '../../analytics.js'
import {Hook} from '@oclif/core'
import {output} from '@shopify/cli-kit'

// This hook is called after each successful command run. More info: https://oclif.io/docs/hooks
export const hookPost: Hook.Postrun = async (options) => {
  await reportEvent()
  const command = options.Command.id.replace(/:/g, ' ')
  output.debug(`Completed command ${command}`)
}
