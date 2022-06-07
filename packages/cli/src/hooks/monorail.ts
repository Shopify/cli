import {buildPayload} from '../services/monorail'
import {Hook} from '@oclif/core'
import {Monorail, RetryMiddleware} from '@shopify/monorail'
import {environment, output} from '@shopify/cli-kit'

export const hook: Hook.Postrun = async (options) => {
  try {
    const monorail =
      process.env.NODE_ENV === 'production'
        ? Monorail.createHttpProducer({production: true, middleware: [new RetryMiddleware(3, 150)]})
        : Monorail.createLogProducer({debugMode: environment.local.isVerbose()})
    const schemaId = 'app_cli3_command/1.0'
    const command = options.Command.id.replace(/:/g, ' ')
    const payload = await buildPayload(command, options.argv)

    monorail.produce({schemaId, payload})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    output.debug('Failed to report usage analytics')
  }
}
