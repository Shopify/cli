import {Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'

/**
 * An object that contains the flags that
 * are shared across all the app commands.
 */
export const appFlags = {
  path: Flags.string({
    hidden: false,
    description: 'The path to your app directory.',
    parse: (input, _) => Promise.resolve(path.resolve(input)),
    env: 'SHOPIFY_FLAG_PATH',
  }),
}
