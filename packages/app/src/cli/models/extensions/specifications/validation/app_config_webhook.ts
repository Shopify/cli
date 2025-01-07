import {zod} from '@shopify/cli-kit/node/schema'
import {uniq} from '@shopify/cli-kit/common/array'
import colors from '@shopify/cli-kit/node/colors'
import type {WebhooksConfig} from '../types/app_config_webhook.js'

export function webhookValidator(schema: object, ctx: zod.RefinementCtx) {
  const webhookSubscriptionErrors = validateSubscriptions(schema as WebhooksConfig)

  if (webhookSubscriptionErrors) {
    ctx.addIssue(webhookSubscriptionErrors)
    return zod.NEVER
  }
}

function validateSubscriptions(webhookConfig: WebhooksConfig) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {subscriptions = [], api_version} = webhookConfig

  const hasMetafields = subscriptions.some((sub) => sub.metafields && sub.metafields.length > 0)
  if (hasMetafields && !isVersionGreaterOrEqual(api_version, '2025-04')) {
    return {
      code: zod.ZodIssueCode.custom,
      message: 'Webhook metafields are only supported in API version 2025-04 or later, or with version "unstable"',
      path: ['api_version'],
    }
  }

  const uniqueSubscriptionSet = new Set()
  const duplicatedSubscriptionsFields: string[] = []

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

    topics.forEach((topic) => {
      const key = `${topic}::${uri}::${filter}`

      if (uniqueSubscriptionSet.has(key)) {
        const subscriptionFieldsString = filter
          ? colors.dim(`\n\ntopic: ${topic}\nuri: ${uri}\nfilter: ${filter}`)
          : colors.dim(`\n\ntopic: ${topic}\nuri: ${uri}`)

        duplicatedSubscriptionsFields.push(subscriptionFieldsString)
      }

      uniqueSubscriptionSet.add(key)
    })
  }

  if (duplicatedSubscriptionsFields.length > 0) {
    const fieldsArrToString = duplicatedSubscriptionsFields.join('')

    return {
      code: zod.ZodIssueCode.custom,
      message: `Multiple subscriptions with the exact same topic, uri, and filter. To resolve, remove or edit the duplicates ${fieldsArrToString}`,
      path: ['subscriptions'],
    }
  }
}

function isVersionGreaterOrEqual(version: string, minVersion: string): boolean {
  if (version === 'unstable') return true
  const [versionYear = 0, versionMonth = 0] = version.split('-').map(Number)
  const [minYear = 0, minMonth = 0] = minVersion.split('-').map(Number)
  return versionYear > minYear || (versionYear === minYear && versionMonth >= minMonth)
}
