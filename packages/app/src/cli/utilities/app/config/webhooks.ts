import {AppConfiguration} from '../../../models/app/app.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {getPathValue} from '@shopify/cli-kit/common/object'

// used in tandem with declarativeWebhooks beta when we are not in the context of an app
export const TEMP_OMIT_DECLARATIVE_WEBHOOKS_SCHEMA = true

export interface WebhookSubscription {
  topic: string
  sub_topic?: string
  format?: 'xml' | 'json'
  include_fields?: string[]
  metafield_namespaces?: string[]
  endpoint?: string
  path?: string
}

export interface PrivacyWebhooks {
  customer_deletion_url?: string
  customer_data_request_url?: string
  shop_deletion_url?: string
}

export interface WebhookConfig {
  api_version: string
  privacy_compliance?: PrivacyWebhooks
  endpoint?: string
  topics?: string[]
  subscriptions?: WebhookSubscription[]
}

// eslint-disable-next-line no-warning-comments
// TODO - remove this when mutation is ready
export function fakedWebhookSubscriptionsMutation(subscriptions: WebhookSubscription[]) {
  return subscriptions
}
export const httpsRegex = /^(https:\/\/)/

const duplicateSubscriptionsError = 'You can’t have duplicate subscriptions with the exact same `topic` and `endpoint`'

export function filterFalsey(values: (string | boolean | undefined)[]) {
  return values.filter(Boolean)
}

const generateSubscriptionKey = (topic: string, endpoint: string) => `${topic}::${endpoint}`

export function validateTopLevelSubscriptions(schema: WebhookConfig) {
  const hasEndpoint = Boolean(schema.endpoint)
  const hasTopics = Boolean(schema.topics?.length)

  if (hasEndpoint && !hasTopics && !schema.subscriptions?.length) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'To use a top-level `endpoint`, you must also provide a `topics` array or `[[webhooks.subscriptions]]`',
      fatal: true,
    }
  }

  if (!hasEndpoint && hasTopics) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'To use top-level topics, you must also provide a top-level `endpoint`',
      fatal: true,
      path: ['topics'],
    }
  }

  // given the endpoint will be static, the only way to have duplicate top-level subscriptions is if there are multiple identical topics
  if (hasTopics && schema.topics?.length !== new Set(schema.topics).size) {
    return {
      code: zod.ZodIssueCode.custom,
      message: duplicateSubscriptionsError,
      fatal: true,
      path: ['topics'],
    }
  }
}

export function validateInnerSubscriptions({endpoint, subscriptions = [], ...schema}: WebhookConfig) {
  const uniqueSubscriptionEndpointSet = new Set()

  // add validated unique top level subscriptions to set
  if (endpoint && schema.topics?.length) {
    for (const topic of schema.topics) {
      uniqueSubscriptionEndpointSet.add(generateSubscriptionKey(topic, endpoint))
    }
  }

  if (!subscriptions.length) return

  for (const [i, subscription] of subscriptions.entries()) {
    const path = ['subscriptions', i]

    // If no top-level endpoints are provided, ensure each subscription has at least one endpoint
    if (!endpoint && !subscription.endpoint) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must include either a top-level endpoint or an endpoint per `[[webhooks.subscriptions]]`',
        fatal: true,
        path,
      }
    }

    let finalEndpoint = subscription.endpoint

    // if there is no endpoint override, use top level endpoint. we are sure there will be one from earlier validation
    if (!finalEndpoint) {
      finalEndpoint = endpoint
    }

    if (subscription.path && !httpsRegex.test(finalEndpoint!)) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must use an https `endpoint` to use a relative path',
        fatal: true,
        path,
      }
    }

    // concat the path to the endpoint if it exists to ensure uniqueness
    if (subscription.path) {
      finalEndpoint = `${finalEndpoint}${subscription.path}`
    }

    const key = generateSubscriptionKey(subscription.topic, finalEndpoint!)

    if (uniqueSubscriptionEndpointSet.has(key)) {
      return {
        code: zod.ZodIssueCode.custom,
        message: duplicateSubscriptionsError,
        fatal: true,
        path: [...path, subscription.topic],
      }
    }

    uniqueSubscriptionEndpointSet.add(key)
  }
}

export function getWebhookConfig(config: AppConfiguration) {
  return getPathValue(config, 'webhooks') ? (getPathValue(config, 'webhooks') as WebhookConfig) : undefined
}
