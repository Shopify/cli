import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

/**
 * An object that contains the flags that
 * are shared across all the theme commands.
 */
export const themeFlags = {
  path: Flags.string({
    description: 'The path to your theme directory.',
    env: 'SHOPIFY_FLAG_PATH',
    parse: async (input) => resolvePath(input),
    default: async () => cwd(),
    noCacheDefault: true,
  }),
  password: Flags.string({
    description: 'Password generated from the Theme Access app.',
    env: 'SHOPIFY_CLI_THEME_TOKEN',
  }),
  store: Flags.string({
    char: 's',
    description:
      'Store URL. It can be the store prefix (johns-apparel)' +
      ' or the full myshopify.com URL (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).',
    env: 'SHOPIFY_FLAG_STORE',
    parse: async (input) => normalizeStoreFqdn(input),
  }),
  environment: Flags.string({
    char: 'e',
    description: 'The environment to apply to the current command.',
    env: 'SHOPIFY_FLAG_ENVIRONMENT',
  }),
}
