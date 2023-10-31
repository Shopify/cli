export const environmentVariableNames = {
  skipEsbuildReactDedeuplication: 'SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION',
  enableGraphiQLExplorer: 'SHOPIFY_CLI_ENABLE_GRAPHIQL_EXPLORER',
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

export const urlNamespaces = {
  devTools: '.shopify',
} as const

export const EsbuildEnvVarRegex = /^([a-zA-Z0-9_])*$/
