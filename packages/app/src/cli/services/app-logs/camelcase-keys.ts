import {camelize} from '@shopify/cli-kit/common/string'

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
      result[camelize(key)] = transformValue(value, options)
    }
    return result as T
  }

  return input
}
