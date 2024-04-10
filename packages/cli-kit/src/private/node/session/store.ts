import {SessionSchema} from './schema.js'
import {getSession, removeSession, setSession} from '../conf-store.js'
import type {Session} from './schema.js'

/**
 * Serializes the session as a JSON and stores it securely in the system.
 * If the secure store is not available, the session is stored in the local config.
 * @param session - the session to store.
 */
export async function store(session: Session) {
  const jsonSession = JSON.stringify(session)
  setSession(jsonSession)
}

/**
 * Fetches the session from the secure store and returns it.
 * If the secure store is not available, the session is fetched from the local config.
 * If the format of the session is invalid, the method will discard it.
 * In the future might add some logic for supporting migrating the schema
 * of already-persisted sessions.
 * @returns Returns a promise that resolves with the session if it exists and is valid.
 */
export async function fetch(): Promise<Session | undefined> {
  const content = getSession()

  if (!content) {
    return undefined
  }
  const contentJson = JSON.parse(content)
  const parsedSession = await SessionSchema.safeParseAsync(contentJson)
  if (parsedSession.success) {
    return parsedSession.data
  } else {
    await remove()
    return undefined
  }
}

/**
 * Removes a session from the system.
 */
export async function remove() {
  removeSession()
}
