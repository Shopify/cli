export const configurationFileNames = {
  app: 'shopify.app.toml',
  extension: 'shopify.extension.toml',
  script: 'shopify.script.toml',
  home: 'shopify.home.toml',
}

export const environmentVariables = {
  /**
   * Environment variable to instructs the CLI on running the extensions' CLI through its sources.
   */
  useExtensionsCLISources: 'SHOPIFY_USE_EXTENSIONS_CLI_SOURCES',
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
  types: ['theme', 'product_subscription', 'checkout_post_purchase'],
}

export type ExtensionTypes = typeof extensions.types[number]
