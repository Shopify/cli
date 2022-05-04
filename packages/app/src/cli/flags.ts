import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across all the app commands.
 */
export const appFlags = {
  path: Flags.string({
    hidden: true,
    description: 'The path to your app directory.',
    env: 'SHOPIFY_FLAG_PATH',
  }),
}
