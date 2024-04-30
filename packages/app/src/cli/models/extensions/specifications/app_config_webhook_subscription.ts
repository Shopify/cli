import {WebhookSimplifyConfig} from './app_config_webhook.js'
import {WebhooksConfig} from './types/app_config_webhook.js'
import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

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
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

  const webhookSubscriptions = subscriptions.flatMap((subscription) => {
    const {uri, topics, ...optionalFields} = subscription
    if (topics)
      return topics.map((topic) => {
        return {api_version, uri, topic, ...optionalFields}
      })
  })

  return webhookSubscriptions.length > 0 ? webhookSubscriptions : []
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
  schema: WebhooksSchema,
  transformConfig: WebhookSubscriptionTransformConfig,
  simplify: WebhookSimplifyConfig,
  extensionManagedInToml: true,
})

export default appWebhookSubscriptionSpec
