import {AbortError} from '@shopify/cli-kit/node/error'
import type {ParsedReportQuery} from './types.js'

/**
 * Strips markdown code fences and returns the text of the first top-level `{...}` object found,
 * matching braces so a query string that itself contains `{` or `}` doesn't truncate the match.
 */
function extractFirstJsonObject(text: string): string | undefined {
  const withoutFences = text.replace(/```(?:json)?/gi, '')
  const start = withoutFences.indexOf('{')
  if (start === -1) return undefined

  let depth = 0
  let insideString = false
  // Tracks whether the current character inside a string is escaped by the backslash before it.
  // A single previousChar === '\\' check mishandles an even run of backslashes (e.g. a string
  // ending in an escaped literal backslash, `\\`) by treating the closing quote as escaped too.
  // Toggling this on every backslash instead correctly tracks escape parity.
  let escapeNext = false

  for (let index = start; index < withoutFences.length; index++) {
    const char = withoutFences[index]!

    if (insideString) {
      if (escapeNext) {
        escapeNext = false
      } else if (char === '\\') {
        escapeNext = true
      } else if (char === '"') {
        insideString = false
      }
    } else if (char === '"') {
      insideString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) return withoutFences.slice(start, index + 1)
    }
  }

  return undefined
}

function throwUnparseableResponse(rawText: string): never {
  throw new AbortError('The assistant did not reply with a valid report query.', `Raw response:\n${rawText}`)
}

/**
 * Tolerantly parses the assistant's reply into a report query. The assistant is asked to reply
 * with only JSON, but may still wrap it in prose or code fences, so this extracts the first JSON
 * object rather than requiring the whole response to parse as JSON.
 */
export function parseAssistantReportResponse(rawText: string): ParsedReportQuery {
  const jsonText = extractFirstJsonObject(rawText)
  if (!jsonText) throwUnparseableResponse(rawText)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    throwUnparseableResponse(rawText)
  }

  if (typeof parsed !== 'object' || parsed === null) throwUnparseableResponse(rawText)
  const {api, query, rationale} = parsed as {api?: unknown; query?: unknown; rationale?: unknown}

  if (api !== 'shopifyql' && api !== 'admin') throwUnparseableResponse(rawText)
  if (typeof query !== 'string' || !query.trim()) throwUnparseableResponse(rawText)

  return {
    api,
    query,
    rationale: typeof rationale === 'string' ? rationale : '',
  }
}
