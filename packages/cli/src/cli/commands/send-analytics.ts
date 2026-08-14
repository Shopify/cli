import Command from '@shopify/cli-kit/node/base-command'
import {sendAnalyticsEventFromStdin} from '@shopify/cli-kit/node/analytics'

export default class SendAnalytics extends Command {
  static hidden = true

  async run(): Promise<void> {
    await sendAnalyticsEventFromStdin()
  }
}
