import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {sanitizeURL} from './urls.js'
import {outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError, Variables} from 'graphql-request'
import type {CustomSection} from '../ui/components/Alert.js'
import type {Token, TokenItem, InlineToken} from '../ui/components/TokenizedText.js'

export function debugLogRequestInfo(
  api: string,
  query: string,
  url: string,
  variables?: Variables,
  headers: {[key: string]: string} = {},
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

// Maximum number of stack trace entries to show before truncating
const MAX_STACK_ENTRIES = 8

export interface ParsedStackEntry {
  method: string
  file: string
  line: string | undefined
}

export interface GraphQLErrorMeta {
  requestId: string | undefined
  exceptionClass: string | undefined
  sourceFile: string | undefined
  sourceLine: number | undefined
  stackTrace: ParsedStackEntry[]
}

/**
 * Extracts human-readable error messages from a GraphQL error response.
 * Filters out empty strings and deduplicates messages.
 */
export function extractErrorMessages(errors: unknown): string[] {
  console.log('errors', errors)
  if (!Array.isArray(errors)) return []
  const seen = new Set<string>()
  return errors
    .map((err) => (typeof err === 'object' && err !== null && 'message' in err ? String(err.message) : undefined))
    .filter((msg): msg is string => {
      if (typeof msg !== 'string' || msg.length === 0 || seen.has(msg)) return false
      seen.add(msg)
      return true
    })
}

/**
 * Extracts structured metadata from all GraphQL error extensions.
 * Pulls request ID, exception class, source location, and the server stack trace.
 */
export function extractGraphQLErrorMeta(errors: unknown): GraphQLErrorMeta {
  const meta: GraphQLErrorMeta = {
    requestId: undefined,
    exceptionClass: undefined,
    sourceFile: undefined,
    sourceLine: undefined,
    stackTrace: [],
  }
  if (!Array.isArray(errors)) return meta

  for (const err of errors) {
    if (typeof err !== 'object' || err === null || !('extensions' in err)) continue
    const ext = (err as {extensions: {[key: string]: unknown}}).extensions

    if (!meta.requestId && typeof ext.request_id === 'string' && ext.request_id.length > 0) {
      meta.requestId = ext.request_id
    }

    if (!meta.exceptionClass && typeof ext.exception_class === 'string' && ext.exception_class.length > 0) {
      meta.exceptionClass = ext.exception_class
    }

    if (!meta.sourceFile && typeof ext.source === 'object' && ext.source !== null) {
      const source = ext.source as {[key: string]: unknown}
      if (typeof source.file === 'string') {
        meta.sourceFile = source.file
      }
      if (typeof source.line === 'number') {
        meta.sourceLine = source.line
      }
    }

    if (meta.stackTrace.length === 0 && Array.isArray(ext.app_stacktrace)) {
      meta.stackTrace = ext.app_stacktrace
        .filter((entry): entry is string => typeof entry === 'string')
        .map(parseRubyStackEntry)
    }
  }

  // Strip deployment-specific prefixes from file paths for cleaner display.
  // Step 1: Strip to known structural boundaries (e.g. "components/" in Shopify's monorepo).
  // This works regardless of deployment environment because the marker is part of the code
  // structure, not the deployment path.
  if (meta.sourceFile) {
    meta.sourceFile = stripDeploymentPrefix(meta.sourceFile)
  }
  meta.stackTrace = meta.stackTrace.map((entry) => ({
    ...entry,
    file: entry.file.length > 0 ? stripDeploymentPrefix(entry.file) : entry.file,
  }))

  // Step 2: For any remaining absolute paths (marker not found), strip their common
  // directory prefix as a fallback. This handles non-monorepo paths gracefully.
  const absolutePaths = [meta.sourceFile, ...meta.stackTrace.map((entry) => entry.file)].filter(
    (path): path is string => typeof path === 'string' && path.startsWith('/'),
  )
  const prefix = findCommonPathPrefix(absolutePaths)
  if (prefix.length > 0) {
    if (meta.sourceFile?.startsWith(prefix)) {
      meta.sourceFile = meta.sourceFile.slice(prefix.length)
    }
    meta.stackTrace = meta.stackTrace.map((entry) => ({
      ...entry,
      file: entry.file.startsWith(prefix) ? entry.file.slice(prefix.length) : entry.file,
    }))
  }

  return meta
}

/**
 * Parses a Ruby stack trace entry into its component parts.
 * Handles formats like: "/path/to/file.rb:37:in 'Module::Class#method'"
 * Preserves the full file path for detailed debugging.
 */
export function parseRubyStackEntry(entry: string): ParsedStackEntry {
  // Full Ruby format: /path/to/file.rb:line:in 'Namespace::Class#method'
  const rubyMatch = entry.match(/(.+\.\w+):(\d+):in\s+'([^']+)'/)
  if (rubyMatch) {
    return {
      file: rubyMatch[1] ?? '',
      line: rubyMatch[2],
      method: shortenRubyMethod(rubyMatch[3] ?? ''),
    }
  }
  // Simpler format: /path/to/file.ext:line
  const simpleMatch = entry.match(/(.+\.\w+):(\d+)/)
  if (simpleMatch) {
    return {file: simpleMatch[1] ?? '', line: simpleMatch[2], method: ''}
  }
  // Fallback: use the trimmed entry as the method name
  return {method: entry.trim(), file: '', line: undefined}
}

