import type {Issue} from '../types.js'
import type {RunnerResult} from '../scanners/types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const IDENTIFIER = '[A-Za-z_$][\\w$]*'
const SHOP_FIELD = 'shop(?:Domain)?'
const CREDENTIAL =
  /\b(?:accessToken|access_token|sessionToken|session_token|apiSecret|api_secret|clientSecret|client_secret|SHOPIFY_API_SECRET|SHOPIFY_ACCESS_TOKEN)\b/i

/** Context-provided authenticators require agent review because their origin and execution order are unknown. */
export function scanUnauthenticatedEndpoints(files: SourceFile[]): RunnerResult {
  const issues: Issue[] = []
  const contextAuthFiles = new Set<string>()
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
      if (/\bcontext\s*\.\s*shopify\s*\.\s*authenticate\s*\.\s*admin\s*\(/.test(body)) {
        contextAuthFiles.add(file.path)
      } else if (!authentication && accessesProtectedData) {
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
  return {
    issues,
    ...(contextAuthFiles.size > 0
      ? {
          unresolvedReason: `Context-based route authentication needs agent review in ${[...contextAuthFiles].join(', ')}. A context.shopify.authenticate.admin call is neither proof of verification nor a missing-auth finding.`,
          unresolvedReasonCode: 'agent_investigation_required' as const,
        }
      : {}),
  }
}

/**
 * Find high-signal request-to-unauthenticated.admin flows.
 *
 * Authentication is deliberately not a sanitiser here. A route may authenticate one
 * shop and still pass an independent request parameter naming a different shop to
 * unauthenticated.admin. Only values actually derived from the authentication/session
 * result stay untainted.
 */
interface RequestShopState {
  requestPattern: string
  requestControlled: Set<string>
  requestContainers: Set<string>
  formDataContainers: Set<string>
  urlContainers: Set<string>
  requestShopHelpers: Set<string>
}

export function scanRequestControlledAdminContext(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    const source = maskStringsExceptShopKeys(maskComments(file.content!))
    const requestState = collectRequestShopState(source, ['request', 'req'], collectRequestShopHelpers(source))
    const sinkPattern = /\bunauthenticated\.admin\s*\(/g
    let sink = sinkPattern.exec(source)
    while (sink) {
      const argument = firstCallArgument(source, sinkPattern.lastIndex)
      if (argument && isRequestControlledShop(argument.text, requestState)) {
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

function collectRequestShopState(
  source: string,
  requestNames: string[],
  requestShopHelpers: Set<string> = new Set(),
): RequestShopState {
  const requestPattern = requestNames.map(escapeRegExp).join('|')
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
      new RegExp(`^(?:await\\s+)?(?:${requestPattern})\\.json\\s*\\(\\s*\\)$`).test(expression) ||
      new RegExp(`^(?:${requestPattern})\\.(?:body|query|params)$`).test(expression) ||
      isRequestShopHelperCall(expression, requestPattern, requestShopHelpers)
    )
      requestContainers.add(name)
    if (new RegExp(`^(?:await\\s+)?(?:${requestPattern})\\.formData\\s*\\(\\s*\\)$`).test(expression))
      formDataContainers.add(name)
    if (new RegExp(`^new\\s+URL\\s*\\(\\s*(?:${requestPattern})\\.url\\s*\\)$`).test(expression))
      urlContainers.add(name)
    assignment = assignmentPattern.exec(source)
  }

  const state: RequestShopState = {
    requestPattern,
    requestControlled,
    requestContainers,
    formDataContainers,
    urlContainers,
    requestShopHelpers,
  }

  const destructurePattern = /(?:const|let|var)\s*\{([\s\S]{1,300}?)\}\s*=\s*([\s\S]{1,300}?)(?:;|\n)/g
  let destructure = destructurePattern.exec(source)
  while (destructure) {
    const expression = destructure[2]!.trim()
    const requestObject =
      new RegExp(`^(?:await\\s+)?(?:${requestPattern})\\.json\\s*\\(\\s*\\)$`).test(expression) ||
      new RegExp(`^(?:${requestPattern})\\.(?:body|query|params)$`).test(expression) ||
      requestContainers.has(expression) ||
      isRequestShopHelperCall(expression, requestPattern, requestShopHelpers)
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
      if (!requestControlled.has(name) && isRequestControlledShop(assignment[2]!.trim(), state)) {
        requestControlled.add(name)
        changed = true
      }
      assignment = assignmentPattern.exec(source)
    }
    if (!changed) break
  }
  return state
}

function collectRequestShopHelpers(source: string): Set<string> {
  const helpers = new Set<string>()
  const parameterTail = '(?:\\s*:\\s*[^,)]+)?'
  const returnTypeTail = '(?:\\s*:\\s*(?:[^{}]|\\{[^{}]*\\})*)?'
  const helperPatterns = [
    new RegExp(
      `\\bfunction\\s+(${IDENTIFIER})\\s*\\(\\s*(${IDENTIFIER})${parameterTail}[^)]*\\)${returnTypeTail}\\s*\\{`,
      'g',
    ),
    new RegExp(
      `\\b(?:const|let|var)\\s+(${IDENTIFIER})\\s*=\\s*(?:async\\s+)?\\(\\s*(${IDENTIFIER})${parameterTail}[^)]*\\)${returnTypeTail}\\s*=>\\s*\\{`,
      'g',
    ),
  ]

  for (const pattern of helperPatterns) {
    let helper = pattern.exec(source)
    while (helper) {
      const body = blockContents(source, pattern.lastIndex - 1)
      if (body && helperReturnsRequestShop(body.text, helper[2]!)) helpers.add(helper[1]!)
      pattern.lastIndex = body?.end ?? pattern.lastIndex
      helper = pattern.exec(source)
    }
  }
  return helpers
}

function helperReturnsRequestShop(body: string, requestName: string): boolean {
  const state = collectRequestShopState(body, [requestName])
  return returnedShopExpressions(body).some((expression) => isRequestControlledShop(expression, state))
}

function returnedShopExpressions(source: string): string[] {
  const expressions: string[] = []
  const returnPattern = /\breturn\s*\{/g
  let returned = returnPattern.exec(source)
  while (returned) {
    const object = blockContents(source, returnPattern.lastIndex - 1)
    if (!object) break
    const propertyPattern = new RegExp(`(?:^|,)\\s*(${SHOP_FIELD})(?:\\s*:\\s*([^,}]+))?\\s*(?=,|$)`, 'g')
    let property = propertyPattern.exec(object.text)
    while (property) {
      expressions.push((property[2] ?? property[1]!).trim())
      property = propertyPattern.exec(object.text)
    }
    returnPattern.lastIndex = object.end
    returned = returnPattern.exec(source)
  }
  return expressions
}

function isRequestShopHelperCall(expression: string, requestPattern: string, helpers: Set<string>): boolean {
  return [...helpers].some((helper) =>
    new RegExp(`^${requestShopHelperCallPattern(helper, requestPattern)}$`).test(expression),
  )
}

function requestShopHelperCallPattern(helper: string, requestPattern: string): string {
  return `(?:await\\s+)?${escapeRegExp(helper)}\\s*\\(\\s*(?:${requestPattern})(?:\\s*,[\\s\\S]*?)?\\s*\\)`
}

function isRequestControlledShop(expression: string, state: RequestShopState): boolean {
  const direct =
    new RegExp(`(?:${state.requestPattern})\\.(?:body|query|params)(?:\\?\\.|\\.|\\[\\s*["'])${SHOP_FIELD}`).test(
      expression,
    ) ||
    /(?:searchParams|formData)\.get\s*\(\s*["']shop(?:Domain)?["']\s*\)/.test(expression) ||
    new RegExp(
      `new\\s+URL\\s*\\(\\s*(?:${state.requestPattern})\\.url\\s*\\)\\.searchParams\\.get\\s*\\(\\s*["']shop(?:Domain)?["']`,
    ).test(expression) ||
    isRequestShopHelperMember(expression, state)
  if (direct) return true
  for (const container of state.requestContainers)
    if (new RegExp(`\\b${escapeRegExp(container)}(?:\\?\\.|\\.|\\[\\s*["'])${SHOP_FIELD}`).test(expression)) return true
  for (const container of state.formDataContainers)
    if (new RegExp(`\\b${escapeRegExp(container)}\\.get\\s*\\(\\s*["']${SHOP_FIELD}["']\\s*\\)`).test(expression))
      return true
  for (const container of state.urlContainers)
    if (
      new RegExp(`\\b${escapeRegExp(container)}\\.searchParams\\.get\\s*\\(\\s*["']${SHOP_FIELD}["']\\s*\\)`).test(
        expression,
      )
    )
      return true
  return [...state.requestControlled].some((binding) => containsStandaloneIdentifier(expression, binding))
}

function isRequestShopHelperMember(expression: string, state: RequestShopState): boolean {
  return [...state.requestShopHelpers].some((helper) => {
    const call = `(?:\\(\\s*)?${requestShopHelperCallPattern(helper, state.requestPattern)}(?:\\s*\\))?`
    return new RegExp(`${call}\\s*(?:\\?\\.|\\.|\\[\\s*["'])${SHOP_FIELD}`).test(expression)
  })
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

function blockContents(source: string, openBraceIndex: number): {text: string; end: number} | undefined {
  let depth = 0
  let quote: string | undefined
  for (let index = openBraceIndex + 1; index < source.length; index++) {
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
    if (character === '{') depth++
    else if (character === '}') {
      if (depth === 0) return {text: source.slice(openBraceIndex + 1, index), end: index + 1}
      depth--
    }
  }
  return undefined
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

const MYSHOPIFY_DOMAIN_IN_REGEX = /myshopify/i
const MYSHOPIFY_DOMAIN = /myshopify\.com/i
/**
 * `myshopify.com` with the dot before it. A suffix that contains it, such as `.myshopify.com` or `example.myshopify.com`,
 * can't match a lookalike host such as `evil-myshopify.com`.
 */
const DOTTED_MYSHOPIFY_DOMAIN = /\.myshopify\.com/i
/** A value that names a shop host, so a `myshopify.com` check on it guards a shop trust boundary. */
const SHOP_VALUE = /(?:\b|_)(?:my)?shop/i
/** The value a method is called on, such as `shop`, `req.query.shop`, or `url.searchParams.get('shop')`. */
const RECEIVER = /[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\[[^\]\n]*\]|\([^()\n]*\))*/.source
/** A `value.match(` or `value.search(` call that ends where its regex argument starts. */
const MATCH_CALL_BEFORE_ARGUMENT = new RegExp(`(${RECEIVER})\\s*\\.\\s*(?:match|search)\\s*\\(\\s*$`)

/**
 * Flag shop-domain validation that accepts attacker-controlled hosts, applied to a shop value: a `myshopify.com` regex
 * that doesn't require the dot before `myshopify.com` or doesn't anchor the end of the hostname, an `includes` check,
 * and an `endsWith` check without the dot before `myshopify.com`. End-anchored checks that require the dot, such as
 * `/^[a-z0-9-]+\.myshopify\.com$/`, `shop.endsWith('.myshopify.com')` or `shop.endsWith('example.myshopify.com')`,
 * stay clean.
 */
export function scanWeakShopValidation(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!isJavaScript(file)) continue
    // Regex literals stay intact only in the strings-masked copy, and the checked expression and string contents stay
    // intact only in the comments-masked one. Both preserve offsets, so positions transfer between them.
    const code = maskCommentsAndStrings(file.content!, {preserveTemplateExpressions: true})
    const text = maskComments(file.content!)
    const findings = new Map<number, WeakShopValidationKind>()
    for (const check of substringChecks(code, text)) findings.set(check.index, check.kind)
    for (const validator of weakShopDomainValidators(code, text)) {
      const index = validator.name
        ? namedValidatorUse(code, text, validator.name)
        : inlineValidatorUse(code, text, validator)
      if (index !== undefined) findings.set(index, validator.kind)
    }
    for (const index of [...findings.keys()].sort((left, right) => left - right))
      issues.push(weakShopValidationIssue(file, index, findings.get(index)!))
  }
  return issues
}

type WeakShopValidationKind = 'no_end_anchor' | 'regex_without_dot' | 'substring_check' | 'suffix_without_dot'

interface WeakShopDomainValidator {
  /** Start of the validator expression: a regex literal's opening `/` or the start of a `RegExp(...)` call. */
  start: number
  /** End of the validator expression: after a regex literal's flags or a `RegExp(...)` call's closing parenthesis. */
  end: number
  /** The identifier the validator is assigned to, when it is used through a variable. */
  name?: string
  /** Why the validator accepts an attacker-controlled host. */
  kind: WeakShopValidationKind
}

/** `myshopify.com` regexes that accept a hostname no Shopify shop owns. */
function weakShopDomainValidators(code: string, text: string): WeakShopDomainValidator[] {
  const validators: WeakShopDomainValidator[] = []
  const record = (source: string, start: number, end: number): void => {
    if (!MYSHOPIFY_DOMAIN_IN_REGEX.test(source)) return
    const kind = weakShopDomainRegex(source)
    if (kind === undefined) return
    const name = declaredValidatorName(code, start)
    validators.push({start, end, kind, ...(name === undefined ? {} : {name})})
  }

  for (let index = 0; index < code.length; index++) {
    if (code[index] !== '/' || !isRegexLiteralStart(code, index)) continue
    const end = skipRegexLiteral(code, index)
    // A `/` that doesn't close on its line starts something else, such as a JSX closing tag.
    if (end === undefined) continue
    record(code.slice(index + 1, code.lastIndexOf('/', end - 1)), index, end)
    index = end - 1
  }

  const constructorPattern = /\b(?:new\s+)?RegExp\s*\(/g
  let constructor = constructorPattern.exec(code)
  while (constructor) {
    const argument = firstCallArgument(text, constructorPattern.lastIndex)
    const call = callContents(text, constructorPattern.lastIndex)
    const source = argument ? stringLiteralSource(argument.text) : undefined
    if (source !== undefined && call) record(stringLiteralValue(source), constructor.index, call.end)
    constructorPattern.lastIndex = call?.end ?? argument?.end ?? constructorPattern.lastIndex
    constructor = constructorPattern.exec(code)
  }
  return validators
}

/** Why a `myshopify.com` regex accepts an attacker-controlled host, or undefined when it accepts only a shop host. */
function weakShopDomainRegex(source: string): WeakShopValidationKind | undefined {
  const alternatives = topLevelAlternatives(source).filter((alternative) => MYSHOPIFY_DOMAIN_IN_REGEX.test(alternative))
  if (!alternatives.every((alternative) => requiresDotBeforeMyshopify(alternative))) return 'regex_without_dot'
  return alternatives.every((alternative) => endsWithEndAnchor(alternative)) ? undefined : 'no_end_anchor'
}

/**
 * Whether only a dot or the start of the value can come before each `myshopify` in a top-level alternative, so a
 * lookalike host such as `evil-myshopify.com` can't match. Grouped forms such as `\.(?:myshopify|shopify)\.com` and
 * `^([a-z0-9-]+\.)?myshopify\.com` require it too.
 */
function requiresDotBeforeMyshopify(alternative: string): boolean {
  return [...alternative.matchAll(/myshopify/gi)].every((occurrence) =>
    endsAtDotOrStart(withoutOpeningGroups(alternative.slice(0, occurrence.index ?? 0))),
  )
}

/** A pattern prefix without the groups that open at its end, or the alternatives before its end in those groups. */
function withoutOpeningGroups(prefix: string): string {
  const groupOpening = /\((?:\?:|\?<[A-Za-z_$][\w$]*>)?$/.exec(prefix)
  if (groupOpening && !isEscaped(prefix, groupOpening.index))
    return withoutOpeningGroups(prefix.slice(0, groupOpening.index))
  if (!prefix.endsWith('|') || isEscaped(prefix, prefix.length - 1)) return prefix
  const groupStart = enclosingGroupStart(prefix)
  return groupStart === undefined ? prefix : withoutOpeningGroups(prefix.slice(0, groupStart))
}

/** Whether a pattern prefix can only end with a literal dot or at the start of the value. */
function endsAtDotOrStart(prefix: string): boolean {
  const last = prefix.length - 1
  if (prefix[last] === '^') return !isEscaped(prefix, last)
  if (prefix[last] === '.') return isEscaped(prefix, last)
  if (/\[\\?\.\]$/.test(prefix)) return true
  const groupEnd = /\)([*+?]?)$/.exec(prefix)
  if (!groupEnd || isEscaped(prefix, groupEnd.index)) return false
  const groupStart = enclosingGroupStart(prefix.slice(0, groupEnd.index))
  if (groupStart === undefined) return false
  const content = prefix.slice(groupStart + 1, groupEnd.index).replace(/^\?(?::|<[A-Za-z_$][\w$]*>)/, '')
  const groupEndsAtDotOrStart = topLevelAlternatives(content).every((alternative) => endsAtDotOrStart(alternative))
  // A group that can be absent, such as `([a-z0-9-]+\.)?`, leaves what comes before it at the end.
  const optional = groupEnd[1] === '?' || groupEnd[1] === '*'
  return groupEndsAtDotOrStart && (!optional || endsAtDotOrStart(prefix.slice(0, groupStart)))
}

/** Whether the pattern requires the end of the hostname, allowing trailing groups such as `/^(\.myshopify\.com$)/`. */
function endsWithEndAnchor(source: string): boolean {
  let end = source.length
  while (end > 0 && /[)\s]/.test(source[end - 1]!)) end--
  return end > 0 && source[end - 1] === '$' && !isEscaped(source, end - 1)
}

/** The alternatives of a pattern's top-level `|`, such as `a` and `b(c|d)` in `a|b(c|d)`. */
function topLevelAlternatives(source: string): string[] {
  const alternatives: string[] = []
  let depth = 0
  let inClass = false
  let start = 0
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '\\') index++
    else if (inClass) inClass = character !== ']'
    else if (character === '[') inClass = true
    else if (character === '(') depth++
    else if (character === ')') depth--
    else if (character === '|' && depth === 0) {
      alternatives.push(source.slice(start, index))
      start = index + 1
    }
  }
  return [...alternatives, source.slice(start)]
}

/** The index of the `(` that opens the group a pattern prefix ends inside, or undefined at the top level. */
function enclosingGroupStart(prefix: string): number | undefined {
  const openGroups: number[] = []
  let inClass = false
  for (let index = 0; index < prefix.length; index++) {
    const character = prefix[index]
    if (character === '\\') index++
    else if (inClass) inClass = character !== ']'
    else if (character === '[') inClass = true
    else if (character === '(') openGroups.push(index)
    else if (character === ')') openGroups.pop()
  }
  return openGroups[openGroups.length - 1]
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) backslashes++
  return backslashes % 2 === 1
}

/** The content of an expression that is only a quoted string literal, such as a `RegExp("…")` argument. */
function stringLiteralSource(expression: string): string | undefined {
  const match = /^\s*(["'`])((?:\\.|(?!\1)[^\\\n])*)\1\s*$/.exec(expression)
  return match?.[2]
}

/**
 * The value of a string literal's content, as far as a regex source needs it: an escaped character stands for itself,
 * so `'\\.myshopify'` requires a dot and `'\.myshopify'` doesn't.
 */
function stringLiteralValue(source: string): string {
  return source.replace(/\\([\s\S])/g, '$1')
}

function declaredValidatorName(code: string, start: number): string | undefined {
  const prefix = code.slice(Math.max(0, start - 200), start)
  return /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(prefix)?.[1]
}

/** Where a variable-bound validator is used on a shop value, if it is. */
function namedValidatorUse(code: string, text: string, name: string): number | undefined {
  const testCall = new RegExp(`\\b${escapeRegExp(name)}\\s*\\.\\s*(?:test|exec)\\s*\\(`, 'g')
  let use = testCall.exec(code)
  while (use) {
    if (validatesShopValue(code, text, use.index + use[0].length)) return use.index
    use = testCall.exec(code)
  }
  const matchCall = new RegExp(`(${RECEIVER})\\s*\\.\\s*(?:match|search)\\s*\\(\\s*${escapeRegExp(name)}\\s*[,)]`, 'g')
  let match = matchCall.exec(code)
  while (match) {
    if (SHOP_VALUE.test(receiverText(text, match))) return match.index
    match = matchCall.exec(code)
  }
  return undefined
}

/** Where an inline validator is used on a shop value, as `regex.test(shop)` or `shop.match(regex)`, if it is. */
function inlineValidatorUse(code: string, text: string, validator: WeakShopDomainValidator): number | undefined {
  const call = /^\s*\.\s*(?:test|exec)\s*\(/.exec(code.slice(validator.end))
  if (call) return validatesShopValue(code, text, validator.end + call[0].length) ? validator.end : undefined
  const windowStart = Math.max(0, validator.start - 300)
  const matchCall = MATCH_CALL_BEFORE_ARGUMENT.exec(code.slice(windowStart, validator.start))
  return matchCall && SHOP_VALUE.test(receiverText(text, matchCall, windowStart)) ? validator.start : undefined
}

/**
 * The original text of a receiver that a call pattern matched in the strings-masked code, so a string key such as
 * `query['shop']` still names the shop value.
 */
function receiverText(text: string, match: RegExpExecArray, offset = 0): string {
  const start = offset + match.index
  return text.slice(start, start + match[1]!.length)
}

/** Whether the first argument of a call names a shop value rather than a literal or unrelated expression. */
function validatesShopValue(code: string, text: string, openParen: number): boolean {
  const argument = firstCallArgument(code, openParen)
  if (!argument) return false
  const expression = text.slice(openParen, argument.end - 1)
  return SHOP_VALUE.test(expression) && stringLiteralSource(expression) === undefined
}

/**
 * `includes(...)` checks of `myshopify.com` on a shop value, which never anchor the end of the hostname, and
 * `endsWith(...)` checks without the dot before `myshopify.com`, which accept a lookalike host.
 */
function substringChecks(code: string, text: string): {index: number; kind: WeakShopValidationKind}[] {
  const pattern = new RegExp(`(${RECEIVER})\\s*\\.\\s*(includes|endsWith)\\s*\\(`, 'g')
  const checks: {index: number; kind: WeakShopValidationKind}[] = []
  let match = pattern.exec(code)
  while (match) {
    const argument = firstCallArgument(text, pattern.lastIndex)
    const value = argument ? stringLiteralSource(argument.text) : undefined
    if (value !== undefined && MYSHOPIFY_DOMAIN.test(value) && SHOP_VALUE.test(receiverText(text, match))) {
      if (match[2] === 'includes') checks.push({index: match.index, kind: 'substring_check'})
      else if (!DOTTED_MYSHOPIFY_DOMAIN.test(value)) checks.push({index: match.index, kind: 'suffix_without_dot'})
    }
    match = pattern.exec(code)
  }
  return checks
}

const WEAK_SHOP_VALIDATION_FINDINGS: Record<WeakShopValidationKind, {title: string; message: string; fix: string}> = {
  no_end_anchor: {
    title: 'Shop domain validation regex is not anchored',
    message:
      'The myshopify.com regex does not anchor the end of the hostname, so a value such as <shop>.myshopify.com.attacker.com passes shop validation.',
    fix: 'Anchor the regex with $ so it accepts only an exact <shop>.myshopify.com hostname.',
  },
  regex_without_dot: {
    title: 'Shop domain validation accepts a lookalike host',
    message:
      'The myshopify.com regex does not require the dot before myshopify.com, so a lookalike host such as evil-myshopify.com passes shop validation.',
    fix: 'Require the leading dot in the regex so it accepts only <shop>.myshopify.com hostnames.',
  },
  substring_check: {
    title: 'Shop domain validation is not anchored',
    message:
      'The includes check accepts myshopify.com anywhere in the value, so a value such as <shop>.myshopify.com.attacker.com passes shop validation.',
    fix: "Check the end of the hostname with endsWith('.myshopify.com'), or with an anchored regex such as /^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$/.",
  },
  suffix_without_dot: {
    title: 'Shop domain validation accepts a lookalike host',
    message:
      'The myshopify.com suffix check does not include the leading dot, so a lookalike host such as evil-myshopify.com passes shop validation.',
    fix: "Include the leading dot, such as endsWith('.myshopify.com'), so only <shop>.myshopify.com hostnames pass.",
  },
}

function weakShopValidationIssue(file: SourceFile, index: number, kind: WeakShopValidationKind): Issue {
  const {title, message, fix} = WEAK_SHOP_VALIDATION_FINDINGS[kind]
  return issue('WEAK_SHOP_VALIDATION', file, index, title, message, fix, -15)
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
  // UTF-16 code units, not code points: blanking a surrogate pair as one space would shift every later offset.
  const characters = source.split('')
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
    const original = literal.split('')
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

/** Whether the `/` at `index` starts a regex literal rather than a division. */
function isRegexLiteralStart(source: string, index: number): boolean {
  const previous = previousSignificantCharacter(source, index)
  if (previous === undefined) return true
  if ('([{:;,=!?&|+-*%^~<>'.includes(previous)) return true
  const prefix = source.slice(0, index).trimEnd()
  return /\b(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)$/.test(prefix)
}

/** The index after a regex literal's closing `/` and flags, or undefined when it never closes. */
function skipRegexLiteral(source: string, start: number): number | undefined {
  let inClass = false
  for (let index = start + 1; index < source.length; index++) {
    // A regex literal can't contain a line break, so one proves this `/` began something else, such as a JSX
    // closing tag.
    if (source[index] === '\n' || source[index] === '\r') return undefined
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
