import {isUnitTest} from '../../public/node/context/local.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

interface CacheValue<T> {
  value: T
  timestamp: number
}

export type IntrospectionUrlKey = `identity-introspection-url-${string}`
export type PackageVersionKey = `npm-package-${string}`
export type NotificationsKey = `notifications-${string}`
export type NotificationKey = `notification-${string}`
type MostRecentOccurrenceKey = `most-recent-occurrence-${string}`

type ExportedKey = IntrospectionUrlKey | PackageVersionKey | NotificationsKey | NotificationKey

interface Cache {
  [introspectionUrlKey: IntrospectionUrlKey]: CacheValue<string>
  [packageVersionKey: PackageVersionKey]: CacheValue<string>
  [notifications: NotificationsKey]: CacheValue<string>
  [notification: NotificationKey]: CacheValue<string>
  [MostRecentOccurrenceKey: MostRecentOccurrenceKey]: CacheValue<boolean>
}

export interface ConfSchema {
  sessionStore: string
  cache?: Cache
}

let _instance: LocalStorage<ConfSchema> | undefined

/**
 * CLIKIT Store.
 *
 * @returns CLIKitStore.
 */
function cliKitStore() {
  if (!_instance) {
    _instance = new LocalStorage<ConfSchema>({projectName: `shopify-cli-kit${isUnitTest() ? '-test' : ''}`})
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

type CacheValueForKey<TKey extends keyof Cache> = NonNullable<Cache[TKey]>['value']

/**
 * Fetch from cache, or run the provided function to get the value, and cache it
 * before returning it.
 * @param key - The key to use for the cache.
 * @param fn - The function to run to get the value to cache, if a cache miss occurs.
 * @param timeout - The maximum valid age of a cached value, in milliseconds.
 * If the cached value is older than this, it will be refreshed.
 * @returns The value from the cache or the result of the function.
 */
export async function cacheRetrieveOrRepopulate(
  key: ExportedKey,
  fn: () => Promise<CacheValueForKey<typeof key>>,
  timeout?: number,
  config = cliKitStore(),
): Promise<CacheValueForKey<typeof key>> {
  const cached = cacheRetrieve(key, config)

  if (cached?.value !== undefined && (timeout === undefined || Date.now() - cached.timestamp < timeout)) {
    return cached.value
  }

  const value = await fn()
  cacheStore(key, value, config)
  return value
}

export function cacheStore(key: ExportedKey, value: string, config = cliKitStore()): void {
  const cache: Cache = config.get('cache') || {}
  cache[key] = {value, timestamp: Date.now()}
  config.set('cache', cache)
}

/**
 * Fetch from cache if already populated, otherwise return undefined.
 * @param key - The key to use for the cache.
 * @returns The chache element.
 */
export function cacheRetrieve(key: ExportedKey, config = cliKitStore()): CacheValue<string> | undefined {
  const cache: Cache = config.get('cache') || {}
  return cache[key]
}

export function cacheClear(config = cliKitStore()): void {
  config.delete('cache')
}

interface TimeInterval {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

function timeIntervalToMilliseconds({days = 0, hours = 0, minutes = 0, seconds = 0}: TimeInterval): number {
  return (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1000
}

/**
 * Execute a task only if the most recent occurrence of the task is older than the specified timeout.
 * @param key - The key to use for the cache.
 * @param timeout - The maximum valid age of the most recent occurrence, expressed as an object with
 * days, hours, minutes, and seconds properties.
 * If the most recent occurrence is older than this, the task will be executed.
 * @param task - The task to run if the most recent occurrence is older than the timeout.
 * @returns The result of the task, or undefined if the task was not run.
 */
export async function runAtMinimumInterval(
  key: string,
  timeout: TimeInterval,
  task: () => Promise<void>,
  config = cliKitStore(),
): Promise<boolean | undefined> {
  const cache: Cache = config.get('cache') || {}
  const cacheKey: MostRecentOccurrenceKey = `most-recent-occurrence-${key}`
  const cached = cache[cacheKey]

  if (cached?.value !== undefined && Date.now() - cached.timestamp < timeIntervalToMilliseconds(timeout)) {
    return undefined
  }

  await task()
  cache[cacheKey] = {value: true, timestamp: Date.now()}
  config.set('cache', cache)
  return true
}
