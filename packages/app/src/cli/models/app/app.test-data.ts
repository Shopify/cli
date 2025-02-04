import {
  App,
  AppConfiguration,
  AppConfigurationSchema,
  AppConfigurationWithoutPath,
  AppInterface,
  AppLinkedInterface,
  CurrentAppConfiguration,
  LegacyAppConfiguration,
  WebType,
  getAppVersionedSchema,
} from './app.js'
import {ExtensionTemplate} from './template.js'
import {
  Organization,
  OrganizationStore,
  MinimalAppIdentifiers,
  OrganizationApp,
  MinimalOrganizationApp,
  AppApiKeyAndOrgId,
  OrganizationSource,
} from '../organization.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {BaseConfigType} from '../extensions/schemas.js'
import {PartnersSession} from '../../services/context/partner-account-info.js'
import {WebhooksConfig} from '../extensions/specifications/types/app_config_webhook.js'
import {PaymentsAppExtensionConfigType} from '../extensions/specifications/payments_app_extension.js'
import {
  AppVersion,
  AppVersionIdentifiers,
  AppVersionWithContext,
  AssetUrlSchema,
  CreateAppOptions,
  DeveloperPlatformClient,
  DevSessionOptions,
} from '../../utilities/developer-platform-client.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../api/graphql/extension_create.js'
import {ConvertDevToTransferDisabledStoreVariables} from '../../api/graphql/convert_dev_to_transfer_disabled_store.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../../api/graphql/development_preview.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../../api/graphql/find_app_preview_mode.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../../services/webhook/request-topics.js'
import {AppReleaseSchema} from '../../api/graphql/app_release.js'
import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../api/graphql/app_versions_diff.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../../api/graphql/current_account_info.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import appWebhookSubscriptionSpec from '../extensions/specifications/app_config_webhook_subscription.js'
import appAccessSpec from '../extensions/specifications/app_config_app_access.js'
import {AppLogsSubscribeResponse, AppLogsSubscribeVariables} from '../../api/graphql/subscribe_to_app_logs.js'
import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../../api/graphql/partners/generated/update-draft.js'
import {SchemaDefinitionByTargetQueryVariables} from '../../api/graphql/functions/generated/schema-definition-by-target.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {AppHomeSpecIdentifier} from '../extensions/specifications/app_config_app_home.js'
import {AppProxySpecIdentifier} from '../extensions/specifications/app_config_app_proxy.js'
import {vi} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'

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
    specifications: app.specifications ?? [],
    configSchema: (app.configSchema ?? AppConfigurationSchema) as any,
    remoteFlags: app.remoteFlags ?? [],
    hiddenConfig: app.hiddenConfig ?? {},
    devApplicationURLs: app.devApplicationURLs,
  })

  if (app.updateDependencies) {
    Object.getPrototypeOf(newApp).updateDependencies = app.updateDependencies
  }
  if (app.extensionsForType) {
    Object.getPrototypeOf(newApp).extensionsForType = app.extensionsForType
  }
  return newApp
}

export function testAppLinked(app: Partial<AppInterface> = {}): AppLinkedInterface {
  return testApp(app, 'current') as AppLinkedInterface
}

interface TestAppWithConfigOptions {
  app?: Partial<AppInterface>
  config: object
}

export function testAppWithLegacyConfig({
  app = {},
  config = {},
}: TestAppWithConfigOptions): AppInterface<LegacyAppConfiguration> {
  const configuration: AppConfiguration = {
    path: '',
    scopes: '',
    name: 'name',
    extension_directories: [],
    ...config,
  }
  return testApp({...app, configuration}) as AppInterface<LegacyAppConfiguration>
}

