import {createStoredStoreAuthError} from './auth-recovery.js'
import {buildStoreAuthState, type StoreAuthState} from './auth-state.js'
import {getStoredStoreAppSession} from './session.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

type StoreAuthInfoFormat = 'text' | 'json'

export function getStoreAuthInfo(store: string): StoreAuthState {
  const normalizedStore = normalizeStoreFqdn(store)
  const session = getStoredStoreAppSession(normalizedStore)
  if (!session) throw createStoredStoreAuthError(normalizedStore)

  return buildStoreAuthState(session)
}

export function displayStoreAuthInfo(info: StoreAuthState, format: StoreAuthInfoFormat = 'text'): void {
  if (format === 'json') {
    outputResult(JSON.stringify(info, null, 2))
    return
  }

  const displayUser = info.associatedUser?.email ? `${info.associatedUser.email} (${info.userId})` : info.userId
  const refreshTokenExpiry = !info.hasRefreshToken
    ? 'not applicable'
    : (info.refreshTokenExpiresAt ?? 'not provided by Shopify')

  renderInfo({
    headline: `Stored auth for ${info.store}`,
    customSections: [
      {
        body: {
          tabularData: [
            ['User', displayUser],
            ['Scopes', info.scopes.join(',')],
            ['Stored at', info.acquiredAt],
            ['Expires at', info.expiresAt ?? 'unknown'],
            ['Refresh token', info.hasRefreshToken ? 'stored' : 'missing'],
            ['Refresh token expires at', refreshTokenExpiry],
            ['Status', info.isExpired ? 'expired' : 'valid'],
          ],
          firstColumnSubdued: true,
        },
      },
    ],
  })
}

export function showStoreAuthInfo(store: string, format: StoreAuthInfoFormat = 'text'): void {
  const info = getStoreAuthInfo(store)
  displayStoreAuthInfo(info, format)
}
