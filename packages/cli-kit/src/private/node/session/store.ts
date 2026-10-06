import {SessionsSchema} from './schema.js'
import {getSessions, removeCurrentSessionId, removeSessions, setSessions} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import type {IdentityToken, Session, Sessions} from './schema.js'

type SessionAccount = Pick<IdentityToken, 'userId' | 'alias' | 'email'>

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

  let contentJson: unknown
  try {
    contentJson = JSON.parse(content)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    await remove()
    return undefined
  }

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
 * Gets public account details for a stored user ID.
 *
 * @param userId - The stored user ID whose account details are requested.
 * @returns The account details if the session exists, otherwise undefined.
 */
export async function getSessionAccount(userId: string): Promise<SessionAccount | undefined> {
  const sessions = await fetch()
  if (!sessions) return undefined

  const fqdn = await identityFqdn()
  const session = sessions[fqdn]?.[userId]
  if (!session) return undefined
  return {userId, alias: session.identity.alias, email: session.identity.email}
}

/**
 * Sets the alias for a given user's session and persists it.
 *
 * @param userId - The user ID of the session to update.
 * @param alias - The new alias to set.
 */
export async function setSessionAlias(userId: string, alias: string): Promise<void> {
  const sessions = await fetch()
  if (!sessions) return

  const fqdn = await identityFqdn()
  const session: Session | undefined = sessions[fqdn]?.[userId]
  if (!session) return

  session.identity.alias = alias
  await store(sessions)
}

/**
 * Finds a session by its alias.
 *
 * @param alias - The alias to search for
 * @returns The user ID if found, otherwise undefined
 */
export async function findSessionByAlias(alias: string): Promise<string | undefined> {
  return (await findSessionAccountByAlias(alias))?.userId
}

export async function findSessionAccountByAlias(alias: string): Promise<SessionAccount | undefined> {
  const sessions = await fetch()
  if (!sessions) return undefined

  const fqdn = await identityFqdn()
  const fqdnSessions = sessions[fqdn]
  if (!fqdnSessions) return undefined

  for (const [userId, session] of Object.entries(fqdnSessions)) {
    if (session.identity.alias === alias || userId === alias) {
      return {userId, alias: session.identity.alias, email: session.identity.email}
    }
  }

  return undefined
}
