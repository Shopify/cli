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
  api_version?: string
  privacy_compliance?: PrivacyWebhooks
  endpoint?: string
  topics?: string[]
  subscriptions?: WebhookSubscription[]
}

interface WebhookServerConfig {
  topic: string
  endpoint: string
  subtopic?: string
  include_fields?: string[]
  metafield_namespaces?: string[]
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

export function transformWebhookConfig(content: object) {
  const webhooks = content as WebhookConfig

  // normalize webhook config with the top level config
  const webhookSubscriptions = []
  const {topics, subscriptions, endpoint} = webhooks

  if (endpoint && topics?.length) {
    for (const topic of topics) {
      webhookSubscriptions.push({
        topic,
        endpoint,
      })
    }
  }

  if (subscriptions?.length) {
    for (const {path, endpoint: localEndpoint, ...subscription} of subscriptions) {
      // we can assume this is valid from earlier validation, and local endpoint will overwrite top level if there is any
      const subscriptionConfig = {
        endpoint: localEndpoint || endpoint,
        ...subscription,
      }

      if (path) {
        subscriptionConfig.endpoint = `${subscriptionConfig.endpoint}${path}`
      }

      webhookSubscriptions.push(subscriptionConfig)
    }
  }
  return webhookSubscriptions
}

export function transformToWebhookConfig(content: object) {
  const serverWebhooks = content as WebhookServerConfig[]
  const frequencyMap: {[key: string]: number} = {}
  serverWebhooks.forEach((item) => {
    frequencyMap[item.endpoint] = (frequencyMap[item.endpoint] || 0) + 1
  })
  const maxCount = Math.max(...Object.values(frequencyMap))
  const defaultEndpoint = Object.keys(frequencyMap).find((key) => frequencyMap[key] === maxCount)

  const topics: string[] = []
  const subscriptions: WebhookSubscription[] = []

  for (const item of serverWebhooks) {
    if (item.endpoint === defaultEndpoint && !item.subtopic && !item.include_fields && !item.metafield_namespaces) {
      topics.push(item.topic)
    } else {
      let path: string | undefined
      let endpoint: string | undefined

      // If the endpoint starts with the defaultEndpoint, extract the rest of the string as the path
      if (item.endpoint.startsWith(defaultEndpoint!)) {
        path = item.endpoint.slice(defaultEndpoint!.length)
      } else {
        // If the endpoint does not start with the defaultEndpoint, extract the path using a regular expression
        const pathMatch = item.endpoint.match(/^[^:]+:\/\/[^/]+\/(.*)/)
        path = pathMatch ? pathMatch[1] : undefined
        endpoint = item.endpoint
      }

      // Exclude undefined keys from the subscription object
      const subscription: WebhookSubscription = {...item}
      if (path) subscription.path = path
      if (endpoint) subscription.endpoint = endpoint
      if (item.endpoint.startsWith(defaultEndpoint!)) {
        delete subscription.endpoint
      }
      subscriptions.push(subscription)
    }
  }

  return {endpoint: defaultEndpoint, topics, subscriptions}
}
