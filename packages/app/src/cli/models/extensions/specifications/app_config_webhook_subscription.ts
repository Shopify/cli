import {WebhookSimplifyConfig, simplifyWebhooks} from './app_config_webhook.js'
import {CustomTransformationConfig, SimplifyConfig, createConfigExtensionSpecification} from '../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {NormalizedWebhookSubscription, WebhooksConfig} from './types/app_config_webhook.js'
import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'

export const WebhookSubscriptionSpecIdentifier = 'webhook_subscription'

function transformFromWebhookSubscriptionConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const {subscriptions = []} = webhooks

  /* this transforms webhooks from subscriptions array to individual subscriptions per topic, ie
  // [
  { uri: 'https://example.com', topic: 'products/create' },
  { uri: 'https://example.com', topic: 'products/delete' },
  { uri: 'https://example-2.com', topic: 'products/update' }
  ]
  */
  const webhookSubscriptions = subscriptions.flatMap((subscription) => {
    const {uri, topics, ...optionalFields} = subscription
    if (topics)
      return topics.map((topic) => {
        return {uri, topic, ...optionalFields}
      })
  })

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions} : {}
}

function transformToWebhookSubscriptionConfig(content: object) {
  const subscription = content as NormalizedWebhookSubscription
  if (!subscription) return {}

  const {topic, ...otherFields} = subscription
  return {
    webhooks: {
      subscriptions: [
        {
          topics: [topic],
          ...otherFields,
        },
      ],
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
  hasMultipleModuleConfig: true,
  multipleModuleConfigPath: 'subscriptions',
})

export default appWebhookSubscriptionSpec
