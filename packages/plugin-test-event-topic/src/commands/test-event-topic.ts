import {
  requestSample,
  sendLocal,
  collectCliOptions,
  DELIVERY_METHOD,
  TestWebhookFlags,
} from '../services/test-event-topic.js'
import {Command, Flags} from '@oclif/core'
import {output} from '@shopify/cli-kit'

export default class TopicTesting extends Command {
  static description = 'Trigger sample event topic payload to be sent to a designated address.'

  static flags = {
    help: Flags.help({
      required: false,
      hidden: false,
      char: 'h',
      description: `CLI test-event-topic help:
        The command will prompt for any values not passed as command-line arguments.
        For security reasons Shared Secret is not allowed via flags.
        SHOPIFY_FLAG_SHARED_SECRET env variable can be used to avoid interactive prompt.`,
      env: 'SHOPIFY_FLAG_HELP',
    }),
    topic: Flags.string({
      required: false,
      hidden: false,
      char: 't',
      description: 'Requested event topic.',
      env: 'SHOPIFY_FLAG_TOPIC',
    }),
    'api-version': Flags.string({
      required: false,
      hidden: false,
      char: 'v',
      description: 'Event tpic API Version.',
      env: 'SHOPIFY_FLAG_API_VERSION',
    }),
    'delivery-method': Flags.string({
      required: false,
      hidden: false,
      char: 'm',
      options: [DELIVERY_METHOD.CONSOLE, DELIVERY_METHOD.HTTP, DELIVERY_METHOD.PUBSUB, DELIVERY_METHOD.EVENTBRIDGE],
      description: `Method chosen to deliver the topic payload.`,
      env: 'SHOPIFY_FLAG_DELIVERY_METHOD',
    }),
    address: Flags.string({
      required: false,
      hidden: false,
      char: 'a',
      description: `Destination url (only for ${DELIVERY_METHOD.HTTP}, ${DELIVERY_METHOD.PUBSUB} or ${DELIVERY_METHOD.EVENTBRIDGE} delivery methods).`,
      env: 'SHOPIFY_FLAG_ADDRESS',
    }),
    port: Flags.string({
      hidden: false,
      description: `Destination port (only for ${DELIVERY_METHOD.HTTP} delivery method when address is localhost).`,
      env: 'SHOPIFY_FLAG_PORT',
    }),
    'url-path': Flags.string({
      hidden: false,
      description: `Endpoint path (only for ${DELIVERY_METHOD.HTTP} delivery method when address is localhost).`,
      env: 'SHOPIFY_FLAG_URL_PATH',
    }),
  }

  public async run() {
    const {flags} = await this.parse(TopicTesting)

    const usedFlags: TestWebhookFlags = {
      topic: flags.topic,
      apiVersion: flags['api-version'],
      deliveryMethod: flags['delivery-method'],
      address: flags.address,
      port: flags.port,
      urlPath: flags['url-path'],
    }

    const options = await collectCliOptions(usedFlags)

    const sample = await requestSample(
      options.topic,
      options.apiVersion,
      options.deliveryMethod,
      options.address,
      options.sharedSecret,
    )

    if (!sample.success) {
      // await output.error(new error.Abort(JSON.stringify(sample.userErrors)));
      output.consoleError(JSON.stringify(sample.userErrors))
      return
    }

    if (options.deliveryMethod === DELIVERY_METHOD.CONSOLE) {
      output.info(sample.samplePayload)
      return
    }

    if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
      const result = await sendLocal(options.address, sample.samplePayload, sample.headers)

      if (result) {
        output.success('Localhost delivery sucessful')
        return
      }

      // await output.error(new error.Abort("Localhost delivery failed"));
      output.consoleError('Localhost delivery failed')
      return
    }

    if (sample.samplePayload === JSON.stringify({})) {
      output.success('Webhook will be delivered shortly')
    }
  }
}
