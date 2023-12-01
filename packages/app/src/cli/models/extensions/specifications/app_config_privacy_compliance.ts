import {WebhookSchema} from './app_config_webhook.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const PrivacyComplianceTransformConfig: TransformationConfig = {
  schema: {
    customers_redact_url: 'webhooks.privacy_compliance.customer_deletion_url',
    customers_data_request_url: 'webhooks.privacy_compliance.customer_data_request_url',
    shop_redact_url: 'webhooks.privacy_compliance.shop_deletion_url',
  },
}

const PrivacyComplianceValidateConfig = {
  'privacy_compliance.customer_deletion_url': 'url',
  'privacy_compliance.customer_data_request_url': 'url',
  'privacy_compliance.shop_deletion_url': 'url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'privacy_compliance_webhooks',
  schema: WebhookSchema,
  transformConfig: PrivacyComplianceTransformConfig,
  validateConfig: PrivacyComplianceValidateConfig,
})

export default spec
