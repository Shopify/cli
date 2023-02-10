import {joinPath} from '../../public/node/path.js'
import envPaths from 'env-paths'

const identifier = 'shopify-cli'

const cacheFolder = () => {
  if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME
  return envPaths(identifier).cache
}

export const environmentVariables = {
  alwaysLogAnalytics: 'SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS',
  deviceAuth: 'SHOPIFY_CLI_DEVICE_AUTH',
  enableCliRedirect: 'SHOPIFY_CLI_ENABLE_CLI_REDIRECT',
  env: 'SHOPIFY_CLI_ENV',
  firstPartyDev: 'SHOPIFY_CLI_1P_DEV',
  noAnalytics: 'SHOPIFY_CLI_NO_ANALYTICS',
  partnersToken: 'SHOPIFY_CLI_PARTNERS_TOKEN',
  runAsUser: 'SHOPIFY_RUN_AS_USER',
  serviceEnv: 'SHOPIFY_SERVICE_ENV',
  skipCliRedirect: 'SHOPIFY_CLI_SKIP_CLI_REDIRECT',
  spinInstance: 'SPIN_INSTANCE',
  themeToken: 'SHOPIFY_CLI_THEME_TOKEN',
  unitTest: 'SHOPIFY_UNIT_TEST',
  verbose: 'SHOPIFY_FLAG_VERBOSE',
  noThemeBundling: 'SHOPIFY_CLI_NO_THEME_BUNDLING',
  javascriptFunctions: 'SHOPIFY_CLI_FUNCTIONS_JAVASCRIPT',
  // Variables to detect if the CLI is running in a cloud environment
  codespaceName: 'CODESPACE_NAME',
  codespaces: 'CODESPACES',
  gitpod: 'GITPOD_WORKSPACE_URL',
  spin: 'SPIN',
}

export const pathConstants = {
  executables: {
    dev: '/opt/dev/bin/dev',
  },
  directories: {
    cache: {
      path: () => {
        return cacheFolder()
      },
      vendor: {
        path: () => {
          return joinPath(cacheFolder(), 'vendor')
        },
        binaries: () => {
          return joinPath(cacheFolder(), 'vendor', 'binaries')
        },
      },
    },
  },
}

export const keychainConstants = {
  service: 'shopify-cli',
}

export const sessionConstants = {
  expirationTimeMarginInMinutes: 4,
}

export const bugsnagApiKey = '9e1e6889176fd0c795d5c659225e0fae'
