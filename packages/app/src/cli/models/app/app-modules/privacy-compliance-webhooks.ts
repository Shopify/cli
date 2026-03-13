import {AppModule, EncodeContext} from '../app-module.js'
import {WebhooksSchema} from '../../extensions/specifications/app_config_webhook_schemas/webhooks_schema.js'
import {WebhooksConfig, WebhookSubscription} from '../../extensions/specifications/types/app_config_webhook.js'
import {ComplianceTopic} from '../../extensions/specifications/app_config_webhook_schemas/webhook_subscription_schema.js'
import {mergeAllWebhooks} from '../../extensions/specifications/transform/app_config_webhook.js'
import {removeTrailingSlash} from '../../extensions/specifications/validation/common.js'
import {compact} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'

type PrivacyComplianceToml = zod.infer<typeof WebhooksSchema>

interface PrivacyComplianceContract {
  api_version?: string
  customers_redact_url?: string
  customers_data_request_url?: string
  shop_redact_url?: string
}

function relativeUri(uri?: string, appUrl?: string) {
  return appUrl && uri?.startsWith('/') ? `${removeTrailingSlash(appUrl)}${uri}` : uri
}

function getComplianceUri(webhooks: WebhooksConfig, complianceTopic: string): string | undefined {
  return webhooks.subscriptions?.find((sub) => sub.compliance_topics?.includes(complianceTopic))?.uri
}

class PrivacyComplianceWebhooksModule extends AppModule<PrivacyComplianceToml, PrivacyComplianceContract> {
  constructor() {
    super({identifier: 'privacy_compliance_webhooks', uidStrategy: 'single', tomlKeys: ['webhooks']})
  }

  extract(content: {[key: string]: unknown}) {
    const webhooks = (content as {webhooks?: WebhooksConfig}).webhooks
    if (!webhooks) return undefined

    // Only present when there are compliance subscriptions or legacy privacy_compliance config
    const hasComplianceSubscriptions = webhooks.subscriptions?.some(
      (sub) => sub.compliance_topics && sub.compliance_topics.length > 0,
    )
    const hasCompliance = hasComplianceSubscriptions === true || webhooks.privacy_compliance !== undefined
    if (!hasCompliance) return undefined

    return {webhooks} as unknown as PrivacyComplianceToml
  }

  async encode(toml: PrivacyComplianceToml, context: EncodeContext) {
    const webhooks = toml.webhooks as WebhooksConfig | undefined
    if (!webhooks) return {}

    let appUrl: string | undefined
    if ('application_url' in context.appConfiguration) {
      appUrl = (context.appConfiguration as {application_url?: string}).application_url
    }

    const customersRedactUrl =
      getComplianceUri(webhooks, 'customers/redact') ?? webhooks?.privacy_compliance?.customer_deletion_url
    const customersDataRequestUrl =
      getComplianceUri(webhooks, 'customers/data_request') ?? webhooks?.privacy_compliance?.customer_data_request_url
    const shopRedactUrl = getComplianceUri(webhooks, 'shop/redact') ?? webhooks?.privacy_compliance?.shop_deletion_url

    const urls = compact({
      customers_redact_url: relativeUri(customersRedactUrl, appUrl),
      customers_data_request_url: relativeUri(customersDataRequestUrl, appUrl),
      shop_redact_url: relativeUri(shopRedactUrl, appUrl),
    })

    if (Object.keys(urls).length === 0) return urls

    return {
      api_version: webhooks.api_version,
      ...urls,
    }
  }

  decode(contract: PrivacyComplianceContract) {
    const webhooks: WebhookSubscription[] = []
    if (contract.customers_data_request_url) {
      webhooks.push({
        compliance_topics: [ComplianceTopic.CustomersDataRequest],
        uri: contract.customers_data_request_url,
      })
    }
    if (contract.customers_redact_url) {
      webhooks.push({compliance_topics: [ComplianceTopic.CustomersRedact], uri: contract.customers_redact_url})
    }
    if (contract.shop_redact_url) {
      webhooks.push({compliance_topics: [ComplianceTopic.ShopRedact], uri: contract.shop_redact_url})
    }

    if (webhooks.length === 0) return {} as PrivacyComplianceToml
    return {
      webhooks: {subscriptions: mergeAllWebhooks(webhooks), privacy_compliance: undefined},
    } as unknown as PrivacyComplianceToml
  }
}

export const privacyComplianceWebhooksModule = new PrivacyComplianceWebhooksModule()
