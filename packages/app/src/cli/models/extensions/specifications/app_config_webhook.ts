import {WebhooksConfigSchema, WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {webhookValidator} from './validation/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {ClientName} from '../../../utilities/developer-platform-client.js'
import {ZodSchemaType} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: transformFromWebhookConfig,
  reverse: (content: object) => transformToWebhookConfig(content),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhooksSchema,
  transformConfig: WebhookTransformConfig,
  customizeSchemaForDevPlatformClient: (platformClientName: ClientName, currentSchema: ZodSchemaType<unknown>) => {
    if (platformClientName === ClientName.Partners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (currentSchema as any).merge(
        zod.object({
          webhooks: WebhooksConfigSchema.superRefine(webhookValidator),
        }),
      )
    }

    return currentSchema
  },
})

export default appWebhooksSpec
