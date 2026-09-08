import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const HTML_RESPONSE_TYPE = /\btext\/html\b/i
const LIQUID_RESPONSE_TYPE = /\b(?:application\/liquid|text\/liquid|application\/x-liquid)\b/i
const REQUEST_SOURCE =
  /(?:req|request)\.(?:query|params|body)|(?:searchParams|formData)\.get\s*\(|await\s+(?:req|request)\.(?:text|json|formData)\s*\(/
const IDENTIFIER = '[A-Za-z_$][\\w$]*'

type ActiveResponseType = 'html' | 'liquid'

interface ResponseBodyCandidate {
  index: number
  expression: string
  responseType: ActiveResponseType
}

interface CallArguments {
  args: string[]
  end: number
}

export function scanAppProxyLiquidInjection(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !JAVASCRIPT_EXTENSIONS.has(file.ext)) continue
    const source = maskComments(file.content)
    const requestBindings = collectRequestBindings(source)
    const trustedHtmlEscapers = collectTrustedHtmlEscapers(source)
    const bodyFlow = responseBodyCandidates(source).find((candidate) =>
      hasRequestControlledBodyFlow(candidate, requestBindings, trustedHtmlEscapers),
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
  const executableSource = maskLiteralTextPreservingTemplateExpressions(source)
  const declarationPattern = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER})\\s*=\\s*`, 'g')
  const assignments: {name: string; expression: string}[] = []
  let declaration = declarationPattern.exec(executableSource)
  while (declaration) {
    const expression = statementExpression(executableSource, declarationPattern.lastIndex)
    if (expression && !/^(?:async\s*)?\([^)]*\)\s*=>/.test(expression.text) && !/^function\b/.test(expression.text))
      assignments.push({name: declaration[1]!, expression: expression.text})
    declaration = declarationPattern.exec(executableSource)
  }

  for (let pass = 0; pass < 5; pass++) {
    let changed = false
    for (const assignment of assignments) {
      if (requestBindings.has(assignment.name)) continue
      if (
        REQUEST_SOURCE.test(assignment.expression) ||
        [...requestBindings].some((binding) => containsStandaloneIdentifier(assignment.expression, binding))
      ) {
        requestBindings.add(assignment.name)
        changed = true
      }
    }
    if (!changed) break
  }
  return requestBindings
}

function collectTrustedHtmlEscapers(source: string): Set<string> {
  const escapers = new Set<string>()
  const importPattern = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+["']escape-html["']/g
  let imported = importPattern.exec(source)
  while (imported) {
    const name = imported[1]!
    if (!hasLocalDefinition(source, name)) escapers.add(name)
    imported = importPattern.exec(source)
  }
  return escapers
}

function hasLocalDefinition(source: string, name: string): boolean {
  return new RegExp(`\\b(?:function|const|let|var)\\s+${escapeRegExp(name)}\\b`).test(source)
}

function responseBodyCandidates(source: string): ResponseBodyCandidate[] {
  const candidates: ResponseBodyCandidate[] = []
  const responsePattern = /\bnew\s+Response\s*\(/g
  let response = responsePattern.exec(source)
  while (response) {
    const call = callArguments(source, responsePattern.lastIndex)
    const responseType = responseTypeFor(call?.args[1])
    if (call && responseType && call.args[0] !== undefined)
      candidates.push({index: response.index, expression: call.args[0], responseType})
    responsePattern.lastIndex = call?.end ?? responsePattern.lastIndex
    response = responsePattern.exec(source)
  }
  return candidates
}

function responseTypeFor(initExpression: string | undefined): ActiveResponseType | undefined {
  if (!initExpression) return undefined
  const contentType = /["']?content-type["']?\s*:\s*["']([^"']+)["']/i.exec(initExpression)?.[1]
  if (!contentType) return undefined
  if (LIQUID_RESPONSE_TYPE.test(contentType)) return 'liquid'
  if (HTML_RESPONSE_TYPE.test(contentType)) return 'html'
  return undefined
}

function hasRequestControlledBodyFlow(
  candidate: ResponseBodyCandidate,
  requestBindings: Set<string>,
  trustedHtmlEscapers: Set<string>,
): boolean {
  const body =
    candidate.responseType === 'html'
      ? maskTrustedHtmlEscapes(candidate.expression, trustedHtmlEscapers)
      : candidate.expression
  const executable = maskLiteralTextPreservingTemplateExpressions(body)
  if (REQUEST_SOURCE.test(executable)) return true
  return [...requestBindings].some((binding) => containsStandaloneIdentifier(executable, binding))
}

function maskTrustedHtmlEscapes(source: string, trustedHtmlEscapers: Set<string>): string {
  let masked = source
  for (const escaper of trustedHtmlEscapers) {
    const pattern = new RegExp(`\\b${escapeRegExp(escaper)}\\s*\\(`, 'g')
    let match = pattern.exec(masked)
    while (match) {
      if (masked[match.index - 1] === '.') {
        match = pattern.exec(masked)
        continue
      }
      const call = callArguments(masked, pattern.lastIndex)
      if (!call) break
      masked = replaceWithWhitespace(masked, match.index, call.end)
      pattern.lastIndex = call.end
      match = pattern.exec(masked)
    }
  }
  return masked
}

function callArguments(source: string, start: number): CallArguments | undefined {
  const args: string[] = []
  let argumentStart = start
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
      if (character === ')' && depth === 0) {
        args.push(source.slice(argumentStart, index).trim())
        return {args, end: index + 1}
      }
      depth--
    } else if (character === ',' && depth === 0) {
      args.push(source.slice(argumentStart, index).trim())
      argumentStart = index + 1
    }
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
  const next = source
    .slice(newlineIndex + 1)
    .trimStart()
    .at(0)
  return Boolean(previous && '+-*/%&|?:.,'.includes(previous)) || Boolean(next && '+-*/%&|?:.,'.includes(next))
}

function containsStandaloneIdentifier(expression: string, identifier: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(identifier)}\\b`, 'g')
  let match = pattern.exec(expression)
  while (match) {
    const previous = expression[match.index - 1]
    const remainder = expression.slice(match.index + identifier.length)
    if (previous !== '.' && previous !== '"' && previous !== "'" && previous !== '`' && !/^\s*:/.test(remainder))
      return true
    match = pattern.exec(expression)
  }
  return false
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

function replaceWithWhitespace(source: string, start: number, end: number): string {
  return `${source.slice(0, start)}${source.slice(start, end).replace(/[^\n]/g, ' ')}${source.slice(end)}`
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
