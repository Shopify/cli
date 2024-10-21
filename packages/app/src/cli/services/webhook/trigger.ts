import {DELIVERY_METHOD, WebhookTriggerFlags} from './trigger-flags.js'
import {getWebhookSample, SendSampleWebhookVariables, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {collectAddressAndMethod, collectApiVersion, collectCredentials, collectTopic} from './trigger-options.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {consoleError, outputSuccess} from '@shopify/cli-kit/node/output'

interface WebhookTriggerOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  address: string
  clientSecret: string
  apiKey?: string
  developerPlatformClient: DeveloperPlatformClient
}

/**
 * Orchestrates the command request by collecting params, requesting the sample, and sending it to localhost if
 * required.
 * It outputs the result
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(flags: WebhookTriggerFlags) {
  const app: AppInterface = await loadApp({
    directory: flags.path,
    userProvidedConfigName: flags.config,
    specifications: await loadLocalExtensionsSpecifications(),
  })
  const developerPlatformClient: DeveloperPlatformClient =
    flags.developerPlatformClient ?? selectDeveloperPlatformClient({configuration: app.configuration})
  const options: WebhookTriggerOptions = await validateAndCollectFlags(flags, developerPlatformClient, app)

  await sendSample(options)
  return {app}
}

async function validateAndCollectFlags(
  flags: WebhookTriggerFlags,
  developerPlatformClient: DeveloperPlatformClient,
  app: AppInterface,
): Promise<WebhookTriggerOptions> {
  const apiVersion = await collectApiVersion(developerPlatformClient, flags.apiVersion)
  const topic = await collectTopic(developerPlatformClient, apiVersion, flags.topic)
  const [address, deliveryMethod] = await collectAddressAndMethod(flags.deliveryMethod, flags.address)
  const clientCredentials = await collectCredentials(flags.clientId, flags.clientSecret, app, deliveryMethod)

  return {
    topic,
    apiVersion,
    deliveryMethod,
    address,
    apiKey: clientCredentials.apiKey,
    clientSecret: clientCredentials.clientSecret,
    developerPlatformClient: clientCredentials.developerPlatformClient ?? developerPlatformClient,
  }
}

async function sendSample(options: WebhookTriggerOptions) {
  const variables: SendSampleWebhookVariables = {
    topic: options.topic,
    api_version: options.apiVersion,
    address: options.address,
    delivery_method: options.deliveryMethod,
    shared_secret: options.clientSecret,
    api_key: options.apiKey,
  }
  const sample = await getWebhookSample(options.developerPlatformClient, variables)

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
