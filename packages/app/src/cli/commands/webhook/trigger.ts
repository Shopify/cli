import WebhookTrigger from '../app/webhook/trigger.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export default class WebhookTriggerDeprecated extends WebhookTrigger {
  static hidden = true

  async run() {
    renderWarning({
      body: [
        {command: 'webhook trigger'},
        'is now under the "app" topic. Use',
        {command: 'app webhook trigger'},
        'instead.',
        'This alias will be removed in a future release.',
      ],
    })
    return super.run()
  }
}
