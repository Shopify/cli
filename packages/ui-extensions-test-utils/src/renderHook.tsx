import React from 'react'
import {mount} from '@shopify/react-testing'

export interface HookWrapper<T> {
  result: T

  /**
   * Use to wrap calls to stateful hook methods:
   *
   * ```ts
   * const hook = testHook(() => useToggle(false))
   * expect(hook.result.value).toBe(false)
   * hook.act(() => hook.result.toggle())
   * expect(hook.result.value).toBe(true)
   * ```
   **/
  act<TR>(callback: (currentResult: T) => TR): TR
  forceUpdate(): void
}

function MountHook({callback}: {callback(): void}) {
  callback()
  return null
}

export function renderHook<T, TP>(
  hook: () => T,
  Providers: React.ComponentType<TP> = ({children}) => <>{children}</>,
  options: Omit<TP, 'children'> = {} as TP,
) {
  const hookResult: HookWrapper<T> = {} as any
  const wrapper = mount(
    <Providers {...(options as TP)}>
      <MountHook callback={() => (hookResult.result = hook())} />
    </Providers>,
  )

  return Object.assign<HookWrapper<T>, HookWrapper<T>>(hookResult, {
    result: hookResult.result,
    forceUpdate() {
      return wrapper.forceUpdate()
    },
    act(callback) {
      return wrapper.act(() => callback(hookResult.result))
    },
  })
}
