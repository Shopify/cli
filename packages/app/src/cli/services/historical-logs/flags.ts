import {appFlags} from '../../flags.js'
import {Flags} from '@oclif/core'

const logScopeFlags = {
  path: Flags.string({description: 'Path to your app directory.', env: 'SHOPIFY_FLAG_PATH'}),
  config: appFlags.config,
  'client-id': Flags.string({
    description: 'App client ID; takes precedence over local app configuration.',
    env: 'SHOPIFY_FLAG_CLIENT_ID',
  }),
}

export const historicalLogFlags = {
  ...logScopeFlags,
  type: Flags.string({
    description: 'Event type: webhook, function, graphql, or rest. Repeat to include multiple types; defaults to all.',
    env: 'SHOPIFY_FLAG_TYPE',
    multiple: true,
  }),
  since: Flags.string({
    description: 'Inclusive start: positive duration (s/m/h/d) or RFC 3339 timestamp.',
    default: '1h',
    env: 'SHOPIFY_FLAG_SINCE',
  }),
  until: Flags.string({
    description: 'Exclusive RFC 3339 end; defaults to server time from the app scope response.',
    env: 'SHOPIFY_FLAG_UNTIL',
  }),
  limit: Flags.integer({
    description: 'Maximum records, from 1 through 1000; does not mean newest N.',
    default: 20,
    env: 'SHOPIFY_FLAG_LIMIT',
  }),
}
