import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across all the commands.
 */
export const globalFlags = {
  verbose: Flags.boolean({
    hidden: false,
    description: 'Increase the verbosity of the logs.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
}
