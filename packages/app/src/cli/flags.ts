import {Flags} from '@oclif/core'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

/**
 * An object that contains the flags that
 * are shared across all the app commands.
 */
export const appFlags = {
  path: Flags.string({
    description: 'The path to your app directory.',
    parse: async (input) => resolvePath(input),
    default: async () => cwd(),
    noCacheDefault: true,
    env: 'SHOPIFY_FLAG_PATH',
  }),
  config: Flags.string({
    hidden: false,
    char: 'c',
    description: 'The name of the app configuration.',
    env: 'SHOPIFY_FLAG_APP_CONFIG',
  }),
}
