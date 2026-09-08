import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const ACTIVE_RESPONSE_TYPE = /(?:application\/liquid|text\/liquid|text\/html|application\/x-liquid)/i
const REQUEST_SOURCE =
  /(?:req|request)\.(?:query|params|body)|(?:searchParams|formData)\.get\s*\(|await\s+(?:req|request)\.(?:text|json|formData)\s*\(/
const SAFE_HTML_ESCAPER = /\b(?:escapeHtml|escapeHTML|htmlEscape)\s*\([^()]*\)/g

export function scanAppProxyLiquidInjection(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const source = stripComments(file.content)
    if (!ACTIVE_RESPONSE_TYPE.test(source) || !REQUEST_SOURCE.test(source)) continue

    const requestBindings = collectRequestBindings(source)
    const bodyFlow = responseBodyExpressions(source).find(({expression}) =>
      hasRequestControlledBodyFlow(expression, requestBindings),
    )
    if (!bodyFlow) continue
    issues.push({
      id: 'APP_PROXY_LIQUID_INJECTION',
      severity: 'high',
      points: -20,
      title: 'App proxy Liquid injection risk',
      message: 'Request-controlled data flows into an active Liquid or HTML app-proxy response.',
      location: {file: file.path, line: source.slice(0, bodyFlow.index).split('\n').length},
      fix: {
        automated: false,
        description: 'Return inert JSON, or render only trusted templates with context-appropriate escaping.',
        guide: 'https://shopify.dev/docs/apps/online-store/app-proxies',
      },
    })
  }
  return issues
}

function collectRequestBindings(source: string): Set<string> {
  const requestBindings = new Set<string>()
  const bindingPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g
  let binding = bindingPattern.exec(source)
  while (binding) {
    if (binding[1] && binding[2] && REQUEST_SOURCE.test(binding[2])) requestBindings.add(binding[1])
    binding = bindingPattern.exec(source)
  }
  return requestBindings
}

function responseBodyExpressions(source: string): {index: number; expression: string}[] {
  const expressions: {index: number; expression: string}[] = []
  const callPatterns = [/\bnew\s+Response\s*\(/g, /\bres\.(?:send|end|write)\s*\(/g]
  for (const pattern of callPatterns) {
    let sink = pattern.exec(source)
    while (sink) {
      const body = firstCallArgument(source, pattern.lastIndex)
      if (body) expressions.push({index: sink.index, expression: body.text})
      pattern.lastIndex = body?.end ?? pattern.lastIndex
      sink = pattern.exec(source)
    }
  }

  const returnPattern = /\breturn\s+/g
  let returned = returnPattern.exec(source)
  while (returned) {
    const expression = statementExpression(source, returnPattern.lastIndex)
    if (expression && /^[`"']/.test(expression.text.trim())) expressions.push({index: returned.index, expression: expression.text})
    returnPattern.lastIndex = expression?.end ?? returnPattern.lastIndex
    returned = returnPattern.exec(source)
  }
  return expressions
}

function hasRequestControlledBodyFlow(expression: string, requestBindings: Set<string>): boolean {
  const executableExpression = maskLiteralTextPreservingTemplateExpressions(removeSafeHtmlEscapes(expression))
  if (REQUEST_SOURCE.test(executableExpression)) return true
  return [...requestBindings].some((binding) => new RegExp(`\\b${escapeRegExp(binding)}\\b`).test(executableExpression))
}

function removeSafeHtmlEscapes(expression: string): string {
  let unescaped = expression
  for (let count = 0; count < 5; count++) {
    const next = unescaped.replace(SAFE_HTML_ESCAPER, '')
    if (next === unescaped) break
    unescaped = next
  }
  return unescaped
}

function maskLiteralTextPreservingTemplateExpressions(source: string): string {
  return source.replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^`\\])*`/g, (literal) => {
    if (!literal.startsWith('`')) return literal.replace(/[^\n]/g, ' ')
    const original = [...literal]
    const masked: string[] = original.map((character) => (character === '\n' ? '\n' : ' '))
    let depth = 0
    for (let index = 0; index < original.length; index++) {
      if (depth === 0 && original[index] === '$' && original[index + 1] === '{') {
        depth = 1
        index++
        continue
      }
      if (depth === 0) continue
      if (original[index] === '{') depth++
      else if (original[index] === '}') {
        depth--
        continue
      }
      masked[index] = original[index]!
    }
    return masked.join('')
  })
}

function firstCallArgument(source: string, start: number): {text: string; end: number} | undefined {
  let depth = 0
  let quote: string | undefined
  for (let index = start; index < source.length; index++) {
    const character = source[index]!
    if (quote) {
      if (character === '\\') index++
      else if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') {
      if (character === ')' && depth === 0) return {text: source.slice(start, index).trim(), end: index + 1}
      depth--
    } else if (character === ',' && depth === 0) return {text: source.slice(start, index).trim(), end: index + 1}
  }
  return undefined
}

function statementExpression(source: string, start: number): {text: string; end: number} | undefined {
  let depth = 0
  let quote: string | undefined
  for (let index = start; index < source.length; index++) {
    const character = source[index]!
    if (quote) {
      if (character === '\\') index++
      else if (character === quote) quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '(' || character === '[' || character === '{') depth++
    else if (character === ')' || character === ']' || character === '}') depth--
    else if (depth === 0 && character === ';') return {text: source.slice(start, index).trim(), end: index + 1}
    else if (depth === 0 && character === '\n' && !continuesAcrossNewline(source, start, index))
      return {text: source.slice(start, index).trim(), end: index + 1}
  }
  const text = source.slice(start).trim()
  return text ? {text, end: source.length} : undefined
}

function continuesAcrossNewline(source: string, start: number, newlineIndex: number): boolean {
  const previous = source.slice(start, newlineIndex).trimEnd().at(-1)
  const next = source.slice(newlineIndex + 1).trimStart().at(0)
  return Boolean(previous && '+-*/%&|?:.,'.includes(previous)) || Boolean(next && '+-*/%&|?:.,'.includes(next))
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
