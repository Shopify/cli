import {ExtensionInstance} from '../../extensions/extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../../extensions/load-specifications.js'
import {FunctionConfigType} from '../../extensions/specifications/function.js'
import {BaseConfigType} from '../../extensions/schemas.js'
import {PaymentsAppExtensionConfigType} from '../../extensions/specifications/payments_app_extension.js'
import appWebhookSubscriptionSpec from '../../extensions/specifications/app_config_webhook_subscription.js'
import appAccessSpec from '../../extensions/specifications/app_config_app_access.js'
import {AppHomeSpecIdentifier} from '../../extensions/specifications/app_config_app_home.js'
import {AppProxySpecIdentifier} from '../../extensions/specifications/app_config_app_proxy.js'
import {ExtensionSpecification} from '../../extensions/specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'

export async function testUIExtension(
  uiExtension: Omit<Partial<ExtensionInstance>, 'configuration'> & {
    configuration?: Partial<BaseConfigType> & {path?: string} & {metafields?: {namespace: string; key: string}[]}
  } = {},
): Promise<ExtensionInstance> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.name ?? 'test-ui-extension',
    type: uiExtension?.type ?? 'product_subscription',
    handle: uiExtension?.handle ?? 'test-ui-extension',
    uid: uiExtension?.uid ?? undefined,
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
    supported_features: {
      runs_offline: false,
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
  useLegacyInstallFlow = true,
): Promise<ExtensionInstance> {
  const configuration = emptyConfig
    ? ({} as unknown as BaseConfigType)
    : ({
        access: {
          admin: {direct_api_mode: 'online'},
        },
        access_scopes: {
          scopes: 'read_products,write_products',
          use_legacy_install_flow: useLegacyInstallFlow,
        },
        auth: {
          redirect_urls: ['https://example.com/auth/callback'],
        },
      } as unknown as BaseConfigType)

  const extension = new ExtensionInstance({
    configuration,
    configurationPath: 'shopify.app.toml',
    directory: directory ?? './',
    specification: appAccessSpec as unknown as ExtensionSpecification,
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
  const configuration = emptyConfig ? ({} as unknown as BaseConfigType) : (config as unknown as BaseConfigType)

  const webhooksExtension = new ExtensionInstance({
    configuration,
    configurationPath: 'shopify.app.toml',
    directory: './',
    specification: appWebhookSubscriptionSpec as unknown as ExtensionSpecification,
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
