// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
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
    shopifyConfig: 'SHOPIFY_CONFIG',
    runAsUser: 'SHOPIFY_RUN_AS_USER',
    partnersEnv: 'SHOPIFY_PARTNERS_ENV',
    shopifyEnv: 'SHOPIFY_SHOPIFY_ENV',
    identityEnv: 'SHOPIFY_IDENTITY_ENV',
    spin: 'SPIN',
    spinInstance: 'SPIN_INSTANCE',
    spinWorkspace: 'SPIN_WORKSPACE',
    spinNamespace: 'SPIN_NAMESPACE',
    spinHost: 'SPIN_HOST',
    partnersToken: 'SHOPIFY_CLI_PARTNERS_TOKEN',
    verbose: 'SHOPIFY_FLAG_VERBOSE',
    noAnalytics: 'SHOPIFY_CLI_NO_ANALYTICS',
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
  /**
   * Versions are resolved at build time by Rollup's JSON plugin.
   */
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

export default constants
