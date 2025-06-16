import {sanitizedHeadersOutput} from './api/headers.js'
import {sanitizeURL} from './api/urls.js'
import {sleepWithBackoffUntil} from './sleep-with-backoff.js'
import {outputDebug} from '../../public/node/output.js'
import {Headers} from 'form-data'
import {ClientError} from 'graphql-request'
import {performance} from 'perf_hooks'

export type API = 'admin' | 'storefront-renderer' | 'partners' | 'business-platform' | 'app-management'

export const allAPIs: API[] = ['admin', 'storefront-renderer', 'partners', 'business-platform', 'app-management']

const DEFAULT_RETRY_DELAY_MS = 1000
const DEFAULT_RETRY_LIMIT = 10

export type NetworkRetryBehaviour =
  | {
      useNetworkLevelRetry: true
      maxRetryTimeMs: number
    }
  | {
      useNetworkLevelRetry: false
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

function isARetryableNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const networkErrorMessages = [
      'socket hang up',
      'ECONNRESET',
      'ECONNABORTED',
      'ENOTFOUND',
      'ENETUNREACH',
      'network socket disonnected',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EAI_FAIL',
      'The operation was aborted.',
    ]
    const anyMatches = networkErrorMessages.some((issueMessage) => error.message.includes(issueMessage))
    return anyMatches
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
      if (!isARetryableNetworkError(err)) {
        throw err
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
  const responseHeaders: {[key: string]: string} = {}
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

      if (errorsIncludeStatus429(err)) {
        let delayMs: number | undefined

        try {
          delayMs = responseHeaders['retry-after'] ? Number.parseInt(responseHeaders['retry-after'], 10) : undefined
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          // ignore errors in extracting retry-after header
        }
        return {
          status: 'can-retry',
          clientError: err,
          duration,
          sanitizedHeaders,
          sanitizedUrl,
          requestId: responseHeaders['x-request-id'],
          delayMs,
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

function errorsIncludeStatus429(error: ClientError): boolean {
  if (error.response.status === 429) {
    return true
  }

  // GraphQL returns a 401 with a string error message when auth fails
  // Therefore error.response.errors can be a string or GraphQLError[]
  if (typeof error.response.errors === 'string') {
    return false
  }
  return error.response.errors?.some((error) => error.extensions?.code === '429') ?? false
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

    if (limitRetriesTo <= retriesUsed) {
      outputDebug(`${limitRetriesTo} retries exhausted for request to ${result.sanitizedUrl}`)
      if (errorHandler) {
        throw errorHandler(result.clientError, result.requestId)
      } else {
        throw result.clientError
      }
    }
    retriesUsed += 1

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
