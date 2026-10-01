import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {sanitizeURL} from './urls.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'

import {ClientError, Variables} from 'graphql-request'

export function debugLogRequestInfo(
  api: string,
  query: string,
  url: string,
  variables?: Variables,
  headers: Record<string, string> = {},
) {
  outputDebug(outputContent`Sending ${outputToken.json(api)} GraphQL request:
  ${outputToken.raw(query.toString().trim())}
${variables ? `\nWith variables:\n${sanitizeVariables(variables)}\n` : ''}
With request headers:
${sanitizedHeadersOutput(headers)}\n
to ${sanitizeURL(url)}`)
}

export function sanitizeVariables(variables: Variables): string {
  const result: Variables = {...variables}
  const sensitiveKeys = ['apiKey', 'serialized_script']

  const sanitizedResult = sanitizeDeepVariables(result, sensitiveKeys)

  return JSON.stringify(sanitizedResult, null, 2)
}

function sanitizeDeepVariables(value: unknown, sensitiveKeys: string[]): unknown {
  // Checking for JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        const sanitized = sanitizeDeepVariables(parsed, sensitiveKeys)
        return JSON.stringify(sanitized, null)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return value
    }
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeepVariables(item, sensitiveKeys))
  }

  const result: Variables = {}

  for (const [key, val] of Object.entries(value)) {
    if (sensitiveKeys.includes(key) && typeof val === 'string') {
      result[key] = '*****'
      continue
    }

    result[key] = sanitizeDeepVariables(val, sensitiveKeys)
  }

  return result
}

/**
 * Extracts human-readable error messages from a GraphQL errors array.
 *
 * Some APIs (e.g. App Management) return structured errors nested inside
 * `extensions.app_errors.errors[].message`. When those are present, we extract
 * them so the CLI displays a clean message instead of a raw JSON dump.
 * Falls back to each error's top-level `message` field, and ultimately to
 * the full JSON representation if no messages can be extracted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractGraphQLErrorMessages(errors: any[] | undefined): string | undefined {
  if (!errors || errors.length === 0) return undefined

  const messages: string[] = []

  for (const error of errors) {
    // Check for nested app_errors (App Management API pattern)
    const appErrors = error?.extensions?.app_errors?.errors
    if (Array.isArray(appErrors) && appErrors.length > 0) {
      const appMessages: string[] = []
      for (const appError of appErrors) {
        const friendlyMessage = friendlyAppErrorMessage(appError)
        if (friendlyMessage) {
          appMessages.push(friendlyMessage)
        } else if (typeof appError?.message === 'string') {
          appMessages.push(appError.message)
        }
      }
      // Fall back to top-level error message if no app_error messages were extracted
      if (appMessages.length > 0) {
        messages.push(...appMessages)
      } else if (typeof error?.message === 'string') {
        messages.push(error.message)
      }
    }
    // Fall back to top-level error message
    else if (typeof error?.message === 'string') {
      messages.push(error.message)
    }
  }

  return messages.length > 0 ? messages.join('\n') : undefined
}

/**
 * Maps known app_errors categories to user-friendly messages.
 * Returns undefined if the error doesn't match a known pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function friendlyAppErrorMessage(appError: any): string | undefined {
  if (appError?.category === 'access_denied') {
    return "You don't have the necessary permissions to perform this action. Check that you're using the correct account or token."
  }
  return undefined
}

export function errorHandler(api: string): (error: unknown, requestId?: string) => unknown {
  return (error: unknown, requestId?: string) => {
    if (error instanceof ClientError) {
      const {status} = error.response

      const extractedMessages = extractGraphQLErrorMessages(error.response.errors)

      let errorMessage: string
      if (extractedMessages && status < 500) {
        errorMessage = extractedMessages
      } else if (extractedMessages && status >= 500) {
        errorMessage = `The ${api} GraphQL API responded with HTTP status ${status}: ${extractedMessages}`
      } else {
        errorMessage = stringifyMessage(outputContent`
The ${outputToken.raw(api)} GraphQL API responded unsuccessfully with${
          status === 200 ? '' : ` the HTTP status ${status} and`
        } errors:

${outputToken.json(error.response.errors)}
        `)
      }
      if (requestId) {
        errorMessage += `\n\nRequest ID: ${requestId}`
      }
      let mappedError: Error
      if (status < 500) {
        mappedError = new GraphQLClientError(errorMessage, status, error.response.errors)
      } else {
        mappedError = new AbortError(errorMessage)
      }
      mappedError.stack = error.stack
      return mappedError
    } else {
      return error
    }
  }
}
