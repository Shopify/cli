export const configurationFileNames = {
  app: '.shopify.app.toml',
  uiExtension: '.shopify.ui-extension.toml',
  script: '.shopify.script.toml',
};

export const blocks = {
  uiExtensions: {
    directoryName: 'ui-extensions',
    configurationName: configurationFileNames.uiExtension,
  },
  scripts: {
    directoryName: 'scripts',
    configurationName: configurationFileNames.script,
  },
};

export const genericConfigurationFileNames = {
  yarn: {
    lockfile: 'yarn.lock',
  },
  pnpm: {
    lockfile: 'pnpm-lock.yaml',
  },
};

export const extensions = {
  types: [
    'theme-app-extension',
    'product-subscription',
    'checkout-post-purchase',
  ],
};
export type ExtensionTypes = typeof extensions.types[number];
