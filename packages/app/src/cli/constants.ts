export const environmentVariableNames = {
  skipEsbuildReactDedeuplication: 'SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION',
}

export const configurationFileNames = {
  app: 'shopify.app.toml',
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
    defaultRegistrationLimit: 1,
  },
  web: {
    directoryName: 'web',
    configurationName: configurationFileNames.web,
  },
} as const
