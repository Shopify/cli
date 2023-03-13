import {DELIVERY_METHOD, parseAddressAndMethod, parseVersionAndTopic, WebhookTriggerFlags} from './trigger-flags.js'
import {getWebhookSample, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {
  collectAddressAndMethod,
  collectApiKey,
  collectApiVersion,
  collectCredentials,
  collectTopic,
} from './trigger-options.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {consoleError, outputSuccess} from '@shopify/cli-kit/node/output'

interface WebhookTriggerOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  address: string
  clientSecret: string
  apiKey?: string
}

/**
 * Orchestrates the command request by collecting params, requesting the sample, and sending it to localhost if
 * required.
 * It outputs the result
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(flags: WebhookTriggerFlags) {
  // Validation and collection of flags
  const [token, validFlags] = await validatedFlags(flags)

  // Request of prompts for missing flags
  const options: WebhookTriggerOptions = await collectMissingFlags(token, validFlags)

  await sendSample(token, options)
}

async function validatedFlags(flags: WebhookTriggerFlags): Promise<[string, WebhookTriggerFlags]> {
  const [deliveryMethod, address] = parseAddressAndMethod(flags)

  const token = await ensureAuthenticatedPartners()
  const [apiVersion, topic] = await parseVersionAndTopic(token, flags)

  let clientSecret
  if (isValueSet(flags.clientSecret)) {
    // Flag overwrites any other secret
    clientSecret = flags.clientSecret as string
  }

  return [
    token,
    {
      topic,
      apiVersion,
      deliveryMethod,
      address,
      clientSecret,
    },
  ]
}

async function collectMissingFlags(token: string, flags: WebhookTriggerFlags): Promise<WebhookTriggerOptions> {
  const apiVersion = await collectApiVersion(token, flags.apiVersion)

  const topic = await collectTopic(token, apiVersion, flags.topic)

  const [deliveryMethod, address] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)

  const clientCredentials = await collectCredentials(token, flags.clientSecret)

  const options: WebhookTriggerOptions = {
    topic,
    apiVersion,
    deliveryMethod,
    address,
    clientSecret: clientCredentials.clientSecret as string,
  }

  if (deliveryMethod === DELIVERY_METHOD.EVENTBRIDGE) {
    if (isValueSet(clientCredentials.apiKey)) {
      options.apiKey = clientCredentials.apiKey
    } else {
      options.apiKey = await collectApiKey(token)
    }
  }

  return options
}

export function isValueSet(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  return value.length > 0
}

async function sendSample(token: string, options: WebhookTriggerOptions) {
  let sample
  if (options.apiKey === undefined) {
    sample = await getWebhookSample(
      token,
      options.topic,
      options.apiVersion,
      options.deliveryMethod,
      options.address,
      options.clientSecret,
    )
  } else {
    sample = await getWebhookSample(
      token,
      options.topic,
      options.apiVersion,
      options.deliveryMethod,
      options.address,
      options.clientSecret,
      options.apiKey,
    )
  }

  if (!sample.success) {
    consoleError(`Request errors:\n${formatErrors(sample.userErrors)}`)
    return
  }

  if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(options.address, sample.samplePayload, sample.headers)

    if (result) {
      outputSuccess('Localhost delivery sucessful')
      return
    }

    consoleError('Localhost delivery failed')
    return
  }

  if (sample.samplePayload === JSON.stringify({})) {
    outputSuccess('Webhook has been enqueued for delivery')
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
