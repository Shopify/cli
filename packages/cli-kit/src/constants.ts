// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as cliKitVersion} from '../package.json'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {version as cliVersion} from '../../cli/package.json'

const constants = {
  environmentVariables: {
    debug: 'DEBUG',
    partnersEnv: 'SHOPIFY_PARTNERS_ENV',
    shopifyEnv: 'SHOPIFY_SHOPIFY_ENV',
    identityEnv: 'SHOPIFY_IDENTITY_ENV',
    spin: 'SPIN',
    spinInstance: 'SPIN_INSTANCE',
    spinWorkspace: 'SPIN_WORKSPACE',
    spinNamespace: 'SPIN_NAMESPACE',
    spinHost: 'SPIN_HOST',
  },
  /**
   * Versions are resolved at build time by Rollup's JSON plugin.
   */
  versions: {
    cliKit: cliKitVersion,
    cli: cliVersion,
  },
  keychain: {
    service: 'shopify-cli',
  },
}

export default constants
