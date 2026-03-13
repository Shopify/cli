import React from 'react'
import {renderHook as rtlRenderHook, type RenderHookResult} from '@testing-library/react'

export type {RenderHookResult}

export function renderHook<TResult, TProviderProps extends object>(
  hook: () => TResult,
  Providers: React.ComponentType<React.PropsWithChildren<TProviderProps>> = ({children}) => <>{children}</>,
  options: Omit<TProviderProps, 'children'> = {} as TProviderProps,
): RenderHookResult<TResult, unknown> {
  return rtlRenderHook(hook, {
    wrapper: ({children}) => React.createElement(Providers, options as TProviderProps, children),
  })
}
