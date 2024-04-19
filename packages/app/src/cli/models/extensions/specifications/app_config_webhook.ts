import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {UriValidation, removeTrailingSlash} from './validation/common.js'
import {webhookValidator} from './validation/app_config_webhook.js'
import {WebhookSubscription} from './types/app_config_webhook.js'
import {SpecsAppConfiguration} from './types/app_config.js'
import {CustomTransformationConfig, SimplifyConfig, createConfigExtensionSpecification} from '../specification.js'
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
    .optional(),
  uri: zod.preprocess(removeTrailingSlash, UriValidation, {required_error: 'Missing value at'}),
  sub_topic: zod.string({invalid_type_error: 'Value must be a string'}).optional(),
  include_fields: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
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

const WebhooksSchemaWithDeclarative = WebhooksSchema.superRefine(webhookValidator)

export const WebhookSchema = zod.object({
  webhooks: WebhooksSchemaWithDeclarative,
})

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformFromWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

export const WebhookSimplifyConfig: SimplifyConfig = {
  simplify: (remoteConfig: SpecsAppConfiguration) => simplifyWebhooks(remoteConfig),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
  simplify: WebhookSimplifyConfig,
})

export default appWebhooksSpec

function simplifyWebhooks(remoteConfig: SpecsAppConfiguration) {
  if (!remoteConfig.webhooks?.subscriptions) return remoteConfig

  remoteConfig.webhooks.subscriptions = mergeWebhooks(remoteConfig.webhooks.subscriptions)
  return remoteConfig
}

function mergeWebhooks(subscriptions: WebhookSubscription[]): WebhookSubscription[] {
  return subscriptions.reduce((accumulator, subscription) => {
    const existingSubscription = accumulator.find(
      (sub) =>
        sub.uri === subscription.uri &&
        sub.sub_topic === subscription.sub_topic &&
        sub.include_fields === subscription.include_fields,
    )
    if (existingSubscription) {
      if (subscription.compliance_topics) {
        existingSubscription.compliance_topics ??= []
        existingSubscription.compliance_topics.push(...subscription.compliance_topics)
      }
      if (subscription.topics) {
        existingSubscription.topics ??= []
        existingSubscription.topics.push(...subscription.topics)
      }
    } else {
      accumulator.push(subscription)
    }
    return accumulator
  }, [] as WebhookSubscription[])
}
