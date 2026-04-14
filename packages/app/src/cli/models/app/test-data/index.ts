// Barrel re-export for backward compatibility.
// New code should import directly from the specific sub-module.
export {
  DEFAULT_CONFIG,
  testApp,
  testAppLinked,
  testAppWithConfig,
  testProject,
  getWebhookConfig,
  testOrganization,
  testOrganizationApp,
  placeholderAppConfiguration,
  testOrganizationStore,
  testPartnersUserSession,
  testPartnersServiceSession,
  buildVersionedAppSchema,
  configurationSpecifications,
} from './fixtures.js'

export {
  testUIExtension,
  testThemeExtensions,
  testAppConfigExtensions,
  testAppAccessConfigExtension,
  testAppHomeConfigExtension,
  testAppProxyConfigExtension,
  testPaymentExtensions,
  testWebhookExtensions,
  testSingleWebhookSubscriptionExtension,
  testTaxCalculationExtension,
  testFlowActionExtension,
  testFunctionExtension,
  testEditorExtensionCollection,
  testPaymentsAppExtension,
} from './extensions.js'

export {testRemoteSpecifications, checkoutUITemplate, testRemoteExtensionTemplates} from './templates.js'

export {extensionCreateResponse, testDeveloperPlatformClient} from './clients.js'
