type ThrottledFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => ReturnType<T>

interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export function throttle<T extends (...args: any) => any>(
  func: T,
  wait: number,
  {leading = true, trailing = true}: ThrottleOptions = {},
): ThrottledFunction<T> {
  let lastArgs: Parameters<T> | null
  let result: ReturnType<T>
  let context: any
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0

  function later() {
    previous = leading === false ? 0 : Date.now()
    timeout = null
    if (lastArgs) {
      result = func.apply(context, lastArgs)
    }
    context = null
    lastArgs = null
  }

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const now = Date.now()
    if (!previous && leading === false) previous = now

    const remaining = wait - (now - previous)
    // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this
    context = this
    lastArgs = args
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      if (lastArgs) {
        result = func.apply(context, lastArgs)
      }
      context = null
      lastArgs = null
    } else if (!timeout && trailing !== false) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}
