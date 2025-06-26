import {Flags} from '@oclif/core'

export const shopSelectionFlags = {
  from: Flags.string({
    description: 'The store domain or SQLite file to copy/export data from.',
    required: true,
    env: 'SHOPIFY_FLAG_COPY_STORE_FROM',
  }),
  to: Flags.string({
    description:
      'The store domain or SQLite file path to copy/import data to. Leave empty to auto-generate filename for exports.',
    required: true,
    env: 'SHOPIFY_FLAG_COPY_STORE_TO',
  }),
}

export const resourceConfigFlags = {
  key: Flags.string({
    description: 'The identity key to use to match resources',
    multiple: true,
    required: false,
    env: 'SHOPIFY_FLAG_IDENTITY_KEY',
    default: ['products:handle'],
  }),
}

export const commonFlags = {
  skipConfirmation: Flags.boolean({
    description: 'Skip confirmation prompt.',
    char: 'y',
    required: false,
    default: false,
    env: 'SHOPIFY_FLAG_YES',
  }),
  open: Flags.boolean({
    description: 'Open the sqlite db in a sqlite browser.',
    char: 'o',
    required: false,
    default: false,
    env: 'SHOPIFY_FLAG_OPEN',
  }),
}
