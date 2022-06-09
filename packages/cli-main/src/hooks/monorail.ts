import {reportEvent} from '../services/monorail'
import {Hook} from '@oclif/core'
import {environment, output} from '@shopify/cli-kit'

export const hook: Hook.Postrun = async (options) => {
  try {
    const command = options.Command.id.replace(/:/g, ' ')
    if (environment.local.isProduction() && environment.local.analyticsEnabled()) {
      await reportEvent(command, options.argv)
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    output.debug('Failed to report usage analytics')
  }
}