export function testAppWithConfig(options?: TestAppWithConfigOptions): AppLinkedInterface {
  const app = testAppLinked(options?.app)
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

export function testOrganization(): Organization {
  return {
    id: '1',
    businessName: 'org1',
    source: OrganizationSource.BusinessPlatform,
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

export const placeholderAppConfiguration: AppConfigurationWithoutPath = {scopes: ''}

export async function testUIExtension(
  uiExtension: Omit<Partial<ExtensionInstance>, 'configuration'> & {
    configuration?: Partial<BaseConfigType> & {path?: string}
  } = {},
): Promise<ExtensionInstance> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.name ?? 'test-ui-extension',
    type: uiExtension?.type ?? 'product_subscription',
    handle: uiExtension?.handle ?? 'test-ui-extension',
    metafields: [],
    capabilities: {
      block_progress: false,
      network_access: false,
      api_access: false,
      collect_buyer_consent: {
        sms_marketing: false,
        customer_privacy: false,
      },
      iframe: {
        sources: [],
      },
    },
    extension_points: [
      {
        target: 'target1',
        module: 'module1',
        build_manifest: {
          assets: {
            main: {
              module: 'module1',
              filepath: uiExtension?.handle ? `/${uiExtension.handle}.js` : '/test-ui-extension.js',
            },
          },
        },
      },
      {
        target: 'target2',
        module: 'module2',
        build_manifest: {
          assets: {
            main: {
              module: 'module2',
              filepath: uiExtension?.handle ? `/${uiExtension.handle}.js` : '/test-ui-extension.js',
            },
          },
        },
      },
    ],
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
  extension.uid = uiExtension?.uid ?? 'test-ui-extension-uid'

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

export async function testAppConfigExtensions(emptyConfig = false, directory?: string): Promise<ExtensionInstance> {
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
    directory: directory ?? './',
    specification,
  })

  return extension
}

export async function testAppAccessConfigExtension(
  emptyConfig = false,
  directory?: string,
): Promise<ExtensionInstance> {
  const configuration = emptyConfig
    ? ({} as unknown as BaseConfigType)
    : ({
        access: {
          admin: {direct_api_mode: 'online'},
        },
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: true,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } as unknown as BaseConfigType)

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: 'shopify.app.toml',
    directory: directory ?? './',
    specification: appAccessSpec,
  })

  return extension
}

export async function testAppHomeConfigExtension(): Promise<ExtensionInstance> {
  const configuration = {
    name: 'App Home',
    type: 'app_home',
    handle: 'app-home',
    application_url: 'https://example.com',
    embedded: true,
    metafields: [],
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === AppHomeSpecIdentifier)!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
    directory: './',
    specification,
  })

  return extension
}

export async function testAppProxyConfigExtension(): Promise<ExtensionInstance> {
  const configuration = {
    name: 'App Proxy',
    type: 'app_proxy',
    handle: 'app-proxy',
    metafields: [],
    app_proxy: {
      url: 'https://example.com',
      subpath: 'apps',
      prefix: 'apps',
    },
  }

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === AppProxySpecIdentifier)!

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: '',
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
          api_version: '2024-01',
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

