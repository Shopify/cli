import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'

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
