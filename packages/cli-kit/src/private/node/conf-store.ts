import {isUnitTest} from '../../public/node/context/local.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

interface CacheValue<T> {
  value: T
  timestamp: number
}

export type PackageVersionKey = `npm-package-${string}`
export type NotificationsKey = `notifications-${string}`
export type NotificationKey = `notification-${string}`
export type GraphQLRequestKey = `q-${string}-${string}-${string}`
type MostRecentOccurrenceKey = `most-recent-occurrence-${string}`
type RateLimitKey = `rate-limited-occurrences-${string}`

type ExportedKey = PackageVersionKey | NotificationsKey | NotificationKey | GraphQLRequestKey

interface Cache {
  [packageVersionKey: PackageVersionKey]: CacheValue<string>
  [notifications: NotificationsKey]: CacheValue<string>
  [notification: NotificationKey]: CacheValue<string>
  [graphQLRequestKey: GraphQLRequestKey]: CacheValue<string>
  [mostRecentOccurrenceKey: MostRecentOccurrenceKey]: CacheValue<boolean>
  [rateLimitKey: RateLimitKey]: CacheValue<number[]>
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
 * @returns true if the task was run, or false if the task was not run.
 */
export async function runAtMinimumInterval(
  key: string,
  timeout: TimeInterval,
  task: () => Promise<void>,
  config = cliKitStore(),
): Promise<boolean> {
  const cache: Cache = config.get('cache') || {}
  const cacheKey: MostRecentOccurrenceKey = `most-recent-occurrence-${key}`
  const cached = cache[cacheKey]

  if (cached?.value !== undefined && Date.now() - cached.timestamp < timeIntervalToMilliseconds(timeout)) {
    return false
  }

  await task()
  cache[cacheKey] = {value: true, timestamp: Date.now()}
  config.set('cache', cache)
  return true
}

interface RunWithRateLimitOptions {
  /**
   * The key to use for the cache.
   */
  key: string

  /**
   * The number of times the task can be run within the limit
   */
  limit: number

  /**
   * The window of time after which the rate limit is refreshed,
   * expressed as an object with days, hours, minutes, and seconds properties.
   * If the most recent occurrence is older than this, the task will be executed.
   */
  timeout: TimeInterval

  /**
   * The task to run if the most recent occurrence is older than the timeout.
   */
  task: () => Promise<void>
}

/**
 * Execute a task with a time-based rate limit. The rate limit is enforced by
 * checking how many times that task has been executed in a window of time ending
 * at the current time. If the task has been executed more than the allowed number
 * of times in that window, the task will not be executed.
 *
 * Note that this function has side effects, as it will also remove events prior
 * to the window of time that is being checked.
 * @param options - The options for the rate limiting.
 * @returns true, or undefined if the task was not run.
 */
export async function runWithRateLimit(options: RunWithRateLimitOptions, config = cliKitStore()): Promise<boolean> {
  const {key, limit, timeout, task} = options
  const cache: Cache = config.get('cache') || {}
  const cacheKey: RateLimitKey = `rate-limited-occurrences-${key}`
  const cached = cache[cacheKey]
  const now = Date.now()

  if (cached?.value) {
    // First sweep through the cache and eliminate old events
    const windowStart = now - timeIntervalToMilliseconds(timeout)
    const occurrences = cached.value.filter((occurrence) => occurrence >= windowStart)

    // Now check that the number of occurrences within the interval is below the limit
    if (occurrences.length >= limit) {
      // First remove the old occurrences from the cache
      cache[cacheKey] = {value: occurrences, timestamp: Date.now()}
      config.set('cache', cache)

      return false
    }

    await task()
    cache[cacheKey] = {value: [...occurrences, now], timestamp: now}
  } else {
    await task()
    cache[cacheKey] = {value: [now], timestamp: now}
  }
  config.set('cache', cache)

  return true
}

export function getConfigStoreForPartnerStatus() {
  return new LocalStorage<{[partnerToken: string]: {status: true; checkedAt: string}}>({
    projectName: 'shopify-cli-kit-partner-status',
  })
}

export function getCachedPartnerAccountStatus(partnersToken: string): true | null {
  if (!partnersToken) return null
  const store = getConfigStoreForPartnerStatus()

  const hasPartnerAccount = store.get(partnersToken)
  if (hasPartnerAccount) {
    // this never needs to expire
    return true
  }
  return null
}

export function setCachedPartnerAccountStatus(partnersToken: string) {
  const store = getConfigStoreForPartnerStatus()

  store.set(partnersToken, {status: true, checkedAt: new Date().toISOString()})
}
