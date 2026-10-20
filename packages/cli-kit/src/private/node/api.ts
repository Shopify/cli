import {sanitizedHeadersOutput} from './api/headers.js'
import {sanitizeURL} from './api/urls.js'
import {graphQLErrorCodes, isRateLimitCode} from './analytics/graphql-error-codes.js'
import {sleepWithBackoffUntil} from './sleep-with-backoff.js'
import {outputDebug} from '../../public/node/output.js'
import {recordRetry} from '../../public/node/analytics.js'

import {Headers} from 'form-data'
import {ClientError} from 'graphql-request'

import {performance} from 'perf_hooks'

export type API = 'admin' | 'storefront-renderer' | 'partners' | 'business-platform' | 'app-management'

export const allAPIs: API[] = ['admin', 'storefront-renderer', 'partners', 'business-platform', 'app-management']

const DEFAULT_RETRY_DELAY_MS = 1000
const DEFAULT_RETRY_LIMIT = 10
const MAX_THROTTLE_RETRY_DELAY_MS = 8000
const MAX_THROTTLE_RETRY_TIME_MS = 30_000

export type NetworkRetryBehaviour =
  | {
      useNetworkLevelRetry: true
      maxRetryTimeMs: number
      recordCommandRetries?: boolean
    }
  | {
      useNetworkLevelRetry: false
      recordCommandRetries?: boolean
    }

type RequestOptions<T> = {
  request: () => Promise<T>
  url: string
} & NetworkRetryBehaviour

const interestingResponseHeaders = new Set([
  'cache-control',
  'content-type',
  'etag',
  'x-request-id',
  'server-timing',
  'retry-after',
])

function responseHeaderIsInteresting(header: string): boolean {
  return interestingResponseHeaders.has(header)
}

interface CommonResponse {
  duration: number
  sanitizedHeaders: string
  sanitizedUrl: string
  requestId?: string
}

type OkResponse<T> = CommonResponse & {status: 'ok'; response: T}
type ClientErrorResponse = CommonResponse & {status: 'client-error'; clientError: ClientError}
type UnknownErrorResponse = CommonResponse & {status: 'unknown-error'; error: unknown}
type CanRetryErrorResponse = CommonResponse & {
  status: 'can-retry'
  clientError: ClientError
  delayMs: number | undefined
}
type UnauthorizedErrorResponse = CommonResponse & {
  status: 'unauthorized'
  clientError: ClientError
  delayMs: number | undefined
}

type VerboseResponse<T> =
  | OkResponse<T>
  | ClientErrorResponse
  | UnknownErrorResponse
  | CanRetryErrorResponse
  | UnauthorizedErrorResponse

/**
 * Checks if an error is a transient network error that is likely to recover with retries.
 *
 * Use this function for retry logic. Use isNetworkError for error classification.
 *
 * Examples of transient errors (worth retrying):
 * - Connection timeouts, resets, and aborts
 * - DNS failures (enotfound, getaddrinfo, eai_again) - can be temporary
 * - Socket disconnects and hang ups
 * - Premature connection closes
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const transientErrorMessages = [
      'socket hang up',
      'econnreset',
      'econnaborted',
      'enotfound',
      'enetunreach',
      'network socket disconnected',
      'etimedout',
      'econnrefused',
      'eai_again',
      'epipe',
      'the operation was aborted',
      'timeout',
      'premature close',
      'getaddrinfo',
    ]
    const errorMessage = error.message.toLowerCase()
    const anyMatches = transientErrorMessages.some((issueMessage) => errorMessage.includes(issueMessage))
    const missingReason = /^request to .* failed, reason:\s*$/.test(errorMessage)
    return anyMatches || missingReason
  }
  return false
}

/**
 * Checks if an error is any kind of network-related error (connection issues, timeouts, DNS failures,
 * TLS/certificate errors, etc.) rather than an application logic error.
 *
 * These errors should be reported as user-facing errors (AbortError) rather than bugs (BugError),
 * regardless of whether they are transient or permanent.
 *
 * Examples include:
 * - Transient: connection timeouts, socket hang ups, temporary DNS failures
 * - Permanent: certificate validation failures, misconfigured SSL
 */
export function isNetworkError(error: unknown): boolean {
  // First check if it's a transient network error
  if (isTransientNetworkError(error)) {
    return true
  }

  // Then check for permanent network errors (SSL/TLS/certificate issues)
  if (error instanceof Error) {
    const permanentNetworkErrorMessages = ['certificate', 'cert', 'tls', 'ssl', 'altnames']
    const errorMessage = error.message.toLowerCase()
    return permanentNetworkErrorMessages.some((issueMessage) => errorMessage.includes(issueMessage))
  }

  return false
}

