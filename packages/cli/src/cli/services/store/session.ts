import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {storeAuthSessionKey} from './config.js'

export interface StoredStoreAppSession {
  store: string
  clientId: string
  userId: string
  accessToken: string
  scopes: string[]
  acquiredAt: string
}

interface StoredStoreAppSessionBucket {
  currentUserId: string
  sessionsByUserId: {[userId: string]: StoredStoreAppSession}
}

interface StoreSessionSchema {
  [key: string]: StoredStoreAppSessionBucket
}

let _storeSessionStorage: LocalStorage<StoreSessionSchema> | undefined

// TODO: Revisit store token persistence when the auth flow moves to PKCE.
// The current model is meant to keep the demo-oriented online-token flow coherent, not final.
function storeSessionStorage() {
  _storeSessionStorage ??= new LocalStorage<StoreSessionSchema>({projectName: 'shopify-cli-store'})
  return _storeSessionStorage
}

export function getStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession | undefined {
  const storedBucket = storage.get(storeAuthSessionKey(store))
  if (!storedBucket) return undefined

  return storedBucket.sessionsByUserId[storedBucket.currentUserId]
}

export function setStoredStoreAppSession(
  session: StoredStoreAppSession,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  const key = storeAuthSessionKey(session.store)
  const existingBucket = storage.get(key)

  const nextBucket: StoredStoreAppSessionBucket = {
    currentUserId: session.userId,
    sessionsByUserId: {
      ...(existingBucket?.sessionsByUserId ?? {}),
      [session.userId]: session,
    },
  }

  storage.set(key, nextBucket)
}

export function clearStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  storage.delete(storeAuthSessionKey(store))
}
