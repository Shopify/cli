export type PartialShallow<T> = {
  [P in keyof T]?: T[P] extends object ? object : T[P]
}
export type PropertyName = string | number | symbol
export type IterateeShorthand<T> = PropertyName | [PropertyName, unknown] | PartialShallow<T>
export type ValueIteratee<T> = ((value: T) => unknown) | IterateeShorthand<T>
export interface Dictionary<T> {
  [index: string]: T
}

export interface DebounceSettings {
  /**
   * @see _.leading
   */
  leading?: boolean | undefined
  /**
   * @see _.maxWait
   */
  maxWait?: number | undefined
  /**
   * @see _.trailing
   */
  trailing?: boolean | undefined
}

export interface DebouncedFunc<T extends (...args: unknown[]) => unknown> {
  /**
   * Call the original function, but applying the debounce rules.
   *
   * If the debounced function can be run immediately, this calls it and returns its return
   * value.
   *
   * Otherwise, it returns the return value of the last invocation, or undefined if the debounced
   * function was not invoked yet.
   */
  (...args: Parameters<T>): ReturnType<T> | undefined

  /**
   * Throw away any pending invocation of the debounced function.
   */
  cancel(): void

  /**
   * If there is a pending invocation of the debounced function, invoke it immediately and return
   * its return value.
   *
   * Otherwise, return the value from the last invocation, or undefined if the debounced function
   * was never invoked.
   */
  flush(): ReturnType<T> | undefined
}
