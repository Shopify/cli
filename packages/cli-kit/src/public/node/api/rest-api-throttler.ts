import {RestResponse} from './admin.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'

const MAX_NUMBER_OF_PARALLEL_REQUESTS = 5
const MARGIN_TO_RATE_LIMIT = 5

const DELAY_FOR_TOO_MANY_PARALLEL_REQUESTS = 1000
const DELAY_FOR_TOO_CLOSE_TO_API_LIMIT = 4000

const THEME_CONTEXT = 'theme'

/**
 * Throttles a provided action, limiting the number of globally parallel requests, or by the last seen API limit
 * headers.
 *
 * @param request - A function performing a request.
 * @returns - The result of the request, once it eventually runs.
 */
export async function throttle<T>(request: () => T): Promise<T> {
  return new Promise<T>((resolve, _reject) => {
    const performRequest = () => {
      throttlingState(THEME_CONTEXT).requestCounter += 1
      resolve(request())
    }

    /**
     * Performs the request taking into account the
     * limit of parallel requests only when the API limit has not
     * been reached.
     *
     * Otherwise, performs the request to get the updated API limit
     * headers, so throttler parameters get updates.
     */
    const throttleByHeader = () => {
      if (isReachingApiLimit()) {
        setTimeout(() => {
          throttleByParallelCounter(performRequest)
        }, DELAY_FOR_TOO_CLOSE_TO_API_LIMIT)
      } else {
        throttleByParallelCounter(performRequest)
      }
    }

    /**
     * Performs the command only when the the limit
     * of parallel request has not been reached.
     *
     * Otherwise, defers the execution to the throttle by rate-limit function,
     * still respecting the limit of parallel requests.
     *
     * @param command - The action to execute.
     */
    const throttleByParallelCounter = (command: () => void) => {
      if (hasTooManyRequests()) {
        setTimeout(() => {
          throttleByParallelCounter(throttleByHeader)
        }, DELAY_FOR_TOO_MANY_PARALLEL_REQUESTS)
      } else {
        command()
      }
    }

    /**
     * Start throttling by counter to get the API limit headers.
     */
    throttleByParallelCounter(throttleByHeader)
  }).finally(() => {
    throttlingState(THEME_CONTEXT).requestCounter -= 1
  })
}

/**
 * Keep track of the latest API call limit data from a response.
 *
 * @param response - The response object.
 */
export function updateApiCallLimitFromResponse(response: RestResponse): void {
  const callLimit = extractApiCallLimitFromResponse(response)

  if (!callLimit) {
    return
  }

  const [used, limit] = callLimit

  latestRequestInfo().apiCallLimit = {used, limit}
}

function hasTooManyRequests() {
  return throttlingState(THEME_CONTEXT).requestCounter > MAX_NUMBER_OF_PARALLEL_REQUESTS
}

function isReachingApiLimit() {
  const {used, limit} = latestRequestInfo().apiCallLimit
  return used >= limit - MARGIN_TO_RATE_LIMIT
}

function latestRequestInfo() {
  return throttlingState(THEME_CONTEXT).latestRequestInfo
}

/**
 * Even considering the Stateless modules convention,
 * tracking information about the latest request is
 * critical to optimize the request throttler efficiently.
 *
 * Thus, in this case, this module deliberately avoids
 * IO cost and uses the `_throttlingState` instance for
 * that purpose.
 *
 * A context option is used if multiple APIs are using these capabilities.
 *
 * @param context - The context which we're tracking throttle state within.
 */
function throttlingState(context: string): ThrottlingState {
  const stateForContext = _throttlingState[context]
  if (stateForContext === undefined) {
    const startingState = {
      requestCounter: 0,
      latestRequestInfo: {
        apiCallLimit: {used: 0, limit: 40},
      },
    }
    _throttlingState[context] = startingState
    return startingState
  } else {
    return stateForContext
  }
}

interface ThrottlingState {
  /**
   * Number of parallel requests.
   */
  requestCounter: number

