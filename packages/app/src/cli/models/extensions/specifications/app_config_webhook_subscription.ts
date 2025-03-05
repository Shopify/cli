import {WebhookSubscriptionUriValidation, removeTrailingSlash} from './validation/common.js'
import {WebhookSubscription} from './types/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {CurrentAppConfiguration} from '../../app/app.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhookSubscriptionSpecIdentifier = 'webhook_subscription'

interface TransformedWebhookSubscription {
  api_version: string
  uri: string
  topic: string
  compliance_topics?: string[]
  include_fields?: string[]
  filter?: string
  metafields?: {
    namespace: string
    key: string
  }[]
}

export const SingleWebhookSubscriptionSchema = zod.object({
  topic: zod.string(),
  api_version: zod.string(),
  uri: zod.preprocess(removeTrailingSlash as (arg: unknown) => unknown, WebhookSubscriptionUriValidation, {
    required_error: 'Missing value at',
  }),
  include_fields: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  filter: zod.string({invalid_type_error: 'Value must be a string'}).optional(),
  metafields: zod
    .array(
      zod.object({
        namespace: zod.string({invalid_type_error: 'Metafield namespace must be a string'}),
        key: zod.string({invalid_type_error: 'Metafield key must be a string'}),
      }),
      {invalid_type_error: 'Metafields must be an array of objects with namespace and key'},
    )
    .optional(),
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
      uri:
        appUrl && webhookConfig.uri.startsWith('/')
          ? `${removeTrailingSlash(appUrl)}${webhookConfig.uri}`
          : webhookConfig.uri,
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
