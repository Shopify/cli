import {output} from '@shopify/cli-kit'
import {Hook} from '@oclif/core'

export const hook: Hook.Init = async (options) => {
  output.initiateLogging({filename: 'shopify.cli.log'})
  const command = options.id.replace(/:/g, ' ')
  output.debug(`Running command ${command}`, true)
}
