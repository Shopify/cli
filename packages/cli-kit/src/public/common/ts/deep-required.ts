/**
 * Converts a mapping type to be non-optional.
 *
 * ```ts
 * type T = DeepRequired<{optionalKey?: string, nullableValue: string | null, undefinableValue: string | undefined}>
 * T = {optionalKey: string, nullableValue: string, undefinableValue: string}
 * ```
 *.
 */
export type DeepRequired<T> = {
  [TKey in keyof Required<T>]: NonNullable<Required<T>[TKey]>
}
