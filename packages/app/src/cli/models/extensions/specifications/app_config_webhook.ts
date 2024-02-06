import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {UriValidation, removeTrailingSlash} from './validation/common.js'
import {webhookValidator} from './validation/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export enum ComplianceTopic {
  CustomersRedact = 'customers/redact',
  CustomersDataRequest = 'customers/data_request',
  ShopRedact = 'shop/redact',
}

const WebhookSubscriptionSchema = zod.object({
  topics: zod
    .array(zod.string({invalid_type_error: 'Values within array must be a string'}), {
      invalid_type_error: 'Value must be string[]',
    })
    .nonempty({message: "Value can't be empty"}),
  uri: zod.preprocess(removeTrailingSlash, UriValidation, {required_error: 'Missing value at'}),
  sub_topic: zod.string({invalid_type_error: 'Value must be a string'}).optional(),
  include_fields: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  metafield_namespaces: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  compliance_topics: zod
    .array(
      zod.enum([ComplianceTopic.CustomersRedact, ComplianceTopic.CustomersDataRequest, ComplianceTopic.ShopRedact]),
      {
        invalid_type_error:
          'Value must be an array containing values: customers/redact, customers/data_request or shop/redact',
      },
    )
    .optional(),
})

const WebhooksSchema = zod.object({
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

export const WebhooksSchemaWithDeclarative = WebhooksSchema.superRefine(webhookValidator)

export const WebhookSchema = zod.object({
  webhooks: WebhooksSchemaWithDeclarative,
})

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
})

export default appWebhooksSpec
