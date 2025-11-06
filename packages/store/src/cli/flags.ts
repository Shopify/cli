import {Flags} from '@oclif/core'

export const executeFlags = {
  query: Flags.string({
    char: 'q',
    description: 'the graphql query or mutation, as a string',
    exclusive: ['query-file'],
    env: 'SHOPIFY_FLAG_QUERY',
  }),
  'query-file': Flags.string({
    description: 'a file containing the graphql query or mutation',
    exclusive: ['query'],
    env: 'SHOPIFY_FLAG_QUERY_FILE',
  }),
  store: Flags.string({
    char: 's',
    description: 'the myshopify.com domain of the store',
    env: 'SHOPIFY_FLAG_STORE',
  }),
  variables: Flags.string({
    char: 'v',
    description: 'the values for graphql variables, in json format',
    multiple: true,
    exclusive: ['variable-file'],
    env: 'SHOPIFY_FLAG_VARIABLES',
  }),
  'variable-file': Flags.string({
    description: 'a file containing graphql variables, in jsonl format',
    exclusive: ['variables'],
    env: 'SHOPIFY_FLAG_VARIABLE_FILE',
  }),
  'output-file': Flags.string({
    description: 'the file name where results should be written',
    env: 'SHOPIFY_FLAG_OUTPUT_FILE',
  }),
  'bulk-operation': Flags.boolean({
    description: 'execute as a bulk operation',
    default: false,
    env: 'SHOPIFY_FLAG_BULK_OPERATION',
  }),
}
