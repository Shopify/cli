import {DELIVERY_METHOD} from '../../services/event/trigger-options.js'
import {EventTriggerFlags, optionsPrompt} from '../../prompts/event/options-prompt.js'
import {eventTriggerService} from '../../services/event/trigger.js'
import {deliveryMethodInstructionsAsString} from '../../prompts/event/trigger.js'
import {Command, Flags} from '@oclif/core'

export default class EventTrigger extends Command {
  static hidden = true
  static description = 'Trigger delivery of a sample event topic payload to a designated address'

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
      description: 'The requested event topic.',
    }),
    'api-version': Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_API_VERSION',
      description: 'The API Version of the event topic.',
    }),
    'delivery-method': Flags.string({
      required: false,
      hidden: false,
      options: [DELIVERY_METHOD.HTTP, DELIVERY_METHOD.PUBSUB, DELIVERY_METHOD.EVENTBRIDGE],
      env: 'SHOPIFY_FLAG_DELIVERY_METHOD',
      description: `Method chosen to deliver the topic payload. If not passed, it's inferred from the address`,
    }),
    'shared-secret': Flags.string({
      required: false,
      hidden: false,
      env: 'SHOPIFY_FLAG_SHARED_SECRET',
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
    const {flags} = await this.parse(EventTrigger)

    const usedFlags: EventTriggerFlags = {
      topic: flags.topic,
      apiVersion: flags['api-version'],
      deliveryMethod: flags['delivery-method'],
      address: flags.address,
      sharedSecret: flags['shared-secret'],
    }

    const options = await optionsPrompt(usedFlags)

    await eventTriggerService(options)
  }
}
