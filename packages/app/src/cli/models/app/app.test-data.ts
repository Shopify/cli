import {App, AppInterface} from './app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {UIExtensionInstance, UIExtensionSpec} from '../extensions/ui.js'
import {FunctionConfigType, FunctionInstance} from '../extensions/functions.js'
import {ThemeExtensionInstance} from '../extensions/theme.js'
import themeSpec from '../extensions/theme-specifications/theme.js'
import {loadLocalExtensionsSpecifications} from '../extensions/specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {RemoteTemplateSpecification} from '../../api/graphql/template_specifications.js'

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
  if (app.extensionsForType) {
    Object.getPrototypeOf(newApp).extensionsForType = app.extensionsForType
  }
  return newApp
}

export async function testUIExtension(uiExtension: Partial<UIExtension> = {}): Promise<UIExtension> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.configuration?.name ?? 'test-ui-extension',
    type: uiExtension?.configuration?.type ?? uiExtension?.type ?? 'product_subscription',
    metafields: [],
    capabilities: {
      block_progress: false,
      network_access: false,
      api_access: false,
    },
  }
  const configurationPath = uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`
  const entrySourceFilePath = uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`

  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === configuration.type) as UIExtensionSpec

  const extension = new UIExtensionInstance({
    configuration,
    configurationPath,
    entryPath: entrySourceFilePath,
    directory,
    specification,
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
    specification: themeSpec,
    outputBundlePath: './my-extension',
  })
}

function defaultFunctionConfiguration(): FunctionConfigType {
  return {
    name: 'test function extension',
    description: 'description',
    type: 'product_discounts',
    build: {
      command: 'echo "hello world"',
    },
    apiVersion: '2022-07',
    configurationUi: true,
  }
}

interface TestFunctionExtensionOptions {
  dir?: string
  config?: FunctionConfigType
}

export async function testFunctionExtension(opts: TestFunctionExtensionOptions = {}): Promise<FunctionExtension> {
  const directory = opts.dir ?? '/tmp/project/extensions/my-function'
  const configuration = opts.config ?? defaultFunctionConfiguration()

  return new FunctionInstance({
    configuration,
    configurationPath: '',
    directory,
  })
}

export const testRemoteSpecifications: RemoteSpecification[] = [
  {
    name: 'Checkout Post Purchase',
    externalName: 'Post-purchase UI',
    identifier: 'checkout_post_purchase',
    externalIdentifier: 'checkout_post_purchase_external',
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
    externalIdentifier: 'theme_external',
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
    externalIdentifier: 'product_subscription_external',
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
    externalIdentifier: 'ui_extension_external',
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
    externalIdentifier: 'customer_accounts_ui_extension_external',
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
    externalIdentifier: 'checkout_ui_extension_external',
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
    // we are going to replace this to 'product_subscription' because we
    // started using it before relying on the extension specification identifier
    identifier: 'subscription_management',
    externalIdentifier: 'product_subscription_external',
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
    externalIdentifier: 'marketing_activity_extension_external',
    gated: false,
    options: {
      managementExperience: 'dashboard',
      registrationLimit: 100,
    },
  },
]

export const testRemoteTemplateSpecifications: RemoteTemplateSpecification[] = [
  {
    identifier: 'order_discount',
    name: 'Function - Order discount',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'order_discount',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'discounts/javascript/order-discounts/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'discounts/javascript/order-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/order-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/order-discounts/default',
          },
        ],
      },
      {
        type: 'order_discount',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'discounts/javascript/order-discounts/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'discounts/javascript/order-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/order-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/order-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'cart_checkout_validation',
    name: 'Function - Cart and Checkout Validation',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'cart_checkout_validation',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'checkout/javascript/cart-checkout-validation/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'checkout/javascript/cart-checkout-validation/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-checkout-validation/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/cart-checkout-validation/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'cart_transform',
    name: 'Function - Cart transformer',
    group: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'cart_transform',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'checkout/javascript/cart-transform/bundles',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'checkout/javascript/cart-transform/bundles',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/cart-transform/bundles',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/cart-transform/bundles',
          },
        ],
      },
    ],
  },
  {
    identifier: 'delivery_customization',
    name: 'Function - Delivery customization',
    group: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'delivery_customization',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'checkout/javascript/delivery-customization/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/delivery-customization/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/delivery-customization/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/delivery-customization/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'payment_customization',
    name: 'Function - Payment customization',
    group: 'Discounts and checkout',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'payment_customization',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'checkout/javascript/payment-customization/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'checkout/javascript/payment-customization/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'checkout/rust/payment-customization/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'checkout/wasm/payment-customization/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'product_discounts',
    name: 'Function - Product discount',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'product_discounts',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'discounts/javascript/product-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/product-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/product-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'shipping_discounts',
    name: 'Function - Shipping discount',
    group: 'Discounts and checkout',
    supportLinks: ['https://shopify.dev/docs/apps/discounts'],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'shipping_discounts',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'discounts/javascript/shipping-discounts/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'discounts/javascript/shipping-discounts/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'discounts/rust/shipping-discounts/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'discounts/wasm/shipping-discounts/default',
          },
        ],
      },
    ],
  },
  {
    identifier: 'order_routing_location_rule',
    name: 'Function - Order routing location rule',
    group: 'Shopify private',
    supportLinks: [],
    url: 'https://github.com/Shopify/function-examples',
    types: [
      {
        type: 'order_routing_location_rule',
        extensionPoints: [],
        supportedFlavors: [
          {
            name: 'Javascript (developer preview)',
            value: 'vanilla-js',
            path: 'order-routing/javascript/rankers/default',
          },
          {
            name: 'Typescript (developer preview)',
            value: 'typescript',
            path: 'order-routing/javascript/rankers/default',
          },
          {
            name: 'Rust',
            value: 'rust',
            path: 'order-routing/rust/rankers/default',
          },
          {
            name: 'Wasm',
            value: 'wasm',
            path: 'order-routing/wasm/rankers/default',
          },
        ],
      },
    ],
  },
]
