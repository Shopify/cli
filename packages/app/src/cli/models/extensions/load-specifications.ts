import {ExtensionSpecification} from './specification.js'
import appHomeSpec, {AppHomeSpecIdentifier} from './specifications/app_config_app_home.js'
import appProxySpec, {AppProxySpecIdentifier} from './specifications/app_config_app_proxy.js'
import appPOSSpec, {PosSpecIdentifier} from './specifications/app_config_point_of_sale.js'
import appWebhooksSpec, {WebhooksSpecIdentifier} from './specifications/app_config_webhook.js'
import appWebhookSubscriptionSpec, {
  WebhookSubscriptionSpecIdentifier,
} from './specifications/app_config_webhook_subscription.js'
import appBrandingSpec, {BrandingSpecIdentifier} from './specifications/app_config_branding.js'
import appAccessSpec, {AppAccessSpecIdentifier} from './specifications/app_config_app_access.js'
import appPrivacyComplienceSpec, {
  PrivacyComplianceWebhooksSpecIdentifier,
} from './specifications/app_config_privacy_compliance_webhooks.js'
import checkoutPostPurchaseSpec from './specifications/checkout_post_purchase.js'
import checkoutSpec from './specifications/checkout_ui_extension.js'
import flowActionSpecification from './specifications/flow_action.js'
import flowTemplateSpec from './specifications/flow_template.js'
import flowTriggerSpecification from './specifications/flow_trigger.js'
import functionSpec from './specifications/function.js'
import paymentExtensionSpec from './specifications/payments_app_extension.js'
import posUISpec from './specifications/pos_ui_extension.js'
import productSubscriptionSpec from './specifications/product_subscription.js'
import taxCalculationSpec from './specifications/tax_calculation.js'
import themeSpec from './specifications/theme.js'
import uiExtensionSpec from './specifications/ui_extension.js'
import webPixelSpec from './specifications/web_pixel_extension.js'
import editorExtensionCollectionSpecification from './specifications/editor_extension_collection.js'

const SORTED_CONFIGURATION_SPEC_IDENTIFIERS = [
  BrandingSpecIdentifier,
  AppAccessSpecIdentifier,
  WebhooksSpecIdentifier,
  WebhookSubscriptionSpecIdentifier,
  PrivacyComplianceWebhooksSpecIdentifier,
  AppProxySpecIdentifier,
  PosSpecIdentifier,
  AppHomeSpecIdentifier,
]

/**
 * Load all specifications ONLY from the local file system
 */
export async function loadLocalExtensionsSpecifications(): Promise<ExtensionSpecification[]> {
  const sortConfigModules = (specA: ExtensionSpecification, specB: ExtensionSpecification) =>
    SORTED_CONFIGURATION_SPEC_IDENTIFIERS.indexOf(specA.identifier) -
    SORTED_CONFIGURATION_SPEC_IDENTIFIERS.indexOf(specB.identifier)
  return loadSpecifications().sort(sortConfigModules)
}

function loadSpecifications() {
  const configModuleSpecs = [
    appAccessSpec,
    appHomeSpec,
    appProxySpec,
    appBrandingSpec,
    appPOSSpec,
    appPrivacyComplienceSpec,
    appWebhooksSpec,
    appWebhookSubscriptionSpec,
  ]
  const moduleSpecs = [
    checkoutPostPurchaseSpec,
    checkoutSpec,
    flowActionSpecification,
    flowTemplateSpec,
    flowTriggerSpecification,
    functionSpec,
    paymentExtensionSpec,
    posUISpec,
    productSubscriptionSpec,
    taxCalculationSpec,
    themeSpec,
    uiExtensionSpec,
    webPixelSpec,
    editorExtensionCollectionSpecification,
  ] as ExtensionSpecification[]

  return [...configModuleSpecs, ...moduleSpecs]
}
