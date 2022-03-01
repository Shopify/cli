// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as cliKitVersion} from '../package.json'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as cliVersion} from '../../cli/package.json'

const constants = {
  environmentVariables: {
    debug: 'DEBUG',
    runAsUser: 'SHOPIFY_RUN_AS_USER',
    partnersEnv: 'SHOPIFY_PARTNERS_ENV',
    shopifyEnv: 'SHOPIFY_SHOPIFY_ENV',
    identityEnv: 'SHOPIFY_IDENTITY_ENV',
    spin: 'SPIN',
    spinInstance: 'SPIN_INSTANCE',
    spinWorkspace: 'SPIN_WORKSPACE',
    spinNamespace: 'SPIN_NAMESPACE',
    spinHost: 'SPIN_HOST',
  },
  paths: {
    executables: {
      dev: '/opt/dev/bin/dev',
    },
  },
  /**
   * Versions are resolved at build time by Rollup's JSON plugin.
   */
  versions: {
    cliKit: cliKitVersion,
    /**
     * cli-kit can resolve the version of cli at build time because
     * the version of both packages is tied. If it wasn't, wen'd need
     * to resolve the version at build time.
     * Check out the linked configuration in .changeset/config.json
     */
    cli: cliVersion,
  },
  keychain: {
    service: 'shopify-cli',
  },
  session: {
    expirationTimeMarginInMinutes: 4,
  },
}

export default constants
