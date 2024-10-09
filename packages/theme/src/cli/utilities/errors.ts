import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'

/**
 * Renders an error banner for a failed syncing operation without interrupting the process.
 * @param resource - The file that was being operated on, or a headline for the error.
 * @param preset - The type of operation that failed.
 * @returns A function that accepts an error and renders it.
 */
export function renderCatchError(resource: string, preset?: 'delete' | 'upload') {
  let headline = resource

  if (preset) {
    headline =
      preset === 'delete'
        ? `Failed to delete file "${resource}" from remote theme.`
        : `Failed to upload file "${resource}" to remote theme.`
  }

  return (error: Error | AbortError) => {
    if (error instanceof AbortError) {
      error.message = `${headline}.\n${error.message}`
      renderFatalError(error)
    } else {
      renderError({headline, body: error.message})
      outputDebug(`${headline}\n${error.stack ?? error.message}`)
    }
  }
}

/**
 * Renders a fatal error banner and exits the process without continuing.
 * @param headline - The headline for the error.
 * @returns A function that accepts an error and renders it.
 */
export function abortCatchError(headline: string) {
  return (error: Error | AbortError): never => {
    if (error instanceof AbortError) {
      error.message = `${headline}\n${error.message}`
      renderFatalError(error)
    } else {
      renderError({headline, body: error.message})
    }

    process.exit(1)
  }
}