/**
 * Strips deployment and organizational prefixes from a server-side file path,
 * leaving just the meaningful code location starting from a known structural boundary.
 *
 * In Shopify's monorepo, code lives under "components/" — everything before that
 * is deployment root + area/team organization that varies between environments.
 * Returns the path unchanged if no structural marker is found.
 */
export function stripDeploymentPrefix(filePath: string): string {
  const markerIndex = filePath.indexOf('components/')
  if (markerIndex >= 0) return filePath.slice(markerIndex)
  return filePath
}

/**
 * Finds the longest common directory prefix across multiple file paths.
 * Used as a fallback when structural markers aren't found — strips deployment-specific
 * root directories from server-side paths for cleaner display.
 *
 * Requires at least 2 non-empty paths to compute a prefix; otherwise returns "".
 * Returns the prefix including a trailing "/" ready for stripping.
 */
export function findCommonPathPrefix(paths: string[]): string {
  // Extract directory portions (strip filenames) and filter empties
  const dirs = paths
    .filter((filePath) => filePath.length > 0)
    .map((filePath) => {
      const lastSlash = filePath.lastIndexOf('/')
      return lastSlash >= 0 ? filePath.slice(0, lastSlash) : ''
    })
    .filter((dir) => dir.length > 0)

  if (dirs.length < 2) return ''

  const segments = dirs.map((dir) => dir.split('/'))
  const minLength = Math.min(...segments.map((seg) => seg.length))
  const first = segments[0] ?? []

  let commonLength = 0
  for (let idx = 0; idx < minLength; idx++) {
    const segment = first[idx]
    if (segments.every((seg) => seg[idx] === segment)) {
      commonLength = idx + 1
    } else {
      break
    }
  }

  // Don't strip if only the leading "/" is shared (the empty string segment from splitting an absolute path)
  if (commonLength <= 1) return ''
  return `${first.slice(0, commonLength).join('/')}/`
}

/**
 * Shortens a fully-qualified Ruby method name to just the class and method.
 * e.g. "Apps::Operations::StaticAssetPipeline.perform" → "StaticAssetPipeline.perform"
 */
function shortenRubyMethod(method: string): string {
  const parts = method.split('::')
  return parts[parts.length - 1] ?? method
}

/**
 * Formats a single stack entry as a TokenItem for display in a list.
 * Method names are shown prominently, file locations are subdued.
 */
function formatStackEntry(entry: ParsedStackEntry): TokenItem<InlineToken> {
  const location = entry.line ? `${entry.file}:${entry.line}` : entry.file
  if (entry.method && entry.file) {
    return [entry.method, '\n', {filePath: location}]
  }
  if (entry.method) return entry.method
  if (entry.file) return {filePath: location}
  return '<unknown>'
}

