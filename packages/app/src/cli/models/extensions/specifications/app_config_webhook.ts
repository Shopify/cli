import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {transformToWebhookConfig, transformFromWebhookConfig} from './transform/app_config_webhook.js'
import {ComplianceTopic} from './app_config_webhook_schemas/webhook_subscription_schema.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'

export const WebhooksSpecIdentifier = 'webhooks'

const WebhookTransformConfig: CustomTransformationConfig = {
  forward: transformFromWebhookConfig,
  reverse: (content: object) => transformToWebhookConfig(content),
}

const appWebhooksSpec = createConfigExtensionSpecification({
  identifier: WebhooksSpecIdentifier,
  schema: WebhooksSchema,
  transformConfig: WebhookTransformConfig,
  hardcodedInputJsonSchema: JSON.stringify({
    type: 'object',
    properties: {
      webhooks: {
        type: 'object',
        properties: {
          api_version: {type: 'string'},
          subscriptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topics: {type: 'array', items: {type: 'string'}},
                uri: {type: 'string', format: 'uri-reference'},
                include_fields: {type: 'array', items: {type: 'string'}},
                filter: {type: 'string'},
                compliance_topics: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      ComplianceTopic.CustomersRedact,
                      ComplianceTopic.CustomersDataRequest,
                      ComplianceTopic.ShopRedact,
                    ],
                  },
                },
              },
              required: ['uri'],
            },
          },
        },
        required: ['api_version'],
      },
    },
  }),
})

export default appWebhooksSpec
