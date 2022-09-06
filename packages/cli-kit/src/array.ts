export function randomPick<T>(array: T[]) {
  return array[Math.floor(Math.random() * array.length)]
}

export function filterUndefined<T>(array: T[]) {
  return array.filter((item) => item !== undefined) as Exclude<T, null | undefined>[]
}

export function containsDuplicates<T>(array: T[]) {
  return array.length !== new Set(array).size
}
