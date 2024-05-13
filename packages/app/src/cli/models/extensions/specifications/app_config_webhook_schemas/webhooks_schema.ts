import {WebhookSubscriptionSchema} from './webhook_subscription_schema.js'
import {webhookValidator} from '../validation/app_config_webhook.js'
import {UriValidation} from '../validation/common.js'
import {SingleWebhookSubscriptionSchema} from '../app_config_webhook_subscription.js'
import {zod} from '@shopify/cli-kit/node/schema'

const WebhooksConfigSchema = zod
  .object({
    api_version: zod.string({required_error: 'String is required'}),
    privacy_compliance: zod
      .object({
        customer_deletion_url: UriValidation.optional(),
        customer_data_request_url: UriValidation.optional(),
        shop_deletion_url: UriValidation.optional(),
      })
      .optional(),
    subscriptions: zod.array(WebhookSubscriptionSchema).optional(),
  })
  .transform((value) => {
    // Transform subscriptions from condensed state to expanded state (only 1 topic per subscription)
    const expandedSubscriptions = value.subscriptions?.flatMap((subscription) => {
      const {topics = [], ...otherFields} = subscription
      if (topics.length === 0) return subscription
      return topics.map((topic) => {
        return {topics: [topic], ...otherFields}
      })
    })
    return {...value, subscriptions: expandedSubscriptions}
  })

export type SingleWebhookSubscriptionType = zod.infer<typeof SingleWebhookSubscriptionSchema>

export const WebhooksSchema = zod.object({
  webhooks: WebhooksConfigSchema.superRefine(webhookValidator),
})
