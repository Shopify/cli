export interface WebhookSubscription {
  topics: string[]
  uri: string
  sub_topic?: string
  include_fields?: string[]
  metafield_namespaces?: string[]
  compliance_topics?: string[]
}

export interface PrivacyComplianceConfig {
  customer_deletion_url?: string
  customer_data_request_url?: string
  shop_deletion_url?: string
}

export interface WebhooksConfig {
  api_version: string
  privacy_compliance?: PrivacyComplianceConfig
  subscriptions?: WebhookSubscription[]
}

export type NormalizedWebhookSubscription = Omit<WebhookSubscription, 'topics'> & {
  topic: string
}
