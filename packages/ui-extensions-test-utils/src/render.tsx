import React from 'react'
import {render as rtlRender, type RenderResult} from '@testing-library/react'

export type {RenderResult}

export function render<TProviderProps extends object>(
  element: React.ReactElement,
  Providers: React.ComponentType<React.PropsWithChildren<TProviderProps>> = ({children}) => <>{children}</>,
  options: Omit<TProviderProps, 'children'> = {} as TProviderProps,
): RenderResult {
  return rtlRender(element, {
    wrapper: ({children}) => React.createElement(Providers, options as TProviderProps, children),
  })
}
