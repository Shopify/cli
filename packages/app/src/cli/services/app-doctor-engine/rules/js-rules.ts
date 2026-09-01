import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const IDENTIFIER = '[A-Za-z_$][\\w$]*'
const SHOP_FIELD = 'shop(?:Domain)?'
const CREDENTIAL =
  /\b(?:accessToken|access_token|sessionToken|session_token|apiSecret|api_secret|clientSecret|client_secret|SHOPIFY_API_SECRET|SHOPIFY_ACCESS_TOKEN)\b/i

export function scanUnauthenticatedEndpoints(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file) || !file.path.includes('/routes/')) continue
    if (/auth[._/-]?(?:login|callback)/i.test(file.path)) continue
    const source = maskCommentsAndStrings(file.content!)
    const routePattern = /export\s+(?:async\s+)?(?:function\s+|const\s+)(loader|action)\b/g
    let route = routePattern.exec(source)
    while (route) {
      const body = source.slice(route.index, nextRouteIndex(source, routePattern.lastIndex))
      const authentication = /\bawait\s+authenticate\.(?:admin|public\.[A-Za-z_$][\w$]*|webhook)\s*\(/.exec(body)
      const accessesProtectedData =
        /\b(?:admin\.graphql|prisma\.|db\.|session\.|metafields?Set|unauthenticated\.admin)\b/.test(body)
      if (!authentication && accessesProtectedData) {
        issues.push(
          issue(
            'UNAUTHENTICATED_ENDPOINT',
            file,
            route.index,
            'Route handler lacks recognized auth verification',
            "The React Router loader/action doesn't have a recognized awaited Shopify authentication barrier.",
            'Call and await authenticate.admin(request) (or the applicable Shopify authenticator) before protected access.',
            -15,
          ),
        )
      }
      route = routePattern.exec(source)
    }
  }
  return issues
}

/**
 * Find high-signal request-to-unauthenticated.admin flows.
 *
 * Authentication is deliberately not a sanitiser here. A route may authenticate one
 * shop and still pass an independent request parameter naming a different shop to
 * unauthenticated.admin. Only values actually derived from the authentication/session
 * result stay untainted.
 */
export function scanRequestControlledAdminContext(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const source = maskStringsExceptShopKeys(maskComments(file.content!))
    const requestBindings = collectRequestShopBindings(source)
    const sinkPattern = /\bunauthenticated\.admin\s*\(/g
    let sink = sinkPattern.exec(source)
    while (sink) {
      const argument = firstCallArgument(source, sinkPattern.lastIndex)
      if (argument && isRequestControlledShop(argument.text, requestBindings)) {
        issues.push(
          issue(
            'REQUEST_CONTROLLED_ADMIN_CONTEXT',
            file,
            sink.index,
            'Request input selects Admin API shop context',
            'A request-derived shop value reaches unauthenticated.admin(...). Authentication elsewhere in the route does not prove that this independently supplied shop belongs to that session.',
            'Use the Admin API context returned by authenticate.admin(request), or derive the shop directly from its verified session.',
            -20,
          ),
        )
      }
      sinkPattern.lastIndex = argument?.end ?? sinkPattern.lastIndex
      sink = sinkPattern.exec(source)
    }
  }
  return issues
}

