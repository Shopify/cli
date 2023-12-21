import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {transformToWebhookConfig, transformWebhookConfig} from '../../../utilities/app/config/webhooks.js'
import {AppSchema} from '../../app/app.js'

export const WebhookSchema = AppSchema.pick({webhooks: true}).strip()

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
