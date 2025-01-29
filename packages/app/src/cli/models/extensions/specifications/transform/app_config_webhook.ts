import {WebhooksConfig, WebhookSubscription} from '../types/app_config_webhook.js'
import {deepCompare, getPathValue} from '@shopify/cli-kit/common/object'

export function transformFromWebhookConfig(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  if (!webhooks) return content

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version} = webhooks

  return {api_version}
}

export function transformToWebhookConfig(content: object) {
  let webhooks = {}
  const apiVersion = getPathValue(content, 'api_version') as string
  webhooks = {...(apiVersion ? {webhooks: {api_version: apiVersion}} : {})}
  return webhooks
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
    .flatMap(({compliance_topics, topics, ...rest}) => {
      const sortedTopics = sortArrayAlphabetically(topics)
      return sortedTopics?.map((topic) => ({topics: [topic], ...rest})) ?? []
    })
  const complianceSubscriptions = subscriptions
    .filter((subscription) => subscription.topics === undefined || subscription.compliance_topics !== undefined)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    .map(({compliance_topics, topics, ...rest}) => {
      return {compliance_topics, ...rest}
    })

  const mergedComplianceSubscriptions = reduceWebhooks(complianceSubscriptions, 'compliance_topics')
  const sortedComplianceTopicsSubscriptions = sortComplianceTopics(mergedComplianceSubscriptions)

  // order of compliance and non-compliance subscription matters here
  // because of the way we are creating and storing the extensions in loader.ts
  return [...sortWebhooksByUri(sortedComplianceTopicsSubscriptions), ...sortWebhooksByUri(topicSubscriptions)]
}

function sortArrayAlphabetically(array: string[] | undefined) {
  return array?.sort((first, second) => first.localeCompare(second))
}
function sortWebhooksByUri(subscriptions: WebhookSubscription[]) {
  return subscriptions.sort((oneSub, twoSub) => oneSub.uri.localeCompare(twoSub.uri))
}
function sortComplianceTopics(subscriptions: WebhookSubscription[]) {
  subscriptions.forEach((sub) => (sub.compliance_topics = sortArrayAlphabetically(sub.compliance_topics)))
  return subscriptions
}

function findSubscription(subscriptions: WebhookSubscription[], subscription: WebhookSubscription) {
  return subscriptions.find(
    (sub) =>
      sub.uri === subscription.uri &&
      deepCompare(sub.include_fields ?? [], subscription.include_fields ?? []) &&
      sub.filter === subscription.filter,
  )
}

export function reduceWebhooks(
  subscriptions: WebhookSubscription[],
  property?: keyof Pick<WebhookSubscription, 'topics' | 'compliance_topics'>,
) {
  return subscriptions.reduce<WebhookSubscription[]>((accumulator, subscription) => {
    const existingSubscription = findSubscription(accumulator, subscription)
    if (existingSubscription) {
      if (property && subscription?.[property]?.length) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-non-null-assertion
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
  }, [])
}
