import lodashUniqBy from 'lodash/uniqBy.js'
import lodashDifference from 'lodash/difference.js'
import type {List, ValueIteratee} from 'lodash'

/**
 * Takes a random value from an array.
 *
 * @param array - Array from which we'll select a random item.
 * @returns A random element from the array.
 */
export function takeRandomFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!
}

/**
 * Returns a copy of the array deleting the elemements that are undefined.
 *
 * @param array - The array whose undefined will be deleted.
 * @returns A copy of the array with the undefined elements deleted.
 */
export function getArrayRejectingUndefined<T>(array: (T | undefined)[]): T[] {
  return array.filter((item) => item !== undefined) as Exclude<T, null | undefined>[]
}

/**
 * Returns true if an array contains duplicates.
 *
 * @param array - The array to check against.
 * @returns True if the array contains duplicates.
 */
export function getArrayContainsDuplicates<T>(array: T[]): boolean {
  return array.length !== new Set(array).size
}

/**
 * Removes duplicated items from an array.
 *
 * @param array - The array to inspect.
 * @returns Returns the new duplicate free array.
 */
export function uniq<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * This method is like `_.uniq` except that it accepts `iteratee` which is
 * invoked for each element in `array` to generate the criterion by which
 * uniqueness is computed. The iteratee is invoked with one argument: (value).
 *
 * @param array - The array to inspect.
 * @param iteratee - The iteratee invoked per element.
 * @returns Returns the new duplicate free array.
 */
export function uniqBy<T>(array: List<T> | null | undefined, iteratee: ValueIteratee<T>): T[] {
  return lodashUniqBy(array, iteratee)
}

/**
 * Creates an array of `array` values not included in the other provided arrays using SameValueZero for
 * equality comparisons. The order and references of result values are determined by the first array.
 *
 * @param array - The array to inspect.
 * @param values - The arrays of values to exclude.
 * @returns Returns the new array of filtered values.
 */
export function difference<T>(array: List<T> | null | undefined, ...values: List<T>[]): T[] {
  return lodashDifference(array, ...values)
}
