import pRetry from 'p-retry'

export {AbortError} from 'p-retry'

type RetriedPromiseOptions = Parameters<typeof pRetry>[1]

export async function retriedPromise<T>(promise: () => T, options: RetriedPromiseOptions) {
  return pRetry(promise, options)
}
