import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {SpecsAppConfiguration} from './types/app_config.js'
import {WebhooksSchemaWithDeclarative, simplifyWebhooks} from './app_config_webhook.js'
import {CustomTransformationConfig, SimplifyConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

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
  globalConfig: true,
  multipleRootPath: 'subscriptions',
})
