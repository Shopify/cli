import {LocalStorage} from '../../public/node/local-storage.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

interface Cache {
  [key: string]: {
    value: unknown
    timestamp: number
  }
}

export interface ConfSchema {
  sessionStore: string
  cache: Cache
}

let _instance: LocalStorage<ConfSchema> | undefined

/**
 * CLIKIT Store.
 *
 * @returns CLIKitStore.
 */
function cliKitStore() {
  if (!_instance) {
    _instance = new LocalStorage<ConfSchema>({projectName: 'shopify-cli-kit'})
  }
  return _instance
}

/**
 * Get session.
 *
 * @returns Session.
 */
export function getSession(config: LocalStorage<ConfSchema> = cliKitStore()): string | undefined {
  outputDebug(outputContent`Getting session store...`)
  return config.get('sessionStore')
}

/**
 * Set session.
 *
 * @param session - Session.
 */
export function setSession(session: string, config: LocalStorage<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Setting session store...`)
  config.set('sessionStore', session)
}

/**
 * Remove session.
 */
export function removeSession(config: LocalStorage<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Removing session store...`)
  config.delete('sessionStore')
}

/**
 * Fetch from cache, or run the provided function to get the value, and cache it
 * before returning it.
 * @param key - The key to use for the cache.
 * @param fn - The function to run to get the value to cache.
 * @param timeout - The number of milliseconds to cache the value for.
 * @returns The value from the cache or the result of the function.
 */
export async function cacheFetch<T>(
  key: string,
  fn: () => Promise<T>,
  timeout?: number,
  config = cliKitStore(),
): Promise<T> {
  const cache: Cache = config.get('cache') || {}
  const cached = cache[key]

  if (cached && (!timeout || Date.now() - cached.timestamp < timeout)) {
    return cached.value as T
  }

  const value = await fn()
  cache[key] = {value, timestamp: Date.now()}
  cliKitStore().set('cache', cache)
  return value
}
