import {extractErrorContext, extractTopStackFrame} from './context-extractor.js'
import {createHash} from 'node:crypto'

// Memoization for repeated errors
const hashCache = new Map<string, string>()
const CACHE_MAX_SIZE = 100

/**
 * Generates a semantic grouping hash for an error to improve error grouping in Bugsnag/Observe.
 * Uses error class, sanitized message, and top stack frame to create a consistent hash.
 *
 * @param error - The error to generate a hash for.
 * @returns A 16-character hex hash string.
 */
export function generateGroupingHash(error: Error): string {
  try {
    // Validate input - must be an actual Error instance
    if (!error || typeof error !== 'object' || !(error instanceof Error)) {
      return 'invalid-input'
    }

    // Extract top stack frame for cache key to avoid collision
    let topFrame: string | null = null
    try {
      topFrame = extractTopStackFrame(error.stack) ?? null
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing stack throws, leave topFrame as null
    }

    // Safely get constructor name
    let constructorName = 'Error'
    try {
      constructorName = error.constructor?.name || 'Error'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing constructor.name throws, use default
    }

    // Safely get message
    let message = ''
    try {
      message = error.message || ''
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing message throws, use empty string
    }

    const cacheKey = `${constructorName}:${message}:${topFrame ?? 'no-stack'}`

    // Check cache first
    const cachedHash = hashCache.get(cacheKey)
    if (cachedHash) {
      return cachedHash
    }

    // Extract context
    const context = extractErrorContext(error)

    // Build components for the hash
    const components: string[] = [context.errorClass, context.sanitizedMessage]

    // Add top stack frame if available (reuse from cache key)
    if (topFrame) {
      components.push(topFrame)
    }

    // Generate hash from components
    const hashInput = components.join('::')
    const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16)

    // LRU cache management
    if (hashCache.size >= CACHE_MAX_SIZE) {
      const firstKey = hashCache.keys().next().value
      if (firstKey) hashCache.delete(firstKey)
    }

    // Store in cache
    hashCache.set(cacheKey, hash)

    return hash
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (hashError: unknown) {
    // Log the error for debugging but don't let it crash the error reporting
    // Using outputDebug would be better, but we can't import it here without circular dependency
    // So we'll silently handle the error and return a fallback

    // Return a fallback hash that still provides some grouping value
    const errorName = error?.constructor?.name || 'unknown'
    const timestamp = Date.now()
    return `fallback-${errorName}-${timestamp}`
  }
}

/**
 * Clears the internal hash cache. Useful for testing.
 */
export function clearHashCache(): void {
  hashCache.clear()
}
