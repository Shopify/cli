import {AbortError} from '../node/error.js'

/**
 * Safely parse JSON with helpful error messages.
 *
 * @param jsonString - The JSON string to parse.
 * @param context - Optional context about what's being parsed (e.g., file path, "API response").
 * @returns The parsed JSON object.
 * @throws AbortError if JSON is malformed.
 *
 * @example
 * // Parse with context
 * const data = parseJSON(jsonString, '/path/to/config.json')
 *
 * @example
 * // Parse without context
 * const data = parseJSON(jsonString)
 */
export function parseJSON<T = unknown>(jsonString: string, context?: string): T {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const contextMessage = context ? ` from ${context}` : ''
    throw new AbortError(`Failed to parse JSON${contextMessage}.\n${errorMessage}`)
  }
}
