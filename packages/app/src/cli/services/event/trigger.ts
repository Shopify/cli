import {DELIVERY_METHOD, EventTriggerOptions} from './trigger-options.js'
import {getEventSample} from './request-sample.js'
import {triggerLocalEvent} from './trigger-local-event.js'
import {output} from '@shopify/cli-kit'

/**
 * Orchestrates the command request by requesting the sample and sending it to localhost if required.
 * It outputs the result in console
 *
 * @param options - Request options once the flags, prompts, and transformations have been performed
 */
export async function eventTriggerService(options: EventTriggerOptions) {
  const sample = await getEventSample(
    options.topic,
    options.apiVersion,
    options.deliveryMethod,
    options.address,
    options.sharedSecret,
  )

  if (!sample.success) {
    await output.consoleError(JSON.stringify(sample.userErrors))
    return
  }

  if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalEvent(options.address, sample.samplePayload, sample.headers)

    if (result) {
      output.success('Localhost delivery sucessful')
      return
    }

    await output.consoleError('Localhost delivery failed')
    return
  }

  if (sample.samplePayload === JSON.stringify({})) {
    output.success('Webhook will be delivered shortly')
  }
}
