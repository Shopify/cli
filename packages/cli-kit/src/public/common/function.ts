import lodashMemoize from 'lodash/memoize.js'
import lodashDebounce from 'lodash/debounce.js'
import type {DebouncedFunc, DebounceSettings} from 'lodash'

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
  return lodashMemoize(func, resolver)
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since
 * the last time the debounced function was invoked. The debounced function comes with a cancel method to
 * cancel delayed invocations and a flush method to immediately invoke them. Provide an options object to
 * indicate that func should be invoked on the leading and/or trailing edge of the wait timeout. Subsequent
 * calls to the debounced function return the result of the last func invocation.
 *
 * Note: If leading and trailing options are true, func is invoked on the trailing edge of the timeout only
 * if the the debounced function is invoked more than once during the wait timeout.
 *
 * See David Corbacho’s article for details over the differences between _.debounce and _.throttle.
 *
 * @param func - The function to debounce.
 * @param wait - The number of milliseconds to delay.
 * @param options - The options object.
 * @returns Returns the new debounced function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any) => any>(
  func: T,
  wait?: number,
  options?: DebounceSettings,
): DebouncedFunc<T> {
  return lodashDebounce(func, wait, options)
}
