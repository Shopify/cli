import {SessionsSchema} from './schema.js'
import {getSessions, removeCurrentSessionId, removeSessions, setSessions} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import type {Sessions} from './schema.js'

/**
 * Serializes the session as a JSON and stores it in the system.
 * @param session - the session to store.
 */
export async function store(sessions: Sessions) {
  const jsonSessions = JSON.stringify(sessions)
  setSessions(jsonSessions)
}

/**
 * Fetches the sessions from the local storage and returns it.
 * If the format of the object is invalid, the method will discard it.
 * @returns Returns a promise that resolves with the sessions object if it exists and is valid.
 */
export async function fetch(): Promise<Sessions | undefined> {
  const content = getSessions()

  if (!content) {
    return undefined
  }
  const contentJson = JSON.parse(content)
  const parsedSessions = await SessionsSchema.safeParseAsync(contentJson)
  if (parsedSessions.success) {
    return parsedSessions.data
  } else {
    await remove()
    return undefined
  }
}

/**
 * Removes a session from the system.
 */
export async function remove() {
  removeSessions()
  removeCurrentSessionId()
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
 * Updates the session alias with a more human-readable display name if available.
 *
 * @param userId - The user ID of the session to update
 * @param alias - The alias to update the session with
 */
export async function updateSessionAlias(userId: string, alias: string): Promise<void> {
  const sessions = await fetch()
  if (!sessions) return

  const fqdn = await identityFqdn()
  if (!sessions[fqdn] || !sessions[fqdn][userId]) return

  sessions[fqdn][userId].identity.alias = alias
  await store(sessions)
}