/**
 * Builds custom sections with detailed diagnostic information from GraphQL error metadata.
 * Sections are rendered below the main message and next steps in the error banner.
 */
function buildErrorCustomSections(meta: GraphQLErrorMeta, resolvedRequestId: string | undefined): CustomSection[] {
  const sections: CustomSection[] = []

  // Request ID — prominent, in info color for easy copy-paste
  if (resolvedRequestId) {
    sections.push({
      title: 'Request ID',
      body: {info: resolvedRequestId},
    })
  }

  // Exception class and source location
  if (meta.exceptionClass ?? meta.sourceFile) {
    const parts: InlineToken[] = []
    if (meta.exceptionClass) {
      parts.push({warn: meta.exceptionClass})
    }
    if (meta.sourceFile) {
      const location = meta.sourceLine == null ? meta.sourceFile : `${meta.sourceFile}:${meta.sourceLine}`
      if (parts.length > 0) parts.push(' at ')
      parts.push({filePath: location})
    }
    sections.push({
      title: 'Exception',
      body: parts,
    })
  }

  // Stack trace — truncated with a "... N more" indicator
  if (meta.stackTrace.length > 0) {
    const visible = meta.stackTrace.slice(0, MAX_STACK_ENTRIES)
    const remaining = meta.stackTrace.length - visible.length

    const items: TokenItem<InlineToken>[] = visible.map(formatStackEntry)
    const bodyTokens: Token[] = [{list: {items}}]
    if (remaining > 0) {
      bodyTokens.push({subdued: `... ${remaining} more`})
    }

    sections.push({
      title: 'Stack trace',
      body: bodyTokens,
    })
  }

  return sections
}

/**
 * Builds a formatted TokenItem message for server errors (HTTP 5xx).
 */
function buildServerErrorMessage(api: string, status: number, errorMessages: string[]): TokenItem {
  const headline = `The ${api} GraphQL API returned an internal server error (${status}).`
  if (errorMessages.length === 0) return headline
  if (errorMessages.length === 1) return [headline, '\n\n', {bold: errorMessages[0] ?? ''}]
  return [headline, '\n\n', {list: {items: errorMessages.map((msg) => ({bold: msg}))}}]
}

/**
 * Builds a clean string message for client errors (HTTP 4xx or 200 with errors).
 */
function buildClientErrorMessage(api: string, status: number, errorMessages: string[]): string {
  const statusClause = status === 200 ? '' : ` (${status})`
  const headline = `The ${api} GraphQL API responded with errors${statusClause}:`

  let body = ''
  if (errorMessages.length === 1) {
    body = `\n\n${errorMessages[0]}`
  } else if (errorMessages.length > 1) {
    body = `\n\n${errorMessages.map((msg) => `  • ${msg}`).join('\n')}`
  }

  return `${headline}${body}`
}

export function errorHandler(api: string): (error: unknown, requestId?: string) => unknown {
  return (error: unknown, requestId?: string) => {
    if (error instanceof ClientError) {
      const {status} = error.response
      const errorMessages = extractErrorMessages(error.response.errors)
      const meta = extractGraphQLErrorMeta(error.response.errors)
      const resolvedRequestId = meta.requestId ?? requestId
      const customSections = buildErrorCustomSections(meta, resolvedRequestId)

      let mappedError: Error
      if (status >= 500) {
        mappedError = new AbortError(
          buildServerErrorMessage(api, status, errorMessages),
          null,
          undefined,
          customSections,
        )
      } else {
        const clientError = new GraphQLClientError(
          buildClientErrorMessage(api, status, errorMessages),
          status,
          error.response.errors,
        )
        // Enrich with detailed diagnostic sections (GraphQLClientError extends AbortError,
        // so customSections are rendered by the FatalError component)
        if (customSections.length > 0) {
          clientError.customSections = customSections
        }
        mappedError = clientError
      }
      mappedError.stack = error.stack
      return mappedError
    } else {
      return error
    }
  }
}
