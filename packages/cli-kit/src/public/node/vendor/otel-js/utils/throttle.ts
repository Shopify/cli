type ThrottledFunction<T extends (...args: unknown[]) => unknown> = (...args: Parameters<T>) => ReturnType<T>

interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

/**
 *
 * @param func
 * @param wait
 * @param root0
 * @param root0.leading
 * @param root0.trailing
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  {leading = true, trailing = true}: ThrottleOptions = {},
): ThrottledFunction<T> {
  let lastArgs: Parameters<T> | null
  let result: ReturnType<T>
  let context: unknown
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0

  function later() {
    previous = leading === false ? 0 : Date.now()
    timeout = null
    if (lastArgs) {
      result = func.apply(context, lastArgs) as ReturnType<T>
      // If the throttled function returns a promise, swallow rejections to
      // prevent unhandled promise rejections (the caller already .catch()'d
      // the leading-edge invocation and has no reference to trailing calls).
      if (result && typeof (result as any).catch === 'function') {
        ;(result as any).catch(() => {})
      }
    }
    context = null
    lastArgs = null
  }

  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
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
        result = func.apply(context, lastArgs) as ReturnType<T>
      }
      context = null
      lastArgs = null
    } else if (!timeout && trailing !== false) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}
