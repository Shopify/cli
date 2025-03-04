import {list} from '../../services/commands/notifications.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {sendErrorToBugsnag} from '@shopify/cli-kit/node/error-handler'

export default class List extends Command {
  static description = 'List current notifications configured for the CLI.'
  static hidden = true

  static flags = {
    'ignore-errors': Flags.boolean({
      hidden: false,
      description: "Don't fail if an error occurs.",
      env: 'SHOPIFY_FLAG_IGNORE_ERRORS',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    try {
      await list()
    } catch (error) {
      let message = `Error fetching notifications`
      if (error instanceof Error) {
        message = message.concat(`: ${error.message}`)
      }
      await sendErrorToBugsnag(message, 'expected_error')
      if (!flags['ignore-errors']) {
        throw error
      }
    }
  }
}
