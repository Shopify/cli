import {Flags} from '@oclif/core'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

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
  'client-id': Flags.string({
    hidden: false,
    description: 'The Client ID of your app.',
    env: 'SHOPIFY_FLAG_CLIENT_ID',
    exclusive: ['config'],
  }),
  reset: Flags.boolean({
    hidden: false,
    description: 'Reset all your settings.',
    env: 'SHOPIFY_FLAG_RESET',
    default: false,
    exclusive: ['config'],
  }),
}

export const bulkOperationFlags = {
  query: Flags.string({
    char: 'q',
    description: 'The GraphQL query or mutation to run as a bulk operation.',
    env: 'SHOPIFY_FLAG_QUERY',
    required: true,
  }),
  variables: Flags.string({
    char: 'v',
    description:
      'The values for any GraphQL variables in your mutation, in JSON format. Can be specified multiple times.',
    env: 'SHOPIFY_FLAG_VARIABLES',
    multiple: true,
  }),
  store: Flags.string({
    char: 's',
    description: 'The store domain. Must be an existing dev store.',
    env: 'SHOPIFY_FLAG_STORE',
    parse: async (input) => normalizeStoreFqdn(input),
  }),
}
