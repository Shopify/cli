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
  react: '^17.0.0',
  reactTypes: '17.0.30',
} as const

export const blocks = {
  extensions: {
    directoryName: 'extensions',
    configurationName: configurationFileNames.extension,
    defaultRegistrationLimit: 1,
  },
  functions: {
    defaultUrl: 'https://github.com/Shopify/function-examples',
    defaultLanguage: 'wasm',
    defaultRegistrationLimit: 10,
  },
  web: {
    directoryName: 'web',
    configurationName: configurationFileNames.web,
  },
} as const

export const defaultFunctionsFlavors = [
  {name: 'Wasm', value: 'wasm'},
  {name: 'Rust', value: 'rust'},
]

export const defualtExtensionFlavors = [
  {name: 'TypeScript', value: 'typescript'},
  {name: 'JavaScript', value: 'vanilla-js'},
  {name: 'TypeScript React', value: 'typescript-react'},
  {name: 'JavaScript React', value: 'react'},
]

export const publicFunctionExtensions = {
  types: ['product_discounts', 'order_discounts', 'shipping_discounts'],
} as const

export const functionExtensions = {
  types: [
    ...publicFunctionExtensions.types,
    'shipping_rate_presenter',
    'payment_customization',
    'delivery_customization',
  ],
} as const

export const publicUIExtensions = {
  types: ['product_subscription', 'checkout_ui_extension', 'checkout_post_purchase', 'web_pixel_extension'],
} as const

export const uiExtensions = {
  types: [...publicUIExtensions.types, 'pos_ui_extension', 'customer_accounts_ui_extension', 'ui_extension'],
} as const

export const activeUIExtensions = {
  types: [...publicUIExtensions.types, 'pos_ui_extension', 'customer_accounts_ui_extension'].filter,
}

export type UIExtensionTypes = typeof uiExtensions.types[number] | string

export const themeExtensions = {
  types: ['theme'],
} as const

export const extensions: {types: string[]; publicTypes: string[]} = {
  types: [...themeExtensions.types, ...uiExtensions.types, ...functionExtensions.types],
  publicTypes: [...themeExtensions.types, ...publicUIExtensions.types, ...publicFunctionExtensions.types],
}

export type ExtensionTypes = typeof extensions.types[number] | string
type PublicExtensionTypes = typeof extensions.publicTypes[number] | string
type GatedExtensionTypes = Exclude<ExtensionTypes, PublicExtensionTypes>

export function extensionTypeIsGated(extensionType: ExtensionTypes): extensionType is GatedExtensionTypes {
  return !extensions.publicTypes.includes(extensionType)
}

// The order of the groups in extensionTypesGroups will be the same displayed in the select prompt
export const extensionTypesGroups: {name: string; extensions: ExtensionTypes[]}[] = [
  {name: 'Online store', extensions: ['theme']},
  {
    name: 'Discounts and checkout',
    extensions: [
      'product_discounts',
      'order_discounts',
      'shipping_discounts',
      'checkout_ui_extension',
      'checkout_post_purchase',
    ],
  },
  {name: 'Analytics', extensions: ['web_pixel_extension']},
  {name: 'Merchant admin', extensions: ['product_subscription']},
  {
    name: 'Shopify private',
    extensions: [
      'customer_accounts_ui_extension',
      'payment_customization',
      'delivery_customization',
      'pos_ui_extension',
      'shipping_rate_presenter',
      'ui_extension',
    ],
  },
]

/**
 * Each extension has a different ID in GraphQL.
 * Sometimes the ID is the same as the type, sometimes it's different.
 * @param type - The extension type
 * @returns The extension GraphQL ID
 */
export const extensionGraphqlId = (type: ExtensionTypes) => {
  switch (type) {
    case 'product_subscription':
      return 'SUBSCRIPTION_MANAGEMENT'
    case 'checkout_ui_extension':
      return 'CHECKOUT_UI_EXTENSION'
    case 'checkout_post_purchase':
      return 'CHECKOUT_POST_PURCHASE'
    case 'pos_ui_extension':
      return 'POS_UI_EXTENSION'
    case 'theme':
      return 'THEME_APP_EXTENSION'
    case 'web_pixel_extension':
      return 'WEB_PIXEL_EXTENSION'
    case 'customer_accounts_ui_extension':
      return 'CUSTOMER_ACCOUNTS_UI_EXTENSION'
    default:
      // As we add new extensions, this bug will force us to add a new case here.
      return type.toUpperCase()
  }
}
