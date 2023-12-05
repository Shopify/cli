import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {AppSchema} from '../../app/app.js'

const WebhookSchema = AppSchema.pick({webhooks: true}).strip()

const PrivacyComplianceTransformConfig: TransformationConfig = {
  customers_redact_url: 'webhooks.privacy_compliance.customer_deletion_url',
  customers_data_request_url: 'webhooks.privacy_compliance.customer_data_request_url',
  shop_redact_url: 'webhooks.privacy_compliance.shop_deletion_url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'privacy_compliance_webhooks',
  schema: WebhookSchema,
  transformConfig: PrivacyComplianceTransformConfig,
})

export default spec
