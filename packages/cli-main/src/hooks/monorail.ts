import {reportEvent} from '../services/monorail'
import {Hook} from '@oclif/core'
import {environment, output} from '@shopify/cli-kit'

export const hook: Hook.Postrun = async (options) => {
  try {
    if (environment.local.isDebug() || environment.local.analyticsDisabled()) {
      return
    }
    const command = options.Command.id.replace(/:/g, ' ')
    await reportEvent(command, options.argv)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const message = 'Failed to report usage analytics'
    if (error instanceof Error) {
      message.concat(`: ${error.message}`)
    }
    output.debug(message)
  }
}
