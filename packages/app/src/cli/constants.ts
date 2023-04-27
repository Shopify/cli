import {ExtensionFlavor} from './models/app/extensions.js'

export const configurationFileNames = {
  app: 'shopify.app.toml',
  extension: {
    ui: 'shopify.ui.extension.toml',
    theme: 'shopify.theme.extension.toml',
    function: 'shopify.function.extension.toml',
  },
  web: 'shopify.web.toml',
  appEnvironments: 'shopify.environments.toml',
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
    defaultRegistrationLimit: 50,
  },
  web: {
    directoryName: 'web',
    configurationName: configurationFileNames.web,
  },
} as const

export const defaultFunctionsFlavors: ExtensionFlavor[] = [
  {name: 'JavaScript (developer preview)', value: 'vanilla-js'},
  {name: 'TypeScript (developer preview)', value: 'typescript'},
  {name: 'Rust', value: 'rust'},
  {name: 'Wasm', value: 'wasm'},
]

export const defaultExtensionFlavors: ExtensionFlavor[] = [
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
      'cart_checkout_validation',
      'checkout_post_purchase',
      'cart_transform',
      'fulfillment_constraints',
    ],
  },
  {name: 'Analytics', extensions: ['web_pixel_extension']},
  {name: 'Merchant admin', extensions: ['product_subscription', 'tax_calculation']},
  {name: 'Point-of-Sale', extensions: ['pos_ui_extension']},
  {
    name: 'Shopify private',
    extensions: ['customer_accounts_ui_extension', 'ui_extension', 'order_routing_location_rule'],
  },
]

export const templates = {
  specification: {
    remoteVersion: '1',
  },
} as const