function collectRequestShopBindings(source: string): Set<string> {
  const requestControlled = new Set<string>()
  const requestContainers = new Set<string>()
  const formDataContainers = new Set<string>()
  const urlContainers = new Set<string>()
  const assignmentPattern = new RegExp(
    `(?:const|let|var)\\s+(${IDENTIFIER})\\s*=\\s*([\\s\\S]{1,500}?)(?:;|\\n(?=\\s*(?:const|let|var|return|await|})))`,
    'g',
  )
  let assignment = assignmentPattern.exec(source)
  while (assignment) {
    const name = assignment[1]!
    const expression = assignment[2]!.trim()
    if (
      /^(?:await\s+)?(?:request|req)\.json\s*\(\s*\)$/.test(expression) ||
      /^(?:request|req)\.(?:body|query|params)$/.test(expression)
    )
      requestContainers.add(name)
    if (/^(?:await\s+)?(?:request|req)\.formData\s*\(\s*\)$/.test(expression)) formDataContainers.add(name)
    if (/^new\s+URL\s*\(\s*(?:request|req)\.url\s*\)$/.test(expression)) urlContainers.add(name)
    assignment = assignmentPattern.exec(source)
  }

  const directRequestExpression = (expression: string): boolean => {
    if (new RegExp(`(?:request|req)\\.(?:body|query|params)(?:\\?\\.|\\.|\\[\\s*["'])${SHOP_FIELD}`).test(expression))
      return true
    if (
      /(?:searchParams|formData)\.get\s*\(\s*["']shop(?:Domain)?["']\s*\)/.test(expression) ||
      /new\s+URL\s*\(\s*(?:request|req)\.url\s*\)\.searchParams\.get\s*\(\s*["']shop(?:Domain)?["']/.test(expression)
    )
      return true
    for (const container of requestContainers)
      if (new RegExp(`\\b${escapeRegExp(container)}(?:\\?\\.|\\.|\\[\\s*["'])${SHOP_FIELD}`).test(expression))
        return true
    for (const container of formDataContainers)
      if (new RegExp(`\\b${escapeRegExp(container)}\\.get\\s*\\(\\s*["']${SHOP_FIELD}["']\\s*\\)`).test(expression))
        return true
    for (const container of urlContainers)
      if (
        new RegExp(`\\b${escapeRegExp(container)}\\.searchParams\\.get\\s*\\(\\s*["']${SHOP_FIELD}["']\\s*\\)`).test(
          expression,
        )
      )
        return true
    return [...requestControlled].some((binding) => new RegExp(`\\b${escapeRegExp(binding)}\\b`).test(expression))
  }

  const destructurePattern = /(?:const|let|var)\s*\{([\s\S]{1,300}?)\}\s*=\s*([\s\S]{1,300}?)(?:;|\n)/g
  let destructure = destructurePattern.exec(source)
  while (destructure) {
    const expression = destructure[2]!.trim()
    const requestObject =
      /^(?:await\s+)?(?:request|req)\.json\s*\(\s*\)$/.test(expression) ||
      /^(?:request|req)\.(?:body|query|params)$/.test(expression) ||
      requestContainers.has(expression)
    if (requestObject) {
      for (const property of destructure[1]!.split(',')) {
        const match = new RegExp(`^\\s*${SHOP_FIELD}(?:\\s*:\\s*(${IDENTIFIER}))?\\s*$`).exec(property)
        if (match) requestControlled.add(match[1] ?? property.trim())
      }
    }
    destructure = destructurePattern.exec(source)
  }

  // Iterate so a direct request binding can flow through a small number of local aliases.
  for (let pass = 0; pass < 5; pass++) {
    let changed = false
    assignmentPattern.lastIndex = 0
    assignment = assignmentPattern.exec(source)
    while (assignment) {
      const name = assignment[1]!
      if (!requestControlled.has(name) && directRequestExpression(assignment[2]!.trim())) {
        requestControlled.add(name)
        changed = true
      }
      assignment = assignmentPattern.exec(source)
    }
    if (!changed) break
  }
  return requestControlled
}

function isRequestControlledShop(expression: string, bindings: Set<string>): boolean {
  const direct =
    /(?:request|req)\.(?:body|query|params)(?:\?\.|\.|\[\s*["'])shop(?:Domain)?/.test(expression) ||
    /(?:searchParams|formData)\.get\s*\(\s*["']shop(?:Domain)?["']\s*\)/.test(expression) ||
    /new\s+URL\s*\(\s*(?:request|req)\.url\s*\)\.searchParams\.get\s*\(\s*["']shop(?:Domain)?["']/.test(expression)
  return direct || [...bindings].some((binding) => new RegExp(`\\b${escapeRegExp(binding)}\\b`).test(expression))
}

export function scanCredentialLogLeakage(files: SourceFile[]): Issue[] {
  return scanCredentialCallSinks(
    files,
    'CREDENTIAL_LOG_LEAKAGE',
    /\b(?:console\.(?:log|info|warn|error|debug|dir)|logger\.(?:log|info|warn|error|debug))\s*\(/g,
    'Credential reaches a log sink',
  )
}

export function scanCredentialBrowserLeakage(files: SourceFile[]): Issue[] {
  const title = 'Credential reaches the client browser'
  const callIssues = scanCredentialCallSinks(
    files,
    'CREDENTIAL_BROWSER_LEAKAGE',
    /\b(?:json|defer|(?:new\s+)?Response|(?:localStorage|sessionStorage)\.setItem)\s*\(/g,
    title,
  )
  const assignmentIssues = scanCredentialSinks(
    files,
    'CREDENTIAL_BROWSER_LEAKAGE',
    /(?:\breturn\s+\{|\b(?:window|globalThis|document)(?:\.[\w$]+|\[[^\]]+\])?\s*=|\.(?:innerHTML|outerHTML|textContent|value)\s*=)([^;\n]{0,600})/g,
    title,
  )
  const externalRequestIssues = scanExternalCredentialRequests(files)
  return [
    ...new Map(
      [...callIssues, ...assignmentIssues, ...externalRequestIssues].map((finding) => [
        `${finding.location.file}:${finding.location.line}`,
        finding,
      ]),
    ).values(),
  ]
}

function scanCredentialCallSinks(
  files: SourceFile[],
  id: 'CREDENTIAL_LOG_LEAKAGE' | 'CREDENTIAL_BROWSER_LEAKAGE',
  startPattern: RegExp,
  title: string,
): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const source = maskCommentsAndStrings(file.content!, {preserveTemplateExpressions: true})
    startPattern.lastIndex = 0
    let start = startPattern.exec(source)
    while (start) {
      const call = callContents(source, startPattern.lastIndex)
      if (call && CREDENTIAL.test(removeSafeCredentialUses(call.text)))
        issues.push(credentialIssue(id, file, start.index, title))
      startPattern.lastIndex = call?.end ?? startPattern.lastIndex
      start = startPattern.exec(source)
    }
  }
  return issues
}

function scanExternalCredentialRequests(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const sourceWithStrings = maskComments(file.content!)
    const maskedSource = maskCommentsAndStrings(file.content!, {preserveTemplateExpressions: true})
    const pattern = /\bfetch\s*\(/g
    let start = pattern.exec(sourceWithStrings)
    while (start) {
      const originalCall = callContents(sourceWithStrings, pattern.lastIndex)
      const maskedCall = callContents(maskedSource, pattern.lastIndex)
      if (
        originalCall &&
        maskedCall &&
        /^\s*["']https?:\/\//.test(originalCall.text) &&
        CREDENTIAL.test(removeSafeCredentialUses(maskedCall.text))
      )
        issues.push(
          credentialIssue('CREDENTIAL_BROWSER_LEAKAGE', file, start.index, 'Credential reaches the client browser'),
        )
      pattern.lastIndex = originalCall?.end ?? pattern.lastIndex
      start = pattern.exec(sourceWithStrings)
    }
  }
  return issues
}

function scanCredentialSinks(
  files: SourceFile[],
  id: 'CREDENTIAL_LOG_LEAKAGE' | 'CREDENTIAL_BROWSER_LEAKAGE',
  pattern: RegExp,
  title: string,
): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const source = maskCommentsAndStrings(file.content!, {preserveTemplateExpressions: true})
    pattern.lastIndex = 0
    let match = pattern.exec(source)
    while (match) {
      const unsafeExpression = removeSafeCredentialUses(match[0])
      if (CREDENTIAL.test(unsafeExpression)) issues.push(credentialIssue(id, file, match.index, title))
      match = pattern.exec(source)
    }
  }
  return issues
}

function credentialIssue(
  id: 'CREDENTIAL_LOG_LEAKAGE' | 'CREDENTIAL_BROWSER_LEAKAGE',
  file: SourceFile,
  index: number,
  title: string,
): Issue {
  return issue(
    id,
    file,
    index,
    title,
    'A credential value flows directly into a disclosure sink.',
    id === 'CREDENTIAL_LOG_LEAKAGE'
      ? 'Remove the credential from logs; log only a boolean or a deliberately redacted/hash-derived value.'
      : 'Keep credentials server-side and return only non-sensitive derived data to the browser.',
    -20,
  )
}

function removeSafeCredentialUses(expression: string): string {
  const credentialName =
    '(?:accessToken|access_token|sessionToken|session_token|apiSecret|api_secret|clientSecret|client_secret|SHOPIFY_API_SECRET|SHOPIFY_ACCESS_TOKEN)'
  return expression
    .replace(new RegExp(`\\b(?:redact|mask|hash|digest)\\s*\\(\\s*${credentialName}\\s*\\)`, 'gi'), '')
    .replace(new RegExp(`\\bBoolean\\s*\\(\\s*${credentialName}\\s*\\)|!!\\s*${credentialName}`, 'gi'), '')
    .replace(
      new RegExp(
        `\\b${credentialName}\\s*(?:===?|!==?)\\s*(?:undefined|null|true|false)|(?:undefined|null)\\s*(?:===?|!==?)\\s*${credentialName}`,
        'gi',
      ),
      '',
    )
    .replace(
      new RegExp(
        `\\bcreateHash\\s*\\([^)]*\\)\\s*\\.update\\s*\\(\\s*${credentialName}\\s*\\)\\s*\\.digest\\s*\\([^)]*\\)`,
        'gi',
      ),
      '',
    )
    .replace(new RegExp(`\\b${credentialName}\\s*:`, 'gi'), '')
}

/** Explicit regex-mode scan for high-signal executable HTML and JavaScript sinks. */
export function scanUnsafeInnerHTML(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  const sinkPatterns = [
    /\beval\s*\(\s*(?:await\s+)?[A-Za-z_$({][^)]*\)/g,
    /\bnew\s+Function\s*\(\s*(?:await\s+)?[A-Za-z_$({][^)]*\)/g,
    /\.(?:innerHTML|outerHTML)\s*=\s*(?:await\s+)?[A-Za-z_$({][^;\n]*/g,
    /\.insertAdjacentHTML\s*\([^,]+,\s*(?:await\s+)?[A-Za-z_$({][^)]*\)/g,
    /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?:await\s+)?[A-Za-z_$({][^}]*/g,
    /(?:createElement\s*\(\s*["']script["']\s*\)[\s\S]{0,300}?\.src|\bscript\.src)\s*=\s*(?:await\s+)?[A-Za-z_$({][^;\n]*/g,
  ]
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const source = maskCommentsAndStrings(file.content!, {preserveTemplateExpressions: true})
    for (const pattern of sinkPatterns) {
      pattern.lastIndex = 0
      let match = pattern.exec(source)
      while (match) {
        if (!/\b(?:sanitize|DOMPurify\.sanitize|escapeHtml)\s*\(/.test(match[0])) {
          issues.push(
            issue(
              'UNSAFE_INNERHTML',
              file,
              match.index,
              'Unsafe HTML assignment',
              'A non-literal value is written to an HTML, script, or evaluation sink.',
              'Avoid executable sinks, or apply a context-appropriate allowlist sanitizer immediately before the sink.',
              -25,
            ),
          )
        }
        match = pattern.exec(source)
      }
    }
  }
  return [...new Map(issues.map((finding) => [`${finding.location.file}:${finding.location.line}`, finding])).values()]
}

function isJavaScript(file: SourceFile): boolean {
  return Boolean(file.content) && JAVASCRIPT_EXTENSIONS.has(file.ext)
}

function nextRouteIndex(source: string, start: number): number {
  const next = /export\s+(?:async\s+)?(?:function\s+|const\s+)(?:loader|action)\b/g
  next.lastIndex = start
  return next.exec(source)?.index ?? source.length
}

function callContents(source: string, start: number): {text: string; end: number} | undefined {
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
      if (character === ')' && depth === 0) return {text: source.slice(start, index), end: index + 1}
      depth--
    }
  }
  return undefined
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

function maskStringsExceptShopKeys(source: string): string {
  // Template-literal arm uses [^`\\] so it cannot also match \\., which would ReDoS on unclosed `\\_\\_...` input.
  return source.replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^`\\])*`/g, (literal) =>
    /^["']shop(?:Domain)?["']$/.test(literal) ? literal : literal.replace(/[^\n]/g, ' '),
  )
}

/** Blank literal text while optionally retaining expressions embedded in template literals. */
function maskCommentsAndStrings(source: string, options: {preserveTemplateExpressions?: boolean} = {}): string {
  return maskComments(source).replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^`\\])*`/g, (literal) => {
    if (!options.preserveTemplateExpressions || !literal.startsWith('`')) return literal.replace(/[^\n]/g, ' ')
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function issue(
  id: string,
  file: SourceFile,
  index: number,
  title: string,
  message: string,
  fix: string,
  points: number,
): Issue {
  return {
    id,
    severity: 'high',
    points,
    title,
    message,
    location: {file: file.path, line: file.content!.slice(0, index).split('\n').length},
    fix: {automated: false, description: fix},
  }
}
