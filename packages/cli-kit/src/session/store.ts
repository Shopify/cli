import {store as secureStore, fetch as secureFetch, remove as secureRemove} from '../secure-store'

import {ApplicationToken, ApplicationTokenSchema, SessionSchema} from './schema'
import type {Session} from './schema'

/**
 * The identifiers of the session/partners token in the secure store.
 */
const identifier = 'session'
const partnersTokenIdentifier = 'partners-token'

/**
 * Serializes the session as a JSON and stores it securely in the system.
 * @param session {Session} the session to store.
 */
export async function storeSession(session: Session) {
  const jsonSession = JSON.stringify(session)
  await secureStore(identifier, jsonSession)
}

/**
 * Serialize the partners app token as a JSON and stores it securely in the system.
 * This token does not belong to a session or identity so it must be stored separately.
 * @param token {ApplicationToken} the token to store
 */
export async function storePartnersToken(token: ApplicationToken) {
  const jsonToken = JSON.stringify(token)
  await secureStore(partnersTokenIdentifier, jsonToken)
}

/**
 * Fetches the session from the system and returns it.
 * If the format of the session is invalid, the method will discard it.
 * In the future might add some logic for supporting migrating the schema
 * of already-persisted sessions.
 * @returns {Promise<Session\undefined>} Returns a promise that resolves with the session if it exists and is valid.
 */
export async function fetchSession(): Promise<Session | undefined> {
  const content = await secureFetch(identifier)
  if (!content) {
    return undefined
  }
  const contentJson = JSON.parse(content)
  const parsedSession = await SessionSchema.safeParseAsync(contentJson)
  if (parsedSession.success) {
    return parsedSession.data
  } else {
    await secureRemove(identifier)
    return undefined
  }
}

/**
 * Fetches the token from the system and returns it
 * If the format of the token is invalid, the method will discard it.
 * This should only be used when explicitly working with SHOPIFY_CLI_PARTNERS_TOKEN
 * If not, refer to use the global Session
 * @returns {Promise<ApplicationToken\undefined>} Returns a promise that resolves with the token if it exists and is valid.
 */
export async function fetchPartnersToken(): Promise<ApplicationToken | undefined> {
  const content = await secureFetch(partnersTokenIdentifier)
  if (!content) {
    return undefined
  }
  const contentJson = JSON.parse(content)
  const parsedToken = await ApplicationTokenSchema.safeParseAsync(contentJson)
  if (parsedToken.success) {
    return parsedToken.data
  } else {
    await secureRemove(partnersTokenIdentifier)
    return undefined
  }
}

/**
 * Removes session and partners token from the system.
 */
export async function remove() {
  await secureRemove(identifier)
  await secureRemove(partnersTokenIdentifier)
}
