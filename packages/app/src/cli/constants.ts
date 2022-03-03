export const configurationFileNames = {
  app: 'shopify.app.toml',
  uiExtension: 'shopify.ui-extension.toml',
  script: 'shopify.script.toml',
}

export const blocks = {
  uiExtensions: {
    directoryName: 'ui-extensions',
    configurationName: configurationFileNames.uiExtension,
  },
  scripts: {
    directoryName: 'scripts',
    configurationName: configurationFileNames.script,
  },
}

export const genericConfigurationFileNames = {
  yarn: {
    lockfile: 'yarn.lock',
  },
  pnpm: {
    lockfile: 'pnpm-lock.yaml',
  },
}

interface UiExtensionsType {
  // Dependent code requires that uiExtensions.types has at least 1 element.
  // Otherwise it will be typed as string[] which doesn't guarantee a first element.
  types: [string, ...string[]]
}
export const uiExtensions: UiExtensionsType = {
  types: [
    'theme-app-extension',
    'product-subscription',
    'checkout-post-purchase',
  ],
}
export type UiExtensionTypes = typeof uiExtensions.types[number]
