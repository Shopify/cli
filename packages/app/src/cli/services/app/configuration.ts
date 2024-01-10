import {AppConfiguration} from '../../models/app/app.js'
import {AppProxy} from '../dev/urls.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

export function getAppProxyConfiguration(configuration: AppConfiguration): AppProxy | undefined {
  if (!getPathValue(configuration, 'app_proxy')) return undefined
  return {
    proxyUrl: getPathValue(configuration, 'app_proxy.url')!,
    proxySubPathPrefix: getPathValue(configuration, 'app_proxy.prefix')!,
    proxySubPath: getPathValue(configuration, 'app_proxy.subpath')!,
  }
}

export function getHomeConfiguration(configuration: AppConfiguration) {
  return {
    applicationUrl: getPathValue<string>(configuration, 'application_url')!,
    embedded: getPathValue<boolean>(configuration, 'embedded')!,
    preferencesUrl: getPathValue<string>(configuration, 'app_preferences.url'),
  }
}

export function getPosConfiguration(configuration: AppConfiguration) {
  return {
    embedded: getPathValue<boolean>(configuration, 'pos.embedded'),
  }
}

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

export function getWebhooksConfig(configuration: AppConfiguration) {
  return getPathValue<WebhooksConfig>(configuration, 'webhooks')!
}

export function getWebhooksSubscriptions(subscriptions: object) {
  return getPathValue<WebhookSubscription[]>(subscriptions, 'subscriptions')!
}
