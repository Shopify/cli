import {AbortError} from '@shopify/cli-kit/node/error'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextSteps(store: string, scopes: string) {
  return [[storeAuthCommand(store, scopes)]]
}

export function createStoredStoreAuthError(store: string): AbortError {
  return new AbortError(
    `No stored app authentication found for ${store}.`,
    'To create stored auth for this store, run:',
    storeAuthCommandNextSteps(store, '<comma-separated-scopes>'),
  )
}

export function reauthenticateStoreAuthError(message: string, store: string, scopes: string): AbortError {
  return new AbortError(message, 'To re-authenticate, run:', storeAuthCommandNextSteps(store, scopes))
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextSteps(returnedStore, '<comma-separated-scopes>'),
  )
}
