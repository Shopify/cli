import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {storeAuthSessionKey} from './auth-config.js'

export interface StoredStoreAppSession {
  store: string
  clientId: string
  userId: string
  accessToken: string
  refreshToken?: string
  scopes: string[]
  acquiredAt: string
  expiresAt?: string
  refreshTokenExpiresAt?: string
  associatedUser?: {
    id: number
    email?: string
    firstName?: string
    lastName?: string
    accountOwner?: boolean
  }
}

interface StoredStoreAppSessionBucket {
  currentUserId: string
  sessionsByUserId: {[userId: string]: StoredStoreAppSession}
}

interface StoreSessionSchema {
  [key: string]: StoredStoreAppSessionBucket
}

let _storeSessionStorage: LocalStorage<StoreSessionSchema> | undefined

function sanitizeAssociatedUser(associatedUser: unknown): StoredStoreAppSession['associatedUser'] | undefined {
  if (!associatedUser || typeof associatedUser !== 'object') return undefined

  const {
    id,
    email,
    firstName,
    lastName,
    accountOwner,
  } = associatedUser as Partial<NonNullable<StoredStoreAppSession['associatedUser']>>

  if (typeof id !== 'number') return undefined

  return {
    id,
    ...(typeof email === 'string' ? {email} : {}),
    ...(typeof firstName === 'string' ? {firstName} : {}),
    ...(typeof lastName === 'string' ? {lastName} : {}),
    ...(typeof accountOwner === 'boolean' ? {accountOwner} : {}),
  }
}

function sanitizeStoredStoreAppSession(session: unknown): StoredStoreAppSession | undefined {
  if (!session || typeof session !== 'object') return undefined

  const {
    store,
    clientId,
    userId,
    accessToken,
    refreshToken,
    scopes,
    acquiredAt,
    expiresAt,
    refreshTokenExpiresAt,
    associatedUser,
  } = session as Partial<StoredStoreAppSession>

  if (
    typeof store !== 'string' ||
    typeof clientId !== 'string' ||
    typeof userId !== 'string' ||
    typeof accessToken !== 'string' ||
    !Array.isArray(scopes) ||
    !scopes.every((scope) => typeof scope === 'string') ||
    typeof acquiredAt !== 'string'
  ) {
    return undefined
  }

  const sanitizedAssociatedUser = sanitizeAssociatedUser(associatedUser)

  return {
    store,
    clientId,
    userId,
    accessToken,
    scopes,
    acquiredAt,
    ...(typeof refreshToken === 'string' ? {refreshToken} : {}),
    ...(typeof expiresAt === 'string' ? {expiresAt} : {}),
    ...(typeof refreshTokenExpiresAt === 'string' ? {refreshTokenExpiresAt} : {}),
    ...(sanitizedAssociatedUser ? {associatedUser: sanitizedAssociatedUser} : {}),
  }
}

// Per-store, per-user session storage for PKCE online tokens.
function storeSessionStorage() {
  _storeSessionStorage ??= new LocalStorage<StoreSessionSchema>({projectName: 'shopify-cli-store'})
  return _storeSessionStorage
}

export function getStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession | undefined {
  const key = storeAuthSessionKey(store)
  const storedBucket = storage.get(key)
  if (!storedBucket || typeof storedBucket !== 'object') return undefined

  const {sessionsByUserId, currentUserId} = storedBucket as Partial<StoredStoreAppSessionBucket>

  if (!sessionsByUserId || typeof sessionsByUserId !== 'object' || typeof currentUserId !== 'string') {
    storage.delete(key)
    return undefined
  }

  const session = sanitizeStoredStoreAppSession(sessionsByUserId[currentUserId])
  if (!session) {
    storage.delete(key)
    return undefined
  }

  return session
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
  userIdOrStorage?: string | LocalStorage<StoreSessionSchema>,
  maybeStorage?: LocalStorage<StoreSessionSchema>,
): void {
  const userId = typeof userIdOrStorage === 'string' ? userIdOrStorage : undefined
  const storage =
    (typeof userIdOrStorage === 'string' ? maybeStorage : userIdOrStorage) ?? storeSessionStorage()

  const key = storeAuthSessionKey(store)

  if (!userId) {
    storage.delete(key)
    return
  }

  const existingBucket = storage.get(key)
  if (!existingBucket) return

  const {[userId]: _removedSession, ...remainingSessions} = existingBucket.sessionsByUserId

  const remainingUserIds = Object.keys(remainingSessions)
  if (remainingUserIds.length === 0) {
    storage.delete(key)
    return
  }

  storage.set(key, {
    currentUserId:
      existingBucket.currentUserId === userId ? remainingUserIds[0]! : existingBucket.currentUserId,
    sessionsByUserId: remainingSessions,
  })
}

const EXPIRY_MARGIN_MS = 4 * 60 * 1000

export function isSessionExpired(session: StoredStoreAppSession): boolean {
  if (!session.expiresAt) return false

  const expiresAtMs = new Date(session.expiresAt).getTime()
  if (Number.isNaN(expiresAtMs)) return true

  return expiresAtMs - EXPIRY_MARGIN_MS < Date.now()
}
