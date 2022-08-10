import React from 'react'

export type ProviderComponent<TProps = unknown> = React.ComponentType<React.PropsWithChildren<TProps>>

export type Tail<T extends unknown[]> = T extends [head: unknown, ...tail: infer TRest] ? TRest : never

export type PropUnion<
  TProviders extends unknown[],
  TProps extends {[k: string]: unknown} = Empty,
> = TProviders[0] extends React.ComponentType<unknown>
  ? React.ComponentPropsWithoutRef<TProviders[0]> & PropUnion<Tail<TProviders>>
  : TProps

export interface Empty {}

export function withProviders<T extends ProviderComponent[]>(...providers: T): ProviderComponent<PropUnion<T>> {
  return function Providers({children, ...props}) {
    return providers.reduceRight(
      (childTree, Provider: ProviderComponent) => React.createElement(Provider, props, childTree),
      children,
    )
  }
}
