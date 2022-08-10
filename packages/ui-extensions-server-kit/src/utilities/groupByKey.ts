export function groupByKey<T extends {[key: string]: unknown}>(key: keyof T, items: T[]): Map<T[keyof T], T> {
  return new Map(items.map((item) => [item[key], item]))
}
