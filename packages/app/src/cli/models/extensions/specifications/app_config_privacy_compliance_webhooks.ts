import {WebhookSchema} from './app_config_webhook.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const PrivacyComplianceWebbhooksTransformConfig: TransformationConfig = {
  customers_redact_url: 'webhooks.privacy_compliance.customer_deletion_url',
  customers_data_request_url: 'webhooks.privacy_compliance.customer_data_request_url',
  shop_redact_url: 'webhooks.privacy_compliance.shop_deletion_url',
}

export const PrivacyComplianceWebbhooksSpecIdentifier = 'privacy_compliance_webhooks'

// Uses the same schema as the webhooks specs because its content is nested under the same webhooks section
const spec = createConfigExtensionSpecification({
  identifier: PrivacyComplianceWebbhooksSpecIdentifier,
  schema: WebhookSchema,
  transformConfig: PrivacyComplianceWebbhooksTransformConfig,
})

export default spec
