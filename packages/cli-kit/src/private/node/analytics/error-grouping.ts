import {categorizeError, ErrorCategory, formatErrorMessage} from './error-categorizer.js'
import {graphQLErrorCodes, isPermissionCode, isRateLimitCode} from './graphql-error-codes.js'
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
 * The fully resolved grouping decision for an error: the Bugsnag grouping hash (or `undefined` to
 * fall back to stack-trace grouping), the semantic category, and the structured signals that drove
 * the decision. The reporter uses a single resolution for both `event.groupingHash` and the
 * `error_grouping` metadata so they can never disagree.
 */
interface ResolvedErrorGrouping {
  hash?: string
  category?: string
  signals: ErrorGroupingSignals
}

/**
 * Extracts structured grouping signals from an error object.
 *
 * Only assigns a field when a value is actually present, so the result can be safely merged over
 * message-derived signals without an explicit `undefined` erasing a recovered value.
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
    if (error.statusCode !== undefined) signals.httpStatus = error.statusCode
    const code = routableCode(error.errors)
    if (code !== undefined) signals.code = code
    return signals
  }

  // Raw graphql-request ClientError (handleErrors: false) exposes the full response.
  if (error instanceof ClientError) {
    const status = error.response?.status
    if (status !== undefined) signals.httpStatus = status
    const code = routableCode(error.response?.errors)
    if (code !== undefined) signals.code = code
  }

  return signals
}

/**
 * Resolves the full grouping decision for an error: hash, category, and the signals behind it.
 *
 * Categories are resolved structured-first (HTTP status / GraphQL code), falling back to the
 * shared keyword categorizer only for untyped errors. When no meaningful category can be
 * resolved, `hash` is `undefined` so the caller leaves `event.groupingHash` unset and Bugsnag's
 * default stack-trace grouping applies — this avoids merging genuinely distinct unknown bugs.
 *
 * @param error - The original error (any type).
 * @param sliceName - The product slice (`app`, `theme`, `store`, `hydrogen`, or `cli`).
 * @returns The resolved hash (or `undefined`), category, and structured signals.
 */
export function resolveErrorGrouping(error: unknown, sliceName: string): ResolvedErrorGrouping {
  const message = errorMessage(error)
  // Object signals are authoritative; message-derived signals fill gaps (e.g. 5xx errors that the
  // API layer flattens into an AbortError, dropping the structured status field). Merge field by
  // field so an absent object signal never clobbers one recovered from the message.
  const fromError = errorGroupingSignals(error)
  const fromMessage = signalsFromMessage(message)
  const signals: ErrorGroupingSignals = {
    httpStatus: fromError.httpStatus ?? fromMessage.httpStatus,
    code: fromError.code ?? fromMessage.code,
    errorClass: fromError.errorClass ?? fromMessage.errorClass,
  }

  const structuredCategory = categoryFromSignals(signals)
  if (structuredCategory) {
    return {hash: `${sliceName}:${structuredCategory}:${structuredSignature(signals)}`, category: structuredCategory, signals}
  }

  const groupingError = new Error(stripJsonDump(message))
  const category = categorizeError(groupingError)
  if (category === ErrorCategory.Unknown) {
    return {hash: undefined, category: undefined, signals}
  }

  const categoryName = category.toLowerCase()
  return {hash: `${sliceName}:${categoryName}:${formatErrorMessage(groupingError, category)}`, category: categoryName, signals}
}

/**
 * Builds a Bugsnag grouping hash of the form `${slice}:${category}:${signature}`.
 *
 * Thin wrapper over {@link resolveErrorGrouping} for callers that only need the hash.
 *
 * @param error - The original error (any type).
 * @param sliceName - The product slice (`app`, `theme`, `store`, `hydrogen`, or `cli`).
 * @returns The grouping hash, or `undefined` to fall back to stack-trace grouping.
 */
export function errorGroupingHash(error: unknown, sliceName: string): string | undefined {
  return resolveErrorGrouping(error, sliceName).hash
}

/**
 * Resolves a semantic category from structured signals using an explicit decision table.
 *
 * Precedence is deliberate:
 * - rate limit (`THROTTLED`/`429` code or HTTP 429) wins first — it is the most actionable bucket.
 * - HTTP 401 is authoritative for `authentication`: a request the server rejected as
 *   unauthenticated is an authentication problem even if a GraphQL code also reports access-denied.
 *   `ACCESS_DENIED` in practice pairs with HTTP 403, which is handled by the permission branch.
 * - 403 / `ACCESS_DENIED` (incl. nested App Management `access_denied`) → `permission`.
 *
 * Returns `undefined` when no structured signal is present.
 */
function categoryFromSignals(signals: ErrorGroupingSignals): string | undefined {
  const {httpStatus, code} = signals

  if (isRateLimitCode(code) || httpStatus === 429) return 'rate_limit'
  if (httpStatus === 401) return 'authentication'
  if (httpStatus === 403 || isPermissionCode(code)) return 'permission'
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
  if (signals.httpStatus === undefined && payload?.response?.status !== undefined) {
    signals.httpStatus = payload.response.status
  }
  const code = routableCode(payload?.response?.errors)
  if (code !== undefined) signals.code = code

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
 * Picks the most routing-relevant code from a GraphQL `errors` value.
 *
 * Scans every error (not just the first) and prefers a code we route on — a rate-limit code, then
 * a permission code — so a benign leading code can't mask a `THROTTLED` or `ACCESS_DENIED` further
 * down the array. Falls back to the first code present for visibility.
 */
function routableCode(errors: unknown): string | undefined {
  const codes = graphQLErrorCodes(errors)
  return codes.find(isRateLimitCode) ?? codes.find(isPermissionCode) ?? codes[0]
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
