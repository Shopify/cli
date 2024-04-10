export interface WebhookSubscription {
  uri: string
  topics?: string[]
  compliance_topics?: string[]
  sub_topic?: string
  include_fields?: string[]
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

export type NormalizedWebhookSubscription = Omit<WebhookSubscription, 'topics'> & {
  topic: string
}
