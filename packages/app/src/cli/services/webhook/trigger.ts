import {DELIVERY_METHOD, WebhookTriggerOptions} from './trigger-options.js'
import {getWebhookSample, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {output} from '@shopify/cli-kit'

/**
 * Orchestrates the command request by requesting the sample and sending it to localhost if required.
 * It outputs the result in console
 *
 * @param options - Request options once the flags, prompts, and transformations have been performed
 */
export async function webhookTriggerService(options: WebhookTriggerOptions) {
  const sample = await getWebhookSample(
    options.topic,
    options.apiVersion,
    options.deliveryMethod,
    options.address,
    options.sharedSecret,
  )

  if (!sample.success) {
    await output.consoleError(`Request errors:\n${formatErrors(sample.userErrors)}`)
    return
  }

  if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(options.address, sample.samplePayload, sample.headers)

    if (result) {
      output.success('Localhost delivery sucessful')
      return
    }

    await output.consoleError('Localhost delivery failed')
    return
  }

  if (sample.samplePayload === JSON.stringify({})) {
    output.success('Webhook has been enqueued for delivery')
  }
}
function formatErrors(errors: UserErrors[]): string {
  try {
    return errors
      .map((element) =>
        JSON.parse(element.message)
          .map((msg: string) => `  · ${msg}`)
          .join('\n'),
      )
      .join('\n')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    return JSON.stringify(errors)
  }
}
