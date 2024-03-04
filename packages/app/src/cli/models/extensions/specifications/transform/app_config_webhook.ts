import {WebhooksConfig, NormalizedWebhookSubscription} from '../types/app_config_webhook.js'
import {deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

export function transformWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const webhookSubscriptions = []
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks

  // eslint-disable-next-line no-warning-comments
  // TODO: pass along compliance_topics once we're ready to store them in its own module
  for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
    webhookSubscriptions.push(topics.map((topic) => ({uri, topic, ...optionalFields})))
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

  // eslint-disable-next-line @typescript-eslint/naming-convention
  for (const {uri, topic, sub_topic, ...optionalFields} of serverWebhooks) {
    const currSubscription = webhooksSubscriptions.find((sub) => sub.uri === uri && sub.sub_topic === sub_topic)
    if (currSubscription) {
      currSubscription.topics.push(topic)
    } else {
      webhooksSubscriptions.push({
        topics: [topic],
        uri,
        ...(sub_topic ? {sub_topic} : {}),
        ...optionalFields,
      })
    }
  }

  const webhooksSubscriptionsObject = webhooksSubscriptions.length > 0 ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}
