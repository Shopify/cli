import {WebhookSimplifyConfig, WebhooksSchemaWithDeclarative} from './app_config_webhook.js'
import {NormalizedWebhookSubscription, WebhooksConfig} from './types/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {getPathValue} from '@shopify/cli-kit/common/object'

export const WebhookSchema = zod.object({
  webhooks: WebhooksSchemaWithDeclarative,
})

export const WebhookSubscriptionsSpecIdentifier = 'webhooks_subscriptions'

function transformFromWebhookSubscriptionsConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  // const webhookSubscriptions = any[]
  const {subscriptions = []} = webhooks

  // Compliance topics are handled from app_config_privacy_compliance_webhooks.ts
  // for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
  //   if (topics) topics.map((topic) => webhookSubscriptions.push({uri, topic, ...optionalFields}))
  // }

  /* this transforms webhooks to individual subscriptions per topic, ie
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

function transformToWebhookSubscriptionsConfig(content: object) {
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  if (!serverWebhooks) return {}

  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = []

  for (const {topic, ...otherFields} of serverWebhooks) {
    webhooksSubscriptions.push({topics: [topic], ...otherFields})
  }

  const webhooksSubscriptionsObject = webhooksSubscriptions.length > 0 ? {subscriptions: webhooksSubscriptions} : {}
  return {webhooks: webhooksSubscriptionsObject}
}

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookSubscriptionsConfig(content),
  reverse: (content: object) => transformToWebhookSubscriptionsConfig(content),
}

const appWebhookSubscriptionsSpec = createConfigExtensionSpecification({
  identifier: WebhookSubscriptionsSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
  simplify: WebhookSimplifyConfig,
  globalConfig: true,
  multipleRootPath: 'subscriptions',
})
export default appWebhookSubscriptionsSpec
