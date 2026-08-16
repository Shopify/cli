import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {normalizeBulkOperationId} from '@shopify/cli-kit/node/api/bulk-operations'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Flags} from '@oclif/core'

// Error message shown when a `--country` flag value is not a two-letter code.
const invalidCountryCodeMessage = 'Country must be a two-letter country code, for example: US.'

// Matches a two-letter (ISO 3166-1 alpha-2 shaped) country code after normalization.
function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value)
}

/**
 * Reusable `--country` flag shared by every store-creation command. The value
 * is normalized to an uppercase, trimmed string and validated during parsing,
 * so invalid codes are rejected with the same error before a command's `run`
 * body executes.
 */
export const countryFlag = Flags.string({
  description: 'Two-letter country code for the store, such as US, CA, or GB. Follows the ISO 3166-1 alpha-2 standard.',
  env: 'SHOPIFY_FLAG_STORE_COUNTRY',
  required: false,
  parse: async (value) => {
    const normalized = value.trim().toUpperCase()
    if (!isCountryCode(normalized)) {
      throw new AbortError(invalidCountryCodeMessage)
    }
    return normalized
  },
})

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
