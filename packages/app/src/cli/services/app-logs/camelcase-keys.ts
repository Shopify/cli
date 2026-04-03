/**
 * Converts a string from snake_case or kebab-case to camelCase.
 */
function toCamelCase(str: string): string {
  const stripped = str.replace(/^[-_]+/, '')
  if (!stripped.includes('_') && !stripped.includes('-')) return stripped
  const parts = stripped.split(/[-_]+/).filter(Boolean)
  if (parts.length === 0) return stripped
  return (
    parts[0]!.toLowerCase() +
    parts
      .slice(1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('')
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function transformValue(value: unknown, options?: {deep?: boolean}): unknown {
  if (options?.deep && isPlainObject(value)) return camelcaseKeys(value, options)
  if (options?.deep && Array.isArray(value)) return camelcaseKeys(value, options)
  return value
}

/**
 * Converts object keys from snake_case/kebab-case to camelCase.
 * Drop-in replacement for the camelcase-keys npm package.
 *
 * @param input - Object or array to transform.
 * @param options - Options object. Set deep: true for recursive transformation.
 * @returns A new object/array with camelCased keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function camelcaseKeys<T = any>(input: T, options?: {deep?: boolean}): T {
  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return input.map((item) => (options?.deep ? camelcaseKeys(item, options) : item)) as any
  }

  if (isPlainObject(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(input)) {
      result[toCamelCase(key)] = transformValue(value, options)
    }
    return result as T
  }

  return input
}
