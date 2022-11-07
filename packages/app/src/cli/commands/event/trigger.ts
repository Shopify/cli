import {DELIVERY_METHOD} from '../../services/event/trigger-options.js'
import {EventTriggerFlags, optionsPrompt} from '../../prompts/event/options-prompt.js'
import {eventTriggerService} from '../../services/event/trigger.js'
import {deliveryMethodInstructions} from '../../prompts/event/trigger.js'
import {Command, Flags} from '@oclif/core'

export default class TopicTesting extends Command {
  static description = 'Trigger delivery of a sample event topic payload to a designated address'

  static flags = {
    help: Flags.help({
      required: false,
      hidden: false,
      char: 'h',
      env: 'SHOPIFY_FLAG_HELP',
      description: `This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using flags.`,
    }),
    topic: Flags.string({
      required: false,
      hidden: false,
      char: 't',
      env: 'SHOPIFY_FLAG_TOPIC',
      description: 'The requested event topic.',
    }),
    'api-version': Flags.string({
      required: false,
      hidden: false,
      char: 'v',
      env: 'SHOPIFY_FLAG_API_VERSION',
      description: 'The API Version of the event topic.',
    }),
    'delivery-method': Flags.string({
      required: false,
      hidden: false,
      char: 'm',
      options: [DELIVERY_METHOD.HTTP, DELIVERY_METHOD.PUBSUB, DELIVERY_METHOD.EVENTBRIDGE],
      env: 'SHOPIFY_FLAG_DELIVERY_METHOD',
      description: `Method chosen to deliver the topic payload. If not passed, it's inferred from the address`,
    }),
    'shared-secret': Flags.string({
      required: false,
      hidden: false,
      char: 's',
      env: 'SHOPIFY_FLAG_SHARED_SECRET',
      description: `Shared secret used to build the X-Shopify-Hmac-SHA256 header.`,
    }),
    address: Flags.string({
      required: false,
      hidden: false,
      char: 'a',
      env: 'SHOPIFY_FLAG_ADDRESS',
      description: `The URL where the webhook payload should be sent.
                    For each delivery-method you will need a different address type:
                     - ${DELIVERY_METHOD.HTTP}: ${deliveryMethodInstructions(DELIVERY_METHOD.HTTP)}
                     - ${DELIVERY_METHOD.PUBSUB}: ${deliveryMethodInstructions(DELIVERY_METHOD.PUBSUB)}
                     - ${DELIVERY_METHOD.EVENTBRIDGE}: ${deliveryMethodInstructions(DELIVERY_METHOD.EVENTBRIDGE)}`,
    }),
  }

  public async run() {
    const {flags} = await this.parse(TopicTesting)

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
