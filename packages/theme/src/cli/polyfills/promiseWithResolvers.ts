interface PromiseWithResolversResult<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

// Polyfill for Promise.withResolvers
// Can remove once our minimum supported Node version is 22
export function promiseWithResolvers<T>(): PromiseWithResolversResult<T> {
  // Use native implementation if available (Node 22+)
  const promiseConstructor = Promise as typeof Promise & {
    withResolvers?: <T>() => PromiseWithResolversResult<T>
  }

  if (typeof promiseConstructor.withResolvers === 'function') {
    return promiseConstructor.withResolvers<T>()
  }

  // Fallback for older Node versions
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return {promise, resolve, reject}
}
