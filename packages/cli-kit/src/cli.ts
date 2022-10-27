import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across all the commands.
 */
export const globalFlags = {
  preset: Flags.string({
    hidden: true,
    description: 'The preset to apply to the current command.',
    env: 'SHOPIFY_FLAG_PRESET',
  }),
  verbose: Flags.boolean({
    hidden: false,
    description: 'Increase the verbosity of the logs.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
}
