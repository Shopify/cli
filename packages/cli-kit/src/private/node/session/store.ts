import {SessionsSchema} from './schema.js'
import {getSessions, removeCurrentSessionId, removeSessions, setSessions, withSessionStoreLock} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {AbortError} from '../../../public/node/error.js'
import type {ConfSchema} from '../conf-store.js'
import type {LocalStorage} from '../../../public/node/local-storage.js'
import type {Session, Sessions} from './schema.js'

/**
 * Merges changed sessions into the latest stored accounts.
 * @param sessions - Only the sessions changed by the caller.
 * @param config - Optional local storage instance.
 */
export async function store(sessions: Sessions, config?: LocalStorage<ConfSchema>) {
  await withSessionStoreLock(async () => {
    const storedSessions = (await fetch(config)) ?? {}
    for (const [fqdn, changedSessions] of Object.entries(sessions)) {
      storedSessions[fqdn] = {...storedSessions[fqdn], ...changedSessions}
    }
    setSessions(JSON.stringify(storedSessions), config)
  }, config)
}

/**
 * Fetches the sessions from the local storage and returns it.
 * Unreadable data is preserved instead of removing every saved account.
 * @returns Returns a promise that resolves with the sessions object if it exists and is valid.
 */
export async function fetch(config?: LocalStorage<ConfSchema>): Promise<Sessions | undefined> {
  const content = getSessions(config)

  if (!content) {
    return undefined
  }

  let contentJson: unknown
  try {
    contentJson = JSON.parse(content)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }

  const parsedSessions = await SessionsSchema.safeParseAsync(contentJson)
  if (parsedSessions.success) {
    return parsedSessions.data
  }
  throw new AbortError(
    'The saved CLI accounts could not be read. They have not been changed.',
    'Try the CLI version used to save these accounts. To remove all saved accounts and sign in again, run `shopify auth logout`, then `shopify auth login`.',
  )
}

/**
 * Removes a session from the system.
 */
export async function remove(config?: LocalStorage<ConfSchema>) {
  await withSessionStoreLock(async () => {
    removeSessions(config)
    removeCurrentSessionId(config)
  }, config)
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
export async function setSessionAlias(userId: string, alias: string, config?: LocalStorage<ConfSchema>): Promise<void> {
  const fqdn = await identityFqdn()
  await withSessionStoreLock(async () => {
    const sessions = await fetch(config)
    const session: Session | undefined = sessions?.[fqdn]?.[userId]
    if (!session) return

    session.identity.alias = alias
    setSessions(JSON.stringify(sessions), config)
  }, config)
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
