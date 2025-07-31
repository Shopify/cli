import {WebhookSubscriptionSchema} from './webhook_subscription_schema.js'
import {webhookValidator} from '../validation/app_config_webhook.js'
import {WebhookSubscriptionUriValidation} from '../validation/common.js'
import {SingleWebhookSubscriptionSchema} from '../app_config_webhook_subscription.js'
import {mergeAllWebhooks} from '../transform/app_config_webhook.js'
import {BaseSchema} from '../../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const WebhooksConfigSchema = zod.object({
  api_version: zod.string({
    error: (issue) => {
      if (issue.code === 'invalid_type' && issue.received === 'undefined') {
        return 'String is required'
      }
      return issue.message
    },
  }),
  privacy_compliance: zod
    .object({
      customer_deletion_url: WebhookSubscriptionUriValidation.optional(),
      customer_data_request_url: WebhookSubscriptionUriValidation.optional(),
      shop_deletion_url: WebhookSubscriptionUriValidation.optional(),
    })
    .optional(),
  subscriptions: zod
    .array(WebhookSubscriptionSchema)
    .optional()
    .transform((value) => mergeAllWebhooks(value ?? [])),
})

export type SingleWebhookSubscriptionType = zod.infer<typeof SingleWebhookSubscriptionSchema>

export const WebhooksSchema = BaseSchema.extend({
  webhooks: WebhooksConfigSchema.superRefine(webhookValidator),
})
