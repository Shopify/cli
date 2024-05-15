import {WebhooksConfig, NormalizedWebhookSubscription, WebhookSubscription} from '../types/app_config_webhook.js'
import {deepCompare, deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

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

  const subscriptions = serverWebhooks.map((subscription) => {
    const {topic, ...otherFields} = subscription
    return {...otherFields, topics: [subscription.topic]} as WebhookSubscription
  })
  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = mergeAllWebhooks(subscriptions)

  const webhooksSubscriptionsObject = webhooksSubscriptions ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}

export function mergeAllWebhooks(subscriptions: WebhookSubscription[]): WebhookSubscription[] | undefined {
  if (subscriptions.length === 0) return
  const topicSubscriptions = subscriptions
    .filter((subscription) => subscription.topics !== undefined)
    .map((subscription) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const {compliance_topics, ...rest} = subscription
      return rest
    })
  const complianceSubscriptions = subscriptions
    .filter((subscription) => subscription.compliance_topics !== undefined)
    .map((subscription) => {
      const {topics, ...rest} = subscription
      return rest
    })

  const mergedTopicSubscriptions = reduceByProperty(topicSubscriptions, 'topics')
  const mergedComplianceSubscriptions = reduceByProperty(complianceSubscriptions, 'compliance_topics')

  return [...mergedTopicSubscriptions, ...mergedComplianceSubscriptions]
}

function findSubscription(subscriptions: WebhookSubscription[], subscription: WebhookSubscription) {
  return subscriptions.find(
    (sub) =>
      sub.uri === subscription.uri &&
      sub.sub_topic === subscription.sub_topic &&
      deepCompare(sub.include_fields ?? [], subscription.include_fields ?? []) &&
      sub.filter === subscription.filter,
  )
}

function reduceByProperty(
  subscriptions: WebhookSubscription[],
  property: keyof Pick<WebhookSubscription, 'topics' | 'compliance_topics'>,
) {
  return subscriptions.reduce((accumulator, subscription) => {
    const existingSubscription = findSubscription(accumulator, subscription)
    if (existingSubscription && subscription[property]) {
      ;(existingSubscription[property] ?? []).push(...(subscription[property] ?? []))
    } else {
      accumulator.push(subscription)
    }
    return accumulator
  }, [] as WebhookSubscription[])
}
