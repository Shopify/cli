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

interface HtmlContext {
  inTag: boolean
  rawTag?: 'script' | 'style'
  pendingTag?: string
  closingTag: boolean
  quote?: '"' | "'"
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
  const executableSource = maskLiteralTextPreservingTemplateExpressions(source)
  const responsePattern = /\bnew\s+Response\s*\(/g
  let response = responsePattern.exec(executableSource)
  while (response) {
    const openParen = response.index + response[0].lastIndexOf('(')
    const call = callArguments(source, openParen + 1)
    const responseType = responseTypeFor(call?.args[1])
    if (call && responseType && call.args[0] !== undefined)
      candidates.push({index: response.index, expression: call.args[0], responseType})
    responsePattern.lastIndex = call?.end ?? responsePattern.lastIndex
    response = responsePattern.exec(executableSource)
  }
  return candidates
}

function responseTypeFor(initExpression: string | undefined): ActiveResponseType | undefined {
  if (!initExpression) return undefined
  const contentType = /(?:^|[,{]\s*)["']?Content-Type["']?\s*:\s*["']([^"']+)["']/i.exec(initExpression)?.[1]
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
      ? maskTrustedHtmlTextEscapes(candidate.expression, trustedHtmlEscapers)
      : candidate.expression
  const executable = maskLiteralTextPreservingTemplateExpressions(body)
  if (REQUEST_SOURCE.test(executable)) return true
  return [...requestBindings].some((binding) => containsStandaloneIdentifier(executable, binding))
}

function maskTrustedHtmlTextEscapes(source: string, trustedHtmlEscapers: Set<string>): string {
  if (!source.startsWith('`') || skipTemplateLiteral(source, 0) !== source.length) return source
  const characters = [...source]
  const context: HtmlContext = {inTag: false, closingTag: false}
  let literalStart = 1
  for (let index = 1; index < source.length - 1; index++) {
    if (source[index] === '\\') {
      index++
      continue
    }
    if (source[index] !== '$' || source[index + 1] !== '{') continue
    updateHtmlContext(context, source.slice(literalStart, index))
    const end = skipTemplateExpression(source, index + 2)
    if (end === undefined) return source
    const expressionStart = index + 2
    const expressionEnd = end - 1
    const expression = source.slice(expressionStart, expressionEnd)
    if (isSafeHtmlTextContext(context) && isExactTrustedEscaperCall(expression, trustedHtmlEscapers))
      maskRange(characters, expressionStart, expressionEnd)
    index = expressionEnd
    literalStart = end
  }
  return characters.join('')
}

function isExactTrustedEscaperCall(expression: string, trustedHtmlEscapers: Set<string>): boolean {
  const value = stripOuterParens(expression.trim())
  for (const escaper of trustedHtmlEscapers) {
    const match = new RegExp(`^${escapeRegExp(escaper)}\\s*\\(`).exec(value)
    if (!match) continue
    const call = callArguments(value, match[0].lastIndexOf('(') + 1)
    if (call && call.end === value.length) return true
  }
  return false
}

function isSafeHtmlTextContext(context: HtmlContext): boolean {
  return !context.inTag && context.rawTag === undefined
}

function updateHtmlContext(context: HtmlContext, literal: string): void {
  const lower = literal.toLowerCase()
  for (let index = 0; index < lower.length; index++) {
    const character = lower[index]!
    if (context.rawTag) {
      const close = `</${context.rawTag}`
      if (!lower.startsWith(close, index)) continue
      context.inTag = true
      context.closingTag = true
      context.pendingTag = context.rawTag
      context.rawTag = undefined
      index += close.length - 1
      continue
    }
    if (!context.inTag) {
      if (character !== '<') continue
      const match = /^<\s*(\/)?\s*([a-z][\w:-]*)/.exec(lower.slice(index))
      if (!match) continue
      context.inTag = true
      context.closingTag = Boolean(match[1])
      context.pendingTag = match[2]
      index += match[0].length - 1
      continue
    }
    if (context.quote) {
      if (character === context.quote) context.quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      context.quote = character
      continue
    }
    if (character !== '>') continue
    if (!context.closingTag && (context.pendingTag === 'script' || context.pendingTag === 'style'))
      context.rawTag = context.pendingTag
    context.inTag = false
    context.closingTag = false
    context.pendingTag = undefined
    context.quote = undefined
  }
}

function stripOuterParens(value: string): string {
  let current = value
  while (current.startsWith('(')) {
    const end = matchingDelimiter(current, 0, '(', ')')
    if (end !== current.length - 1) break
    current = current.slice(1, -1).trim()
  }
  return current
}

function callArguments(source: string, start: number): CallArguments | undefined {
  const args: string[] = []
  let argumentStart = start
  const stack: string[] = []
  for (let index = start; index < source.length; index++) {
    const skipped = skipLexicalToken(source, index)
    if (skipped !== undefined) {
      index = skipped - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') {
      stack.push(character)
      continue
    }
    if (character === ')' || character === ']' || character === '}') {
      if (character === ')' && stack.length === 0) {
        args.push(source.slice(argumentStart, index).trim())
        return {args, end: index + 1}
      }
      stack.pop()
      continue
    }
    if (character === ',' && stack.length === 0) {
      args.push(source.slice(argumentStart, index).trim())
      argumentStart = index + 1
    }
  }
  return undefined
}

function statementExpression(source: string, start: number): {text: string; end: number} | undefined {
  const stack: string[] = []
  for (let index = start; index < source.length; index++) {
    const skipped = skipLexicalToken(source, index)
    if (skipped !== undefined) {
      index = skipped - 1
      continue
    }
    const character = source[index]!
    if (character === '(' || character === '[' || character === '{') {
      stack.push(character)
      continue
    }
    if (character === ')' || character === ']' || character === '}') {
      stack.pop()
      continue
    }
    if (stack.length === 0 && character === ';') return {text: source.slice(start, index).trim(), end: index + 1}
    if (stack.length === 0 && character === '\n' && !continuesAcrossNewline(source, start, index))
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

function matchingDelimiter(source: string, start: number, open: string, close: string): number | undefined {
  const stack: string[] = []
  for (let index = start; index < source.length; index++) {
    const skipped = skipLexicalToken(source, index)
    if (skipped !== undefined) {
      index = skipped - 1
      continue
    }
    if (source[index] === open) stack.push(open)
    else if (source[index] === close) {
      stack.pop()
      if (stack.length === 0) return index
    }
  }
  return undefined
}

function skipLexicalToken(source: string, index: number): number | undefined {
  const character = source[index]
  if (character === '"' || character === "'") return skipQuotedLiteral(source, index, character)
  if (character === '`') return skipTemplateLiteral(source, index)
  if (character === '/' && isRegexLiteralStart(source, index)) return skipRegexLiteral(source, index)
  return undefined
}

function skipQuotedLiteral(source: string, start: number, quote: string): number | undefined {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
      continue
    }
    if (source[index] === quote) return index + 1
  }
  return undefined
}

function skipTemplateLiteral(source: string, start: number): number | undefined {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
      continue
    }
    if (source[index] === '`') return index + 1
    if (source[index] !== '$' || source[index + 1] !== '{') continue
    const end = skipTemplateExpression(source, index + 2)
    if (end === undefined) return undefined
    index = end - 1
  }
  return undefined
}

function skipTemplateExpression(source: string, start: number): number | undefined {
  let depth = 1
  for (let index = start; index < source.length; index++) {
    const skipped = skipLexicalToken(source, index)
    if (skipped !== undefined) {
      index = skipped - 1
      continue
    }
    if (source[index] === '{') depth++
    else if (source[index] === '}') {
      depth--
      if (depth === 0) return index + 1
    }
  }
  return undefined
}

function isRegexLiteralStart(source: string, index: number): boolean {
  const previous = previousSignificantCharacter(source, index)
  if (previous === undefined) return true
  if ('([{:;,=!?&|+-*%^~<>'.includes(previous)) return true
  const prefix = source.slice(0, index).trimEnd()
  return /\b(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)$/.test(prefix)
}

function skipRegexLiteral(source: string, start: number): number | undefined {
  let inClass = false
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
      continue
    }
    if (source[index] === '[') {
      inClass = true
      continue
    }
    if (source[index] === ']' && inClass) {
      inClass = false
      continue
    }
    if (source[index] !== '/' || inClass) continue
    index++
    while (/[a-z]/i.test(source[index] ?? '')) index++
    return index
  }
  return undefined
}

