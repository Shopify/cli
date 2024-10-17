/* eslint-disable @typescript-eslint/no-empty-interface */
import React from 'react'

export type ProviderComponent<TProps = any> = React.ComponentType<React.PropsWithChildren<TProps>>

export type Tail<T extends any[]> = T extends [head: any, ...tail: infer TRest] ? TRest : never

export type PropUnion<
  TProviders extends any[],
  TProps extends {[k: string]: any} = Empty,
> = TProviders[0] extends React.ComponentType<any>
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
