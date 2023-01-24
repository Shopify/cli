import {SessionSchema} from './schema.js'
import {keychainConstants} from '../constants.js'
import {platformAndArch} from '../../../public/node/os.js'
import {secureStoreSave, secureStoreFetch, secureStoreRemove} from '../secure-store.js'
import {outputContent, outputDebug} from '../../../public/node/output.js'
import {getSession, removeSession, setSession, clearAllAppInfo} from '../../../store.js'
import type {Session} from './schema.js'

/**
 * The identifier of the session in the secure store.
 */
export const identifier = 'session'

/**
 * Serializes the session as a JSON and stores it securely in the system.
 * If the secure store is not available, the session is stored in the local config.
 * @param session - the session to store.
 */
export async function store(session: Session) {
  const jsonSession = JSON.stringify(session)
  if (await secureStoreAvailable()) {
    await secureStoreSave(identifier, jsonSession)
  } else {
    setSession(jsonSession)
  }
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
  let content
  if (await secureStoreAvailable()) {
    content = await secureStoreFetch(identifier)
  } else {
    content = getSession()
  }

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
  if (await secureStoreAvailable()) {
    await secureStoreRemove(identifier)
  } else {
    removeSession()
  }

  clearAllAppInfo()
}

/**
 * Returns true if the secure store is available on the system.
 * Keytar it's not supported on some Linux environments or Windows.
 * More details: https://github.com/Shopify/shopify-cli-planning/issues/261
 * @returns a boolean indicating if the secure store is available.
 */
async function secureStoreAvailable(): Promise<boolean> {
  try {
    if (platformAndArch().platform === 'windows') {
      outputDebug(outputContent`Secure store not supported on Windows`)
      return false
    }
    const keytar = await import('keytar')
    await keytar.default.findCredentials(keychainConstants.service)
    outputDebug(outputContent`Secure store is available`)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_error) {
    outputDebug(outputContent`Failed to load secure store`)
    return false
  }
}