  /**
   * Latest request information.
   */
  latestRequestInfo: {
    apiCallLimit: {used: number; limit: number}
  }
}

const _throttlingState: {
  [context: string]: ThrottlingState
} = {}

function extractRetryDelayMsFromResponse(response: RestResponse): number {
  const retryAfterStr = header(response, 'retry-after')
  const retryAfter = tryParseInt(retryAfterStr)

  if (!retryAfter) {
    return 0
  }

  return retryAfter
}

/**
 * Retries an operation after a delay specified in the response headers.
 *
 * @param response - The response object.
 * @param operation - The operation to retry.
 * @returns - The response of the operation.
 */
export async function delayAwareRetry(
  response: RestResponse,
  operation: () => Promise<RestResponse>,
): Promise<RestResponse> {
  const retryDelay = extractRetryDelayMsFromResponse(response)
  return new Promise((resolve, _reject) => {
    setTimeout(() => {
      resolve(operation())
    }, retryDelay)
  })
}

function extractApiCallLimitFromResponse(response: RestResponse): [number, number] | undefined {
  const apiCallLimit = header(response, 'x-shopify-shop-api-call-limit')

  const [used, limit] = apiCallLimit
    .split('/')
    .map((num) => tryParseInt(num))
    .filter(Boolean)

  if (!used || !limit) {
    return
  }

  return [used, limit]
}

function header(response: RestResponse, name: string): string {
  const headers = response.headers
  const header = headers[name]

  if (header?.length === 1) {
    return header[0] ?? ''
  }

  return ''
}

if (import.meta.vitest) {
  const {describe, test, expect, beforeEach} = import.meta.vitest
  let response: RestResponse

  beforeEach(() => {
    response = {
      json: {},
      status: 200,
      headers: {},
    }
  })

  describe('retryAfter', () => {
    test('when the "retry-after" header value is valid', async () => {
      // Given
      response.headers = {
        'retry-after': ['2.0'],
      }

      // When
      const retryAfterDelay = extractRetryDelayMsFromResponse(response)

      // Then
      expect(retryAfterDelay).toBe(2)
    })

    test('when the "retry-after" header value is not present', async () => {
      // Given
      response.headers = {
        'retry-after': [],
      }

      // When
      const retryAfterDelay = extractRetryDelayMsFromResponse(response)

      // Then
      expect(retryAfterDelay).toBe(0)
    })

    test('when the "retry-after" header value is valid', async () => {
      // Given
      response.headers = {
        'retry-after': ['invalid'],
      }

      // When
      const retryAfterDelay = extractRetryDelayMsFromResponse(response)

      // Then
      expect(retryAfterDelay).toBe(0)
    })

    test('when the "retry-after" header is not present', async () => {
      // Given
      response.headers = {}

      // When
      const retryAfterDelay = extractRetryDelayMsFromResponse(response)

      // Then
      expect(retryAfterDelay).toBe(0)
    })
  })

  describe('apiCallLimit', () => {
    test('when the "x-shopify-shop-api-call-limit" header is valid', async () => {
      // Given
      response.headers = {
        'x-shopify-shop-api-call-limit': ['10/40'],
      }

      // When
      const callLimit = extractApiCallLimitFromResponse(response)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const [used, limit] = callLimit!

      // Then
      expect(used).toBe(10)
      expect(limit).toBe(40)
    })

    test('when the "x-shopify-shop-api-call-limit" header is invalid', async () => {
      // Given
      response.headers = {
        'x-shopify-shop-api-call-limit': ['foo/bar'],
      }

      // When
      const callLimit = extractApiCallLimitFromResponse(response)

      // Then
      expect(callLimit).toBeUndefined()
    })

    test('when the "x-shopify-shop-api-call-limit" header is not formatted as expected', async () => {
      // Given
      response.headers = {
        'x-shopify-shop-api-call-limit': ['/10'],
      }

      // When
      const callLimit = extractApiCallLimitFromResponse(response)

      // Then
      expect(callLimit).toBeUndefined()
    })
  })
}
