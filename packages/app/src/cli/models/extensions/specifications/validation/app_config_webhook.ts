import {zod} from '@shopify/cli-kit/node/schema'
import {uniq} from '@shopify/cli-kit/common/array'
import type {WebhooksConfig} from '../types/app_config_webhook.js'

export function webhookValidator(schema: object, ctx: zod.RefinementCtx, acceptedApiVersions: string[]) {
  const webhooksConfig = schema as WebhooksConfig
  const apiVersionError = validateApiVersion(webhooksConfig.api_version, acceptedApiVersions)
  const webhookSubscriptionErrors = validateSubscriptions(webhooksConfig)

  if (webhookSubscriptionErrors) {
    ctx.addIssue(webhookSubscriptionErrors)
    return zod.NEVER
  }
  if (apiVersionError) {
    ctx.addIssue(apiVersionError)
    return zod.NEVER
  }
}

export function validateApiVersion(apiVersion: string, acceptedApiVersions: string[]) {
  if (!acceptedApiVersions.includes(apiVersion)) {
    return {
      code: zod.ZodIssueCode.custom,
      message: `The api_version is an invalid version`,
      fatal: true,
    }
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
  for (const [i, {uri, topics = [], compliance_topics = [], filter = ''}] of subscriptions.entries()) {
    const path = ['subscriptions', i]

    if (!topics.length && !compliance_topics.length) {
      return {
        code: zod.ZodIssueCode.custom,
        message: `Either topics or compliance_topics must be added to the webhook subscription`,
        path,
      }
    }

    for (const [j, topic] of topics.entries()) {
      const key = `${topic}::${uri}::${filter}`

      if (uniqueSubscriptionSet.has(key)) {
        return {
          code: zod.ZodIssueCode.custom,
          message: 'You can’t have duplicate subscriptions with the exact same `topic`, `uri` and `filter`',
          fatal: true,
          path: [...path, 'topics', j, topic],
        }
      }

      uniqueSubscriptionSet.add(key)
    }
  }
}
