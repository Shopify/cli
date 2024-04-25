import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {WebhookSubscription} from './types/app_config_webhook.js'
import {SpecsAppConfiguration} from './types/app_config.js'
import {CustomTransformationConfig, SimplifyConfig, createConfigExtensionSpecification} from '../specification.js'

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

export const WebhookSimplifyConfig: SimplifyConfig = {
  simplify: (remoteConfig: SpecsAppConfiguration) => simplifyWebhooks(remoteConfig),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhooksSchema,
  transformConfig: WebhookTransformConfig,
  simplify: WebhookSimplifyConfig,
})

export default appWebhooksSpec

function simplifyWebhooks(remoteConfig: SpecsAppConfiguration) {
  if (!remoteConfig.webhooks?.subscriptions) return remoteConfig

  remoteConfig.webhooks.subscriptions = mergeAllWebhooks(remoteConfig.webhooks.subscriptions)
  return remoteConfig
}

function mergeAllWebhooks(subscriptions: WebhookSubscription[]): WebhookSubscription[] {
  return subscriptions.reduce((accumulator, subscription) => {
    const existingSubscription = accumulator.find(
      (sub) =>
        sub.uri === subscription.uri &&
        sub.sub_topic === subscription.sub_topic &&
        sub.include_fields === subscription.include_fields,
    )
    if (existingSubscription) {
      if (subscription.compliance_topics) {
        existingSubscription.compliance_topics ??= []
        existingSubscription.compliance_topics.push(...subscription.compliance_topics)
      }
      if (subscription.topics) {
        existingSubscription.topics ??= []
        existingSubscription.topics.push(...subscription.topics)
      }
    } else {
      accumulator.push(subscription)
    }
    return accumulator
  }, [] as WebhookSubscription[])
}
