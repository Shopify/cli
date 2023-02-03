const MAX_NUMBER_OF_PARALLEL_REQUESTS = 5
const MARGIN_TO_RATE_LIMIT = 5

export async function throttle<T>(request: () => T) {
  return new Promise<T>((resolve, _reject) => {
    const performRequest = () => {
      throttlingState().requestCounter += 1
      resolve(request())
    }

    /**
     * Performs the {@link performRequest} taking into account the
     * limit of parallel requests only when the API limit has not
     * been reached.
     *
     * Otherwise, performs the request to get the updated API limit
     * headers, so throttler parameters get updates.
     */
    const throttleByHeader = () => {
      if (!isReachingApiLimit()) {
        throttleByCounter(performRequest)
        return
      }

      setTimeout(() => throttleByCounter(performRequest), 4000)
    }

    /**
     * Performs the {@link command} only when the the limit
     * of parallel request has not been reached.
     *
     * Otherwise, defers the execution to the {@link throttleByHeader},
     * still respecting the limit of parallel requests.
     */
    const throttleByCounter = (command: () => void) => {
      if (!hasTooManyRequests()) {
        command()
        return
      }

      setTimeout(() => throttleByCounter(throttleByHeader), 1000)
    }

    /**
     * Start throttling by counter to get the API limit headers.
     */
    throttleByCounter(throttleByHeader)
  }).finally(() => {
    throttlingState().requestCounter -= 1
  })
}

export function updateApiCallLimit(callLimit: [number, number] | undefined) {
  if (!callLimit) {
    return
  }

  const [used, limit] = callLimit

  latestRequestInfo().apiCallLimit = {used, limit}
}

function hasTooManyRequests() {
  return throttlingState().requestCounter > MAX_NUMBER_OF_PARALLEL_REQUESTS
}

function isReachingApiLimit() {
  const {used, limit} = latestRequestInfo().apiCallLimit
  return used >= limit - MARGIN_TO_RATE_LIMIT
}

function latestRequestInfo() {
  return throttlingState().latestRequestInfo
}

/**
 * Even considering the Stateless modules convention,
 * tracking information about the latest request is
 * critical to optimize the request throttler efficiently.
 *
 * Thus, in this case, this module deliberately avoids
 * IO cost and uses the `_throttlingState` instance for
 * that purpose.
 */
function throttlingState() {
  return (
    _throttlingState ??
    (_throttlingState = {
      requestCounter: 0,
      latestRequestInfo: {
        apiCallLimit: {used: 0, limit: 40},
      },
    })
  )
}

let _throttlingState: {
  /**
   * Number of parallel requests */
  requestCounter: number

  /**
   * Latest request information */
  latestRequestInfo: {
    apiCallLimit: {used: number; limit: number}
  }
}
