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

// The order of the groups in extensionTypesGroups will be the same displayed in the select prompt
export const extensionTypesGroups: {name: string; extensions: string[]}[] = [
  {name: 'Online store', extensions: ['theme']},
  {
    name: 'Discounts and checkout',
    extensions: [
      'product_discounts',
      'order_discounts',
      'shipping_discounts',
      'payment_customization',
      'delivery_customization',
      'checkout_ui_extension',
      'checkout_post_purchase',
      'validation_customization',
    ],
  },
  {name: 'Analytics', extensions: ['web_pixel_extension']},
  {name: 'Merchant admin', extensions: ['product_subscription']},
  {name: 'Point-of-Sale', extensions: ['pos_ui_extension']},
  {
    name: 'Shopify private',
    extensions: ['customer_accounts_ui_extension', 'order_routing_location_rule'],
  },
]
