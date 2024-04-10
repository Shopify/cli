/* eslint-disable @typescript-eslint/no-explicit-any */
type OverloadProps<TOverload> = Pick<TOverload, keyof TOverload>

// Prevent infinite recursion by stopping recursion when TPartialOverload
// has accumulated all of the TOverload signatures.
type OverloadUnionRecursive<TOverload, TPartialOverload = unknown> = TOverload extends (
  ...args: infer TArgs
) => infer TReturn
  ? TPartialOverload extends TOverload
    ? never
    :
        | OverloadUnionRecursive<
            TPartialOverload & TOverload,
            TPartialOverload & ((...args: TArgs) => TReturn) & OverloadProps<TOverload>
          >
        | ((...args: TArgs) => TReturn)
  : never

// The "() => never" signature must be hoisted to the "front" of the
// intersection, for two reasons: a) because recursion stops when it is
// encountered, and b) it seems to prevent the collapse of subsequent
// "compatible" signatures (eg. "() => void" into "(a?: 1) => void"),
// which gives a direct conversion to a union.
type OverloadUnion<TOverload extends (...args: any[]) => any> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>

// Inferring a union of parameter tuples or return types is now possible.
export type OverloadParameters<T extends (...args: any[]) => any> = Parameters<OverloadUnion<T>>
