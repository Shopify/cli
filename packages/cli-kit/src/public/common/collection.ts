import lodashGroupBy from 'lodash/groupBy.js'
import lodashPartition from 'lodash/partition.js'
import type {List, ValueIteratee} from 'lodash'

/**
 * Creates an object composed of keys generated from the results of running each element of collection through
 * iteratee. The corresponding value of each key is an array of the elements responsible for generating the
 * key. The iteratee is invoked with one argument: (value).
 *
 * @param collection - The collection to iterate over.
 * @param iteratee - The function invoked per iteration.
 * @returns Returns the composed aggregate object.
 */
export function groupBy<T>(
  collection: ArrayLike<T> | null | undefined,
  iteratee?: ValueIteratee<T>,
): {
  [index: string]: T[]
} {
  return lodashGroupBy(collection, iteratee)
}

/**
 * Creates an array of elements split into two groups, the first of which contains elements predicate returns truthy for,
 * while the second of which contains elements predicate returns falsey for.
 * The predicate is invoked with three arguments: (value, index|key, collection).
 *
 * @param collection - The collection to iterate over.
 * @param callback - The function called per iteration.
 * @returns Returns the array of grouped elements.
 */
export function partition<T>(collection: List<T> | null | undefined, callback: ValueIteratee<T>): [T[], T[]] {
  return lodashPartition(collection, callback)
}
