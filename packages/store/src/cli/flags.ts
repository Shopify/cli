import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'

/**
 * Builds a reusable `--country` flag. The value is normalized to an uppercase,
 * trimmed string so downstream validation and the backend receive a consistent
 * two-letter country code.
 *
 * @param env - The environment variable that can supply the flag's value.
 */
export function countryFlag(env: string) {
  return Flags.string({
    description: 'Two-letter country code for the store, such as US, CA, or GB.',
    env,
    required: false,
    parse: async (value) => value.trim().toUpperCase(),
  })
}

/**
 * Returns true when the value is a two-letter (ISO 3166-1 alpha-2 shaped)
 * country code. Assumes the value has already been normalized to uppercase by
 * `countryFlag`'s parser.
 */
export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value)
}

/**
 * Error message shown when a `--country` flag value is not a two-letter code.
 * Shared so every store-creation command reports the same guidance.
 */
export const invalidCountryCodeMessage = 'Country must be a two-letter country code, for example: US.'

export const previewStoreFlags = {
  country: countryFlag('SHOPIFY_FLAG_PREVIEW_STORE_COUNTRY'),
}

export const devStoreFlags = {
  country: countryFlag('SHOPIFY_FLAG_STORE_COUNTRY'),
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