export async function testSingleWebhookSubscriptionExtension({
  emptyConfig = false,
  topic = 'orders/delete',
  config = {
    topic,
    api_version: '2024-01',
    uri: 'https://my-app.com/webhooks',
  },
}: {
  emptyConfig?: boolean
  topic?: string
  config?: object
} = {}): Promise<ExtensionInstance> {
  // configuration should be a single webhook subscription because of how
  // we create the extension instances in loader
  const configuration = emptyConfig ? ({} as unknown as BaseConfigType) : (config as unknown as BaseConfigType)

  const webhooksExtension = new ExtensionInstance({
    configuration,
    configurationPath: 'shopify.app.toml',
    directory: './',
    specification: appWebhookSubscriptionSpec,
  })

  return webhooksExtension
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
      watch: ['src/**/*.rs'],
      wasm_opt: true,
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

interface EditorExtensionCollectionProps {
  directory?: string
  configuration: {
    name: string
    handle?: string
    includes?: string[]
    include?: {handle: string}[]
  }
}

export async function testEditorExtensionCollection({
  directory,
  configuration: passedConfig,
}: EditorExtensionCollectionProps) {
  const resolvedDir = directory ?? '/tmp/project/extensions/editor-extension-collection'
  const configurationPath = joinPath(
    resolvedDir ?? '/tmp/project/extensions/editor-extension-collection',
    'shopify.extension.toml',
  )
  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'editor_extension_collection')!
  const parsed = specification.parseConfigurationObject({
    ...passedConfig,
    type: 'editor_extension_collection',
    metafields: [],
  })
  if (parsed.state !== 'ok') {
    throw new Error('Failed to parse configuration')
  }
  const configuration = parsed.data

  return new ExtensionInstance({
    configuration,
    directory: resolvedDir,
    specification,
    configurationPath,
    entryPath: '',
  })
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

export function testOrganizationStore({shopId, shopDomain}: {shopId?: string; shopDomain?: string}): OrganizationStore {
  return {
    shopId: shopId ?? '1',
    link: 'link1',
    shopDomain: shopDomain ?? 'domain1',
    shopName: 'store1',
    transferDisabled: false,
    convertableToPartnerTest: false,
  }
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
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
      uidIsClientProvided: true,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Editor extension collection',
    externalName: 'Editor extension collection',
    identifier: 'editor_extension_collection',
    externalIdentifier: 'editor_extension_collection_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 100,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Flow Action',
    externalName: 'Flow Action',
    identifier: 'flow_action',
    externalIdentifier: 'flow_action',
    gated: true,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 100,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Flow Template',
    externalName: 'Flow Template',
    externalIdentifier: 'flow_template',
    identifier: 'flow_template',
    gated: true,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 300,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Flow Trigger',
    externalName: 'Flow Trigger',
    externalIdentifier: 'flow_trigger',
    identifier: 'flow_trigger',
    gated: true,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 100,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'POS UI Extension',
    externalName: 'POS UI',
    externalIdentifier: 'pos_ui',
    identifier: 'pos_ui_extension',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 50,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Web Pixel Extension',
    externalName: 'Web Pixel',
    externalIdentifier: 'web_pixel',
    identifier: 'web_pixel_extension',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Branding',
    externalName: 'Branding',
    externalIdentifier: 'branding',
    identifier: 'branding',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'App access',
    externalName: 'App access',
    externalIdentifier: 'app_access',
    identifier: 'app_access',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'Webhooks',
    externalName: 'Webhooks',
    externalIdentifier: 'webhooks',
    identifier: 'webhooks',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'Privacy Compliance Webhooks',
    externalName: 'Privacy Compliance Webhooks',
    externalIdentifier: 'privacy_compliance_webhooks',
    identifier: 'privacy_compliance_webhooks',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'App Proxy',
    externalName: 'App Proxy',
    externalIdentifier: 'app_proxy',
    identifier: 'app_proxy',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'Point Of Sale Configuration',
    externalName: 'Point Of Sale Configuration',
    externalIdentifier: 'point_of_sale',
    identifier: 'point_of_sale',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'App Home',
    externalName: 'App Home',
    externalIdentifier: 'app_home',
    identifier: 'app_home',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
  },
  {
    name: 'Remote Extension Without Schema and Without local spec',
    externalName: 'Extension Test 1',
    identifier: 'remote_only_extension_without_schema',
    externalIdentifier: 'remote_only_extension_without_schema_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: true,
    },
  },
  {
    name: 'Remote Extension With Schema, Without local spec, without localization',
    externalName: 'Extension Test 2',
    identifier: 'remote_only_extension_schema',
    externalIdentifier: 'remote_only_extension_schema_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: true,
    },
    validationSchema: {
      jsonSchema:
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"pattern":{"type":"string"},"name":{"type":"string"}},"required":["pattern"]}',
    },
  },
  {
    name: 'Remote Extension With Schema, Without local spec, with localization',
    externalName: 'Extension Test 3',
    identifier: 'remote_only_extension_schema_with_localization',
    externalIdentifier: 'remote_only_extension_schema_with_localization_external',
    gated: false,
    experience: 'extension',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: true,
    },
    validationSchema: {
      jsonSchema:
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"pattern":{"type":"string"},"name":{"type":"string"},"localization":{"type":"object","properties":{"marketing_channel":{"type":"string"}},"required":["marketing_channel"]}},"required":["pattern","localization"]}',
    },
  },
  {
    name: 'Remote Extension With Schema, Without local spec, config-style management',
    externalName: 'Extension Test 4',
    identifier: 'remote_only_extension_schema_config_style',
    externalIdentifier: 'remote_only_extension_schema_config_style_external',
    gated: false,
    experience: 'configuration',
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
      uidIsClientProvided: false,
    },
    validationSchema: {
      jsonSchema:
        '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","additionalProperties":false,"properties":{"pattern":{"type":"string"},"name":{"type":"string"}},"required":["pattern"]}',
    },
  },
]

const productSubscriptionUIExtensionTemplate: ExtensionTemplate = {
  identifier: 'subscription_ui',
  name: 'Subscription UI',
  defaultName: 'subscription-ui',
  group: 'Admin',
  supportLinks: [],
  url: 'https://github.com/Shopify/cli',
  type: 'product_subscription',
  extensionPoints: [],
  supportedFlavors: [
    {
      name: 'JavaScript React',
      value: 'react',
      path: 'templates/ui-extensions/projects/product_subscription',
    },
    {
      name: 'JavaScript',
      value: 'vanilla-js',
      path: 'templates/ui-extensions/projects/product_subscription',
    },
    {
      name: 'TypeScript React',
      value: 'typescript-react',
      path: 'templates/ui-extensions/projects/product_subscription',
    },
    {
      name: 'TypeScript',
      value: 'typescript',
      path: 'templates/ui-extensions/projects/product_subscription',
    },
  ],
}

