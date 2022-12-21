import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Creates a function that memoizes the result of func. If resolver is provided it determines the cache key for
 * storing the result based on the arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is coerced to a string and used as the cache key. The func is invoked with
 * the this binding of the memoized function.
 *
 * @param func - The function to have its output memoized.
 * @param resolver - The function to resolve the cache key.
 * @returns Returns the new memoizing function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<T extends (...args: any) => any>(func: T, resolver?: (...args: Parameters<T>) => unknown): T {
  const memoize = require('lodash/memoize')
  return memoize(func, resolver)
}
