import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'
import type {StoreTokenResponse} from './token-client.js'

export function parseStoreAuthScopes(input: string): string[] {
  const scopes = input
    .split(/[ ,]+/)
    .filter(Boolean)

  if (scopes.length === 0) {
    throw new AbortError('At least one scope is required.', 'Pass --scopes as a comma-separated list.')
  }

  return [...new Set(scopes)]
}

function expandImpliedStoreScopes(scopes: string[]): Set<string> {
  const expandedScopes = new Set(scopes)

  for (const scope of scopes) {
    const matches = scope.match(/^(unauthenticated_)?write_(.*)$/)
    if (matches) {
      expandedScopes.add(`${matches[1] ?? ''}read_${matches[2]}`)
    }
  }

  return expandedScopes
}

export function mergeRequestedAndStoredScopes(requestedScopes: string[], storedScopes: string[]): string[] {
  const mergedScopes = [...storedScopes]
  const expandedScopes = expandImpliedStoreScopes(storedScopes)

  for (const scope of requestedScopes) {
    if (expandedScopes.has(scope)) continue

    mergedScopes.push(scope)
    for (const expandedScope of expandImpliedStoreScopes([scope])) {
      expandedScopes.add(expandedScope)
    }
  }

  return mergedScopes
}

export function resolveGrantedScopes(tokenResponse: StoreTokenResponse, requestedScopes: string[]): string[] {
  if (!tokenResponse.scope) {
    outputDebug(outputContent`Token response did not include scope; falling back to requested scopes`)
    return requestedScopes
  }

  const grantedScopes = parseStoreAuthScopes(tokenResponse.scope)
  const expandedGrantedScopes = expandImpliedStoreScopes(grantedScopes)
  const missingScopes = requestedScopes.filter((scope) => !expandedGrantedScopes.has(scope))

  if (missingScopes.length > 0) {
    throw new AbortError(
      'Shopify granted fewer scopes than were requested.',
      `Missing scopes: ${missingScopes.join(', ')}.`,
      [
        'Update the app or store installation scopes.',
        'See https://shopify.dev/app/scopes',
        'Re-run shopify store auth.',
      ],
    )
  }

  return grantedScopes
}
