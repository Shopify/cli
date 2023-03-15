import {LocalStorage} from '../../public/node/local-storage.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

interface CacheValue<T> {
  value: T
  timestamp: number
}

export type IntrospectionUrlKey = `identity-introspection-url-${string}`

interface Cache {
  [introspectionUrlKey: IntrospectionUrlKey]: CacheValue<string>
}

export interface ConfSchema {
  sessionStore: string
  cache?: Cache
  nextDeprecationDate?: string
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
 * Get the earliest deprecation date in the future.
 *
 * @returns nextDeprecationDate.
 */
export function getNextDeprecationDate(config: LocalStorage<ConfSchema> = cliKitStore()): Date | undefined {
  outputDebug(outputContent`Getting the next deprecation date...`)
  const dateString = config.get('nextDeprecationDate')
  return dateString ? new Date(dateString) : undefined
}

/**
 * Set next deprecation date.
 *
 * @param deprecations - Deprecations.
 */
export function setNextDeprecationDate(
  deprecationDates: Date[],
  config: LocalStorage<ConfSchema> = cliKitStore(),
): void {
  if (deprecationDates.length < 1) return

  const now = Date.now()
  const dateTimes = deprecationDates.map((date) => date.getTime())
  const earliestFutureDateTime = dateTimes.sort().find((dateTime) => dateTime >= now)
  if (!earliestFutureDateTime) return

  const nextDeprecationDate = getNextDeprecationDate()
  if (!nextDeprecationDate || earliestFutureDateTime < nextDeprecationDate.getTime()) {
    outputDebug(outputContent`Setting the next deprecation date...`)
    config.set('nextDeprecationDate', new Date(earliestFutureDateTime).toISOString())
  }
}

/**
 * Clear nextDeprecationDate.
 */
export function clearNextDeprecationDate(config: LocalStorage<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Clearing next deprecation date...`)
  config.delete('nextDeprecationDate')
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

type CacheValueForKey<TKey extends keyof Cache> = NonNullable<Cache[TKey]>['value']
/**
 * Fetch from cache, or run the provided function to get the value, and cache it
 * before returning it.
 * @param key - The key to use for the cache.
 * @param fn - The function to run to get the value to cache, if a cache miss occurs.
 * @param timeout - The maximum valid age of a cached value, in milliseconds. If the cached value is older than this, it will be refreshed.
 * @returns The value from the cache or the result of the function.
 */
export async function cacheRetrieveOrRepopulate(
  key: keyof Cache,
  fn: () => Promise<CacheValueForKey<typeof key>>,
  timeout?: number,
  config = cliKitStore(),
): Promise<CacheValueForKey<typeof key>> {
  const cache: Cache = config.get('cache') || {}
  const cached = cache[key]

  if (cached && (timeout === undefined || Date.now() - cached.timestamp < timeout)) {
    return cached.value
  }

  const value = await fn()
  cache[key] = {value, timestamp: Date.now()}
  config.set('cache', cache)
  return value
}