function previousSignificantCharacter(source: string, index: number): string | undefined {
  for (let cursor = index - 1; cursor >= 0; cursor--) if (!/\s/.test(source[cursor]!)) return source[cursor]
  return undefined
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
  const characters = [...source]
  maskCodeLiterals(characters, source, 0, source.length)
  return characters.join('')
}

function maskCodeLiterals(characters: string[], source: string, start: number, end: number): void {
  for (let index = start; index < end; index++) {
    const character = source[index]
    if (character === '"' || character === "'") {
      const next = skipQuotedLiteral(source, index, character)
      if (next === undefined) return
      maskRange(characters, index, next)
      index = next - 1
      continue
    }
    if (character === '`') {
      const next = maskTemplateLiteral(characters, source, index)
      if (next === undefined) return
      index = next - 1
      continue
    }
    if (character === '/' && isRegexLiteralStart(source, index)) {
      const next = skipRegexLiteral(source, index)
      if (next === undefined) return
      maskRange(characters, index, next)
      index = next - 1
    }
  }
}

function maskTemplateLiteral(characters: string[], source: string, start: number): number | undefined {
  characters[start] = ' '
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      maskRange(characters, index, Math.min(index + 2, source.length))
      index++
      continue
    }
    if (source[index] === '`') {
      characters[index] = ' '
      return index + 1
    }
    if (source[index] === '$' && source[index + 1] === '{') {
      characters[index] = ' '
      characters[index + 1] = ' '
      const end = maskTemplateExpression(characters, source, index + 2)
      if (end === undefined) return undefined
      index = end - 1
      continue
    }
    if (source[index] !== '\n') characters[index] = ' '
  }
  return undefined
}

function maskTemplateExpression(characters: string[], source: string, start: number): number | undefined {
  let depth = 1
  for (let index = start; index < source.length; index++) {
    const character = source[index]
    if (character === '"' || character === "'") {
      const next = skipQuotedLiteral(source, index, character)
      if (next === undefined) return undefined
      maskRange(characters, index, next)
      index = next - 1
      continue
    }
    if (character === '`') {
      const next = maskTemplateLiteral(characters, source, index)
      if (next === undefined) return undefined
      index = next - 1
      continue
    }
    if (character === '/' && isRegexLiteralStart(source, index)) {
      const next = skipRegexLiteral(source, index)
      if (next === undefined) return undefined
      maskRange(characters, index, next)
      index = next - 1
      continue
    }
    if (character === '{') depth++
    else if (character === '}') {
      depth--
      if (depth === 0) {
        characters[index] = ' '
        return index + 1
      }
    }
  }
  return undefined
}

function maskRange(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index++) if (characters[index] !== '\n') characters[index] = ' '
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
