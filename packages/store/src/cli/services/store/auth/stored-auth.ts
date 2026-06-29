import {listCurrentStoredStoreAppSessions, type StoredStoreAppSession} from '@shopify/cli-kit/node/store-auth-session'

export interface StoredStoreAuthSummary {
  store: string
  userId: string
  scopes: string[]
  acquiredAt: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  associatedUser?: StoredStoreAppSession['associatedUser']
}

type StoreSessionStorage = Parameters<typeof listCurrentStoredStoreAppSessions>[0]

export function listStoredStoreAuthSummaries(storage?: StoreSessionStorage): StoredStoreAuthSummary[] {
  return listCurrentStoredStoreAppSessions(storage)
    .map((session) => ({
      store: session.store,
      userId: session.userId,
      scopes: session.scopes,
      acquiredAt: session.acquiredAt,
      ...(session.expiresAt ? {expiresAt: session.expiresAt} : {}),
      ...(session.refreshTokenExpiresAt ? {refreshTokenExpiresAt: session.refreshTokenExpiresAt} : {}),
      ...(session.associatedUser ? {associatedUser: session.associatedUser} : {}),
    }))
    .sort((left, right) => right.acquiredAt.localeCompare(left.acquiredAt) || left.store.localeCompare(right.store))
}
