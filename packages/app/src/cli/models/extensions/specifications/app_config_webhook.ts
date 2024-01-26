import {transformToWebhookConfig, transformWebhookConfig} from './transform/app_config_webhook.js'
import {UriValidation, removeTrailingSlash} from './validation/common.js'
import {webhookValidator} from './validation/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const WebhookSubscriptionSchema = zod.object({
  topics: zod.array(zod.string()).nonempty(),
  uri: zod.preprocess(removeTrailingSlash, UriValidation),
  sub_topic: zod.string().optional(),
  include_fields: zod.array(zod.string()).optional(),
  metafield_namespaces: zod.array(zod.string()).optional(),
  compliance_topics: zod.array(zod.enum(['customers/redact', 'customers/data_request', 'shop/redact'])).optional(),
})

const WebhooksSchema = zod.object({
  api_version: zod.string(),
  privacy_compliance: zod
    .object({
      customer_deletion_url: UriValidation.optional(),
      customer_data_request_url: UriValidation.optional(),
      shop_deletion_url: UriValidation.optional(),
    })
    .optional(),
  subscriptions: zod.array(WebhookSubscriptionSchema).optional(),
})

export const WebhooksSchemaWithDeclarative = WebhooksSchema.superRefine(webhookValidator)

export const WebhookSchema = zod.object({
  webhooks: WebhooksSchemaWithDeclarative,
})

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

const spec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
})

export default spec
