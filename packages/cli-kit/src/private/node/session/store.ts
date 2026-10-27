import {SessionsSchema} from './schema.js'
import {
  getSessionStoreLockPath,
  getCurrentSessionId,
  getSessions,
  removeCurrentSessionId,
  removeSessions,
  setCurrentSessionId,
  setSessions,
} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import lockfile from 'proper-lockfile'
import type {Session, Sessions} from './schema.js'

const SESSION_STORE_LOCK_RETRIES = {
  retries: 360,
  factor: 1.2,
  minTimeout: 25,
  maxTimeout: 500,
}

export interface LockedSessionStore {
  fetch(): Promise<Sessions | undefined>
  store(sessions: Sessions): Promise<void>
  storeSession(fqdn: string, userId: string, session: Session): Promise<void>
  setCurrentSessionId(sessionId: string): void
  remove(): Promise<void>
  removeSession(fqdn: string, userId: string, expectedSession?: Session): Promise<boolean>
}

/**
 * Runs a session-store operation while holding a lock shared by all CLI processes.
 *
 * @param operation - The operation to run while the store is locked.
 * @param lockPath - The lock target. This parameter is exposed for isolated tests.
 * @returns The operation result.
 */
export async function withSessionStoreLock<T>(
  operation: (store: LockedSessionStore) => Promise<T>,
  lockPath = getSessionStoreLockPath(),
): Promise<T> {
  // Refreshes hold this lock while auth and application-token requests use their own timeout and retry budgets.
  const release = await lockfile.lock(lockPath, {retries: SESSION_STORE_LOCK_RETRIES})

  let result: T
  try {
    result = await operation({
      fetch: fetchUnlocked,
      store: storeUnlocked,
      storeSession: storeSessionUnlocked,
      setCurrentSessionId,
      remove: removeUnlocked,
      removeSession: removeSessionUnlocked,
    })
  } catch (error) {
    try {
      await release()
      // Preserve the operation error if releasing the lock also fails.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // The operation error is more useful to the caller than a cleanup error.
    }
    throw error
  }

  await release()
  return result
}

/**
 * Serializes the session as a JSON and stores it in the system.
 * @param session - the session to store.
 */
export async function store(sessions: Sessions) {
  await withSessionStoreLock((store) => store.store(sessions))
}

/**
 * Fetches the sessions from the local storage and returns it.
 * If the format of the object is invalid, the method will discard it.
 * @returns Returns a promise that resolves with the sessions object if it exists and is valid.
 */
export async function fetch(): Promise<Sessions | undefined> {
  return withSessionStoreLock((store) => store.fetch())
}

/**
 * Stores one session without replacing sessions saved by another CLI process.
 *
 * @param fqdn - The identity service hostname for the session.
 * @param userId - The user ID for the session.
 * @param session - The session to store.
 */
export async function storeSession(fqdn: string, userId: string, session: Session): Promise<void> {
  await withSessionStoreLock((store) => store.storeSession(fqdn, userId, session))
}

/**
 * Removes a session without affecting other users or identity services.
 *
 * @param fqdn - The identity service hostname for the session.
 * @param userId - The user ID for the session.
 * @param expectedSession - If provided, remove only if the stored credentials still match.
 * @returns Whether the session was removed.
 */
export async function removeSession(fqdn: string, userId: string, expectedSession?: Session): Promise<boolean> {
  return withSessionStoreLock((store) => store.removeSession(fqdn, userId, expectedSession))
}

async function storeUnlocked(sessions: Sessions): Promise<void> {
  const jsonSessions = JSON.stringify(sessions)
  setSessions(jsonSessions)
}

async function fetchUnlocked(): Promise<Sessions | undefined> {
  const content = getSessions()

  if (!content) {
    return undefined
  }

  let contentJson: unknown
  try {
    contentJson = JSON.parse(content)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    await removeUnlocked()
    return undefined
  }

  const parsedSessions = await SessionsSchema.safeParseAsync(contentJson)
  if (parsedSessions.success) {
    return parsedSessions.data
  } else {
    await removeUnlocked()
    return undefined
  }
}

async function storeSessionUnlocked(fqdn: string, userId: string, session: Session): Promise<void> {
  const sessions = (await fetchUnlocked()) ?? {}
  await storeUnlocked({
    ...sessions,
    [fqdn]: {...sessions[fqdn], [userId]: session},
  })
}

async function removeSessionUnlocked(fqdn: string, userId: string, expectedSession?: Session): Promise<boolean> {
  const sessions = await fetchUnlocked()
  const currentSession = sessions?.[fqdn]?.[userId]
  if (!sessions || !currentSession || (expectedSession && !sameSessionCredentials(currentSession, expectedSession))) {
    return false
  }

  const remainingFqdnSessions = Object.fromEntries(
    Object.entries(sessions[fqdn]!).filter(([sessionId]) => sessionId !== userId),
  )
  const updatedSessions = {...sessions}
  if (Object.keys(remainingFqdnSessions).length === 0) {
    const remainingSessions = Object.fromEntries(
      Object.entries(sessions).filter(([sessionFqdn]) => sessionFqdn !== fqdn),
    )
    await storeUnlocked(remainingSessions)
  } else {
    updatedSessions[fqdn] = remainingFqdnSessions
    await storeUnlocked(updatedSessions)
  }

  if (getCurrentSessionId() === userId) {
    removeCurrentSessionId()
  }

  return true
}

function sameSessionCredentials(first: Session, second: Session): boolean {
  return (
    first.identity.userId === second.identity.userId &&
    first.identity.accessToken === second.identity.accessToken &&
    first.identity.refreshToken === second.identity.refreshToken &&
    first.identity.expiresAt.getTime() === second.identity.expiresAt.getTime()
  )
}

async function removeUnlocked(): Promise<void> {
  removeSessions()
  removeCurrentSessionId()
}

/**
 * Removes a session from the system.
 */
export async function remove() {
  await withSessionStoreLock((store) => store.remove())
}

/**
 * Gets the session alias for a given user ID.
 *
 * @param userId - The user ID of the session to get the alias for.
 * @returns The alias for the session if it exists, otherwise undefined.
 */
export async function getSessionAlias(userId: string): Promise<string | undefined> {
  const sessions = await fetch()
  if (!sessions) return undefined

  const fqdn = await identityFqdn()
  if (!sessions[fqdn] || !sessions[fqdn][userId]) return undefined
  return sessions[fqdn][userId].identity.alias
}

/**
 * Sets the alias for a given user's session and persists it.
 *
 * @param userId - The user ID of the session to update.
 * @param alias - The new alias to set.
 */
export async function setSessionAlias(userId: string, alias: string): Promise<void> {
  await withSessionStoreLock(async (store) => {
    const sessions = await store.fetch()
    if (!sessions) return

    const fqdn = await identityFqdn()
    const session: Session | undefined = sessions[fqdn]?.[userId]
    if (!session) return

    session.identity.alias = alias
    await store.store(sessions)
  })
}

/**
 * Finds a session by its alias.
 *
 * @param alias - The alias to search for
 * @returns The user ID if found, otherwise undefined
 */
export async function findSessionByAlias(alias: string): Promise<string | undefined> {
  const sessions = await fetch()
  if (!sessions) return undefined

  const fqdn = await identityFqdn()
  const fqdnSessions = sessions[fqdn]
  if (!fqdnSessions) return undefined

  for (const [userId, session] of Object.entries(fqdnSessions)) {
    if (session.identity.alias === alias || userId === alias) {
      return userId
    }
  }

  return undefined
}
