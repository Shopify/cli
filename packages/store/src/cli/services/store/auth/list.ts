import {listStoredStoreAuthSummaries, type StoredStoreAuthSummary} from './stored-auth.js'

export interface StoreAuthListEntry {
  kind: 'store'
  store: string
  userId: string
  scopes: string[]
  connectedAt: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  associatedUser?: StoredStoreAuthSummary['associatedUser']
}

export interface StoreAuthListResult {
  sessions: StoreAuthListEntry[]
}

export function listStoreAuthSessions(): StoreAuthListResult {
  return {
    sessions: listStoredStoreAuthSummaries().map((summary) => ({
      kind: 'store',
      store: summary.store,
      userId: summary.userId,
      scopes: summary.scopes,
      connectedAt: summary.acquiredAt,
      ...(summary.expiresAt ? {expiresAt: summary.expiresAt} : {}),
      ...(summary.refreshTokenExpiresAt ? {refreshTokenExpiresAt: summary.refreshTokenExpiresAt} : {}),
      ...(summary.associatedUser ? {associatedUser: summary.associatedUser} : {}),
    })),
  }
}
