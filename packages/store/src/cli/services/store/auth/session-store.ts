import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

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

function storeSessionStorage() {
  _storeSessionStorage ??= new LocalStorage<StoreSessionSchema>({projectName: 'shopify-cli-store'})
  return _storeSessionStorage
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function sanitizeAssociatedUser(value: unknown): StoredStoreAppSession['associatedUser'] | undefined {
  if (!value || typeof value !== 'object') return undefined

  const associatedUser = value as Record<string, unknown>
  if (typeof associatedUser.id !== 'number') return undefined

  return {
    id: associatedUser.id,
    ...(isString(associatedUser.email) ? {email: associatedUser.email} : {}),
    ...(isString(associatedUser.firstName) ? {firstName: associatedUser.firstName} : {}),
    ...(isString(associatedUser.lastName) ? {lastName: associatedUser.lastName} : {}),
    ...(typeof associatedUser.accountOwner === 'boolean' ? {accountOwner: associatedUser.accountOwner} : {}),
  }
}

function sanitizeStoredStoreAppSession(value: unknown): StoredStoreAppSession | undefined {
  if (!value || typeof value !== 'object') return undefined

  const session = value as Record<string, unknown>
  if (
    !isString(session.store) ||
    !isString(session.clientId) ||
    !isString(session.userId) ||
    !isString(session.accessToken) ||
    !Array.isArray(session.scopes) ||
    !session.scopes.every(isString) ||
    !isString(session.acquiredAt)
  ) {
    return undefined
  }

  const associatedUser = sanitizeAssociatedUser(session.associatedUser)

  return {
    store: session.store,
    clientId: session.clientId,
    userId: session.userId,
    accessToken: session.accessToken,
    scopes: session.scopes,
    acquiredAt: session.acquiredAt,
    ...(isString(session.refreshToken) ? {refreshToken: session.refreshToken} : {}),
    ...(isString(session.expiresAt) ? {expiresAt: session.expiresAt} : {}),
    ...(isString(session.refreshTokenExpiresAt) ? {refreshTokenExpiresAt: session.refreshTokenExpiresAt} : {}),
    ...(associatedUser ? {associatedUser} : {}),
  }
}

function sanitizeStoredStoreAppSessionBucket(
  store: string,
  storedBucket: unknown,
  storage: LocalStorage<StoreSessionSchema>,
): StoredStoreAppSessionBucket | undefined {
  if (!storedBucket || typeof storedBucket !== 'object') return undefined

  const {sessionsByUserId, currentUserId} = storedBucket as Partial<StoredStoreAppSessionBucket>
  const looksLikeBucket = sessionsByUserId !== undefined || currentUserId !== undefined
  if (!looksLikeBucket) return undefined

  const key = storeAuthSessionKey(store)
  if (
    !sessionsByUserId ||
    typeof sessionsByUserId !== 'object' ||
    Array.isArray(sessionsByUserId) ||
    typeof currentUserId !== 'string'
  ) {
    storage.delete(key)
    return undefined
  }

  const sanitizedSessionsByUserId = Object.fromEntries(
    Object.entries(sessionsByUserId).flatMap(([userId, session]) => {
      const sanitizedSession = sanitizeStoredStoreAppSession(session)
      return sanitizedSession ? [[userId, sanitizedSession]] : []
    }),
  )

  if (Object.keys(sanitizedSessionsByUserId).length !== Object.keys(sessionsByUserId).length) {
    if (sanitizedSessionsByUserId[currentUserId]) {
      storage.set(key, {
        currentUserId,
        sessionsByUserId: sanitizedSessionsByUserId,
      })
    } else {
      storage.delete(key)
      return undefined
    }
  }

  return {
    currentUserId,
    sessionsByUserId: sanitizedSessionsByUserId,
  }
}

function readStoredStoreAppSessionBucket(
  store: string,
  storage: LocalStorage<StoreSessionSchema>,
): StoredStoreAppSessionBucket | undefined {
  return sanitizeStoredStoreAppSessionBucket(store, storage.get(storeAuthSessionKey(store)), storage)
}

// `conf` persists dotted keys as nested objects. Store-auth callers should not
// learn that layout directly; this helper keeps the current traversal private to
// the persistence seam while higher-level code projects summaries instead.
function readRawStoreSessionStorage(storage: LocalStorage<StoreSessionSchema>): Record<string, unknown> {
  return (storage as unknown as {config: {store: Record<string, unknown>}}).config.store ?? {}
}

function collectCurrentStoredStoreAppSessions(
  storage: LocalStorage<StoreSessionSchema>,
  store: string,
  value: unknown,
  sessions: StoredStoreAppSession[],
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return

  const bucket = sanitizeStoredStoreAppSessionBucket(store, value, storage)
  if (bucket) {
    const session = bucket.sessionsByUserId[bucket.currentUserId]
    if (session) sessions.push(session)
    return
  }

  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    collectCurrentStoredStoreAppSessions(storage, `${store}.${childKey}`, childValue, sessions)
  }
}

/**
 * Internal persistence helper for projecting the current session for every
 * store that has locally stored store auth.
 */
export function listCurrentStoredStoreAppSessions(
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession[] {
  const sessions: StoredStoreAppSession[] = []
  const keyPrefix = `${STORE_AUTH_APP_CLIENT_ID}::`

  for (const [key, value] of Object.entries(readRawStoreSessionStorage(storage))) {
    if (!key.startsWith(keyPrefix)) continue
    collectCurrentStoredStoreAppSessions(storage, key.slice(keyPrefix.length), value, sessions)
  }

  return sessions
}

export function getCurrentStoredStoreAppSession(
  store: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession | undefined {
  const bucket = readStoredStoreAppSessionBucket(store, storage)
  if (!bucket) return undefined

  const session = bucket.sessionsByUserId[bucket.currentUserId]
  if (!session) {
    storage.delete(storeAuthSessionKey(store))
    return undefined
  }

  return session
}

export function setStoredStoreAppSession(
  session: StoredStoreAppSession,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  const key = storeAuthSessionKey(session.store)
  const existingBucket = readStoredStoreAppSessionBucket(session.store, storage)

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
  const storage = (typeof userIdOrStorage === 'string' ? maybeStorage : userIdOrStorage) ?? storeSessionStorage()

  const key = storeAuthSessionKey(store)

  if (!userId) {
    storage.delete(key)
    return
  }

  const existingBucket = readStoredStoreAppSessionBucket(store, storage)
  if (!existingBucket) return

  const {[userId]: _removedSession, ...remainingSessions} = existingBucket.sessionsByUserId

  const remainingUserIds = Object.keys(remainingSessions)
  if (remainingUserIds.length === 0) {
    storage.delete(key)
    return
  }

  storage.set(key, {
    currentUserId: existingBucket.currentUserId === userId ? remainingUserIds[0]! : existingBucket.currentUserId,
    sessionsByUserId: remainingSessions,
  })
}
