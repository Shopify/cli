export interface WebhookSubscription {
  uri: string
  topics?: string[]
  actions?: string[]
  compliance_topics?: string[]
  include_fields?: string[]
  filter?: string
  payload_query?: string
}

interface PrivacyComplianceConfig {
  customer_deletion_url?: string
  customer_data_request_url?: string
  shop_deletion_url?: string
}

export interface WebhooksConfig {
  api_version: string
  privacy_compliance?: PrivacyComplianceConfig
  subscriptions?: WebhookSubscription[]
}