/**
 * Lower-cased substrings that mean a request was aborted rather than failing on its own.
 * `node-fetch` says 'The user aborted a request.', undici says 'This operation was aborted', and
 * cli-kit's own request timeout says 'The operation was aborted'.
 */
const ABORTED_FETCH_MESSAGE_FRAGMENTS = ['the user aborted a request', 'operation was aborted'] as const

/**
 * Checks if an error is an aborted request: a user cancelling the command, the host process
 * cancelling it, or one of the CLI's own request timeouts firing.
 *
 * Not used by the retry logic, because a user-cancelled request must not be retried.
 * `isTransientNetworkError` separately matches the CLI's own timeout message, so timeouts do
 * still retry.
 *
 * The `name` check matches the `AbortError` shape that fetch throws, not cli-kit's own
 * `AbortError`, which leaves `name` as 'Error'.
 *
 * @param error - Error to be checked.
 * @returns A boolean indicating if the request was aborted.
 */
export function isAbortedFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  const errorMessage = error.message.toLowerCase()
  return ABORTED_FETCH_MESSAGE_FRAGMENTS.some((fragment) => errorMessage.includes(fragment))
}

async function runRequestWithNetworkLevelRetry<T extends {headers: Headers; status: number}>(
  requestOptions: RequestOptions<T>,
): Promise<T> {
  if (!requestOptions.useNetworkLevelRetry) {
    return requestOptions.request()
  }

  let lastSeenError: unknown

  for await (const _delayMs of sleepWithBackoffUntil(requestOptions.maxRetryTimeMs)) {
    try {
      return await requestOptions.request()
    } catch (err) {
      lastSeenError = err
      if (!isTransientNetworkError(err)) {
        throw err
      }

      // Record command retries
      if (requestOptions.recordCommandRetries) {
        recordRetry(requestOptions.url, `network-retry:${(err as Error).message}`)
      }

      outputDebug(`Retrying request to ${requestOptions.url} due to network error ${err}`)
    }
  }
  throw lastSeenError
}

