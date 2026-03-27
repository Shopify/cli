/**
 * Webhook Subscription AppModule — the hard case.
 * Dynamic UID, shared 'webhooks' key, splits subscriptions into individual items,
 * cross-module dependency on application_url for relative URI resolution.
 */

import {DynamicAppModule} from '../app-module.js'
import {WebhooksConfig} from '../../extensions/specifications/types/app_config_webhook.js'
import {prependApplicationUrl} from '../../extensions/specifications/validation/url_prepender.js'

// --- TOML shape (per-subscription, after splitting) ---

// Each instance gets a single flattened subscription extracted from the webhooks array.
// This matches what createWebhookSubscriptionInstances produces today.
interface WebhookSubscriptionToml {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}

// --- Contract shape (what the server receives per subscription) ---

interface WebhookSubscriptionContract {
  api_version: string
  uri: string
  topic: string
  sub_topic?: string
  include_fields?: string[]
  filter?: string
  payload_query?: string
  name?: string
  actions?: string[]
}

// --- Module definition ---

export const webhookSubscriptionModule: DynamicAppModule<WebhookSubscriptionToml, WebhookSubscriptionContract> = {
  identifier: 'webhook_subscription',

  tomlKeys: ['webhooks'],

  /**
   * Extract individual webhook subscriptions from the shared webhooks section.
   * This replaces the hardcoded createWebhookSubscriptionInstances() in loader.ts.
   *
   * Each multi-topic subscription is split into individual single-topic items.
   * Compliance topics are excluded (handled by privacy_compliance_webhooks module).
   */
  extract(content) {
    const webhooks = (content as {webhooks?: WebhooksConfig}).webhooks
    if (!webhooks?.subscriptions) return undefined

    const apiVersion = webhooks.api_version
    const items: WebhookSubscriptionToml[] = []

    for (const subscription of webhooks.subscriptions) {
      // compliance_topics are handled by the privacy_compliance_webhooks module
      const {uri, topics, compliance_topics: _, ...optionalFields} = subscription
      if (!topics) continue

      for (const topic of topics) {
        items.push({
          api_version: apiVersion,
          uri,
          topic,
          ...optionalFields,
        })
      }
    }

    return items.length > 0 ? items : undefined
  },

  async encode(toml, context) {
    // Resolve relative URIs using application_url from app config
    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    return {
      ...toml,
      uri: prependApplicationUrl(toml.uri, appUrl),
    }
  },

  decode(contract) {
    // Reverse: convert singular topic back to topics array, wrap in webhooks structure.
    // api_version is discarded in the reverse (it comes from the webhooks module).
    const {api_version: _, topic, ...rest} = contract
    return {
      webhooks: {
        subscriptions: [
          {
            topics: [topic],
            ...rest,
          },
        ],
      },
    } as unknown as WebhookSubscriptionToml
  },

  uidStrategy: 'dynamic',
}
