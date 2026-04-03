import {createStoredStoreAuthError} from './auth-recovery.js'
import {getStoredStoreAppSession, isSessionExpired} from './session.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

type StoreAuthInfoFormat = 'text' | 'json'

interface StoreAuthInfo {
  store: string
  userId: string
  scopes: string[]
  acquiredAt: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  hasRefreshToken: boolean
  isExpired: boolean
  associatedUser?: {
    id: number
    email?: string
    firstName?: string
    lastName?: string
    accountOwner?: boolean
  }
}

export function getStoreAuthInfo(store: string): StoreAuthInfo {
  const session = getStoredStoreAppSession(store)
  if (!session) throw createStoredStoreAuthError(store)

  return {
    store: session.store,
    userId: session.userId,
    scopes: session.scopes,
    acquiredAt: session.acquiredAt,
    expiresAt: session.expiresAt,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    hasRefreshToken: !!session.refreshToken,
    isExpired: isSessionExpired(session),
    associatedUser: session.associatedUser,
  }
}

export function displayStoreAuthInfo(info: StoreAuthInfo, format: StoreAuthInfoFormat = 'text'): void {
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
