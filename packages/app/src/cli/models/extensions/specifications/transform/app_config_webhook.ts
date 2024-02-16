import {WebhooksConfig, NormalizedWebhookSubscription} from '../types/app_config_webhook.js'
import {deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

export function transformFromWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const webhookSubscriptions = []
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

  // Compliance topics are handled from app_config_privacy_compliance_webhooks.ts
  for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
    if (topics) webhookSubscriptions.push(topics.map((topic) => ({uri, topic, ...optionalFields})))
  }

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions.flat(), api_version} : {api_version}
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
