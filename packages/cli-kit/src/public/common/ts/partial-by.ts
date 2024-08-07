/**
 * Make some properties of an object optional.
 *
 * ```ts
 * type Props = { a: number, b: string, c: boolean }
 * type PartialProps = PartialBy<Props, 'a' | 'b'>
 *
 * const props: PartialProps = { c: true } // 'a' and 'b' are optional, 'c' isn't
 * ```
 */
export type PartialBy<T, TKey extends keyof T> = Omit<T, TKey> & Partial<Pick<T, TKey>>
