import {categorizeError, formatErrorMessage, ErrorCategory} from './error-categorizer.js'
import {BArray, BMap} from './bounded-collections.js'

interface TimingEntry {
  event: string
  duration: number
}

interface ErrorEntry {
  category: ErrorCategory
  message: string
  timestamp: number
}

interface RetryEntry {
  url: string
  operation: string
  attempts: number
  timestamp: number
}

interface EventEntry {
  name: string
  timestamp: number
}

export interface RuntimeData {
  timings: TimingEntry[]
  errors: ErrorEntry[]
  retries: RetryEntry[]
  events: EventEntry[]
}

const _runtimeAnalyticsStore = {
  timings: new BArray<TimingEntry>(),
  activeTimings: new BMap<string, number>(),
  errors: new BArray<ErrorEntry>(),
  retries: new BArray<RetryEntry>(),
  events: new BArray<EventEntry>(),
}

/**
 * Caps the length of individual string fields stored in analytics entries.
 *
 * Entry counts are bounded by BArray, but a single entry can still carry an
 * arbitrarily large string (e.g. a retry operation derived from a network error
 * message). Without this cap, serializing the collected data with JSON.stringify
 * can exceed V8's maximum string length and throw a `RangeError`
 * ("Invalid string length"), surfacing as an unhandled error from command analytics.
 */
const MAX_FIELD_LENGTH = 512

function truncateField(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? value.substring(0, MAX_FIELD_LENGTH) : value
}

export function recordTiming(eventName: string): void {
  const now = Date.now()

  if (!_runtimeAnalyticsStore.activeTimings.has(eventName)) {
    _runtimeAnalyticsStore.activeTimings.set(eventName, now)
    recordEvent(`timing:start:${eventName}`)
    return
  }

  const startTime = _runtimeAnalyticsStore.activeTimings.get(eventName)
  if (startTime === undefined) return

  const duration = now - startTime

  _runtimeAnalyticsStore.timings.push({
    event: truncateField(eventName),
    duration,
  })

  _runtimeAnalyticsStore.activeTimings.delete(eventName)

  recordEvent(`timing:end:${eventName}`)
}

export function recordError(error: unknown): void {
  const category = categorizeError(error)
  const errorEntry: ErrorEntry = {
    category,
    message: (error instanceof Error ? error.message : String(error)).substring(0, 200),
    timestamp: Date.now(),
  }

  if (errorEntry.category === ErrorCategory.Unknown && !errorEntry.message) {
    return
  }

  _runtimeAnalyticsStore.errors.push(errorEntry)

  const normalizedErrorCategory = category.toLowerCase()
  const normalizedErrorMessage = formatErrorMessage(error, category)

  recordEvent(`error:${normalizedErrorCategory}:${normalizedErrorMessage}`)
}

export function recordRetry(url: string, operation: string): void {
  const truncatedUrl = truncateField(url)
  const truncatedOperation = truncateField(operation)

  const existingEntries = _runtimeAnalyticsStore.retries.filter(
    (entry) => entry.url === truncatedUrl && entry.operation === truncatedOperation,
  )
  const attemptCount = existingEntries.length + 1

  _runtimeAnalyticsStore.retries.push({
    url: truncatedUrl,
    operation: truncatedOperation,
    attempts: attemptCount,
    timestamp: Date.now(),
  })

  recordEvent(`retry:${truncatedOperation}:attempt:${attemptCount}`)
}

export function recordEvent(eventName: string): void {
  _runtimeAnalyticsStore.events.push({
    name: truncateField(eventName),
    timestamp: Date.now(),
  })
}

export function compileData(): RuntimeData {
  return {
    timings: _runtimeAnalyticsStore.timings.toArray(),
    errors: _runtimeAnalyticsStore.errors.toArray(),
    retries: _runtimeAnalyticsStore.retries.toArray(),
    events: _runtimeAnalyticsStore.events.toArray(),
  }
}

export function reset(): void {
  _runtimeAnalyticsStore.timings.clear()
  _runtimeAnalyticsStore.activeTimings.clear()
  _runtimeAnalyticsStore.errors.clear()
  _runtimeAnalyticsStore.retries.clear()
  _runtimeAnalyticsStore.events.clear()
}