export const checkoutUITemplate: ExtensionTemplate = {
  identifier: 'checkout_ui',
  name: 'Checkout UI',
  defaultName: 'checkout-ui',
  group: 'Discounts and checkout',
  supportLinks: ['https://shopify.dev/api/checkout-extensions/checkout/configuration'],
  url: 'https://github.com/Shopify/extensions-templates',
  type: 'ui_extension',
  extensionPoints: [],
  supportedFlavors: [
    {
      name: 'JavaScript React',
      value: 'react',
      path: 'checkout-extension',
    },
    {
      name: 'JavaScript',
      value: 'vanilla-js',
      path: 'checkout-extension',
    },
    {
      name: 'TypeScript React',
      value: 'typescript-react',
      path: 'checkout-extension',
    },
    {
      name: 'TypeScript',
      value: 'typescript',
      path: 'checkout-extension',
    },
  ],
}

const themeAppExtensionTemplate: ExtensionTemplate = {
  identifier: 'theme_app_extension',
  name: 'Theme app extension',
  defaultName: 'theme-extension',
  group: 'Online store',
  supportLinks: [],
  url: 'https://github.com/Shopify/cli',
  type: 'theme',
  extensionPoints: [],
  supportedFlavors: [
    {
      name: 'Liquid',
      value: 'liquid',
      path: 'templates/theme-extension',
    },
  ],
}

