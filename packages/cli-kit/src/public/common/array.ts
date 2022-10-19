/**
 * Takes a random value from an array.
 * @param array - Array from which we'll select a random item.
 * @returns A random element from the array.
 */
export function takeRandomFromArray<T>(array: T[]) {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Returns a copy of the array deleting the elemements that are undefined.
 * @param array - The array whose undefined will be deleted.
 * @returns A copy of the array with the undefined elements deleted.
 */
export function getArrayRejectingUndefined<T>(array: (T | undefined)[]): T[] {
  return array.filter((item) => item !== undefined) as Exclude<T, null | undefined>[]
}

/**
 * Returns true if an array contains duplicates.
 * @returns True if the array contains duplicates.
 */
export function getArrayContainsDuplicates<T>(array: T[]) {
  return array.length !== new Set(array).size
}
