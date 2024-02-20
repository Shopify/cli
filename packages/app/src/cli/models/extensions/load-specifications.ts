import {ExtensionSpecification} from './specification.js'
import appHomeSpec, {AppHomeSpecIdentifier} from './specifications/app_config_app_home.js'
import appProxySpec, {AppProxySpecIdentifier} from './specifications/app_config_app_proxy.js'
import appPOSSpec, {PosSpecIdentifier} from './specifications/app_config_point_of_sale.js'
import appWebhooksSpec, {WebhooksSpecIdentifier} from './specifications/app_config_webhook.js'
import appBrandingSpec, {BrandingSpecIdentifier} from './specifications/app_config_branding.js'
import appAccessSpec, {AppAccessSpecIdentifier} from './specifications/app_config_app_access.js'
import appPrivacyComplienceSpec, {
  PrivacyComplianceWebbhooksSpecIdentifier,
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
import {memoize} from '@shopify/cli-kit/common/function'

const SORTED_CONFIGURATION_SPEC_IDENTIFIERS = [
  BrandingSpecIdentifier,
  AppAccessSpecIdentifier,
  WebhooksSpecIdentifier,
  PrivacyComplianceWebbhooksSpecIdentifier,
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
  return (await memoizedLoadSpecs('specifications')).sort(sortConfigModules)
}

const memoizedLoadSpecs = memoize(loadSpecifications)

function loadSpecifications(directoryName: string): ExtensionSpecification[] {
  /**
   * When running tests, "await import('.../spec..ts')" is handled by Vitest which does
   * transform the TS module into a JS one before loading it. Hence the inclusion of .ts
   * in the list of files.
   */
  // const url = joinPath(dirname(fileURLToPath(import.meta.url)), joinPath(directoryName, '*.{js,ts}'))
  // let files = await glob(url, {ignore: ['**.d.ts', '**.test.ts']})

  // // From Node 18, all windows paths must start with file://
  // const {platform} = platformAndArch()
  // if (platform === 'windows') {
  //   files = files.map((file) => `file://${file}`)
  // }

  // const promises = files.map((file) => import(file))
  // const modules = await Promise.all(promises)
  // const specs = modules.map((module) => module.default)

  const configModuleSpecs = [
    appAccessSpec,
    appHomeSpec,
    appProxySpec,
    appBrandingSpec,
    appPOSSpec,
    appPrivacyComplienceSpec,
    appWebhooksSpec,
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
  ] as ExtensionSpecification[]

  return [...configModuleSpecs, ...moduleSpecs]
}
