import Command from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {sendAnalyticsEventFromFile} from '@shopify/cli-kit/node/analytics'

export default class SendAnalytics extends Command {
  static hidden = true

  static flags = {
    'payload-file': Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_PAYLOAD_FILE',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SendAnalytics)
    await sendAnalyticsEventFromFile(flags['payload-file'])
  }
}
