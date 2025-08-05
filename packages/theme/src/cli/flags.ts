import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

/**
 * An object that contains the flags that
 * are shared across all the theme commands.
 */
export const themeFlags = {
  path: Flags.string({
    description: 'The path where you want to run the command. Defaults to the current working directory.',
    env: 'SHOPIFY_FLAG_PATH',
    parse: async (input) => resolvePath(input),
    default: async () => cwd(),
    noCacheDefault: true,
  }),
  password: Flags.string({
    description: 'Password generated from the Theme Access app.',
    env: 'SHOPIFY_CLI_THEME_TOKEN',
    parse: async (input) => {
      if (input.startsWith('shptka_')) {
        return input
      }

      throw new AbortError('Invalid password. Please generate a new password from the Theme Access app.')
    },
  }),
  store: Flags.string({
    char: 's',
    description:
      'Store URL. It can be the store prefix (example)' +
      ' or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com).',
    env: 'SHOPIFY_FLAG_STORE',
    parse: async (input) => normalizeStoreFqdn(input),
  }),
  environment: Flags.string({
    char: 'e',
    description: 'The environment to apply to the current command.',
    env: 'SHOPIFY_FLAG_ENVIRONMENT',
    multiple: true,
  }),
}

const globQuotesDescription = "Wrap the value in double quotes if you're using wildcards."

export const globFlags = (action: 'download' | 'upload') => ({
  only: Flags.string({
    char: 'o',
    multiple: true,
    description: `${
      action.charAt(0).toUpperCase() + action.slice(1)
    } only the specified files (Multiple flags allowed). ${globQuotesDescription}`,
    env: 'SHOPIFY_FLAG_ONLY',
  }),
  ignore: Flags.string({
    char: 'x',
    multiple: true,
    description: `Skip ${action}ing the specified files (Multiple flags allowed). ${globQuotesDescription}`,
    env: 'SHOPIFY_FLAG_IGNORE',
  }),
})
