import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

/**
 * Discriminator for a stored store auth session.
 *
 * - 'standard': created via `shopify store auth` (PKCE OAuth against a real Shopify identity).
 * - 'preview':  created via `shopify store create preview`. Backed by a placeholder identity,
 *               holds a shop-scoped Admin API token, has no refresh token, and cannot be
 *               re-authenticated through the PKCE flow.
 *
 * Stored sessions written before this discriminator existed have no `kind` field and are
 * read back as 'standard'.
 */
type StoredStoreSessionKind = 'standard' | 'preview'

/**
 * Preview-store-only metadata. Present iff `kind === 'preview'`.
 */
export interface StoredPreviewStoreMetadata {
  /** Placeholder account UUID returned by Core's preview-stores orchestrator. */
  placeholderAccountUuid: string
  /** Base URL of the Core orchestrator that minted this session. */
  coreUrl: string
  /** Canonical storefront / Online Store domain returned as `shop_permanent_domain`. */
  storefrontDomain?: string
  /** One-time-use admin entry URL. Short-lived (~30 min). */
  magicLinkUrl?: string
  /** ISO timestamp at which `magicLinkUrl` is expected to stop working. */
  magicLinkExpiresAt?: string
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

/**
 * A stored session that has been narrowed to a preview-store session. The `preview`
 * metadata is guaranteed to be present.
 */
type StoredPreviewStoreSession = StoredStoreAppSession & {
  kind: 'preview'
  preview: StoredPreviewStoreMetadata
}

/** Resolves the discriminator for a stored session, defaulting to 'standard'. */
export function sessionKind(session: StoredStoreAppSession): StoredStoreSessionKind {
  return session.kind ?? 'standard'
}

/** Type guard for preview-store-backed sessions. Narrows `preview` to non-optional. */
export function isPreviewStoreSession(session: StoredStoreAppSession): session is StoredPreviewStoreSession {
  return sessionKind(session) === 'preview' && session.preview !== undefined
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

function sanitizePreviewMetadata(value: unknown): StoredPreviewStoreMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined

  const metadata = value as Record<string, unknown>
  if (!isString(metadata.placeholderAccountUuid) || !isString(metadata.coreUrl)) return undefined

  return {
    placeholderAccountUuid: metadata.placeholderAccountUuid,
    coreUrl: metadata.coreUrl,
    ...(isString(metadata.storefrontDomain) ? {storefrontDomain: metadata.storefrontDomain} : {}),
    ...(isString(metadata.magicLinkUrl) ? {magicLinkUrl: metadata.magicLinkUrl} : {}),
    ...(isString(metadata.magicLinkExpiresAt) ? {magicLinkExpiresAt: metadata.magicLinkExpiresAt} : {}),
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

  // Discriminator is optional for back-compat: sessions written before this field existed
  // are read back as 'standard'. Unknown values are coerced to 'standard' and the field is
  // omitted from the result so it doesn't pollute legacy buckets.
  const kind: StoredStoreSessionKind = session.kind === 'preview' ? 'preview' : 'standard'
  const preview = kind === 'preview' ? sanitizePreviewMetadata(session.preview) : undefined

  // A session declared as 'preview' but missing/malformed metadata is rejected outright,
  // because downstream code (recovery paths, future re-mint) requires `placeholderAccountUuid`
  // and `coreUrl` to act on it.
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
    ...(sanitizeAssociatedUser(session.associatedUser)
      ? {associatedUser: sanitizeAssociatedUser(session.associatedUser)}
      : {}),
    ...(kind === 'preview' ? {kind} : {}),
    ...(preview ? {preview} : {}),
  }
}

function readStoredStoreAppSessionBucket(
  store: string,
  storage: LocalStorage<StoreSessionSchema>,
): StoredStoreAppSessionBucket | undefined {
  const key = storeAuthSessionKey(store)
  const storedBucket = storage.get(key)
  if (!storedBucket || typeof storedBucket !== 'object') return undefined

  const {sessionsByUserId, currentUserId} = storedBucket as Partial<StoredStoreAppSessionBucket>
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

/**
 * Returns the current session for every shop that has one stored, across all known buckets.
 *
 * Mirrors {@link getCurrentStoredStoreAppSession}: only the bucket's `currentUserId`
 * session is returned per shop, since that is the one the rest of the CLI acts on. The
 * result order is unspecified — callers that need a stable order should sort.
 *
 * Buckets whose stored shape is malformed, or whose current session is missing or fails
 * sanitization, are silently skipped (they are cleaned up the next time their shop is
 * looked up by key via {@link getCurrentStoredStoreAppSession}).
 *
 * Implementation note: the underlying `conf` library treats `.` in keys as a path
 * separator, so a key like `<clientId>::shop.myshopify.com` is persisted as a nested
 * object `{ <clientId>::shop: { myshopify: { com: <bucket> } } }`. `get`/`set` round-
 * trip through that nesting symmetrically, but the top-level enumerator only sees the
 * outermost segment. To find every bucket regardless of how many dots the shop domain
 * contains, this function walks the value tree under each prefix-matching top-level key
 * and recognizes buckets by shape (`currentUserId` + `sessionsByUserId`).
 */
export function listStoredStoreAppSessions(
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession[] {
  const sessions: StoredStoreAppSession[] = []
  const keyPrefix = `${STORE_AUTH_APP_CLIENT_ID}::`

  for (const [key, value] of storage.entries()) {
    if (typeof key !== 'string' || !key.startsWith(keyPrefix)) continue
    collectBucketsFromSubtree(value, sessions)
  }

  return sessions
}

function collectBucketsFromSubtree(value: unknown, sessions: StoredStoreAppSession[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return

  const bucketCandidate = value as Partial<StoredStoreAppSessionBucket>
  if (
    typeof bucketCandidate.currentUserId === 'string' &&
    bucketCandidate.sessionsByUserId &&
    typeof bucketCandidate.sessionsByUserId === 'object' &&
    !Array.isArray(bucketCandidate.sessionsByUserId)
  ) {
    const session = sanitizeStoredStoreAppSession(
      bucketCandidate.sessionsByUserId[bucketCandidate.currentUserId],
    )
    if (session) sessions.push(session)
    return
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    collectBucketsFromSubtree(child, sessions)
  }
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
