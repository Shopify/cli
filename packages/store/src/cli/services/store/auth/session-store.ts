import {storeAuthSessionKey} from './config.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

export interface StoredStoreAppSession {
  store: string
  clientId: string
  agentKey: string
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

interface StoredStoreAppAgentGroup {
  currentUserId: string
  sessionsByUserId: {[userId: string]: StoredStoreAppSession}
}

interface StoredStoreAppSessionBucket {
  sessionsByAgentKey: {[agentKey: string]: StoredStoreAppAgentGroup}
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
    !isString(session.agentKey) ||
    !isString(session.userId) ||
    !isString(session.accessToken) ||
    !Array.isArray(session.scopes) ||
    !session.scopes.every(isString) ||
    !isString(session.acquiredAt)
  ) {
    return undefined
  }

  return {
    store: session.store,
    clientId: session.clientId,
    agentKey: session.agentKey,
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
  }
}

function sanitizeAgentGroup(value: unknown): StoredStoreAppAgentGroup | undefined {
  if (!value || typeof value !== 'object') return undefined

  const {currentUserId, sessionsByUserId} = value as Partial<StoredStoreAppAgentGroup>
  if (
    typeof currentUserId !== 'string' ||
    !sessionsByUserId ||
    typeof sessionsByUserId !== 'object' ||
    Array.isArray(sessionsByUserId)
  ) {
    return undefined
  }

  const sanitizedSessionsByUserId = Object.fromEntries(
    Object.entries(sessionsByUserId).flatMap(([userId, session]) => {
      const sanitizedSession = sanitizeStoredStoreAppSession(session)
      return sanitizedSession ? [[userId, sanitizedSession]] : []
    }),
  )

  if (Object.keys(sanitizedSessionsByUserId).length === 0) return undefined
  if (!sanitizedSessionsByUserId[currentUserId]) return undefined

  return {currentUserId, sessionsByUserId: sanitizedSessionsByUserId}
}

function readStoredStoreAppSessionBucket(
  store: string,
  storage: LocalStorage<StoreSessionSchema>,
): StoredStoreAppSessionBucket | undefined {
  const key = storeAuthSessionKey(store)
  const storedBucket = storage.get(key)
  if (!storedBucket || typeof storedBucket !== 'object') return undefined

  const {sessionsByAgentKey} = storedBucket as Partial<StoredStoreAppSessionBucket>
  if (!sessionsByAgentKey || typeof sessionsByAgentKey !== 'object' || Array.isArray(sessionsByAgentKey)) {
    storage.delete(key)
    return undefined
  }

  const sanitizedSessionsByAgentKey: StoredStoreAppSessionBucket['sessionsByAgentKey'] = {}
  for (const [agentKey, group] of Object.entries(sessionsByAgentKey)) {
    const sanitizedGroup = sanitizeAgentGroup(group)
    if (sanitizedGroup) sanitizedSessionsByAgentKey[agentKey] = sanitizedGroup
  }

  if (Object.keys(sanitizedSessionsByAgentKey).length === 0) {
    storage.delete(key)
    return undefined
  }

  if (Object.keys(sanitizedSessionsByAgentKey).length !== Object.keys(sessionsByAgentKey).length) {
    storage.set(key, {sessionsByAgentKey: sanitizedSessionsByAgentKey})
  }

  return {sessionsByAgentKey: sanitizedSessionsByAgentKey}
}

export function getStoredStoreAppSession(
  store: string,
  agentKey: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): StoredStoreAppSession | undefined {
  const bucket = readStoredStoreAppSessionBucket(store, storage)
  if (!bucket) return undefined

  const group = bucket.sessionsByAgentKey[agentKey]
  if (!group) return undefined

  return group.sessionsByUserId[group.currentUserId]
}

export function setStoredStoreAppSession(
  session: StoredStoreAppSession,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  const key = storeAuthSessionKey(session.store)
  const existingBucket = readStoredStoreAppSessionBucket(session.store, storage)
  const existingGroup = existingBucket?.sessionsByAgentKey[session.agentKey]

  const nextGroup: StoredStoreAppAgentGroup = {
    currentUserId: session.userId,
    sessionsByUserId: {
      ...(existingGroup?.sessionsByUserId ?? {}),
      [session.userId]: session,
    },
  }

  const nextBucket: StoredStoreAppSessionBucket = {
    sessionsByAgentKey: {
      ...(existingBucket?.sessionsByAgentKey ?? {}),
      [session.agentKey]: nextGroup,
    },
  }

  storage.set(key, nextBucket)
}

export function clearStoredStoreAppSession(
  store: string,
  agentKey?: string,
  userId?: string,
  storage: LocalStorage<StoreSessionSchema> = storeSessionStorage(),
): void {
  const key = storeAuthSessionKey(store)

  if (!agentKey) {
    storage.delete(key)
    return
  }

  const existingBucket = readStoredStoreAppSessionBucket(store, storage)
  if (!existingBucket) return

  const existingGroup = existingBucket.sessionsByAgentKey[agentKey]
  if (!existingGroup) return

  let nextSessionsByAgentKey: StoredStoreAppSessionBucket['sessionsByAgentKey']

  if (!userId) {
    const {[agentKey]: _removedGroup, ...remainingAgents} = existingBucket.sessionsByAgentKey
    nextSessionsByAgentKey = remainingAgents
  } else {
    const {[userId]: _removedSession, ...remainingSessions} = existingGroup.sessionsByUserId
    const remainingUserIds = Object.keys(remainingSessions)

    if (remainingUserIds.length === 0) {
      const {[agentKey]: _removedGroup, ...remainingAgents} = existingBucket.sessionsByAgentKey
      nextSessionsByAgentKey = remainingAgents
    } else {
      nextSessionsByAgentKey = {
        ...existingBucket.sessionsByAgentKey,
        [agentKey]: {
          currentUserId: existingGroup.currentUserId === userId ? remainingUserIds[0]! : existingGroup.currentUserId,
          sessionsByUserId: remainingSessions,
        },
      }
    }
  }

  if (Object.keys(nextSessionsByAgentKey).length === 0) {
    storage.delete(key)
    return
  }

  storage.set(key, {sessionsByAgentKey: nextSessionsByAgentKey})
}
