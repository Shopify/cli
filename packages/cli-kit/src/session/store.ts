import {SessionSchema} from './schema'
import {store as secureStore, fetch as secureFetch, remove as secureRemove} from '../secure-store'

import type {Session} from './schema'
/**
 * The identifier of the session in the secure store.
 */
export const identifier = 'session'

/**
 * Serializes the session as a JSON and stores it securely in the system.
 * @param session {Session} the session to store.
 */
export async function store(session: Session) {
  const jsonSession = JSON.stringify(session)
  await secureStore(identifier, jsonSession)
}

/**
 * Fetches the session from the system and returns it.
 * If the format of the session is invalid, the method will discard it.
 * In the future might add some logic for supporting migrating the schema
 * of already-persisted sessions.
 * @returns {Promise<Session\undefined>} Returns a promise that resolves with the session if it exists and is valid.
 */
export async function fetch(): Promise<Session | undefined> {
  const content = await secureFetch(identifier)
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
  await secureRemove(identifier)
}
