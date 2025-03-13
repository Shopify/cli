import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: transformFromWebhookConfig,
  reverse: (content: object) => transformToWebhookConfig(content),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhooksSchema.extend({
    name: zod.string().optional().default(WebhooksSpecIdentifier),
    type: zod.string().optional().default(WebhooksSpecIdentifier),
  }),
  transformConfig: WebhookTransformConfig,
})

export default appWebhooksSpec
