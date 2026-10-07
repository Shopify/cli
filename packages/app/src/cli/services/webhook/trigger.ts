import {DELIVERY_METHOD} from './trigger-flags.js'
import {getWebhookSample, SendSampleWebhookVariables} from './request-sample.js'
import {triggerLocalWebhook} from './trigger-local-webhook.js'
import {collectAddressAndMethod, collectApiVersion, collectCredentials, collectTopic} from './trigger-options.js'
import {AppWebhookTriggerResult, WebhookTriggerResult} from './trigger/types.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'

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
 *
 * @param flags - Passed flags
 */
export async function webhookTriggerService(input: WebhookTriggerInput): Promise<WebhookTriggerResult> {
  const options: WebhookTriggerOptions = await validateAndCollectFlags(input)

  return sendSample(options)
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

async function sendSample(options: WebhookTriggerOptions): Promise<WebhookTriggerResult> {
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
    return {status: 'failed', reason: 'sample-request', userErrors: sample.userErrors}
  }

  const delivery: AppWebhookTriggerResult['delivery'] = {
    topic: options.topic,
    apiVersion: options.apiVersion,
    deliveryMethod: options.deliveryMethod as AppWebhookTriggerResult['delivery']['deliveryMethod'],
    address: options.address,
    status: 'enqueued',
  }

  if (options.deliveryMethod === DELIVERY_METHOD.LOCALHOST) {
    const result = await triggerLocalWebhook(options.address, sample.samplePayload, sample.headers)

    if (result) {
      return {
        status: 'success',
        result: {status: 'success', delivery: {...delivery, status: 'delivered'}},
        samplePayloadIsEmpty: sample.samplePayload === JSON.stringify({}),
      }
    }

    return {status: 'failed', reason: 'localhost-delivery'}
  }

  return {
    status: 'success',
    result: {status: 'success', delivery},
    samplePayloadIsEmpty: sample.samplePayload === JSON.stringify({}),
  }
}
