import {setStoredStoreAppSession} from './session-store.js'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'

export interface StoreAuthBootstrap {
  accessToken: string
  scopes: string[]
  apiKey: string
  shopDomain: string
  refreshToken?: string
  expiresIn?: number
  refreshTokenExpiresIn?: number
  associatedUser?: {
    id: number
    email?: string
    firstName?: string
    lastName?: string
    accountOwner?: boolean
  }
}

export function importStoreAuthBootstrap(input: {userId: string; bootstrap: StoreAuthBootstrap}): void {
  const now = Date.now()
  const {bootstrap, userId} = input

  setStoredStoreAppSession({
    store: normalizeStoreFqdn(bootstrap.shopDomain),
    clientId: bootstrap.apiKey,
    userId,
    accessToken: bootstrap.accessToken,
    refreshToken: bootstrap.refreshToken,
    scopes: bootstrap.scopes,
    acquiredAt: new Date(now).toISOString(),
    expiresAt: bootstrap.expiresIn ? new Date(now + bootstrap.expiresIn * 1000).toISOString() : undefined,
    refreshTokenExpiresAt: bootstrap.refreshTokenExpiresIn
      ? new Date(now + bootstrap.refreshTokenExpiresIn * 1000).toISOString()
      : undefined,
    associatedUser: bootstrap.associatedUser,
  })
}
