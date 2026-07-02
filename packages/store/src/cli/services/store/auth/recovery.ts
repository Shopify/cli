import {AbortError} from '@shopify/cli-kit/node/error'

function storeAuthCommand(store: string, scopes: string): {command: string} {
  return {command: `shopify store auth --store ${store} --scopes ${scopes}`}
}

function storeAuthCommandNextSteps(store: string, scopes: string) {
  return [[storeAuthCommand(store, scopes)]]
}

// Folds the instruction into the "Next steps" bullet itself (`Run ... to <purpose>`) instead of
// repeating it in a separate `tryMessage` line. Passing both a `tryMessage` like "To re-authenticate,
// run:" and a `nextSteps` list renders as a stuttering "To re-authenticate, run:\nNext steps\n  •
// shopify store auth ..." — the "Next steps" heading already says what the list is for.
function storeAuthCommandNextStepsWithPurpose(store: string, scopes: string, purpose: string) {
  return [['Run', storeAuthCommand(store, scopes), purpose]]
}

export function throwStoredStoreAuthError(store: string): never {
  throw new AbortError(
    `No stored app authentication found for ${store}.`,
    undefined,
    storeAuthCommandNextStepsWithPurpose(store, '<comma-separated-scopes>', 'to create stored auth for this store'),
  )
}

export function throwReauthenticateStoreAuthError(message: string, store: string, scopes: string): never {
  throw new AbortError(message, undefined, storeAuthCommandNextStepsWithPurpose(store, scopes, 'to re-authenticate'))
}

export function retryStoreAuthWithPermanentDomainError(returnedStore: string): AbortError {
  // eslint-disable-next-line @shopify/cli/no-error-factory-functions
  return new AbortError(
    'OAuth callback store does not match the requested store.',
    `Shopify returned ${returnedStore} during authentication. Re-run using the permanent store domain:`,
    storeAuthCommandNextSteps(returnedStore, '<comma-separated-scopes>'),
  )
}
