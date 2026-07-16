import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {normalizeBulkOperationId} from '@shopify/cli-kit/node/api/bulk-operations'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {Flags} from '@oclif/core'

function countryFlag(env: string) {
  return Flags.string({
    description: 'Two-letter country code for the store, such as US, CA, or GB.',
    env,
    required: false,
    parse: async (value) => value.trim().toUpperCase(),
  })
}

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value)
}

export const previewStoreFlags = {
  country: countryFlag('SHOPIFY_FLAG_PREVIEW_STORE_COUNTRY'),
}

export const storeFlags = {
  store: Flags.string({
    char: 's',
    description: 'The myshopify.com domain of the store.',
    env: 'SHOPIFY_FLAG_STORE',
    parse: async (input) => normalizeStoreFqdn(input),
    required: true,
  }),
  'organization-id': Flags.integer({
    description: 'The numeric organization ID. Auto-selects if you belong to a single organization.',
    env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
  }),
}

// Shared base for the bulk operation `--id` flag so the GID normalization lives in one place.
// Commands reference the exported flags directly (status = optional, cancel = required).
const bulkOperationIdBase = {
  env: 'SHOPIFY_FLAG_ID',
  parse: async (input: string) => normalizeBulkOperationId(input),
}

export const bulkOperationIdFlag = Flags.string({
  ...bulkOperationIdBase,
  description:
    'The bulk operation ID (numeric ID or full GID). If not provided, lists all bulk operations on this store in the last 7 days.',
})

export const requiredBulkOperationIdFlag = Flags.string({
  ...bulkOperationIdBase,
  description: 'The bulk operation ID to cancel (numeric ID or full GID).',
  required: true,
})

export const bulkOperationFlags = {
  query: Flags.string({
    char: 'q',
    description: 'The GraphQL query or mutation to run as a bulk operation.',
    env: 'SHOPIFY_FLAG_QUERY',
    required: false,
    exactlyOne: ['query', 'query-file'],
  }),
  'query-file': Flags.string({
    description: "Path to a file containing the GraphQL query or mutation. Can't be used with --query.",
    env: 'SHOPIFY_FLAG_QUERY_FILE',
    parse: async (input) => resolvePath(input),
    exactlyOne: ['query', 'query-file'],
  }),
  variables: Flags.string({
    char: 'v',
    description:
      'The values for any GraphQL variables in your mutation, in JSON format. Can be specified multiple times.',
    env: 'SHOPIFY_FLAG_VARIABLES',
    multiple: true,
    exclusive: ['variable-file'],
  }),
  'variable-file': Flags.string({
    description:
      "Path to a file containing GraphQL variables in JSONL format (one JSON object per line). Can't be used with --variables.",
    env: 'SHOPIFY_FLAG_VARIABLE_FILE',
    parse: async (input) => resolvePath(input),
    exclusive: ['variables'],
  }),
  watch: Flags.boolean({
    description: 'Wait for bulk operation results before exiting. Defaults to false.',
    env: 'SHOPIFY_FLAG_WATCH',
  }),
  'output-file': Flags.string({
    description:
      'The file path where results should be written if --watch is specified. If not specified, results will be written to STDOUT.',
    env: 'SHOPIFY_FLAG_OUTPUT_FILE',
    dependsOn: ['watch'],
  }),
  version: Flags.string({
    description: 'The API version to use for the bulk operation. If not specified, uses the latest stable version.',
    env: 'SHOPIFY_FLAG_VERSION',
  }),
  'allow-mutations': Flags.boolean({
    description: 'Allow GraphQL mutations to run against the target store.',
    env: 'SHOPIFY_FLAG_ALLOW_MUTATIONS',
    default: false,
  }),
}
