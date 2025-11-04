import {WebhookSubscriptionUriValidation, removeTrailingSlash} from './validation/common.js'
import {prependApplicationUrl} from './validation/url_prepender.js'
import {WebhookSubscription} from './types/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {CurrentAppConfiguration} from '../../app/app.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhookSubscriptionSpecIdentifier = 'webhook_subscription'

interface TransformedWebhookSubscription {
  api_version: string
  uri: string
  topic: string
  actions: string[]
  compliance_topics?: string[]
  include_fields?: string[]
  filter?: string
  payload_query?: string
}

export const SingleWebhookSubscriptionSchema = zod.object({
  topic: zod.string(),
  actions: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  api_version: zod.string(),
  uri: zod.preprocess(removeTrailingSlash as (arg: unknown) => unknown, WebhookSubscriptionUriValidation, {
    required_error: 'Missing value at',
  }),
  include_fields: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  filter: zod.string({invalid_type_error: 'Value must be a string'}).optional(),
  payload_query: zod.string({invalid_type_error: 'Value must be a string'}).trim().min(1).optional(),
})

/* this transforms webhooks remotely to be accepted by the TOML
ie.
  given:
    { api_version: "2024-01", topic: 'products/create', uri: 'https://example.com/webhooks/products'},
  the function should return:
    { topics: ['products/create'], uri: 'https://example.com/webhooks/products'},

  */
function transformToWebhookSubscriptionConfig(content: object) {
  const {api_version: _, topic, ...otherFields} = content as TransformedWebhookSubscription
  const subscription = {
    topics: [topic],
    ...otherFields,
  }

  return {
    webhooks: {
      subscriptions: [subscription],
    },
  }
}

const WebhookSubscriptionTransformConfig: CustomTransformationConfig = {
  forward: (content, appConfiguration) => {
    const webhookConfig = content as WebhookSubscription
    let appUrl: string | undefined
    if ('application_url' in appConfiguration) {
      appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
    }
    return {
      ...webhookConfig,
      uri: prependApplicationUrl(webhookConfig.uri, appUrl),
    }
  },
  reverse: transformToWebhookSubscriptionConfig,
}

const appWebhookSubscriptionSpec = createConfigExtensionSpecification({
  identifier: WebhookSubscriptionSpecIdentifier,
  schema: SingleWebhookSubscriptionSchema,
  transformConfig: WebhookSubscriptionTransformConfig,
  uidStrategy: 'dynamic',
})

export default appWebhookSubscriptionSpec
