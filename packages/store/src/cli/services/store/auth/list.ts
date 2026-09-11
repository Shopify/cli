import {type StoreAuthListResult} from './list-types.js'
import {listStoredStoreAuthSummaries} from './stored-auth.js'
import {extractSubdomain, formatShortDate} from '../display.js'

export function listStoreAuthSessions(): StoreAuthListResult {
  const sessions = listStoredStoreAuthSummaries().map((summary) => ({
    subdomain: extractSubdomain(summary.store) ?? summary.store,
    connected: formatShortDate(summary.acquiredAt),
  }))

  return {
    sessions,
    ...(sessions.length === 0 ? {message: emptyStateMessage()} : {}),
  }
}

function emptyStateMessage(): string {
  return [
    'No stores are authenticated directly with `shopify store auth`.',
    '',
    'Run `shopify store auth --store <domain> --scopes <scopes>` to authenticate a store.',
    'Run `shopify store list` to list stores in a Shopify organization.',
  ].join('\n')
}
