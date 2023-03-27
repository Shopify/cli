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
    env: 'SHOPIFY_FLAG_PATH',
  }),
  environment: Flags.string({
    hidden: true,
    char: 'e',
    description: 'The environment to apply to the current command.',
    env: 'SHOPIFY_FLAG_ENVIRONMENT',
  }),
}
