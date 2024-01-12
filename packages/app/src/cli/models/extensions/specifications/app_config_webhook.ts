import {transformToWebhookConfig, transformWebhookConfig} from './transform/app_config_webhook.js'
import {UriValidation, ensureHttpsOnlyUrl, removeTrailingSlash} from './validation/common.js'
import {validateWebhookSubscriptions} from './validation/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const WebhooksSchema = zod.object({
  api_version: zod.string(),
  privacy_compliance: zod
    .object({
      customer_deletion_url: ensureHttpsOnlyUrl.optional(),
      customer_data_request_url: ensureHttpsOnlyUrl.optional(),
      shop_deletion_url: ensureHttpsOnlyUrl.optional(),
    })
    .optional(),
})

const WebhookSubscriptionSchema = zod.object({
  topic: zod.string(),
  uri: zod.preprocess(removeTrailingSlash, UriValidation).optional(),
  sub_topic: zod.string().optional(),
  include_fields: zod.array(zod.string()).optional(),
  metafield_namespaces: zod.array(zod.string()).optional(),
  path: zod
    .string()
    .refine((path) => path.startsWith('/') && path.length > 1, {
      message: 'Path must start with a forward slash and be longer than 1 character',
    })
    .optional(),
})

const DeclarativeWebhooksSchema = zod.object({
  topics: zod.array(zod.string()).nonempty().optional(),
  uri: zod.preprocess(removeTrailingSlash, UriValidation).optional(),
  subscriptions: zod.array(WebhookSubscriptionSchema).optional(),
})

const WebhooksSchemaWithDeclarative =
  WebhooksSchema.merge(DeclarativeWebhooksSchema).superRefine(validateWebhookSubscriptions)

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
