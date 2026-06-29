import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {type JsonMapType} from '@shopify/cli-kit/node/toml'

/**
 * Discriminator for a stored store auth session.
 *
 * - 'standard': created via `shopify store auth`.
 * - 'preview': created via `shopify store create preview`; backed by a server-issued Admin API token.
 *
 * Stored sessions written before this discriminator existed have no `kind` field and are
 * read back as 'standard'.
 */
type StoredStoreSessionKind = 'standard' | 'preview'

interface StoredPreviewStoreMetadata {
  /** Placeholder account UUID returned by the preview-store backend when available. */
  placeholderAccountUuid?: string
  /** Numeric shop id returned by the preview-store backend. */
  shopId: string
  /** Store name returned by the preview-store backend. */
  name: string
  /** ISO country code requested for the store, when provided by the caller. */
  country?: string
  /** ISO timestamp for when the preview store was created locally. */
  createdAt: string
  /** Access URL returned by the preview-store backend. */
  accessUrl?: string
}

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
  /**
   * Discriminator. Optional in storage for back-compat with sessions written before the
   * field existed; `sessionKind()` resolves missing values to 'standard'.
   */
  kind?: StoredStoreSessionKind
  /** Preview-store-only metadata. Set iff `kind === 'preview'`. */
  preview?: StoredPreviewStoreMetadata
}

interface StoredStoreAppSessionBucket {
  currentUserId: string
  sessionsByUserId: {[userId: string]: StoredStoreAppSession}
}

interface StoreSessionSchema {
  [key: string]: StoredStoreAppSessionBucket
}

type RawStoreSessionStorage = JsonMapType

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

function sanitizePreviewMetadata(value: unknown): StoredPreviewStoreMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined

  const metadata = value as Record<string, unknown>
  if (!isString(metadata.shopId) || !isString(metadata.name) || !isString(metadata.createdAt)) return undefined

  return {
    shopId: metadata.shopId,
    name: metadata.name,
    createdAt: metadata.createdAt,
    ...(isString(metadata.placeholderAccountUuid) ? {placeholderAccountUuid: metadata.placeholderAccountUuid} : {}),
    ...(isString(metadata.country) ? {country: metadata.country} : {}),
    ...(isString(metadata.accessUrl) ? {accessUrl: metadata.accessUrl} : {}),
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

  // Discriminator is optional for back-compat: sessions written before this field existed
  // are read back as 'standard'. Unknown values are coerced to 'standard' and the field is
  // omitted from the result so it doesn't pollute legacy buckets.
  const kind: StoredStoreSessionKind = session.kind === 'preview' ? 'preview' : 'standard'
  const preview = kind === 'preview' ? sanitizePreviewMetadata(session.preview) : undefined

  // A session declared as 'preview' but missing/malformed metadata is rejected outright,
  // because store-list fallback and future re-mint/claim flows rely on this metadata.
  if (kind === 'preview' && !preview) return undefined

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
    ...(kind === 'preview' ? {kind} : {}),
    ...(preview ? {preview} : {}),
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
function readRawStoreSessionStorage(storage: LocalStorage<StoreSessionSchema>): RawStoreSessionStorage {
  return (storage as unknown as {config?: {store?: RawStoreSessionStorage}}).config?.store ?? {}
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

    const bucket = sanitizeStoredStoreAppSessionBucket(key.slice(keyPrefix.length), value, storage)
    const session = bucket?.sessionsByUserId[bucket.currentUserId]
    if (session) sessions.push(session)
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
