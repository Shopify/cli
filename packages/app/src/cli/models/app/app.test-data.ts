import {App, AppConfiguration, AppInterface, CurrentAppConfiguration, WebType, getAppVersionedSchema} from './app.js'
import {ExtensionTemplate} from './template.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import themeExtension from '../templates/theme-specifications/theme.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {MinimalAppIdentifiers, Organization, OrganizationApp} from '../organization.js'
import productSubscriptionUIExtension from '../templates/ui-specifications/product_subscription.js'
import webPixelUIExtension from '../templates/ui-specifications/web_pixel_extension.js'
import {BaseConfigType} from '../extensions/schemas.js'
import {PartnersSession} from '../../services/context/partner-account-info.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {PaymentsAppExtensionConfigType} from '../extensions/specifications/payments_app_extension.js'
import {ActiveAppVersion, CreateAppOptions, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../api/graphql/extension_create.js'
import {ConvertDevToTestStoreVariables} from '../../api/graphql/convert_dev_to_test_store.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../../api/graphql/development_preview.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../../api/graphql/find_app_preview_mode.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../../services/webhook/request-topics.js'
import {AppReleaseSchema, AppReleaseVariables} from '../../api/graphql/app_release.js'
import {AppVersionByTagSchema, AppVersionByTagVariables} from '../../api/graphql/app_version_by_tag.js'
import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../api/graphql/app_versions_diff.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../../api/graphql/current_account_info.js'
import {TargetSchemaDefinitionQueryVariables} from '../../api/graphql/functions/target_schema_definition.js'
import {ApiSchemaDefinitionQueryVariables} from '../../api/graphql/functions/api_schema_definition.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {vi} from 'vitest'

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
    remoteFlags: app.remoteFlags,
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

export function getWebhookConfig(webhookConfigOverrides?: WebhooksConfig): CurrentAppConfiguration {
  return {
    ...DEFAULT_CONFIG,
    webhooks: {
      ...DEFAULT_CONFIG.webhooks,
      ...webhookConfigOverrides,
    },
  }
}

function testOrganization(): Organization {
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
    disabledFlags: ['5b25141b'],
    flags: [],
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

export function testWebhookExtensions(params?: {
  emptyConfig?: boolean
  complianceTopics: false
}): Promise<ExtensionInstance>
export function testWebhookExtensions(params?: {
  emptyConfig?: boolean
  complianceTopics: true
}): Promise<ExtensionInstance[]>
export async function testWebhookExtensions({emptyConfig = false, complianceTopics = false} = {}): Promise<
  ExtensionInstance | ExtensionInstance[]
> {
  const configuration = emptyConfig
    ? ({} as unknown as BaseConfigType)
    : ({
        webhooks: {
          subscriptions: [
            {
              topics: ['orders/delete'],
              uri: 'https://my-app.com/webhooks',
            },
            ...(complianceTopics
              ? [
                  {
                    compliance_topics: ['shop/redact'],
                    uri: 'https://my-app.com/compliance-webhooks',
                  },
                ]
              : []),
          ],
          ...(complianceTopics && {
            privacy_compliance: {
              customer_deletion_url: 'https://my-app.com/compliance/customer-deletion',
              customer_data_request_url: 'https://my-app.com/compliance/customer-data-deletion',
              shop_deletion_url: 'https://my-app.com/compliance/shop-deletion',
            },
          }),
        },
      } as unknown as BaseConfigType)

  const allSpecs = await loadLocalExtensionsSpecifications()
  const webhooksSpecification = allSpecs.find((spec) => spec.identifier === 'webhooks')!
  const privacySpecification = allSpecs.find((spec) => spec.identifier === 'privacy_compliance_webhooks')!

  const webhooksExtension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory: './',
    specification: webhooksSpecification,
  })

  const privacyExtension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory: './',
    specification: privacySpecification,
  })

  return complianceTopics ? [webhooksExtension, privacyExtension] : webhooksExtension
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

