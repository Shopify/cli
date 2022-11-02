import {join as pathJoin} from './path.js'
import {findPackageVersionUp} from './version.js'
import envPaths from 'env-paths'

const identifier = 'shopify-cli'

const cacheFolder = () => {
  if (process.env.XDG_CACHE_HOME) return process.env.XDG_CACHE_HOME
  return envPaths(identifier).cache
}

const constants = {
  environmentVariables: {
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
    spinHost: 'SPIN_HOST',
    spinInstance: 'SPIN_INSTANCE',
    spinNamespace: 'SPIN_NAMESPACE',
    spinWorkspace: 'SPIN_WORKSPACE',
    themeToken: 'SHOPIFY_CLI_THEME_TOKEN',
    unitTest: 'SHOPIFY_UNIT_TEST',
    verbose: 'SHOPIFY_FLAG_VERBOSE',
    functionMatching: 'SHOPIFY_CLI_FUNCTION_MATCHING',
    // Variables to detect if the CLI is running in a cloud environment
    codespaceName: 'CODESPACE_NAME',
    codespaces: 'CODESPACES',
    gitpod: 'GITPOD_WORKSPACE_URL',
    spin: 'SPIN',
  },
  paths: {
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
            return pathJoin(cacheFolder(), 'vendor')
          },
          binaries: () => {
            return pathJoin(cacheFolder(), 'vendor', 'binaries')
          },
        },
      },
    },
  },
  versions: {
    cliKit: async () => {
      return findPackageVersionUp({fromModuleURL: import.meta.url})
    },
  },
  keychain: {
    service: 'shopify-cli',
  },
  session: {
    expirationTimeMarginInMinutes: 4,
  },
}

export const bugsnagApiKey = '9e1e6889176fd0c795d5c659225e0fae'

export default constants
