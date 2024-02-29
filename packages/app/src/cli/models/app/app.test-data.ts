import {App, AppConfiguration, AppInterface, CurrentAppConfiguration, WebType, getAppVersionedSchema} from './app.js'
import {ExtensionTemplate} from './template.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import themeExtension from '../templates/theme-specifications/theme.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {Organization, OrganizationApp} from '../organization.js'
import productSubscriptionUIExtension from '../templates/ui-specifications/product_subscription.js'
import webPixelUIExtension from '../templates/ui-specifications/web_pixel_extension.js'
import {BaseConfigType} from '../extensions/schemas.js'
import {PartnersSession} from '../../services/context/partner-account-info.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {PaymentsAppExtensionConfigType} from '../extensions/specifications/payments_app_extension.js'
import {CreateAppOptions, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ActiveAppVersionQuerySchema} from '../../api/graphql/app_active_version.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'

export const DEFAULT_CONFIG = {
  path: '/tmp/project/shopify.app.toml',
  application_url: 'https://myapp.com',
  client_id: 'api-key',
  name: 'my app',
  webhooks: {
    api_version: '2023-04',
  },
  embedded: true,
  access_scopes: {
    scopes: 'read_products',
  },
}

export function testApp(app: Partial<AppInterface> = {}, schemaType: 'current' | 'legacy' = 'legacy'): AppInterface {
  const getConfig = () => {
    if (schemaType === 'legacy') {
      return {scopes: '', extension_directories: [], path: ''}
    } else {
      return DEFAULT_CONFIG as CurrentAppConfiguration
    }
  }

  const newApp = new App({
    name: app.name ?? 'App',
    idEnvironmentVariableName: app.idEnvironmentVariableName ?? 'SHOPIFY_API_KEY',
    directory: app.directory ?? '/tmp/project',
    packageManager: app.packageManager ?? 'yarn',
    configuration: app.configuration ?? getConfig(),
    nodeDependencies: app.nodeDependencies ?? {},
    webs: app.webs ?? [
      {
        directory: '',
        configuration: {
          roles: [WebType.Backend],
          commands: {dev: ''},
        },
      },
    ],
    modules: app.allExtensions ?? [],
    usesWorkspaces: app.usesWorkspaces ?? false,
    dotenv: app.dotenv,
    errors: app.errors,
    specifications: app.specifications,
    configSchema: app.configSchema,
  })

  if (app.updateDependencies) {
    Object.getPrototypeOf(newApp).updateDependencies = app.updateDependencies
  }
  if (app.extensionsForType) {
    Object.getPrototypeOf(newApp).extensionsForType = app.extensionsForType
  }
  return newApp
}

interface TestAppWithConfigOptions {
  app?: Partial<AppInterface>
  config: object
}

export function testAppWithLegacyConfig({app = {}, config = {}}: TestAppWithConfigOptions): AppInterface {
  const configuration: AppConfiguration = {
    path: '',
    scopes: '',
    name: 'name',
    extension_directories: [],
    ...config,
  }
  return testApp({...app, configuration})
}

export function testAppWithConfig(options?: TestAppWithConfigOptions): AppInterface {
  const app = testApp(options?.app, 'current')
  app.configuration = {
    ...DEFAULT_CONFIG,
    ...options?.config,
  } as CurrentAppConfiguration

  return app
}

export function getWebhookConfig(webhookConfigOverrides?: WebhooksConfig) {
  return {
    ...DEFAULT_CONFIG,
    webhooks: {
      ...DEFAULT_CONFIG.webhooks,
      ...webhookConfigOverrides,
    },
  }
}

export function testOrganization(): Organization {
  return {
    id: '1',
    businessName: 'org1',
    website: 'https://www.example.com',
  }
}

export function testOrganizationApp(app: Partial<OrganizationApp> = {}): OrganizationApp {
  const defaultApp = {
    id: '1',
    title: 'app1',
    apiKey: 'api-key',
    apiSecretKeys: [{secret: 'api-secret'}],
    organizationId: '1',
    grantedScopes: [],
    disabledBetas: [],
    betas: [],
  }
  return {...defaultApp, ...app}
}

