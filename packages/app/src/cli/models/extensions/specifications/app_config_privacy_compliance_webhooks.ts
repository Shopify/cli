import {WebhookSchema} from './app_config_webhook.js'
import {WebhooksConfig} from './types/app_config_webhook.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

// const PrivacyComplianceWebbhooksTransformConfig: TransformationConfig = {
//   customers_redact_url: 'webhooks.privacy_compliance.customer_deletion_url',
//   customers_data_request_url: 'webhooks.privacy_compliance.customer_data_request_url',
//   shop_redact_url: 'webhooks.privacy_compliance.shop_deletion_url',
// }

const PrivacyComplianceWebbhooksTransformConfig: CustomTransformationConfig = {
  forward: (content: object) => transformToPrivacyComplianceWebhooksModule(content),
  reverse: (content: object) => transformFromPrivacyComplianceWebhooksModule(content),
}

export const PrivacyComplianceWebbhooksSpecIdentifier = 'privacy_compliance_webhooks'

// Uses the same schema as the webhooks specs because its content is nested under the same webhooks section
const spec = createConfigExtensionSpecification({
  identifier: PrivacyComplianceWebbhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: PrivacyComplianceWebbhooksTransformConfig,
})

export default spec

function transformToPrivacyComplianceWebhooksModule(content: object) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  return {
    customers_redact_url: webhooks?.privacy_compliance?.customer_deletion_url,
    customers_data_request_url: webhooks?.privacy_compliance?.customer_data_request_url,
    shop_redact_url: webhooks?.privacy_compliance?.shop_deletion_url,
  }
}

function transformFromPrivacyComplianceWebhooksModule(content: object) {
  const customersRedactUrl = getPathValue(content, 'customers_redact_url') as string
  const customersDataRequestUrl = getPathValue(content, 'customers_data_request_url') as string
  const shopRedactUrl = getPathValue(content, 'shop_redact_url') as string

  if (customersDataRequestUrl?.length > 0 && customersDataRequestUrl?.length > 0 && shopRedactUrl?.length > 0) {
    return {
      webhooks: {
        privacy_compliance: {
          customer_deletion_url: customersRedactUrl,
          customer_data_request_url: customersDataRequestUrl,
          shop_deletion_url: shopRedactUrl,
        },
      },
    }
  }
  return {}
}
