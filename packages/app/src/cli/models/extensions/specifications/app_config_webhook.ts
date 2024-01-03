import {WebhookSchema, WebhooksSpecIdentifier} from './types/app_config_webhooks.js'
import {transformToWebhookConfig, transformWebhookConfig} from './transform/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformWebhookConfig(content),
  reverse: (content: object) => transformToWebhookConfig(content),
}

const spec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: WebhookTransformConfig,
  position: 1,
})

export default spec