export const testRemoteExtensionTemplates: ExtensionTemplate[] = [
  {
    identifier: 'cart_checkout_validation',
    name: 'Function - Cart and Checkout Validation',
    defaultName: 'cart-checkout-validation',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
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
  {
    identifier: 'cart_transform',
    name: 'Function - Cart transformer',
    defaultName: 'cart-transformer',
    group: 'Discounts and checkout',
    supportLinks: [],
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
  {
    identifier: 'product_discounts',
    name: 'Function - Product discounts',
    defaultName: 'product-discounts',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
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
  {
    identifier: 'order_discounts',
    name: 'Function - Order discounts',
    defaultName: 'order-discounts',
    group: 'Discounts and checkout',
    supportLinks: [],
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
  productSubscriptionUIExtensionTemplate,
  themeAppExtensionTemplate,
]

export const testPartnersUserSession: PartnersSession = {
  token: 'token',
  businessPlatformToken: 'businessPlatformToken',
  accountInfo: {
    type: 'UserAccount',
    email: 'partner@shopify.com',
  },
  userId: '1234-5678',
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

const emptyActiveAppVersion: AppVersion = {
  appModuleVersions: [],
}

const appVersionByTagResponse: AppVersionWithContext = {
  id: 1,
  uuid: 'uuid',
  versionTag: 'version-tag',
  location: 'location',
  message: 'MESSAGE',
  appModuleVersions: [],
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

const extensionUpdateResponse: ExtensionUpdateDraftMutation = {
  extensionUpdateDraft: {
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

const generateSignedUploadUrlResponse: AssetUrlSchema = {
  assetUrl: 'signed-upload-url',
  userErrors: [],
}

const convertedToTransferDisabledStoreResponse = {
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
  },
}

const migrateToUiExtensionResponse: MigrateToUiExtensionSchema = {
  migrateToUiExtension: {
    migratedToUiExtension: true,
    userErrors: [],
  },
}

const appLogsSubscribeResponse: AppLogsSubscribeResponse = {
  appLogsSubscribe: {
    success: true,
    jwtToken: 'jwttoken',
  },
}

export function testDeveloperPlatformClient(stubs: Partial<DeveloperPlatformClient> = {}): DeveloperPlatformClient {
  const clientStub: DeveloperPlatformClient = {
    clientName: 'test',
    webUiName: 'Test Dashboard',
    requiresOrganization: false,
    supportsAtomicDeployments: false,
    supportsDevSessions: stubs.supportsDevSessions ?? false,
    organizationSource: OrganizationSource.BusinessPlatform,
    session: () => Promise.resolve(testPartnersUserSession),
    refreshToken: () => Promise.resolve(testPartnersUserSession.token),
    accountInfo: () => Promise.resolve(testPartnersUserSession.accountInfo),
    appFromIdentifiers: (_app: AppApiKeyAndOrgId) => Promise.resolve(testOrganizationApp()),
    organizations: () => Promise.resolve(organizationsResponse),
    orgFromId: (_organizationId: string) => Promise.resolve(testOrganization()),
    appsForOrg: (_organizationId: string) => Promise.resolve({apps: [testOrganizationApp()], hasMorePages: false}),
    specifications: (_app: MinimalAppIdentifiers) => Promise.resolve(testRemoteSpecifications),
    templateSpecifications: (_app: MinimalAppIdentifiers) => Promise.resolve(testRemoteExtensionTemplates),
    orgAndApps: (_orgId: string) =>
      Promise.resolve({organization: testOrganization(), apps: [testOrganizationApp()], hasMorePages: false}),
    createApp: (_organization: Organization, _options: CreateAppOptions) => Promise.resolve(testOrganizationApp()),
    devStoresForOrg: (_organizationId: string) => Promise.resolve({stores: [], hasMorePages: false}),
    storeByDomain: (_orgId: string, _shopDomain: string) => Promise.resolve({organizations: {nodes: []}}),
    appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyAppExtensionRegistrations),
    appVersions: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyAppVersions),
    activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyActiveAppVersion),
    appVersionByTag: (_app: MinimalOrganizationApp, _tag: string) => Promise.resolve(appVersionByTagResponse),
    appVersionsDiff: (_input: AppVersionsDiffVariables) => Promise.resolve(appVersionsDiffResponse),
    createExtension: (_input: ExtensionCreateVariables) => Promise.resolve(extensionCreateResponse),
    updateExtension: (_input: ExtensionUpdateDraftMutationVariables) => Promise.resolve(extensionUpdateResponse),
    deploy: (_input: AppDeployVariables) => Promise.resolve(deployResponse),
    release: (_input: {app: MinimalAppIdentifiers; version: AppVersionIdentifiers}) => Promise.resolve(releaseResponse),
    generateSignedUploadUrl: (_app: MinimalAppIdentifiers) => Promise.resolve(generateSignedUploadUrlResponse),
    convertToTransferDisabledStore: (_input: ConvertDevToTransferDisabledStoreVariables) =>
      Promise.resolve(convertedToTransferDisabledStoreResponse),
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
    targetSchemaDefinition: (_input: SchemaDefinitionByTargetQueryVariables & {apiKey?: string}, _orgId: string) =>
      Promise.resolve('schema'),
    apiSchemaDefinition: (_input: SchemaDefinitionByApiTypeQueryVariables & {apiKey?: string}, _orgId: string) =>
      Promise.resolve('schema'),
    migrateToUiExtension: (_input: MigrateToUiExtensionVariables) => Promise.resolve(migrateToUiExtensionResponse),
    toExtensionGraphQLType: (input: string) => input,
    subscribeToAppLogs: (_input: AppLogsSubscribeVariables) => Promise.resolve(appLogsSubscribeResponse),
    appDeepLink: (app: MinimalAppIdentifiers) =>
      Promise.resolve(`https://test.shopify.com/${app.organizationId}/apps/${app.id}`),
    devSessionCreate: (_input: DevSessionOptions) => Promise.resolve({devSessionCreate: {userErrors: []}}),
    devSessionUpdate: (_input: DevSessionOptions) => Promise.resolve({devSessionUpdate: {userErrors: []}}),
    devSessionDelete: (_input: unknown) => Promise.resolve({devSessionDelete: {userErrors: []}}),
    getCreateDevStoreLink: (_input: string) =>
      Promise.resolve(`Looks like you don't have a dev store in the Partners org you selected. Keep going — create a dev store through the
      Developer Dashboard: https://partners.shopify.com/organizations/1234/stores/new`),
    ...stubs,
  }
  const retVal: Partial<DeveloperPlatformClient> = clientStub
  for (const [key, value] of Object.entries(clientStub)) {
    if (typeof value === 'function') {
      retVal[
        key as keyof Omit<
          DeveloperPlatformClient,
          | 'requiresOrganization'
          | 'supportsAtomicDeployments'
          | 'clientName'
          | 'webUiName'
          | 'supportsDevSessions'
          | 'organizationSource'
        >
      ] = vi.fn().mockImplementation(value)
    }
  }
  return retVal as DeveloperPlatformClient
}

export const testPartnersServiceSession: PartnersSession = {
  token: 'partnersToken',
  businessPlatformToken: 'businessPlatformToken',
  accountInfo: {
    type: 'ServiceAccount',
    orgName: 'organization',
  },
  userId: '1234-5678',
}

export async function buildVersionedAppSchema() {
  const configSpecifications = await configurationSpecifications()
  return {
    schema: getAppVersionedSchema(configSpecifications),
    configSpecifications,
  }
}

export async function configurationSpecifications() {
  return (await loadLocalExtensionsSpecifications()).filter((spec) => spec.uidStrategy === 'single')
}
