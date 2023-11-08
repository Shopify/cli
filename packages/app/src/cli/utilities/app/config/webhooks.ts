import {zod} from '@shopify/cli-kit/node/schema'
import type {NormalizedWebhookSubscriptions, WebhookConfig} from '../../../models/app/app.js'

// used in tandem with declarativeWebhooks beta when we are not in the context of an app
export const TEMP_OMIT_DECLARATIVE_WEBHOOKS_SCHEMA = true

// eslint-disable-next-line no-warning-comments
// TODO - remove this when mutation is ready
export function fakedWebhookSubscriptionsMutation(subscriptions: NormalizedWebhookSubscriptions) {
  return subscriptions
}

export const getFullPubSubValidationError = (suffix: string) =>
  `You must declare both pubsub_project and pubsub_topic if you wish to use ${suffix}`

export const getTooManyDestinationsError = (suffix: string) =>
  `You are only allowed to declare one (1) of subscription_endpoint_url, pubsub_project & pubsub_topic, or arn ${suffix}`

const duplicateSubscriptionsError = 'You can’t have duplicate subscriptions with the exact same topic and destination'

export function filterFalsey(values: (string | boolean | undefined)[]) {
  return values.filter(Boolean)
}

const SUBSCRIPTION_KEY_DELIMITER = '::'

const generateSubscriptionKey = (topic: string, destination: string) =>
  `${topic}${SUBSCRIPTION_KEY_DELIMITER}${destination}`

export function validateTopLevelSubscriptions({subscriptions = [], ...schema}: WebhookConfig) {
  const topLevelDestinationsLength = filterFalsey([
    schema.subscription_endpoint_url,
    schema.pubsub_project && schema.pubsub_topic,
    schema.arn,
  ]).length
  const hasTopics = Boolean(schema?.topics?.length)

  if (filterFalsey([schema.pubsub_project, schema.pubsub_topic]).length === 1) {
    return {
      code: zod.ZodIssueCode.custom,
      message: getFullPubSubValidationError('a top-level pub sub destination'),
      fatal: true,
    }
  }

  if (topLevelDestinationsLength > 1) {
    return {
      code: zod.ZodIssueCode.custom,
      message: getTooManyDestinationsError('at the top level'),
      fatal: true,
    }
  }

  if (topLevelDestinationsLength && !hasTopics && !subscriptions.length) {
    return {
      code: zod.ZodIssueCode.custom,
      message:
        'To use a top-level destination, you must also provide a `topics` array or `subscriptions` configuration',
      fatal: true,
    }
  }

  if (!topLevelDestinationsLength && hasTopics) {
    return {
      code: zod.ZodIssueCode.custom,
      message:
        'To use top-level topics, you must also provide a top-level destination of either subscription_endpoint_url, pubsub_project & pubsub_topic, or arn',
      fatal: true,
      path: ['topics'],
    }
  }
}

export function validateInnerSubscriptions({subscriptions = [], ...schema}: WebhookConfig) {
  const hasTopLevelDestinations = Boolean(
    filterFalsey([schema.subscription_endpoint_url, schema.pubsub_project && schema.pubsub_topic, schema.arn]).length,
  )
  // build top level destination key portion
  const topLevelDestination = filterFalsey([
    schema.subscription_endpoint_url,
    schema.pubsub_project,
    schema.pubsub_topic,
    schema.arn,
  ]).join(SUBSCRIPTION_KEY_DELIMITER)
  const subscriptionDestinationsSet = new Set()

  // top level subscriptions are normalized and added for duplication validation
  if (topLevelDestination && schema?.topics?.length) {
    for (const topic of schema.topics) {
      const key = generateSubscriptionKey(topic, topLevelDestination)

      if (subscriptionDestinationsSet.has(key)) {
        return {
          code: zod.ZodIssueCode.custom,
          message: duplicateSubscriptionsError,
          fatal: true,
          path: ['topics', topic],
        }
      }

      subscriptionDestinationsSet.add(key)
    }
  }

  if (!subscriptions.length) return

  for (const [i, subscription] of subscriptions.entries()) {
    const subscriptionDestinations = filterFalsey([
      subscription.subscription_endpoint_url,
      subscription.pubsub_project && subscription.pubsub_topic,
      subscription.arn,
    ])
    const path = ['subscriptions', i]

    if (filterFalsey([subscription.pubsub_project, subscription.pubsub_topic]).length === 1) {
      return {
        code: zod.ZodIssueCode.custom,
        message: getFullPubSubValidationError('a pub sub destination'),
        fatal: true,
        path,
      }
    }

    if (subscriptionDestinations.length > 1) {
      return {
        code: zod.ZodIssueCode.custom,
        message: getTooManyDestinationsError('per subscription'),
        fatal: true,
        path,
      }
    }

    // If no top-level destinations are provided, ensure each subscription has at least one destination
    if (!hasTopLevelDestinations && subscriptionDestinations.length === 0) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must declare either a top-level destination or a destination per subscription',
        fatal: true,
        path,
      }
    }

    if (!schema.subscription_endpoint_url && !subscription.subscription_endpoint_url && subscription.path) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must declare a subscription_endpoint_url if you wish to use a relative path',
        fatal: true,
        path,
      }
    }

    if ((subscription.arn || subscription.pubsub_project) && subscription.path) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You can’t define a path when using arn or pubsub',
        fatal: true,
        path,
      }
    }

    let destination = filterFalsey([
      subscription.subscription_endpoint_url,
      subscription.pubsub_project,
      subscription.pubsub_topic,
      subscription.arn,
    ]).join(SUBSCRIPTION_KEY_DELIMITER)

    // if there is no destination override, use top level destination. we are sure there will be one from earlier validation
    if (!destination) {
      destination = topLevelDestination
    }

    // concat the path to the destination if it exists to ensure uniqueness
    if (subscription.path) {
      destination = `${destination}${subscription.path}`
    }

    const key = generateSubscriptionKey(subscription.topic, destination)

    if (subscriptionDestinationsSet.has(key)) {
      return {
        code: zod.ZodIssueCode.custom,
        message: duplicateSubscriptionsError,
        fatal: true,
        path: [...path, subscription.topic],
      }
    }

    subscriptionDestinationsSet.add(key)
  }
}
