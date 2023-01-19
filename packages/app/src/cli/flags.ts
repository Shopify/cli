import {Flags} from '@oclif/core'
import {resolvePath} from '@shopify/cli-kit/node/path'

/**
 * An object that contains the flags that
 * are shared across all the app commands.
 */
export const appFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your app directory.',
    parse: (input, _) => Promise.resolve(resolvePath(input)),
    env: 'SHOPIFY_FLAG_PATH',
  }),
}
