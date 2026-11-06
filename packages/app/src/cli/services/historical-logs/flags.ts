import {appFlags} from '../../flags.js'
import {Flags} from '@oclif/core'

export const historicalLogFlags = {
  path: appFlags.path,
  config: appFlags.config,
  'client-id': appFlags['client-id'],
  type: Flags.string({
    description: 'Log type; repeat to select multiple. Defaults to all supported types.',
    options: ['webhook', 'graphql', 'function', 'app-event', 'app-billing-event', 'rest'],
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
    description: 'Exact webhook or REST HTTP status code (100–599); no status classes.',
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
    description: 'Exact GraphQL or REST request ID; excludes other record types.',
    env: 'SHOPIFY_FLAG_REQUEST_ID',
  }),
  'function-handle': Flags.string({
    description: 'Exact Function extension handle; excludes non-Function records.',
    env: 'SHOPIFY_FLAG_FUNCTION_HANDLE',
  }),
  target: Flags.string({
    description: 'Exact Function execution target; excludes non-Function records.',
    env: 'SHOPIFY_FLAG_TARGET',
  }),
  'event-handle': Flags.string({
    description: 'Exact app event or app billing event handle; excludes other record types.',
    env: 'SHOPIFY_FLAG_EVENT_HANDLE',
  }),
  method: Flags.string({
    description: 'Exact REST HTTP method; excludes non-REST records.',
    env: 'SHOPIFY_FLAG_METHOD',
  }),
  'request-path': Flags.string({
    description: 'Exact REST request path; excludes non-REST records.',
    env: 'SHOPIFY_FLAG_REQUEST_PATH',
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
    description: 'Maximum number of records to return, from 1 through 1000.',
    default: 20,
    env: 'SHOPIFY_FLAG_LIMIT',
  }),
  sort: Flags.string({
    description:
      'Select the oldest/newest matches using server-side sorting. Omit for faster, less-throttled retrieval.',
    options: ['timestamp'],
    env: 'SHOPIFY_FLAG_SORT',
  }),
  order: Flags.string({
    description: 'Sort direction: asc (oldest first, default with --sort) or desc (newest first).',
    options: ['asc', 'desc'],
    dependsOn: ['sort'],
    env: 'SHOPIFY_FLAG_ORDER',
  }),
}
