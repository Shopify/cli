import {isSessionExpired, type StoredStoreAppSession} from './session.js'

export interface StoreAuthState {
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

export function buildStoreAuthState(session: StoredStoreAppSession): StoreAuthState {
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
