import {WebhookSubscription, WebhooksConfig} from './types/app_config_webhook.js'
import {WebhooksSchema} from './app_config_webhook_schemas/webhooks_schema.js'
import {ComplianceTopic} from './app_config_webhook_schemas/webhook_subscription_schema.js'
import {mergeAllWebhooks} from './transform/app_config_webhook.js'
import {removeTrailingSlash} from './validation/common.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {AppConfigurationWithoutPath, CurrentAppConfiguration} from '../../app/app.js'
import {compact, getPathValue} from '@shopify/cli-kit/common/object'

const PrivacyComplianceWebhooksTransformConfig: CustomTransformationConfig = {
  forward: transformToPrivacyComplianceWebhooksModule,
  reverse: (content: object) => transformFromPrivacyComplianceWebhooksModule(content),
}

export const PrivacyComplianceWebhooksSpecIdentifier = 'privacy_compliance_webhooks'

// Uses the same schema as the webhooks specs because its content is nested under the same webhooks section
const appPrivacyComplienceSpec = createConfigExtensionSpecification({
  identifier: PrivacyComplianceWebhooksSpecIdentifier,
  schema: WebhooksSchema,
  transformConfig: PrivacyComplianceWebhooksTransformConfig,
})

export default appPrivacyComplienceSpec

function transformToPrivacyComplianceWebhooksModule(content: object, appConfiguration: AppConfigurationWithoutPath) {
  const webhooks = getPathValue(content, 'webhooks') as WebhooksConfig
  let appUrl: string | undefined
  if ('application_url' in appConfiguration) {
    appUrl = (appConfiguration as CurrentAppConfiguration)?.application_url
  }

  const urls = compact({
    customers_redact_url: relativeUri(getCustomersDeletionUri(webhooks), appUrl),
    customers_data_request_url: relativeUri(getCustomersDataRequestUri(webhooks), appUrl),
    shop_redact_url: relativeUri(getShopDeletionUri(webhooks), appUrl),
  })

  if (Object.keys(urls).length === 0) {
    return urls
  } else {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const {api_version} = webhooks
    return {
      api_version,
      ...urls,
    }
  }
}

function transformFromPrivacyComplianceWebhooksModule(content: object) {
  const customersRedactUrl = getPathValue(content, 'customers_redact_url') as string
  const customersDataRequestUrl = getPathValue(content, 'customers_data_request_url') as string
  const shopRedactUrl = getPathValue(content, 'shop_redact_url') as string

  const webhooks: WebhookSubscription[] = []
  if (customersDataRequestUrl) {
    webhooks.push({compliance_topics: [ComplianceTopic.CustomersDataRequest], uri: customersDataRequestUrl})
  }
  if (customersRedactUrl) {
    webhooks.push({compliance_topics: [ComplianceTopic.CustomersRedact], uri: customersRedactUrl})
  }
  if (shopRedactUrl) {
    webhooks.push({compliance_topics: [ComplianceTopic.ShopRedact], uri: shopRedactUrl})
  }

  if (webhooks.length === 0) return {}
  return {webhooks: {subscriptions: mergeAllWebhooks(webhooks), privacy_compliance: undefined}}

  // if (customersRedactUrl || customersDataRequestUrl || shopRedactUrl) {
  //   return {
  //     webhooks: {
  //       privacy_compliance: {
  //         ...(customersRedactUrl ? {customer_deletion_url: customersRedactUrl} : {}),
  //         ...(customersDataRequestUrl ? {customer_data_request_url: customersDataRequestUrl} : {}),
  //         ...(shopRedactUrl ? {shop_deletion_url: shopRedactUrl} : {}),
  //       },
  //     },
  //   }
  // }
  // return {}
}

function getComplianceUri(webhooks: WebhooksConfig, complianceTopic: string): string | undefined {
  return webhooks.subscriptions?.find((subscription) => subscription.compliance_topics?.includes(complianceTopic))?.uri
}

function relativeUri(uri?: string, appUrl?: string) {
  return appUrl && uri?.startsWith('/') ? `${removeTrailingSlash(appUrl)}${uri}` : uri
}

function getCustomersDeletionUri(webhooks: WebhooksConfig) {
  return getComplianceUri(webhooks, 'customers/redact') || webhooks?.privacy_compliance?.customer_deletion_url
}

function getCustomersDataRequestUri(webhooks: WebhooksConfig) {
  return getComplianceUri(webhooks, 'customers/data_request') || webhooks?.privacy_compliance?.customer_data_request_url
}

function getShopDeletionUri(webhooks: WebhooksConfig) {
  return getComplianceUri(webhooks, 'shop/redact') || webhooks?.privacy_compliance?.shop_deletion_url
}
