import {App, AppInterface} from './app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {UIExtensionInstance, uiSpecForType} from '../extensions/ui.js'
import {FunctionInstance, functionSpecForType} from '../extensions/functions.js'
import {ThemeExtensionInstance} from '../extensions/theme.js'
import themeSpec from '../extensions/theme-specifications/theme.js'
import {allLocalFunctionSpecifications, allLocalUISpecifications} from '../extensions/specifications.js'
import {api} from '@shopify/cli-kit'

export function testApp(app: Partial<AppInterface> = {}): AppInterface {
  const newApp = new App(
    app.name ?? 'App',
    app.idEnvironmentVariableName ?? 'SHOPIFY_API_KEY',
    app.directory ?? '/tmp/project',
    app.packageManager ?? 'yarn',
    app.configuration ?? {scopes: '', extensionDirectories: []},
    app.configurationPath ?? '/tmp/project/shopify.app.toml',
    app.nodeDependencies ?? {},
    app.webs ?? [],
    app.extensions?.ui ?? [],
    app.extensions?.theme ?? [],
    app.extensions?.function ?? [],
    app.usesWorkspaces ?? false,
    app.dotenv,
    app.errors,
  )
  if (app.updateDependencies) {
    Object.getPrototypeOf(newApp).updateDependencies = app.updateDependencies
  }
  if (app.hasUIExtensions) {
    Object.getPrototypeOf(newApp).hasUIExtensions = app.hasUIExtensions
  }
  return newApp
}

export async function testUIExtension(uiExtension: Partial<UIExtension> = {}): Promise<UIExtension> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.configuration?.name ?? 'test-ui-extension',
    type: uiExtension?.configuration?.type ?? 'product_subscription',
    metafields: [],
    capabilities: {
      block_progress: false,
      network_access: false,
      api_access: false,
    },
  }
  const configurationPath = uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`
  const entrySourceFilePath = uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`

  const specifications = await allLocalUISpecifications()
  const specification = (await uiSpecForType(configuration.type, specifications))!
  specification.surface = uiExtension.surface ?? 'unknown'

  const extension = new UIExtensionInstance({
    configuration,
    configurationPath,
    entryPath: entrySourceFilePath,
    directory,
    specification,
    remoteSpecification: undefined,
  })
  extension.devUUID = uiExtension?.devUUID ?? 'test-ui-extension-uuid'
  return extension
}

export async function testThemeExtensions(): Promise<ThemeExtension> {
  const configuration = {
    name: 'theme extension name',
    type: 'theme' as const,
  }

  return new ThemeExtensionInstance({
    configuration,
    configurationPath: '',
    directory: './my-extension',
    remoteSpecification: undefined,
    specification: themeSpec,
  })
}

export async function testFunctionExtension(): Promise<FunctionExtension> {
  const configuration = {
    name: 'test function extension',
    description: 'description',
    type: 'product_discounts',
    build: {
      command: 'echo "hello world"',
    },
    apiVersion: '2022-07',
    configurationUi: true,
  }

  const specifications = await allLocalFunctionSpecifications()
  const specification = functionSpecForType(configuration.type, specifications)

  return new FunctionInstance({
    configuration,
    configurationPath: '',
    specification: specification!,
    directory: './my-extension',
  })
}

export const testRemoteSpecifications: api.graphql.RemoteSpecification[] = [
  {
    name: 'Checkout Post Purchase',
    externalName: 'Post-purchase UI',
    identifier: 'checkout_post_purchase',
    externalIdentifier: 'post_purchase_ui',
    gated: false,
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
    externalIdentifier: 'theme_app_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
  },
  {
    name: 'Product Subscription',
    externalName: 'Subscription UI',
    identifier: 'product_subscription',
    externalIdentifier: 'subscription_ui',
    gated: false,
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
    externalIdentifier: 'ui_extension',
    gated: false,
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
    name: 'Customer Accounts',
    externalName: 'Customer Accounts',
    identifier: 'customer_accounts_ui_extension',
    externalIdentifier: 'customer_accounts_ui_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 10,
    },
    features: {
      argo: {
        surface: 'customer_accounts',
      },
    },
  },
  {
    name: 'Checkout Extension',
    externalName: 'Checkout UI',
    identifier: 'checkout_ui_extension',
    externalIdentifier: 'checkout_ui',
    gated: false,
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
    identifier: 'subscription_management',
    externalIdentifier: 'subscription_ui',
    gated: false,
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
    externalIdentifier: 'marketing_activity_extension',
    gated: false,
    options: {
      managementExperience: 'dashboard',
      registrationLimit: 100,
    },
  },
]
