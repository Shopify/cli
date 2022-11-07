import React from 'react'
import {mount} from '@shopify/react-testing'

export function render<TProps, TProviderProps>(
  element: React.ReactElement<TProps>,
  Providers: React.ComponentType<TProviderProps> = ({children}) => <>{children}</>,
  options: Omit<TProviderProps, 'children'> = {} as TProviderProps,
) {
  return mount(<Providers {...(options as TProviderProps)}>{element}</Providers>)
}
