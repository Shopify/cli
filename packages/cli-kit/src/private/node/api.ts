import {sanitizedHeadersOutput} from './api/headers.js'
import {isGatewayErrorStatus} from './api/gateway-status.js'
import {sanitizeURL} from './api/urls.js'
import {hasRateLimitCode} from './analytics/graphql-error-codes.js'
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

/**
 * Gateway errors on idempotent requests get a much smaller retry budget than rate limits. A 429
 * response tells us exactly how long to wait, whereas a 502/503/504 means an upstream is already
 * struggling and should not be hit ten more times on its way down.
 */
const GATEWAY_ERROR_RETRY_LIMIT = 3

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
  requestIsIdempotent?: boolean
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

function retryDelayMsFromHeaders(responseHeaders: Record<string, string>): number | undefined {
  const retryAfter = responseHeaders['retry-after']
  if (!retryAfter) return undefined

  const delayMs = Number.parseInt(retryAfter, 10)
  return Number.isNaN(delayMs) ? undefined : delayMs
}

interface CommonResponse {
  duration: number
  sanitizedHeaders: string
  sanitizedUrl: string
  requestId?: string
}

type OkResponse<T> = CommonResponse & {status: 'ok'; response: T}

/**
 * `'client-error'` names the graphql-request `ClientError` wrapper, not an HTTP 4xx: it is the
 * terminal bucket for every status that is not classified as retryable or unauthorized below.
 */
type ClientErrorResponse = CommonResponse & {status: 'client-error'; clientError: ClientError}
type UnknownErrorResponse = CommonResponse & {status: 'unknown-error'; error: unknown}

/** Why a response was classified as retryable, so each cause can carry its own retry budget. */
type RetryReason = 'rate-limit' | 'gateway-error'

type CanRetryErrorResponse = CommonResponse & {
  status: 'can-retry'
  retryReason: RetryReason
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
      // A `ClientError` means the request reached the API and came back with a response, so it is
      // never a connection-level failure. It must not be matched by message text: a ClientError's
      // message embeds `JSON.stringify({response, request})`, so the request's own query and
      // variables are part of the string `isTransientNetworkError` searches. A theme asset
      // containing `setTimeout` matches `'timeout'` and used to make a 502 on the
      // `ThemeFilesUpsert` mutation retry here, non-idempotently, purely because of the file's
      // contents. Retryable statuses are classified deliberately in `makeVerboseRequest` instead,
      // where the idempotency of the request is known.
      if (err instanceof ClientError || !isTransientNetworkError(err)) {
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
          retryReason: 'rate-limit',
          clientError: err,
          duration,
          sanitizedHeaders,
          sanitizedUrl,
          requestId: responseHeaders['x-request-id'],
          delayMs: retryDelayMsFromHeaders(responseHeaders),
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
      } else if (requestOptions.requestIsIdempotent && isGatewayErrorStatus(err.response.status)) {
        return {
          status: 'can-retry',
          retryReason: 'gateway-error',
          clientError: err,
          duration,
          sanitizedHeaders,
          sanitizedUrl,
          requestId: responseHeaders['x-request-id'],
          delayMs: retryDelayMsFromHeaders(responseHeaders),
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

// Shopify GraphQL APIs signal rate limiting with `extensions.code` set to
// `THROTTLED` (often on a 200 response) or `429` — the same codes that
// crash-report suppression and analytics grouping already treat as rate
// limiting via this shared helper.
function isThrottled(error: ClientError): boolean {
  if (error.response.status === 429) {
    return true
  }
  return hasRateLimitCode(error.response.errors)
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
  let gatewayRetriesUsed = 0
  const limitRetriesTo = retryOptions.limitRetriesTo ?? DEFAULT_RETRY_LIMIT

  let result = await makeVerboseRequest(requestOptions)

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

    const gatewayBudgetExhausted =
      result.retryReason === 'gateway-error' && GATEWAY_ERROR_RETRY_LIMIT <= gatewayRetriesUsed
    if (limitRetriesTo <= retriesUsed || gatewayBudgetExhausted) {
      const exhaustedLimit = gatewayBudgetExhausted ? GATEWAY_ERROR_RETRY_LIMIT : limitRetriesTo
      outputDebug(`${exhaustedLimit} retries exhausted for request to ${result.sanitizedUrl}`)
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
    retriesUsed += 1
    if (result.retryReason === 'gateway-error') {
      gatewayRetriesUsed += 1
    }

    // Record command retries
    if (requestOptions.recordCommandRetries) {
      recordRetry(requestOptions.url, `http-retry-${retriesUsed}:${result.status}:`)
    }

    // prefer to wait based on a header if given; the caller's preference if not; and a default if neither.
    const retryDelayMs = result.delayMs ?? retryOptions.defaultDelayMs ?? DEFAULT_RETRY_DELAY_MS
    outputDebug(`Scheduling retry request #${retriesUsed} to ${result.sanitizedUrl} in ${retryDelayMs} ms`)

    // eslint-disable-next-line no-await-in-loop
    result = await new Promise<VerboseResponse<T>>((resolve) => {
      retryOptions.scheduleDelay(() => {
        resolve(makeVerboseRequest(requestOptions))
      }, retryDelayMs)
    })
  }
}
