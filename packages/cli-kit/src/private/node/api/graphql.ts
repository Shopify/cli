import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {sanitizeURL} from './urls.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError, MfaRequiredError} from '../../../public/node/error.js'

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
  const sensitiveKeys = ['apiKey', 'serialized_script', 'sharedSecret', 'shared_secret']

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

const MFA_REQUIRED_MARKER = '[TFA]'

/**
 * Whether a request was refused because the session didn't use multi-factor authentication.
 *
 * Business Platform and the Admin API answer such a request with HTTP 401 and a `[TFA]` marker in the body.
 * A refreshed token keeps the session's authentication methods, so refreshing it can't satisfy the requirement.
 *
 * @param error - The error thrown by graphql-request.
 * @returns True when the response is a 401 that carries the `[TFA]` marker.
 */
export function isMfaRequiredError(error: unknown): boolean {
  if (!(error instanceof ClientError) || error.response.status !== 401) return false

  const {errors, error: bodyError} = error.response as {errors?: unknown; error?: unknown}
  return [errors, bodyError].some((value) => JSON.stringify(value ?? '').includes(MFA_REQUIRED_MARKER))
}

export function errorHandler(api: string): (error: unknown, requestId?: string) => unknown {
  return (error: unknown, requestId?: string) => {
    if (isMfaRequiredError(error)) {
      return new MfaRequiredError(requestId)
    }
    if (error instanceof ClientError) {
      const {status} = error.response

      const extractedMessages = extractGraphQLErrorMessages(error.response.errors)

      let errorMessage: string
      if (extractedMessages && status < 500) {
        errorMessage = extractedMessages
      } else if (extractedMessages && status >= 500) {
        errorMessage = `The ${api} GraphQL API responded with HTTP status ${status}: ${extractedMessages}`
      } else if (error.response.errors === undefined) {
        // A 401 from an API gateway, for example, has no GraphQL body to quote.
        errorMessage = `The ${api} GraphQL API responded unsuccessfully with the HTTP status ${status}.`
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

/**
 * Reads the `x-request-id` header of a failed GraphQL response.
 *
 * @param error - The error thrown by graphql-request.
 * @returns The request ID, or undefined when the response has none.
 */
export function requestIdFromClientError(error: ClientError): string | undefined {
  try {
    // graphql-request types the response without headers, but it carries the fetch Response's headers.
    const headers = (error.response as {headers?: {get?: (name: string) => string | null}}).headers
    return headers?.get?.('x-request-id') ?? undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

export function extractGraphQLErrors(error: unknown): NonNullable<ClientError['response']['errors']> {
  if (error instanceof ClientError) return Array.isArray(error.response.errors) ? error.response.errors : []
  if (error instanceof GraphQLClientError) return Array.isArray(error.errors) ? error.errors : []
  return []
}
