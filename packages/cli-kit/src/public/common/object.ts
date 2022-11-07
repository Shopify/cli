import deepMerge from 'deepmerge'

/**
 * Deep merges the two objects and returns a new object with the merge result.
 *
 * @param lhs - One of the objects to be merged.
 * @param rhs - Another object to be merged.
 * @param arrayMergeStrategy - Strategy used to merge the array typed fields. Union strategy is used by default to avoid
 * duplicated elements.
 * @returns A Javascrip tobject with th emerged objects.
 */
export function deepMergeObjects<T1, T2>(
  lhs: Partial<T1>,
  rhs: Partial<T2>,
  arrayMergeStrategy: (destinationArray: unknown[], sourceArray: unknown[]) => unknown[] = unionArrayStrategy,
): T1 & T2 {
  return deepMerge(lhs, rhs, {arrayMerge: arrayMergeStrategy})
}

function unionArrayStrategy(destinationArray: unknown[], sourceArray: unknown[]): unknown[] {
  return Array.from(new Set([...destinationArray, ...sourceArray]))
}
