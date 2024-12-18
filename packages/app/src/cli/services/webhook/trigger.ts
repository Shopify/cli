import {DELIVERY_METHOD} from './trigger-flags.js'
import {getWebhookSample, SendSampleWebhookVariables, UserErrors} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {collectAddressAndMethod, collectApiVersion, collectCredentials, collectTopic} from './trigger-options.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {consoleError, outputSuccess} from '@shopify/cli-kit/node/output'

export interface WebhookTriggerInput {
  app: AppLinkedInterface
  developerPlatformClient: DeveloperPlatformClient
  remoteApp: OrganizationApp
  topic?: string
  apiVersion?: string
  deliveryMethod?: string
  address?: string
  clientId?: string
  clientSecret?: string
  path: string
  config?: string
  organizationId: string
}

interface WebhookTriggerOptions {
  topic: string
  apiVersion: string
  deliveryMethod: string
  address: string
  clientSecret: string
  apiKey?: string
  developerPlatformClient: DeveloperPlatformClient
  organizationId: string
}

/**
 * Orchestrates the command request by collecting params, requesting the sample, and sending it to localhost if
 * required.
 * It outputs the result
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(input: WebhookTriggerInput) {
  const options: WebhookTriggerOptions = await validateAndCollectFlags(input)

  await sendSample(options)
}

async function validateAndCollectFlags(input: WebhookTriggerInput): Promise<WebhookTriggerOptions> {
  const apiVersion = await collectApiVersion(input.developerPlatformClient, input.apiVersion, input.organizationId)
  const topic = await collectTopic(input.developerPlatformClient, apiVersion, input.topic, input.organizationId)
  const [address, deliveryMethod] = await collectAddressAndMethod(input.deliveryMethod, input.address)
  const clientCredentials = await collectCredentials(input, deliveryMethod)

  return {
    topic,
    apiVersion,
    deliveryMethod,
    address,
    apiKey: clientCredentials.apiKey,
    clientSecret: clientCredentials.clientSecret,
    developerPlatformClient: input.developerPlatformClient,
    organizationId: input.organizationId,
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
  const sample = await getWebhookSample(options.developerPlatformClient, variables, options.organizationId)

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
