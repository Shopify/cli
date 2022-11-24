import {Flags} from '@oclif/core'

/**
 * An object that contains the flags that
 * are shared across all the commands.
 */
export const globalFlags = {
  environment: Flags.string({
    hidden: true,
    description: 'The environment to apply to the current command.',
    env: 'SHOPIFY_FLAG_ENVIRONMENT',
    char: 'e',
  }),
  verbose: Flags.boolean({
    hidden: false,
    description: 'Increase the verbosity of the logs.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
}
