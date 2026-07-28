import {AbortError} from '@shopify/cli-kit/node/error'

const UNKNOWN_SCOPES_PLACEHOLDER = '<comma-separated-scopes>'

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    [[{command: `shopify store auth --store ${returnedStore} --scopes ${UNKNOWN_SCOPES_PLACEHOLDER}`}]],
  )
}
