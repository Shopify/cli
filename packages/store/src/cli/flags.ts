import {Flags} from '@oclif/core'

export const storeFlags = {
  store: Flags.string({
    char: 's',
    description:
      'The store to operate on: its myshopify.com domain, numeric store ID, or Shop GID (gid://shopify/Shop/<id>).',
    env: 'SHOPIFY_FLAG_STORE',
    required: true,
  }),
}
