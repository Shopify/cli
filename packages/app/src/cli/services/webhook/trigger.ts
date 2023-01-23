import {DELIVERY_METHOD} from './trigger-options.js'
import {getWebhookSample, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {
  collectAddressAndMethod,
  collectApiVersion,
  collectSecret,
  collectTopic,
  WebhookTriggerFlags,
} from '../../prompts/webhook/options-prompt.js'
import * as output from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

/**
 * Orchestrates the command request by requesting the sample and sending it to localhost if required.
 * It outputs the result in console
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(flags: WebhookTriggerFlags) {
  const token = await ensureAuthenticatedPartners()

  const apiVersion = await collectApiVersion(flags.apiVersion, await requestApiVersions(token))
  const topic = await collectTopic(flags.topic, apiVersion, await requestTopics(token, apiVersion))

  const [deliveryMethod, address] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)

  const sharedSecret = await collectSecret(flags.sharedSecret)

  const sample = await getWebhookSample(token, topic, apiVersion, deliveryMethod, address, sharedSecret)

  if (!sample.success) {
    await output.consoleError(`Request errors:\n${formatErrors(sample.userErrors)}`)
    return
  }

  if (deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(address, sample.samplePayload, sample.headers)

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
