import {WebhookSimplifyConfig} from './app_config_webhook.js'
import {WebhookSubscription} from './types/app_config_webhook.js'
import {WebhookSubscriptionSchema} from './app_config_webhook_schemas/webhook_subscription_schema.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhookSubscriptionSpecIdentifier = 'webhook_subscription'

interface TransformedWebhookSubscription {
  api_version: string
  uri: string
  topic: string
  compliance_topics?: string[]
  sub_topic?: string
  include_fields?: string[]
}

/* this transforms webhooks from the TOML config to be parsed remotely
ie.
  given:
  {
    webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/delete', 'orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
          ]
      }
  }
  the function should return:
  {
    subscriptions: [
      { topic: 'products/create', uri: 'https://example.com/webhooks/products'},
      { topic: 'orders/delete', uri: https://example.com/webhooks/orderss'},
      { topic: 'orders/create', uri: 'https://example.com/webhooks/orders'},
    ]
  }
  */
function transformFromWebhookSubscriptionConfig(content: object) {
  const subscription = content as WebhookSubscription & {api_version: string}
  if (!subscription) return content

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {compliance_topics, ...rest} = subscription
  return rest
}

/* this transforms webhooks remotely to be accepted by the TOML
ie.
  given:
  {
    subscriptions: [
      { topic: 'products/create', uri: 'https://example.com/webhooks/products'},
      { topic: 'orders/delete', uri: https://example.com/webhooks/orderss'},
      { topic: 'orders/create', uri: 'https://example.com/webhooks/orders'},
    ]
  }
  the function should return:
  {
    webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/delete', 'orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
          ]
      }
  }
  */
function transformToWebhookSubscriptionConfig(content: object) {
  const subscriptions = getPathValue(content, 'subscriptions') as TransformedWebhookSubscription[]
  if (!subscriptions) return {}

  const subscriptionsArray = subscriptions.map((subscription: TransformedWebhookSubscription) => {
    const {topic, ...otherFields} = subscription
    return {
      topics: [topic],
      ...otherFields,
    }
  })

  return {
    webhooks: {
      subscriptions: subscriptionsArray,
    },
  }
}

const WebhookSubscriptionTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookSubscriptionConfig(content),
  reverse: (content: object) => transformToWebhookSubscriptionConfig(content),
}

const appWebhookSubscriptionSpec = createConfigExtensionSpecification({
  identifier: WebhookSubscriptionSpecIdentifier,
  schema: WebhookSubscriptionSchema.extend({
    api_version: zod.string(),
    topic: zod.string(),
  }),
  transformConfig: WebhookSubscriptionTransformConfig,
  simplify: WebhookSimplifyConfig,
  extensionManagedInToml: true,
  multipleModuleConfigPath: 'subscriptions',
  uidStrategy: 'dynamic',
})

export default appWebhookSubscriptionSpec
