import {commandEventOutputMode, emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {recordError} from '@shopify/cli-kit/node/analytics'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {createError as createH3Error, type H3Error} from 'h3'

/**
 * Renders an error banner for a thrown error with a headline.
 * @param headline - The headline for the error.
 * @param error - The error to render.
 */
export function renderThrownError(headline: string, error: Error | AbortError) {
  if (error instanceof AbortSilentError) return
  recordError(error)

  if (commandEventOutputMode() === 'json') {
    emitCommandEvent({type: 'diagnostic', level: 'error', message: `${headline}\n${error.message}`})
    return
  }

  if (error instanceof AbortError) {
    error.message = `${headline}\n${error.message}`
    renderFatalError(error)
  } else {
    renderError({headline, body: error.message})
    outputDebug(`${headline}\n${error.stack ?? error.message}`)
  }
}

/**
 * Creates a function that renders a failed syncing operation without interrupting the process.
 * @param resource - The file that was being operated on, or a headline for the error.
 * @param preset - The type of operation that failed.
 * @returns A function that accepts an error and renders it.
 */
export function createSyncingCatchError(resource: string, preset?: 'delete' | 'upload') {
  const headline =
    {
      delete: `Failed to delete file "${resource}" from remote theme.`,
      upload: `Failed to upload file "${resource}" to remote theme.`,
      default: resource,
    }[preset ?? 'default'] ?? resource

  return (error: Error) => {
    renderThrownError(headline, error)
  }
}

/**
 * Creates a function that renders a failed syncing operation and exits the process.
 * @param headline - The headline for the error.
 * @returns A function that accepts an error and renders it.
 */
export function createAbortCatchError(headline: string) {
  return (error: Error): never => {
    renderThrownError(headline, error)
    process.exit(1)
  }
}

/* ---- Fetch Errors ---- */
type FetchError = H3Error<{requestId?: string; url?: string}>

/**
 * Creates a FetchError from an actual Error object or a Response.
 * @param resource - The error thrown by fetch, or the non-ok response.
 * @param url - The URL of the request.
 */
export function createFetchError(resource: Partial<Response & Error>, url?: string | URL): FetchError {
  return createH3Error({
    status: resource.status ?? 502,
    statusText: resource.statusText ?? 'Bad Gateway',
    cause: resource,
    data: {
      url: (url ?? resource.url)?.toString(),
      requestId: resource.headers?.get('x-request-id') ?? undefined,
    },
  })
}

/**
 * Extracts information from a FetchError useful for rendering an error banner and creating responses.
 * @param fetchError - The error to extract information from.
 * @param context - The context description of the error.
 */
/**
 * Finds the first `code` carried by an error or one of its nested causes.
 * Fetch failures hide the actionable error (for example undici's
 * `UND_ERR_HEADERS_OVERFLOW`) one or two `cause` hops below a generic
 * `TypeError: fetch failed`, so walk the chain instead of only looking at
 * the outermost error.
 */
function findCauseCode(error: Error): string | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    const code = (current as Error & {code?: unknown}).code
    if (typeof code === 'string' && code.length > 0) return code
    current = current.cause
  }
  return undefined
}

export function extractFetchErrorInfo(fetchError: Error | FetchError, context = 'Unexpected error during fetch') {
  const error = fetchError as FetchError
  const status = error.statusCode ?? 502
  const statusText = error.statusMessage ?? 'Bad Gateway'

  const cause = (error.cause ?? fetchError) as Error
  const causeCode = findCauseCode(cause)

  let headline = `${context.replace(/\.$/, '')} with status ${status} (${statusText}).`
  if (error.data?.requestId) headline += `\nRequest ID: ${error.data.requestId}`
  if (error.data?.url) headline += `\nURL: ${error.data.url}`
  if (causeCode) headline += `\nCause: ${causeCode}`

  return {
    headline,
    body: cause.stack ?? error.stack ?? error.message ?? statusText,
    status,
    statusText,
    cause,
    causeCode,
    requestId: error.data?.requestId,
    url: error.data?.url,
  }
}
