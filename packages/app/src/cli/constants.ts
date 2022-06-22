import {dependency} from '@shopify/cli-kit'

export const configurationFileNames = {
  app: 'shopify.app.toml',
  extension: {
    ui: 'shopify.ui.extension.toml',
    theme: 'shopify.theme.extension.toml',
    function: 'shopify.function.extension.toml',
  },
  web: 'shopify.web.toml',
} as const

export const dotEnvFileNames = {
  production: '.env',
}

export const environmentVariables = {
  /**
   * Environment variable to instructs the CLI on running the extensions' CLI through its sources.
   */
  useExtensionsCLISources: 'SHOPIFY_USE_EXTENSIONS_CLI_SOURCES',
} as const

export const versions = {
  extensionsBinary: 'v0.20.2',
  react: '^17.0.0',
} as const

export const blocks = {
  extensions: {
    directoryName: 'extensions',
    configurationName: configurationFileNames.extension,
  },
  functions: {
    defaultUrl: 'https://github.com/Shopify/function-examples',
    defaultLanguage: 'wasm',
  },
  web: {
    directoryName: 'web',
    configurationName: configurationFileNames.web,
  },
} as const

/**
 * List of extensions for each category that are limited by quantity, only 1 of each is allowed per app
 */
export const limitedExtensions: {
  ui: UIExtensionTypes[]
  theme: ThemeExtensionTypes[]
  function: FunctionExtensionTypes[]
} = {
  ui: ['product_subscription', 'checkout_post_purchase', 'web_pixel_extension'],
  theme: ['theme'],
  function: [],
}

export const publicFunctionExtensions = {
  types: ['product_discounts', 'order_discounts', 'shipping_discounts'],
} as const
export const functionExtensions = {
  types: [...publicFunctionExtensions.types, 'payment_methods', 'shipping_rate_presenter'],
} as const

export const functionExtensionTemplates = [
  {name: 'Wasm', value: 'wasm'},
  {name: 'Rust', value: 'rust'},
]

export function isFunctionExtensionType(extensionType: string) {
  return (functionExtensions.types as ReadonlyArray<string>).includes(extensionType)
}

export const publicUIExtensions = {
  types: ['product_subscription', 'checkout_ui_extension', 'checkout_post_purchase', 'web_pixel_extension'],
} as const

export const uiExtensions = {
  types: [...publicUIExtensions.types, 'pos_ui_extension'],
} as const

export const activeUIExtensions = {
  types: [...publicUIExtensions.types, 'pos_ui_extension'].filter,
}

export type UIExtensionTypes = typeof uiExtensions.types[number]

export const uiExtensionTemplates = [
  {name: 'React', value: 'react'},
  {name: 'vanilla JavaScript', value: 'vanilla-js'},
]

export function isUiExtensionType(extensionType: string) {
  return (uiExtensions.types as ReadonlyArray<string>).includes(extensionType)
}

export const themeExtensions = {
  types: ['theme'],
} as const

export type ThemeExtensionTypes = typeof themeExtensions.types[number]

export function isThemeExtensionType(extensionType: string) {
  return (themeExtensions.types as ReadonlyArray<string>).includes(extensionType)
}

export type FunctionExtensionTypes = typeof functionExtensions.types[number]

export const extensions = {
  types: [...themeExtensions.types, ...uiExtensions.types, ...functionExtensions.types],
  publicTypes: [...themeExtensions.types, ...publicUIExtensions.types, ...publicFunctionExtensions.types],
}

export type ExtensionTypes = typeof extensions.types[number]

export function extensionTypeCategory(extensionType: ExtensionTypes): 'theme' | 'function' | 'ui' {
  if (extensionType === 'theme') {
    return 'theme'
  }
  if ((functionExtensions.types as ReadonlyArray<string>).includes(extensionType)) {
    return 'function'
  }
  return 'ui'
}

/**
 * Given a extension type, it returns the extension point name that's necessary
 * when interacting when the API.
 * @param type {FunctionExtensionTypes} Function extension type.
 * @returns {string} Extension point name.
 */
