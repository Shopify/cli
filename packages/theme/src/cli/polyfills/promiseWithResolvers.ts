interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): PromiseWithResolvers<T>
  }
}

// Polyfill for Promise.withResolvers
// Can remove once our minimum supported Node version is 22
export function promiseWithResolvers<T>(): PromiseWithResolvers<T> {
  if (Promise.withResolvers) {
    return Promise.withResolvers<T>()
  }

  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return {promise, resolve, reject}
}
