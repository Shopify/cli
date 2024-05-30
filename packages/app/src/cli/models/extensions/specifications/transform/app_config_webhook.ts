import {AppConfigurationWithoutPath, CurrentAppConfiguration} from '../../../app/app.js'
import {WebhooksConfig, NormalizedWebhookSubscription, WebhookSubscription} from '../types/app_config_webhook.js'
import {deepCompare, deepMergeObjects, getPathValue} from '@shopify/cli-kit/common/object'

export function transformFromWebhookConfig(content: object, appConfiguration: AppConfigurationWithoutPath) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  const webhookSubscriptions = []
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, subscriptions = []} = webhooks
  const appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url

  // Compliance topics are handled from app_config_privacy_compliance_webhooks.ts
  for (const {uri, topics, compliance_topics: _, ...optionalFields} of subscriptions) {
    if (topics) {
      const uriWithRelativePath = uri.startsWith('/') && appUrl ? `${appUrl}${uri}` : uri
      webhookSubscriptions.push(topics.map((topic) => ({uri: uriWithRelativePath, topic, ...optionalFields})))
    }
  }

  return webhookSubscriptions.length > 0 ? {subscriptions: webhookSubscriptions.flat(), api_version} : {api_version}
}

export function transformToWebhookConfig(content: object) {
  let webhooks = {}
  const apiVersion = getPathValue(content, 'api_version') as string
  webhooks = {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
  const serverWebhooks = getPathValue(content, 'subscriptions') as NormalizedWebhookSubscription[]
  if (!serverWebhooks) return webhooks

  const subscriptions = serverWebhooks.map(({topic, ...otherFields}) => {
    return {topics: [topic], ...otherFields} as WebhookSubscription
  })
  const webhooksSubscriptions: WebhooksConfig['subscriptions'] = mergeAllWebhooks(subscriptions)

  const webhooksSubscriptionsObject = webhooksSubscriptions ? {subscriptions: webhooksSubscriptions} : {}
  return deepMergeObjects(webhooks, {webhooks: webhooksSubscriptionsObject})
}

/**
 * Transforms subscriptions from webhooks spec and privacy compliance spec
 *
 * This simplifies the local webhooks config into a format that matches the remote config,
 * to help with comparing local and remote config differences
 *
 * @param subscriptions - An array of subscriptions from the TOML
 * @returns An array of sorted subscriptions (sorted by uri),
 * separated by non-privacy compliance webhooks and privacy compliance webhooks
 */

export function mergeAllWebhooks(subscriptions: WebhookSubscription[]): WebhookSubscription[] | undefined {
  if (subscriptions.length === 0) return
  const topicSubscriptions = subscriptions
    .filter((subscription) => subscription.topics !== undefined)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    .map(({compliance_topics, topics, ...rest}) => {
      return {topics, ...rest}
    })
  const complianceSubscriptions = subscriptions
    .filter((subscription) => subscription.topics === undefined || subscription.compliance_topics !== undefined)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    .map(({compliance_topics, topics, ...rest}) => {
      return {compliance_topics, ...rest}
    })

  const mergedTopicSubscriptions = reduceWebhooks(topicSubscriptions, 'topics')
  const mergedComplianceSubscriptions = reduceWebhooks(complianceSubscriptions, 'compliance_topics')
  const sortedTopicsSubscriptions = sortTopics(mergedTopicSubscriptions)
  const sortedComplianceTopicsSubscriptions = sortComplianceTopics(mergedComplianceSubscriptions)

  return [...sortWebhooksByUri(sortedTopicsSubscriptions), ...sortWebhooksByUri(sortedComplianceTopicsSubscriptions)]
}

function sortArrayAlphabetically(array: string[] | undefined) {
  return array?.sort((first, second) => first.localeCompare(second))
}
function sortWebhooksByUri(subscriptions: WebhookSubscription[]) {
  return subscriptions.sort((oneSub, twoSub) => oneSub.uri.localeCompare(twoSub.uri))
}
function sortTopics(subscriptions: WebhookSubscription[]) {
  subscriptions.forEach((sub) => (sub.topics = sortArrayAlphabetically(sub.topics)))
  return subscriptions
}
function sortComplianceTopics(subscriptions: WebhookSubscription[]) {
  subscriptions.forEach((sub) => (sub.compliance_topics = sortArrayAlphabetically(sub.compliance_topics)))
  return subscriptions
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

export function reduceWebhooks(
  subscriptions: WebhookSubscription[],
  property?: keyof Pick<WebhookSubscription, 'topics' | 'compliance_topics'>,
) {
  return subscriptions.reduce((accumulator, subscription) => {
    const existingSubscription = findSubscription(accumulator, subscription)
    if (existingSubscription) {
      if (property && subscription?.[property]?.length) {
        existingSubscription[property]?.push(...subscription[property]!)
      } else {
        if (subscription.topics) {
          existingSubscription.topics ??= []
          existingSubscription.topics.push(...subscription.topics)
        }
        if (subscription.compliance_topics) {
          existingSubscription.compliance_topics ??= []
          existingSubscription.compliance_topics.push(...subscription.compliance_topics)
        }
      }
    } else {
      accumulator.push(subscription)
    }
    return accumulator
  }, [] as WebhookSubscription[])
}
