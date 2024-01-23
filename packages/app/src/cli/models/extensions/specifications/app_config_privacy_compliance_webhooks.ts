import {WebhooksSchemaWithDeclarative} from './app_config_webhook.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PrivacyComplianceWebbhooksSchema = zod.object({
  webhooks: WebhooksSchemaWithDeclarative,
})

const PrivacyComplianceWebbhooksTransformConfig: TransformationConfig = {
  customers_redact_url: 'webhooks.privacy_compliance.customer_deletion_url',
  customers_data_request_url: 'webhooks.privacy_compliance.customer_data_request_url',
  shop_redact_url: 'webhooks.privacy_compliance.shop_deletion_url',
}

export const PrivacyComplianceWebbhooksSpecIdentifier = 'privacy_compliance_webhooks'

const spec = createConfigExtensionSpecification({
  identifier: PrivacyComplianceWebbhooksSpecIdentifier,
  schema: PrivacyComplianceWebbhooksSchema,
  transformConfig: PrivacyComplianceWebbhooksTransformConfig,
})

export default spec