export const getFunctionExtensionPointName = (type: FunctionExtensionTypes) => {
  switch (type) {
    case 'product_discounts':
      return 'PRODUCT_DISCOUNTS'
    case 'order_discounts':
      return 'ORDER_DISCOUNTS'
    case 'shipping_discounts':
      return 'SHIPPING_DISCOUNTS'
    case 'payment_methods':
      return 'PAYMENT_METHODS'
    case 'shipping_rate_presenter':
      return 'SHIPPING_METHODS'
  }
}

/**
 * Returns the runtime renderer dependency for a given UI extension type.
 * @param extensionType {UIExtensionTypes} Extension type.
 * @returns The renderer dependency that should be present in the app's package.json
 */
export function getUIExtensionRendererDependency(
  extensionType: UIExtensionTypes,
): dependency.DependencyVersion | undefined {
  switch (extensionType) {
    case 'product_subscription':
      return {name: '@shopify/admin-ui-extensions-react', version: '^1.0.1'}
    case 'checkout_ui_extension':
      return {name: '@shopify/checkout-ui-extensions-react', version: '^0.17.0'}
    case 'checkout_post_purchase':
      return {name: '@shopify/post-purchase-ui-extensions-react', version: '^0.13.2'}
    case 'pos_ui_extension':
      return {name: '@shopify/retail-ui-extensions-react', version: '^0.1.0'}
    case 'web_pixel_extension':
      return {name: '@shopify/web-pixels-extension', version: '^0.1.1'}
  }
}

export const extensionTypesHumanKeys = {
  types: [
    'web pixel',
    'post-purchase UI',
    'theme app extension',
    'checkout UI',
    'POS UI',
    'subscription UI',
    'product discount',
    'order discount',
    'shipping discount',
    'payment customization',
    'delivery option presenter',
  ],
} as const

export type ExtensionTypesHumanKeys = typeof extensionTypesHumanKeys.types[number]
export interface ExtensionOutputConfig {
  humanKey: ExtensionTypesHumanKeys
  helpURL?: string
  additionalHelp?: string
}

export function getExtensionOutputConfig(extensionType: ExtensionTypes): ExtensionOutputConfig {
  switch (extensionType) {
    case 'web_pixel_extension':
      return buildExtensionOutputConfig('web pixel')
    case 'checkout_post_purchase':
      return buildExtensionOutputConfig('post-purchase UI', 'https://shopify.dev/apps/checkout/post-purchase')
    case 'theme':
      return buildExtensionOutputConfig('theme app extension')
    case 'checkout_ui_extension':
      return buildExtensionOutputConfig('checkout UI')
    case 'product_subscription':
      return buildExtensionOutputConfig('subscription UI')
    case 'pos_ui_extension':
      return buildExtensionOutputConfig('POS UI')
    case 'product_discounts':
      return buildExtensionOutputConfig('product discount', 'https://shopify.dev/apps/subscriptions/discounts')
    case 'order_discounts':
      return buildExtensionOutputConfig('order discount', 'https://shopify.dev/apps/subscriptions/discounts')
    case 'shipping_discounts':
      return buildExtensionOutputConfig('shipping discount', 'https://shopify.dev/apps/subscriptions/discounts')
    case 'payment_methods':
      return buildExtensionOutputConfig('payment customization')
    case 'shipping_rate_presenter':
      return buildExtensionOutputConfig('delivery option presenter')
  }
}

export function getExtensionTypeFromHumanKey(humanKey: ExtensionTypesHumanKeys): ExtensionTypes {
  switch (humanKey) {
    case 'checkout UI':
      return 'checkout_ui_extension'
    case 'order discount':
      return 'product_discounts'
    case 'product discount':
      return 'product_discounts'
    case 'shipping discount':
      return 'shipping_discounts'
    case 'payment customization':
      return 'payment_methods'
    case 'post-purchase UI':
      return 'checkout_post_purchase'
    case 'subscription UI':
      return 'product_subscription'
    case 'POS UI':
      return 'pos_ui_extension'
    case 'delivery option presenter':
      return 'shipping_rate_presenter'
    case 'theme app extension':
      return 'theme'
    case 'web pixel':
      return 'web_pixel_extension'
  }
}

function buildExtensionOutputConfig(humanKey: ExtensionTypesHumanKeys, helpURL?: string, additionalHelp?: string) {
  return {
    humanKey,
    helpURL,
    additionalHelp,
  }
}
