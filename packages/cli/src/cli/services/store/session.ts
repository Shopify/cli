import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {storeAuthSessionKey} from './config.js'

export interface StoredStoreAppSession {
  store: string
  clientId: string
  accessToken: string
  scopes: string[]
  associatedUserScope?: string
  acquiredAt: string
}

interface StoreSessionSchema {
  [key: string]: StoredStoreAppSession
}

let _storeSessionStorage: LocalStorage<StoreSessionSchema> | undefined

function storeSessionStorage() {
  _storeSessionStorage ??= new LocalStorage<StoreSessionSchema>({projectName: 'shopify-cli-store'})
  return _storeSessionStorage
}

export function getStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession | undefined {
  return storage.get(storeAuthSessionKey(store))
}

export function setStoredStoreAppSession(
  session: StoredStoreAppSession,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  storage.set(storeAuthSessionKey(session.store), session)
}

export function clearStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  storage.delete(storeAuthSessionKey(store))
}