async function makeVerboseRequest<T extends {headers: Headers; status: number}>(
  requestOptions: RequestOptions<T>,
): Promise<VerboseResponse<T>> {
  const t0 = performance.now()
  let duration = 0
  const responseHeaders: Record<string, string> = {}
  const sanitizedUrl = sanitizeURL(requestOptions.url)
  let response: T = {} as T
  try {
    response = await runRequestWithNetworkLevelRetry(requestOptions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.headers.forEach((value: any, key: any) => {
      if (responseHeaderIsInteresting(key)) responseHeaders[key] = value
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    const t1 = performance.now()
    duration = Math.round(t1 - t0)

    if (err instanceof ClientError) {
      if (err.response.headers) {
        for (const [key, value] of err.response.headers as Iterable<[string, string]>) {
          if (responseHeaderIsInteresting(key)) responseHeaders[key] = value
        }
      }
      const sanitizedHeaders = sanitizedHeadersOutput(responseHeaders)

      if (isThrottled(err)) {
        return {
          status: 'can-retry',
          clientError: err,
          duration,
          sanitizedHeaders,
          sanitizedUrl,
          requestId: responseHeaders['x-request-id'],
          delayMs: retryAfterDelayMs(responseHeaders['retry-after']),
        }
      } else if (err.response.status === 401) {
        return {
          status: 'unauthorized',
          clientError: err,
          duration,
          sanitizedHeaders,
          sanitizedUrl,
          requestId: responseHeaders['x-request-id'],
          delayMs: 500,
        }
      }

      return {
        status: 'client-error',
        clientError: err,
        duration,
        sanitizedHeaders,
        sanitizedUrl,
        requestId: responseHeaders['x-request-id'],
      }
    }
    return {
      status: 'unknown-error',
      error: err,
      duration,
      sanitizedHeaders: sanitizedHeadersOutput(responseHeaders),
      sanitizedUrl,
      requestId: responseHeaders['x-request-id'],
    }
  }
  const t1 = performance.now()
  duration = Math.round(t1 - t0)
  return {
    status: 'ok',
    response,
    duration,
    sanitizedHeaders: sanitizedHeadersOutput(responseHeaders),
    sanitizedUrl,
    requestId: responseHeaders['x-request-id'],
  }
}

// Partial data can include a successful mutation. Only retry fully rejected requests.
function isThrottled(error: ClientError): boolean {
  if (error.response.data != null) return false
  const httpRateLimited = error.response.status === 429
  const errors = error.response.errors
  if (!Array.isArray(errors) || errors.length === 0) return httpRateLimited
  return errors.every((entry) => {
    const codes = graphQLErrorCodes([entry])
    return (codes.length > 0 || httpRateLimited) && codes.every(isRateLimitCode)
  })
}

function retryAfterDelayMs(retryAfter: string | undefined): number | undefined {
  const value = retryAfter?.trim()
  if (!value) return undefined

  const seconds = Number(value)
  if (!Number.isNaN(seconds)) {
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined
  }

  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? undefined : Math.max(0, retryAt - Date.now())
}

export async function simpleRequestWithDebugLog<T extends {headers: Headers; status: number}>(
  requestOptions: RequestOptions<T>,
  errorHandler?: (error: unknown, requestId: string | undefined) => unknown,
): Promise<T> {
  const result = await makeVerboseRequest(requestOptions)

  outputDebug(`Request to ${result.sanitizedUrl} completed in ${result.duration} ms
With response headers:
${result.sanitizedHeaders}
    `)

  switch (result.status) {
    case 'ok': {
      return result.response
    }
    case 'client-error': {
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
    case 'unknown-error': {
      if (errorHandler) {
        throw errorHandler(result.error, result.requestId)
      } else {
        throw result.error
      }
    }
    case 'can-retry': {
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
    case 'unauthorized': {
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
  }
}

/**
 * Makes a HTTP request to some API, retrying if response headers indicate a retryable error.
 *
 * If a request fails with a 429, the retry-after header determines a delay before an automatic retry is performed.
 * Without a valid header, rate-limit retries use exponential backoff with jitter, capped at 8 seconds per delay.
 * No new rate-limit retry starts after 30 seconds. A server-requested delay beyond that budget is not shortened.
 *
 * If unauthorizedHandler is provided, then it will be called in the case of a 401 and a retry performed. This allows
 * for a token refresh for instance.
 *
 * If there's a network error, e.g. DNS fails to resolve, then API calls are automatically retried.
 *
 * @param request - A function that returns a promise of the response
 * @param url - The URL to request
 * @param errorHandler - A function that handles errors
 * @param unauthorizedHandler - A function that handles unauthorized errors
 * @param retryOptions - Options for the retry
 * @returns The response from the request
 */
export async function retryAwareRequest<T extends {headers: Headers; status: number}>(
  requestOptions: RequestOptions<T>,
  errorHandler?: (error: unknown, requestId: string | undefined) => unknown,
  retryOptions: {
    limitRetriesTo?: number
    defaultDelayMs?: number
    scheduleDelay: (fn: () => void, delay: number) => void
  } = {
    scheduleDelay: setTimeout,
  },
): Promise<T> {
  let retriesUsed = 0
  const limitRetriesTo = retryOptions.limitRetriesTo ?? DEFAULT_RETRY_LIMIT

  let result = await makeVerboseRequest(requestOptions)
  const retryDeadline = performance.now() + MAX_THROTTLE_RETRY_TIME_MS

  outputDebug(`Request to ${result.sanitizedUrl} completed in ${result.duration} ms
With response headers:
${result.sanitizedHeaders}
    `)

  while (true) {
    if (result.status === 'ok') {
      if (retriesUsed > 0) {
        outputDebug(`Request to ${result.sanitizedUrl} succeeded after ${retriesUsed} retries`)
      }
      return result.response
    } else if (result.status === 'client-error') {
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    } else if (result.status === 'unknown-error') {
      if (errorHandler) {
        throw errorHandler(result.error, result.requestId)
      } else {
        throw result.error
      }
    } else if (result.status === 'unauthorized') {
      throw result.clientError
    }

    const maximumDelayMs = Math.min(
      (retryOptions.defaultDelayMs ?? DEFAULT_RETRY_DELAY_MS) * 2 ** retriesUsed,
      MAX_THROTTLE_RETRY_DELAY_MS,
    )
    const retryDelayMs = result.delayMs ?? Math.floor(maximumDelayMs * (0.5 + Math.random() / 2))
    if (limitRetriesTo <= retriesUsed || retryDelayMs >= retryDeadline - performance.now()) {
      outputDebug(
        `Rate-limit retry budget exhausted after ${retriesUsed} retries for request to ${result.sanitizedUrl}`,
      )
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
    retriesUsed += 1

    // Record command retries
    if (requestOptions.recordCommandRetries) {
      recordRetry(requestOptions.url, `http-retry-${retriesUsed}:${result.status}:`)
    }

    outputDebug(`Scheduling retry request #${retriesUsed} to ${result.sanitizedUrl} in ${retryDelayMs} ms`)

    const previousResult = result
    // eslint-disable-next-line no-await-in-loop
    result = await new Promise<VerboseResponse<T>>((resolve) => {
      retryOptions.scheduleDelay(() => {
        resolve(performance.now() < retryDeadline ? makeVerboseRequest(requestOptions) : previousResult)
      }, retryDelayMs)
    })
  }
}
