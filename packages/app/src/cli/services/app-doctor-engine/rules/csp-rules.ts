import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const HEADER_NAME = 'content-security-policy'
const HEADER_SETTER_PREFIX = /\b(?:headers|response\.headers|res)\.(?:set|append|setHeader)\s*\(\s*$/i
const ALL_ORIGIN_WILDCARD = /^https?:\/\/\*(?::(?:\*|\d+))?(?:\/.*)?$/i
const SHOPIFY_WILDCARD = /^(?:https?:\/\/)?\*\.myshopify\.com(?::(?:\*|\d+))?(?:\/.*)?$/i

interface StaticHeaderValue {
  index: number
  value: string
}

interface ParsedStringLiteral {
  end: number
  value: string
  static: boolean
}

export function scanStaticFrameAncestors(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !JAVASCRIPT_EXTENSIONS.has(file.ext)) continue
    const source = maskComments(file.content)
    for (const header of staticCspHeaderValues(source)) {
      if (!hasClearlyPermissiveFrameAncestors(header.value)) continue
      issues.push({
        id: 'STATIC_FRAME_ANCESTORS',
        severity: 'high',
        points: -12,
        title: 'Embedded app frame-ancestors uses a wildcard',
        message: 'A literal frame-ancestors directive allows arbitrary or wildcard embedding origins.',
        location: {file: file.path, line: source.slice(0, header.index).split('\n').length},
        fix: {
          automated: false,
          description: 'Restrict frame-ancestors to Shopify Admin and the authenticated shop origin.',
          guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
        },
      })
    }
  }
  return issues
}

function staticCspHeaderValues(source: string): StaticHeaderValue[] {
  const headers: StaticHeaderValue[] = []
  for (let index = 0; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (!literal) continue
    if (literal.static && literal.value.toLowerCase() === HEADER_NAME) {
      const value = staticHeaderValueAfter(source, index, literal.end)
      if (value !== undefined) headers.push({index, value})
    }
    index = literal.end - 1
  }
  return headers
}

function staticHeaderValueAfter(source: string, headerStart: number, headerEnd: number): string | undefined {
  const next = skipWhitespace(source, headerEnd)
  if (source[next] === ':') {
    const expression = readExpression(source, next + 1, new Set([',', '}']))
    return expression ? evaluateStaticStringExpression(expression.text) : undefined
  }
  if (source[next] === ',' && isHeaderSetterCall(source, headerStart)) {
    const expression = readExpression(source, next + 1, new Set([',', ')']))
    return expression ? evaluateStaticStringExpression(expression.text) : undefined
  }
  return undefined
}

function isHeaderSetterCall(source: string, headerStart: number): boolean {
  return HEADER_SETTER_PREFIX.test(source.slice(Math.max(0, headerStart - 100), headerStart))
}

function hasClearlyPermissiveFrameAncestors(value: string): boolean {
  return value.split(';').some((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/)
    return name?.toLowerCase() === 'frame-ancestors' && sources.some(isClearlyPermissiveSource)
  })
}

function isClearlyPermissiveSource(source: string): boolean {
  return source === '*' || ALL_ORIGIN_WILDCARD.test(source) || SHOPIFY_WILDCARD.test(source)
}

function evaluateStaticStringExpression(expression: string): string | undefined {
  const value = stripOuterParens(expression.trim())
  if (!value) return undefined

  const literal = parseStringLiteral(value, 0)
  if (literal && literal.end === value.length && literal.static) return literal.value

  const concatenated = splitTopLevel(value, '+')
  if (concatenated.length > 1) {
    const parts = concatenated.map((part) => evaluateStaticStringExpression(part))
    if (parts.every((part): part is string => part !== undefined)) return parts.join('')
  }

  if (value.startsWith('[')) {
    const close = matchingDelimiter(value, 0, '[', ']')
    if (close !== undefined) {
      const joinMatch = /^\.join\s*\((.*)\)$/.exec(value.slice(close + 1).trim())
      if (joinMatch) {
        const separator = joinMatch[1]!.trim() ? evaluateStaticStringExpression(joinMatch[1]!) : ','
        if (separator === undefined) return undefined
        const parts = splitTopLevel(value.slice(1, close), ',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => evaluateStaticStringExpression(part))
        if (parts.every((part): part is string => part !== undefined)) return parts.join(separator)
      }
    }
  }

  return undefined
}

function stripOuterParens(value: string): string {
  let current = value
  while (current.startsWith('(')) {
    const close = matchingDelimiter(current, 0, '(', ')')
    if (close !== current.length - 1) break
    current = current.slice(1, -1).trim()
  }
  return current
}

function readExpression(
  source: string,
  start: number,
  terminators: Set<string>,
): {text: string; end: number} | undefined {
  const begin = skipWhitespace(source, start)
  let depth = 0
  for (let index = begin; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') {
      if (depth === 0 && terminators.has(character)) return {text: source.slice(begin, index).trim(), end: index}
      depth--
    } else if (depth === 0 && terminators.has(character)) return {text: source.slice(begin, index).trim(), end: index}
  }
  const text = source.slice(begin).trim()
  return text ? {text, end: source.length} : undefined
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') depth--
    else if (depth === 0 && character === delimiter) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }
  parts.push(source.slice(start))
  return parts
}

function matchingDelimiter(source: string, start: number, open: string, close: string): number | undefined {
  let depth = 0
  for (let index = start; index < source.length; index++) {
    const literal = parseStringLiteral(source, index)
    if (literal) {
      index = literal.end - 1
      continue
    }
    if (source[index] === open) depth++
    else if (source[index] === close) {
      depth--
      if (depth === 0) return index
    }
  }
  return undefined
}

function parseStringLiteral(source: string, start: number): ParsedStringLiteral | undefined {
  const quote = source[start]
  if (quote !== '"' && quote !== "'" && quote !== '`') return undefined
  let staticValue = true
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]!
    if (character === '\\') {
      index++
      continue
    }
    if (quote === '`' && character === '$' && source[index + 1] === '{') staticValue = false
    if (character === quote) {
      return {
        end: index + 1,
        value: source.slice(start + 1, index),
        static: staticValue,
      }
    }
  }
  return undefined
}

function skipWhitespace(source: string, start: number): number {
  let index = start
  while (/\s/.test(source[index] ?? '')) index++
  return index
}

/** Preserve offsets and string contents while blanking comments. */
function maskComments(source: string): string {
  const characters = [...source]
  let quote: string | undefined
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]!
    if (quote) {
      if (character === '\\') index++
      else if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '/' && characters[index + 1] === '/') {
      while (index < characters.length && characters[index] !== '\n') {
        characters[index] = ' '
        index++
      }
    } else if (character === '/' && characters[index + 1] === '*') {
      characters[index] = ' '
      characters[index + 1] = ' '
      index += 2
      while (index < characters.length && !(characters[index] === '*' && characters[index + 1] === '/')) {
        if (characters[index] !== '\n') characters[index] = ' '
        index++
      }
      if (index < characters.length) {
        characters[index] = ' '
        characters[index + 1] = ' '
        index++
      }
    }
  }
  return characters.join('')
}
