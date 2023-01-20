import {DELIVERY_METHOD, WebhookTriggerFlags} from '../../services/webhook/trigger-flags.js'
import {webhookTriggerService} from '../../services/webhook/trigger.js'
import {deliveryMethodInstructionsAsString} from '../../prompts/webhook/trigger.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export default class WebhookTrigger extends Command {
  static description = 'Trigger delivery of a sample webhook topic payload to a designated address.'

  static flags = {
    help: Flags.help({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_HELP',
      description: `This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using flags.`,
    }),
    topic: Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_TOPIC',
      description: 'The requested webhook topic.',
    }),
    'api-version': Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_API_VERSION',
      description: 'The API Version of the webhook topic.',
    }),
    'delivery-method': Flags.string({
      required: false,
      hidden: false,
      options: [DELIVERY_METHOD.HTTP, DELIVERY_METHOD.PUBSUB, DELIVERY_METHOD.EVENTBRIDGE],
      env: 'SHOPIFY_FLAG_DELIVERY_METHOD',
      description: `Method chosen to deliver the topic payload. If not passed, it's inferred from the address.`,
    }),
    'shared-secret': Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_SHARED_SECRET',
      description: `Deprecated. Please use client-secret.`,
    }),
    'client-secret': Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_CLIENT_SECRET',
      description: `Your app's client secret. This secret allows us to return the X-Shopify-Hmac-SHA256 header that lets you validate the origin of the response that you receive.`,
    }),
    address: Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_ADDRESS',
      description: `The URL where the webhook payload should be sent.
                    You will need a different address type for each delivery-method:
                    ${deliveryMethodInstructionsAsString(DELIVERY_METHOD.HTTP)}
                    ${deliveryMethodInstructionsAsString(DELIVERY_METHOD.PUBSUB)}
                    ${deliveryMethodInstructionsAsString(DELIVERY_METHOD.EVENTBRIDGE)}`,
    }),
  }

  public async run() {
    const {flags} = await this.parse(WebhookTrigger)

    const usedFlags: WebhookTriggerFlags = {
      topic: flags.topic,
      apiVersion: flags['api-version'],
      deliveryMethod: flags['delivery-method'],
      address: flags.address,
      clientSecret: flags['client-secret'] || flags['shared-secret'],
    }
    if (flags['shared-secret']) {
      renderWarning({
        headline: [
          'The flag shared-secret has been deprecated in favor of client-secret and will eventually be deleted.',
        ],
        body: ['Please use --client-secret instead.'],
      })
    }

    await webhookTriggerService(usedFlags)
  }
}
