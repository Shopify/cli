import {categorizeError, ErrorCategory, formatErrorMessage} from './error-categorizer.js'
import {GraphQLClientError} from '../api/headers.js'
import {ClientError} from 'graphql-request'

/**
 * Structured signals extracted from an error, used to group it into a meaningful Bugsnag bucket.
 *
 * These are read from the *original* typed error (before it is flattened to a generic `Error`
 * for reporting), so we group on facts the error already carries rather than by re-parsing a
 * stringified message.
 */
interface ErrorGroupingSignals {
  httpStatus?: number
  code?: string
  errorClass?: string
}

/**
 * Extracts structured grouping signals from an error object.
 *
 * @param error - The original error (any type).
 * @returns The HTTP status, GraphQL error code, and error class name when available.
 */
export function errorGroupingSignals(error: unknown): ErrorGroupingSignals {
  const signals: ErrorGroupingSignals = {}

  if (error instanceof Error) {
    signals.errorClass = error.constructor.name
  }

  // GraphQLClientError (handleErrors: true, status < 500) preserves the status and errors array.
  if (error instanceof GraphQLClientError) {
    signals.httpStatus = error.statusCode
    signals.code = firstExtensionCode(error.errors)
    return signals
  }

  // Raw graphql-request ClientError (handleErrors: false) exposes the full response.
  if (error instanceof ClientError) {
    signals.httpStatus = error.response?.status
    signals.code = firstExtensionCode(error.response?.errors)
  }

  return signals
}

/**
 * Builds a Bugsnag grouping hash of the form `${slice}:${category}:${signature}`.
 *
 * Categories are resolved structured-first (HTTP status / GraphQL code), falling back to the
 * shared keyword categorizer only for untyped errors. When no meaningful category can be
 * resolved, returns `undefined` so the caller leaves `event.groupingHash` unset and Bugsnag's
 * default stack-trace grouping applies — this avoids merging genuinely distinct unknown bugs.
 *
 * @param error - The original error (any type).
 * @param sliceName - The product slice (`app`, `theme`, `store`, `hydrogen`, or `cli`).
 * @returns The grouping hash, or `undefined` to fall back to stack-trace grouping.
 */
export function errorGroupingHash(error: unknown, sliceName: string): string | undefined {
  const message = errorMessage(error)
  // Object signals are authoritative; message-derived signals fill gaps (e.g. 5xx errors that the
  // API layer flattens into an AbortError, dropping the structured status field).
  const signals: ErrorGroupingSignals = {...signalsFromMessage(message), ...errorGroupingSignals(error)}

  const structuredCategory = categoryFromSignals(signals)
  if (structuredCategory) {
    return `${sliceName}:${structuredCategory}:${structuredSignature(signals)}`
  }

  const groupingError = new Error(stripJsonDump(message))
  const category = categorizeError(groupingError)
  if (category === ErrorCategory.Unknown) return undefined

  return `${sliceName}:${category.toLowerCase()}:${formatErrorMessage(groupingError, category)}`
}

/**
 * Resolves a semantic category from structured signals using an explicit decision table.
 *
 * 403 and ACCESS_DENIED map to `permission` (a forbidden request is a permission problem, not an
 * authentication one). Returns `undefined` when no structured signal is present.
 */
function categoryFromSignals(signals: ErrorGroupingSignals): string | undefined {
  const {httpStatus, code} = signals

  if (code === 'THROTTLED' || httpStatus === 429) return 'rate_limit'
  if (httpStatus === 401) return 'authentication'
  if (httpStatus === 403 || code === 'ACCESS_DENIED') return 'permission'
  if (httpStatus !== undefined && httpStatus >= 500) return 'server'

  return undefined
}

/**
 * Builds a stable, low-cardinality signature slug from structured signals.
 */
function structuredSignature(signals: ErrorGroupingSignals): string {
  const parts: string[] = []
  if (signals.httpStatus !== undefined) parts.push(`http-${signals.httpStatus}`)
  if (signals.code) parts.push(signals.code)
  if (parts.length === 0 && signals.errorClass) parts.push(signals.errorClass)

  return slugify(parts.join('-'))
}

/**
 * Recovers structured signals from an error message string. Handles both error shapes seen from
 * the API layer: graphql-request's `GraphQL Error (Code: NNN): {json}` and the cli-kit wrapper's
 * `... responded unsuccessfully with the HTTP status NNN ...`.
 */
function signalsFromMessage(message: string): ErrorGroupingSignals {
  const signals: ErrorGroupingSignals = {}

  const statusMatch = message.match(/HTTP status (\d{3})/i) ?? message.match(/\(Code: (\d{3})\)/i)
  if (statusMatch?.[1]) signals.httpStatus = Number(statusMatch[1])

  const payload = parseEmbeddedJson(message)
  if (payload?.response?.status !== undefined) {
    signals.httpStatus = signals.httpStatus ?? payload.response.status
  }
  const code = firstExtensionCode(payload?.response?.errors)
  if (code) signals.code = code

  return signals
}

interface EmbeddedGraphQLPayload {
  response?: {
    status?: number
    errors?: unknown
  }
}

/**
 * Parses the JSON blob embedded in a graphql-request ClientError message, if present.
 */
function parseEmbeddedJson(message: string): EmbeddedGraphQLPayload | undefined {
  const jsonStart = message.indexOf('{')
  if (jsonStart === -1) return undefined

  try {
    return JSON.parse(message.slice(jsonStart)) as EmbeddedGraphQLPayload
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Returns the GraphQL `extensions.code` of the first error, when the errors value is an array.
 * The API can return `errors` as a string, hence the array guard.
 */
function firstExtensionCode(errors: unknown): string | undefined {
  if (!Array.isArray(errors)) return undefined
  const code = (errors[0] as {extensions?: {code?: unknown}} | undefined)?.extensions?.code
  return typeof code === 'string' ? code : undefined
}

/**
 * Strips a trailing JSON dump (`...: {json}`) from a message so the keyword categorizer sees the
 * human-readable prefix rather than the serialized request/response (which contains the literal
 * `request`, mis-routing to the network category).
 */
function stripJsonDump(message: string): string {
  return message.split(': {')[0] ?? message
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}
