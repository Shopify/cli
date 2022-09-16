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
    unitTest: 'SHOPIFY_UNIT_TEST',
    env: 'SHOPIFY_ENV',
    serviceEnv: 'SHOPIFY_SERVICE_ENV',
    runAsUser: 'SHOPIFY_RUN_AS_USER',
    spinInstance: 'SPIN_INSTANCE',
    spinWorkspace: 'SPIN_WORKSPACE',
    spinNamespace: 'SPIN_NAMESPACE',
    spinHost: 'SPIN_HOST',
    partnersToken: 'SHOPIFY_CLI_PARTNERS_TOKEN',
    verbose: 'SHOPIFY_FLAG_VERBOSE',
    noAnalytics: 'SHOPIFY_CLI_NO_ANALYTICS',
    alwaysLogAnalytics: 'SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS',
    firstPartyDev: 'SHOPIFY_CLI_1P_DEV',
    enableCliRedirect: 'SHOPIFY_CLI_ENABLE_CLI_REDIRECT',
    skipCliRedirect: 'SHOPIFY_CLI_SKIP_CLI_REDIRECT',
    debugGoBinary: 'SHOPIFY_DEBUG_GO_BINARY',
    deviceAuth: 'SHOPIFY_CLI_DEVICE_AUTH',
    // Variables to detect if the CLI is running in a cloud environment
    spin: 'SPIN',
    codespaces: 'CODESPACES',
    codespaceName: 'CODESPACE_NAME',
    gitpod: 'GITPOD_WORKSPACE_URL',
    codesandboxHost: 'HOSTNAME',
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
