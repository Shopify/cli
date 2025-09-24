import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
import {renderError} from '@shopify/cli-kit/node/ui'

/**
 * An object that contains the flags that
 * are shared across all the theme commands.
 */
export const themeFlags = {
  path: Flags.string({
    description: 'The path where you want to run the command. Defaults to the current working directory.',
    env: 'SHOPIFY_FLAG_PATH',
    parse: async (input) => {
      const resolvedPath = resolvePath(input)

      if (fileExistsSync(resolvedPath)) {
        return resolvedPath
      }

      // We can't use AbortError because oclif catches it and adds its own
      // messaging that breaks our UI
      renderError({
        headline: "A path was explicitly provided but doesn't exist.",
        body: [`Please check the path and try again: ${resolvedPath}`],
      })
      process.exit(1)
    },
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
