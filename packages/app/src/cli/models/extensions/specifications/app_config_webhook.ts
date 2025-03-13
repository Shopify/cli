import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseConfigType, ZodSchemaType} from '../schemas.js'

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: transformFromWebhookConfig,
  reverse: (content: object) => transformToWebhookConfig(content),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhooksSchema as unknown as ZodSchemaType<BaseConfigType>,
  transformConfig: WebhookTransformConfig,
})

export default appWebhooksSpec
