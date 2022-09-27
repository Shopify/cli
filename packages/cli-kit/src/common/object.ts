import deepMerge from 'deepmerge'

/**
 * Deep merges the two objects and returns a new object
 * with the merge result.
 * @param lhs {any} One of the objects to be merged.
 * @param rhs {any} Another object to be merged.
 * @returns {any} A Javascrip tobject with th emerged objects.
 */
export function deepMergeObjects<T1, T2>(lhs: Partial<T1>, rhs: Partial<T2>): T1 & T2 {
  return deepMerge(lhs, rhs)
}
