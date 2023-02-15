/**
 * Produces a subset of a mapping type, where the keys either match some prefix string, or are in a list of exact matches.
 *
 * ```ts
 * type T = PickByPrefix<{foo_1: number, foo_2: number, nope: string, included: string, also: number}, 'foo_', 'included' | 'also'>.
 *
 * T = {foo_1: number, foo_2: number, included: string, also: number}
 * ```
 * .
 */
export type PickByPrefix<TMapping, TPrefix extends string, TKeys extends keyof TMapping = never> = {
  [TKey in keyof TMapping as TKey extends `${TPrefix}${infer _TSuffix}` | TKeys ? TKey : never]: TMapping[TKey]
}
