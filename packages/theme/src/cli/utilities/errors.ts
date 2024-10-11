import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'

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
