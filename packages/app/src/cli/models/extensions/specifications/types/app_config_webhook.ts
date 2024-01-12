export interface WebhookSubscription {
  topic: string
  uri?: string
  sub_topic?: string
  include_fields?: string[]
  metafield_namespaces?: string[]
  path?: string
}

export interface PrivacyComplianceConfig {
  customer_deletion_url?: string
  customer_data_request_url?: string
  shop_deletion_url?: string
}

export interface WebhooksConfig {
  api_version: string
  privacy_compliance?: PrivacyComplianceConfig
  topics?: string[]
  uri?: string
  subscriptions?: WebhookSubscription[]
}