export async function testUIExtension(
  uiExtension: Omit<Partial<ExtensionInstance>, 'configuration'> & {
    configuration?: Partial<BaseConfigType> & {path?: string}
  } = {},
): Promise<ExtensionInstance> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.configuration?.name ?? 'test-ui-extension',
    type: uiExtension?.configuration?.type ?? uiExtension?.type ?? 'product_subscription',
    metafields: [],
    capabilities: {
      block_progress: false,
      network_access: false,
      api_access: false,
      collect_buyer_consent: {
        sms_marketing: false,
        customer_privacy: false,
      },
    },
    targeting: [{target: 'target1'}, {target: 'target2'}],
  }
  const configurationPath = uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`
  const entryPath = uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === configuration.type)!

  const extension = new ExtensionInstance({
    configuration: configuration as BaseConfigType,
    configurationPath,
    entryPath,
    directory,
    specification,
  })

  extension.devUUID = uiExtension?.devUUID ?? 'test-ui-extension-uuid'

  return extension
}

export async function testThemeExtensions(directory = './my-extension'): Promise<ExtensionInstance> {
  const configuration = {
    name: 'theme extension name',
    type: 'theme' as const,
    metafields: [],
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'theme')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory,
    specification,
  })

  return extension
}

export async function testAppConfigExtensions(emptyConfig = false): Promise<ExtensionInstance> {
  const configuration = emptyConfig
    ? ({} as unknown as BaseConfigType)
    : ({
        pos: {
          embedded: true,
        },
      } as unknown as BaseConfigType)

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'point_of_sale')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: 'shopify.app.toml',
    directory: './',
    specification,
  })

  return extension
}

export async function testPaymentExtensions(directory = './my-extension'): Promise<ExtensionInstance> {
  const configuration = {
    name: 'Payment Extension Name',
    type: 'payments_extension' as const,
    targeting: [{target: 'payments.offsite.render'}],
    metafields: [],
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory,
    specification,
  })

  return extension
}

export async function testWebhookExtensions(emptyConfig = false): Promise<ExtensionInstance> {
  const configuration = emptyConfig
    ? ({} as unknown as BaseConfigType)
    : ({
        webhooks: {
          subscriptions: [
            {
              topics: ['orders/delete'],
              uri: 'https://my-app.com/webhooks',
            },
          ],
        },
      } as unknown as BaseConfigType)

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'webhooks')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory: './',
    specification,
  })

  return extension
}

export async function testWebPixelExtension(directory = './my-extension'): Promise<ExtensionInstance> {
  const configuration = {
    name: 'web pixel name',
    type: 'web_pixel' as const,
    metafields: [],
    runtime_context: 'strict',
    customer_privacy: {
      analytics: false,
      marketing: true,
      preferences: false,
      sale_of_data: 'enabled',
    },
    settings: [],
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'web_pixel_extension')!
  const parsed = specification.schema.parse(configuration)
  const extension = new ExtensionInstance({
    configuration: parsed,
    configurationPath: '',
    directory,
    specification,
  })

  return extension
}

export async function testTaxCalculationExtension(directory = './my-extension'): Promise<ExtensionInstance> {
  const configuration = {
    name: 'tax',
    type: 'tax_calculation' as const,
    metafields: [],
    runtime_context: 'strict',
    customer_privacy: {
      analytics: false,
      marketing: true,
      preferences: false,
      sale_of_data: 'enabled',
    },
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'tax_calculation')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory,
    specification,
  })

  return extension
}

export async function testFlowActionExtension(directory = './my-extension'): Promise<ExtensionInstance> {
  const configuration = {
    name: 'flow action',
    type: 'flow_action' as const,
    metafields: [],
    runtime_context: 'strict',
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'flow_action')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory,
    specification,
  })

  return extension
}

function defaultFunctionConfiguration(): FunctionConfigType {
  return {
    name: 'test function extension',
    description: 'description',
    type: 'product_discounts',
    build: {
      command: 'echo "hello world"',
    },
    api_version: '2022-07',
    configuration_ui: true,
    metafields: [],
  }
}

interface TestFunctionExtensionOptions {
  dir?: string
  config?: FunctionConfigType
  entryPath?: string
}

export async function testFunctionExtension(
  opts: TestFunctionExtensionOptions = {},
): Promise<ExtensionInstance<FunctionConfigType>> {
  const directory = opts.dir ?? '/tmp/project/extensions/my-function'
  const configuration = opts.config ?? defaultFunctionConfiguration()

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'function')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    entryPath: opts.entryPath,
    directory,
    specification,
  })
  return extension
}

interface TestPaymentsAppExtensionOptions {
  dir?: string
  config: PaymentsAppExtensionConfigType
  entryPath?: string
}
export async function testPaymentsAppExtension(
  opts: TestPaymentsAppExtensionOptions,
): Promise<ExtensionInstance<PaymentsAppExtensionConfigType>> {
  const directory = opts.dir ?? '/tmp/project/extensions/my-payments-app-extension'
  const configuration = opts.config

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'payments_extension')!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    entryPath: opts.entryPath,
    directory,
    specification,
  })
  return extension
}

export const testRemoteSpecifications: RemoteSpecification[] = [
  {
    name: 'Checkout Post Purchase',
    externalName: 'Post-purchase UI',
    identifier: 'checkout_post_purchase',
    externalIdentifier: 'checkout_post_purchase_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Online Store - App Theme Extension',
    externalName: 'Theme App Extension',
    identifier: 'theme',
    externalIdentifier: 'theme_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
  },
  {
    name: 'Product Subscription',
    externalName: 'Subscription UI',
    identifier: 'product_subscription',
    externalIdentifier: 'product_subscription_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'admin',
      },
    },
  },
  {
    name: 'UI Extension',
    externalName: 'UI Extension',
    identifier: 'ui_extension',
    externalIdentifier: 'ui_extension_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 50,
    },
    features: {
      argo: {
        surface: 'all',
      },
    },
  },
  {
    name: 'Checkout Extension',
    externalName: 'Checkout UI',
    identifier: 'checkout_ui_extension',
    externalIdentifier: 'checkout_ui_extension_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 5,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Product Subscription',
    externalName: 'Subscription UI',
    // we are going to replace this to 'product_subscription' because we
    // started using it before relying on the extension specification identifier
    identifier: 'subscription_management',
    externalIdentifier: 'product_subscription_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'admin',
      },
    },
  },
  {
    name: 'Marketing Activity',
    externalName: 'Marketing Activity',
    identifier: 'marketing_activity_extension',
    externalIdentifier: 'marketing_activity_extension_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'dashboard',
      registrationLimit: 100,
    },
  },
  {
    name: 'function',
    externalName: 'function',
    identifier: 'function',
    externalIdentifier: 'function',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
]

export const testRemoteExtensionTemplates: ExtensionTemplate[] = [
  {
    identifier: 'cart_checkout_validation',
    name: 'Function - Cart and Checkout Validation',
    defaultName: 'cart-checkout-validation',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
    types: [
      {
        type: 'function',
        url: 'https://github.com/Shopify/function-examples',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-checkout-validation/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'cart_transform',
    name: 'Function - Cart transformer',
    defaultName: 'cart-transformer',
    group: 'Discounts and checkout',
    supportLinks: [],
    types: [
      {
        type: 'function',
        url: 'https://github.com/Shopify/function-examples',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/cart-transform/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-transform/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'product_discounts',
    name: 'Function - Product discounts',
    defaultName: 'product-discounts',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    types: [
      {
        type: 'function',
        url: 'https://github.com/Shopify/function-examples',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/product-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/product-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'order_discounts',
    name: 'Function - Order discounts',
    defaultName: 'order-discounts',
    group: 'Discounts and checkout',
    supportLinks: [],
    types: [
      {
        type: 'function',
        url: 'https://github.com/Shopify/function-examples',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/order-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/order-discounts/default',
          },
          {
            name: 'JavaScript',
            value: 'vanilla-js',
            path: 'discounts/javascript/order-discounts/default',
          },
        ],
      },
    ],
  },
]

export const testLocalExtensionTemplates: ExtensionTemplate[] = [
  themeExtension,
  productSubscriptionUIExtension,
  webPixelUIExtension,
]

export const testPartnersUserSession: PartnersSession = {
  token: 'token',
  accountInfo: {
    type: 'UserAccount',
    email: 'partner@shopify.com',
  },
}

const emptyAppExtensionRegistrations: AllAppExtensionRegistrationsQuerySchema = {
  app: {
    extensionRegistrations: [],
    configurationRegistrations: [],
    dashboardManagedExtensionRegistrations: [],
  },
}

const emptyAppVersion: ActiveAppVersionQuerySchema = {
  app: {
    activeAppVersion: {
      appModuleVersions: [],
    },
  },
}

const functionUploadUrlResponse = {
  functionUploadUrlGenerate: {
    generatedUrlDetails: {
      headers: {},
      maxSize: '200 kb',
      url: 'https://example.com/upload-url',
      moduleId: 'module-id',
      maxBytes: 200,
    },
  },
}

const extensionUpdateResponse: ExtensionUpdateSchema = {
  extensionUpdateDraft: {
    clientMutationId: 'client-mutation-id',
    userErrors: [],
  },
}

const deployResponse: AppDeploySchema = {
  appDeploy: {
    appVersion: {
      uuid: 'uuid',
      id: 1,
      versionTag: 'version-tag',
      location: 'location',
      message: 'message',
      appModuleVersions: [],
    },
    userErrors: [],
  },
}

const generateSignedUploadUrlResponse: GenerateSignedUploadUrlSchema = {
  appVersionGenerateSignedUploadUrl: {
    signedUploadUrl: 'signed-upload-url',
    userErrors: [],
  },
}

export function testDeveloperPlatformClient(stubs: Partial<DeveloperPlatformClient> = {}): DeveloperPlatformClient {
  return {
    session: () => Promise.resolve(testPartnersUserSession),
    refreshToken: () => Promise.resolve(testPartnersUserSession.token),
    accountInfo: () => Promise.resolve(testPartnersUserSession.accountInfo),
    appFromId: (_clientId: string) => Promise.resolve(testOrganizationApp()),
    organizations: () => Promise.resolve([testOrganization()]),
    orgFromId: (_organizationId: string) => Promise.resolve(testOrganization()),
    appsForOrg: (_organizationId: string) => Promise.resolve({apps: [testOrganizationApp()], hasMorePages: false}),
    selectOrg: () => Promise.resolve(testOrganization()),
    specifications: (_appId: string) => Promise.resolve([]),
    orgAndApps: (_orgId: string) =>
      Promise.resolve({organization: testOrganization(), apps: [testOrganizationApp()], hasMorePages: false}),
    createApp: (_organization: Organization, _name: string, _options?: CreateAppOptions) =>
      Promise.resolve(testOrganizationApp()),
    devStoresForOrg: (_organizationId: string) => Promise.resolve([]),
    appExtensionRegistrations: (_appId: string) => Promise.resolve(emptyAppExtensionRegistrations),
    activeAppVersion: (_appId: string) => Promise.resolve(emptyAppVersion),
    functionUploadUrl: () => Promise.resolve(functionUploadUrlResponse),
    updateExtension: (input: ExtensionUpdateDraftInput) => Promise.resolve(extensionUpdateResponse),
    deploy: (input: AppDeployVariables) => Promise.resolve(deployResponse),
    generateSignedUploadUrl: (input: GenerateSignedUploadUrlVariables) =>
      Promise.resolve(generateSignedUploadUrlResponse),
    ...stubs,
  }
}

export const testPartnersServiceSession: PartnersSession = {
  token: 'partnersToken',
  accountInfo: {
    type: 'ServiceAccount',
    orgName: 'organization',
  },
}

export async function buildVersionedAppSchema() {
  const configSpecifications = await configurationSpecifications()
  return {
    schema: getAppVersionedSchema(configSpecifications),
    configSpecifications,
  }
}

export async function configurationSpecifications() {
  return (await loadLocalExtensionsSpecifications()).filter((spec) => spec.experience === 'configuration')
}
