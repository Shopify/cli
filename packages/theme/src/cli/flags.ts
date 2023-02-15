import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {resolvePath} from '@shopify/cli-kit/node/path'

/**
 * An object that contains the flags that
 * are shared across all the theme commands.
 */
export const themeFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your theme directory.',
    parse: (input, _) => Promise.resolve(resolvePath(input)),
    env: 'SHOPIFY_FLAG_PATH',
    default: '.',
  }),
  password: Flags.string({
    hidden: false,
    description: 'Password generated from the Theme Access app.',
    env: 'SHOPIFY_CLI_THEME_TOKEN',
  }),
  store: Flags.string({
    char: 's',
    description:
      'Store URL. It can be the store prefix (johns-apparel)' +
      ' or the full myshopify.com URL (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).',
    env: 'SHOPIFY_FLAG_STORE',
    parse: (input, _) => Promise.resolve(normalizeStoreFqdn(input)),
  }),
}
