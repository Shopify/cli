import {WebhooksConfig} from '../../../../services/app/configuration.js'
import {httpsRegex} from '../../../app/validation/common.js'
import {zod} from '@shopify/cli-kit/node/schema'

const generateSubscriptionKey = (topic: string, uri: string) => `${topic}::${uri}`
const duplicateSubscriptionsError = 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`'

export function validateWebhookSubscriptions(schema: object, ctx: zod.RefinementCtx) {
  const topLevelSubscriptionErrors = validateTopLevelSubscriptions(schema as WebhooksConfig)
  if (topLevelSubscriptionErrors) {
    ctx.addIssue(topLevelSubscriptionErrors)
    return zod.NEVER
  }

  const innerSubscriptionErrors = validateInnerSubscriptions(schema as WebhooksConfig)
  if (innerSubscriptionErrors) {
    ctx.addIssue(innerSubscriptionErrors)
    return zod.NEVER
  }
}

function validateTopLevelSubscriptions(webhookConfig: WebhooksConfig) {
  const hasEndpoint = Boolean(webhookConfig.uri)
  const hasTopics = Boolean(webhookConfig.topics?.length)

  if (hasEndpoint && !hasTopics && !webhookConfig.subscriptions?.length) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'To use a top-level `uri`, you must also provide a `topics` array or `[[webhooks.subscriptions]]`',
      fatal: true,
    }
  }

  if (!hasEndpoint && hasTopics) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'To use top-level topics, you must also provide a top-level `uri`',
      fatal: true,
      path: ['topics'],
    }
  }

  // given the uri will be static, the only way to have duplicate top-level subscriptions is if there are multiple identical topics
  if (hasTopics && webhookConfig.topics?.length !== new Set(webhookConfig.topics).size) {
    return {
      code: zod.ZodIssueCode.custom,
      message: duplicateSubscriptionsError,
      fatal: true,
      path: ['topics'],
    }
  }
}

function validateInnerSubscriptions(webhookConfig: WebhooksConfig) {
  const {uri, subscriptions = [], ...schema} = webhookConfig
  const uniqueSubscriptionEndpointSet = new Set()

  // add validated unique top level subscriptions to set
  if (uri && schema.topics?.length) {
    for (const topic of schema.topics) {
      uniqueSubscriptionEndpointSet.add(generateSubscriptionKey(topic, uri))
    }
  }

  if (!subscriptions.length) return

  for (const [i, subscription] of subscriptions.entries()) {
    const path = ['subscriptions', i]

    // If no top-level uris are provided, ensure each subscription has at least one uri
    if (!uri && !subscription.uri) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must include either a top-level uri or an uri per `[[webhooks.subscriptions]]`',
        fatal: true,
        path,
      }
    }

    let finalEndpoint = subscription.uri

    // if there is no uri override, use top level uri. we are sure there will be one from earlier validation
    if (!finalEndpoint) {
      finalEndpoint = uri!
    }

    if (subscription.path && !httpsRegex.test(finalEndpoint)) {
      return {
        code: zod.ZodIssueCode.custom,
        message: 'You must use an https `uri` to use a relative path',
        fatal: true,
        path,
      }
    }

    // concat the path to the uri if it exists to ensure uniqueness
    if (subscription.path) {
      finalEndpoint = `${finalEndpoint}${subscription.path}`
    }

    const key = generateSubscriptionKey(subscription.topic, finalEndpoint)

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
