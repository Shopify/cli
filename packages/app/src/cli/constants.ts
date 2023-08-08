export const environmentVariableNames = {
  skipEsbuildReactDedeuplication: 'SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION',
}

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

export const templates = {
  specification: {
    remoteVersion: '1',
  },
} as const
