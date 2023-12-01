import {EndpointValidation, removeTrailingSlash} from './utils/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {
  transformToWebhookConfig,
  transformWebhookConfig,
  validateInnerSubscriptions,
  validateTopLevelSubscriptions,
} from '../../../utilities/app/config/webhooks.js'
import {zod} from '@shopify/cli-kit/node/schema'

const TEMP_OMIT_DECLARATIVE_WEBHOOKS_SCHEMA = true

export const WebhookSubscriptionSchema = zod.object({
  topic: zod.string(),
  sub_topic: zod.string().optional(),
  format: zod.enum(['json', 'xml']).optional(),
  include_fields: zod.array(zod.string()).optional(),
  metafield_namespaces: zod.array(zod.string()).optional(),
  endpoint: zod.preprocess(removeTrailingSlash, EndpointValidation),
  path: zod
    .string()
    .refine((path) => path.startsWith('/') && path.length > 1, {
      message: 'Path must start with a forward slash and be longer than 1 character',
    })
    .optional(),
})

const WebhooksSchema = zod.object({
  api_version: zod.string().optional(),
  privacy_compliance: zod
    .object({
      customer_deletion_url: zod.string().optional(),
      customer_data_request_url: zod.string().optional(),
      shop_deletion_url: zod.string().optional(),
    })
    .optional(),
})

const ExtendedWebhooksSchema = WebhooksSchema.extend({
  topics: zod.array(zod.string()).nonempty().optional(),
  endpoint: zod.preprocess(removeTrailingSlash, EndpointValidation),
  subscriptions: zod.array(WebhookSubscriptionSchema).optional(),
}).superRefine((schema, ctx) => {
  // eslint-disable-next-line no-warning-comments
  // TODO - remove once declarative webhooks are live, don't validate properties we are not using yet
  if (TEMP_OMIT_DECLARATIVE_WEBHOOKS_SCHEMA) return

  const topLevelSubscriptionErrors = validateTopLevelSubscriptions(schema)
  if (topLevelSubscriptionErrors) {
    ctx.addIssue(topLevelSubscriptionErrors)
    return zod.NEVER
  }

  const innerSubscriptionErrors = validateInnerSubscriptions(schema)
  if (innerSubscriptionErrors) {
    ctx.addIssue(innerSubscriptionErrors)
    return zod.NEVER
  }
})

export const WebhookSchema = zod.object({
  webhooks: ExtendedWebhooksSchema.optional(),
})

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

const spec = createConfigExtensionSpecification({
  identifier: 'webhooks',
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
})

export default spec
