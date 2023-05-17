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

export const templates = {
  specification: {
    remoteVersion: '1',
  },
} as const
