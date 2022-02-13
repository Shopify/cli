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
}
