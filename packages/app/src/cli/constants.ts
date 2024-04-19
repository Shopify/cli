export const environmentVariableNames = {
  skipEsbuildReactDedeuplication: 'SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION',
  disableGraphiQLExplorer: 'SHOPIFY_CLI_DISABLE_GRAPHIQL',
  useDynamicConfigSpecifications: 'SHOPIFY_CLI_DYNAMIC_CONFIG',
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

export const ports = {
  graphiql: 3457,
} as const

export const EsbuildEnvVarRegex = /^([a-zA-Z_$])([a-zA-Z0-9_$])*$/
