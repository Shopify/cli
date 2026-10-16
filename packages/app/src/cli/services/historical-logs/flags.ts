import {appFlags} from '../../flags.js'
import {Flags} from '@oclif/core'

export const historicalLogFlags = {
  path: Flags.string({description: 'Path to your app directory.', env: 'SHOPIFY_FLAG_PATH'}),
  config: appFlags.config,
  'client-id': Flags.string({
    description: 'App client ID; takes precedence over local app configuration.',
    env: 'SHOPIFY_FLAG_CLIENT_ID',
  }),
  type: Flags.string({
    description: 'Log type; repeat to select multiple. Defaults to webhook and graphql (not only Admin).',
    options: ['webhook', 'graphql'],
    multiple: true,
    multipleNonGreedy: true,
    env: 'SHOPIFY_FLAG_TYPE',
  }),
  store: Flags.string({
    description: 'Exact store handle or myshopify.com domain/URL.',
    char: 's',
    env: 'SHOPIFY_FLAG_STORE',
  }),
  status: Flags.string({
    description: 'Recorded result status; not inferred from HTTP codes or response bodies.',
    options: ['success', 'failure'],
    env: 'SHOPIFY_FLAG_STATUS',
  }),
  topic: Flags.string({
    description: 'Exact webhook topic; excludes non-webhook records.',
    env: 'SHOPIFY_FLAG_TOPIC',
  }),
  'status-code': Flags.string({
    description: 'Exact webhook HTTP status code (100–599); no status classes.',
    env: 'SHOPIFY_FLAG_STATUS_CODE',
  }),
  'operation-type': Flags.string({
    description: 'Exact GraphQL operation type; excludes non-GraphQL records.',
    env: 'SHOPIFY_FLAG_OPERATION_TYPE',
  }),
  'operation-name': Flags.string({
    description: 'Exact GraphQL operation name; excludes non-GraphQL records.',
    env: 'SHOPIFY_FLAG_OPERATION_NAME',
  }),
  'request-id': Flags.string({
    description: 'Exact GraphQL request ID; excludes non-GraphQL records.',
    env: 'SHOPIFY_FLAG_REQUEST_ID',
  }),
  since: Flags.string({
    description: 'Inclusive start: positive duration (s/m/h/d) or whole-second RFC 3339 timestamp.',
    default: '1h',
    env: 'SHOPIFY_FLAG_SINCE',
  }),
  until: Flags.string({
    description: 'Exclusive whole-second RFC 3339 end; defaults to the current time.',
    env: 'SHOPIFY_FLAG_UNTIL',
  }),
  limit: Flags.integer({
    description: 'Maximum records, from 1 through 1000; does not mean newest N.',
    default: 20,
    env: 'SHOPIFY_FLAG_LIMIT',
  }),
}
