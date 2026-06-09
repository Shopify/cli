import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
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
    description: 'The organization to create the store in (numeric ID). Auto-selects if you belong to a single org.',
    env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
  }),
}
