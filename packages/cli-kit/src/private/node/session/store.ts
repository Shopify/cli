import {SessionsSchema} from './schema.js'
import {getSessions, removeCurrentSessionId, removeSessions, setSessions} from '../conf-store.js'
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
