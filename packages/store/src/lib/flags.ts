import {Flags} from '@oclif/core'

export const storeFlags = {
  'from-store': Flags.string({
    description: 'The source store domain to copy/export data from (e.g., source.myshopify.com).',
    required: false,
    env: 'SHOPIFY_FLAG_FROM_STORE',
  }),
  'to-store': Flags.string({
    description: 'The target store domain to copy/import data to (e.g., target.myshopify.com).',
    required: false,
    env: 'SHOPIFY_FLAG_TO_STORE',
  }),
}

export const fileFlags = {
  'from-file': Flags.string({
    description: 'The SQLite file to import data from.',
    required: false,
    env: 'SHOPIFY_FLAG_FROM_FILE',
  }),
  'to-file': Flags.string({
    description: 'The SQLite file path to export data to. Omit to auto-generate filename.',
    required: false,
    env: 'SHOPIFY_FLAG_TO_FILE',
    default: undefined,
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
  'no-prompt': Flags.boolean({
    description: 'Skip confirmation prompts.',
    char: 'y',
    required: false,
    default: false,
    env: 'SHOPIFY_FLAG_YES',
  }),
  mock: Flags.boolean({
    description: 'Use mock data instead of real API calls (for development).',
    char: 'm',
    required: false,
    default: false,
    hidden: true,
    env: 'SHOPIFY_FLAG_MOCK',
  }),
}
