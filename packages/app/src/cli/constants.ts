export const environmentVariableNames = {
  skipEsbuildReactDedeuplication: 'SHOPIFY_CLI_SKIP_ESBUILD_REACT_DEDUPLICATION',
  disableGraphiQLExplorer: 'SHOPIFY_CLI_DISABLE_GRAPHIQL',
  useDynamicConfigSpecifications: 'SHOPIFY_CLI_DYNAMIC_CONFIG',
  enableAppLogPolling: 'SHOPIFY_CLI_ENABLE_APP_LOG_POLLING',
  templatesJsonPath: 'SHOPIFY_CLI_APP_TEMPLATES_JSON_PATH',
  mkcertBinaryPath: 'SHOPIFY_CLI_MKCERT_BINARY',
  disableMinificationOnDev: 'SHOPIFY_CLI_DISABLE_MINIFICATION_ON_DEV',
  disableWasmTomlPatch: 'SHOPIFY_CLI_DISABLE_WASM_TOML_PATCH',
}

export const configurationFileNames = {
  app: 'shopify.app.toml',
  web: 'shopify.web.toml',
  appEnvironments: 'shopify.environments.toml',
  lockFile: '.shopify.lock',
  hiddenConfig: 'project.json',
  hiddenFolder: '.shopify',
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
  localhost: 3458,
} as const

export const EsbuildEnvVarRegex = /^([a-zA-Z_$])([a-zA-Z0-9_$])*$/
