import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across commands that can utilize esbuild.
 */
export const extensionFlags = {
  'source-maps': Flags.boolean({
    hidden: false,
    env: 'SHOPIFY_FLAG_SOURCE_MAPS',
    default: false,
  }),
}
