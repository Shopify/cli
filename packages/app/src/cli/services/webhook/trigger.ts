import {DELIVERY_METHOD, parseAddressAndMethod, parseVersionAndTopic, WebhookTriggerFlags} from './trigger-flags.js'
import {getWebhookSample, SendSampleWebhookVariables, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {
  collectAddressAndMethod,
  collectApiKey,
  collectApiVersion,
  collectCredentials,
  collectTopic,
} from './trigger-options.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
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
  const [developerPlatformClient, validFlags] = await validatedFlags(flags)

  // Request of prompts for missing flags
  const options: WebhookTriggerOptions = await collectMissingFlags(developerPlatformClient, validFlags)

  await sendSample(developerPlatformClient, options)
}

async function validatedFlags(flags: WebhookTriggerFlags): Promise<[DeveloperPlatformClient, WebhookTriggerFlags]> {
  const [deliveryMethod, address] = parseAddressAndMethod(flags)

  const developerPlatformClient: DeveloperPlatformClient =
    flags.developerPlatformClient ?? selectDeveloperPlatformClient()
  const [apiVersion, topic] = await parseVersionAndTopic(developerPlatformClient, flags)

  let clientSecret
  if (isValueSet(flags.clientSecret)) {
    // Flag overwrites any other secret
    clientSecret = flags.clientSecret as string
  }

  return [
    developerPlatformClient,
    {
      topic,
      apiVersion,
      deliveryMethod,
      address,
      clientSecret,
    },
  ]
}

async function collectMissingFlags(
  developerPlatformClient: DeveloperPlatformClient,
  flags: WebhookTriggerFlags,
): Promise<WebhookTriggerOptions> {
  const apiVersion = await collectApiVersion(developerPlatformClient, flags.apiVersion)

  const topic = await collectTopic(developerPlatformClient, apiVersion, flags.topic)

  const [deliveryMethod, address] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)

  const clientCredentials = await collectCredentials(developerPlatformClient, flags.clientSecret)

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
      options.apiKey = await collectApiKey(developerPlatformClient)
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

async function sendSample(developerPlatformClient: DeveloperPlatformClient, options: WebhookTriggerOptions) {
  const variables: SendSampleWebhookVariables = {
    topic: options.topic,
    api_version: options.apiVersion,
    address: options.address,
    delivery_method: options.deliveryMethod,
    shared_secret: options.clientSecret,
    api_key: options.apiKey,
  }
  const sample = await getWebhookSample(developerPlatformClient, variables)

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
