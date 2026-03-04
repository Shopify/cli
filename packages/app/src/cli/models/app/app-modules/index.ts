import {brandingModule} from './branding.js'
import {eventsModule} from './events.js'
import {webhookSubscriptionModule} from './webhook-subscription.js'
import {pointOfSaleModule} from './point-of-sale.js'
import {appHomeModule} from './app-home.js'
import {appAccessModule} from './app-access.js'
import {webhooksModule} from './webhooks.js'
import {appProxyModule} from './app-proxy.js'
import {privacyComplianceWebhooksModule} from './privacy-compliance-webhooks.js'
import {AnyAppModule} from '../app-module.js'

export {brandingModule} from './branding.js'
export {eventsModule} from './events.js'
export {webhookSubscriptionModule} from './webhook-subscription.js'
export {pointOfSaleModule} from './point-of-sale.js'
export {appHomeModule} from './app-home.js'
export {appAccessModule} from './app-access.js'
export {webhooksModule} from './webhooks.js'
export {appProxyModule} from './app-proxy.js'
export {privacyComplianceWebhooksModule} from './privacy-compliance-webhooks.js'

// Sorted to match SORTED_CONFIGURATION_SPEC_IDENTIFIERS in load-specifications.ts
// Config modules only — non-config extension modules added in Phase 2
export const allAppModules: AnyAppModule[] = [
  brandingModule,
  appAccessModule,
  webhooksModule,
  webhookSubscriptionModule,
  eventsModule,
  privacyComplianceWebhooksModule,
  appProxyModule,
  pointOfSaleModule,
  appHomeModule,
]