const testRemoteSpecifications: RemoteSpecification[] = [
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

const emptyAppVersions = {
  app: {
    id: 'app-id',
    organizationId: 'org-id',
    title: 'my app',
    appVersions: {
      nodes: [],
      pageInfo: {
        totalResults: 0,
      },
    },
  },
}

const emptyActiveAppVersion: ActiveAppVersion = {
  appModuleVersions: [],
}

const appVersionByTagResponse: AppVersionByTagSchema = {
  app: {
    appVersion: {
      id: 1,
      uuid: 'uuid',
      versionTag: 'version-tag',
      location: 'location',
      message: 'MESSAGE',
      appModuleVersions: [],
    },
  },
}

const appVersionsDiffResponse: AppVersionsDiffSchema = {
  app: {
    versionsDiff: {
      added: [],
      updated: [],
      removed: [],
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

export const extensionCreateResponse: ExtensionCreateSchema = {
  extensionCreate: {
    extensionRegistration: {
      id: 'extension-id',
      uuid: 'extension-uuid',
      title: 'my extension',
      type: 'other',
      draftVersion: {
        config: 'config',
        registrationId: 'registration-id',
        lastUserInteractionAt: '2024-01-01',
        validationErrors: [],
      },
    },
    userErrors: [],
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

const releaseResponse: AppReleaseSchema = {
  appRelease: {
    appVersion: {
      versionTag: 'version-tag',
      location: 'location',
      message: 'message',
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

const convertedToTestStoreResponse = {
  convertDevToTestStore: {
    convertedToTestStore: true,
    userErrors: [],
  },
}

const updateDeveloperPreviewResponse: DevelopmentStorePreviewUpdateSchema = {
  developmentStorePreviewUpdate: {
    app: {
      id: 'app-id',
      developmentStorePreviewEnabled: true,
    },
    userErrors: [],
  },
}

const appPreviewModeResponse: FindAppPreviewModeSchema = {
  app: {
    developmentStorePreviewEnabled: true,
  },
}

const organizationsResponse: Organization[] = [testOrganization()]

const sendSampleWebhookResponse: SendSampleWebhookSchema = {
  sendSampleWebhook: {
    samplePayload: '{ "sampleField": "SampleValue" }',
    headers: '{ "header": "Header Value" }',
    success: true,
    userErrors: [],
  },
}

const migrateFlowExtensionResponse: MigrateFlowExtensionSchema = {
  migrateFlowExtension: {
    migratedFlowExtension: true,
    userErrors: [],
  },
}

const migrateAppModuleResponse: MigrateAppModuleSchema = {
  migrateAppModule: {
    migratedAppModule: true,
    userErrors: [],
  },
}

const apiVersionsResponse: PublicApiVersionsSchema = {
  publicApiVersions: ['2022', 'unstable', '2023'],
}

const topicsResponse: WebhookTopicsSchema = {
  webhookTopics: ['orders/create', 'shop/redact'],
}

const updateURLsResponse: UpdateURLsSchema = {
  appUpdate: {
    userErrors: [],
  },
}

const currentAccountInfoResponse: CurrentAccountInfoSchema = {
  currentAccountInfo: {
    __typename: 'UserAccount',
    email: 'user@example.com',
    orgName: 'org1',
  },
}

const migrateToUiExtensionResponse: MigrateToUiExtensionSchema = {
  migrateToUiExtension: {
    migratedToUiExtension: true,
    userErrors: [],
  },
}

export function testDeveloperPlatformClient(stubs: Partial<DeveloperPlatformClient> = {}): DeveloperPlatformClient {
  const clientStub = {
    requiresOrganization: false,
    supportsAtomicDeployments: false,
    session: () => Promise.resolve(testPartnersUserSession),
    refreshToken: () => Promise.resolve(testPartnersUserSession.token),
    accountInfo: () => Promise.resolve(testPartnersUserSession.accountInfo),
    appFromId: (_app: MinimalAppIdentifiers) => Promise.resolve(testOrganizationApp()),
    organizations: () => Promise.resolve(organizationsResponse),
    orgFromId: (_organizationId: string) => Promise.resolve(testOrganization()),
    appsForOrg: (_organizationId: string) => Promise.resolve({apps: [testOrganizationApp()], hasMorePages: false}),
    specifications: (_appId: string) => Promise.resolve(testRemoteSpecifications),
    templateSpecifications: (_appId: string) => Promise.resolve(testRemoteExtensionTemplates),
    orgAndApps: (_orgId: string) =>
      Promise.resolve({organization: testOrganization(), apps: [testOrganizationApp()], hasMorePages: false}),
    createApp: (_organization: Organization, _name: string, _options?: CreateAppOptions) =>
      Promise.resolve(testOrganizationApp()),
    devStoresForOrg: (_organizationId: string) => Promise.resolve([]),
    storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve({organizations: {nodes: []}}),
    appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyAppExtensionRegistrations),
    appVersions: (_appId: string) => Promise.resolve(emptyAppVersions),
    activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyActiveAppVersion),
    appVersionByTag: (_input: AppVersionByTagVariables) => Promise.resolve(appVersionByTagResponse),
    appVersionsDiff: (_input: AppVersionsDiffVariables) => Promise.resolve(appVersionsDiffResponse),
    functionUploadUrl: () => Promise.resolve(functionUploadUrlResponse),
    createExtension: (_input: ExtensionCreateVariables) => Promise.resolve(extensionCreateResponse),
    updateExtension: (_input: ExtensionUpdateDraftInput) => Promise.resolve(extensionUpdateResponse),
    deploy: (_input: AppDeployVariables) => Promise.resolve(deployResponse),
    release: (_input: AppReleaseVariables) => Promise.resolve(releaseResponse),
    generateSignedUploadUrl: (_input: GenerateSignedUploadUrlVariables) =>
      Promise.resolve(generateSignedUploadUrlResponse),
    convertToTestStore: (_input: ConvertDevToTestStoreVariables) => Promise.resolve(convertedToTestStoreResponse),
    updateDeveloperPreview: (_input: DevelopmentStorePreviewUpdateInput) =>
      Promise.resolve(updateDeveloperPreviewResponse),
    appPreviewMode: (_input: FindAppPreviewModeVariables) => Promise.resolve(appPreviewModeResponse),
    sendSampleWebhook: (_input: SendSampleWebhookVariables) => Promise.resolve(sendSampleWebhookResponse),
    apiVersions: () => Promise.resolve(apiVersionsResponse),
    topics: (_input: WebhookTopicsVariables) => Promise.resolve(topicsResponse),
    migrateFlowExtension: (_input: MigrateFlowExtensionVariables) => Promise.resolve(migrateFlowExtensionResponse),
    migrateAppModule: (_input: MigrateAppModuleVariables) => Promise.resolve(migrateAppModuleResponse),
    updateURLs: (_input: UpdateURLsVariables) => Promise.resolve(updateURLsResponse),
    currentAccountInfo: () => Promise.resolve(currentAccountInfoResponse),
    targetSchemaDefinition: (_input: TargetSchemaDefinitionQueryVariables) => Promise.resolve('schema'),
    apiSchemaDefinition: (_input: ApiSchemaDefinitionQueryVariables) => Promise.resolve('schema'),
    migrateToUiExtension: (_input: MigrateToUiExtensionVariables) => Promise.resolve(migrateToUiExtensionResponse),
    toExtensionGraphQLType: (input: string) => input,
    ...stubs,
  }
  const retVal: Partial<DeveloperPlatformClient> = {}
  for (const [key, value] of Object.entries(clientStub)) {
    if (typeof value === 'function') {
      retVal[key as keyof Omit<DeveloperPlatformClient, 'requiresOrganization' | 'supportsAtomicDeployments'>] = vi
        .fn()
        .mockImplementation(value)
    }
  }
  return retVal as DeveloperPlatformClient
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
