import {WebhookSchema, WebhookSimplifyConfig} from './app_config_webhook.js'
import {NormalizedWebhookSubscription, WebhooksConfig} from './types/app_config_webhook.js'
import {SpecsAppConfiguration} from './types/app_config.js'
import {CustomTransformationConfig, createExtensionSpecification} from '../specification.js'
import {BaseConfigType, ZodSchemaType} from '../schemas.js'
import {deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

export const WebhookSubscriptionsSpecIdentifier = 'webhooks_subscriptions'

export function transformFromWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  // const webhookSubscriptions = any[]
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

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

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions, api_version} : {api_version}
}

export function transformToWebhookConfig(content: object) {
  let webhooks = {}
  const apiVersion = getPathValue(content, 'api_version') as string
  webhooks = {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  if (!serverWebhooks) return webhooks

  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = []

  for (const {topic, ...otherFields} of serverWebhooks) {
    webhooksSubscriptions.push({topics: [topic], ...otherFields})
  }

  const webhooksSubscriptionsObject = webhooksSubscriptions.length > 0 ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}

const WebhooksSubscriptionsTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

// Uses the same schema as the webhooks specs because its content is nested under the same webhooks section
const webhookSubscriptionsSpec = createExtensionSpecification({
  identifier: WebhookSubscriptionsSpecIdentifier,
  schema: WebhookSchema as unknown as ZodSchemaType<BaseConfigType>,
  transform: transformFromWebhookConfig,
  reverseTransform: transformToWebhookConfig,
  appModuleFeatures: () => [],
  simplify: WebhookSimplifyConfig.simplify as (remoteConfig: SpecsAppConfiguration) => SpecsAppConfiguration,
  experience: 'extension',
  globalConfig: true,
  multipleRootPath: 'webhooks.subscriptions',
})

export default webhookSubscriptionsSpec
