// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {join as pathJoin} from './path'
import {version as cliKitVersion} from '../package.json'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as cliVersion} from '../../cli/package.json'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as appVersion} from '../../app/package.json'
import envPaths from 'env-paths'

const identifier = 'shopify-cli'

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
  },
  paths: {
    executables: {
      dev: '/opt/dev/bin/dev',
    },
    directories: {
      cache: {
        path: () => {
          return envPaths(identifier).cache
        },
        vendor: {
          path: () => {
            return pathJoin(envPaths(identifier).cache, 'vendor')
          },
          binaries: () => {
            return pathJoin(envPaths(identifier).cache, 'vendor', 'binaries')
          },
        },
      },
    },
  },
  /**
   * Versions are resolved at build time by Rollup's JSON plugin.
   */
  versions: {
    cliKit: cliKitVersion,
    /**
     * cli-kit can resolve the version of cli and app at build time because
     * the version of both packages is tied. If it wasn't, wen'd need
     * to resolve the version at build time.
     * Check out the linked configuration in .changeset/config.json
     */
    cli: cliVersion,
    app: appVersion,
  },
  keychain: {
    service: 'shopify-cli',
  },
  session: {
    expirationTimeMarginInMinutes: 4,
  },
}

export default constants
