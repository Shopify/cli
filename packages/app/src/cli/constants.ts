export const configurationFileNames = {
  app: 'shopify.app.toml',
  extension: 'shopify.extension.toml',
  script: 'shopify.script.toml',
  home: 'shopify.home.toml',
}

export const versions = {
  extensionsBinary: 'v0.2.0',
}

export const blocks = {
  extensions: {
    directoryName: 'extensions',
    configurationName: configurationFileNames.extension,
  },
  scripts: {
    directoryName: 'scripts',
    configurationName: configurationFileNames.script,
  },
  home: {
    directoryName: 'home',
    configurationName: configurationFileNames.home,
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

interface ExtensionsType {
  // Dependent code requires that extensions.types has at least 1 element.
  // Otherwise it will be typed as string[] which doesn't guarantee a first element.
  types: [string, ...string[]]
}
export const extensions: ExtensionsType = {
  types: ['theme-app-extension', 'product-subscription', 'checkout-post-purchase'],
}
export type ExtensionTypes = typeof extensions.types[number]
