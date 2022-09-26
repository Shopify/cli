import deepMerge from 'deepmerge'

/**
 * Deep merges the two objects and returns a new object
 * with the merge result.
 * @param lhs {any} One of the objects to be merged.
 * @param rhs {any} Another object to be merged.
 * @returns {any} A Javascrip tobject with th emerged objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMergeObjects(lhs: any, rhs: any): any {
  return deepMerge(lhs, rhs)
}
