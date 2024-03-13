import {zod} from '@shopify/cli-kit/node/schema'
import {uniq} from '@shopify/cli-kit/common/array'
import type {WebhooksConfig} from '../types/app_config_webhook.js'

export function webhookValidator(schema: object, ctx: zod.RefinementCtx) {
  const webhookSubscriptionErrors = validateSubscriptions(schema as WebhooksConfig)

  if (webhookSubscriptionErrors) {
    ctx.addIssue(webhookSubscriptionErrors)
    return zod.NEVER
  }
}

function validateSubscriptions(webhookConfig: WebhooksConfig) {
  const {subscriptions = []} = webhookConfig
  const uniqueSubscriptionSet = new Set()

  if (!subscriptions.length) return

  if (
    webhookConfig.privacy_compliance &&
    webhookConfig.subscriptions?.some((subscription) => subscription.compliance_topics)
  ) {
    return {
      code: zod.ZodIssueCode.custom,
      message: `The privacy_compliance section can't be used if there are subscriptions including compliance_topics`,
    }
  }

  const complianceTopics = subscriptions.flatMap((subscription) => subscription.compliance_topics).filter(Boolean)
  if (uniq(complianceTopics).length !== complianceTopics.length) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'You can’t have multiple subscriptions with the same compliance topic',
      fatal: true,
      path: ['subscriptions'],
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  for (const [i, {uri, topics = [], compliance_topics = [], sub_topic = ''}] of subscriptions.entries()) {
    const path = ['subscriptions', i]

    if (!topics.length && !compliance_topics.length) {
      return {
        code: zod.ZodIssueCode.custom,
        message: `Either topics or compliance_topics must be added to the webhook subscription`,
        path,
      }
    }

    for (const [j, topic] of topics.entries()) {
      const key = `${topic}::${sub_topic}::${uri}`

      if (uniqueSubscriptionSet.has(key)) {
        return {
          code: zod.ZodIssueCode.custom,
          message: 'You can’t have duplicate subscriptions with the exact same `topic` and `uri`',
          fatal: true,
          path: [...path, 'topics', j, topic],
        }
      }

      uniqueSubscriptionSet.add(key)
    }
  }
}
