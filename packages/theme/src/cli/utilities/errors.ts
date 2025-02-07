import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {createError as createH3Error, type H3Error} from 'h3'

/**
 * Renders an error banner for a thrown error with a headline.
 * @param headline - The headline for the error.
 * @param error - The error to render.
 */
export function renderThrownError(headline: string, error: Error | AbortError) {
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
export type FetchError = H3Error<{requestId?: string; url?: string}>

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
export function extractFetchErrorInfo(fetchError: Error | FetchError, context = 'Unexpected error during fetch') {
  const error = fetchError as FetchError
  const status = error.statusCode ?? 502
  const statusText = error.statusMessage ?? 'Bad Gateway'

  let headline = `${context.replace(/\.$/, '')} with status ${status} (${statusText}).`
  if (error.data?.requestId) headline += `\nRequest ID: ${error.data.requestId}`
  if (error.data?.url) headline += `\nURL: ${error.data.url}`

  const cause = error.cause as undefined | Error

  return {
    headline,
    body: cause?.stack ?? error.stack ?? error.message ?? statusText,
    status,
    statusText,
    cause,
    requestId: error.data?.requestId,
    url: error.data?.url,
  }
}
